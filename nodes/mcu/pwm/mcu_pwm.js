module.exports = function(RED) {
    function PWMOutNode(config) {
        RED.nodes.createNode(this, config);
		console.log(config)
    }
    RED.nodes.registerType("mcu_pwm_out", PWMOutNode);
}
