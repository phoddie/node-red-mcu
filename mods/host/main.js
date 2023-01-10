import "nodered";	// import for global side effects
import Modules from "modules";

if (Modules.has("flows")) {
	const flows = Modules.importNow("flows");
	RED.build(flows);
}
else
	trace("no flows installed\n");
