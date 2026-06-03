/*
 * Copyright (c) 2016-2026  Moddable Tech, Inc.
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

import config from "mc/config";
import Time from "time";
import Timer from "timer";
import Modules from "modules";
import WiFi from "embedded:network/interface/wifi";

export default function (done) {
	const modconfig = Modules.has("mod/config") ? Modules.importNow("mod/config") : {};

	const SSID = modconfig.ssid ?? config.ssid;
	const password = modconfig.password ?? config.password;
	const sntp = modconfig.sntp ?? config.sntp;

	if (!SSID) {
		trace("No Wi-Fi SSID\n");
		return done();
	}

	const w = new WiFi({
		onChanged(property) {
			if ("connection" !== property)
				return;

			const connection = this.connection;
			if (connection < 500) {
				if (connection >= 400)
					trace(`Wi-Fi connected to "${this.SSID}"\n`);
				else if (connection <= 200) {
					trace(`Wi-Fi disconnected\n`);		//@@ password rejected?
					Timer.schedule(this.reconnect, 5_000, 1_000_000);		// try to reconnect in 5 seconds
				}
				return;
			}

			trace(`IP address ${this.address}\n`);
			Timer.schedule(this.reconnect);		// unschedule
			if (!config.sntp || (Date.now() > 1672722071_000)) {
				const d = done;
				done = undefined
				return d?.();
			}

			new SNTP({host: sntp}, function(message, value) {
				if (SNTP.time === message) {
					trace(`got unix time ${value} from ${sntp}\n`);
					Time.set(value);
				}
				else if (SNTP.error === message)
					trace("can't get time\n");
				else
					return;
				const d = done;
				done = undefined
				return d?.();
			});
		}
	});

	w.reconnect = Timer.set(() => {
		w.connect(password ? {SSID, password, secure: true} : {SSID});
	}, 0, 1_000_000);
}
