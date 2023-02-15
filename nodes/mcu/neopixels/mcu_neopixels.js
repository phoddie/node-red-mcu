module.exports = function(RED) {
    function NeoPixelsNode(config) {
        RED.nodes.createNode(this,config);
		console.log(config)
    }
    RED.nodes.registerType("mcu_neopixels", NeoPixelsNode);
}
