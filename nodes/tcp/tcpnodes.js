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

/*
	status
*/

import {Node} from "nodered";
//import Timer from "timer";
import TextDecoder from "text/decoder"
import Listener from "embedded:io/socket/listener";		// should use device.*
import TCP from "embedded:io/socket/tcp";		// should use device.*
import Base64 from "base64";

let connections = [];

class TCPConnection {
	socket;
	node;
	config;

	constructor(options) {
		this.node = options.node;
		this.config = options.config;
		this.id = RED.util.generateId();
		if ((("stream" === this.config.datamode) && this.config.newline) || ("single" === this.config.datamode))  
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
			this.socket = new TCP(o);
			this.socket.address = o.address;
			this.socket.port = o.port;
			if (o.host)
				this.socket.host = o.host;
		}

		connections.push(this);
	}
	onError() {
		if ("single" === this.config.datamode) {
			if (this.remainder.byteLength)
				this.send(this.remainder);
			delete this.remainder;
		}

		connections.splice(connections.indexOf(this), 1);
		this.socket.close();
		
		if (this.socket.address) {	// reconnect... might want/need to wait?
			new TCPConnection({
				config: this.config,
				node: this.node,
				address: this.socket.address,
				host: this.socket.host,
				port: this.socket.port
			});
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
			ip: this.socket.remoteAddress,
			port: this.socket.remotePort,
			_session: {
				type: "tcp",
				id: this.id
			}
		};
		if ("utf8" === this.config.datatype)
			payload = this.decoder.decode(payload.buffer, {stream: true});
		else if (("base64" === this.config.datatype) && (payload instanceof Uint8Array))
			payload = Base64.encode(payload);

		msg.payload = payload;
		this.node.send(msg);
	}
	onWritable(count) {
		this.writable = count;
		if (this.end)
			return void this.onError();		// close and reconnect
		this.flush();
	}
	write(buffer) {
		if (!(buffer instanceof Uint8Array))
			buffer = new Uint8Array(ArrayBuffer.fromString(buffer.toString()));
		else if (this.config.base64)
			buffer = new Uint8Array(Base64.decode(buffer));

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
			new Listener({
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
		else if ("client" === config.server) {
			const DNS = device.network.http.dns;		//@@ should have device.network.dns
			const dns = new DNS.io(DNS);
			const port = config.port;
			dns.resolve({
				host: config.host, 
				onResolved: (host, address) => {
					new TCPConnection({
						config: this.#config,
						node: this,
						address,
						host,
						port
					});
				},
				onError: (err) => {
					debugger;
				},
			});
		}
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
			new Listener({
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
		else if ("client" === config.beserver) {
			const DNS = device.network.http.dns;		//@@ should have device.network.dns
			const dns = new DNS.io(DNS);
			const port = config.port;
			dns.resolve({
				host: config.host, 
				onResolved: (host, address) => {
					new TCPConnection({
						config: this.#config,
						node: this,
						address,
						host,
						port
					});
				},
				onError: (err) => {
					debugger;
				},
			});

		} 
	}
	onMessage(msg) {
		if ("reply" === this.#config.beserver) {
			const connection = TCPConnection.find(msg._session?.id);
			if (connection)
				connection.write(msg.payload);
			else
				this.error("invalid connection");
		}
		else {
			if (msg._session) {
				const connection = TCPConnection.find(msg._session?.id);
				if (connection && (connection.node === this))
					return void connection.write(msg.payload);
			}

			connections.forEach(connection => {
				if (connection.node === this)
					connection.write(msg.payload);
			});
		}
	}

	static type = "tcp out";
	static {
		RED.nodes.registerType(this.type, this);
	}
}
