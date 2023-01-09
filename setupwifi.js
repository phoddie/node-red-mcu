/*
 * Copyright (c) 2016-2023  Moddable Tech, Inc.
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
import WiFi from "wifi/connection";
import Net from "net";
import SNTP from "sntp";
import Modules from "modules";

export default function (done) {
	const modconfig = Modules.has("mod/config") ? Modules.importNow("mod/config") : {};

	WiFi.mode = 1;

	const ssid = modconfig.ssid ?? config.ssid;
	const password = modconfig.password ?? config.password;
	const sntp = modconfig.sntp ?? config.sntp;
	if (!ssid) {
		trace("No Wi-Fi SSID\n");
		return done();
	}

	new WiFi({ssid, password}, function(msg, code) {
	   switch (msg) {
		   case WiFi.gotIP:
				trace(`IP address ${Net.get("IP")}\n`);

				if (!sntp || (Date.now() > 1672722071_000)) {
					done?.();
					done = undefined;
					return;
				}

				new SNTP({host: sntp}, function(message, value) {
					if (SNTP.time === message) {
						trace("got time\n");
						Time.set(value);
					}
					else if (SNTP.error === message)
						trace("can't get time\n");
					else
						return;
					done?.();
					done = undefined;
				});
				break;

			case WiFi.connected:
				trace(`Wi-Fi connected to "${Net.get("SSID")}"\n`);
				break;

			case WiFi.disconnected:
				trace((-1 === code) ? "Wi-Fi password rejected\n" : "Wi-Fi disconnected\n");
				break;
		}
	});
}
