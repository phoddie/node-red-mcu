/*
 * Copyright (c) 2022-2026  Moddable Tech, Inc.
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

import UDP from "embedded:io/socket/udp";
import TextDecoder from "text/decoder";
import {Node} from "nodered";

// all nodes bound to same port share a single UDP socket 
class SharedUDP {
	static sockets = [];

	static add(port, onReadable) {
		let socket = SharedUDP.sockets[port];
		if (socket) {
			if (onReadable) {
				socket.nodes ??= [];
				socket.nodes.push(onReadable);
			}
			return socket;
		}
		
		const options = {onReadable: this.onReadable};
		if (port)
			options.port = port;
		socket = new UDP(options);
		if (port)
			SharedUDP.sockets[port] = socket;
		if (onReadable)
			socket.nodes = [onReadable];
		
		return socket;
	}
	static onReadable(count) {		// called with this === udp socket
		while (count--) {
			const buffer = this.read();
			this.nodes?.forEach(onReadable => onReadable(buffer));
		}
	}
}

class UDPIn extends Node {
	onStart(config) {
		super.onStart(config);
		
		if (("udp4" !== config.ipv) || config.iface || ("false" !== config.multicast))
			throw new Error("unsupported");
		
		const datatype = config.datatype;
		SharedUDP.add(parseInt(config.port), buffer => {
			let payload;
			if ("utf8" === datatype)
				payload = (new TextDecoder).decode(buffer);
			else if ("base64" === datatype)
				payload = (new Uint8Array(buffer)).toBase64();
			else
				payload = new Uint8Array(buffer);
			this.send({
				payload,
				fromip: buffer.address + ":" + buffer.port,
				ip: buffer.address,
				port: buffer.port
			});
		});
	}

	static type = "udp in";
	static {
		RED.nodes.registerType(this.type, this);
	}
}

class UDPOut extends Node {
	#socket;		// could share across multiple instances
	#ip;
	#port;
	#base64;

	onStart(config) {
		super.onStart(config);

		if (("udp4" !== config.ipv) || config.iface || ("false" !== config.multicast))
			throw new Error("unsupported");

		this.#ip = config.addr;
		this.#port = Number(config.port);
		this.#base64 = config.base64;

		this.#socket = SharedUDP.add(config.outport ? parseInt(config.outport) : 0);
	}
	onMessage(msg, done) {
		if (!("payload" in msg))
			return void done();

		const ip = this.#ip || msg.ip || "";
		const port = this.#port || msg.port || 0;
		if (!ip)
			this.warn("udp: ip address not set");
		else if (!port)
			this.warn("udp: port not set");
		else if (isNaN(port) || (port < 1) || (port > 65535))
			this.warn("udp: invalid port");
		else {
			let payload = msg.payload;
			if (this.#base64)
				payload = Uint8Array.fromBase64(""+ payload);
			else if (!(payload instanceof Uint8Array))
				payload = ArrayBuffer.fromString("" + payload);

			try {
				this.#socket.write(payload, ip, Number(port));
			}
			catch (e) {
				this.error("udp : " + e, msg);
			}
		}
		done();
	}

	static type = "udp out";
	static {
		RED.nodes.registerType(this.type, this);
	}
}
