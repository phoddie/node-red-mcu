/*
 * Copyright (c) 2022-2024  Moddable Tech, Inc.
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
import {File, Directory} from "file";
import Timer from "timer";

// ShareFile emulates File to allows one instance of a file to be shared across several File Read & Write nodes.
// This avoids issues with file system implementation caching across instances.

let cache;

class SharedFile {
	#filename;
	position = 0;

	constructor(filename, write) {
		if (!write && !File.exists(filename))
			throw new Error("file not found: " + filename);

		this.#filename = filename;
		this.file;				// try to open file immediately, to throw from constructor if error
	}
	close() {
		if (undefined === this.#filename)
			return;

		cache.get(this.#filename)?.close();
		cache.delete(this.#filename);
		if (!cache.size)
			cache = undefined;
		this.#filename = undefined;
	}
	read(...args) {
		const file = this.file;
		file.position = this.position;
		const result = file.read(...args);
		this.position = file.position;
		return result;
	}
	write(...args) {
		const file = this.file;
		file.position = this.position;
		const result = file.write(...args);
		this.position = file.position;
		return result;
	}
	get length() {
		return this.file.length;
	}
	get file() {
		cache ??= new Map;
		let file = cache.get(this.#filename);
		if (file)
			return file;

		file = new File(this.#filename, true);
		cache.set(this.#filename, file);
		return file;
	}

	static delete(filename) {
		cache?.get(filename)?.close();
		cache?.delete(filename);
		File.delete(filename);
	}
}

class FileWrite extends Node {
	#state = {}; 

	onStart(config) {
		super.onStart(config);

		const state = this.#state;
		if (config.filename)
			state.filename = config.filename;

		state.overwriteFile = config.overwriteFile;
		if ("delete" !== config.overwriteFile) {
			if (config.appendNewline)
				state.appendNewline = config.appendNewline;
			if (config.createDir)
				state.createDir = config.createDir;
			if ("none" !== config.encoding)
				state.encoding = config.encoding;
		}
	}
	onMessage(msg) {
		let payload = msg.payload, state = this.#state
		const filename = state.filename ?? msg.filename;

		if ("delete" === state.overwriteFile) {
			SharedFile.delete(filename);
			return msg;
		}

		const type = typeof payload;
		const isBuffer = payload instanceof Uint8Array;
		const encoding = state.encoding ?? msg.encoding ?? (("object" === type) ? "binary" : "utf8");

		switch (encoding) {
			case "utf8":
				if ("object" === type)
					throw new Error;
				payload = payload.toString();
				break;
			
			case "binary":
				if (!isBuffer)
					throw new Error;
				break;

			case "base64":
				if (isBuffer)
					throw new Error;
				payload = Uint8Array.fromBase64(payload).buffer;
				break;

			case "hex":
				if (isBuffer)
					throw new Error;
				payload = Uint8Array.fromHex(payload).buffer;
				break;

			default:
				throw new Error(`unsupported encoding ${state.encoding}`);
		}

		let file;
		try {
			if (state.createDir) {
				const parts = filename.split("/");
				for (let i = 1; i <= parts.length - 1; i++) {
					const partial = parts.slice(0, i).join("/");
					if (!File.exists(partial))
						Directory.create(partial);
				}
			}

			if ("true" === state.overwriteFile)
				SharedFile.delete(filename);

			file = new SharedFile(filename, true);
			file.position = file.length;

			file.write(payload);
			if (state.appendNewline)
				file.write("\n");
			file.close();
			return msg;
		}
		catch (e) {
			file?.close();
			this.error(e, {_msgid: msg._msgid, filename});
		}
	}

	static type = "file";
	static {
		RED.nodes.registerType(this.type, this);
	}
}

class FileRead extends Node {
	#state = {};

	onStart(config) {
		super.onStart(config);

		const state = this.#state;
		if (config.filename)
			state.filename = config.filename;
		state.format = config.format;
		if (config.chunk)
			state.chunk = config.chunk;
		if ("none" !== config.encoding)
			state.encoding = config.encoding;
	}
	onMessage(msg, done) {
		let state = this.#state;
		const filename = state.filename ?? msg.filename;
		let file;
		try {
			if (!filename)
				return void done();

			msg.filename = filename;
			if (!File.exists(filename))
				return void this.error("file not found: " + filename, msg);

			file = new SharedFile(filename);
			if ("" === state.format) {
				msg.payload = new Uint8Array(file.read(ArrayBuffer));
			}
			else if ("stream" === state.format) {
				msg.parts = {
					index: 0,
					ch: "",
					id: RED.util.generateId()
				};

				msg.parts.type = "buffer";
				msg.parts.count = Math.idiv(file.length + 511, 512);

				Timer.repeat(id => {
					msg.payload = new Uint8Array(file.read(ArrayBuffer, Math.min(file.length - file.position, 512)));
					this.send(msg);
					msg.parts.index += 1;
					if (file.length <= file.position) {
						Timer.clear(id);
						file.close();
						done();
					}
				}, 1);
				return;
			}
			else if ("lines" === state.format) {
				msg.parts = {
					index: 0,
					ch: "",
					id: RED.util.generateId()
				};

				msg.parts.type = "string";
				
				let count = 256;
				Timer.repeat(id => {
					const data = new Uint8Array(file.read(ArrayBuffer, count));
					const index = data.indexOf(10);
					if (-1 === index) {
						if (file.position !== file.length) {
							file.position -= count;
							count += 256;
							return;
						}
					}
					file.position -= data.length - (index + 1);
					count = 256;
					data[index] = 0;
					msg.payload = String.fromArrayBuffer(data.buffer);
										
					if (file.length === file.position)
						msg.parts.count = msg.parts.index + 1; 
					this.send(msg);
					msg.parts.index += 1;
					if (file.length <= file.position) {
						Timer.clear(id);
						file.close();
						done();
					}
				}, 1);
				return;
			}
			else {
				switch (state.encoding) {
					case undefined:
					case "binary":
					case "utf8":
						msg.payload = file.length ? file.read(String) : "";
						break;
					case "hex":
						msg.payload = file.length ? (new Uint8Array(file.read(ArrayBuffer))).toHex() : "";
						break;
					case "base64":
						if (state.chunk)
							throw new Error;
						msg.payload = file.length ? (new Uint8Array(file.read(ArrayBuffer))).toBase64() : "";
						break;
					default:
						throw new Error("encoding unsupported: " + state.encoding)
				}
				done();
			}
			file?.close();
		}
		catch (e) {
			file?.close();
			this.error(e, {_msgid: msg._msgid, filename});
			return;
		}
		
		return msg;
	}

	static type = "file in";
	static {
		RED.nodes.registerType(this.type, this);
	}
}
