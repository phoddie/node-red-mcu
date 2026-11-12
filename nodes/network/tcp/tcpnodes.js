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

/*
	status
*/

import {Node} from "nodered";
import TextDecoder from "text/decoder"
import Timer from "timer";

let connections = [];

const reconnectTime = 10_000;

function connect(node, config, host, port) {
	node.status({fill: "grey", shape: "dot", text: "common.status.connecting"});
	const DNS = device.network.dns.resolver;
	const dns = new DNS.io(DNS);
	dns.resolve({
		host,
		onResolved: (host, address) => {
			new TCPConnection({
				config,
				node,
				address,
				host,
				port
			});
		},
		onError: () => {
			node.log(`cannot resolve ${host}`);
			node.status({fill: "red", shape: "ring", text: "common.status.disconnected"});
			Timer.set(() => connect(node, config, host, port), reconnectTime);
		}
	});
}

class TCPConnection {
	socket;
	node;
	config;

	constructor(options) {
		this.node = options.node;
		this.config = options.config;
		this.id = RED.util.generateId();
		if ((("stream" === this.config.datamode) && this.config.newline && ("utf8" === this.config.datatype)) || ("single" === this.config.datamode))
			this.remainder = new Uint8Array(new ArrayBuffer(0, {maxByteLength: 0x8000}));
		if ("utf8" === this.config.datatype)
			this.decoder = new TextDecoder;

		const o = {
			target: this,
			onReadable(count) {
				this.target.onReadable(count);
			},
			onWritable(count) {
				this.target.onWritable(count);
			},
			onError() {
				this.target.onError();
			}
		};
		if (options.from) {
			o.from = options.from
			this.socket = new options.from.constructor(o);
		}
		else {
			o.address = options.address;
			if (options.host)
				o.host = options.host;
			o.port = options.port;
			this.socket = new device.io.TCP(o);
			this.socket.address = o.address;
			this.socket.port = o.port;
			if (o.host)
				this.socket.host = o.host;
		}

		connections.push(this);
	}
	onError() {
		let expected = this.end;		// closed after send
		if ("single" === this.config.datamode) {
			if (this.remainder.byteLength) {
				this.send(this.remainder);
				expected = true;		// closed after a reply
			}
			delete this.remainder;
		}
		this.close(expected ? 20 : reconnectTime);
	}
	close(delay = reconnectTime) {		// a client connection reconnects after delay
		connections.splice(connections.indexOf(this), 1);
		this.socket.close();

		const {node, config} = this, {address, host, port} = this.socket;
		if (address) {
			node.status({fill: "red", shape: "ring", text: "common.status.disconnected"});
			Timer.set(() => connect(node, config, host, port), delay);
		}

		delete this.socket;
	}
	onReadable(count) {
		const config = this.config;
		const remainder = this.remainder;
		if (remainder) {
			const byteLength = remainder.byteLength;
			remainder.buffer.resize(count + byteLength);
			this.socket.read(remainder.subarray(byteLength));
			if ("stream" === this.config.datamode) {
				let position = 0;
				while (position < remainder.byteLength) {
					const newline = Buffer.prototype.indexOf.call(remainder, config.newline, position);
					if (newline < 0)
						break;

					this.send(remainder.slice(position, newline + (config.trim ? config.newline.byteLength : 0)));
					position = newline + config.newline.byteLength;
				}
				if (position) {
					if (position < remainder.length)
						remainder.set(remainder.subarray(position));
					remainder.buffer.resize(remainder.length - position);
				}
			}
		}
		else {
			const data = this.socket.read();
			if (config.read)
				this.send(new Uint8Array(data));
		}
	}
	send(payload) {
		const config = this.config;
		const msg = {
			topic: config.topic ?? "",
		};
		if (!this.socket.address) {
			msg.ip = this.socket.remoteAddress;
			msg.port = this.socket.remotePort;
		}
		msg._session = {
			type: "tcp",
			id: this.id
		};
		if ("utf8" === this.config.datatype)
			payload = this.decoder.decode(payload.buffer, {stream: true});
		else if (("base64" === this.config.datatype) && (payload instanceof Uint8Array))
			payload = payload.toBase64();

		msg.payload = payload;
		this.node.send(msg);
	}
	onWritable(count) {
		this.writable = count;
		if (!this.connected) {
			this.connected = true;
			if (this.socket.address)		// client connection
				this.node.status({fill: "green", shape: "dot", text: "common.status.connected"});
		}
		if (this.end)
			return void this.onError();		// close and reconnect
		this.flush();
	}
	write(buffer) {		// Uint8Array
		this.output ??= [];
		buffer.position = 0;
		this.output.push(buffer);
		this.flush();
	}
	flush() {
		const output = this.output;
		if (!output) return;

		while (output.length && this.writable) {
			const buffer = output[0];
			const use = Math.min(buffer.byteLength - buffer.position, this.writable);
			this.socket.write(buffer.subarray(buffer.position, buffer.position + use));
			this.writable -= use;
			buffer.position += use;
			if (buffer.position === buffer.byteLength)
				output.shift();
		}
		if (!output.length) {
			delete this.output;
			if (this.config.end)
				this.end = true;
		}
	}
	
	static find(id) {
		return connections.find(connection => connection.id === id);
	}
}

class TCPIn extends Node {
	#config;

	onStart(config) {
		super.onStart(config);

		this.#config = {
			datatype: config.datatype,
			datamode: config.datamode,
			read: true
		};
		if (config.newline?.length)
			this.#config.newline = ArrayBuffer.fromString(config.newline);
		if (config.topic)
			this.#config.topic = config.topic;
		if (config.trim)
			this.#config.trim = config.trim;

		if ("server" === config.server) {
			new device.io.Listener({
				port: config.port,
				target: this,
				onReadable(count) {
					while (count--) {
						new TCPConnection({
							config: this.target.#config,
							node: this.target,
							from: this.read(),
						});
					}
				}
			});
		}
		else if ("client" === config.server)
			connect(this, this.#config, config.host, config.port);
		else
			debugger;
	}

	static type = "tcp in";
	static {
		RED.nodes.registerType(this.type, this);
	}
}

class TCPOut extends Node {
	#config;

	onStart(config) {
		super.onStart(config);

		this.#config = {
			beserver: config.beserver
		};
		if (config.base64)
			this.#config.base64 = config.base64; 
		if (config.end)
			this.#config.end = true; 

		if ("server" === config.beserver) {
			new device.io.Listener({
				port: config.port,
				target: this,
				onReadable(count) {
					while (count--) {
						new TCPConnection({
							config: this.target.#config,
							node: this.target,
							from: this.read()
						});
					}
				}
			});
		}
		else if ("client" === config.beserver)
			connect(this, this.#config, config.host, config.port);
	}
	onMessage(msg) {
		let payload = msg.payload;
		if ("reply" === this.#config.beserver) {
			const reset = true === msg.reset;
			if (!reset)
				payload = this.#toBuffer(payload);
			if ("tcp" === msg._session?.type) {
				const connection = TCPConnection.find(msg._session.id);
				if (reset)
					connection?.close();
				else
					connection?.write(payload);
			}
			else {
				connections.filter(connection => connection.node instanceof TCPIn).forEach(connection => {
					if (reset)
						connection.close();
					else
						connection.write(payload);
				});
			}
		}
		else {
			if (null == payload)
				return;
			payload = this.#toBuffer(payload);

			if (msg._session) {
				const connection = TCPConnection.find(msg._session?.id);
				if (connection && (connection.node === this))
					return void connection.write(payload);
			}

			connections.forEach(connection => {
				if (connection.node === this)
					connection.write(payload);
			});
		}
	}
	#toBuffer(payload) {
		if (payload instanceof Uint8Array)
			return payload;
		if (this.#config.base64 && ("string" === typeof payload))
			return Uint8Array.fromBase64(payload);
		return new Uint8Array(ArrayBuffer.fromString("" + payload));
	}

	static type = "tcp out";
	static {
		RED.nodes.registerType(this.type, this);
	}
}
