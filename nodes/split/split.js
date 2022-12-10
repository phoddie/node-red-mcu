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

 class SplitNode extends Node {
	#arraySplt;
	#splt;
	#spltType;
	#addname;
	#stream;

	onStart(config) {
		super.onStart(config);

		this.#spltType = config.spltType;
		this.#splt = config.splt;
		this.#arraySplt = config.arraySplt;
		this.#addname = config.addname;
		if (config.stream)
			this.#stream = {};
	}
	onMessage(msg, done) {
		let payload = msg.payload; 
		let stream = this.#stream;

		if (payload instanceof Uint8Array) {
			let splt = this.#splt;
			if ("str" === this.#spltType)
				splt = new Uint8Array(ArrayBuffer.fromString(splt));

			if (stream) {
				stream.buf ??= {dones: [], index: 0};
				stream = stream.buf;   
				if (stream.remainder)
					payload = Buffer.concat([stream.remainder, payload]);

				const length = payload.length;
				if ("len" === this.#spltType) {
					if (length < splt) {
						stream.remainder = payload;
						stream.dones.push(done);
						return;
					}
					const i = length % splt;
					if (i) {
						stream.remainder = Uint8Array.prototype.slice.call(payload, length - i); 
						payload = payload.subarray(0, length - i);
					}
					else
						delete stream.remainder;
				}
				else {
					const i = Buffer.prototype.lastIndexOf.call(payload, splt);
					if (i < 0) {
						stream.remainder = payload;
						stream.dones.push(done);
						return;
					}
					if ((i + splt.length) !== length) {
						stream.remainder = Uint8Array.prototype.slice.call(payload, i + splt.length); 
						payload = payload.subarray(0, i);
					}
					else {
						delete stream.remainder;
						payload = payload.subarray(0, i);
					}
				}
			}

			const parts = {type: "buffer", id: RED.util.generateId()};
			msg.parts = parts;

			if (stream)
				parts.index = stream.index;
			else
				parts.index = 0;

			if ("len" === this.#spltType) {
				const length = payload.length;
				parts.ch = splt;
				if (!stream)
					parts.count = Math.idiv((length + splt - 1), splt); 
				for (let i = 0; i < length; i += splt) {
					msg.payload = Uint8Array.prototype.slice.call(payload, i, i + splt);
					parts.index += 1;
					this.send(msg);
				}
			}
			else if (("bin" === this.#spltType) || ("str" === this.#spltType)) {
				const b = payload;
				parts.ch = splt; 
				payload = [];
				let position = 0;
				while (position < b.length) {
					let next = Buffer.prototype.indexOf.call(b, splt, position);
					if (next < 0)
						next = b.length;
					payload.push(Uint8Array.prototype.slice.call(b, position, next));
					position = next + splt.byteLength; 
				}
				let length = payload.length;
				if (!stream)
					parts.count = length; 
				for (let i = 0; i < length; i += 1) {
					msg.payload = payload[i]
					parts.index += 1;
					this.send(msg);
				}
			}
			if (stream)
				stream.index = parts.index;
		}
		else if (Array.isArray(payload)) {
			const length = payload.length, arraySplt = this.#arraySplt;
			const parts = {type: "array", count: Math.idiv(length + arraySplt - 1, arraySplt), len: arraySplt, id: RED.util.generateId()};
			msg.parts = parts;
			for (let i = 0; i < length; i += arraySplt) {
				msg.payload = (1 === arraySplt) ? payload[i] : payload.slice(i, i + arraySplt);
				parts.index = Math.idiv(i, arraySplt);
				this.send(msg);
			}
		}
		else if ("object" === typeof payload) {
			const names = Object.getOwnPropertyNames(payload);
			const length = names.length;
			const parts = {type: "object", count: length, id: RED.util.generateId()};
			msg.parts = parts;
			for (let i = 0, addname = this.#addname; i < length; i += 1) {
				const key = names[i];
				msg.payload = payload[key];
				parts.index = i;
				parts.key = key;
				if (addname)
					msg[addname] = key;
				this.send(msg);
			}
		}
		else {	// string

			payload = payload.toString();
			let splt = this.#splt;
			if ("bin" === this.#spltType)
				splt = String.fromArrayBuffer(splt)

			if (stream) {
				stream.str ??= {dones: [], index: 0};
				stream = stream.str;   
				if (stream.remainder)
					payload = stream.remainder + payload;

				const length = payload.length;
				if ("len" === this.#spltType) {
					if (length < splt) {
						stream.remainder = payload;
						stream.dones.push(done);
						return;
					}
					const i = length % splt;
					if (i) {
						stream.remainder = payload.slice(length - i); 
						payload = payload.slice(0, length - i);
					}
					else
						delete stream.remainder;
				}
				else {
					const i = payload.lastIndexOf(splt);
					if (i < 0) {
						stream.remainder = payload;
						stream.dones.push(done);
						return;
					}
					if ((i + splt.length) !== length) {
						stream.remainder = payload.slice(i + splt.length); 
						payload = payload.slice(0, i);
					}
					else {
						delete stream.remainder;
						payload = payload.slice(0, i);
					}
				}
			} 

			if ("len" === this.#spltType) {
				const s = payload, length = s.length;
				payload = new Array(Math.idiv(length + splt - 1, splt));
				payload.fill(undefined);
				for (let i = 0, j = 0; i < length; i += splt, j += 1)
					payload[j] = s.slice(i, i + splt);
			}
			else
				payload = payload.split(splt);

			const length = payload.length;
			const parts = {type: "string", ch: splt, id: RED.util.generateId()};
			if (stream) {
				parts.index = stream.index;
				stream.index = parts.index + length;
			}
			else {
				parts.count = length;
				parts.index = 0;
			}
			msg.parts = parts;
			for (let i = 0; i < length; i += 1) {
				msg.payload = payload[i];
				this.send(msg);
				parts.index += 1;
			}
		}

		if (stream) {
			stream.dones.forEach(done => done());
			if (stream.remainder) {
				stream.dones.length = 1;
				stream.dones[0] = done;
			}
			else {
				stream.dones.length = 0;
				done();
			}
		}
		else
			done();
	}

	static type = "split";
	static {
		RED.nodes.registerType(this.type, this);
	}
}
