module.exports = function(RED) {
    function ClockNode(config) {
        RED.nodes.createNode(this,config);
		console.log(config)
    }
    RED.nodes.registerType("mcu_clock", ClockNode);
}
