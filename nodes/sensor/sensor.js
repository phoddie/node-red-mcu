const Compounds = {
	Accelerometer: "accelerometer",
	AmbientLight: "lightmeter",
	AtmosphericPressure: "barometer",
	Barometer: "barometer",
	Gyroscope: "gyroscope",
	Humidity: "hygrometer",
	Magnetometer: "magnetometer",
	Proximity: "proximity",
	Temperature: "thermometer",
	Touch: "touch"
};

module.exports = function(RED) {
    function SensorNode(config) {
        RED.nodes.createNode(this,config);

		let sensors;
		const prefix = "embedded:sensor/";		// embedded:sensor/AtmosphericPressure-Temperature/BMP180
        if (config.module.startsWith(prefix)) {
			sensors = config.module.substring(prefix.length).split("/")[0];
			if (sensors)
				sensors = sensors.split("-");
		}
        if (!sensors || !sensors.length)
			sensors = ["Temperature"];
		this.on('input', (msg, send, done) => {
			if (1 === sensors.length) {
				msg.payload = simulateOne(sensors[0]);
			}
			else {
				msg.payload = {};
				sensors.forEach(sensor => {
					if (Compounds[sensor])
						msg.payload[Compounds[sensor]] = simulateOne(sensor);
				});
			}

			msg.payload.simulated = true;
			send(msg);
			done();
		});
    }
    RED.nodes.registerType("sensor", SensorNode);
}

function simulateOne(sensor) {
	const sample = {};

	switch (sensor) {
		case "Accelerometer":
			sample.x = 1 - (Math.random() * 2);
			sample.y = 1 - (Math.random() * 2);
			sample.z = 1 - (Math.random() * 2);
			break;
		case "AtmosphericPressure":
		case "Barometer":
			sample.pressure = 101_325 + (10_000 - (Math.random() * 20_000)); 
			break;
		case "Gyroscope":
			sample.x = 1 - (Math.random() * 2);
			sample.y = 1 - (Math.random() * 2);
			sample.z = 1 - (Math.random() * 2);
			break;
		case "Proximity":
			sample.max = 1000;
			sample.distance = Math.random() * sample.max;
			sample.near = sample.distance < 50;
			break;
		case "Temperature":
			sample.temperature = 22.5 - (Math.random() * 5)
			break;
	}

	return sample;
}
 
