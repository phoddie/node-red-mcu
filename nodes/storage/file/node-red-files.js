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

import {Node} from "nodered";
import Timer from "timer";

// ShareFile lightly wraps ECMA-419 file to allows one instance of a file to be shared across several File Read & Write nodes.
// This avoids issues with file system implementation caching across instances.

let cache;

class SharedFile {
	#path;
	position = 0;

	constructor(path, write) {
		if (!write && !SharedFile.exists(path))
			throw new Error("file not found: " + path);

		this.#path = path;
		this.file;				// open file immediately, so constructors throws if error 
	}
	close() {
		if (undefined === this.#path)
			return;

		cache.get(this.#path)?.close();
		cache.delete(this.#path);
		if (!cache.size)
			cache = undefined;
		this.#path = undefined;
	}
	read(count) {
		const file = this.file;
		const result = file.read(count, this.position);
		this.position += result.byteLength;
		return result;
	}
	write(buffer) {
		const file = this.file;
		if ("string" === typeof buffer)
			buffer = ArrayBuffer.fromString(buffer);
		file.write(buffer, this.position);
		this.position += buffer.byteLength;
	}
	get length() {
		const status = this.file.status();
		return status.size;
	}
	get file() {
		cache ??= new Map;
		let file = cache.get(this.#path);
		if (file)
			return file;

		if (SharedFile.exists(this.#path))
			file = device.files.openFile({path: this.#path, mode: "r+"});
		else
			file = device.files.openFile({path: this.#path, mode: "w+"});
		cache.set(this.#path, file);
		return file;
	}

	static delete(path) {
		cache?.get(path)?.close();
		cache?.delete(path);
		device.files.delete(path);
	}
	static exists(path) {
		const status = device.files.status(path);
		return status.isFile();
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
			if (("none" !== config.encoding) && ("setbymsg" !== config.encoding))
				state.encoding = config.encoding;
		}
	}
	onMessage(msg) {
		let payload = msg.payload, state = this.#state
		const filename = state.filename ?? msg.filename;

		if ("delete" === state.overwriteFile) {
			if (!SharedFile.exists(filename))
				return void this.error("file not found: " + filename, msg);
			SharedFile.delete(filename);
			return msg;
		}

		const type = typeof payload;
		const isBuffer = payload instanceof Uint8Array;
		if (("object" === type) && !isBuffer)
			payload = JSON.stringify(payload);
		else if (("number" === type) || ("boolean" === type))
			payload = payload.toString();
		const encoding = state.encoding ?? msg.encoding ?? (isBuffer ? "binary" : "utf8");

		let file;
		try {
			switch (encoding) {
				case "utf8":
					if (!isBuffer)
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
					throw new Error(`unsupported encoding ${encoding}`);
			}

			if (state.createDir) {
				const parts = filename.split("/");
				for (let i = 1; i <= parts.length - 1; i++) {
					const partial = parts.slice(0, i).join("/");
					if (!SharedFile.exists(partial))
						device.files.createDirectory(partial);
				}
			}

			if ("true" === state.overwriteFile)
				SharedFile.delete(filename);

			file = new SharedFile(filename, true);
			file.position = file.length;

			file.write(payload);
			if (state.appendNewline && !isBuffer)
				file.write("\n");
			file.close();
			return msg;
		}
		catch (e) {
			file?.close();
			this.error(e, msg);
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
			if (!SharedFile.exists(filename))
				return void this.error("file not found: " + filename, msg);

			file = new SharedFile(filename);
			if ("" === state.format) {
				const length = file.length;
				msg.payload = length ? (new Uint8Array(file.read(length))) : (new Uint8Array(0));
			}
			else if ("stream" === state.format) {
				if (!file.length) {
					file.close();
					return void done();
				}

				msg.parts = {
					index: 0,
					ch: "",
					id: RED.util.generateId()
				};

				msg.parts.type = "buffer";
				msg.parts.count = Math.idiv(file.length + 511, 512);

				Timer.repeat(id => {
					msg.payload = new Uint8Array(file.read(Math.min(file.length - file.position, 512)));
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
					ch: "\n",
					id: RED.util.generateId()
				};

				msg.parts.type = "string";

				if (!file.length) {
					msg.payload = "";
					msg.parts.count = 1;
					file.close();
					done();
					return msg;
				}

				let count = 256;
				Timer.repeat(id => {
					if (file.position === file.length) {		// EOF is newline or empty file
						msg.payload = "";
						msg.parts.count = msg.parts.index + 1;
						this.send(msg);
						Timer.clear(id);
						file.close();
						done();
						return;
					}
					const data = new Uint8Array(file.read(count));
					let index = data.indexOf(10);
					if (-1 === index) {
						if (file.position !== file.length) {
							file.position -= data.length;
							count += 256;
							return;
						}
						index = data.length;	 // last line terminates at EOF
						msg.parts.count = msg.parts.index + 1;
					}
					else
						file.position -= data.length - (index + 1);
					count = 256;
					msg.payload = String.fromArrayBuffer(data.buffer, 0, index);
					this.send(msg);
					msg.parts.index += 1;
					if (undefined !== msg.parts.count) {
						Timer.clear(id);
						file.close();
						done();
					}
				}, 1);
				return;
			}
			else {
				const length = file.length;
				switch (state.encoding) {
					case undefined:
					case "binary":
					case "utf8":
						msg.payload = length ? String.fromArrayBuffer(file.read(length)) : "";
						break;
					case "hex":
						msg.payload = length ? (new Uint8Array(file.read(length))).toHex() : "";
						break;
					case "base64":
						if (state.chunk)
							throw new Error;
						msg.payload = length ? (new Uint8Array(file.read(length))).toBase64() : "";
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
			this.error(e, msg);
			return;
		}
		
		return msg;
	}

	static type = "file in";
	static {
		RED.nodes.registerType(this.type, this);
	}
}
