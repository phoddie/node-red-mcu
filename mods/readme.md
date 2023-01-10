# Using Mods with Node-RED MCU Edition
Copyright 2023, Moddable Tech, Inc. All rights reserved.<br>
Peter Hoddie<br>
Updated January 9, 2023<br>

## Introduction
Mods are a Moddable SDK feature for adding JavaScript code into a firmware image. For Node-RED MCU Edition mods allow you to install most of the code once and then install your Node-RED flows on top of that. Building and installing the mod is considerably faster, making for much faster development turnaround. Mods are compiled to byte-code on your development computer before being installed.

To learn about Mods in-depth see the [Mods documentation](https://github.com/Moddable-OpenSource/moddable/blob/public/documentation/xs/mods.md).

## Using Mods

### Build & Install the Host
Node-RED MCU Edition provides a basic mod host. It is built and installed using `mcconfig`:

```
cd $(PATH TO node-red-mcu)
mcconfig -d -m -p esp32 ./mods/host/manifest.json
```
### Build & Run a Mod
Use `mcrun` to install the flows. If your flows are located at `(PATH to node-red-mcu)/flows.json`, do this:

```
cd $(PATH TO node-red-mcu)
mcrun -d -m -p esp32 ./mods/mod/manifest.json
```

### Configuring Wi-Fi
There are two options for configuring Wi-Fi:

1. Pass the ssid and password to `mcconfig` as usual. These will be the default credentials for any mod loaded
2. Pass the ssid and password to `mcrun`. These will be used in place of the default credentials

```
mcrun -d -m -p esp32 ssid="my wi-fi" password="secret" ./mods/mod/manifest.json
```

## Notes

- It is important to use the correct platform identifier (`esp32`, `esp32/moddable_two`, etc) for your target device. If there is a mismatch between the platform used to build the host and to build the mod, the mod may not work.
- Not all hosts support mods. If the installed host does not support mods, `mcrun` reports an error.
- Installing mods with `mcrun` requires a debug build. Instrumented and Release builds do not support mods in Node-RED MCU Edition at this time.
- Using a Host plus Mod requires more flash storage and memory. As a result, Mods are not practical for all projects on all devices. For example, they are not recommended on ESP8266.
- Mods are supported in the `mcsim` simulator on macOS, Windows, and Linux.
