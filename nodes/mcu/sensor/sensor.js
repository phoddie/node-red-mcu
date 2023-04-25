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

class Sensor extends Node {
	#sensor;

	onStart(config) {
		super.onStart(config);

		try {
			this.#sensor = config.initialize.call(this);
			this.status({fill: "green", shape: "dot", text: "node-red:common.status.connected"});

			if (config.asyncSample) {
				this.#sensor.callback = (error, sample) => {
					const sensor = this.#sensor;
					const pending = sensor.pending.shift(); 
					if (!sensor.pending.length)
						delete sensor.pending;

					if (error) {
						sensor.close();
						this.#sensor = undefined;
						this.status({fill: "red", shape: "ring", text: "node-red:common.status.disconnected"});
						pending.done(error);
					}
					else if (sample) {
						pending.msg.payload = sample;
						this.send(pending.msg);
						pending.done();
					}
				}
			}
		}
		catch {
			this.status({fill: "red", shape: "ring", text: "node-red:common.status.disconnected"});
		}
	}
	onMessage(msg, done) {
		const sensor = this.#sensor;
		if (!sensor)
			return;

		if (msg.configuration) {
			try {
				sensor.configure(msg.configuration);
				done?.();
			}
			catch (e) {
				done?.(e);
			}
			return;
		}
		
		try {
			if (sensor.callback) {
				sensor.sample(sensor.callback);
				sensor.pending ??= [];
				sensor.pending.push({done, msg});
				return;
			}

			const payload = sensor.sample();
			if (payload)
				msg.payload = payload;
			else
				msg = undefined;
		}
		catch {
			this.status({fill: "red", shape: "ring", text: "node-red:common.status.disconnected"});
			sensor.close();
			this.#sensor = undefined;
			msg = undefined;
		}
		finally {
			done?.();
		}

		return msg;
	}

	static type = "sensor";
	static {
		RED.nodes.registerType(this.type, this);
	}
}
