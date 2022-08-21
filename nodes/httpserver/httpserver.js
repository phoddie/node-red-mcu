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
import HTTPServer from "embedded:network/http/server";
import Listener from "embedded:io/socket/listener";
import TextDecoder from "text/decoder";
import TextEncoder from "text/encoder";

let server;

class Server {
	routes = [];
	id = 1; 
	requests = [];

	constructor() {
		this.server = new HTTPServer({ 
			io: Listener,
			port: 80,
			target: this,
			onConnect(connection) {
				connection.target = this.target;		//@@ httpsever ignores this
				connection.accept({
					onRequest(request) {
						trace(`${request.method} ${request.path}\n`);
						
						let path = request.path, query = {}, params = {}, j = path.indexOf("?"), node;
						if (j > 0) {
							query = parseQuery(path.slice(j + 1));
							path = path.slice(0, j);
						}

						path = path.split("/");
						path[0] = request.method;
					routes:	
						for (let i = 0, routes = this.target.routes; i < routes.length; i++) {
							const route = routes[i];
							if (route.length !== path.length)
								continue;

							for (let j = 0, length = route.length; j < length; j++) {
								if (path[j] === route[j])
									continue;
								
								if (!route[j].startsWith(":"))
									continue routes;
							}
							
							for (let j = 0, length = route.length; j < length; j++) {
								if (route[j].startsWith(":"))
									params[route[j].slice(1)] = path[j]
							}
							node = route.node;
							break routes;
						}

						this.id = ++this.target.id;
						this.node = node;
						this.target.requests.push(this);
						this.query = query;
						this.params = params;
						this.headers = {};
						for (const [name, value] of request.headers)
							this.headers[name] = value;

						const byteLength = this.headers["content-length"];
						if (undefined !== byteLength) {
							this.input = new Uint8Array(parseInt(byteLength));
							this.input.position = 0;
						}
					},
					onReadable(count) {
						this.input ??= new Uint8Array(new ArrayBuffer(0, {maxByteLength: 0x10000000}));
						if (this.input.buffer.resizable) {
							const byteLength = this.input.buffer.byteLength;
							this.input.buffer.resize(byteLength + count);
							this.input.set(new Uint8Array(this.read(count)), byteLength);
						}
						else {
							this.input.set(new Uint8Array(this.read(count)), this.input.position);
							this.input.position += count;
						}
					},
					onResponse(response) {
						if (!this.node) {
							response.status = 404;
							this.respond(response);
							return;
						}

						if (this.input) {
							const mime = this.headers["content-type"];
							if (("text/plain" === mime) || ("application/json" === mime) || ("application/x-www-form-urlencoded" == mime)) {
								this.input = (new TextDecoder).decode(this.input);
								if ("application/json" === mime) {
									try {
										this.input = JSON.parse(this.input);
									}
									catch (e) {
										this.node.error(e);
										this.close();
										return;
									}
								}
								else if ("application/x-www-form-urlencoded" === mime)
									this.input = parseQuery(this.input);
							}
							//@@ other conversions?
						}
						const msg = {
							payload: this.input,
							req: {
								headers: this.headers,
								query: this.query,
								params: this.params
							},
							res: {
								id: this.id,
							}
						};
						delete this.input;
						delete this.headers;
						delete this.query;
						this.response = response;
						this.node.send(msg);
			
					},
					onWritable(count) {
						const payload = this.payload;
						const end = Math.min(payload.position + count, payload.byteLength);
						this.write(new Uint8Array(payload, payload.position, end - payload.position));
						payload.position = end;
					},
					onDone() {
						const index = this.target.requests.findIndex(item => item.id === this.id);
						if (index >= 0)
							this.target.requests.splice(index);
					},
					onError() {
						const index = this.target.requests.findIndex(item => item.id === this.id);
						if (index >= 0)
							this.target.requests.splice(index);
						this.node.error("http server fail");
					}
				});
			}
		});
		this.server.target = this;		//@@ httpserver should do this
	}
	add(method, path, node) {
		path = path.split("/");
		path[0] = method;
		path.node = node;
		this.routes.push(path);  
	}
	respond(msg, statusCode, headers) {
		const request = this.requests.find(item => item.id === msg.res.id);
		if (!request) return;

		const response = request.response;
		let payload = msg.payload, position = 0, byteLength;
		const type = typeof payload;
		if ("string" === type) {
			payload = (new TextEncoder).encode(payload).buffer;
			byteLength = payload.byteLength;
		}
		else if (ArrayBuffer.isView(payload)) {
			position = payload.byteOffset;
			byteLength = payload.byteLength;
			payload = payload.buffer;
		}
		else if (payload instanceof ArrayBuffer)
			byteLength = payload.byteLength;
		else {
			payload = JSON.stringify(payload);
			payload = (new TextEncoder).encode(payload).buffer;
			byteLength = payload.byteLength;
		}

		request.payload = payload;
		payload.position = position;

		if (Array.isArray(headers)) {		// headers configured in the node
			for (let i = 0; i < headers.length; i++)
				response.headers.set(headers[i][0], headers[i][1]);
		}
		else {		// headers from the message
			for (let name in headers)
				response.headers.set(name, headers[name]);
		}
		response.headers.set("content-length", byteLength);
		response.status = statusCode;

		request.respond(response);
	}
}

function parseQuery(str) {
	const parts = str.split("&"), query = {};
	for (let i = 0; i < parts.length; i++) {
		const part = parts[i].split("=");
		query[decodeURIComponent(part[0])] = decodeURIComponent(part[1]);
	}
	return query;
}

class HTTPIn extends Node {
	onStart(config) {
		super.onStart(config);

		server ??= new Server;
		server.add(config.method, config.url, this);
	}

	static type = "http in";
	static {
		RED.nodes.registerType(this.type, this);
	}
}

class HTTPResponse extends Node {
	#statusCode;
	#headers;

	onStart(config) {
		super.onStart(config);
		
		this.#statusCode = config.statusCode;
		this.#headers = config.headers;
	}
	onMessage(msg) {
		if (!msg.res?.id) {
			this.error("response id missing")
			return;
		}
		const statusCode = this.#statusCode ?? msg.statusCode ?? 200;
		const headers = this.#headers ?? msg.headers ?? [];
		server.respond(msg, statusCode, headers);
		return msg;
	}

	static type = "http response";
	static {
		RED.nodes.registerType(this.type, this);
	}
}
