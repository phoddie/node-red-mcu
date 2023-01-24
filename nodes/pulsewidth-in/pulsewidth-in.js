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

class PulseWidthInNode extends Node {
	onStart(config) {
		super.onStart(config);

		const PulseWidth = globalThis.device?.io?.PulseWidth;
		if (!PulseWidth)
			return void this.status({fill: "red", shape: "dot", text: "node-red:common.status.error"});

		const node = this;
		new PulseWidth({
			pin: config.pin,
			mode: PulseWidth[config.mode],
			edges: [0, PulseWidth.RisingToFalling, PulseWidth.FallingToRising, PulseWidth.RisingToRising, PulseWidth.FallingToFalling][config.edges],
			onReadable() {
				node.send({payload: this.read()});
			}
		});
	}

	static type = "mcu_pulse_width";
	static {
		RED.nodes.registerType(this.type, this);
	}
}

