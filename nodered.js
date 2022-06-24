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
import Base64 from "base64";

const nodeClasses = new Map;
const configFlowID = "config";

class RED {
	static util = class {
		static cloneMessage(msg) {
			return Object.assign({}, msg);	//@@ shallow & naive
		}
	}
	static build(items) {
		const flows = new Map;

		globalThis.globalContext = new Context;
		globalThis.flows = flows;		// not ideal (gives FunctionNode access to all flows)

		// create flows
		items.forEach(item => {
			if (("tab" === item.type) && (true !== item.disabled)) {
				const flow = new Flow(item.id, item.label);
				flows.set(item.id, flow);
			}
		});
		flows.set(configFlowID, new Flow(configFlowID, "global configuration"));

		// create nodes
		items.forEach(item => {
			if ("tab" === item.type)
				return;

			const flow = flows.get(item.z ?? configFlowID);
			if (!flow) throw new Error("missing flow " + item.z);

			const node = new (item.d ? DisabledNode : nodeClasses.get(item.type))(item.id, flow, item.name);
			flow.addNode(node);
		});

		// connect wires
		items.forEach(item => {
			const wires = item.wires;
			if (!wires?.length)
				return;
			
			const flow = flows.get(item.z ?? configFlowID);
			const node = flow.getNode(item.id);
			const outputs = wires.map(wire => Object.freeze(wire.map(target => flow.getNode(target)))); 
			Object.freeze(outputs);
			node.setOutputs(outputs);
		});
		
		// connect links
		items.forEach(item => {
			let links = item.links;
			if (!links?.length)
				return;

			const flow = flows.get(item.z);
			const node = flow.getNode(item.id);
			links = links.map(link => { 
				for (let [id, flow] of flows) {
					const node = flow.getNode(link);
					if (node)
						return node;
				}
				throw new Error("unresolved link");
			});
			Object.freeze(links);
			node.links = links;
		});

		// setup nodes
		items.forEach(item => {
			if ("tab" === item.type)
				return;

			const node = flows.get(item.z ?? configFlowID).getNode(item.id);
			node.onSetup(item);
		});

		// start nodes
		for (let [id, flow] of flows) {
			for (let node of flow.nodes)
				node.onStart();
		}

		return flows;
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
	get nodes() {
		return super.values();
	}
}

class Node {
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
	setOutputs(outputs) {
		this.#outputs = outputs; 
	}
	onSetup(config) {
	}
	onStart() {
	}
	onStop(c) {
	}
	onMessage(msg) {
	}
	send(msg) {
		if (Array.isArray(msg)) {
			const length = Math.min(msg.length, this.#outputs.length);
			for (let j = 0; j < length; j++) {
				const m = msg[j];
				if (null === m)
					continue;

				for (let i = 0, outputs = this.#outputs[j], length = outputs.length; i < length; i++)
					outputs[i].receive(RED.util.cloneMessage(m));
			}
		}
		else {
			for (let i = 0, outputs = this.#outputs[0], length = outputs.length; i < length; i++)
				outputs[i].receive(RED.util.cloneMessage(msg));
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

		for (const node of this.#flow.nodes) {
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
		for (const node of this.#flow.nodes) {
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

	static type = "comment";
	static {
		this.noOutputs = Object.freeze([]);
		nodeClasses.set(this.type, this);
	}
}

class DisabledNode extends Node {
	receive() {}
	send() {}
}

class DebugNode extends Node {
	#property;
	#console;
	#sidebar;

	onSetup(config) {
		if (("jsonata" === config.targetType) || config.tostatus)
			throw new Error("unimplemented");

		this.#property = ("true" === config.complete) ? null : config.complete;
		this.#console = config.console;
		this.#sidebar = config.tosidebar;
	}
	onMessage(msg) {
		const value = JSON.stringify(this.#property ? msg[this.#property] : msg);
		if (this.#console)
			trace(value, "\n");
		if (this.#sidebar)
			trace.right(value);
	}

	static type = "debug"
	static {
		nodeClasses.set(this.type, this);
	}
}

class CatchNode extends Node {
	#scope;

	onSetup(config) {
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
		nodeClasses.set(this.type, this);
	}
}

class StatusNode extends Node {
	#scope;

	onSetup(config) {
		this.#scope = config.scope;
	}
	onStatus(msg) {
		if (!this.#scope || this.#scope.includes(msg.status?.source?.id))
			this.send(msg);
	}

	static type = "status";
	static {
		nodeClasses.set(this.type, this);
	}
}

function injectNow() {
	return Date.now();
}

class InjectNode extends Node {
	#timer;
	#delay;
	#repeat;
	#properties;

	onSetup(config) {
		if (config.chrontab)
			throw new Error("unimplemented");

		this.#delay = config.once ? parseFloat(config.onceDelay) * 1000 : 0;
		this.#repeat = config.repeat ? parseFloat(config.repeat) * 1000 : 0;
		this.#properties = config.props.map(property => {
			const name = property.p;
			const type = ("payload" === name) ? config.payloadType : property.vt;
			let value = ("payload" === name) ? config.payload : property.v;
			switch (type) {
				case "bool":
					value = "true" === value;
					break;
				case "date":
					value = injectNow;
					break;
				case "json":
					value = JSON.parse(value);
					break;
				case "num":
					value = parseFloat(value);
					break;
				case "str":
					value = value ?? "";
					break;
				default:
					throw new Error("unimplemented");
			}
			return {name, value};
		});
 	}
	onStart() {
		if (this.#repeat)
			this.#timer = Timer.set(() => this.trigger(), this.#delay, this.#repeat);
		else
			this.#timer = Timer.set(() => {this.#timer = undefined; this.trigger();}, this.#delay, this.#repeat);
	}
	onStop() {
		Timer.clear(this.#timer);
		this.#timer = undefined;
	}
	trigger() {
		const msg = {};
		for (let i = 0, properties = this.#properties, length = properties.length; i < length; i++) {
			let property = properties[i];
			let value = property.value;
			if (value instanceof Function)
				value = value();
			msg[property.name] = value;
		}
		this.send(msg);
	}

	static type = "inject";
	static {
		nodeClasses.set(this.type, this);
	}
}

// wraps timeout / interval calls to be able to clear on stop / redeploy... maybe don't care?
class FunctionNode extends Node {
	context = new Context;
	#initialize = nop;
	#func = nop;
	#finalize = nop;

	constructor(id, flow, name) {
		super(id, flow, name);
		this.context.global = globalContext;
		this.context.flow = flow.context;
	}
	onSetup(config) {
		if (config.libs?.length)
			throw new Error("unimplemented");

		if (config.func)
			this.#func = eval(`function f(msg, node, context, flow, global) {
${config.func}
};
f;`);
		if (config.initialize)
			this.#initialize = eval(`function f(node, context, flow, global) {
${config.initialize}
};
f;`);
		if (config.finalize)
			this.#finalize = eval(`function f(node, context, flow, global) {
${config.finalize}
};
f;`);
		const context = this.context;
		const func = this.#initialize;
		try {
			func(this, context, context.flow, context.global);
		}
		catch (e) {
			this.error(e);
		}
	}
	onMessage(msg) {
		const func = this.#func;
		const context = this.context;
		try {
			msg = func(msg, this, context, context.flow, context.global);
			if (msg)
				this.send(msg);
		}
		catch (e) {
			this.error(e);
		}
	}
	onStop() {
		const context = this.context;
		const func = this.#finalize;
		try {
			func(this, context, context.flow, context.global);
		}
		catch (e) {
			this.error(e);
		}
	}

	static type = "function";
	static {
		nodeClasses.set(this.type, this);
	}
}

class ChangeNode extends Node {
	#rules;

	onSetup(config) {
		this.#rules = config.rules.map(config => {
			const rule = {type: config.t, property: config.p};

			if ("msg" !== config.pt)
				throw new Error("unimplemented change target");

			if ("set" === config.t) {
				let value = config.to;
				switch (config.tot) {
					case "bool":
						value = "true" === value;
						break;
					case "date":
						value = injectNow;
						break;
					case "json":
						value = JSON.parse(value);
						break;
					case "num":
						value = parseFloat(value);
						break;
					case "str":
						value = value ?? "";
						break;
					default:
						throw new Error("unimplemented");
				}
				rule.value = value;
			}
			else if ("delete" === config.t)
				;
			else if ("move" === config.t) {
				if ("msg" !== config.tot)
					throw new Error("unimplemented move target");
				rule.to = config.to;
			}
			else
				throw new Error("unimplemented change");

			return rule; 
		});
	}
	onMessage(msg) {
		for (let i = 0, rules = this.#rules, length = rules.length; i < length; i++) {
			const rule = rules[i];
			if ("set" === rule.type) {
				let value = rule.value;
				if (value instanceof Function)
					value = value();
				msg[rule.property] = value;
			}
			else if ("delete" === rule.type)
				delete msg[rule.property];
			else if ("move" === rule.type) {
				msg[rule.to] = msg[rule.property]
				delete msg[rule.property];
			}
		}
		return msg;
	}

	static type = "change";
	static {
		nodeClasses.set(this.type, this);
	}
}

class RangeNode extends Node {
	#property;
	#scale;
	#in;
	#out;
	#round;

	onSetup(config) {
//@@ assert on wrap and constrain (or implement!)
		const maxin = parseFloat(config.maxin);
		const maxout = parseFloat(config.maxout);
		const minin = parseFloat(config.minin);
		const minout = parseFloat(config.minout);
		this.#scale = (maxout - minout) / (maxin - minin);
		this.#in = minin; 
		this.#out = minout;
		this.#property = config.property;
		this.#round = config.round; 
	}
	onMessage(msg) {
		const value = ((msg[this.#property] - this.#in) * this.#scale) + this.#out;
		msg[this.#property] = this.#round ? Math.round(value) : value;
		return msg;
	}

	static type = "range";
	static {
		nodeClasses.set(this.type, this);
	}
}

class LinkCallNode extends Node {
	#link;

	set links(value) {
		this.#link = value[0];
	}
	onSetup(config) {
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
		nodeClasses.set(this.type, this);
	}
}

class LinkInNode extends Node {
	set links(value) {
	}

	static type = "link in";
	static {
		nodeClasses.set(this.type, this);
	}
}

class LinkOutNode extends Node {
	#links;

	set links(value) {
		this.#links = value;
	}
	onSetup(config) {
		if ("return" === config.mode)
			this.#links = null;
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
		nodeClasses.set(this.type, this);
	}
}

class DigitalInNode extends Node {
	#pin;
	#io;

//@@ split into onSetup & onStart 
	onSetup(config) {
		if (config.read || parseFloat(config.debounce))
			throw new Error("unimplemented");

		this.#pin = parseInt(config.pin);
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
	onStop() {
		this.#io.close();
		this.#io = undefined;
	}

	static type = "rpi-gpio in";
	static {
		nodeClasses.set(this.type, this);
	}
}

class DigitalOutNode extends Node {
	#pin;
	#io;
	#level;
	#hz;

	onSetup(config) {
		this.#pin = parseInt(config.pin);
		this.#hz = ("pwm" !== config.out) ? undefined : (("" === config.freq) ? 0 : parseFloat(config.freq)); 
		if (config.level)
			this.#level = parseInt(config.level);
	}
	onStart() {
		const options  = {pin: this.#pin};

		if (undefined === this.#hz) {
			if (!globalThis.device?.io?.Digital)
				return;

			options.mode = device.io.Digital.Output;
			this.#io = new device.io.Digital(options);
			if (undefined !== this.#level)
				this.#io.write(this.#level);
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
	onStop() {
		this.#io.close();
		this.#io = undefined;
	}

	static type = "rpi-gpio out";
	static {
		nodeClasses.set(this.type, this);
	}
}

class MQTTBrokerNode extends Node {
	#mqtt;
	#options;
	#subscriptions = [];
	#writable;
	#queue = [];

	onSetup(config) {
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
	}
	onStart() {
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

				let payload = this.#mqtt.read(count);
				const msg = {topic: options.topic, QoS: options.QoS};
				if (options.retain) msg.retain = true;

				for (let subscriptions = this.#subscriptions, i = 0, length = subscriptions.length; i < length; i++) {
					const subscription = subscriptions[i];
					if (subscription.topic === options.topic) {	//@@ wildcard match
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
				this.#writable = count

				if (this.#queue.length) {
					for (let i = 0, queue = this.#queue.splice(0), length = queue.length; i < length; i++)
						this.onMessage(queue[i]);
				}
			}
		});
		this.#writable = 0;
	}
	onMessage(msg) {
		//@@ fragmented send unimplemented so will stall if message is bigger than output buffer
		const payload = msg.payload;
		if (this.#queue.length || ((payload.byteLength + msg.topic.length + 10) > this.#writable)) {
			this.#queue.push(msg);
			return;
		}

		this.#writable = this.#mqtt.write(payload, {
			topic: msg.topic,
			QoS: msg.QoS,
			retain: msg.retain
		});
	}
	onStop() {
		this.#mqtt?.close();
		this.#mqtt = undefined;
		this.#subscriptions.length = 0;
		this.#queue.length = 0;
	}
	subscribe(node, topic, format, QoS = 0) {
		const MQTTClient = device.network.mqtt.io;

		this.#subscriptions.push({node, topic, format, QoS});
		this.#mqtt?.write(null, {
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

		this.#mqtt?.write(null, {
			operation: MQTTClient.UNSUBSCRIBE,
			items
		});
	}

	static type = "mqtt-broker";
	static {
		nodeClasses.set(this.type, this);
	}
}

class MQTTInNode extends Node {
	#broker;
	#topic;
	#format;
	#QoS;

	onSetup(config) {
		this.#broker = flows.get(configFlowID).getNode(config.broker);

		this.#topic = config.topic;
		this.#format = config.datatype;
		this.#QoS = config.qos;
	}
	onStart() {
		this.#broker.subscribe(this, this.#topic, this.#format, this.#QoS); 
	}
	onStop() {
		this.#broker.unsubscribe(this, this.#topic); 
	}

	static type = "mqtt in";
	static {
		nodeClasses.set(this.type, this);
	}
}

class MQTTOutNode extends Node {
	#broker;
	#topic;
	#QoS;
	#retain;

	onSetup(config) {
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

		this.#broker.onMessage({
			payload,
			topic: this.#topic ?? msg.topic,
			QoS: this.#QoS ?? msg.QoS ?? 0,
			retain: this.#retain ?? msg.retain ?? false,
		});
	}

	static type = "mqtt out";
	static {
		nodeClasses.set(this.type, this);
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
globalThis.RED = RED;
