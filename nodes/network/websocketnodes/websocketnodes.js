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

import {Node, configFlowID} from "nodered";
import Timer from "timer";
import WebSocket from "WebSocket";
import Modules from "modules";

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

function toMessage(data, wholemsg, id) {		// adapted from handleEvent in 22-websocket.js
	let msg;
	if (wholemsg) {
		try {
			msg = JSON.parse(("string" === typeof data) ? data : String.fromArrayBuffer(data));
			if ((null === msg) || ("object" !== typeof msg))		// Node-RED throws for null
				msg = {payload: msg};
		}
		catch {
		}
	}
	msg ??= {payload: ("string" === typeof data) ? data : new Uint8Array(data)};
	msg._session = {type: "websocket", id};
	return msg;
}

function toPayload(msg, wholemsg) {		// adapted from WebSocketOutNode in 22-websocket.js: undefined when nothing to send
	if (wholemsg)
		return JSON.stringify({...msg, _session: undefined});
	if (Object.hasOwn(msg, "payload")) {
		const payload = msg.payload;
		if (payload instanceof Uint8Array)		// Node-RED requires a Buffer
			return payload;
		return RED.util.ensureString(payload) || undefined;		// empty string is not sent
	}
}

class WebSocketClient extends Node {
	#ws;
	#reconnect;
	#options;
	#nodes;
	#tls;

	onStart(config) {
		if (config.tls)
			this.#tls = RED.nodes.getNode(config.tls);

		this.#options = {
			path: config.path,
			wholemsg: "true" === config.wholemsg,
			subprotocol: config.subprotocol,
			keepalive: config.hb ? (1000 * parseInt(config.hb)) : 0,
		};

		this.status({...disconnected});

		Timer.set(() => this.#connect());
	}
	onMessage(msg, done) {
		const payload = toPayload(msg, this.#options.wholemsg);
		if ((undefined !== payload) && ("websocket" !== msg._session?.type) && (1 === this.#ws?.readyState))
			this.#ws.send(payload);
		done();
	}
	#connect() {
		let wss;
		if (this.#tls) {
			if (!device.io.TLS)
				throw new Error("TLS socket unavailable");

			const options = this.#tls.options ?? {};
			const tls = {
				applicationLayerProtocol: options.alpnprotocol ?? "http/1.1",		// handshake is HTTP/1.1 upgrade
				verify: options.verifyservercert ?? true
			};
			if (options.servername)
				tls.host = options.servername;		// WebSocket Client defaults tls.host to the URL host
			if (options.ca)
				tls.ca = options.ca;
			if (options.cert) {
				tls.clientCertificate = options.cert;
				if (options.key)
					tls.clientKey = options.key;
			}
			wss = {
				...device.network.ws,
				socket: {
					io: device.io.TLS,
					TCP: device.network.ws.socket,
					tls
				}
			};
		}

		const options = this.#options, o = {};
		if (wss) o.wss = wss;
		({path: o.url, subprotocol: o.protocol, keepalive: o.keepalive} = options);		// WebSocket() option is "protocol"
		this.#ws = new WebSocket(o);
		this.#ws.binaryType = "arraybuffer"; 
		this.#ws.addEventListener("open", () => {
			Timer.clear(this.#reconnect);
			this.#reconnect = undefined;
			this.status({...connected});
		});
		if (this.#nodes) {
			const id = RED.util.generateId();		// connection id
			this.#ws.addEventListener("message", event => {
				const msg = toMessage(event.data, this.#options.wholemsg, id);
				for (let node of this.#nodes)
					node.send(msg);
			});
		}
		const close = () => {
			this.#ws = undefined;
			this.status({...disconnected});

			this.#reconnect ??= Timer.repeat(() => {
				if (this.#ws)
					return;
				
				this.#connect();
			}, 5_000);
		}
		this.#ws.addEventListener("close", close);
		this.#ws.addEventListener("error", close);
	}
	add(node) {
		this.#nodes ??= new Set;
		this.#nodes.add(node);
	}
	status(status) {
		const nodes = this.#nodes;
		if (!nodes) return;
		for (let node of nodes)
			node.status(status);
	}

	static type = "websocket-client";
	static {
		RED.nodes.registerType(this.type, this);
	}
}

class WebSocketListener extends Node {
	#wholemsg;
	#connections = new Map;		// remote connections to this listener
	#nodes;		// "websocket in" nodes using this listener

	onStart(config) {
		this.#wholemsg = "true" === config.wholemsg;

		const Server = Modules.importNow("httpserver");		// dynamic import so dependency on http server only if websocket listener is used 
		const WebSocketHandshake = Modules.importNow("embedded:network/http/server/route/ws/handshake");

		Server.add("GET", config.path, this, {
			...WebSocketHandshake,
			listener: this,
			onDone() {
				const listener = this.route.listener;
				const ws = new WebSocket({attach: this.detach()});
				ws._session = RED.util.generateId();
				listener.#connections.set(ws._session, ws);
				ws.addEventListener("message", function(event) {
					const nodes = listener.#nodes;
					if (!nodes)
						return;
					const msg = toMessage(event.data, listener.#wholemsg, ws._session);
					for (let node of nodes)
						node.send(msg);
				});
				const remove = function() {
					listener.#connections.delete(ws._session);
				}
				ws.addEventListener("close", remove);
				ws.addEventListener("error", remove);
			}
		});
	}
	onMessage(msg, done) {
		const payload = toPayload(msg, this.#wholemsg);
		if (undefined !== payload) {
			const session = msg._session;
			if ("websocket" === session?.type)
				this.#connections.get(session.id)?.send(payload);
			else {
				for (const connection of this.#connections.values())
					connection.send(payload);
			}
		}
		done();
	}
	add(node) {
		this.#nodes ??= new Set;
		this.#nodes.add(node);
	}

	static type = "websocket-listener";
	static {
		RED.nodes.registerType(this.type, this);
	}
}

class WebSocketIn extends Node {
	onStart(config) {
		super.onStart(config);

		const ws = flows.get(configFlowID).getNode(config.client || config.server);
		ws?.add(this);
	}

	static type = "websocket in";
	static {
		RED.nodes.registerType(this.type, this);
	}
}

class WebSocketOut extends Node {
	#ws;

	onStart(config) {
		super.onStart(config);

		this.#ws = flows.get(configFlowID).getNode(config.client || config.server);
	}
	onMessage(msg, done) {
		return this.#ws.onMessage(msg, done);		// maybe unnecessary to use RED.mcu.enqueue here
	}

	static type = "websocket out";
	static {
		RED.nodes.registerType(this.type, this);
	}
}
