module.exports = function(RED) {
    function DigitalInNode(config) {
        RED.nodes.createNode(this, config);
		console.log(config)
    }
    RED.nodes.registerType("mcu_digital_in", DigitalInNode);
    function DigitalOutNode(config) {
        RED.nodes.createNode(this, config);
		console.log(config)
    }
    RED.nodes.registerType("mcu_digital_out", DigitalOutNode);
    function AnalogNode(config) {
        RED.nodes.createNode(this, config);
		console.log(config)
    }
    RED.nodes.registerType("mcu_analog", AnalogNode);
    function PulseCountNode(config) {
        RED.nodes.createNode(this, config);
		console.log(config)
    }
    RED.nodes.registerType("mcu_pulse_count", PulseCountNode);
    function PWMOutNode(config) {
        RED.nodes.createNode(this, config);
		console.log(config)
    }
    RED.nodes.registerType("mcu_pwm_out", PWMOutNode);
}
