# MCU Nodes
Copyright 2022-2023, Moddable Tech, Inc. All rights reserved.<br>
Peter Hoddie<br>
Updated April 30, 2023<br>

The MCU Nodes are a suite of nodes that provides access to features of microcontrollers including various I/O methods, Neopixels light strips, real-time clocks, and sensors. Each node includes built-in documentation describing their inputs, outputs, and configuration options.

The following nodes are included in the MCU Node suite:

- Analog
- Digital Input
- Digital Output
- Real-time Clock
- I²C Read
- I²C Write
- Neopixels
- Pulse Count
- Pulse Width Input
- PWM Output
- Sensor

The MCU Nodes appear in the MCU section of the Node-RED Editor's palette.

<img src="./assets/palette.png" width=150/>

Here's a flow using Sensor node to log periodic readings from a temperature sensor to the debug console.

<img src="./assets/flow.png"/>

Nearly all the MCU nodes are implemented using the [ECMA-419 standard](https://419.ecma-international.org), the ECMAScript embedded systems API specification. This provides a rich set of features that run on a variety of microcontrollers. No knowledge of ECMA-419 is required to use the MCU nodes.

> **Note**: Node-RED MCU Edition also provides limited support for some Raspberry Pi I/O modules, including rpi-gpio, rpi-neopixels, and rpi-i2c. These are provided for projects that need to run on both MCUs and Raspberry Pi. They are implemented using the MCU Nodes. For projects intended to be used only with Node-RED MCU Edition, the MCU Nodes are preferred.
