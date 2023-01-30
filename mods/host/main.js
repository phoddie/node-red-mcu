import "nodered";	// import for global side effects
import Modules from "modules";

if (!Modules.has("flows"))
	trace("no flows installed\n");
else {

	const flows = Modules.importNow("flows");
	RED.build(flows);

	if (globalThis.REDTheme) {
		if (!Modules.has("ui_nodes") || !Modules.has("ui_templates"))
			trace("flow neeeds UI nodes; not build into host \n");
		else {
			const buildModel = Modules.importNow("ui_nodes");
			const templates = Modules.importNow("ui_templates");
			const REDApplication = templates.REDApplication; 
			if (REDApplication) {
				try {
					const model = buildModel();
					new REDApplication(model, { commandListLength:4096, displayListLength:+4096, touchCount:1, pixels: 240 * 48 });
				}
				catch {
				}
			}
		}
	} 
}
