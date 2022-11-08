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

import {Node} from "nodered";

let cache;		// support multiple nodes sharing the same pin, like the RPi implementation

class DigitalInNode extends Node {
	onStart(config) {
		super.onStart(config);

		const Digital = globalThis.device?.io?.Digital;
		if (!Digital)
			return;

		cache ??= new Map;
		let io = cache.get(config.pin);
		const intype = config.intype ?? "input"
		if (io) {
			if (io.type !== intype)
				return this.error("digital in mismatch")
			io.readers.push(this);
		}
		else {
			let mode = Digital.Input;
			if ("up" === intype)
				mode = Digital.InputPullUp;
			else if ("down" === intype)
				mode = Digital.InputPullDown;
			io = new Digital({
				pin: config.pin,
				mode,
				edge: Digital.Rising + Digital.Falling,
				onReadable() {
					const msg = {
						payload: this.read(),
						topic: "gpio/" + this.pin
					}
					this.readers.forEach(reader => reader.send(msg));
				}
			});
			io.type = intype;
			io.pin = config.pin;
			io.readers = [this];
			cache.set(config.pin, io);
		}

		if (config.read) {
			this.send({
				payload: io.read(),
				topic: "gpio/" + config.pin
			});
		}
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

		cache ??= new Map;
		let io = cache.get(config.pin);
		if (undefined === this.#hz) {
			if (!globalThis.device?.io?.Digital)
				return;

			if (io) {
				if (io.type !== "output")
					return this.error("digital out mismatch")
				this.#io = io;
			}
			else {
				options.mode = device.io.Digital.Output;
				this.#io = io = new device.io.Digital(options);
				if (undefined !== config.level)
					io.write(config.level);
				io.type = "output";
				cache.set(config.pin, io);
			}
		}
		else {
			if (!globalThis.device?.io?.PWM)
				return;

			if (io) {
				if (io.type !== "pwm")
					return this.error("digital out mismatch")
				this.#io = io;
			}
			else {
				if (this.#hz)
					options.hz = this.#hz; 
				this.#io = io = new device.io.PWM(options);
				io.type = "pwm";
				cache.set(config.pin, io);
			}
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
