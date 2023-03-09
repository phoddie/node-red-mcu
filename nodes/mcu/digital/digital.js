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

let cache;		// support multiple nodes sharing the same pin, like the RPi implementation

class DigitalInNode extends Node {
	#timer;

	onStart(config) {
		super.onStart(config);

		const Digital = globalThis.device?.io?.Digital;
		if (!Digital)
			return void this.status({fill: "red", shape: "dot", text: "node-red:common.status.error"});

		if (config.debounce)
			Object.defineProperty(this, "debouce", {value: config.debounce});

		let edge = config.edge;
		if (config.invert) {
			Object.defineProperty(this, "invert", {value: 1});
			edge ^= 0b11; 
		}

		cache ??= new Map;
		let io = cache.get(config.pin);
		if (io) {
			if ((io.mode !== config.mode) || (io.edge !== edge))
				return void this.status({fill: "red", shape: "dot", text: "mismatch"});
			io.readers.push(this);
		}
		else {
			io = new Digital({
				pin: config.pin,
				mode: Digital[config.mode],
				edge: ((edge & 1) ? Digital.Rising : 0) + ((edge & 2) ? Digital.Falling : 0),
				onReadable() {
					this.readers.forEach(reader => {
						reader.#timer ??= Timer.set(() => {
							reader.#timer = undefined;

							const msg = {
								payload: this.read() ^ (reader.invert ?? 0),
								topic: "gpio/" + this.pin
							};
							reader.send(msg)
							reader.status({fill: "green", shape: "dot", text: msg.payload.toString()});
						}, reader.debounce ?? 0);
					});
				}
			});
			io.mode = config.mode;
			io.edge = edge;
			io.pin = config.pin;
			io.readers = [this];
			cache.set(config.pin, io);
		}

		if (config.initial) {
			const payload = io.read() ^ (this.invert ?? 0);
			this.send({
				payload,
				topic: "gpio/" + config.pin
			});
			this.status({fill: "green", shape: "dot", text: payload.toString()});
		}
	}

	static type = "mcu_digital_in";
	static {
		RED.nodes.registerType(this.type, this);
	}
}

class DigitalOutNode extends Node {
	#io;

	onStart(config) {
		super.onStart(config);

		if (!globalThis.device?.io?.Digital)
			return;

		if (config.invert)
			Object.defineProperty(this, "invert", {value: 1}); 

		cache ??= new Map;
		let io = cache.get(config.pin);

		if (io) {
			if (io.mode !== config.mode)
				return void this.status({fill: "red", shape: "dot", text: "mismatch"});
			this.#io = io;
		}
		else {
			try {
				this.#io = io = new device.io.Digital({
					pin: config.pin,
					mode: device.io.Digital[config.mode]
				});

				if (undefined !== config.initial) {
					if (0 == config.initial)
						io.write(0 ^ (this.invert ?? 0));
					else if (1 == config.initial)
						io.write(1 ^ (this.invert ?? 0));
				}
				io.mode = config.mode;
				cache.set(config.pin, io);
			}
			catch {
				this.status({fill: "red", shape: "dot", text: "node-red:common.status.error"});
			}
		}
	}
	onMessage(msg, done) {
		if (this.#io) {
			const value = msg.payload ^ (this.invert ?? 0);
			this.#io.write(value);
			this.status({fill:"green", shape:"dot", text: value.toString()});
		}
		done();
	}

	static type = "mcu_digital_out";
	static {
		RED.nodes.registerType(this.type, this);
	}
}
