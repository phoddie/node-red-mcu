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

import {Node} from "nodered";
import Modules from "modules";
import URL from "url";
// runtime import of "httpserver" and "ota"

// curl http://127.0.0.1/ota -X PUT -H "Content-Type: application/octet-stream" --data-binary '@xs_esp32.bin'

class OTAUpdateNode extends Node {
	#client;
	#ota;

	onStart(config) {
		super.onStart(config);

		if (!Modules.has("ota"))
			return void this.status({fill: "red", shape: "ring", text: "OTA not supported"});

		if (config.path) {
			if (!Modules.has("httpserver"))
				return void this.status({fill: "red", shape: "ring", text: "no httpserver!"});

			const Server = Modules.importNow("httpserver");
			Server.add("PUT", config.path.startsWith("/") ? config.path : ("/" + config.path), this, route);
		}
	}
	onMessage(msg, done) {
		if (!msg.url)
			return void done();

		const url = new URL(msg.url);
		if ("http:" !== url.protocol)
			return void done("http only");
		const options = {
			...device.network.http,
			host: url.hostname
		};
		if (url.port)
			options.port = parseInt(url.port); 
		this.#client = new device.network.http.io(options); 
		const request = this.#client.request({
			path: url.pathname,
			onHeaders(status, headers) {
				if (2 !== Math.idiv(status, 100))
					return void done("request failed with status " + status);

				this.node.begin(headers, done);
			},
			onReadable(count) {
				this.node.append(this, count);
			},
			onDone(error) {
				if (this.node.end(error, done)) {
					msg.payload = "ota pull";
					this.node.send(msg);
				}
			}
		});
		request.node = this;
		this.status({fill: "yellow", shape: "ring", text: "node-red:common.status.connecting"});
	}
	begin(headers, done) {
		if (this.#ota)
			return void done?.("OTA update already in progress");

		this.status({fill: "green", shape: "dot", text: "node-red:common.status.connected"});
		const total = headers.get("content-length");
		if (undefined !== total)
			this.total = parseInt(total);
		this.received = 0;

		try {
			const OTA = Modules.importNow("ota");
			this.#ota = new OTA
		}
		catch (e) {
			e = e.toString();
			this.status({fill: "red", shape: "ring", text: e});
			this.#client?.close();
			this.#client = undefined;
			done?.(e);
		}
	}
	append(from, count) {
		const data = from.read(count);
		this.#ota?.write(data);

		this.received += count;
		if (undefined === this.total)
			this.status({fill: "green", shape: "dot", text: this.received + " bytes"});
		else {
			const percent = Math.round((this.received / this.total) * 10000) / 100;
			this.status({fill: "green", shape: "dot", text: percent + "%"});
		}
	}
	end(error, done) {
		let success = error ? false : true;

		if (!this.#ota)
			success = false;
		else if (error) {
			error = error.toString();
			this.#ota.cancel();
			this.status({fill: "red", shape: "ring", text: error.toString()});
			done?.(error);
		}
		else {
			try {
				this.#ota.complete();
				this.status({fill: "green", shape: "dot", text: "success"});
			}
			catch (e) {
				error = e;
				this.status({fill: "red", shape: "ring", text: error.toString()});
				success = false;
			}
			done?.(error);
		}
		this.#client?.close();
		this.#client = this.#ota = undefined;
		
		return success;
	}

	static type = "ota-update";
	static {
		RED.nodes.registerType(this.type, this);
	}
}

const route = Object.freeze({
	onRequest(request) {
		this.node.begin(request.headers);
	},
	onReadable(count) {
		this.node.append(this, count);
	},
	onResponse(response) {
		const success = this.node.end(null);

		response.status = success ? 200 : 500; 
		this.respond(response);

		if (success)
			this.node.send({payload: "ota push"});
	},
	onError(e) {
		this.node.end(e ?? new Error("OTA failed"));
	}
});
