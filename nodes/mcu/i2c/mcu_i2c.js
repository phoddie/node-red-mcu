module.exports = function(RED) {
    function I2CInNode(config) {
        RED.nodes.createNode(this, config);
		console.log(config)
    }
    RED.nodes.registerType("mcu_i2c_in", I2CInNode);
    function I2COutNode(config) {
        RED.nodes.createNode(this, config);
		console.log(config)
    }
    RED.nodes.registerType("mcu_i2c_out", I2COutNode);
}
