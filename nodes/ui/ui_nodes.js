import Modules from "modules";
import Mustache from "mustache";
import { Node } from "nodered";
import {
	buildTheme,
	REDButton,
	REDDropDown,
	REDNumeric,
	REDSlider,
	REDSpacer,
	REDSwitch,
	REDTextRowLeft,
	REDTextRowCenter,
	REDTextRowRight,
	REDTextRowSpread,
	REDTextColumnCenter,
	REDToastDialog,
	REDToastNotification,
	UNIT
}  from "./ui_templates";


const Templates = {
};

function registerTemplate(name, Template) {
	Templates[name] = Template;
}

const ThemeBuilders = [
];

function registerThemeBuilder(ThemeBuilder) {
	ThemeBuilders.push(ThemeBuilder);
}

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
	lookupTemplate(config, Template) {
		const name = config.className;
		let result;
		if (name)
			result = Templates[name];
		if (!result)
			result = Template;
		return result;
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
		ThemeBuilders.forEach(ThemeBuilder => ThemeBuilder(config.theme));
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
		if (this.passthru && (this.msg._msgid != msg._msgid)) {
			this.setter(this.msg, msg);
			this.send(this.msg);
		}
	}
	onStart(config) {
		super.onStart(config);
		this.bgcolor = config.bgcolor;
		this.color = config.color;
		this.label = config.label;
		this.msg = {};
		this.passthru = config.passthru;
		this.setter = config.setter;
		this.Template = this.lookupTemplate(config, REDButton);
	}
	onTap() {
		this.setter(this.msg, {});
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
		
		this.Template = this.lookupTemplate(config, REDDropDown);
		
		this.msg = { topic: config.topic }
	}
}
registerConstructor("ui_dropdown", UIDropDownNode);

class UINumericNode extends UIControlNode {
	constructor(id, flow, name) {
		super(id, flow, name);
	}
	onChanged() {
		this.msg.payload = this.value;
		this.msg.topic = this.topic({});
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
		this.topic = config.topic;
		this.value = this.min;
		this.wrap = config.wrap;
		
		this.Template =  this.lookupTemplate(config, REDNumeric);
		
		this.msg = { };
	}
}
registerConstructor("ui_numeric", UINumericNode);

class UISliderNode extends UIControlNode {
	constructor(id, flow, name) {
		super(id, flow, name);
	}
	onChanged() {
		this.msg.payload = this.value;
		this.msg.topic = this.topic({});
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
		this.topic = config.topic;
		this.passthru = config.passthru;
		this.value = this.min;
		
		this.Template =  this.lookupTemplate(config, REDSlider);
		
		this.msg = { };
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

class UITemplateNode extends UIControlNode {
	constructor(id, flow, name) {
		super(id, flow, name);
	}
	onMessage(msg) {
		this.payload = msg.payload;
		this.container?.delegate("onUpdate");
	}
	onStart(config) {
		super.onStart(config);
		this.payload = "";
		this.Template = this.lookupTemplate(config, REDSpacer);
	}
}
registerConstructor("ui_template", UITemplateNode);

class UISwitchNode extends UIControlNode {
	constructor(id, flow, name) {
		super(id, flow, name);
	}
	onChanged() {
		const option = (this.options({}))[this.selection];
		this.msg.payload = option.payload;
		if (option.topic)
			this.msg.topic = option.topic;
		this.send(this.msg);
	}
	onMessage(msg) {
		this.selection = (this.options(msg)).findIndex(option => option.payload === msg.payload);
		if (this.selection < 0)
			this.selection = 0;
		this.container?.delegate("onUpdate");
		if (this.passthru && (this.msg._msgid != msg._msgid))
			this.send(msg);
	}
	onStart(config) {
		super.onStart(config);
		this.label = config.label;
		this.options = config.options;
		this.passthru = config.passthru;
		this.selection = 0;
		
		this.Template = this.lookupTemplate(config, REDSwitch);
		
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
		
		let Template;
		switch (config.layout) {
		case "row-left": Template = REDTextRowLeft; break;
		case "row-center": Template = REDTextRowCenter; break;
		case "row-right": Template = REDTextRowRight; break;
		case "col-center": Template = REDTextColumnCenter; break;
		default: Template = REDTextRowSpread; break;
		}
		this.Template = this.lookupTemplate(config, Template);
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

class UIToastNode extends UINode {
	constructor(id, flow, name) {
		super(id, flow, name);
	}
	onChanged() {
		this.msg.payload = this.value;
		this.send(this.msg);
	}
	onMessage(msg) {
		this.text = msg.payload;
		application.delegate("onNotify", this);
	}
	onStart(config) {
		super.onStart(config);
		
		this.cancel = config.cancel;
		this.displayTime = Math.round(Number(config.displayTime) * 1000);
		this.highlight = config.highlight;
		this.msg = { topic: config.topic }
		this.ok = config.ok;
		this.position = config.position;
		this.text = "";
		this.value = "";
		
		let Template;
		if (config.position == "dialog")
			Template = REDToastDialog;
		else if (config.position == "prompt") {
			if (Modules.has("ui_text_input"))
				Template = Modules.importNow("ui_text_input");
			else
				Template = REDToastDialog;
		}
		else
			Template = REDToastNotification;
		this.Template = this.lookupTemplate(config, Template);
	}
}
registerConstructor("ui_toast", UIToastNode);

export default function() {
	model.enableTitleBar = model.tabs.length > 1;
	model.tabs.forEach(tab => {
		let height = model.showTitleBar ? 1 : 0;
		tab.enableTitleBar = model.enableTitleBar;
		tab.showTitleBar = model.showTitleBar;
		tab.groups.forEach(group => {
			group.lines = [];
			group.controls.forEach(control => {
				control.measure(group);
				control.position(group);	
			});
			group.height = group.lines.length;
			if (group.disp)
				group.height++;
			height += group.height;
			delete group.lines;
		});
		tab.height = height;
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
		tab.height *= UNIT;
	});
	return model;
}

export { UINode, UIControlNode, registerConstructor, registerTemplate, registerThemeBuilder };
