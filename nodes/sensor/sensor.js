module.exports = function(RED) {
    function SensorNode(config) {
        RED.nodes.createNode(this,config);
		this.on('input', (msg, send, done) => {
			msg.payload = {
				simulated: true,
				temperature: 22.5 - (Math.random() * 5)
			};
			send(msg);
			done();
		});
    }
    RED.nodes.registerType("sensor", SensorNode);
}
