module.exports = function(RED) {
    RED.nodes.registerType("mcu_analog", AnalogNode);
    function PulseCountNode(config) {
        RED.nodes.createNode(this, config);
		console.log(config)
    }
}
