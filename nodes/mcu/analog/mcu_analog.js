module.exports = function(RED) {
     function AnalogNode(config) {
        RED.nodes.createNode(this, config);
		console.log(config)
    }
   RED.nodes.registerType("mcu_analog", AnalogNode);
}
