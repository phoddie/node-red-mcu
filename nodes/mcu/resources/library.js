if (globalThis.mcuHelper === undefined) {

	$.getJSON("resources/@moddable-node-red/mcu/database.json", function(data) {
		globalThis.mcuDatabase = data
		const categories = {
			AmbientLight: "Ambient Light",
			CarbonDioxideGasSensor: "Carbon Dioxide Gas",
			SoilMoistureSensor: "Soil Moisture",
			VOCSensor: "VOC",
		};
		const sensors = mcuDatabase.sensor;
		for (let moduleKey in sensors) {
			const parts = moduleKey.split("/");
			const names = parts[1].split("-");
			let category = "";
			for (let name of names) {
				if (name in categories)
					name = categories[name];
				if (category)
					category += " - ";
				category += name;
			}
			sensors[moduleKey].category = category;
		}
	});

	globalThis.mcuHelper = {
		category: 'MCU',
		color: '#a2aaff',
		appendIOs(platformKey, moduleKey, entryKey, options) {
			let index = 0;
			let entry;
			let div;
			if (platformKey === "") {
				entry = mcuDatabase[entryKey][moduleKey];
				if (entry.category) {
					div = $(`#node-mcu-category`);
					div.empty();
					div.append(`${entry.category}`);
				}
				const ios = entry.io;
				for (let key in ios) {
					const io = ios[key];
					div = $(`#node-mcu-rows-${index}`);
					mcuHelper.appendIO(div, key, io);
					div.show();
					if (options)
						mcuHelper.restoreIO(options, key, io);
					index++;
				}
			}
			else {
				const platform = mcuDatabase.platform[platformKey];
				entry = platform[entryKey][moduleKey];
				div = $(`#node-mcu-category`);
				div.empty();
				div = $(`#node-mcu-rows-${index}`);
				div.empty();
				div.append(`
					<div class="red-ui-help">
						<hr/>
						<b>I/O</b> options defined by the <a class="" href="${platform.url}" target="_blank">${platform.name}</a> platform.
					</div>
				`);
				div.show();
				index++;
			}
			while (index <= 2) {
				div = $(`#node-mcu-rows-${index}`);
				div.empty();
				div.hide();
				index++;
			}
			div = $(`#node-mcu-infos`);
			div.empty();
			if (entry.url) {
				div.append(`
					<div class="red-ui-help">
						See the <a class="" href="${entry.url}#configuration" target="_blank">ECMA-419 class</a> for configuration details.
					</div>
				`);
			}
			div.append(`
				<div class="form-row">
					<hr/>
					<label>Module</label>
					<div style="display:inline-block; width:70%; vertical-align:top;">${moduleKey}</div>
				</div>
			`);
			if (entry.driver) {
				const url = entry.driver.replace("$(MODDABLE)", "https://github.com/Moddable-OpenSource/moddable/blob/public");
				div.append(`
					<div class="form-row">
						<label>Driver</label>
						<div class="red-ui-help" style="display:inline-block; width:70%; vertical-align:top;">
							<a class="" href="${url}" target="_blank">${entry.driver}</a>
						</div>
					</div>
				`);
			}
		},
		appendIO(div, name, io) {
			div.empty();
			if (io.optional) {
				div.append(`
					<div class="form-row">
						<hr/>
						<label style="font-weight:bold;">${name.toUpperCase()}</label>
						<label>${io.type}</label>
						<input type="checkbox" id="node-input-${name}-optional" style="display:inline-block; width:16px; margin-bottom:8px">
						<label for="node-input-${name}-optional">Active</label>
					</div>
				`);
				const checkbox = $(`#node-input-${name}-optional`);
				checkbox.on("change", function() {
					mcuHelper.toggleIO(checkbox.prop('checked'), name, io);
				});
				this.appendProperties[io.type](div, name, io);
				mcuHelper.toggleIO(false, name, io);
			}
			else if ((io.type == "I2C") || (io.type == "SMBus")) {
				div.append(`
					<div class="form-row">
						<hr/>
						<label style="font-weight:bold;">I/O</label>
						<label>${io.type}</label>
						<span class="button-group">
							<button type="button" class="red-ui-button toggle selected" id="button-group-${name}-bus">Bus</button><button type="button" class="red-ui-button toggle" id="button-group-${name}-pins">Pins</button>
						</span>
					</div>
				`);
				$(`#button-group-${name}-bus`).on("click", function() {
					mcuHelper.toggleIO(false, name, io);
				})			
				$(`#button-group-${name}-pins`).on("click", function() {
					mcuHelper.toggleIO(true, name, io);
				})			
				this.appendProperties[io.type](div, name, io);
				mcuHelper.toggleIO(false, name, io);
			}
			else {
				div.append(`
					<div class="form-row">
						<hr/>
						<label style="font-weight:bold;">I/O</label>
						<label>${io.type}</label>
					</div>
				`);
				this.appendProperties[io.type](div, name, io);
			}
		},
		appendProperties: {
			appendProperty(div, name, key, label, type, value, placeholder="", unit="") {
				div.append(`
					<div class="form-row" id="form-row-${name}-${key}">
						<label for="node-input-${name}-${key}">${label}</label>
						<input type="text" id="node-input-${name}-${key}" style="display:inline-block; width:70%; vertical-align:baseline;" placeholder="${placeholder}">
						<span>${unit}</span>
					</div>
				`);
				if (type) {
					const input = $(`#node-input-${name}-${key}`);
					input.typedInput({ type });
					if (value)
						input.typedInput("value", value);
				}
			},
			Analog(div, name) {
				this.appendProperty(div, name, "pin", "Pin", "num", "?");
			},
		
			Digital(div, name, io) {
				this.appendProperty(div, name, "pin", "Pin", "num", "?");
				if (io.mode == "Input") {
					div.append(`
						<div class="form-row" id="form-row-${name}-mode">
							<label for="node-input-${name}-mode">Mode</label>
							<select type="text" id="node-input-${name}-mode" style="display:inline-block; width:70%; vertical-align:baseline;">
								<option value="Input">Input</option>
								<option value="InputPullUp">Input Pull Up</option>
								<option value="InputPullDown">Input Pull Down</option>
								<option value="InputPullUpDown">Input Pull Up Down</option>
							</select>
						</div>
					`);
				}
				else {
					div.append(`
						<div class="form-row" id="form-row-${name}-mode">
							<label for="node-input-${name}-mode">Mode</label>
							<select type="text" id="node-input-${name}-mode" style="display:inline-block; width:70%; vertical-align:baseline;">
								<option value="Output">Output</option>
								<option value="OutputOpenDrain">Output Open Drain</option>
							</select>
						</div>
					`);
				}	
			},
			I2C(div, name, io) {
				this.appendProperty(div, name, "bus", "Bus Name", "str", "default");
				this.appendProperty(div, name, "data", "Data", "num", "?");
				this.appendProperty(div, name, "clock", "Clock", "num", "?");
				this.appendProperty(div, name, "hz", "Speed", "", "", "default", "Hz");
			
				let address = io.address || ",*";
				let addresses = address.split(",");
				let string;
				if ((addresses.length == 2) && (addresses[1] == "*")) {
					string = `<input type="text" id="node-input-${name}-address" style="display:inline-block; width:70%; vertical-align:baseline;">`
				}
				else {
					string = `<select type="text" id="node-input-${name}-address" style="display:inline-block; width:70%; vertical-align:baseline;">`
					for (address of addresses) {
						string += `<option value="${address}">${address}</option>`;
					}
					string += `</select>`;
				}
				div.append(`
					<div class="form-row" id="form-row-${name}-address">
						<label for="node-input-${name}-address">Address</label>
						${string}
						</div>
					`);
				const input = $(`#node-input-${name}-address`);
				input.val(addresses[0]);
	// 				if (addresses.length == 1)
	// 					input.prop('disabled', true)
			},
			PulseCount(div, name, io) {
				this.appendProperty(div, name, "signal", "Signal Pin", "num", "?");
				this.appendProperty(div, name, "control", "Control Pin", "num", "?");
			},
			PulseWidth(div, name, io) {
				this.appendProperty(div, name, "pin", "Pin", "num", "?");
				div.append(`
					<div class="form-row" id="form-row-${name}-mode">
						<label for="node-input-${name}-mode">Mode</label>
						<select type="text" id="node-input-${name}-mode" style="display:inline-block; width:70%; vertical-align:baseline;">
							<option value="Input">Input</option>
							<option value="InputPullUp">Input Pull Up</option>
							<option value="InputPullDown">Input Pull Down</option>
						</select>
					</div>
				`);
			},
			PWM(div, name, io) {
				this.appendProperty(div, name, "pin", "Pin", "num", "?");
				this.appendProperty(div, name, "hz", "Frequency", "", "", "default", "Hz");
			},
			Serial(div, name, io) {
				this.appendProperty(div, name, "receive", "Receive Pin", "num", "?");
				this.appendProperty(div, name, "transmit", "Transmit Pin", "num", "?");
			
				let baud = io.baud || ",*";
				let bauds = baud.split(",");
				let string;
				if ((bauds.length == 2) && (bauds[1] == "*")) {
					string = `<input type="text" id="node-input-${name}-baud" style="display:inline-block; width:70%; vertical-align:baseline;">`
				}
				else {
					string = `<select type="text" id="node-input-${name}-baud" style="display:inline-block; width:70%; vertical-align:baseline;">`
					for (baud of bauds) {
						string += `<option value="${baud}">${baud}</option>`;
					}
					string += `</select>`;
				}
				div.append(`
					<div class="form-row" id="form-row-${name}-baud">
						<label for="node-input-${name}-baud">Baud Rate</label>
						${string}
						</div>
					`);
				const input = $(`#node-input-${name}-baud`);
				input.val(bauds[0]);
			
				this.appendProperty(div, name, "port", "Port Identifier", "str", "");
			},
			SMBus(div, name, io) {
				this.I2C(div, name, io);
			},
		},
	
		restoreIO(options, name, io) {
			if (name in options) {
				if (io.optional) {
					$(`#node-input-${name}-optional`).prop('checked', true);
					mcuHelper.toggleIO(true, name, io);
				}
				this.restoreProperties[io.type](options[name], name, io);
			}
		},
		restoreProperties: {
			restoreProperty(option, name, key, type) {
				if (key in option) {
					if (type) 
						$(`#node-input-${name}-${key}`).typedInput("value", option[key]);
					else
						$(`#node-input-${name}-${key}`).val(option[key]);
				}
			},
			Analog(option, name, io) {
				this.restoreProperty(option, name, "pin", "num");
			},
			Digital(option, name, io) {
				this.restoreProperty(option, name, "pin", "num");
				this.restoreProperty(option, name, "mode");
			},
			I2C(option, name, io) {
				mcuHelper.toggleIO(("clock" in option) || ("data" in option), name, io);
				this.restoreProperty(option, name, "bus", "str");
				this.restoreProperty(option, name, "clock", "num");
				this.restoreProperty(option, name, "data", "num");
				this.restoreProperty(option, name, "hz");
				this.restoreProperty(option, name, "address");
			},
			PulseCount(option, name, io) {
				this.restoreProperty(option, name, "signal", "num");
				this.restoreProperty(option, name, "control", "num");
			},
			PulseWidth(option, name, io) {
				this.restoreProperty(option, name, "pin", "num");
				this.restoreProperty(option, name, "mode");
			},
			PWM(option, name, io) {
				this.restoreProperty(option, name, "pin", "num");
				this.restoreProperty(option, name, "hz");
			},
			Serial(option, name, io) {
				this.restoreProperty(option, name, "receive", "num");
				this.restoreProperty(option, name, "transmit", "num");
				this.restoreProperty(option, name, "baud");
				this.restoreProperty(option, name, "port", "str");
			},
			SMBus(option, name, io) {
				this.I2C(option, name, io);
			},
		},
	
		saveIO(options, name, io) {
			if (io.optional) {
				if (!$(`#node-input-${name}-optional`).prop('checked'))
					return;
			}
			const option = options[name] = {
				io: io.type,
			}
			if (io.callback)
				option.callback = io.callback;
			this.saveProperties[io.type](option, name, io);
		},
		saveProperties: {
			saveProperty(option, name, key, type) {
				let value;
				if (type)
					value = $(`#node-input-${name}-${key}`).typedInput("value");
				else
					value = $(`#node-input-${name}-${key}`).val();
				if (value !== "")
					option[key] = value;
			},
			Analog(option, name, io) {
				this.saveProperty(option, name, "pin", "num");
			},
			Digital(option, name, io) {
				this.saveProperty(option, name, "pin", "num");
				this.saveProperty(option, name, "mode");
			},
			I2C(option, name, io) {
				if ($(`#button-group-${name}-bus`).hasClass("selected"))
					this.saveProperty(option, name, "bus", "str");
				else {
					this.saveProperty(option, name, "clock", "num");
					this.saveProperty(option, name, "data", "num");
				}
				this.saveProperty(option, name, "hz");
				this.saveProperty(option, name, "address");
			},
			PulseCount(option, name, io) {
				this.saveProperty(option, name, "signal", "num");
				this.saveProperty(option, name, "control", "num");
			},
			PulseWidth(option, name, io) {
				this.saveProperty(option, name, "pin", "num");
				this.saveProperty(option, name, "mode");
			},
			PWM(option, name, io) {
				this.saveProperty(option, name, "pin", "num");
				this.saveProperty(option, name, "hz");
			},
			Serial(option, name, io) {
				this.saveProperty(option, name, "receive", "num");
				this.saveProperty(option, name, "transmit", "num");
				this.saveProperty(option, name, "baud");
				this.saveProperty(option, name, "port", "str");
			},
			SMBus(option, name, io) {
				this.I2C(option, name, io);
			},
		},
	
		toggleIO(show, name, io) {
			this.toggleProperties[io.type](show, name);
		},
		toggleProperties: {
			toggleProperty(show, name, key) {
				if (show)
					$(`#form-row-${name}-${key}`).show();
				else
					$(`#form-row-${name}-${key}`).hide();
			},
			Analog(show, name) {
				this.toggleProperty(show, name, "pin");
			},
			Digital(show, name) {
				this.toggleProperty(show, name, "pin");
				this.toggleProperty(show, name, "mode");
			},
			I2C(show, name) {
				if (show) {
					$(`#button-group-${name}-bus`).removeClass("selected");
					$(`#button-group-${name}-pins`).addClass("selected");
					this.toggleProperty(false, name, "bus");
					this.toggleProperty(true, name, "clock");
					this.toggleProperty(true, name, "data");
				}
				else {
					$(`#button-group-${name}-bus`).addClass("selected");
					$(`#button-group-${name}-pins`).removeClass("selected");
					this.toggleProperty(true, name, "bus");
					this.toggleProperty(false, name, "clock");
					this.toggleProperty(false, name, "data");
				}
			},
			SMBus(show, name) {
				this.I2C(show, name);
			},
		},
	
		validateOptions(options) {
			const validator = RED.validators.number();
			let result = true;
			for (let key in options) {
				const option = options[key];
				result &= mcuHelper.validateProperties[option.io](option, validator)
			}
			return result;
		},
		validateProperties: {
			Analog(option, validator) {
				return validator(option.pin);
			},
			Digital(option, validator) {
				return validator(option.pin);
			},
			I2C(option, validator) {
				let result = true;
				if ("clock" in option)
					result &= validator(option.clock);
				if ("data" in option)
					result &= validator(option.data);
				return result;
			},
			PulseCount(option, validator) {
				return validator(option.signal) && validator(option.control);
			},
			PulseWidth(option, validator) {
				return validator(option.pin);
			},
			PWM(optio, validatorn) {
				return validator(option.pin);
			},
			Serial(option, validator) {
				return validator(option.receive) && validator(option.transmit);
			},
			SMBus(option, validator) {
				return this.I2C(option, validator);
			},
		},
	}
}
