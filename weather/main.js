import "nodered";
import builder from "flows";
import buildModel from "./ui_nodes";
import { REDApplication }  from "./ui_templates";

export default function() {
	RED.build(builder);
	const model = buildModel();

	return new REDApplication(model, { commandListLength:2048, displayListLength:4096, touchCount:1, pixels: 240 * 8 });
}

