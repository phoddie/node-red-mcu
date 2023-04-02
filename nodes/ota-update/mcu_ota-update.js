module.exports = function(RED) {
    function OTAUpdateNode(config) {
        RED.nodes.createNode(this,config);

		this.on('input', (msg, send, done) => {
			done();
		});
    }
    RED.nodes.registerType("ota-update", OTAUpdateNode);
}
