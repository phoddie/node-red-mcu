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
import CertificateManager from "ssl/cert";

class HTTPRequestNode extends Node {
	#options;
	#format; 
	#paytoqs;
	#persist;

	onStart(config) {
		super.onStart(config);

		if (config.proxy || config.authType /* || config.senderr */)
			throw new Error("unimplemented");

		this.#format = config.ret;
		this.#paytoqs = config.paytoqs;
		this.#persist = config.persist;
		this.#options = {
			method: config.method,
			url: config.url
		};
		if (config.tls)
			this.#options.tls = RED.nodes.getNode(config.tls);
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
			url = (this.#options.tls ? "https://" : "http://") + url;

		if (url.startsWith("https://")) {
			if (false === this.#options.tls?.options?.verifyservercert)
				throw new Error("cannot skip server cert validation yet")
	
			const ca = this.#options.tls?.options?.ca;
			if (ca)
				CertificateManager.register(ca);
		}

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
			this.send(msg);
		});
	}

	static type = "http request";
	static {
		RED.nodes.registerType(this.type, this);
	}
}
