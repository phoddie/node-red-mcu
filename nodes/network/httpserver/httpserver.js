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
import TextDecoder from "text/decoder";
import TextEncoder from "text/encoder";
import config from "mc/config";

let server;

const httpRoute = Object.freeze({
	onRequest(request) {
		let path = request.path, params = {}, node;
		const query = parseQuery(request.query);

		path = path.split("/");
		path[0] = request.method;
	routes:	
		for (let i = 0, routes = server.routes; i < routes.length; i++) {
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
					params[route[j].slice(1)] = decode(path[j], false);		// Express decodes route parameters
			}
			node = route.node;
			break routes;
		}

		this.id = ++server.id;
		this.node = node;
		server.requests.push(this);
		this.method = request.method;
		this.query = query;
		this.params = params;
		this.headers = {};
		if (!this.node)
			return;		// unrouted response, so don't need headers or request body

		for (const [name, value] of request.headers)
			this.headers[name] = value;
		this.cookies = parseCookies(this.headers.cookie);

		const byteLength = this.headers["content-length"];
		if (undefined !== byteLength) {
			this.input = new Uint8Array(parseInt(byteLength));
			this.input.position = 0;
		}
	},
	onReadable(count) {
		if (!this.node)
			return void this.read(count);		// no route for request. ignore request body data.

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
			response.headers.set("content-length", 0);
			this.respond(response);
			return;
		}

		let payload;
		if ("GET" === this.method)
			payload = this.query;
		else {
			payload = parseBody(this.input, this.headers["content-type"], ("content-length" in this.headers) || ("transfer-encoding" in this.headers));
			if (undefined === payload) {		// body-parser rejects the body
				response.status = 400;
				response.headers.set("content-length", 0);
				this.respond(response);
				return;
			}
		}
		const msg = {
			payload,
			req: {
				headers: this.headers,
				query: this.query,
				params: this.params,
				cookies: this.cookies
			},
			res: {
				id: this.id
			}
		};
		delete this.input;
		delete this.headers;
		delete this.query;
		delete this.cookies;
		this.response = response;
		this.node.send(msg);

	},
	onWritable(count) {
		const payload = this.payload;		// Uint8Array
		if (!payload)
			return void this.write();
		const end = Math.min(this.position + count, payload.byteLength);
		this.write(payload.subarray(this.position, end));
		this.position = end;
	},
	onDone() {
		const index = server.requests.findIndex(item => item.id === this.id);
		if (index >= 0)
			server.requests.splice(index, 1);
	},
	onError() {
		const index = server.requests.findIndex(item => item.id === this.id);
		if (index >= 0)
			server.requests.splice(index, 1);
		this.node?.error("http server fail");
	}
});

class Server {
	static add(method, path, node, route) {
		if (!server) {
			server = new device.network.http.server.io({
				...device.network.http.server,
				port: config.noderedmcu?.httpPort ?? 80,
				onConnect(connection) {
					connection.server = this;
					connection.accept({
						onRequest(request) {
							let path = request.path, j = path.indexOf("?");
							if (j > 0)
								path = path.slice(0, j);

							path = path.split("/");
							path[0] = request.method;
						routes:
							for (let i = 0, routes = this.server.routes; i < routes.length; i++) {
								const route = routes[i];
								if (route.length !== path.length)
									continue;

								for (let j = 0, length = route.length; j < length; j++) {
									if (path[j] === route[j])
										continue;
									
									if (!route[j].startsWith(":"))
										continue routes;
								}
								
								this.node = route.node;
								this.route = route.route;
								return;
							}

							this.route = httpRoute;
						}
					});
				}
			});
			server.routes = [];
			server.id = 1; 
			server.requests = [];
		}

		path = path.split("/");
		path[0] = method;
		path.node = node;
		path.route = route;
		server.routes.push(path);  
	}
}

function decode(value, plus) {
	if (plus)
		value = value.replaceAll("+", " ");
	try {
		return decodeURIComponent(value);
	}
	catch {
		return value;
	}
}

function parseQuery(str) {		// as Express's query parser and body-parser's urlencoded (qs), without qs's bracket syntax
	const query = {};
	for (const part of (str ?? "").split("&")) {
		const j = part.indexOf("=");
		const name = decode((j < 0) ? part : part.slice(0, j), true);
		if (!name || ("__proto__" === name))
			continue;
		const value = (j < 0) ? "" : decode(part.slice(j + 1), true);
		if (!Object.hasOwn(query, name))
			query[name] = value;
		else if (Array.isArray(query[name]))		// a repeated name is an array
			query[name].push(value);
		else
			query[name] = [query[name], value];
	}
	return query;
}

function parseCookies(header) {		// as cookie-parser
	const cookies = {};
	for (const part of (header ?? "").split(";")) {
		const j = part.indexOf("=");
		if (j < 0)
			continue;
		const name = part.slice(0, j).trim();
		if (!name || ("__proto__" === name) || Object.hasOwn(cookies, name))		// the first of a repeated name
			continue;
		let value = part.slice(j + 1).trim();
		if ((value.length > 1) && ('"' === value[0]) && ('"' === value.at(-1)))
			value = value.slice(1, -1);
		value = decode(value, false);
		if (value.startsWith("j:")) {		// JSON cookie
			try {
				value = JSON.parse(value.slice(2));
			}
			catch {
			}
		}
		cookies[name] = value;
	}
	return cookies;
}

function parseContentType(value) {		// {type, subtype, suffix}, as media-typer
	const mime = (value ?? "").split(";")[0].trim().toLowerCase(), slash = mime.indexOf("/");
	if (slash <= 0)
		return {};
	let subtype = mime.slice(slash + 1), suffix;
	const plus = subtype.lastIndexOf("+");
	if (plus >= 0) {
		suffix = subtype.slice(plus + 1);
		subtype = subtype.slice(0, plus);
	}
	return {type: mime.slice(0, slash), subtype, suffix};
}

function parseBody(input, contentType, hasBody) {		// as Node-RED's HTTP In: body-parser json and urlencoded, then its rawBodyParser. undefined if rejected
	const {type, subtype, suffix} = parseContentType(contentType);
	input ??= new Uint8Array(0);
	if (hasBody && ("application" === type) && !suffix) {
		if ("json" === subtype) {
			const text = (new TextDecoder).decode(input).trim();
			if (!text)
				return {};
			if (("{" !== text[0]) && ("[" !== text[0]))		// body-parser's strict mode: only objects and arrays
				return;
			try {
				return JSON.parse(text);
			}
			catch {
				return;
			}
		}
		if ("x-www-form-urlencoded" === subtype)
			return parseQuery((new TextDecoder).decode(input));
	}

	// rawBodyParser: text unless binary by type. It means to check other application types for UTF-8, but never does.
	let text = true;
	if (type && ("text" !== type) && ("xml" !== subtype) && ("xml" !== suffix)) {
		if ("application" !== type)
			text = false;
		else if (("octet-stream" === subtype) || ("cbor" === subtype) || ("x-protobuf" === subtype))
			text = false;
	}
	return text ? (new TextDecoder).decode(input) : input;
}

class HTTPIn extends Node {
	onStart(config) {
		super.onStart(config);

		Server.add(config.method, config.url, this, httpRoute);
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

		this.#statusCode = config.statusCode;		// NaN when not set
		this.#headers = config.headers;		// [[lowercase name, value], ...] or undefined
	}
	onMessage(msg, done) {
		if (msg.res?.id)
			this.respond(msg);
		else
			this.warn("No response object");
		done();
	}
	respond(msg) {		// adapted from HTTPOut in 21-httpin.js and Express's res.send
		const request = server.requests.find(item => item.id === msg.res.id);
		if (!request) return;

		// the node's headers, then those of msg.headers the node does not set. msg.headers left unmodified from an HTTP Request response are not used.
		const headers = new Map(this.#headers);
		if (msg.headers && Object.hasOwn(msg.headers, responseMarker)) {
			const marker = msg.headers[responseMarker];
			delete msg.headers[responseMarker];
			if (marker === hashHeaders(msg.headers))
				delete msg.headers;
		}
		for (const name in msg.headers) {
			const lower = name.toLowerCase();
			if (!headers.has(lower))
				headers.set(lower, msg.headers[name]);
		}

		let payload = msg.payload, contentType, text = true;
		if (payload instanceof ArrayBuffer)
			payload = new Uint8Array(payload);
		if (ArrayBuffer.isView(payload)) {		// Buffer
			payload = new Uint8Array(payload.buffer, payload.byteOffset, payload.byteLength);
			contentType = "application/octet-stream";
			text = false;
		}
		else if (undefined === payload) {		// no body
			payload = new Uint8Array(0);
			text = false;
		}
		else {
			if ("number" === typeof payload)
				payload = String(payload);
			if ("string" === typeof payload)
				contentType = "text/html";
			else {		// objects, arrays, null, and booleans are JSON
				payload = JSON.stringify(payload);
				contentType = "application/json";
			}
			payload = (new TextEncoder).encode(payload);
		}
		if (headers.has("content-type")) {
			if (text)
				headers.set("content-type", withCharset(String(headers.get("content-type"))));
		}
		else if (contentType)
			headers.set("content-type", text ? withCharset(contentType) : contentType);

		if (msg.cookies) {
			const cookies = [];
			for (const name in msg.cookies)
				cookies.push(serializeCookie(name, msg.cookies[name]));
			if (cookies.length > 1)
				this.warn("only one cookie per response");		// the server's response headers are a Map: one set-cookie header
			if (cookies.length)
				headers.set("set-cookie", cookies[0]);
		}

		const response = request.response;
		for (const [name, value] of headers)
			response.headers.set(name, value);
		response.headers.set("content-length", payload.byteLength);
		response.status = this.#statusCode || parseInt(msg.statusCode) || 200;

		request.payload = payload;
		request.position = 0;
		request.respond(response);
	}

	static type = "http response";
	static {
		RED.nodes.registerType(this.type, this);
	}
}

const responseMarker = "x-node-red-request-node";

function hashHeaders(headers) {		// as in httprequest.js
	const s = JSON.stringify(headers);
	let h = 0x811c9dc5;
	for (let i = 0; i < s.length; i++)
		h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
	return (h >>> 0).toString(16).padStart(8, "0");
}

function withCharset(type) {		// as Express: text is UTF-8
	const parts = type.split(";").map(part => part.trim()).filter(part => part && !part.toLowerCase().startsWith("charset="));
	return [...parts, "charset=utf-8"].join("; ");
}

function serializeCookie(name, cookie) {		// as Express's res.cookie and res.clearCookie, and the cookie package's serialize
	let value, options;
	if ((null === cookie) || (null === cookie.value)) {
		value = "";
		options = {expires: new Date(1), path: "/", ...cookie};
	}
	else if ("object" === typeof cookie) {
		value = cookie.value;
		options = {...cookie};
	}
	else {
		value = cookie;
		options = {};
	}
	if ("object" === typeof value)
		value = "j:" + JSON.stringify(value);
	if (("maxAge" in options) && !isNaN(options.maxAge - 0)) {
		options.expires = new Date(Date.now() + (options.maxAge - 0));
		options.maxAge = Math.floor(options.maxAge / 1000);
	}
	else
		delete options.maxAge;
	options.path ??= "/";

	let result = name + "=" + encodeURIComponent(String(value));
	if (undefined !== options.maxAge)
		result += "; Max-Age=" + Math.floor(options.maxAge);
	if (options.domain)
		result += "; Domain=" + options.domain;
	if (options.path)
		result += "; Path=" + options.path;
	if (options.expires)
		result += "; Expires=" + options.expires.toUTCString();
	if (options.httpOnly)
		result += "; HttpOnly";
	if (options.secure)
		result += "; Secure";
	if (options.sameSite) {
		const sameSite = ("string" === typeof options.sameSite) ? options.sameSite.toLowerCase() : options.sameSite;
		if ((true === sameSite) || ("strict" === sameSite))
			result += "; SameSite=Strict";
		else if ("lax" === sameSite)
			result += "; SameSite=Lax";
		else if ("none" === sameSite)
			result += "; SameSite=None";
	}
	return result;
}

export default Server;
