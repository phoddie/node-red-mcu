module.exports = function(RED) {
    function PulseWidthNode(config) {
        RED.nodes.createNode(this, config);
		console.log(config)
    }
    RED.nodes.registerType("mcu_pulse_width", PulseWidthNode);
}
