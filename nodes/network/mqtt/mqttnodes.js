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

import {Node} from "nodered";
import Timer from "timer";
import Base64 from "base64";

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
				let payload = this.#mqtt.read(count);
				let fragment = this.#options.fragment; 
				const msg = fragment ?? {topic: options.topic, QoS: Number(options.QoS), retain: options.retain ?? false};

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
