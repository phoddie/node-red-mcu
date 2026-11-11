/*
 * Copyright (c) 2022-2026  Moddable Tech, Inc.
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
 
/*
	is birth message sent on reconnection, or just initial connection?
*/

import {Node, configFlowID} from "nodered";
import Timer from "timer";
import TextDecoder from "text/decoder";

function byteLength(string) {
	return ArrayBuffer.fromString(string).byteLength;
}

class MQTTBrokerNode extends Node {
	#mqtt;
	#options;
	#subscriptions = [];
	#writable;
	#queue;		// pending write operations
	#status = [];
	#tls;

	onStart(config) {
		super.onStart(config);
		
		if (config.closeTopic)
			throw new Error("closeTopic unimplemented");
		if (config.willTopic)
			throw new Error("willTopic unimplemented");
		if (config.sessionExpiry)
			throw new Error("sessionExpiry unimplemented");
		if (4 != config.protocolVersion)
			throw new Error("expected protocolVersion 4");
		if (!config.autoConnect)
			throw new Error("expected autoConnect true");

		let port = config.port;
		if (port)
			port = parseInt(port);
		if (!port)
			port = config.tls ? 8883 : 1883;

		this.#options = {
			host: config.broker,
			port,
			id: config.clientid ? config.clientid : "node-red-" + this.id + "-" + Date.now() + "-" + Math.floor(Math.random() * 10000),		//@@ revisit this
			keepAlive: config.keepalive,		// nodered2mcu converts Node-RED's seconds to milliseconds
			clean: true === config.cleansession
		};
		if (config.credentials?.user)
			this.#options.user = config.credentials.user; 
		if (config.credentials?.password)
			this.#options.password = config.credentials.password; 
		if (config.tls)
			this.#tls = RED.nodes.getNode(config.tls);

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

		let mqtt = device.network.mqtt;
		if (this.#tls) {
			if (!device.io.TLS)
				throw new Error("TLS unavailable");

			const options = this.#tls.options ?? {};
			const tls = {
				applicationLayerProtocol: options.alpnprotocol ?? "mqtt",
				verify: options.verifyservercert ?? true
			};
			if (options.servername)
				tls.host = options.servername;		// MQTT Client defaults tls.host to the broker host
			if (options.ca)
				tls.ca = options.ca;
			if (options.cert) {
				tls.clientCertificate = options.cert;
				if (options.key)
					tls.clientKey = options.key;
			}
			mqtt = {
				...mqtt,
				socket: {
					io: device.io.TLS,
					TCP: {
						io: mqtt.socket.io
					},
					tls
				}
			};
		}

		this.#mqtt = new mqtt.io({
			...mqtt,
			...this.#options,
			onReadable: (count, options) => {
				let payload = this.#mqtt.read(count);
				let fragment = this.#options.fragment; 
				const msg = fragment ?? {topic: options.topic, qos: Number(options.QoS), retain: options.retain ?? false};

				if (options.more || fragment) {
					if (!fragment) {
						fragment = this.#options.fragment = msg;
						msg.payload = new Uint8Array(new ArrayBuffer(options.byteLength));
						msg.payload.position = 0;
					}

					msg.payload.set(new Uint8Array(payload), fragment.payload.position);
					fragment.payload.position += payload.byteLength; 
					if (options.more)
						return;
					
					delete this.#options.fragment;
					payload = msg.payload.buffer;
					delete msg.payload;
				}

				const topic = msg.topic.split("/");
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
								p = (new TextDecoder).decode(p);
								break;
							case "buffer":
								p = new Uint8Array(p);		// Node-RED: Buffer
								break;
							case "json":
								try {
									p = JSON.parse(String.fromArrayBuffer(p));
								}
								catch {
									subscription.node.error("invalid JSON", {payload: new Uint8Array(p), topic: msg.topic, qos: msg.qos, retain: msg.retain});
									continue subscriptions;		// not sent
								}
								break;
							case "base64":
								p = (new Uint8Array(p)).toBase64();
								break;
							default:		// "auto-detect" (and legacy "auto"): UTF-8 is a string, parsed as JSON if it is; anything else a buffer
								try {
									p = String.fromArrayBuffer(p);
								}
								catch {
									p = new Uint8Array(p);
									break;
								}
								if ("auto" !== subscription.format) {
									try {
										p = JSON.parse(p);
									}
									catch {
									}
								}
								break;
						}
						msg.payload = p
						subscription.node.send(msg);
					}
				}
			},
			onWritable: (count) => {
				const connected = undefined === this.#writable;
				this.#writable = count;
				if (connected) {
					this.status({fill: "green", shape: "dot", text: "node-red:common.status.connected"});
					delete this.#options.wait;
					this.#queue = [];
					const topics = new Set;
					for (const {topic, QoS} of this.#subscriptions) {
						if (topics.has(topic))
							continue;
						topics.add(topic);
						this.#queue.push({subscribe: topic, QoS});
					}
					if (this.#options.birthTopic) {
						this.#queue.push({publish: {
							topic: this.#options.birthTopic,
							QoS: this.#options.birthQos ?? 0,
							retain: this.#options.birthRetain ?? false,
							payload: this.#options.birthPayload
						}});
					}
				}
				this.#drain();
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
	onMessage(msg) {		// publish {topic, payload, QoS, retain}
		if (undefined === this.#writable)
			return;		// dropped when disconnected, as Node-RED
		this.#queue.push({publish: msg});
		this.#drain();
	}
	subscribe(node, topic, format, QoS = 0) {
		QoS = Number(QoS);
		const subscribed = this.#subscriptions.some(subscription => subscription.topic === topic);
		this.#subscriptions.push({node, topic, format, QoS});
		if ((undefined === this.#writable) || subscribed)
			return;		// subscribed on connect, or already subscribed
		this.#queue.push({subscribe: topic, QoS});
		this.#drain();
	}
	unsubscribe(node, topic) {		// node's subscription to topic; no node: all subscriptions
		const removed = new Set;
		this.#subscriptions = this.#subscriptions.filter(subscription => {
			if (node && ((subscription.node !== node) || (subscription.topic !== topic)))
				return true;
			removed.add(subscription.topic);
			return false;
		});
		if (undefined === this.#writable)
			return;
		for (const topic of removed) {
			if (!this.#subscriptions.some(subscription => subscription.topic === topic))
				this.#queue.push({unsubscribe: topic});
		}
		this.#drain();
	}
	#drain() {
		const queue = this.#queue, MQTTClient = this.#mqtt.constructor;
		while (queue.length) {
			const operation = queue[0];
			if (operation.publish) {
				const {topic, QoS, retain} = operation.publish;
				let payload = operation.publish.payload;
				if (!(payload instanceof Uint8Array))
					payload = operation.publish.payload = ArrayBuffer.isView(payload) ? new Uint8Array(payload.buffer, payload.byteOffset, payload.byteLength) : new Uint8Array(payload);
				const total = payload.byteLength;
				if (undefined === operation.offset) {		// not started
					const header = 2 + (operation.bytes ??= byteLength(topic));
					if ((header + total) <= this.#writable)
						this.#writable = this.#mqtt.write(payload, {topic, QoS: Number(QoS), retain});		// whole message
					else {		// fragmented: the first fragment gives the total length, the rest follow as space allows
						if (header >= this.#writable)
							return;
						const count = this.#writable - header;
						this.#writable = this.#mqtt.write(payload.subarray(0, count), {topic, QoS: Number(QoS), retain, byteLength: total});
						operation.offset = count;
						continue;
					}
				}
				else {
					if (!this.#writable)
						return;
					const count = Math.min(this.#writable, total - operation.offset);
					this.#writable = this.#mqtt.write(payload.subarray(operation.offset, operation.offset + count));
					operation.offset += count;
					if (operation.offset < total)
						continue;
				}
			}
			else if (operation.subscribe) {
				if ((2 + (operation.bytes ??= byteLength(operation.subscribe)) + 1) > this.#writable)
					return;
				this.#writable = this.#mqtt.write(null, {operation: MQTTClient.SUBSCRIBE, items: [{topic: operation.subscribe, QoS: operation.QoS}]});
			}
			else {
				if ((2 + (operation.bytes ??= byteLength(operation.unsubscribe))) > this.#writable)
					return;
				this.#writable = this.#mqtt.write(null, {operation: MQTTClient.UNSUBSCRIBE, items: [{topic: operation.unsubscribe}]});
			}
			queue.shift();
		}
	}
	requestStatus(node) {
		// if no node.#outputs.statuses and !config.noderedmcu?.editor... could safely ignore this 
		this.#status.push(node);
	}
	status(msg) {
		for (let i = 0, nodes = this.#status; i < nodes.length; i++)
			nodes[i].status(msg);
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

		const topic = this.#topic ?? msg.topic;
		if (("string" !== typeof topic) || !topic.length || topic.includes("+") || topic.includes("#")) {
			this.warn("invalid topic");
			done();
			return;
		}

		if (null === payload)
			payload = new ArrayBuffer(0);
		else if ((payload instanceof ArrayBuffer) || ArrayBuffer.isView(payload))
			;		// binary, as is
		else if ("object" === typeof payload)
			payload = ArrayBuffer.fromString(JSON.stringify(payload));
		else
			payload = ArrayBuffer.fromString(String(payload));

		this.#broker.onMessage({		// maybe unnecessary to use RED.mcu.enqueue here
			payload,
			topic,
			QoS: this.#QoS ?? msg.qos ?? 0,
			retain: this.#retain ?? msg.retain ?? false,
		});
	
		done();
	}

	static type = "mqtt out";
	static {
		RED.nodes.registerType(this.type, this);
	}
}
