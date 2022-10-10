import { UIControlNode, registerConstructor } from "ui_nodes";

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
	ButtonBehavior,
	REDBehavior,
	UNIT
}  from "./ui_templates";

const REDKeyboard = Container.template($ => ({
	left:0, right:0, top:0, bottom:0, active:true, 
	Behavior: class extends Behavior {
		onCreate(container, data) {
			this.data = data;
			data.KEYBOARD.add(new VerticalExpandingKeyboard(data, {
				style:REDTheme.styles.keyboard, target:data.FIELD, doTransition:false
			}));
		}
		onKeyboardOK(container, string) {
			this.data.container.defer("onTextInputOK", string);
		}
		onTouchEnded(layout, id, x, y, ticks) {
			this.data.container.defer("onTextInputCancel");
		}
	},
	contents:[
		Container($, {
			anchor:"KEYBOARD", left:0, right:0, height:185, bottom:0,
		}),
	]
}));

const REDTextField = Container.template($ => ({
	anchor:"FIELD", left:0, right:0, top:0, bottom:0, active:true,
	Behavior: class extends ButtonBehavior {
		onTap(container) {
			container.bubble("onPrompt");
		}
		onDisplaying(container) {
			super.onDisplaying(container);
			this.onUpdate(container);
		}
		onUpdate(container) {
			const data = this.data;
			let string = data.value;
			if (data.mode == "password")
				string = "*".repeat(string.length);
			container.last.string = string;
		}
	},
	contents: [
		Content($, { left:10, right:10, height:1, bottom:3, skin:REDTheme.skins.textField }),
		Label($, { left:0, right:0, top:0, bottom:0, style:REDTheme.styles.textField }),
	],
}));

class REDKeyboardInputBehavior extends REDBehavior {
	getMovablePart(container) {
		debugger;
	}
	onPrompt(container) {
		const data = this.data;
		const former = data.FIELD;
		const current = new KeyboardField(data, { anchor:"FIELD", password:data.mode == "password", left:0, right:0, top:0, bottom:0, style:REDTheme.styles.textField, string:data.value });
		current.first.state = current.last.state = 1;
		former.container.replace(former, current);
		application.add(new REDKeyboard(data));
		const part = this.getMovablePart(container);
		this.y = part.y;
		part.y = (this.y + screen.height - 177 - UNIT) - current.y;
	}
	onTextInputCancel(container) {
		const application = container.application;
		if (application) {
			const data = this.data;
			const former = data.FIELD;
			const current = new REDTextField(data, {});
			former.container.replace(former, current);
			delete data.KEYBOARD;
			const part = this.getMovablePart(container);
			part.y = this.y;
			application.remove(application.last);
		}
	}
	onTextInputOK(container, value) {
		const data = this.data;
		data.value = value;
		this.onTextInputCancel(container);
	}
	onUndisplaying(container) {
		super.onUndisplaying(container);
		delete this.data.FIELD;
	}
}

class REDTextInputBehavior extends REDKeyboardInputBehavior {
	getMovablePart(container) {
		return application.first.first;
	}
	onTextInputOK(container, value) {
		super.onTextInputOK(container, value);
		this.data.onChanged();
	}
}
const REDTextInput = Row.template($ => ({
	left:$.left, width:$.width, top:$.top, height:$.height, clip:true, Behavior:REDTextInputBehavior,
	contents: [
		$.label ? Label($, { height:UNIT, style:REDTheme.styles.textNameLeft, string:$.label }) : null,
		Container($, {
			left:0, right:0, top:0, bottom:0,
			contents: [
				REDTextField($, {}),
			]
		}),
	],
}));

class REDToastPromptBehavior extends REDKeyboardInputBehavior {
	getMovablePart(container) {
		return container.first;
	}
	onClose(container, value) {
		const application = container.application;
		if (application)
			application.remove(container);
		this.data.value = value;
		this.data.onChanged();
	}
	onDisplaying(container) {
		super.onDisplaying(container);
		const column = container.first;
		column.coordinates = { width:column.width, top:column.y - container.y, height:column.height };
	}
}
const REDToastPrompt = Container.template($ => ({
	left:0, right:0, top:0, bottom:0, skin:REDTheme.skins.menuBackground, Behavior:REDToastPromptBehavior,
	contents: [
		Column($, {
			width:240, skin:REDTheme.skins.toast,
			contents: [
				Text($, { left:0, right:0, style:REDTheme.styles.notification, string:$.text }),
				Container($, {
					left:0, right:0, height:UNIT,
					contents: [
						REDTextField($, {}),
					],
				}),
				Content($, { height: 10 }),
				Row($, {
					right:10, height:UNIT,
					contents: [
						($.cancel) ? Container($, {
							width:110, height:UNIT, skin:REDTheme.skins.button, clip:true, active:true, 
							Behavior: class extends ButtonBehavior{
								onTap(container) {
									container.bubble("onClose", this.data.cancel);
								}
							},
							contents: [
								Label($, { top:0, bottom:0, style:REDTheme.styles.button, string:$.cancel }),
							],
						}) : null,
						Container($, {
							width:110, height:UNIT, skin:REDTheme.skins.button, clip:true, active:true, 
							Behavior: class extends ButtonBehavior{
								onTap(container) {
									container.bubble("onClose", this.data.value ?? this.data.ok);
								}
							},
							contents: [
								Label($, { top:0, bottom:0, style:REDTheme.styles.button, string:$.ok }),
							],
						}),
					],
				}),
				Content($, { height: 10 }),
			]
		}),
	],
}));
export default REDToastPrompt;