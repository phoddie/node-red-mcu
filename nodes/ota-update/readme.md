# OTA Update

Install firmware updates. The node supports two modes of operation:

- **Pull**. MCU downloads firmware update using HTTP GET.
- **Push**. MCU receives firmware update through an HTTP PUT.

This node is designed for use with [Node-RED MCU Edition](https://github.com/phoddie/node-red-mcu).

## Preparing an OTA Update
The OTA Update node is currently implemented for MCUs in the ESP32 family.

The OTA update file is an ESP-IDF binary firmware image file. The Moddable SDK build outputs this file as part of every build, as it is the file used to flash the firmware image during development.

The path of the binary firmware image is based on the project name, platform/subplatform, and build type. For a release build of node-red-mcu for Moddable Two (`esp32/moddable_two`), the firmware image is at `$MODDABLE/build/bin/esp32/moddable_two/release/node-red-mcu/xs_esp32.bin`.

When using the MCU plug-in to build, the project name is randomly generated, which would normally make it difficult to locate. Fortunately, the MCU plug-in log shows the path to the build directory following "Built files:".

## Pull mode
In Pull mode, the MCU downloads the firmware update using HTTP GET.

### Inputs

: url (string) :  URL of firmware image to download and install

### Outputs

: payload (string) :  On successful completion of OTA update, `"ota pull"`.

## Push mode
In Push mode, the MCU receives the firmware update through an HTTP PUT.

The `Push Endpoint` property in the Node-RED Editor is the HTTP endpoint to upload OTA updates to the MCU. If the URL property is empty, push mode is disabled.

### Inputs

None

### Outputs

: payload (string) :  On successful completion of OTA update, `"ota push"`.

## Restart after OTA
The updated firmware begins running after the MCU is restarted. The OTA Update node does not automatically restart after a successful OTA install to allow flows to perform a graceful shutdown. Flows may use the [MCU restart node](https://flows.nodered.org/node/@moddable-node-red/mcu_restart) to reboot the microcontroller.

## Monitoring OTA progress
When an OTA update has successfully been installed, `Complete` nodes are triggered.

If an OTA update fails, `Error` nodes are triggered.

`Status` nodes are triggered during the installation of an OTA update to report progress.

## Testing Push mode
The `curl` command line tool may be used to push an OTA update to the microcontroller. Here's an example:

```
curl http://192.0.1.45/ota/firmware -X PUT -H "Content-Type: application/octet-stream" --data-binary '@xs_esp32.bin'
```

Note that this example assumes the current directory contains the firmware image in a file named `xs_esp32.bin`, that the microcontroller is reachable at IP address `192.0.1.45`, and that the OTA Node is configured with a Push Endpoint of `ota/firmware`. You will need to adjust these for your configuration.
