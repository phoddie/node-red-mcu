import Mustache from "mustache";
import { Node } from "nodered";
import {
	buildTheme,
	REDButton,
	REDDropDown,
	REDGauge,
	REDGaugeCompass,
	REDGaugeDonut,
	REDNumeric,
	REDSlider,
	REDSpacer,
	REDSwitch,
	REDTextRowLeft,
	REDTextRowCenter,
	REDTextRowRight,
	REDTextRowSpread,
	REDTextColumnCenter,
	UNIT
}  from "./ui_templates";

const model = {
	selection: 0,
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

function registerConstructor(type, constructor) {
	constructor.type = type;
	RED.nodes.registerType(type, constructor);
}

class UINode extends Node {
	constructor(id, flow, name) {
		super(id, flow, name);
	}
	onStart(config) {
		super.onStart(config);
		this.order = parseInt(config.order);
	}
}

class UIBaseNode extends Node {
	constructor(id, flow, name) {
		super(id, flow, name);
	}
	onStart(config) {
		super.onStart(config);
		model.showTitleBar = config.site.hideToolbar == "false";
		buildTheme(config.theme);
	}
}
registerConstructor("ui_base", UIBaseNode);

class UIControlNode extends UINode {
	constructor(id, flow, name) {
		super(id, flow, name);
	}
	onStart(config) {
		super.onStart(config);
		const groupNode = RED.nodes.getNode(config.group);
		insert(groupNode.controls, this);
		this.width = parseInt(config.width);
		this.height = parseInt(config.height);
	}
	measure(group) {
		if (this.width == 0)
			this.width = group.width;
		if (this.height == 0)
			this.height = 1;
	}
	position(group) {
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
		const width = this.width;
		const height = this.height;
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
		this.left = x;
		this.top = y;
		for (top = groupHeight; top < bottom; top++)
			lines.push(new Uint8Array(groupWidth));
		for (top = y; top < bottom; top++)
			lines[top].fill(1, x, right);
	}
}

class UIButtonNode extends UIControlNode {
	constructor(id, flow, name) {
		super(id, flow, name);
	}
	onMessage(msg) {
		if (this.passthru && (this.msg._msgid != msg._msgid))
			this.send(this.msg);
	}
	onStart(config) {
		super.onStart(config);
		this.bgcolor = config.bgcolor;
		this.color = config.color;
		this.label = config.label;
		this.msg = {
			payload: config.payload,
			topic: config.topic,
		}
		this.passthru = config.passthru;
		this.Template = REDButton;
	}
	onTap() {
		this.send(this.msg);
	}
}
registerConstructor("ui_button", UIButtonNode);

class UIDropDownNode extends UIControlNode {
	constructor(id, flow, name) {
		super(id, flow, name);
	}
	onChanged() {
		this.msg.payload = this.options[this.selection].value;
		this.send(this.msg);
	}
	onMessage(msg) {
		this.selection = this.options.findIndex(option => option.value == msg.payload);
		this.container?.delegate("onUpdate");
		if (this.passthru && (this.msg._msgid != msg._msgid))
			this.send(msg);
	}
	onStart(config) {
		super.onStart(config);
		this.label = config.label;
		this.options = config.options;
		this.passthru = config.passthru;
		this.placeHolder = config.place;
		this.selection = -1;
		
		this.Template = REDDropDown;
		
		this.msg = { topic: config.topic }
	}
}
registerConstructor("ui_dropdown", UIDropDownNode);

class UIGaugeNode extends UIControlNode {
	constructor(id, flow, name) {
		super(id, flow, name);
	}
	onMessage(msg) {
		const { min, max } = this;
		let value = Number(msg.payload);
		if (value < min)
			value = min;
		else if (value > max)
			value = max;
		this.value = value;
		this.container?.delegate("onUpdate");
	}
	onStart(config) {
		super.onStart(config);
		this.colors = config.colors;
		this.label = config.label;
		const min = this.min = config.min;
		const max = this.max = config.max;
		let seg1 = config.seg1;
		let seg2 = config.seg2;
		if ((seg1 != "") && (seg2 != "")) {
			seg1 =  Math.min(max, Math.max(min, Number(seg1)));
			seg2 =  Math.min(max, Math.max(min, Number(seg2)));
			this.seg1 = Math.min(seg1, seg2);
			this.seg2 = Math.max(seg1, seg2);
		}
		else {
			this.seg1 = undefined;
			this.seg2 = undefined;
		}
		this.title = config.title;
		this.value = this.min;
		switch (config.gtype) {
		case "compass": this.Template = REDGaugeCompass; break;
		case "donut": this.Template = REDGaugeDonut; break;
		default: this.Template = REDGauge; break;
		}
	}
	measure(group) {
		if (this.width == 0)
			this.width = group.width;
		if (this.height == 0) {
			this.height = group.width >> 1;
			if (this.title)
				this.height++;
		}
	}
}
registerConstructor("ui_gauge", UIGaugeNode);

class UINumericNode extends UIControlNode {
	constructor(id, flow, name) {
		super(id, flow, name);
	}
	onChanged() {
		this.msg.payload = this.value;
		this.send(this.msg);
	}
	onMessage(msg) {
		const { min, max, step } = this;
		let value = parseInt(msg.payload);
		if (value < min)
			value = min;
		else if (value > max)
			value = max;
		else
			value = Math.round(value / step) * step;
		this.value = value;
		this.container?.delegate("onUpdate");
		if (this.passthru && (this.msg._msgid != msg._msgid))
			this.send(msg);
	}
	onStart(config) {
		super.onStart(config);
		this.label = config.label;
		this.min = config.min;
		this.max = config.max;
		this.step = config.step;
		this.passthru = config.passthru;
		this.value = this.min;
		this.wrap = config.wrap;
		
		this.Template = REDNumeric;
		
		this.msg = { topic: config.topic }
	}
}
registerConstructor("ui_numeric", UINumericNode);

class UISliderNode extends UIControlNode {
	constructor(id, flow, name) {
		super(id, flow, name);
	}
	onChanged() {
		this.msg.payload = this.value;
		this.send(this.msg);
	}
	onMessage(msg) {
		const { min, max, step } = this;
		let value = parseInt(msg.payload);
		if (value < min)
			value = min;
		else if (value > max)
			value = max;
		else
			value = Math.round(value / step) * step;
		this.value = value;
		this.container?.delegate("onUpdate");
		if (this.passthru && (this.msg._msgid != msg._msgid))
			this.send(msg);
	}
	onStart(config) {
		super.onStart(config);
		this.continuous = config.outs == "all";
		this.label = config.label;
		this.min = config.min;
		this.max = config.max;
		this.step = config.step;
		this.passthru = config.passthru;
		this.value = this.min;
		
		this.Template = REDSlider;
		
		this.msg = { topic: config.topic }
	}
}
registerConstructor("ui_slider", UISliderNode);

class UISpacerNode extends UIControlNode {
	constructor(id, flow, name) {
		super(id, flow, name);
	}
	onStart(config) {
		super.onStart(config);
		this.Template = REDSpacer;
	}
}
registerConstructor("ui_spacer", UISpacerNode);

class UISwitchNode extends UIControlNode {
	constructor(id, flow, name) {
		super(id, flow, name);
	}
	onChanged() {
		this.msg.payload = this.options[this.selection].value;
		this.send(this.msg);
	}
	onMessage(msg) {
		this.selection = this.options.findIndex(option => option.value == msg.payload);
		if (this.selection < 0)
			this.selection = 0;
		this.container?.delegate("onUpdate");
		if (this.passthru && (this.msg._msgid != msg._msgid))
			this.send(msg);
	}
	onStart(config) {
		super.onStart(config);
		this.label = config.label;
		this.options = [
			{ value:config.offvalue, type:config.offvalueType },
			{ value:config.onvalue, type:config.onvalueType },
		];
		this.passthru = config.passthru;
		this.selection = 0;
		
		this.Template = REDSwitch;
		
		this.msg = { topic: config.topic }
	}
}
registerConstructor("ui_switch", UISwitchNode);

class UITextNode extends UIControlNode {
	constructor(id, flow, name) {
		super(id, flow, name);
	}
	onMessage(msg) {
		this.value = Mustache.render(this.format, { msg });
		this.container?.delegate("onUpdate");
	}
	onStart(config) {
		super.onStart(config);
		this.format = config.format;
		this.label = config.label;
		this.value = "";
		
		switch (config.layout) {
		case "row-left": this.Template = REDTextRowLeft; break;
		case "row-center": this.Template = REDTextRowCenter; break;
		case "row-right": this.Template = REDTextRowRight; break;
		case "col-center": this.Template = REDTextColumnCenter; break;
		default: this.Template = REDTextRowSpread; break;
		}
	}
}
registerConstructor("ui_text", UITextNode);

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
registerConstructor("ui_group", UIGroupNode);

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
registerConstructor("ui_tab", UITabNode);

export default function() {
	model.enableTitleBar = model.tabs.length > 1;
	model.tabs.forEach(tab => {
		tab.enableTitleBar = model.enableTitleBar;
		tab.showTitleBar = model.showTitleBar;
		tab.groups.forEach(group => {
			group.lines = [];
			if (group.disp)
				group.lines.push(new Uint8Array(group.width).fill(1));
			group.controls.forEach(control => {
				control.measure(group);
				control.position(group);	
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