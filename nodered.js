/*
 * Copyright (c) 2022-2023  Moddable Tech, Inc.
 *
 *   This file is part of the Moddable SDK Runtime.
 *
 *   The Moddable SDK Runtime is free software: you can redistribute it and/or modify
 *   it under the terms of the GNU Lesser General Public License as published by
 *   the Free Software Foundation, either version 3 of the License, or
 *   (at your option) any later version.
 *
 *   The Moddable SDK Runtime is distributed in the hope that it will be useful,
 *   but WITHOUT ANY WARRANTY; without even the implied warranty of
 *   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *   GNU Lesser General Public License for more details.
 *
 *   You should have received a copy of the GNU Lesser General Public License
 *   along with the Moddable SDK Runtime.  If not, see <http://www.gnu.org/licenses/>.
 *
 */

import Timer from "timer";
import deepEqual from "deepEqual";
import structuredClone from "structuredClone";
import Base64 from "base64";
import Hex from "hex";
import Modules from "modules";
import config from "mc/config";

const nodeClasses = new Map;
let compatibilityClasses;
let msgQueue;
export const configFlowID = "__config";

function generateId() @ "xs_nodered_util_generateId";

class RED {
	static #compatibility = [];

	static settings = Object.freeze({
	});

	static _(msg /*, obj */) {	// https://nodered.org/docs/creating-nodes/i18n
		return msg;		// not localizing
	}
	static util = class {
		static cloneMessage = structuredClone;
		static compareObjects = deepEqual;
		static evaluateNodeProperty(/* inputField, inputFieldType, node, msg, callback */) {
			throw new Error;
		}
		static generateId = generateId;
		static getMessageProperty(msg, property) {
			if (property.startsWith("msg."))
				property = property.slice(4);
			return this.getObjectProperty(msg, property);
		}
		static getObjectProperty(obj, property) {
			if (property.indexOf(".") >= 0)
				throw new Error("unimplemented");
			return obj[property];
		}
		static setMessageProperty(msg, property, value, createMissing) {
			if (property.startsWith("msg."))
				property = property.slice(4);
			return this.setObjectProperty(msg, property, value, createMissing);
		}
		static setObjectProperty(obj, property, value, createMissing) {
			if ((property.indexOf(".") >= 0) || createMissing)
				throw new Error;
			obj[property] = value;
		}
		static ensureString(s) {
			const type = typeof s;
			if ("string" === type)
				return s;
			if ("object" === type) {
				if (s instanceof Uint8Array)
					return s.toString();
				return JSON.stringify(s);
			}
			return "" + s;
		}
		static getSetting(node, name) {
			return node.getSetting(name);
		}
		static prepareJSONataExpression() {
			throw new Error("unimplemented");
		}
	}
	static nodes = class {
		static registerType(id, Node) {
			(compatibilityClasses ?? nodeClasses).set(id, Node);
		}
		static createNode() {		// nothing to do: initialization done in class
		}
		static getNode(id) {
			for (let flow of flows.values()) {
				const node = flow.getNode(id);
				if (node)
					return node;
			}
		}
	}
	static mcu = class {
		static getNodeConstructor(type) {
			const Class = nodeClasses.get(type);
			if (!Class) {	
				const msg = `Unsupported Node "${type}"`; 
				trace(msg, "\n");
				throw new Error(msg);
			}
			return Class;
		}
		static enqueue(msg, target) {
			msg = RED.util.cloneMessage(msg);
			msg._target = target;
			if (msgQueue.first) {
				msgQueue.last._next = msg;
				msgQueue.last = msg;
			}
			else {
				msgQueue.first = msgQueue.last = msg;
				Timer.schedule(msgQueue.timer, 0, 5000);
			}
		}
		static deliver() {
			Timer.schedule(msgQueue.timer);

			let current = msgQueue.first;
			msgQueue.first = msgQueue.last = undefined;
			while (current) {
				const next = current._next, target = current._target;
				delete current._next; 
				delete current._target; 
				target.receive(current, target.makeDone(current));
				current = next;
			}
		}
	}

	static build(builder) {
		const flows = new Map;
		globalThis.flows = flows;		// not ideal (gives FunctionNode access to all flows)
		msgQueue = {first: undefined, last: undefined, timer: Timer.repeat(() => RED.mcu.deliver(), 5000, 5000)};

		if (config.noderedmcu?.editor)
			trace.left('{"state": "building"}', "NR_EDITOR");

		globalThis.globalContext = new Context;

		if (this.#compatibility.length) {
			compatibilityClasses = new Map;
			this.#compatibility.forEach(f => f(RED));
		}

		builder.build(
			flows,
			(id, name, env) => {
				const flow = new Flow(id, name, env);
				flows.set(id, flow);
				return flow;
			},
			(type, id, name, flow) => {
				let Class = nodeClasses.get(type) ?? compatibilityClasses?.get(type);
				if (!Class) {	
					trace(`Disabling unsupported node type "${type}"!\n`);
					Class = UnknownNode;
				}

				if (Node.isPrototypeOf(Class))
					flow.addNode(new Class(id, flow, name));
				else
					flow.addNode(new CompatibiltyNode(id, flow, name, Class));
			}
		);

		if (config.noderedmcu?.editor)
			trace.left('{"state": "ready"}', "NR_EDITOR");

		return flows;
	}

	static addCompatibility(module) {
		this.#compatibility.push(module);
	}
}

class Context extends Map {
	keys() {
		return [...super.keys()];
	}
}

function nop() {
}

class Flow extends Map {
	constructor(id, name, env) {
		super();
		const properties = {
			id: {value: id},
			context: {value: new Context}
		};
		if (name)
			properties.name = {value: name};
		if (env)
			properties.env = {value: env};
		Object.defineProperties(this, properties);
	}
	addNode(node) {
		super.set(node.id, node);
	}
	getSetting(name) {
        if ("NR_FLOW_NAME" === name)
            return this.name;
        if (("NR_FLOW_ID" === name) || ("NR_NODE_PATH" === name))
            return this.id;

		if (name.startsWith("$parent."))
			return "";

		return this.env?.[name] ?? "";
	}
	static {
		this.prototype.getNode = this.prototype.get;
		this.prototype.nodes = this.prototype.values;
	}
}

export class Node {
	#outputs = Node.noOutputs;
	#flow;

	constructor(id, flow, name) {
		this.#flow = flow;
		const properties = {
			id: {value: id}
		};
		if (name)
			properties.name = {value: name};
		Object.defineProperties(this, properties);
	}
	onStart(config) {
		if (config.g)
			Object.defineProperty(this, "group", {value: this.#flow.getNode(config.g)});
		const wires = config.wires;
		if (wires) {
			this.#outputs = wires.map(wire => wire.map(target => this.#flow.getNode(target)));
			if (!config.dones && !config.errors && !config.statuses)
				return;
		}
		else {
			if (!config.dones && !config.errors && !config.statuses)
				return;
			this.#outputs = [];
		}
		if (config.statuses)
			this.#outputs.statuses = config.statuses.map(target => this.#flow.getNode(target));
		if (config.dones)
			this.#outputs.dones = config.dones.map(target => this.#flow.getNode(target));
		if (config.errors)
			this.#outputs.errors = config.errors.map(target => this.#flow.getNode(target));
	}
	onMessage(/* msg */) {
	}
	send(msg) {
		const outputs = this.#outputs;
		if (!outputs.length)
			return;

		if (Array.isArray(msg)) {
			const length = Math.min(msg.length, outputs.length);
			for (let j = 0; j < length; j++) {
				for (let i = 0, wires = outputs[j], length = wires.length; i < length; i++) {
					const m = msg[j];
					if (Array.isArray(m)) {
						for (let k = 0, length = m.length; k < length; k++) {
							m[k]._msgid ??= generateId();
							RED.mcu.enqueue(m[k], wires[i]);
						}
					}
					else if (m) {
						m._msgid ??= generateId();
						RED.mcu.enqueue(m, wires[i]);
					}
				}
			}
		}
		else {
			msg._msgid ??= generateId();
			for (let i = 0, wires = outputs[0], length = wires.length; i < length; i++)
				RED.mcu.enqueue(msg, wires[i]); 
		}
	}
	receive(msg, done) {
		//@@ queue if not ready
		const result = this.onMessage(msg, done);
		if (result)
			return this.send(result);
	}
	status(status) {
		if (config.noderedmcu?.editor)
			trace.left(JSON.stringify({status}), this.id);

		const statuses = this.#outputs.statuses;
		if (!statuses)
			return;

		const msg = {
			status: {
				...status,
			},
			source: {
				id: this.id,
				type: this.constructor.type,
				name: this.name
			}
		};

		for (let i = 0, length = statuses.length; i < length; i++)
			RED.mcu.enqueue(msg, statuses[i]);
	}
	done(msg) {
		this.makeDone(msg)();
	}
	getSetting(name) {
        if ("NR_NODE_NAME" === name)
			return this.name;
        if ("NR_NODE_ID" === name)
			return this.id;
		if ("NR_NODE_PATH" === name)
			return this.#flow.getSetting(name) + "/" + this.id; 

		const parent = this.group ?? this.#flow;
		return parent.getSetting(name);
	}
	log(msg) {
		this.trace(msg);
	}
	warn(warn) {
		if (config.noderedmcu?.editor)
			trace.left(JSON.stringify({warn: {warn}}), this.id);
		this.trace(`(warning: ${warn})`);
	}
	error(error, msg = {}) {
		if (config.noderedmcu?.editor)
			trace.left(JSON.stringify({error: {error}}), this.id);
		this.makeDone(msg)(error);
	}
	debug(msg) {
		this.trace(msg);
	}
	trace(msg) {
		trace(msg, "\n");
	}
	get outputCount() {
		return this.#outputs.length;
	}
	get flow() {
		return this.#flow.context;
	}
	makeDone(msg) {
		if (this.#outputs.dones || this.#outputs.errors) {
			const source = this;
			return function(error) {
				if (error) {
					if (msg.error)
						msg._error = msg.error;		// "If the message already had a msg.error property when the node reported the error, that property will be moved to msg._error."
					msg.error = {
						message: error.toString(),
						source: {
							id: source.id,
							type: source.constructor.type,
							name: source.name ?? "",
							count: 0		//@@ recursion counter	
						}
					}
				}
				for (let i = 0, dones = error ? source.#outputs.errors : source.#outputs.dones, length = dones ? dones.length : 0; i < length; i++) {
					RED.mcu.enqueue(msg, dones[i]);
				}
			}
		}
		
		return nop;
	}
	onCommand(options) {
		trace(`Node ${this.id} ignored: ${options.command}\n`);
	}

	static {
		this.noOutputs = Object.freeze([]);
	}
}

class UnknownNode extends Node {
	onStart() {}	// so outputs are not needlessly connected
	receive() {}
	send() {}

	static type = "unknown";
	static {
		RED.nodes.registerType(this.type, this);
	}
}

class Group extends Node {
	#env;

	onStart(config) {
		super.onStart(config);
		this.#env = config.env;
	}
	getSetting(name) {
		if ("NR_GROUP_NAME" == name)
			return this.name;
		if ("NR_GROUP_ID" == name)
			return this.id;

		if (name.startsWith("$parent."))
			return super.getSetting(name.slice(8));

		return this.#env?.[name] ?? super.getSetting(name); 
	}

	static type = "group";
	static {
		RED.nodes.registerType(this.type, this);
	}
}

class DebugNode extends Node {
	#property;
	#getter;
	#console;
	#sidebar;
	#toStatus;
	#statusType;
	#statusVal;
	#oldStatus;
	#active;

	onStart(config) {
		super.onStart(config);

		this.#property = config.property;
		this.#getter = config.getter;
		this.#console = config.console;
		this.#sidebar = config.tosidebar;
		this.#toStatus = config.tostatus;
		this.#statusType = config.statusType;
		this.#statusVal = config.statusVal;
		this.#active = config.active
	}
	onMessage(msg, done) {
		if (!this.#active) {
			done();
			return;
		}

		// to prevent endless loops -> 21-debug.js:123
		if (msg.status?.source?.id === this.id) {
			done();
			return;
		}

		// Feed msg back to the editor
		if (config.noderedmcu?.editor)
			trace.left(JSON.stringify({input: msg}), this.id);

		// Process msg for xsbug
		let value = this.#getter(msg);

		if (this.#console) {
			if (value instanceof Uint8Array)
				value = Hex.toString(value);
			trace("<warn>", ("object" === typeof value) ? JSON.stringify(value) : value, "\n");
		}

		if (this.#sidebar) {
			value = this.#property ? {[this.#property]: value} : msg;
			value = {
				...value,
				source: {
					id: this.id,
					type: this.constructor.type,
					name: this.name
				} 
			};
			trace("<info>", JSON.stringify(value), "\n");
		}

		if (this.#toStatus) {
			let statusVal = this.#statusVal(msg);		// NR says: #statusVal shall return typeof string!
			if (statusVal !== this.#oldStatus) {
				if (statusVal.length > 32)
					statusVal = statusVal.slice(0, 32) + "…";
				this.status({fill: "grey", shape: "dot", text: statusVal});
				this.#oldStatus = statusVal;
			}
		}

		done();
	}
	onCommand(options) {
		if ("debug" === options.command)
			this.#active = !!options.data;
	}

	static type = "debug";
	static {
		RED.nodes.registerType(this.type, this);
	}
}

class CatchNode extends Node {
	onMessage(msg, done) {
		done();
		return msg;
	}

	static type = "catch";
	static {
		RED.nodes.registerType(this.type, this);
	}
}

class StatusNode extends Node {
	onMessage(msg, done) {
		done();
		return msg;
	}

	static type = "status";
	static {
		RED.nodes.registerType(this.type, this);
	}
}

class CompleteNode extends Node {
	onMessage(msg, done) {
		done();
		return msg;
	}

	static type = "complete";
	static {
		RED.nodes.registerType(this.type, this);
	}
}

class InjectNode extends Node {
	onStart(config) {
		super.onStart(config);

		Object.defineProperty(this, "trigger", {value: config.trigger});
		config.initialize?.call(this);
	}
	onCommand(options) {
		if ("inject" === options.command)
			this.trigger();
	}

	static type = "inject";
	static {
		RED.nodes.registerType(this.type, this);
	}
}

class FunctionNode extends Node {
	#func;
	#libs;
	#doDone;
	//@@ might cache env here

	constructor(id, flow, name) {
		super(id, flow, name);
		Object.defineProperties(this, {
			context: {value: new Context}
		});
		Object.defineProperties(this.context, {
			global: {value: globalContext},
			flow: {value: flow.context}
		});
	}
	onStart(config) {
		super.onStart(config);

		if (config.libs?.length) {
			this.#libs = [];
			for (let i = 0; i < config.libs.length; i++)
				this.#libs[i] = Modules.importNow(config.libs[i]);
			Object.freeze(this.#libs);
		}

		this.#func = config.func ?? nop;
		this.#doDone = config.doDone;

		try {
			const context = this.context;
			const initialize = config.initialize;
			initialize?.(this, context, context.flow, context.global, this.#libs, {get: name => this.getSetting(name)});
		}
		catch (e) {
			this.error(e);		//@@ what's the right way to handle this?
		}
	}
	onMessage(msg, done) {
		try {
			const context = this.context;
			const func = this.#func;
			const _msgid = msg._msgid;
			const node = Object.create(this, {
				done: {value: done},
				error: {value: (error, msg) => {
					this.debug(error.toString());
					if (msg)
						done(msg);
				}},
				send: {value: msg => {
					this.send(msg, _msgid);
				}},
				status: {value: status => this.status(status)}
			});
			msg = func(msg, node, context, context.flow, context.global, this.#libs, {get: name => this.getSetting(name)});
			if (this.#doDone)
				done();
			if (msg)
				this.send(msg, _msgid);
		}
		catch (e) {
			done(e);
		}
	}
	send(msg, _msgid) {
		_msgid ??= generateId();
		if (Array.isArray(msg)) {
			for (let i = 0, length = msg.length; i < length; i++) {
				const output = msg[i];
				if (Array.isArray(output)) {
					for (let j = 0, length = output.length; j < length; j++)
						output[j]._msgid = _msgid;
				}
				else if (output)
					output._msgid = _msgid;
			}
		}
		else
			msg._msgid = _msgid;

		return super.send(msg);
	}

	static type = "function";
	static {
		RED.nodes.registerType(this.type, this);
	}
}

class ChangeNode extends Node {
	onStart(config) {
		super.onStart(config);

		Object.defineProperty(this, "onMessage", {value: config.onMessage});
	}
	change(current, fromValue, fromType, toValue) {		// based on 15-change.js
		const type = typeof current;
		if ("string" === type) {
			if (((fromType === "num") || (fromType === "bool") || (fromType === "str")) &&
				(current === fromValue.toString()))		// fromValue.toString because nodered2mcu converts to number or boolean 
				return toValue;
			return ("re" === fromType) ? current.replace(fromValue, toValue) : current.replaceAll(fromValue, toValue);
		}
		else if ((fromType === "num") && (("number" === type) || (current instanceof Number))) {
			if (current == Number(fromValue))
				return toValue;
		}
		else if (("boolean" === type) && (fromType === "bool")) {
			if (current.toString() === fromValue)
				return toValue;
		}
		return current;
	}

	static type = "change";
	static {
		RED.nodes.registerType(this.type, this);
	}
}

class SwitchNode extends Node {
	#sequences;

	onStart(config) {
		super.onStart(config);

		if (config.onMessage)
			Object.defineProperty(this, "onMessage", {value: config.onMessage});
		else
			Object.defineProperty(this, "compare", {value: config.compare});
	}
	onMessage(msg) {
		const parts = msg.parts;
		if ((undefined === parts?.id) || (undefined === parts.index))
			return this.compare(msg);
		
		const sequences = this.#sequences ??= new Map;
		let sequence = sequences.get(parts.id);
		if (!sequence) {
			sequence = [];
			sequences.set(parts.id, sequence)
		}
		sequence.push(msg);
	
		if (undefined === sequence.count) {
			if (undefined === parts.count)
				return;

			sequence.count = parts.count;
		}
	
		if (sequence.count !== sequence.length)
			return;
	
		sequences.delete(parts.id)

		// initialize state for each output
		const outputCount = this.outputCount;
		const ids = [];
		const counts = []
		const onwards = []
		const indices = []
		for (let i = 0; i < outputCount; i++) {
			ids[i] = generateId();
			counts[i] = 0;
			indices[i] = 0;
		}

		// process each message
		for (let i = 0, length = sequence.length; i < length; i++) {
			const result = this.compare(sequence[i]);
			onwards[i] = result;
			for (let j = 0; j < result.length; j++) {
				if (result[j])
					counts[j] += 1;
			}
		}

		// send messages in order received
		for (let i = 0, length = sequence.length; i < length; i++) {
			let msg = sequence.shift();
			const result = onwards.shift();
			for (let j = 0, first = true; j < result.length; j++) {
				if (!result[j])
					continue;

				if (!first)
					msg = result[j] = RED.util.cloneMessage(msg);
				msg._msgid = generateId();
				msg.parts.id = ids[j];
				msg.parts.index = indices[j]++;
				msg.parts.count = counts[j];
				first = false;
			}
			this.send(result);
		}
	}
	empty(value) {		// adapted from 10-switch.js
		const type = typeof value;
		if ((type === "string") || Array.isArray(value) || (value instanceof Uint8Array))
			return 0 === value.length;
		if ((type === "object") && value)
			return 0 === Object.keys(value).length;
		return false;
	}

	static type = "switch";
	static {
		RED.nodes.registerType(this.type, this);
	}
}

class RangeNode extends Node {
	onStart(config) {
		super.onStart(config);

		Object.defineProperty(this, "onMessage", {value: config.onMessage});
	}

	static type = "range";
	static {
		RED.nodes.registerType(this.type, this);
	}
}

class FilterNode extends Node {
	#topic;
	#property;
	#inout;
	#ignoreFirst;
	#last;

	onStart(config) {
		super.onStart(config);

		if (("rbe" !== config.func) && ("rbei" !== config.func))
			throw new Error("unimplemented filter func");

		this.#ignoreFirst = "rbei" === config.func;
		this.#inout = config.inout;
		this.#property = config.property;
		this.#topic = config.septopics ? config.topi : undefined;
	}
	onMessage(msg) {
		if (msg.reset) {
			if (msg.topic) {
				if (this.#topic)
					this.#last?.delete(msg.topic);
			}
			else
				this.#last = undefined;
			return;
		}

		let value = msg[this.#property], last, ignoreFirst, topic;
		if (this.#topic) { 
			this.#last ??= new Map;
			topic = msg[this.#topic];
			if (undefined === topic)
				return;
			last = this.#last.get(topic);
		}
		else
			last = this.#last;
		if (undefined === last)
			ignoreFirst = this.#ignoreFirst;

		if (("object" === typeof value) && ("object" === typeof last)) {
			if (deepEqual(value, last, {strict: true}))
				msg = undefined;
		}
		else if (value === last)
			msg = undefined;

		if (topic) 
			this.#last.set(topic, value);
		else
			this.#last = value;

		if (ignoreFirst)
			return;

		return msg;
	}

	static type = "rbe";
	static {
		RED.nodes.registerType(this.type, this);
	}
}

let inflight;		// shared across LinkCallNode instances
class LinkCallNode extends Node {
	#link;
	#timeout;

	onStart(config) {
		super.onStart(config);

		inflight ??= new Map;
		this.#link = RED.nodes.getNode(config.links[0]);
		this.#timeout = config.timeout;
	}
	onMessage(msg, done) {
		const id = generateId(); 	// Node-RED uses 14 byte ID here
		msg._linkSource ??= [];
		msg._linkSource.push({
			id,
			node: this.id
		});

		this.#link.send(msg);

		const state = {
			done
		};
		inflight.set(id, state);

		if (this.#timeout) {
			state.timer = Timer.set(() => {
				const state = inflight.get(id);
				inflight.delete(id);
				msg._linkSource.length = 0;
				state.done("timeout");
			}, this.#timeout);
		}
	}

	static type = "link call";
	static {
		RED.nodes.registerType(this.type, this);
	}
}

class LinkInNode extends Node {
	onMessage(msg, done) {
		done();
		return msg;
	}

	static type = "link in";
	static {
		RED.nodes.registerType(this.type, this);
	}
}

class LinkOutNode extends Node {
	#links;

	onStart(config) {
		super.onStart(config);
		
		this.#links = config.links?.map(link => RED.nodes.getNode(link));
	}
	onMessage(msg, done) {
		const links = this.#links;
		if (links) {
			for (let i = 0, length = links.length; i < length; i++)
				links[i].send(msg);
		}
		else if (Array.isArray(msg._linkSource) && (msg._linkSource.length > 0)) {
			const _linkSource = msg._linkSource.pop();
			const state = inflight.get(_linkSource.id);
			inflight.delete(_linkSource.id);
			RED.nodes.getNode(_linkSource.node)?.send(msg);
			if (state) {
				state.done();
				Timer.clear(state.timer);
			}
			else
				this.warn("link error missingReturn");
		}
		else
			this.warn("link error missingReturn");
		done();
	}

	static type = "link out";
	static {
		RED.nodes.registerType(this.type, this);
	}
}

class JSONNode extends Node {
	#action;
	#property;
	#indent;

	onStart(config) {
		super.onStart(config);

		this.#action = config.action;
		this.#property = config.property;
		this.#indent = config.pretty ? 4 : 0;
	}
	onMessage(msg, done) {
		if (msg.schema)
			throw new Error("schema unimplemented")

		let value = this.#property(msg);
		const type = typeof value;
		const action = this.#action ?? (("object" === type) ? "str" : "obj"); 
		if ("str" === action) {
			if ("string" === type)
				return msg;
			
			value = JSON.stringify(value, null, this.#indent);
		}
		else {
			if ("object" === type)
				return msg;

			try {
				value = JSON.parse(value);
			}
			catch (e) {
				done(e);
				return;
			}
		}
		
		this.#property(msg, value);
		return msg;
	}

	static type = "json";
	static {
		RED.nodes.registerType(this.type, this);
	}
}

class MQTTBrokerNode extends Node {
	#mqtt;
	#options;
	#subscriptions = [];
	#writable;
	#queue;
	#status = [];

	onStart(config) {
		super.onStart(config);

		if (config.closeTopic || config.willTopic || ("4" !== config.protocolVersion) || config.usetls || !config.autoConnect || config.sessionExpiry)
			throw new Error("unimplemented");

		this.#options = {
			host: config.broker,
			port: parseInt(config.port),
			id: config.clientid ? config.clientid : "node-red-" + this.id + "-" + Date.now() + "-" + Math.floor(Math.random() * 10000),		//@@ revisit this
			keepalive: (parseInt(config.keepalive) || 60) * 1000,
			clean: true === config.cleansession
		};
		if (config.credentials?.user)
			this.#options.user = config.credentials.user; 
		if (config.credentials?.password)
			this.#options.password = config.credentials.password; 

		if (config.birthTopic && config.birthPayload) {
			this.#options.birthTopic = config.birthTopic;
			this.#options.birthPayload = ArrayBuffer.fromString(config.birthPayload);
			if ("true" === config.birthRetain)
				this.#options.birthRetain = true;
			if ("0" != config.birthQos)
				this.#options.birthQos = Number(config.birthQos);
		}

		Timer.set(() => this.connect());
	}
	connect() {
		this.status({fill: "yellow", shape: "ring", text: "node-red:common.status.connecting"});

		const MQTTClient = device.network.mqtt.io;
		this.#mqtt = new device.network.mqtt.io({
			...device.network.mqtt,
			...this.#options,
			onReadable: (count, options) => {
				if (options.more)
					throw new Error("fragmented receive unimplemented!");

				const payload = this.#mqtt.read(count);
				const msg = {topic: options.topic, QoS: Number(options.QoS), retain: options.retain ?? false};

				const topic = options.topic.split("/");
			subscriptions:
				for (let subscriptions = this.#subscriptions, i = 0, length = subscriptions.length; i < length; i++) {
					let p = payload;				
					const subscription = subscriptions[i];
					const parts = subscription.topic.split("/");
					let ti = 0;
					for (let k = 0; k < parts.length; k++) {
						const part = parts[k];
						if ("#" === part) {
							if ((k + 1) === parts.length) {
								ti = topic.length;
								break;
							}
							continue subscriptions;
						}
						else if ("+" === part)
							ti++;
						else if (topic[ti++] !== part)
							continue subscriptions;
					}

					if (ti === topic.length) {
						switch (subscription.format) {
							case "utf8":
								p = String.fromArrayBuffer(p);		//@@ TextDecoder with fatal: false seems to be the intent here
								break;
							case "buffer":
								break;
							case "json":
								try {
									p = JSON.parse(String.fromArrayBuffer(p));
								}
								catch {
									this.error("invalid JSON");
								}
								break;
							case "base64":
								p = Base64.encode(p);
								break;
							default:		// "auto-detect"
								try {
									p = String.fromArrayBuffer(p);
								}
								catch {
								}
								break;
						}
						msg.payload = p
						subscription.node.send(msg);
					}
				}
			},
			onWritable: (count) => {
				if (undefined === this.#writable) {
					this.status({fill: "green", shape: "dot", text: "node-red:common.status.connected"});
					delete this.#options.wait;
					if (this.#subscriptions.length) {
						const msg = {
							operation: MQTTClient.SUBSCRIBE,
							items: this.#subscriptions.map(subscription => {
								return {
									topic: subscription.topic,
									QoS: subscription.QoS
								};
							})
						};
						count = this.#mqtt.write(null, msg);
					}

					if (this.#options.birthTopic) {
						this.#queue = [{
							topic: this.#options.birthTopic,
							QoS: this.#options.birthQos ?? 0,
							retain: this.#options.birthRetain ?? false,
							payload: this.#options.birthPayload
						}];
					}
				}

				this.#writable = count

				if (this.#queue?.length) {
					for (let i = 0, queue = this.#queue.splice(0), length = queue.length; i < length; i++)
						this.onMessage(queue[i]);
				}
			},
			onError: () => {
				this.#mqtt = undefined;
				if (undefined !== this.#writable) {
					this.status({fill: "red", shape: "ring", text: "node-red:common.status.disconnected"});
					this.#queue = undefined;
					this.#writable = undefined;
				}
				if (!this.#options.wait)
					this.#options.wait = 1000;
				else if (this.#options.wait <= 32_000)
					this.#options.wait *= 2;
				Timer.set(() => this.connect(), this.#options.wait);
			}
		});
	}
	onMessage(msg) {
		//@@ fragmented send unimplemented so will stall if message is bigger than output buffer
		const payload = msg.payload;
		
		if (undefined === this.#writable)
			return;		// drop messages when disconnected
		
		if (this.#queue?.length || ((payload.byteLength + msg.topic.length) > this.#writable)) {
			this.#queue ??= [];
			this.#queue.push(msg);
			return;
		}

		this.#writable = this.#mqtt.write(payload, {
			topic: msg.topic,
			QoS: Number(msg.QoS),
			retain: msg.retain
		});
	}
	subscribe(node, topic, format, QoS = 0) {
		const MQTTClient = device.network.mqtt.io;

		QoS = Number(QoS);
		this.#subscriptions.push({node, topic, format, QoS});
		if (undefined === this.#writable)
			return;

		this.#mqtt.write(null, {
			operation: MQTTClient.SUBSCRIBE,
			items: [
				{topic, QoS},
			]
		});
	}
	unsubscribe(node, topic) {
		const MQTTClient = device.network.mqtt.io;
		const items = [];
		for (let subscriptions = this.#subscriptions, i = 0, length = subscriptions.length; i < length; i++) {
			const subscription = subscriptions[i];
			if (!node || (subscription.node === node) && (subscription.topic === topic))
				items.push({topic: subscription.topic, QoS: subscription.QoS});
		}
		if (undefined === this.#writable)
			return;

		this.#mqtt.write(null, {
			operation: MQTTClient.UNSUBSCRIBE,
			items
		});
	}
	requestStatus(node) {
		// if no node.#outputs.statuses and !config.noderedmcu?.editor... could safely ignore this 
		this.#status.push(node);
	}
	status(msg) {
		this.#status.forEach(node => node.status(msg));
	}

	static type = "mqtt-broker";
	static {
		RED.nodes.registerType(this.type, this);
	}
}

class MQTTInNode extends Node {
	onStart(config) {
		super.onStart(config);

		const broker = flows.get(configFlowID).getNode(config.broker);
		broker.subscribe(this, config.topic, config.datatype, config.qos);
		broker.requestStatus(this);
	}

	static type = "mqtt in";
	static {
		RED.nodes.registerType(this.type, this);
	}
}

class MQTTOutNode extends Node {
	#broker;
	#topic;
	#QoS;
	#retain;

	onStart(config) {
		super.onStart(config);

		this.#broker = flows.get(configFlowID).getNode(config.broker);
		this.#topic = config.topic;
		this.#QoS = config.qos;
		this.#retain = config.retain;
		this.#broker.requestStatus(this);
	}
	onMessage(msg, done) {
		let payload = msg.payload;
		if (undefined === payload) {
			done();
			return;
		}

		if (payload instanceof ArrayBuffer)
			;
		else if ("object" === typeof payload)
			payload = ArrayBuffer.fromString(JSON.stringify(payload));
		else
			payload = ArrayBuffer.fromString(payload.toString());		//@@ not sure about this... correct for string and number and probably boolean

		this.#broker.onMessage({		// maybe unnecessary to use RED.mcu.enqueue here
			payload,
			topic: this.#topic ?? msg.topic,
			QoS: this.#QoS ?? msg.QoS ?? 0,
			retain: this.#retain ?? msg.retain ?? false,
		});
	
		done();
	}

	static type = "mqtt out";
	static {
		RED.nodes.registerType(this.type, this);
	}
}

const CompatibilityEvents = Object.freeze(["input" /*, "close" */]);
class CompatibiltyNode extends Node {
	#events;		// overloaded during constructor & onStart to hold module reference; module reference not needed after that
	#send;

	constructor(id, flow, name, module) {
		super(id, flow);
		this.name = name;
		this.#events = module;
	}
	onStart(config) {
		super.onStart(config);

		const module = this.#events;
		this.#events = {};
		module.call(this, {
			...config,
			name: this.name
		});
	}
	onMessage(msg, done) {
		this.#events.input?.forEach(input => input.call(this, msg, this.#send, done));
	}
	on(event, handler) {
		if (!CompatibilityEvents.includes(event))
			return this;

		this.#events[event] ??= [];
		this.#events[event].push(handler);

		if ("input" === event)
			this.#send ??= msg => {if (msg) return super.send(msg);};

		return this;
	}
	off(event, handler) {
		const events = this.#events[event];
		if (!events?.length)
			return this;

		const index = events.indexOf(handler);
		if (index >= 0)
			events.splice(index, 1);

		return this;
	}
	emit(event, msg) { 
		if ("input" !== event)
			throw new Error("unimplemented");

		const events = this.#events[event];
		if (!events)
			return false;

		events.forEach(() => {
			RED.mcu.enqueue(msg, this);
		});

		return true;
	}
	send(msg) {		// Node-RED alllows calling send with null message
		if (msg)
			return super.send(msg);
	}

	static type = "Node-RED Compatibility";
}

// when Compatibility node moves to separate module, move process global there too
globalThis.process = class {
	static hrtime(prev) {
		const now = Date.now();
		let seconds = Math.floor(now / 1000);
		let nanoseconds = (now % 1000) * 1_000_000;
		if (!prev)
			return [seconds, nanoseconds];

		seconds -= prev[0];
		nanoseconds -= prev[1];
		if (nanoseconds < 0) {
			seconds--
			nanoseconds += 1_000_000_000;
		}
		return [seconds, nanoseconds];
	}
}

globalThis["<xsbug:script>"] = function(mystery, path, line, script) {
	const options = JSON.parse(script);
	const node = globalThis.flows?.get(options.flow)?.getNode(options.id);
	if (!node)
		return;

	node.onCommand(options);
}

// placeholder for compatibility
class Buffer extends Uint8Array {
	indexOf(search, byteOffset) @ "xs_buffer_prototype_indexOf"
	lastIndexOf(search, byteOffset) @ "xs_buffer_prototype_lastIndexOf"

//	static from()		//@@ not the same!
	static isBuffer(value) {
		return value instanceof Buffer;
	}
	static concat(list, totalLength) {
		const length = list.length;
		if (undefined === totalLength) {
			totalLength = 0;
			for (let i = 0; i < length; i++)
				totalLength += list[i].length;
		}
		const result = new Buffer(totalLength);
		for (let i = 0, position = 0; i < length; i++) {
			let buffer = list[i];
			if (!ArrayBuffer.isView(buffer))
				buffer = new Uint8Array(buffer);

			if (buffer.byteLength > (totalLength - position))
				buffer = buffer.subarray(0, totalLength - position);

			result.set(buffer, position);
			position += buffer.length;
			if (position >= totalLength)
				break;
		}

		return result;
	}
	
	static {
		this.prototype.slice = this.prototype.subarray; 
	}
}

class Console {
	static log(...parts) {
		trace(...parts, "\n");
	}
}

globalThis.setInterval = Timer.repeat;
globalThis.clearInterval = Timer.clear;
globalThis.setTimeout = Timer.set;
globalThis.clearTimeout = Timer.clear;
globalThis.console = Console;
globalThis.Buffer = Buffer;

globalThis.RED = RED;
globalThis.module = Object.freeze({
	set exports(module) {
		RED.addCompatibility(module);
	}
});
