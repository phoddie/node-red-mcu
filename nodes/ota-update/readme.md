# OTA Update

Install updates using HTTP GET from device or HTTP PUT to device.

This node is designed for use with [Node-RED MCU Edition](https://github.com/phoddie/node_red_mcu).

### Inputs

: url (string) :  URL of firmware image to download and install

### Outputs

: payload (string) :  On successful completion of OTA update, payload is set to `"ota upload"` (for uploads received by http server endpoint) and `"ota download"` (for downloads from `msg.url`).

### Details

The URL property in the Node-RED Editor is the endpoint to upload OTA updates to the MCU. If the URL property is empty, OTA updates cannot be uploaded, but may still be downloaded.

The updated firmware will be used after the MCU is restarted. The OTA Update node does not automatically restart after a successful OTA install to allow flows to perform a graceful shutdown. Flows may use the [MCU restart node](https://flows.nodered.org/node/@moddable-node-red/mcu_restart) to reboot the microcontroller.

When an OTA update has successfully been installed, `Complete` nodes are triggered.

If an OTA update fails, `Error` nodes are triggered.

`Status` nodes are triggered during the installation of an OTA update to monitor progress.

The OTA Update node is currently implemented for MCUs in the ESP32 family.

The OTA update file is an ESP-IDF binary firmware image. The Moddable SDK build outputs this file as part of every build, as it is the file used to flash the firmware image during development. The path of the binary firmware image is based on the project name, the development board name, and build type. For a release build of node-red-mcu for Moddable Two, the firmware image is at `$MODDABLE/bin/esp32/moddable_two/release/node_red_mcu/xs_esp32.bin`.

The `curl` command line tool is a convenient way to push an OTA update to the microcontroller. Here's an example:

```
curl http://192.0.1.45/firmware/ota/firmware -X PUT -H "Content-Type: application/octet-stream" --data-binary '@xs_esp32.bin'
```

Note that this example assumes the current directory contains the firmware image in a file named `xs_esp32.bin`, that the microcontroller is reachable at IP address `192.0.1.45`, and that the OTA Node is configured with an HTTP endpoint of `ota/firmware`. You will need to adjust these for your configuration.
