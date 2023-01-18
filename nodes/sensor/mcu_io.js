module.exports = function(RED) {
    function DigitalInNode(config) {
        RED.nodes.createNode(this, config);
		console.log(config)
    }
    RED.nodes.registerType("digital_in", DigitalInNode);
    function DigitalOutNode(config) {
        RED.nodes.createNode(this, config);
		console.log(config)
    }
    RED.nodes.registerType("digital_out", DigitalOutNode);
    function AnalogNode(config) {
        RED.nodes.createNode(this, config);
		console.log(config)
    }
    RED.nodes.registerType("analog", AnalogNode);
    function PulseCountNode(config) {
        RED.nodes.createNode(this, config);
		console.log(config)
    }
    RED.nodes.registerType("pulse_count", PulseCountNode);
    function PWMNode(config) {
        RED.nodes.createNode(this, config);
		console.log(config)
    }
    RED.nodes.registerType("pwm", PWMNode);
}
