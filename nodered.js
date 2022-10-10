/*
 * Copyright (c) 2022  Moddable Tech, Inc.
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

const nodeClasses = new Map;
let compatibilityClasses;
let msgQueue;
export const configFlowID = "__config";

function generateId() @ "xs_nodered_util_generateId";

class RED {
	static #compatibility = [];

	static settings = Object.freeze({
	});

	static _(msg, obj) {	// https://nodered.org/docs/creating-nodes/i18n
		return msg;		// not localizing
	}
	static util = class {
		static cloneMessage = structuredClone;
		static compareObjects = deepEqual;
		static evaluateNodeProperty(inputField, inputFieldType, node, msg, callback) {
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
		static enqueue(msg, target, done) {
			msg._target = target;
			msg._done = done;
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
				const next = current._next, target = current._target, done = current._done;
				delete current._next; 
				delete current._target; 
				delete current._done; 
				target.receive(current, done);
				current = next;
			}
		}
	}

	static build(builder) {
		const flows = new Map;
		globalThis.flows = flows;		// not ideal (gives FunctionNode access to all flows)
		msgQueue = {first: undefined, last: undefined, timer: Timer.repeat(() => RED.mcu.deliver(), 5000, 5000)};

		globalThis.globalContext = new Context;

		if (this.#compatibility.length) {
			compatibilityClasses = new Map;
			this.#compatibility.forEach(f => f(RED));
		}

		builder.build(
			flows,
			(id, name) => {
				const flow = new Flow(id, name);
				flows.set(id, flow);
				return flow;
			},
			(type, id, name, flow) => {
				let Class = nodeClasses.get(type) ?? compatibilityClasses?.get(type);
				if (!Class) {	
					const msg = `Unsupported Node "${type}"`; 
					trace(msg, "\n");
					throw new Error(msg);
				}

				if (Node.isPrototypeOf(Class))
					flow.addNode(new Class(id, flow, name));
				else
					flow.addNode(new CompatibiltyNode(id, flow, name, Class));
			}
		);

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
	constructor(id, name) {
		super();
		const properties = {
			id: {value: id},
			context: {value: new Context}
		};
		if (name)
			properties.name = {value: name};
		Object.defineProperties(this, properties);
	}
	addNode(node) {
		super.set(node.id, node);
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
		const wires = config.wires;
		if (wires) {
			this.#outputs = wires.map(wire => wire.map(target => this.#flow.getNode(target)));
			if (!config.dones && !config.errors)
				return;
		}
		else {
			if (!config.dones && !config.errors)
				return;
			this.#outputs = [];
		}
		if (config.dones)
			this.#outputs.dones = config.dones.map(target => this.#flow.getNode(target));
		if (config.errors)
			this.#outputs.errors = config.errors.map(target => this.#flow.getNode(target));
	}
	onMessage(msg) {
	}
	send(msg) {
		const outputs = this.#outputs;
		if (!outputs.length)
			return;

		function _enqueue(_wires, _msg) {
			// spread msg to the different wires
			for (let i = 0, length = _wires.length; i < length; i++) {
				const clone = util.cloneMessage(_msg);
				RED.mcu.enqueue(clone, _wires[i], _wires[i].makeDone(clone));
			}
		}

		const util = RED.util;

		// split outer array to outputs
		if (Array.isArray(msg)) {
			const length = Math.min(msg.length, outputs.length);
			for (let j = 0; j < length; j++) {
				const m = msg[j];
				if (null === m)
					continue;

				// split inner array into separate messages
				if (Array.isArray(m)) {
					for (let k = 0, kk = m.length; k < kk; k++) {
						let mk = util.cloneMessage(m[k]);
						mk._msgid = util.generateId();
						_enqueue(this.#outputs[j], mk);
					}
				} else {
					m._msgid ??= util.generateId();
					_enqueue(outputs[j], m)	
				}
			}
		}
		else {
			msg._msgid ??= util.generateId();
			_enqueue(outputs[0], msg)
		}
	}
	receive(msg, done) {
		//@@ queue if not ready
		const result = this.onMessage(msg, done);
		if (result)
			return this.send(result);
	}
	status(status) {
		const msg = {
			status: {
				...status,
				source: {
					id: this.id,
					type: this.constructor.type,
					name: this.name
				}
			}
		};

		trace.left(JSON.stringify(msg));

		for (const node of this.#flow.nodes()) {
			if (node instanceof StatusNode)
				node.onStatus(msg);
		}
	}
	done(msg) {
		this.makeDone(msg)();
	}
	log(msg) {
		this.trace(msg);
	}
	warn(msg) {
		this.trace(msg);
	}
	error(error, msg = {}) {
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
							count: 0	
						}
					}
				}
				for (let i = 0, dones = error ? source.#outputs.errors : source.#outputs.dones, length = dones ? dones.length : 0; i < length; i++) {
					const clone = RED.util.cloneMessage(msg);
					RED.mcu.enqueue(clone, dones[i], dones[i].makeDone(clone));
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

class CommentNode extends UnknownNode {
	static type = "comment";
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

	onStart(config) {
		super.onStart(config);

		this.#property = config.property;
		this.#getter = config.getter;
		this.#console = config.console;
		this.#sidebar = config.tosidebar;
		this.#toStatus = config.tostatus;
		this.#statusType = config.statusType;
		this.#statusVal = config.statusVal;
	}
	onMessage(msg) {

		// to prevent endless loops -> 21-debug.js:123
		if (msg.status?.source?.id === this.id) {
			done();
			return;
		}

		// Feed msg back to the editor.
		trace.left(JSON.stringify({
			input: {
				...msg,
				source: {
					id: this.id,
					type: this.constructor.type,
					name: this.name
				}	
			}
		}));

		// Process msg for xsbug
		let value = this.#getter(msg);

		if (this.#console) {
			if (value instanceof Uint8Array)
				value = Hex.toString(value);
			trace(("object" === typeof value) ? JSON.stringify(value) : value, "\n");
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
			}
			trace.right(JSON.stringify(value));
		}

		if (this.#toStatus) {
			const statusVal = this.#statusVal(msg);		// NR says: #statusVal shall return typeof string!
			if (statusVal !== this.#oldStatus) {
				this.status({fill: "grey", shape: "dot", text: statusVal});
				this.#oldStatus = statusVal;
			}
		}
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
	#scope;

	onStart(config) {
		super.onStart(config);

		this.#scope = config.scope;
	}
	onStatus(msg) {
		if (!this.#scope || this.#scope.includes(msg.status?.source?.id))
			this.send(msg);
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
			initialize?.(this, context, context.flow, context.global, this.#libs);
		}
		catch (e) {
			this.error(e);		//@@ what's the right way to handle this?
		}
	}
	onMessage(msg, done) {
		try {
			const context = this.context;
			const func = this.#func;
			const node = Object.create(this, {
				done: {value: done},
				error: {value: (error, msg) => {
					this.debug(error.toString());
					if (msg)
						done(msg);
				}}
			});
			msg = func(msg, node, context, context.flow, context.global, this.#libs);
			if (this.#doDone)
				done();
			if (msg)
				this.send(msg);
		}
		catch (e) {
			done(e);
		}
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
			ids[i] = RED.util.generateId();
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
			const msg = sequence.shift();
			const result = onwards.shift();
			for (let j = 0, first = true; j < result.length; j++) {
				if (!result[j])
					continue;

				if (!first)
					msg = result[j] = RED.util.cloneMessage(msg);
				msg._msgid = RED.util.generateId();
				msg.parts.id = ids[j];
				msg.parts.index = indices[j]++;
				msg.parts.count = counts[j];
				first = false;
			}
			this.send(result);
		}
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

class SplitNode extends Node {
	#arraySplt;
	#splt;
	#addname;

	onStart(config) {
		super.onStart(config);
		
		this.#splt = config.splt;
		this.#arraySplt = config.arraySplt;
		this.#addname = config.addname;
	}
	onMessage(msg) {
		let payload = msg.payload; 
		if (payload instanceof ArrayBuffer)
			throw new Error("buffer unimplemented")
		else if (Array.isArray(payload)) {
			const length = payload.length, arraySplt = this.#arraySplt;
			const parts = {type: "array", count: Math.idiv(length + arraySplt - 1, arraySplt), len: arraySplt, id: RED.util.generateId()};
			msg.parts = parts;
			for (let i = 0; i < length; i += arraySplt) {
				msg.payload = (1 === arraySplt) ? payload[i] : payload.slice(i, i + arraySplt);
				parts.index = Math.idiv(i, arraySplt);
				this.send(msg);
			}
		}
		else if ("object" === typeof payload) {
			const names = Object.getOwnPropertyNames(payload);
			const length = names.length;
			const parts = {type: "object", count: length, id: RED.util.generateId()};
			msg.parts = parts;
			for (let i = 0, addname = this.#addname; i < length; i += 1) {
				const key = names[i];
				msg.payload = payload[key];
				parts.index = i;
				parts.key = key;
				if (addname)
					msg[addname] = key;
				this.send(msg);
			}
		}
		else {	// string
			payload = payload.toString().split(this.#splt);
			const length = payload.length;
			const parts = {type: "string", count: length, ch: this.#splt, id: RED.util.generateId()};
			msg.parts = parts;
			for (let i = 0; i < length; i += 1) {
				msg.payload = payload[i];
				parts.index = i;
				this.send(msg);
			}
		}
	}

	static type = "split";
	static {
		RED.nodes.registerType(this.type, this);
	}
}

class LinkCallNode extends Node {
	#link;

	onStart(config) {
		super.onStart(config);
		
		this.#link = RED.nodes.getNode(config.links[0]);
		//@@ timeout
	}
	onMessage(msg) {
		this.#link.send({...msg, _linkSource: this.id});		//@@ need eventid for timeout feature, to know when this message replies
	}
	response(msg) {
		delete msg._linkSource;
		this.send(msg);
	}

	static type = "link call";
	static {
		RED.nodes.registerType(this.type, this);
	}
}

class LinkInNode extends Node {
	static type = "link in";
	static {
		RED.nodes.registerType(this.type, this);
	}
}

class LinkOutNode extends Node {
	#links;

	onStart(config) {
		super.onStart(config);
		
		if ("return" !== config.mode)
			this.#links = config.links.map(link => RED.nodes.getNode(link));
	}
	onMessage(msg) {
		const links = this.#links;
		if (links) {
			for (let i = 0, length = links.length; i < length; i++)
				links[i].send(msg);
		}
		else if (msg._linkSource)
			RED.nodes.getNode(msg._linkSource).response(msg);
		else
			throw new Error("lost link source");
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

class DigitalInNode extends Node {
	#pin;
	#io;

	onStart(config) {
		super.onStart(config);

		this.#pin = config.pin;
		const Digital = globalThis.device?.io?.Digital;
		if (!Digital)
			return;

		let mode = Digital.Input;
		if ("up" === config.intype)
			mode = Digital.InputPullUp;
		else if ("down" === config.intype)
			mode = Digital.InputPullDown;
		this.#io = new Digital({
			target: this,
			pin: this.#pin,
			mode,
			edge: Digital.Rising + Digital.Falling,
			onReadable() {
				this.target.send({payload: this.read()});
			}
		});
	}

	static type = "rpi-gpio in";
	static {
		RED.nodes.registerType(this.type, this);
	}
}

class DigitalOutNode extends Node {
	#pin;
	#io;
	#hz;

	onStart(config) {
		super.onStart(config);

		this.#pin = config.pin;
		this.#hz = config.freq; 

		const options = {pin: this.#pin};

		if (undefined === this.#hz) {
			if (!globalThis.device?.io?.Digital)
				return;

			options.mode = device.io.Digital.Output;
			this.#io = new device.io.Digital(options);
			if (undefined !== config.level)
				this.#io.write(config.level);
		}
		else {
			if (!globalThis.device?.io?.PWM)
				return;

			if (this.#hz)
				options.hz = this.#hz; 
			this.#io = new device.io.PWM(options);
		}
	}
	onMessage(msg) {
		if (undefined === this.#hz) {
			this.#io?.write(msg.payload);
			trace(`digital out ${this.#pin}: ${msg.payload}\n`);
		}
		else {
			const value = (parseFloat(msg.payload) / 100) * ((1 << (this.#io?.resolution ?? 8)) - 1);
			this.#io?.write(value);
			trace(`PWM ${this.#pin}: ${value}\n`);
		}
	}

	static type = "rpi-gpio out";
	static {
		RED.nodes.registerType(this.type, this);
	}
}

class MQTTBrokerNode extends Node {
	#mqtt;
	#options;
	#subscriptions = [];
	#writable;
	#queue = [];

	onStart(config) {
		super.onStart(config);

		if (config.birthTopic || config.closeTopic || config.willTopic || ("4" !== config.protocolVersion) || config.usetls || !config.autoConnect || config.sessionExpiry)
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

		const MQTTClient = device.network.mqtt.io;
		this.#mqtt = new device.network.mqtt.io({
			...device.network.mqtt,
			...this.#options,
			onReadable: (count, options) => {
				if (options.more)
					throw new Error("fragmented receive unimplemented!");

				const payload = this.#mqtt.read(count);
				const msg = {topic: options.topic, QoS: Number(options.QoS)};
				if (options.retain) msg.retain = true;

				const topic = options.topic.split("/");
				topic.shift();
			subscriptions:
				for (let subscriptions = this.#subscriptions, i = 0, length = subscriptions.length; i < length; i++) {
					const subscription = subscriptions[i];
					const parts = subscription.topic.split("/");
					parts.shift();
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
								msg.payload = String.fromArrayBuffer(payload);
								break;
							case "buffer":
								msg.payload = payload;
								break;
							case "json":
								try {
									msg.payload = JSON.parse(String.fromArrayBuffer(payload));
								}
								catch {
									trace("invalid JSON\n");		//@@ call error
								}
								break;
							case "base64":
								msg.payload = Base64.encode(payload);
								break;
							default:
								throw new Error("unimplemented format");
						}
						subscription.node.send(msg);
					}
				}
			},
			onWritable: (count) => {
				if ((undefined === this.#writable) && this.#subscriptions.length) {
					const msg = {
						operation: MQTTClient.SUBSCRIBE,
						items: this.#subscriptions.map(subscription => {
							return {
								topic: subscription.topic,
								QoS: Number(subscription.QoS)
							};
						})
					};
					count = this.#mqtt.write(null, msg);	
				}

				this.#writable = count

				if (this.#queue.length) {
					for (let i = 0, queue = this.#queue.splice(0), length = queue.length; i < length; i++)
						this.onMessage(queue[i]);
				}
			}
		});
	}
	onMessage(msg) {
		//@@ fragmented send unimplemented so will stall if message is bigger than output buffer
		const payload = msg.payload;
		if ((undefined === this.#writable) || this.#queue.length || ((payload.byteLength + msg.topic.length + 10) > this.#writable)) {
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

	static type = "mqtt-broker";
	static {
		RED.nodes.registerType(this.type, this);
	}
}

class MQTTInNode extends Node {
	#broker;
	#topic;
	#format;
	#QoS;

	onStart(config) {
		super.onStart(config);

		this.#broker = flows.get(configFlowID).getNode(config.broker);

		this.#topic = config.topic;
		this.#format = config.datatype;
		this.#QoS = Number(config.qos);		//@@ nodered2mcu

		this.#broker.subscribe(this, this.#topic, this.#format, this.#QoS); 
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
		if (undefined !== config.topic) this.#topic = config.topic;
		if (undefined !== config.qos) this.#QoS = parseInt(config.qos);
		if ((undefined !== config.retain) && ("" !== config.retain)) this.#retain = Boolean(config.retain);
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
	#module;
	#events = {};
	#send;

	constructor(id, flow, name, module) {
		super(id, flow, name);
		this.#module = module;
	}
	onStart(config) {
		super.onStart(config);

		this.#module(config);
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
			this.#send ??= msg => super.send(msg);

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

		events.forEach(input => {
			const clone = RED.util.cloneMessage(msg);
			RED.mcu.enqueue(clone, this, this.makeDone(clone));
		});

		return true;
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
	const node = flows.get(options.flow)?.getNode(options.id);
	if (!node)
		return;

	node.onCommand(options);
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

globalThis.RED = RED;
globalThis.module = Object.freeze({
	set exports(module) {
		RED.addCompatibility(module);
	}
});
