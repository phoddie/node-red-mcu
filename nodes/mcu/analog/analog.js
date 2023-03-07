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

class AnalogIn extends Node {
	#io;

	onStart(config) {
		super.onStart(config);

		const Analog = globalThis.device?.io?.Analog;
		if (Analog) {
			cache ??= new Map;
			let io = cache.get(config.pin);
			if (!io) {
				const options = {
					pin: config.pin
				};
				if (config.resolution)
					options.resolution = config.resolution;
				try {
					this.#io = io = new Analog(options);
					cache.set(config.pin, io);
				}
				catch {
				}
			}
		}

		if (!this.#io)
			this.status({fill: "red", shape: "dot", text: "node-red:common.status.error"});
	}
	onMessage(msg) {
		const io = this.#io;
		if (!io)
			return;

		msg.resolution = io.resolution;
		msg.payload = io.read() / ((1 << msg.resolution) - 1);
		this.status({fill: "green", shape: "dot", text: msg.payload.toFixed(3)});
		return msg;
	}

	static type = "mcu_analog";
	static {
		RED.nodes.registerType(this.type, this);
	}
}
