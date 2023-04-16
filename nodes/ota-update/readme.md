# OTA Update

Install firmware updates. There are two modes of operation:

- **Pull**. MCU downloads firmware update using HTTP GET.
- **Push**. MCU receives firmware update through an HTTP PUT.

This node runs on an MCU using [Node-RED MCU Edition](https://github.com/phoddie/node-red-mcu).

## Preparing an OTA Update
The OTA Update node is currently implemented for MCUs in the ESP32 family.

The OTA update file is an ESP-IDF binary firmware image file. The Moddable SDK build outputs this file as part of every build, as it is the file used to flash the firmware image during development.

The path of the binary firmware image is based on the project name, platform/subplatform, and build type. For a release build of node-red-mcu for Moddable Two (`esp32/moddable_two`), the firmware image is at `$MODDABLE/build/bin/esp32/moddable_two/release/node-red-mcu/xs_esp32.bin`.

When using the MCU plug-in to build, the project name is randomly generated, which would normally make it difficult to locate. Fortunately, the MCU plug-in log its working directory, which ends with the generated name (here it is `lyfr1bexk5`):

```
Working directory: /Users/username/.node-red/mcu-plugin-cache/lyfr1bexk5
```

## Pull mode
In Pull mode, the MCU downloads the firmware update using HTTP GET.

### Inputs

: url (string) :  URL of firmware image to download and install

### Outputs

: payload (string) :  On successful completion of OTA update, `"ota pull"`.

## Push mode
In Push mode, the MCU receives the firmware update through an HTTP PUT.

The `Push Endpoint` property in the Node-RED Editor is the HTTP endpoint to upload OTA updates to the MCU. Push mode is **disabled** by default. Set the upload path on the URL property to enable Push mode. 

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

## Push or Pull?
There are good reasons to choose Push or Pull mode for OTA updates in your project. Some projects might even use both. Here are some considerations to help guide your choice.

- Push mode is the simplest to integrate: add an OTA Update node, set the URL endpoint for receiving and upload, and connect the OTA Update node to an MCU Restart node.
- Push mode is convenient for quickly deploying updates to an MCU. Just run `curl` to upload new firmware to the device.
- Push mode opens the MCU for full firmware updates by anyone that can connect to its IP address. If that's a local network address and everyone on the network is trusted, that may be fine. If not, it may be a security risk.
- Pull mode takes a bit more work to integrate into to a flow. In addition to the OTA Update and MCU Restart nodes, the flow needs a trigger to begin the OTA download. That trigger can come from any other Node-RED node in the flow. That might be an MQTT message received on an OTA topic, the push of a physical button on the device, the press of an on-screen button using the Node-RED Dashboard, or an HTTP POST with the URL of the OTA update. There's a lot of flexibility to decide how to trigger the OTA update.
- Pull mode gives complete control over when the OTA is initiated, which allows the device to choose a non-disruptive time to apply the update. By contrast, the timing of Push mode updates is whenever the upload begins.
- Pull mode works best for updating fleets of MCUs. A single message published to an MQTT OTA topic monitored by thousands of devices will update all of them.