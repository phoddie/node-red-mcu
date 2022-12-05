module.exports = function(RED) {
    function AudioOutNode(config) {
        RED.nodes.createNode(this,config);

		this.on('input', (msg, send, done) => {
			done();
		});
    }
    RED.nodes.registerType("audioout", AudioOutNode);
}
