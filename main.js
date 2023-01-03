import "nodered";	// import for global side effects
import flows from "flows";

RED.build(flows);

import Timer from "timer";
import WiFi from "wifi";

Timer.set(() => WiFi.disconnect(), 5_000);
