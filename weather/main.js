import "nodered";
import builder from "flows";
import buildModel from "./ui_nodes";
import { REDApplication }  from "./ui_templates";

RED.build(builder);
const model = buildModel();

export default new REDApplication(model, { commandListLength:4096, displayListLength:8192, touchCount:1, pixels: 240 * 64 });
