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

import {Node, configFlowID} from "nodered";
import Timer from "timer";
import WebSocket from "WebSocket";

const connected = Object.freeze({
	fill: "green",
	shape: "dot",
	text: "connected ",
	event: "connect"
});

const disconnected = Object.freeze({
	fill: "red",
	shape: "ring",
	text: "common.status.disconnected",
	event: "disconnect"
});

class WebSocketClient extends Node {
	#ws;
	#reconnect;
	#options;
	#nodes;

	onStart(config) {
		if (config.tls || ("0" !== config.hb))
			throw new Error("unimplemented");		

		this.#options = {
			path: config.path,
			wholemsg: "true" === config.wholemsg,
			subprotocol: config.subprotocol
		};

		this.status(disconnected);
		this.#connect();
	}
	onMessage(msg) {
		if (1 !== this.#ws?.readyState)
			return;

		if (this.#options.wholemsg)
			this.#ws.send(JSON.stringify(msg));
		else
			this.#ws.send(msg.payload);
	}
	onStop() {
		this.#ws.close();
		this.#ws = undefined;
		Timer.clear(this.#reconnect);
		this.#reconnect = undefined;
		this.#nodes = undefined;
	}
	#connect() {
		const options = this.#options;
		this.#ws = options.subprotocol ? new WebSocket(options.path, options.subprotocol) : new WebSocket(options.path);
		this.#ws.binaryType = "arraybuffer"; 
		this.#ws.addEventListener("open", event => {
			Timer.clear(this.#reconnect);
			this.#reconnect = undefined;
			this.status(connected);
		});
		this.#ws.addEventListener("message", event => {
			let msg = event.data;
			if (this.#options.wholemsg)
				msg = JSON.parse(msg);
			else
				msg = {payload: msg};

			for (let node of this.#nodes)
				node.send(msg);
		});
		const close = event => {
			this.#ws = undefined;
			this.status(disconnected);

			this.#reconnect = Timer.repeat(() => {
				if (this.#ws)
					return;
				
				this.#connect();
			}, 5_000);
		}
		this.#ws.addEventListener("close", close);
		this.#ws.addEventListener("error", close);
	}
	add(node) {
		this.#nodes = new Set;
		this.#nodes.add(node);
	}
	remove(node) {
		this.#nodes?.delete(node);
	}
	status(status) {
		for (let node of this.#nodes)
			node.status(status);
	}

	static type = "websocket-client";
	static {
		RED.nodes.registerType(this.type, this);
	}
}

class WebSocketIn extends Node {
	#client;

	onStart(config) {
		this.#client = flows.get(configFlowID).getNode(config.client);
		this.#client?.add(this);
	}

	static type = "websocket in";
	static {
		RED.nodes.registerType(this.type, this);
	}
}

class WebSocketOut extends Node {
	#client;

	onStart(config) {
		this.#client = flows.get(configFlowID).getNode(config.client);
		this.#client?.add(this);
	}
	onMessage(msg) {
		return this.#client.onMessage(msg);
	}

	static type = "websocket out";
	static {
		RED.nodes.registerType(this.type, this);
	}
}
