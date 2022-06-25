# Node-RED MCU Edition
Copyright 2022, Moddable Tech, Inc. All rights reserved.<br>
Peter Hoddie<br>
Updated June 25, 2022<br>

## Introduction
This document introduces an early implementation of the Node-RED runtime that runs on resource-constrained microcontrollers (MCUs).  [Node-RED](https://nodered.org/) is a popular visual environment that describes itself as "a programming tool for wiring together hardware devices, APIs and online services in new and interesting ways."

Node-RED is built on Node.js and, consequently, runs where Node.js does: desktop computers and single-board computers like the Raspberry Pi. Because of the dependency on Node.js, Node-RED cannot run where Node cannot, notably the low-cost MCUs found in many IoT products and popular in the maker community.

These MCUs are able to run the same JavaScript language used by Node-RED thanks to the XS JavaScript engine in the [Moddable SDK](https://github.com/Moddable-OpenSource/moddable). However, these MCUs have much less RAM, much less CPU power, and an RTOS instead of a Linux-based OS. As a result, they require a very different implementation. A typical target microcontroller is the ESP32, running FreeRTOS with about 280&nbsp;KB of free RAM and a 160&nbsp;MHz CPU clock. 

This early implementation works by converting the JSON descriptions output by Node-RED to objects that are compatible with MCUs. The implementation uses standard JavaScript running in the Moddable SDK runtime. The [ECMA-419](https://419.ecma-international.org) standard, the ECMAScript® Embedded Systems API Specification, is used for I/O such as access to pin hardware and networking.

This early work is intended to evaluate whether it is feasible to support Node-RED on MCUs. To achieve that goal, the focus is on a breadth rather than depth. Node-RED has a wealth of features that will take considerable time to implement well. This proof-of-concept effort has the following characteristics:

- Implements fundamental structures
- Supports core nodes that help to explore overall architecture
- Requires no changes to Node-RED
- Not overly concerned with efficiency

Efficiency is essential for resource constrained device, but it is not a priority yet. For the current goal of determining if it is realistic to support Node-RED on MCUs, the projects just need to run, not run optimally. Optimization can be done after the fundamentals are working.

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
Node-RED MCU Edition is a Moddable SDK project. It is built and run just like any Moddable SDK project. Flows run on ESP8266 and ESP32 MCUs, and in the Moddable SDK simulator on macOS computers.

Of course, the Node-RED flows must be added to the project. The JSON version of the flows is stored in the `nodes.js` source file. There are two part to moving a Node-RED project to the Node-RED MCU Edition project.

The first is exporting the project from Node-RED.

1. Open the Node-RED project
1. From the Node-RED menu (top-left corner), select Export
1. On the Export tab, select "all flows"
1. Select Clipboard (not Local)
1. Select JSON (not Export nodes)
1. Select "Copy to Clipboard"

The JSON version of the flows is now on the clipboard. The second step is adding this JSON to the Moddable SDK project:

1. Open the `nodes.js` file in the Node-RED MCU Edition project
1. Delete the current JSON data assigned to the `nodes` variable  (take care not to delete the `export` statement at the end of the file)
1. Paste in the Node-RED JSON data so it is assigned to `nodes`

Build and run the Moddable SDK project as usual for the target device. 

This process is quick and easy for early exploration. Of course, there are many ways it could be streamlined to improve the developer experience.  

## Structure
The Node-RED runtime executes the nodes and flows. This runtime architecture determines how nodes interact with each other. It also is a key factor in how efficiently the execution uses the limited RAM and CPU power available. 

This is a summary of what is implemented in the Node-RED for MCUs runtime:

- [X] Nodes (details below)
	- [X] Disabled nodes are ignored
- [X] Flows
	- [X] Multiple
	- [X] Configuration
	- [X] Disabled flows are ignored
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
	- [ ] Deep copy on send
	- [ ] Asynchronous send
- [X] Instantiation
	- [X] Node-RED exported JSON transferred unchanged to device
	- [X] Parsed on device
	- [X] Instances of classes created from JSON
	- [X] 1:1 map from JSON type to class (maybe not always optimal)

## Nodes
This section lists the supported nodes. The implemented features are checked.

### Comment
- [X] Supported

### Debug
- [X] Console output is displayed in the xsbug log pane
- [X] Sidebar output is displayed in the xsbug message pane
- [X] Display of selected property or complete message
- [ ] Output to node status (maybe meaningless on device)

### Function
- [X] "On Start", "On Message" and "On Stop" handlers
- [X] Access to Node context, flow context, and global context
- [X] Report uncaught exceptions to Catch nodes
- [X] Import modules (Setup)
- [ ] When "On Start" returns Promise, queue received messages until ready
- [ ] Does not wrap `setTimeout` (and friends) to automatically clear on stop

### Inject
- [X] Injects multiple properties
- [X] Property values Boolean, timestamp, JSON, number, and string
- [X] "Inject once after"
- [X] "Repeat after"
- [ ] Interval between times
- [ ] At a specific time
- [ ] Property values flow., global., buffer, expression, environment variable

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

### Range
- [X] Scale property value
- [X] Round to integer
- [X] Select property to map
- [ ] Scale and limit
- [ ] Scale and wrap

### Change
- [X] Delete property
- [X] Move property
- [X] Set property value
- [X] Property values Boolean, timestamp, JSON, number, and string
- [ ] Replace within property value
- [ ] flow. and global. targets
- [ ] Property values buffer, expression, environment variable

### Switch
- [X] Multiple rules
- [X] "checking all rules"
- [X] "stopping after first match"
- [X] ==, !=, <, <=, >, >=, is between, is true, is false, is null, is not null, is of type, otherwise
- [ ] flow., global., expression, env variable
- [ ] is of type: buffer
- [ ] has key, contains, matches regexp, is empty, is not empty, sequence rules, JSONata exp

## Future Work
This prototype is a breadth-first effort to implement all the steps required to execute meaningful Node-RED flows on a resource-constrained microcontroller. For compatibility and completeness, a great deal of work remains. That work requires many different kinds of experience and expertise. Evolving this early proof-of-concept to a generally useful implementation will require contributions from many motivated individuals.

The compatibility goal should be to provide the same behaviors as much as possible so that existing Node-RED developers can apply their knowledge and experience to embedded MCUs without encountered confusing and unnecessary differences. The goal is not to provide all the features of Node-RED, as some are impractical or impossible on the target class of devices.

### Transformation
In this prototype, the nodes and flows exported by Node-RED are converted from JSON to JavaScript instances on the embedded device. This is a relatively heavy operation, involving several passes over the project structure and evaluating JavaScript code. Almost all of this work could be done as a build step on the development computer prior to deploy. Done well, this would free up additional RAM for the project, allow projects to start running faster, and detect use of unsupported Node-RED features earlier. This work should be done sooner than later, as it will change the class definition for the nodes.

- [ ] Create JavaScript tool to convert Node-RED JSON to JavaScript source code
- [ ] Integrate embedded conversion into Deploy feature of Node-RED

### Runtime
- [ ] Align runtime behavior and APIs with Node-RED as much as practical. This would benefit from assistance from developers familiar with Node-RED.
- [ ] Messages sent between nodes should be sent asynchronously to avoid JavaScript stack overflows on long chains of nodes (what does Node-RED do here?)
- [ ] Implement support to instantiate nodes from a [Mod](https://github.com/Moddable-OpenSource/moddable/blob/public/documentation/xs/mods.md). This would allow updated flows to be installed on embedded devices in seconds.

### Nodes
Possible future work on built-in nodes:

- **Common nodes**. The Complete node appears to require Node-RED runtime behaviors beyond what this exploration now implements. It should be implemented sooner to ensure that the object design can support all the fundamental behaviors required.
- **Function nodes**. The Delay, Trigger, and Filter nodes appear to be essential. For the most part they should be straightforward to implement, though some of the behaviors are non-trivial. Exec and Template may not make sense.
- **Network nodes**. The HTTP Request, WebSocket (Client), TCP, and UDP nodes should be possible to implement using ECMA-419 in the same way MQTT has been implemented.
- **Sequence nodes**. The Split, Join, Sort, and Batch nodes should be possible to support. Like the Function nodes, some are quite sophisticated.
- **Parser**. CSV and JSON should be possible to support, but the others (HTML, YAML, XML) are likely impractical.
- **Storage** The Read File and Write File nodes can be supported. Watch probably cannot.

The built-in nodes are useful for compatibility with the standard Node-RED behaviors. Additional nodes should be added to support embedded features. For example, a Preferences node, an ECMA-419 Sensor node, a Display node, etc.

### Challenging Dependencies
Several nodes use [JSONata](https://jsonata.org), a query language for JSON. This looks like a substantial effort to support and is perhaps impractical on a constrained embedded device. Fortunately, it seems like the Function object can do the same, just less conveniently.

The Template node uses [mustache.js](https://mustache.github.io) for powerful string substitution. Like JSONata, this could be impractical to support on embedded. A small subset is probably straightforward to support, if that would be useful.

## Thank You
This exploration was motivated by an extended conversation with [Nick O'Leary](https://github.com/knolleary) who patiently explained Node-RED to me at OpenJS World 2022. That clear and patient discussion gave me grounding to begin this effort.