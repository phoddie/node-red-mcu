# Restart MCU

Restarts the MCU.

This node is designed for use with [Node-RED MCU Edition](https://github.com/phoddie/node-red-mcu).

### Inputs

: payload (any) :  payload is not used

### Outputs

None

### Details

The MCU is restarted when any message is received. This is useful in many situations:

- Following the installation of an OTA update
- After changing global settings
- To restart long-running devices periodically
- In response to unexpected errors

When used in the Moddable SDK simulator (mcsim), the restart node exits the simulator.

### References

 - [GitHub](https://github.com/phoddie/mcu_restart) - this node's repository on GitHub
 - [Node-RED MCU Edition](https://github.com/phoddie/node-red-mcu) - the Node-RED MCU Edition repository
