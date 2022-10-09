import { UIControlNode, registerConstructor, registerThemeBuilder } from "ui_nodes";

class UITextInputNode extends UIControlNode {
	constructor(id, flow, name) {
		super(id, flow, name);
	}
	onChanged() {
		this.msg.payload = this.value;
		this.send(this.msg);
	}
	onMessage(msg) {
		this.value = msg.payload;
		this.container?.delegate("onUpdate");
		if (this.passthru && (this.msg._msgid != msg._msgid))
			this.send(msg);
	}
	onStart(config) {
		super.onStart(config);
		this.label = config.label;
		this.mode = config.mode;
		this.passthru = config.passthru;
		this.value = "";
		
		this.Template = this.lookupTemplate(config, REDTextInput);
		
		this.msg = { topic: config.topic }
	}
}
registerConstructor("ui_text_input", UITextInputNode);

import {} from "piu/MC";
import {VerticalExpandingKeyboard} from "keyboard";
import {KeyboardField} from "common/keyboard";

import {
	REDBehavior,
	REDButtonBehavior,
	UNIT
}  from "./ui_templates";

const FieldSkin = Skin.template(Object.freeze({fill:"white"}));
const BackgroundSkin = Skin.template(Object.freeze({ fill:"white" }));

const KeyboardStyle = Style.template(Object.freeze({ font:"18px Roboto", color:"black"  }));
const FieldStyle = Style.template(Object.freeze({ font:"medium 18px Roboto", color: "black", horizontal:"left", vertical:"middle" }));

class REDTextInputBehavior extends REDButtonBehavior {
	onCreate(container, data) {
		super.onCreate(container, data);
	}
	onCancel(container) {
		const application = container.application;
		if (application) {
			const data = this.data;
			delete data.FIELD;
			delete data.KEYBOARD;
			const tab = application.first.first;
			tab.y = this.y;
			application.remove(application.last);
		}
	}
	onOK(container, value) {
		const data = this.data;
		data.value = value;
		data.onChanged();
		this.onUpdate(container);
		this.onCancel(container);
	}
	onTap(container) {
		const data = this.data;
		application.add(new REDTextInputDialog(data));
		const tab = application.first.first;
		const dialog = application.last.last;
		this.y = tab.y;
		tab.y = this.y + dialog.y - container.y;
	}
	onUpdate(container) {
		const data = this.data;
		let string = data.value;
		if (data.mode == "password")
			string = "*".repeat(string.length);
		container.first.string = string;
	}
}

class REDTextInputDialogBehavior extends Behavior {
	onCreate(container, data) {
		this.data = data;
		data.KEYBOARD.add(new VerticalExpandingKeyboard(data, {
			style:new KeyboardStyle(), target:data.FIELD, doTransition:false
		}));
	}
	onKeyboardOK(container, string) {
		this.data.container.defer("onOK", string);
	}
	onTouchEnded(layout, id, x, y, ticks) {
		this.data.container.defer("onCancel");
	}
}

const REDTextInput = Row.template($ => ({
	left:$.left, width:$.width, top:$.top, height:$.height, clip:true,
	contents: [
		$.label ? Label($, { height:UNIT, style:REDTheme.styles.textNameLeft, string:$.label }) : null,
		Content($, { width:10 }),
		Container($, {
			left:0, right:0, top:3, bottom:3, skin:REDTheme.skins.dropDown, active:true, Behavior: REDTextInputBehavior,
			contents: [
				Label($, { left:0, right:0, top:0, bottom:0, style:REDTheme.styles.textValueLeft }),
			],
		}),
		Content($, { width:10 }),
	],
}));

const REDTextInputDialog = Container.template($ => ({
	left:0, right:0, top:0, bottom:0, skin:REDTheme.skins.menuBackground, active:true, Behavior:REDTextInputDialogBehavior,
	contents:[
		Container($, {
			anchor: "KEYBOARD", left:0, right:0, height:185, bottom:0,
		}),
		Row($, {
			left:0, right:0, height:UNIT, bottom:177, active:true, clip:true, skin:new Skin({fill:REDTheme.colors.group}),
			contents: [
				$.label ? Label($, { height:UNIT, style:REDTheme.styles.textNameLeft, string:$.label }) : null,
				Content($, { width:10 }),
				KeyboardField($, { anchor:"FIELD", password:$.mode == "password", left:0, right:0, top:3, bottom:3, state:1, skin:REDTheme.skins.dropDown, style:REDTheme.styles.textValueLeft, string:$.value }),
				Content($, { width:10 }),
			],
		}),
	]
}));
