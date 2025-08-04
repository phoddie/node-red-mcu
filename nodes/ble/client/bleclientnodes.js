/*
 * Copyright (c) 2025 Moddable Tech, Inc.
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

// very much based on https://github.com/clausbroch/node-red-contrib-noble-bluetooth/blob/master/bluetooth.js

// Note: bleclient UUIDs are lowercase, this node uses Noble's convention of uppercase for UUIDs.

/*
	To do:
	
		call done() from when any onMessage is complete
*/

import {Node} from "nodered";
import {GAPClient, GATTClient} from "embedded:io/bluetoothle/central"
import Timer from "timer";

class BLENode extends Node {
	error(error, status) {
		super.error(error);
		this.status({fill: "red", shape: "dot", text: status ?? error});
	}
}

class BLEScanner extends BLENode {
	#scan;
	#continuous;
	#services;
	#timer;

	onStart(config) {
		super.onStart(config);

		this.#continuous = config.continuous;
		this.#services = config.services;
	}
	onMessage(msg) {
		const continuous = this.#continuous ?? (true === msg.continuous);
		const timeout = parseInt(msg.timeout ?? 0);

		if ("start" === msg.topic) {
			if (this.#scan)
				return;

			let services = this.#services ?? msg.services;
			if ("string" === typeof services)
				services = [services];
			services = services?.filter(service => "" !== service.trim());
			const filters = {};
			if (services?.length)
				filters.services = services.map(service => service.toLowerCase());
			
			this.#scan = new GAPClient({
				target: this,
				filters,
				onReadable(count) {
					const target = this.target;
					for (let i = 0; i < count; i++) {
						const ad = this.read();
						
						const {address, name, services, manufacturerData, rssi} = ad;
						const msg = {
							peripheral: address,
							address
						};
						if (undefined !== name)
							msg.name = name;
						if (undefined !== rssi)
							msg.rssi = rssi;
						if (undefined !== manufacturerData)
							msg.manufacturerData = manufacturerData;
						if (undefined !== services)
							msg.services = services;

						const flags = ad.get(1);
						if (flags)
							msg.connectable = 0 !== ((new Uint8Array(flags))[0] & 6);

						const txPowerLevel = ad.get(10);
						if (txPowerLevel)
							msg.txPowerLevel = (new Int8Array(txPowerLevel))[0];

						target.send(msg);

						if (!continuous) {
							target.onMessage({topic: "stop"});
							break;
						}
					}
				},
				onError(error) {
					this.target.onMessage({topic: "stop"});
					this.target.error(`Scan error: ${error}`);
				}
			});

			if (timeout > 0)
				this.#timer = Timer.set(() => this.onMessage({topic: "stop"}), timeout);
			
			this.status({fill: "green", shape: "ring", text: "scanning"});
		}
		else if ("stop" === msg.topic) {
			Timer.clear(this.#timer);
			this.#scan?.close();
			this.#scan = this.#timer = undefined;
			this.status({});
		}
	}

	static type = "BLE scanner";
	static {
		RED.nodes.registerType(this.type, this);
	}
}

let devices;

class BLEDevice extends BLENode {
	#client;
	#connected;
	#characteristics = new Map;

	onMessage(msg) {
		const peripheral = msg.peripheral; 
		if (!peripheral)
			return void this.status({fill: "red", shape: "dot", text: "invalid peripheral id"});

		if (this.#client)
			return;

		devices ??= new Map;
		devices.set(peripheral, this);

		try {
			msg = {
				topic: "connected",
				connected: true,
				connectable: true,		//@@
				//@@ rssi
				peripheral,
				services: [],
				characteristics: []
			};

			this.#client = new GATTClient({
				target: this,
				address: peripheral,
				onReady() {
					this.target.status({fill: "green", shape: "dot", text: "connecting"});
					this.target.#connected = true;

					this.getPrimaryServices((error, services) => {
						if (error)
							return void this.target.error("getPrimaryServices: " + error);

						let count = services.length;
						services.forEach(service => {
							this.getCharacteristics(service, (error, characteristics) => {
								if (error)
									return void this.target.error("getCharacteristics: " + error);

								const s = {
									uuid: service.uuid.toUpperCase(),
									characteristics: [],
									// not doing name & type
								};
								characteristics.forEach(characteristic => {
									this.target.#characteristics.set(characteristic.uuid, characteristic);
									s.characteristics.push({
										uuid: characteristic.uuid.toUpperCase(),
										serviceUuid: s.uuid,
										properties: characteristic.properties,
										// not doing name & type
									})
								});
								msg.services.push(s);
								msg.characteristics.push(s.characteristics);

								if (0 === --count) {
									this.target.status({fill: "green", shape: "dot", text: "connected"});

									msg.characteristics = msg.characteristics.flat(); 
									this.target.send(msg);
								}
							});
						});
					});
				},
				onReadable(count) {
					while (count--) {
						const payload = this.read(), handle = payload.handle;
						this.target.#characteristics?.forEach(characteristic => {
							if (handle === characteristic.handle) {
								characteristic.subscribers.forEach(subscriber => {
									subscriber.send({
										characteristic: characteristic.uuid.toUpperCase(),
										payload
									});
								});
							}
						});
					}
				},
				onError(e) {
					if (this.target.#connected) {
						this.target.send({
							topic: "disconnected",
							peripheral,
							address: peripheral,
							connected: false,
							//@ connectable
						});
					}
					this.target.#connected = false;
					this.target.error(`GATT error: ${e}`, "disconnected");
					devices.delete(peripheral, this);
				}
			});
		}
		catch (e) {
			this.error(`GATT error: ${e}`, "disconnected");
		}
	}
	getCharacteristic(uuid) {
		return this?.#characteristics?.get(uuid)
	}
	subscribe(node, characteristic) {
		characteristic.subscribers ??= new Set;
		if (characteristic.subscribers.has(node))
			return;

		characteristic.subscribers.add(node);

		this.#client.enableNotifications(characteristic, true, error => {
			if (error) {
				characteristic.subscribers.delete(node);
				return void node.error(error);
			}
			node.status({fill: "green", shape: "dot", text: "subscribed"});
		});
	}
	unsubscribe(node, characteristic) {
		if (!characteristic?.subscribers.has(node))
			return;

		characteristic.subscribers.delete(node);

		this.#client.enableNotifications(characteristic, false, error => {
			if (error)
				return void node.error(error);
			node.status();
		});
	}
	read(characteristic, callback) {
		this.#client.read(characteristic, callback);
	}
	write(characteristic, value, callback) {
		this.#client.write(characteristic, value, callback);
	}

	static type = "BLE device";
	static {
		RED.nodes.registerType(this.type, this);
	}
}

class BLEIn extends BLENode {
	#topic;
	#characteristic;

	onStart(config) {
		super.onStart(config);
		
		this.#topic = config.topic ? config.topic : undefined;		// convert empty string to undefined
		this.#characteristic = config.characteristic ? config.characteristic.toLowerCase() : undefined;		// convert empty string to undefined 
	}
	onMessage(msg) {
		const device = devices?.get(msg.peripheral);
		if (!device)
			return void this.error("invalid peripheral id");

		let characteristic = this.#characteristic ?? msg.characteristic?.toLowerCase();
		if (!characteristic)
			return void this.error("missing characteristic UUID");

		characteristic = device.getCharacteristic(characteristic);
		if (!characteristic)
			return void this.error("invalid characteristic");

		const topic = this.#topic ?? msg.topic;
		switch (topic) {
			case "read":
				device.read(characteristic, (error, payload) => {
					if (error)
						return void this.error("read failed");
					this.send({
						characteristic: characteristic.uuid.toUpperCase(),
						payload
					});
				});
				break;
			case "subscribe":
				device.subscribe(this, characteristic);
				break;
			case "unsubscribe":
				device.unsubscribe(this, characteristic);
				break;
			default:
				this.error("Invalid characteristic");
				break;
		}
	}

	static type = "BLE in";
	static {
		RED.nodes.registerType(this.type, this);
	}
}

class BLEOut extends BLENode {
	#characteristic;

	onStart(config) {
		super.onStart(config);
		
		this.#characteristic = config.characteristic ? config.characteristic.toLowerCase() : undefined;		// convert empty string to undefined 
	}
	onMessage(msg) {
		const device = devices?.get(msg.peripheral);
		if (!device)
			return void this.error("invalid peripheral id");

		let characteristic = this.#characteristic ?? msg.characteristic?.toLowerCase();
		if (!characteristic)
			return void this.error("missing characteristic UUID");

		characteristic = device.getCharacteristic(characteristic);
		if (!characteristic)
			return void this.error("invalid characteristic");

		let payload = msg.payload;
		if (!payload)
			return void this.error("missing payload");
		if ("string" === typeof payload)
			payload = ArrayBuffer.fromString(payload);
		else if (ArrayBuffer.isView(payload) || (payload instanceof ArrayBuffer))
			;
		else
			return void this.error("invalid payload");
		device.write(characteristic, payload, error => {
			if (error)
				this.error("write failed");
		});
	}

	static type = "BLE out";
	static {
		RED.nodes.registerType(this.type, this);
	}
}
