module.exports = function(RED) {
    function RestartNode(config) {
        RED.nodes.createNode(this,config);

		this.on('input', (msg, send, done) => {
			done();
		});
    }
    RED.nodes.registerType("mcu_restart", RestartNode);
}
