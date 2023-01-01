import "nodered";	// import for global side effects
import flows from "flows";

import config from "mc/config";
import Time from "time";
import WiFi from "wifi/connection";
import Net from "net";
import SNTP from "sntp";

WiFi.mode = 1;
if (config.ssid) {
	let once = true;

	new WiFi({ssid: config.ssid, password: config.password}, function(msg, code) {
	   switch (msg) {
		   case WiFi.gotIP:
				trace(`IP address ${Net.get("IP")}\n`);

				if (!config.sntp) {
					if (once) {
						once = false;
						RED.build(flows);
					}
					return;
				}

				new SNTP({host: config.sntp}, function(message, value) {
					if (1 === message) {
						trace("got time\n");
						Time.set(value);

						if (once) {
							once = false;
							RED.build(flows);
						}
					}
					else if (message < 0)
						trace("can't get time\n");
					else
						return;
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
else
	RED.build(flows);
