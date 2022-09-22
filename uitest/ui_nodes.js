import { Node } from "nodered";
import {
	REDButton,
	REDDropDown,
	REDSpacer,
	REDTextRowLeft,
	REDTextRowCenter,
	REDTextRowRight,
	REDTextRowSpread,
	REDTextColumnCenter,
	UNIT
}  from "./ui_templates";

const model = {
	tabs:[],
};

function insert(items, item) {
	const length = items.length;
	for (let index = 0; index < length; index++) {
		if (items[index].order > item.order) {
			items.splice(index, 0, item);
			return;;
		}
	}
	items.push(item);
}

function position(group, control) {
	const lines = group.lines;
	function isEmpty(x, y) {
		if (y >= lines.length)
			return true;
		const line = lines[y];
		if (x >= line.length)
			return false;
		return line[x] ? false : true;
	}
	const groupWidth = group.width;
	const groupHeight = lines.length;
	const width = control.width;
	const height = control.height;
	let x, y, left, top, right, bottom;
	let done = false;
	for (y = 0; y <= groupHeight; y++) {
		for (x = 0; x < groupWidth; x++) {
			if (isEmpty(x, y)) {
				done = true;
				bottom = y + height;
				right = x + width;
				for (top = y; top < bottom; top++) {
					for (left = x; left < right; left++) {
						if (!isEmpty(left, top)) {
							done = false;
							break;
						}
					}
				}
			}
			if (done)
				break;
		}
		if (done)
			break;
	}
	control.left = x;
	control.top = y;
	for (top = groupHeight; top < bottom; top++)
		lines.push(new Uint8Array(groupWidth));
	for (top = y; top < bottom; top++)
		lines[top].fill(1, x, right);
}

class UINode extends Node {
	constructor(id, flow, name) {
		super(id, flow, name);
	}
	onStart(config) {
		super.onStart(config);
		this.type = config.type;
		this.order = parseInt(config.order);
	}
}

class UIControlNode extends UINode {
	constructor(id, flow, name) {
		super(id, flow, name);
	}
	onStart(config) {
		super.onStart(config);
		this.width = parseInt(config.width);
		this.height = parseInt(config.height);
		const groupNode = RED.nodes.getNode(config.group);
		insert(groupNode.controls, this);
	}
}

class UIButtonNode extends UIControlNode {
	constructor(id, flow, name) {
		super(id, flow, name);
	}
	onStart(config) {
		super.onStart(config);
		this.label = config.label;
		this.msg = {
			payload: config.payload,
			topic: config.topic,
		}
		this.Template = REDButton;
	}
	onTap() {
		this.send(this.msg);
	}
}
RED.nodes.registerType("ui_button", UIButtonNode);

class UIDropDownNode extends UIControlNode {
	constructor(id, flow, name) {
		super(id, flow, name);
	}
	onStart(config) {
		super.onStart(config);
		this.label = config.label;
		this.options = config.options.map(option => { 
			return { label:option.label, msg: { payload:option.value, topic:config.topic } }; 
		});
		this.place = config.place;
		this.Template = REDDropDown;
	}
	onSelect(index) {
		this.send(this.options[index].msg);
	}
}
RED.nodes.registerType("ui_dropdown", UIDropDownNode);

class UISpacerNode extends UIControlNode {
	constructor(id, flow, name) {
		super(id, flow, name);
	}
	onStart(config) {
		super.onStart(config);
		this.Template = REDSpacer;
	}
}
RED.nodes.registerType("ui_spacer", UISpacerNode);

class UITextNode extends UIControlNode {
	constructor(id, flow, name) {
		super(id, flow, name);
	}
	onMessage(msg) {
		this.container.delegate("onMessage", msg.payload);
	}
	onStart(config) {
		super.onStart(config);
		this.label = config.label;
		switch (config.layout) {
		case "row-left": this.Template = REDTextRowLeft; break;
		case "row-center": this.Template = REDTextRowCenter; break;
		case "row-right": this.Template = REDTextRowRight; break;
		case "col-center": this.Template = REDTextColumnCenter; break;
		default: this.Template = REDTextRowSpread; break;
		}
		
	}
}
RED.nodes.registerType("ui_text", UITextNode);

class UIGroupNode extends UINode {
	constructor(id, flow, name) {
		super(id, flow, name);
		this.controls = [];
	}
	onStart(config) {
		super.onStart(config);
		this.collapse = config.collapse;
		this.disp = config.disp;
		this.width = parseInt(config.width);
		const tabNode = RED.nodes.getNode(config.tab);
		insert(tabNode.groups, this);
	}
}
RED.nodes.registerType("ui_group", UIGroupNode);

class UITabNode extends UINode {
	constructor(id, flow, name) {
		super(id, flow, name);
		this.groups = [];
	}
	onStart(config) {
		super.onStart(config);
		insert(model.tabs, this);
	}
}
RED.nodes.registerType("ui_tab", UITabNode);

export default function() {
	model.tabs.forEach(tab => {
		tab.groups.forEach(group => {
			group.lines = [];
			if (group.disp)
				group.lines.push(new Uint8Array(group.width).fill(1));
			group.controls.forEach(control => {
				if (control.width == 0)
					control.width = group.width;
				if (control.height == 0)
					control.height = 1;
				position(group, control);	
			});
			group.height = group.lines.length;
			delete group.lines;
		});
	});

	model.tabs.forEach(tab => {
		tab.groups.forEach(group => {
			group.width *= UNIT;
			group.height *= UNIT;
			group.controls.forEach(control => {
				control.left *= UNIT;
				control.width *= UNIT;
				control.top *= UNIT;
				control.height *= UNIT;
			});
		});
	});
	return model;
}