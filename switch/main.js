import "nodered";
import builder from "flows";
import buildModel from "./ui_nodes";
import { REDApplication }  from "./ui_templates";

export default function() {
	RED.build(builder);
	const model = buildModel();

	return new REDApplication(model, { commandListLength:1024, displayListLength:2048, touchCount:1, pixels: 240 * 2 });
}
