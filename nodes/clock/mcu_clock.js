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

class Clock extends Node {
	#clock;

	onStart(config) {
		super.onStart(config);

		try {
			this.#clock = config.initialize.call(this);
			this.status({fill: "green", shape: "dot", text: "node-red:common.status.connected"});
		}
		catch {
			this.status({fill: "red", shape: "ring", text: "node-red:common.status.disconnected"});
		}
	}
	onMessage(msg, done) {
		if (!this.#clock)
			return;

		try {
			if (msg.configuration) {
				this.#clock.configure(msg.configuration);
				msg = undefined;
			}
			else if (msg.payload) {
				this.#clock.time = Number(msg.payload);
				msg = undefined;
			}
			else
				msg.payload = this.#clock.time;
			done();
		}
		catch (e) {
			done(e);
			msg = undefined;
		}

		return msg;
	}

	static type = "mcu_clock";
	static {
		RED.nodes.registerType(this.type, this);
	}
}
