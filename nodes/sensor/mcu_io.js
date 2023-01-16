module.exports = function(RED) {
    function DigitalInNode(config) {
        RED.nodes.createNode(this,config);
		console.log(config)
    }
    RED.nodes.registerType("digital_in", DigitalInNode);
    function DigitalOutNode(config) {
        RED.nodes.createNode(this,config);
		console.log(config)
    }
    RED.nodes.registerType("digital_out", DigitalOutNode);
}
