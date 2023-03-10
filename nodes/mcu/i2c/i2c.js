/*
 * Copyright (c) 2023  Moddable Tech, Inc.
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

// modeled on https://flows.nodered.org/node/node-red-contrib-i2c
//
// one i2c instnace active at a time; could cache more than one
//
import {Node} from "nodered";

let cache;

function getI2C(options, done) {
	const o = cache?.options;
	if (o &&
		(o.bus === options.bus) &&
		(o.clock === options.clock) &&
		(o.data === options.data) &&
		(o.hz === options.hz) &&
		(o.address === options.address)) {
		return cache;
	}
	cache?.close();
	cache = null;

	if (options.bus) {
		const o = globalThis.device.I2C?.[options.bus];
		if (!o) return; 

		cache = new (o.io)({
			...o,
			hz: options.hz,
			address: options.address
		});
	}
	else {
		const I2C = globalThis.device?.io?.I2C;
		if (!I2C) return;
		
		cache = new I2C(options);
	}

	cache.options = options;

	return cache;
}

/*
	This node will request data from a given device.
	The address and command can both be set in the dialog screen or
		dynamically with msg.address and msg.command.
	This node outputs the result as a buffer in msg.payload and
		places the address in msg.address and command in msg.command.
*/

class I2CInNode extends Node {
	#options;
	#bytes;
	#command;

	onStart(config) {
		super.onStart(config);

		this.#options = config.options;
		this.#bytes = config.bytes;
		this.#command = config.command;
	}
	onMessage(msg, done) {
		let options = this.#options;
		if (undefined !== msg.address) {
			options = {
				...options,
				address: msg.address
			};
		}

		try {
			const i2c = getI2C(options);
			if (!i2c)
				return void done();

			const command = this.#command ?? msg.command;
			if (undefined != command) {		// null or undefined
				i2c.write(Uint8Array.of(command), false);
				msg.command = command;
			}

			msg.payload = new Uint8Array(i2c.read(this.#bytes));
			msg.address = options.address;

			done();
			this.status({fill: "green", shape: "dot", text: "node-red:common.status.connected"});

			return msg;
		}
		catch (e) {
			done(e);
			this.status({fill: "red", shape: "ring", text: "node-red:common.status.error"});
		}
	}

	static type = "mcu_i2c_in";
	static {
		RED.nodes.registerType(this.type, this);
	}
}

/*
	This node will send a given String/array/buffer to a given device.
		The address and command can both be set in the dialog screen or
		dynamically with msg.address and msg.command. The payload can be
		set statically or dynamically (using msg.payload).

	This payload can be a Buffer, Array, String or Integer. When you use integers
		the number of bytes to send is important and can be set between 0 and 31 bytes.

	Since v0.5.0 - you can daisychain this node, the input msg is sent unchanged to the next node.
*/

class I2COutNode extends Node {
	#options;
	#bytes;
	#command;
	#getter;

	onStart(config) {
		super.onStart(config);

		this.#options = config.options;
		this.#bytes = config.bytes;
		this.#command = config.command;
		this.#getter = config.getter;
	}
	onMessage(msg, done) {
		let options = this.#options;
		if (undefined !== msg.address) {
			options = {
				...options,
				address: msg.address
			};
		}

		try {
			const i2c = getI2C(options);
			if (!i2c)
				return void done();

			const command = this.#command ?? msg.command;
			if (undefined != command)		// null or undefined
				i2c.write(Uint8Array.of(command), false);

			let payload = this.#getter(msg);
			switch (typeof payload) {
				case "number": {
					const buffer = new Uint8Array(this.#bytes);
					let i = 0;
					payload = payload | 0;
					while (payload) {
						buffer[i++] = payload;
						payload >>= 8;
					}
					i2c.write(buffer);
					} break;
				case "string":
					i2c.write(ArrayBuffer.fromString(payload));
					break;
				case "object":
					if (Array.isArray(payload))
						i2c.write(Uint8Array.from(payload));
					else if (payload instanceof Uint8Array)
						i2c.write(payload);
					break;
			}

			done();
			this.status({fill: "green", shape: "dot", text: "node-red:common.status.connected"});

			return msg;
		}
		catch (e) {
			done(e);
			this.status({fill: "red", shape: "ring", text: "node-red:common.status.error"});
		}
	}

	static type = "mcu_i2c_out";
	static {
		RED.nodes.registerType(this.type, this);
	}
}
