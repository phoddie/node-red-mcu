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
import Hex from "hex";
import Modules from "modules";
import config from "mc/config";
import Preference from "preference";

const nodeClasses = new Map;
let compatibilityClasses;
let msgQueue;
export const configFlowID = "__config";
const globalContextID = "__global";

function generateId() @ "xs_nodered_util_generateId";
function debugging() @ "xs_nodered_util_debugging";

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
		static debugging = debugging;
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

		globalThis.globalContext = new Context(globalContextID);

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
	constructor(id) {
		super();
		if (id.length > 15) {
			// convert 16 character Node-RED ID to no more than 15 characters so it works with ESP-IDF NVS (15 character domain key name limit)
			// eventually this might want to be platform dependent to accomodate the different constraints of each platfornm
			id = parseInt(id.substring(0, 8), 16).toString(36) + "-" + parseInt(id.substring(8, 16), 16).toString(36) 
		}
		Object.defineProperty(this, "id", {value: id});
	}
	get(name, store) {
		if ("file" === store) {
			let value = Preference.get(this.id, name);
			if (value instanceof ArrayBuffer) {
				let view = new DataView(value);
				switch (view.getUint8(0)) {
					case 1:		// Number
						value = view.getFloat64(1);
						break;

					case 2:		// JSON
						view.setUint8(0, 32);
						value = String.fromArrayBuffer(view.buffer);
						view = undefined;
						value = JSON.parse(value);
						break;
					
					case 3:		// Buffer
						value = new Uint8Array(view.buffer, 1);
						break;

					default:
						throw new Error("unexpected buffer type");
				}
			}
			return value;
		}

		return super.get(name); 
	}
	set(name, value, store) {
		if ("file" === store) {
			switch (typeof value) {
				case "number":
					if (value !== (value | 0)) {
						const buffer = new DataView(new ArrayBuffer(8 + 1))
						buffer.setUint8(0, 1);
						buffer.setFloat64(1, value);
						value = buffer.buffer;
					}
					break;

				case "object":
					if (value instanceof Uint8Array) {		// Buffer
						const buffer = new Uint8Array(value.length + 1);
						buffer[0] = 3;
						buffer.set(value, 1);
						value = buffer.buffer;
					}
					else {		// JSON
						value = "\u0002" + JSON.stringify(value);
						value = ArrayBuffer.fromString(value);
					}
					break;

				case "null":
				case "undefined":		// delete when value missing
					Preference.delete(this.id, name);
					return;
			}
			Preference.set(this.id, name, value);
		}
		else
			return super.set(name, value);
	}
	delete(name, store) {
		if ("file" === store)
			Preference.delete(this.id, name);
		else
			super.delete(name);
	}
	keys(store) {
		if ("file" === store)
			return Preference.keys(this.id);
		
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
			context: {value: new Context(id)}
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
							count: 1		//@@ recursion counter	
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
				source: {		//@@ not sure about this.... for example... overwrites the source of status & catch nodes.
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
			context: {value: new Context(id)}
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
		const input = this.#events.input;
		if (input) {
			for (let i = 0; i < input.length; i++)
				input[i].call(this, msg, this.#send, done);
		}
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

		for (let i = 0; i < events.length; i++)
			RED.mcu.enqueue(msg, this);

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
