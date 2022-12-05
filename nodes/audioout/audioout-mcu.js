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

import AudioOut from "pins/audioout"
import Resource from "Resource"
import WavStreamer from "wavstreamer";
import SBCStreamer from "sbcstreamer";
import URL from "url";

let audioOut;

class AudioOutNode extends Node {
	#stream;
	#streamer;

	onStart(config) {
		super.onStart(config);

		if (!audioOut) {
			audioOut = new AudioOut({});
			audioOut.callbacks = [];
			audioOut.start();
			audioOut.stream = 0;
		}
		else if (audioOut.stream === audioOut.streams)
			return void this.error("no more audio streams available")

		this.#stream = audioOut.stream++;
		audioOut.enqueue(this.#stream, AudioOut.Volume, 256 * Number(config.volume ?? 1));
	}
	onMessage(msg, done) {
		if (msg.flush)
			audioOut.enqueue(this.#stream, AudioOut.Flush);

		if (msg.volume)
			audioOut.enqueue(this.#stream, AudioOut.Volume, 256 * Number(msg.volume));

		const play = msg.wave || msg.tones || msg.sbc || msg.resource || msg.samples;
		if (play || msg.flush) {
			audioOut.enqueue(this.#stream, AudioOut.Flush);
			this.#streamer?.close?.();
			this.#streamer?.done();
			this.#streamer = undefined;
			audioOut.callbacks[this.#stream] = undefined;
		}
		if (!play)
			return void done();

		if (msg.wave || msg.sbc) {
			let url, Streamer;
			if (msg.wave) {
				url = new URL(msg.wave);
				Streamer = WavStreamer;
			}
			else {
				url = new URL(msg.sbc);
				Streamer = SBCStreamer;
			}

			this.#streamer = new Streamer({
				http: device.network.http,
				port: url.port || 80,
				host: url.hostname,
				path: url.pathname + url.search,
				audio: {
					out: audioOut,
					stream: this.#stream
				},
				onError: e => {
					this.#streamer.done(e);
					delete this.#streamer.done;
				},
				onDone: () => {
					this.#streamer.done()
					delete this.#streamer.done;
				}
			});
			this.#streamer.done = done;
		}
		else if (msg.resource) {
			let resource;
			if (Resource.exists(msg.resource))
				resource = new Resource(msg.resource);
			else if (Resource.exists(msg.resource + ".maud"))
				resource = new Resource(msg.resource + ".maud");
			else
				return void done(`resource "${msg.resource}" not found`);
			audioOut.enqueue(this.#stream, AudioOut.Samples, resource);
			audioOut.enqueue(this.#stream, AudioOut.Callback, 0);
			audioOut.callbacks[this.#stream] = () => {
				this.#streamer.done();
				this.#streamer = undefined;
			};
			this.#streamer = {done};
		}
		else if (msg.tones) {
			this.#streamer = {
				tones: msg.tones,
				position: 0,
				done
			};
			audioOut.callbacks[this.#stream] = last => {
				const streamer = this.#streamer, tones = streamer.tones, length = tones.length;
				if (last) {
					streamer.done();
					this.#streamer = undefined;
					return;
				}
				let remaining = audioOut.length(this.#stream), scale = audioOut.sampleRate / 1000;
				let position = streamer.position;
				while ((position < length) && (--remaining > 0)) {
					const [frequency, duration] = tones[position++];
					audioOut.enqueue(this.#stream, AudioOut.Tone, frequency, duration * scale);
				}
				streamer.position = position;
				audioOut.enqueue(this.#stream, AudioOut.Callback, position === length);
			};
			audioOut.callbacks[this.#stream](0);
		}
		else if (msg.samples) {
			let samples = msg.samples;
			if (samples.buffer instanceof ArrayBuffer) {
				samples = new Uint8Array(new SharedArrayBuffer(samples.length))
				samples.set(msg.samples);
			}
			audioOut.enqueue(this.#stream, AudioOut.RawSamples, samples);
			audioOut.enqueue(this.#stream, AudioOut.Callback, 0);
			audioOut.callbacks[this.#stream] = () => {
				this.#streamer.done();
				this.#streamer = undefined;
			};
			this.#streamer = {done, samples};
		}
		else
			done();
	}

	static type = "audioout";
	static {
		RED.nodes.registerType(this.type, this);
	}
}
