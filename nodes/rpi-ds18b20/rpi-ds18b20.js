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
import mcconfig from "mc/config";
import OneWire from "onewire";
import DS18X20 from "DS18X20";

class RpiDS18B20 extends Node {
	#array;
	#bus;
	#sensors = [];

	onSetup(config) {
		if (config.topic)
			throw new Error("topic unimplemented");

		this.#array = config.array;
	}
	onStart() {
		this.#bus = new OneWire({
		  pin: mcconfig.onewire.pin
		});

		const items = this.#bus.search();
		for (let i = 0; i < items.length; i++) {
			const id = items[i];
			this.#sensors.push(new DS18X20({bus: this.#bus, id}));
		}
	}
	onMessage(msg) {
		if (msg.array ?? this.#array)
			msg.payload = [];

		for (let i = 0, sensors = this.#sensors; i < sensors.length; i++) {
			sensors[i].getTemperature(temp => {
				const sample = {
					family: sensors[i].family.toString(16),
					id: sensors[i].toString(),
					temp
				}
				if (this.#array) {
					msg.payload.push(sample);
					if (msg.payload.length === sensors.length)
						this.send(msg);
				}
				else {
					msg.payload = sample;
					this.send(msg);
				}
			});
		}
	}
	onStop() {
		this.#sensors = undefined;
		this.#bus?.close();
	}

	static type = "rpi-ds18b20";
	static {
		super.install();
	}
}
