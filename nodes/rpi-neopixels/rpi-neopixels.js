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
import Timer from "timer";
import NeoPixel from "neopixel";
import colors from "colors";

class NeopixelsNode extends Node {
	#np;
	#fgnd;
	#bgnd;
	#mode;
	#wipe;
	#needle;

	onStart(config) {
		super.onStart(config);

		this.#mode = config.mode;
		
		if (config.wipe) {
			this.#wipe = Timer.repeat(function(wipe) {
				const wipers = wipe.wipers; 
				if (!wipers[0]())
					return;
				wipers.shift();
				if (!wipers.length)
					Timer.schedule(wipe);
			}, 100, 100);
			Timer.schedule(this.#wipe);
			this.#wipe.interval = config.wipe;
			this.#wipe.wipers = [];
		}

		if (1 === config.bgnd.split(',').length)
			this.#bgnd = colors.getRGB(config.bgnd);
		else
			this.#bgnd = config.bgnd;

		if (1 === config.fgnd.split(',').length)
			this.#fgnd = colors.getRGB(config.fgnd);
		else
			this.#fgnd = config.fgnd;

		if (globalThis.lights)		// for compatibility with hosts that create the NeoPixel driver (M5Atom-Matrix) 
			this.#np = globalThis.lights;
		else
			this.#np = new NeoPixel({length: config.pixels, pin: parseInt(config.gpio), order: config.rgb.toUpperCase()});

		this.#bgnd = this.#np.makeRGB(...this.#bgnd.split(","));
		this.#fgnd = this.#np.makeRGB(...this.#fgnd.split(","));
		this.#needle = this.#np.makeRGB(255, 255, 255); 

		if (!this.#mode.startsWith("shift")) {
			this.#np.fill(this.#bgnd);
			this.#np.update();
		}
	}
	onMessage(msg, done) {
		if (undefined !== msg.brightness) {
			if (this.#wipe) {
				brightness = parseFloat(msg.brightness) / 100 * 255;
				this.push(() => {
					this.#np.brightness = brightness;
					return true;				
				})
			}
			else
				this.#np.brightness = brightness;
		}

		if (undefined === msg.payload)
			return void done();

		let payload = msg.payload.toString();
		const parts = payload.split(",");
		switch (parts.length) {
			case 1:
				if (isNaN(payload)) { // it's a single colour word so set background
					const color = colors.getRGB(payload);
					if (!color) {
						this.warn("Invalid payload: " + payload);
						return void done();
					}

					this.#bgnd = this.#np.makeRGB(...color.split(","));
					this.fill(this.#bgnd);
				}
				else { // it's a single number so just draw bar
					let ll = Number(payload);
					if (ll < 0)
						ll = 0;
					if (this.#mode.indexOf("pcent") >= 0) {
						ll = Math.round(ll / 100 * this.#np.length + 0.5);
						ll = Math.min(ll, 100);
					}
					else
						ll = Math.min(ll, this.#np.length - 1);
					ll = ll - 1;
					if (this.#mode.indexOf("need") >= 0) {
						this.fill(this.#bgnd, 0, ll);
						this.setPixel(ll, this.#needle);
						this.fill(this.#bgnd, ll + 1, this.#np.length);
					}
					else {
						this.fill(this.#fgnd, 0, ll);
						this.fill(this.#bgnd, ll + 1, this.#np.length);
					}
				}
				break;

			case 2: {	 // it's a colour and length
				if (isNaN(parseInt(parts[1])))
					parts = parts.reverse();
					
				let color = colors.getRGB(parts[0]); 				
				if (!color) {
					this.warn("Invalid color: " + payload);
					return void done();
				}
				color = this.#np.makeRGB(...color.split(","));

				let l = Number(parts[1]);
				if (this.#mode.indexOf("pcent") >= 0)
					l = Math.round(l / 100 * this.#np.length + 0.5);
				l = l - 1;
				if (this.#mode.indexOf("need") >= 0) {
					this.#needle = color;

					this.fill(this.#bgnd, 0, l);
					this.setPixel(l, this.#needle);
					this.fill(this.#bgnd, l + 1, this.#np.length);
				}
				else {
					this.#fgnd = color;

					this.fill(this.#fgnd, 0, l);
					this.fill(this.#bgnd, l + 1, this.#np.length);
				}
				} break;

			case 3: {		// RGB triple -- either shift or fill
				const color = this.#np.makeRGB(parts[0], parts[1], parts[2]);
				this.#bgnd = color;

				if ("shiftu" === this.#mode) {
					if (!this.#wipe) { 
						const pixels = new Uint8Array(this.#np);
						pixels.copyWithin(3, 0, 3 * (pixels.length - 1));
						this.setPixel(0, color);
						return void done();
					}

					let i = 0, c = color;
					this.#wipe.wipers.push(() => {
						const prev = c;
						c = this.#np.getPixel(i);

						this.#np.setPixel(i++, prev);
						this.#np.update();
						return i >= this.#np.length;
					});
					if (1 === this.#wipe.wipers.length)
						Timer.schedule(this.#wipe, 0, this.#wipe.interval);
				}
				else if ("shiftd" === this.#mode) {
					if (!this.#wipe) { 
						const pixels = new Uint8Array(this.#np);
						pixels.copyWithin(0, 3, 3 * (pixels.length - 1));
						this.setPixel(this.#np.length - 1, color);
						return void done();
					}

					let i = this.#np.length - 1, c = color;
					this.#wipe.wipers.push(() => {
						const prev = c;
						c = this.#np.getPixel(i);

						this.#np.setPixel(i--, prev);
						this.#np.update();
						return i < 0;
					});
					if (1 === this.#wipe.wipers.length)
						Timer.schedule(this.#wipe, 0, this.#wipe.interval);
				}
				else
					this.fill(color);
				} break;

			case 4:	// set nth pixel: n, r, g, b
				if (!this.#mode.startsWith("p"))
					return void done();
				this.setPixel(parts[0], this.#np.makeRGB(parts[1], parts[2], parts[3]));
				break;

			case 5: {		// set pixels x through y: x, y, r, g, b
				if (!this.#mode.startsWith("p"))
					return void done();
				const x = parseInt(parts[0]), y = parseInt(parts[1]);
				this.fill(this.#np.makeRGB(parts[2], parts[3], parts[4]), x, y - x);
				} break;
			
			default:
				return void done();
		}

		if (this.#wipe) {
			this.push(() => {
				done();
				return true;
			});
		}
		else {
			this.#np.update();
			done();
		}
	}
	setPixel(start, color) {
		if (this.#wipe) 
			return this.fill(color, start, start + 1);
		this.#np.setPixel(start, color);
	}
	fill(color, start = 0, end = this.#np.length) {
		if (end > this.#np.length)
			end = this.#np.length;

		if (!this.#wipe) 
			return void this.#np.fill(color, start, end - start);

		let i = start;
		this.push(() => {
			this.#np.setPixel(i++, color);
			this.#np.update();
			return i >= end;
		});
	}
	push(wiper) {
		this.#wipe.wipers.push(wiper);
		if (1 === this.#wipe.wipers.length)
			Timer.schedule(this.#wipe, 0, this.#wipe.interval);
	}

	static type = "rpi-neopixels";
	static {
		RED.nodes.registerType(this.type, this);
	}
}
