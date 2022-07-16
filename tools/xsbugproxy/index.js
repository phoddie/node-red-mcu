const net = require('node:net');

const proxyPortIn = 5004;		// proxy listening port

/*
	Moddable SDK prrojects connect to xsbug at loaclhost:5002.
	This proxy listens on loaclhost:5004. To get the Noddable SDK project to connect to the proxy
	requires a manual source code change. On macOS, in $MODDABLE/xs/platforms/mac_xs.c, change 
		address.sin_port = htons(5002);
	to
		address.sin_port = htons(5004);
	Linux and Windows have similar changes. Eventuall We can add an option to mcconfig to set the xsbug
	port. 
*/

const proxyPortOut = 5002;		// xsbug listening port
const trace = false;				// trace progress to console for debugging 
const relay = true;
/*
	When relay is true, proxy relays messages between Moddable SDK project and xsbug.
		This allows using xsbug as usual while proxy has access to all communication.
	When relay is false, no cconnection is made to xsbug. The Moddabe SDK project sends
		messages as-if xsbug is present.
*/ 

const server = net.createServer(target => { 
	if (trace)
		console.log('target connected');

	let xsbug;
	if (relay) {
		// connect to xsbug to be able to relay messages
		xsbug = net.connect({
			port: proxyPortOut,
			host: "localhost"
		});
		xsbug.setEncoding("utf8");
		xsbug.on('ready', data => {
			while (xsbug.deferred.length)
				xsbug.write(xsbug.deferred.shift());
			delete xsbug.deferred;
		});
		xsbug.on('data', data => {
			if (trace)
				console.log("from xsbug: " + data);
			target.write(data);
		});
		xsbug.on('end', () => {
			if (trace)
				console.log('xsbug disconnected');
			target.destroy();
		});
		xsbug.deferred = [];
		xsbug.deferred.push("2");
	}
	else {
	}

	target.setEncoding("utf8");
	let first = true;
	target.on('data', data => {
		if (trace)
			console.log("to xsbug: " + data);
		
		// parse messages here
		// each message is an XML document
		// status messages are sent in a bubble right message of the form:
		// <xsbug><bubble name="" value="2" path="/Users/hoddie/Projects/moddable/examples/helloworld/main.js" line="18">JSON STATUS MESSAGE HERE</bubble></xsbug>

		if (relay) { 
			if (xsbug.deferred)
				xsbug.deferred.push(data);
			else
				xsbug.write(data);
		}
		else {
			if (first) {
				// first time need to send set-all-breakpoints as xsbug does
				first = false;;
				target.write('<set-all-breakpoints><breakpoint path="exceptions" line="0"/></set-all-breakpoints>\r\n');
			}
			else {
				// assume any other messages are a break, so send go. This isn't always corrrect but may always work.
				target.write('<go/>\r\n');
			}
		}
	});
	target.on('end', () => {
		if (trace)
			console.log('target disconnected');
		if (xsbug)
			xsbug.destroy();
	});
});

server.listen(proxyPortIn, () => { 
   console.log('proxy listening');
});
