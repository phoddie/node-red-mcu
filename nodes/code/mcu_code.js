module.exports = function(RED) {
    function McuCodeNode(config) {
        RED.nodes.createNode(this,config);
        console.log(config);
    }
    RED.nodes.registerType("mcu_code",McuCodeNode);
}