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

	static util = class {
		static cloneMessage = structuredClone;
		static compareObjects = deepEqual;
		static evaluateNodeProperty(inputField, inputFieldType, node, msg) {
			throw new Error;
		}
		static generateId = generateId;
		static getMessageProperty(msg, property) {
		}
		static getObjectProperty(msg, property) {
		}
		static setMessageProperty(msg, prop, value, createMissing) {
			throw new Error;
		}
		static setObjectProperty(msg, prop, value, createMissing) {
			throw new Error;
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
				target.receive(current);
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
	getNode(id) {
		return super.get(id);
	}
	nodes() {
		return super.values();
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
		if (!wires?.length)
			return;

		this.#outputs = wires.map(wire => wire.map(target => this.#flow.getNode(target))); 
	}
	onMessage(msg) {
	}
	send(msg) {
		const outputs = this.#outputs;
		if (!outputs.length)
			return;

		const util = RED.util;
		if (Array.isArray(msg)) {
			const length = Math.min(msg.length, outputs.length);
			for (let j = 0; j < length; j++) {
				const m = msg[j];
				if (null === m)
					continue;

				m._msgid ??= util.generateId();
				for (let i = 0, wires = outputs[j], length = wires.length; i < length; i++)
					RED.mcu.enqueue(util.cloneMessage(m), wires[i]); 
			}
		}
		else {
			msg._msgid ??= util.generateId();
			for (let i = 0, wires = outputs[0], length = wires.length; i < length; i++)
				RED.mcu.enqueue(util.cloneMessage(msg), wires[i]); 
		}
	}
	receive(msg) {
		//@@ queue if not ready
		const result = this.onMessage(msg);
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
		debugger;
	}
	log(msg) {
		this.trace(msg);
	}
	warn(msg) {
		this.trace(msg);
	}
	error(error, msg) {
		msg = {
			...msg,
			error: {
				message: error.toString(),
				source: {
					id: this.id,
					type: this.constructor.type,
					name: this.name,
					count: 0	
				}
			}
		};

		const uncaught = [];
		for (const node of this.#flow.nodes()) {
			if (!(node instanceof CatchNode))
				continue;
			if (node.uncaught)
				uncaught.push(node);
			else
				node.onCatch(msg);
		}
		if (!msg.error.source.count) {
			for (let i = 0, length = uncaught.length; i < length; i++)
				uncaught[i].onCatch(msg);
		}
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
	onCommand(options) {
		trace(`Node ${this.id} ignored: ${options.command}\n`);
	}

	static type = "comment";
	static {
		this.noOutputs = Object.freeze([]);
		RED.nodes.registerType(this.type, this);
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

class DebugNode extends Node {
	#property;
	#getter;
	#console;
	#sidebar;
	#toStatus;
	#statusType;
	#statusVal;

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
					name: this.name,
				} 
			}
			trace.right(JSON.stringify(value));
		}
		if (this.#toStatus) {
			// This is nothing but a very simplistic copy of what the NR node really does...
			// ToDo: Move closer to the NR debug node!
			const statusVal = this.#statusVal(msg);
			if (statusVal) {
				const fill = "grey";
				const shape = "dot";
				this.status({fill, shape, text: statusVal})
			}
		}
	}

	static type = "debug"
	static {
		RED.nodes.registerType(this.type, this);
	}
}

class CatchNode extends Node {
	#scope;

	onStart(config) {
		super.onStart(config);

		this.#scope = config.scope;
		Object.defineProperty(this, "uncaught", {value: config.uncaught ?? false});
	}
	onCatch(msg) {
		if (!this.#scope || this.#scope.includes(msg.error.source.id)) {
			msg.error.source.count += 1;
			this.send(msg);
		}
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
	context = new Context;
	#func;
	#libs;

	constructor(id, flow, name) {
		super(id, flow, name);
		this.context.global = globalContext;
		this.context.flow = flow.context;
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

		try {
			const context = this.context;
			const initialize = config.initialize;
			initialize?.(this, context, context.flow, context.global, this.#libs);
		}
		catch (e) {
			this.error(e);
		}
	}
	onMessage(msg) {
		try {
			const context = this.context;
			const func = this.#func;
			msg = func(msg, this, context, context.flow, context.global, this.#libs);
			if (msg)
				this.send(msg);
		}
		catch (e) {
			this.error(e);
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
	onStart(config) {
		super.onStart(config);

		Object.defineProperty(this, "onMessage", {value: config.onMessage});
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
			const parts = {type: "array", count: Math.idiv(length + arraySplt - 1, arraySplt), len: arraySplt};
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
			const parts = {type: "object", count: length};
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
			const parts = {type: "string", count: length, ch: this.#splt};
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
		this.#link.send({...msg, _linkSource: this});		//@@ need eventid for timeout feature, to know when this message replies
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
			msg._linkSource.response(msg);
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
	onMessage(msg) {
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
				this.error(e);
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
			id: config.clientid ? config.clientid : "node-red-" + this.id,	//@@
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
			onControl: msg => {
				if (MQTTClient.CONNACK === msg.operation) {
					if (this.#subscriptions.length) {
						this.#mqtt?.write(null, {
							operation: MQTTClient.SUBSCRIBE,
							items: this.#subscriptions.map(item => {return {topic: item.topic, QoS: item.QoS}})
						});
					}
				}
			},
			onReadable: (count, options) => {
				if (options.more)
					throw new Error("fragmented receive unimplemented!");

				const payload = this.#mqtt.read(count);
				const msg = {topic: options.topic, QoS: options.QoS};
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
									throw new Error("ignoring invalid JSON");
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
								QoS: subscription.QoS
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
			QoS: msg.QoS,
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
		this.#QoS = config.qos;

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
	onMessage(msg) {
		let payload = msg.payload;
		if (undefined === payload)
			return;

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
	onMessage(msg) {
		//@@ real done, not nop
		this.#events.input?.forEach(input => input.call(this, msg, this.#send, nop));
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

	static type = "Node-RED Compatibility";
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
