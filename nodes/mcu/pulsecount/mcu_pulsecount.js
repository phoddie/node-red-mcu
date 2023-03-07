module.exports = function(RED) {
    function PulseCountNode(config) {
        RED.nodes.createNode(this, config);
		console.log(config)
    }
    RED.nodes.registerType("mcu_pulse_count", PulseCountNode);
}
