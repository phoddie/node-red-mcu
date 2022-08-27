# Node-RED MCU Edition
Copyright 2022, Moddable Tech, Inc. All rights reserved.<br>
Peter Hoddie<br>
Updated August 21, 2022<br>

## Introduction
This document introduces an implementation of the Node-RED runtime that runs on resource-constrained microcontrollers (MCUs). [Node-RED](https://nodered.org/) is a popular visual environment that describes itself as "a programming tool for wiring together hardware devices, APIs and online services in new and interesting ways."

Node-RED is built on Node.js and, consequently, runs where Node.js does: desktop computers and single-board computers like the Raspberry Pi. Because of the dependency on Node.js, Node-RED cannot run where Node cannot, notably the low-cost MCUs found in many IoT products and popular in the maker community.

These MCUs are able to run the same JavaScript language used by Node-RED thanks to the XS JavaScript engine in the [Moddable SDK](https://github.com/Moddable-OpenSource/moddable). However, these MCUs have much less RAM, much less CPU power, and an RTOS instead of a Linux-based OS. As a result, they require a very different implementation. A typical target microcontroller is the ESP32, running FreeRTOS with about 280&nbsp;KB of free RAM and a 160&nbsp;MHz CPU clock. 

The implementation converts the JSON descriptions output by Node-RED to JavaScript objects that are compatible with MCUs. The implementation uses standard JavaScript running in the Moddable SDK runtime. The [ECMA-419](https://419.ecma-international.org) standard, the ECMAScript® Embedded Systems API Specification, is used for I/O such as access to pin hardware and networking.

This effort is intended to evaluate whether it is feasible to support Node-RED on MCUs. To achieve that goal, the focus is on a breadth rather than depth. Node-RED has a wealth of features that will take considerable time to implement well. This proof-of-concept effort has the following characteristics:

- Implements fundamental structures
- Supports core nodes that help to explore overall architecture
- Requires no changes to Node-RED
- Not overly concerned with efficiency

Efficiency is essential for resource constrained device, but it is not a priority yet. For the current goal of determining if it is realistic to support Node-RED on MCUs, the projects just need to run, not run optimally. 

## Method
The conversion from Node-RED JSON objects to JavaScript objects happens in two separate phase. The first phase happens during the process of building a Node-RED MCU project; the second phase, while running the project.

The following sections look at some examples of the transform, starting from the Node-RED configuration of each object.

### HTTP Request
Here is a typical HTTP Request node.

<img src="./assets/http-request-configure.png" width=400/>

Node-RED generates this JSON for the HTTP Request.

```json
{
    "id": "b0bc5df11987f5b1",
    "type": "http request",
    "z": "8f44c46fbe03a48d",
    "name": "JSON Request",
    "method": "GET",
    "ret": "obj",
    "paytoqs": "ignore",
    "url": "",
    "tls": "",
    "persist": false,
    "proxy": "",
    "authType": "",
    "senderr": true,
    "credentials": {},
    "x": 420,
    "y": 420,
    "wires": [
        [
            "601862f19774933c"
        ]
    ]
}
```

The `nodered2mcu` tool converts this JSON to two JavaScript calls. The first creates the node and adds it to the flow. The second initializes the node with a subset of the properties of the Node-RED generated JSON:

```js
createNode("http request", "b0bc5df11987f5b1", "JSON Request", flow);

node.onStart({
	method: "GET",
	ret: "obj",
	paytoqs: "ignore",
	url: "",
	tls: "",
	persist: false,
	proxy: "",
	authType: "",
	senderr: true,
	credentials: {},
	wires: [["601862f19774933c"]],
});
```

This JavaScript is compiled into the Node-RED MCU Edition project and run on the device. The implementation of the `HTTPRequestNode` uses this JSON to implement the HTTP request. In this case, the URL for the HTTP request is provided by an Inject node. The next section shows the implementation of the inject.

### Inject
This Inject node is configured to send a URL to the HTTP Request node that its output is connected to.

<img src="./assets/inject-configure.png" width=400/>

Node-RED generates this JSON for the Inject node.

```json
{
    "id": "b0afa70581ce895a",
    "type": "inject",
    "z": "8f44c46fbe03a48d",
    "name": "GET httpbin/json",
    "props": [
        {
            "p": "url",
            "v": "httpbin.org/json",
            "vt": "str"
        }
    ],
    "repeat": "",
    "crontab": "",
    "once": true,
    "onceDelay": "6",
    "topic": "",
    "x": 190,
    "y": 420,
    "wires": [
        [
            "b0bc5df11987f5b1"
        ]
    ]
}
```
The `nodered2mcu` tool optimize this JSON considerably by converting the data to two JavaScript functions.

```js
createNode("inject", "b0afa70581ce895a", "GET httpbin/json", flow);

node = nodes.next().value;	// inject - b0afa70581ce895a
node.onStart({
	wires: [["b0bc5df11987f5b1"]],
	trigger: function () {
		const msg = {};
		msg.url = "httpbin.org/json";
		this.send(msg);
	},
	initialize: function () {
		Timer.set(() => this.trigger(), 6000);
	},
});
```

By converting to JavaScript, `nodered2mcu` can include JavaScript functions in addition to JSON values. It creates a `trigger` function to perform the inject operation described by the JSON and an `initialize` function to set up a timer that invokes `trigger` after the initial delay. This optimization allows the Inject node to run more quickly than interpreting the JSON configuration on the MCU. It also tends to require less RAM.

## Change
Here is a typical Change node.

<img src="./assets/change-configure.png" width=400/>

Node-RED generates this JSON for the HTTP Request.

```json
{
    "id": "734223794d10f7cc",
    "type": "change",
    "z": "8f44c46fbe03a48d",
    "name": "",
    "rules": [
        {
            "t": "move",
            "p": "payload",
            "pt": "msg",
            "to": "DEBUGGER",
            "tot": "msg"
        },
        {
            "t": "set",
            "p": "one",
            "pt": "flow",
            "to": "one one one one",
            "tot": "str"
        }
    ],
    "action": "",
    "property": "",
    "from": "",
    "to": "",
    "reg": false,
    "x": 680,
    "y": 320,
    "wires": [
        [
            "e34b347db64fcdc8"
        ]
    ]
}
```

The `nodered2mcu` tool is able to reduce this large block of JSON to a JavaScript function of just a few lines. The `onMessage` function it generates is the implementation of the Change node's message handler, so there is no additional overhead in processing this node.

```js
createNode("change", "734223794d10f7cc", "", flow);

node.onStart({
	wires: [["e34b347db64fcdc8"]],
	onMessage: function (msg) {
		msg.DEBUGGER = msg.payload;
		delete msg.payload
		this.flow.set("one", "one one one one");
		return msg;
	},
});
```

## Results
This initial effort successfully runs useful, if small, Node-RED projects on MCUs. They run reliably and perform well. They have been tested on ESP32 and ESP8266 MCUs. The ESP8266 is quite constrained, running at 80&nbsp;MHz with only about 45&nbsp;KB of RAM. Both are able to run flows that connect physical buttons and LEDs to the cloud using MQTT. The following sections provide details on what has been implemented.

This effort was helped greatly by Node-RED's small, well-designed core architecture. That simplicity minimizes what needed to be implemented to execute the nodes and flows. Node-RED achieves its richness through the addition of nodes on top of its core architecture. This minimal and modular approach is well suited to MCUs which are designed to be capable enough to do useful work, not to be a scalable, general-purpose computing device.

This effort was also made easier by both Node-RED and the Moddable SDK being built on JavaScript engines that provide standard, modern JavaScript (V8 and XS, respectively). This is essential because the Node-RED runtime is itself implemented in JavaScript and makes JavaScript accessible to developers through the Function node. Additionally, the capabilities defined by ECMA-419 are often a direct match for the runtime needs of Node-RED, making implementation of embedded I/O capabilities remarkably straightforward.

Based on these early results, it seems possible to provide a valuable implementation of Node-RED for MCUs. This would make developing software for these devices accessible to more developers thanks to Node-RED's goal of providing "low-code programming." It would also allow developers with Node-RED experience a path to extend their reach to widely-used MCUs.

## Ways to Help
Based on this investigation, bringing Node-RED to MCUs seems both possible and desirable. It is not a small effort, however. It will require expertise in embedded software development, ECMA-419, the Moddable SDK, the Node-RED runtime, and developing flows with Node-RED. Here are some ways you might help:

- Help spread the world. 
- Give it a try. Share what you find – what works and what doesn't.
- Help implement some of the incomplete features of the initial node suite
- Implement additional notes
- Help move the Node-RED Embedded Edition APIs to better match those in Node-RED
- Implement Node-RED nodes for features of the hardware using ECMA-419
- Implement Node-RED nodes for feature for the Moddable SDK
- Help improve the documentation
- Help improve the workflow for developers to deploy and debug flows

Please open an issue or submit a pull request on this repository on GitHub. You can also reach out to [@phoddie](https://twitter.com/phoddie) and [@moddabletech](https://twitter.com/moddabletech) on Twitter or chat in real time on our [Gitter page](https://gitter.im/embedded-javascript/moddable).

## Running Flows on an MCU
Node-RED MCU Edition is a Moddable SDK project. It is built and run just like any Moddable SDK project. Flows run on ESP8266 and ESP32 MCUs, and in the Moddable SDK simulator on macOS computers. Node-RED MCU Edition requires Moddable SDK from August 8, 2022 (or later).

Of course, the Node-RED flows must be added to the project. The JSON version of the flows is stored in the `nodes.json` source file. There are two part to moving a Node-RED project to the Node-RED MCU Edition project.

The first is exporting the project from Node-RED.

1. Open the Node-RED project
1. From the Node-RED menu (top-left corner), select Export
1. On the Export tab, select "all flows"
1. Select Clipboard (not Local)
1. Select JSON (not Export nodes)
1. Select "Copy to Clipboard"

The JSON version of the flows is now on the clipboard. The second step is adding this JSON to the Moddable SDK project:

1. Open the `flows.json` file in the Node-RED MCU Edition project
1. Paste in the Node-RED JSON data

Build and run the Moddable SDK project as usual for the target device. The flows.json file is transformed by `nodered2mcu` as part of the build. If an error is detected, such as an unsupported feature, an error message is output and the build stops.

This process is quick and easy for early exploration. Of course, there are many ways it could be streamlined to improve the developer experience.  

## Structure
The Node-RED runtime executes the nodes and flows. This runtime architecture determines how nodes interact with each other. It also is a key factor in how efficiently the execution uses the limited RAM and CPU power available. 

This is a summary of what is implemented in the Node-RED for MCUs runtime:

- [X] Nodes (details below)
	- [X] Disabled nodes are ignored
- [X] Flows
	- [X] Multiple
	- [X] Configuration
	- [X] Ignore disabled flows
	- [ ] Environment variables defined in editor
	- [ ] Sub-flows
- [X] Links
- [X] Context
	- [X] Global
	- [X] Flow
	- [X] Node
- [X] Outputs
	- [X] Single node output
	- [X] Output connects to multiple inputs
	- [X] Multiple node output
- [X] Messages
	- [X] Shallow copy on send
	- [X] Synchronous send
	- [X] ID assigned to each message
	- [X] Asynchronous send
	- [X] Deep copy on send
- [X] Instantiation
	- [X] Node-RED JSON transformed to JavaScript during build
	- [X] 1:1 map from JSON type to class (maybe not always optimal)

## Nodes
This section lists the supported nodes. The implemented features are checked.

### Comment
- [X] Supported

### Debug
- [X] Console output is displayed in the xsbug log pane
- [X] Sidebar output is displayed in the xsbug message pane
- [X] Display of selected property or complete message
- [X] Output to node status

### Function
- [X] "On Start" and "On Message" handlers
- [X] Access to Node context, flow context, and global context
- [X] Report uncaught exceptions to Catch nodes
- [X] Import modules (Setup)
- [ ] When "On Start" returns Promise, queue received messages until ready
- [ ] Does not wrap `setTimeout` (and friends) to automatically clear on stop
- [ ] `env(()` to access flow's environment variables

### Inject
- [X] Injects multiple properties
- [X] Property values Boolean, timestamp, JSON, number, string, and buffer
- [X] "Inject once after"
- [X] "Repeat after"
- [X] Property values msg., flow., global.
- [ ] Interval between times
- [ ] At a specific time
- [ ] Property values expression & environment variable

### Link Call
- [X] Implemented
- [ ] Timeout

### Link In
- [X] Implemented

### Link Out
- [X] "Send to all connected link nodes"
- [X] "Return to calling link node"

### Catch
- [X] "Catch errors from all nodes"
- [X] "Catch errors from selected nodes"
- [X] "Ignore errors handled by other Catch nodes"

### Status
- [X] "Report status from all nodes"
- [X] "Report status from selected nodes"

### GPIO In
Implemented using "rpi-gpio in" node

- [X] Select GPIO pin
- [X] Pull-up and pull-down resistor options
- [ ] Debounce
- [ ] Read initial state of pin on deploy/restart

### GPIO Out
- [X] Select GPIO pin
- [X] Digital and PWM output modes
- [X] Initialize initial pin state option

Implemented using "rpi-gpio out" node with ECMA-419 Digital and PWM classes.

### DS18B20
- [X] Multiple temperature sensors
- [X] Individual messages or array
- [X] Use `msg.array` to select output format
- [ ] Use `topic` to select single sensor
- [ ] `id` property in output matches Node-RED

Implemented using "rpi-ds18b20" node with OneWire bus module and DS18X20 temperature sensor module. Uses simulated temperature sensors on platforms without OneWire support.

### MQTT Broker
- [X] Broker URL and port number
- [X] Client ID (provides default if not specified)
- [X] Keep alive (defaults to 60 seconds)
- [X] Clean session flag (defaults to true)
- [X] User name and password credentials
- [ ] Birth, close, will topics
- [ ] Protocol version (always 3.1.1)
- [ ] TLS (always insecure)
- [ ] Auto-connect (connects once at start-up)
- [ ] Session expiry
- [ ] QoS 1 and 2
- [ ] Fragmented read and write

Implemented using ECMA-419 MQTT Client draft.

### MQTT In
- [X] Subscribe to topic with QoS 0
- [X] Payload formats: UTF-8, buffer, JSON, and Base64
- [X] Wildcards in topic
- [ ] Dynamic subscription
- [ ] Payload format: auto-detect 

### MQTT Out
- [X] Data formats: number, string, object, buffer
- [X] Retain flag

### HTTP Request
- [X] Method (from Node or incoming message)
- [X] URL (from Node or incoming message)
- [X] Set request headers from incoming message
- [X] Payload: ignore, append to query-string parameters, send as request body 
- [X] Enable connection keep-alive (maybe)
- [X] Return (response body): UTF-8 string, binary buffer, parsed JSON object
- [X] Status in outgoing message
- [X] Response headers in outgoing message
- [ ] TLS (always insecure)
- [ ] Use authentication
- [ ] Use proxy
- [ ] Only send non-2xx responses to Catch node

Implemented using `fetch` based on ECMA-419 HTTP Client draft.

### HTTP In
- [X] Methods
- [X] URL
- [X] Matching params (e.g. `:name`) in URL
- [X] 404 on non-matching route
- [X] Request body parsing from `text/plain`, `application/json`, `application/x-www-form-urlencoded` to `msg.payload`
- [X] `msg.req.headers`, `msg.req.query`, and `msg.req.params`
- [ ] Accept file uploads
- [ ] Cookies

Implemented using `HTTPServer` based on ECMA-419 HTTP Server draft.

### HTTP Response
- [X] Status code from node and `msg.statusCode`
- [X] Response headers from node and `msg.headers`
- [X] Response body from `msg.payload` – `string` as UTF-8, `ArrayBuffer` as binary, `TypedArray` as binary, other as JSON string
- [ ] Cookies

Implemented using `HTTPServer` based on ECMA-419 HTTP Server draft.

### WebSocket Client
- [X] Reconnects dropped connections
- [X] Subprotocol
- [X] Send/receive payload
- [X] Send/receive entire message
- [X] Updates status on connect & disconnect 
- [ ] TLS (always insecure)
- [ ] Send heartbeat (ping)

Implemented using HTML5 `WebSocket` based on ECMA-419 WebSocket Client draft.

### WebSocket In
- [X] "Connect to"
- [ ] "Listen on"

### WebSocket Out
- [X] "Connect to"
- [ ] "Listen on"

### Range
- [X] Scale property value
- [X] Round to integer
- [X] Select property to map
- [X] Scale and limit
- [X] Scale and wrap

### Change
- [X] Delete property
- [X] Move property
- [X] Set property value (including "deep copy value")
- [X] Property values Boolean, timestamp, JSON, number, string, and buffer
- [X] msg., flow. and global. targets
- [ ] Replace within property value
- [ ] Property values expression & environment variable

### Switch
- [X] Multiple rules
- [X] "checking all rules"
- [X] "stopping after first match"
- [X] ==, !=, <, <=, >, >=, is between, is true, is false, is null, is not null, is of type, otherwise, has key
- [X] flow., global., expression
- [ ] env variable
- [ ] is of type: buffer
- [ ] contains, matches regexp, is empty, is not empty, sequence rules, JSONata exp

### Filter
- [X] "block unless value changes"
- [X] "block unless value changes (ignore initial value)"
- [X] msg.payload
- [X] "Apply mode separately for each" msg.topic
- [X] Compare by number, string, and object (shallow)
- [X] Deep object compare
- [ ] "Block unless value change is greater or equal to"
- [ ] "Block unless value change is greater than"
- [ ] "Block if value change is greater or equal to"
- [ ] "Block if value change is greater than"

### Split
- [X] Array
- [X] String
- [X] Object
- [X] Copy key to msg.[]
- [ ] Binary split
- [ ] "Handle as a stream of messages"

### JSON
- [X] Convert between JSON String & Object, Always Convert to JSON String, Always Convert to JSON Object
- [X] Format JSON string

### File Write
- [X] Filename from node or message
- [X] Encoding from node or message
- [X] Encodings: auto, UTF-8, binary, hex, Base64
- [X] Actions: append to file, overwrite file, delete file
- [X] Add newline to each payload
- [X] Create directory if doesn't exist

The File Write node is implemented using the Moddable SDK of integration LittleFS.

### File Read
- [X] Filename from node or message
- [X] Encodings: UTF-8, binary, hex, Base64
- [X] Read full file
- [X] Stream one line or buffer at a time
- [X] Report errors to Catch nodes

The File Read node is implemented using the Moddable SDK of integration LittleFS.

### MCU Sensor
- [X] Retrieve sensor samples from any ECMA-419 Sensor Class Pattern driver
- [X] Simulated implementation for testing in full Node-RED
- [X] Properties sheet for configuration in Node-RED editor

See the MCU Sensor module's [documentation](./nodes/sensor/readme.md) for further details.

### Delay
- [X] Everything

**Note:** The Delay node is the full Node-RED implementation (with a small, optional change to reduce its RAM footprint). This is possible by using the Compatibility Node.

### Compatibility Node
The Compatibility Node runs nodes written for Node-RED. It is able to run the `lower-case` example from ["Creating your first node"](https://nodered.org/docs/creating-nodes/first-node) without any changes.

The Compatibility Node is tricky for a number of reasons. At this time, it should be considered a proof-of-concept and a foundation for future work.

The Node-RED nodes, including the `lower-case` example, are written as CommonJS modules. The XS JavaScript engine supports only standard ECMAScript modules (ESM). This leads to some limitations: `export.modules` can only be set once and any other exported properties are ignored. Because all modules are loaded as standard ECMAScript modules, nodes run by the Compatibility Node run in strict mode.

- [X] `config` passed to node implementation for initialization
- [X] `.on()` and `.off()` to register event handlers
- [X] `"input"` and `"close"` events
- [X] `node.send()` and `send()` to send messages
- [X] `.log()`, `.warn()`, and `.error()`
- [X] `.status()`
- [ ] `done` and `.done()`

While a degree of source code compatibility is provided, the Compatibility Node does not attempt to emulate the (substantial) Node.js runtime. Consequently, it only runs nodes compatible with the features available in the Moddable SDK runtime. Nodes must be added to the Node-RED manifest to be included in the build. See the `lower-case` example in this repository for an example.

> **Note**: The `CompatibilityNode` is implemented as a subclass of `Node`, the fundamental node type of the Node-RED MCU Edition runtime. The `CompatibilityClass` adds features for compatibility that use more memory and CPU power. For efficiency, internal nodes (`inject`, `split`, `http-request`, etc.) are implemented as subclasses of `Node`.

## Future Work
This prototype is a breadth-first effort to implement all the steps required to execute meaningful Node-RED flows on a resource-constrained microcontroller. For compatibility and completeness, a great deal of work remains. That work requires many different kinds of experience and expertise. Evolving this early proof-of-concept to a generally useful implementation will require contributions from many motivated individuals.

The compatibility goal should be to provide the same behaviors as much as possible so that existing Node-RED developers can apply their knowledge and experience to embedded MCUs without encountered confusing and unnecessary differences. The goal is not to provide all the features of Node-RED, as some are impractical or impossible on the target class of devices.

### Transformation
In this prototype, the nodes and flows exported by Node-RED are converted from JSON to JavaScript instances on the embedded device. This is a relatively heavy operation, involving several passes over the project structure and evaluating JavaScript code. Almost all of this work could be done as a build step on the development computer prior to deploy. Done well, this would free up additional RAM for the project, allow projects to start running faster, and detect use of unsupported Node-RED features earlier. This work should be done sooner than later, as it will change the class definition for the nodes.

- [X] Create JavaScript tool to convert Node-RED JSON to JavaScript source code
- [ ] Integrate embedded conversion into Deploy feature of Node-RED (excellent work is being done here by @@ralphwetzel with the [node-red-mcu-plugin](https://github.com/ralphwetzel/node-red-mcu-plugin))

### Runtime
- [ ] Align runtime behavior and APIs with Node-RED as much as practical. This would benefit from assistance from developers familiar with Node-RED.
- [ ] Should messages sent between nodes should be sent asynchronously to avoid JavaScript stack overflows on long chains of nodes (what does Node-RED do here?)
- [ ] Implement support to instantiate nodes from a [Mod](https://github.com/Moddable-OpenSource/moddable/blob/public/documentation/xs/mods.md). This would allow updated flows to be installed on embedded devices in seconds.

### Nodes
Possible future work on built-in nodes:

- **Common nodes**. The Complete node appears to require Node-RED runtime behaviors beyond what this exploration now implements. It should be implemented sooner to ensure that the object design can support all the fundamental behaviors required.
- **Function nodes**. The Trigger nodes appear to be essential. For the most part they should be straightforward to implement, though some of the behaviors are non-trivial. Exec and Template may not make sense.
- **Network nodes**. The TCP and UDP nodes should be possible to implement using ECMA-419 in the same way MQTT has been implemented. WebSocket server is possible.
- **Sequence nodes**. The Join, Sort, and Batch nodes should be possible to support. Like the Function nodes, some are quite sophisticated.
- **Parser**. CSV should be possible to support, but the others (HTML, YAML, XML) are likely impractical.
- **Storage** Watch file may not be useful, since there are no other processes modifying files. At best, it could monitor for changes made by other nodes.

The built-in nodes are useful for compatibility with the standard Node-RED behaviors. Additional nodes should be added to support embedded features. For example, a Preferences node, Display node, etc.

### Challenging Dependencies
Several nodes use [JSONata](https://jsonata.org), a query language for JSON. This looks like a substantial effort to support and is perhaps impractical on a constrained embedded device. Fortunately, it seems like the Function object can do the same, just less conveniently.

The Template node uses [mustache.js](https://mustache.github.io) for powerful string substitution. Like JSONata, this could be impractical to support on embedded. A small subset is probably straightforward to support, if that would be useful.

The JSON node has an option to use [JSON Schema](http://json-schema.org/draft/2020-12/json-schema-validation.html) for validation.

## Thank You
This exploration was motivated by an extended conversation with [Nick O'Leary](https://github.com/knolleary) who patiently explained Node-RED to me at OpenJS World 2022. That clear and patient discussion gave me grounding to begin this effort.