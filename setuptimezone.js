/*
 * Copyright (c) 2023  Moddable Tech, Inc.
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

import "nodered";	// import for global side effects
import Time from "time";
import Preference from "preference";

export default function (done) {
	const timezone = Preference.get("time", "zone");
	const dst = Preference.get("time", "dst");
	if (RED.mcu.debugging()) {
		if (Time.timezone !== timezone)
			Preference.set("time", "zone", Time.timezone);
		if (Time.dst !== dst)
			Preference.set("time", "dst", Time.dst);
	}
	else if ((undefined !== timezone) && (undefined !== dst)) {
		Time.timezone = timezone;
		Time.dst = dst;
	}

	done();
}
