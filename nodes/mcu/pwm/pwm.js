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

let cache;		// support multiple nodes sharing the same pin, like the RPi implementation

class PWMOutNode extends Node {
	#io;

	onStart(config) {
		super.onStart(config);

		if (!globalThis.device?.io?.PWM)
			return void this.status({fill: "red", shape: "dot", text: "node-red:common.status.error"});

		cache ??= new Map;
		let io = cache.get(config.pin);

		if (io) {
			this.#io = io;
		}
		else {
			try {
				const options = {
					pin: config.pin,
				};
				if (config.hz)
					options.hz = config.hz;
				this.#io = io = new device.io.PWM(options);
				cache.set(config.pin, io);
			}
			catch {
				this.status({fill: "red", shape: "dot", text: "node-red:common.status.error"});
			}
		}
	}
	onMessage(msg, done) {
		if (this.#io) {
			this.#io.write(msg.payload * ((1 << this.#io.resolution) - 1));
			this.status({fill:"green", shape:"dot", text: msg.payload.toString()});
		}
		done();
	}

	static type = "mcu_pwm_out";
	static {
		RED.nodes.registerType(this.type, this);
	}
}
