/*
 * Copyright (c) 2022-2023  Moddable Tech, Inc.
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
import fetch from "fetch";
import {Headers} from "fetch";
import {URLSearchParams} from "url";
import Mustache from "mustache";

class HTTPRequestNode extends Node {
	#options;
	#format; 
	#paytoqs;
	#persist;
	#senderr;

	onStart(config) {
		super.onStart(config);

		if (config.proxy || config.authType /* || config.senderr */)
			throw new Error("unimplemented");

		this.#format = config.ret;
		this.#paytoqs = config.paytoqs;
		this.#persist = config.persist;
		this.#senderr = config.senderr;
		this.#options = {
			method: config.method,
			url: config.url
		};
		if (config.tls) {
			const options = RED.nodes.getNode(config.tls)?.options ?? {};
			const tls = {
				verify: options.verifyservercert ?? true
			};
			if (options.alpnprotocol)
				tls.applicationLayerProtocol = options.alpnprotocol;
			if (options.servername)
				tls.host = options.servername;		// HTTPS client defaults tls.host to the URL host
			if (options.ca)
				tls.ca = options.ca;
			if (options.cert) {
				tls.clientCertificate = options.cert;
				if (options.key)
					tls.clientKey = options.key;
			}
			this.#options.embedded = Object.freeze({tls: Object.freeze(tls)});
		}
	}
	onMessage(msg) {
		const headers = new Headers([
			["User-Agent", "node-red-mcu/v0"]
		]);
		headers.set("Connection", this.#persist ? "keep-alive" : "close");		//@@ not sure
		for (let name in msg.headers)
			headers.set(name, msg.headers[name]);
//		let body = ("ignore" === this.#paytoqs) ? undefined : msg.payload;		//@@ what does paytoqs do?? 
		let body = msg.payload;
		let url = msg.url;
		if (this.#options.url) {
			url = this.#options.url;
			if (url.indexOf("{{") >= 0)
				url = Mustache.render(url, msg)
		}
		const options = {
			method: msg.method ?? this.#options.method ?? "GET",
			headers
		}
		if (undefined !== body) {
			if ("object" === typeof body) {
				if (!(body instanceof ArrayBuffer)) {
					if ("query" === this.#paytoqs) {
						url += (url.indexOf("?") < 0) ? "?" : "&";
						url += (new URLSearchParams(Object.entries(body))).toString(); 
					}
					else {
						body = JSON.stringify(body);
						headers.set("content-type", "application/json");
					}
				}
			}
			else
				body = body.toString();

			options.body = body;
		}

		if (!url.startsWith("http:") && !url.startsWith("https:"))
			url = (this.#options.embedded ? "https://" : "http://") + url;

		if (this.#options.embedded)
			options.embedded = this.#options.embedded;

		fetch(url, options)
		.then(response => {
			msg.statusCode = response.status;
			msg.headers = {/* ["x-node-red-request-node"]: this.id */};		//@@ what is this?
			response.headers.forEach((value, key) => {msg.headers[key] = value;});

			if (("txt" === this.#format) || ("obj" === this.#format))
				return response.text();
			if ("bin" === this.#format)
				return response.arrayBuffer();
			throw new Error("unexpected http request format");
		})
		.then(payload => {
			msg.payload = payload;
			if ("obj" === this.#format) {
				try {
					msg.payload = JSON.parse(payload);
				}
				catch {		// if parse fails, node sends unparsed text
				}
			}
			this.send(msg);
		})
		.catch(e => {
			this.error(e, msg);
			msg.payload = `${e} : ${url}`;
			msg.statusCode = e.code;
			if (!this.#senderr)
				this.send(msg);
		});
	}

	static type = "http request";
	static {
		RED.nodes.registerType(this.type, this);
	}
}
