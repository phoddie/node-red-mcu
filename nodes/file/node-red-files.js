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
import {File, Directory} from "file";
import config from "mc/config";
import Base64 from "base64";
import Hex from "hex";
import Timer from "timer";

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

		if ("delete" === state.overwriteFile) {
			File.delete(state.filename ?? msg.filename);
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
				payload = Base64.decode(payload);
				break;

			case "hex":
				if (isBuffer)
					throw new Error;
				payload = Hex.toBuffer(payload);
				break;

			default:
				throw new Error(`unsupported encoding ${state.encoding}`);
		}

		let file = state.file;
		try {
			if (!file) {
				const filename = state.filename ?? msg.filename;

				if (state.createDir) {
					const parts = filename.split("/");
					for (let i = 1; i <= parts.length - 1; i++) {
						const partial = parts.slice(0, i).join("/");
						if (!File.exists(partial))
							Directory.create(partial);
					}
				}

				if ("true" === state.overwriteFile)
					File.delete(filename);

				file = new File(filename, true);
				file.position = file.length;
			}

			file.write(payload);
			if (state.appendNewline)
				file.write("\n");
		}
		catch (e) {
			this.error(e);
		}

		if (!state.filename)
			file.close();
		else
			state.file = file;

		return msg;
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
	onMessage(msg) {
		let payload, state = this.#state;
		const filename = state.filename ?? msg.filename;
		let file;
		try {
			file = new File(filename);
			if ("" === state.format) {
				msg.payload = file.read(ArrayBuffer);
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
					msg.payload = file.read(ArrayBuffer, Math.min(file.length - file.position, 512));
					this.send(msg);
					msg.parts.index += 1;
					if (file.length <= file.position) {
						Timer.clear(id);
						file.close();
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
						msg.payload = file.length ? Hex.toString(file.read(ArrayBuffer)) : "";
						break;
					case "base64":
						if (state.chunk)
							throw new Error;
						msg.payload = file.length ? Base64.encode(file.read(ArrayBuffer)) : "";
						break;
					default:
						throw new Error("encoding unsupported: " + state.encoding)
				}
			}
			file?.close();
		}
		catch (e) {
			file?.close();
			this.error(e);
			return;
		}
		
		return msg;
	}

	static type = "file in";
	static {
		RED.nodes.registerType(this.type, this);
	}
}
