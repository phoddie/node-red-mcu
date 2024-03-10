import {} from "piu/MC";
import config from "mc/config";

import { HorizontalScrollerBehavior, VerticalScrollerBehavior } from "ScrollerBehaviors";

const textures = Object.freeze({
	button: { path:"button.png" },
	glyphs: { path:"glyphs.png" },
	popup: { path:"popup.png" },
	slider: { path:"slider.png" },
	switch: { path:"switch.png" },
}, true);
const UNIT = 40;

function buildTheme(theme) {
	const gray = "#949494";
	const BLACK = "black";
	const TRANSPARENT = "transparent";
	const WHITE = "white";

	const base = theme.themeState["base-color"].value;

	const page = theme.themeState["page-backgroundColor"].value;
	const sideBar = theme.themeState["page-sidebar-backgroundColor"].value;
	const title = theme.themeState["page-titlebar-backgroundColor"].value;
	
	const group = theme.themeState["group-backgroundColor"].value;
	const groupBorder = theme.themeState["group-borderColor"].value;
	const groupText = theme.themeState["group-textColor"].value;
	
	const widget = theme.themeState["widget-backgroundColor"].value;
	const widgetBorder = theme.themeState["widget-borderColor"].value;
	const widgetText = theme.themeState["widget-textColor"].value;

	const halfGray = blendColors(0.5,group,gray);
	const halfWidget = blendColors(0.5,group,widget);
    //const FONT = RED.util.getSetting(node, 'DASHBOARD_FONT') ?? "Roboto";
	const FONT = (config.DASHBOARD_FONT) ? config.DASHBOARD_FONT : "Roboto";
	const result = {
		colors: {
			gauge: halfGray,
			group,
			halfGray,
			transparent: TRANSPARENT,
			white: WHITE,
			widget,
			widgetText,
		},
		skins: {},
		styles: {
			chartNoData: new Style({ font:`18px ${FONT}`, color:halfGray, horizontal:"center" }),
			chartX: new Style({ font:`medium 12px ${FONT}`, color:widgetText, horizontal:"center" }),
			chartY: new Style({ font:`medium 12px ${FONT}`, color:widgetText, horizontal:"right" }),
			notification: new Style({ font:`18px ${FONT}`, color:widgetText, horizontal:"left", left:10, right:10, top:10, bottom:10 }),
			keyboard: new Style({ font:`18px ${FONT}`, color:BLACK }),
			textName: new Style({ font:`18px ${FONT}`, color:widgetText, left:5, right:5 }),
			textValue: new Style({ font:`medium 18px ${FONT}`, color:widgetText, left:5, right:5 }),
			textNameLeft: new Style({ font:`18px ${FONT}`, color:widgetText, horizontal:"left", left:10 }),
			textValueLeft: new Style({ font:`medium 18px ${FONT}`, color:widgetText, horizontal:"left", left:10 }),
			textNameRight: new Style({ font:`18px ${FONT}`, color:widgetText, horizontal:"right", right:10 }),
			textValueRight: new Style({ font:`medium 18px ${FONT}`, color:widgetText, horizontal:"right", right:10 }),
			textField: new Style({ font:`medium 18px ${FONT}`, color:[TRANSPARENT,widgetText,widgetText,widget], horizontal:"left", left:10 }),
		},
		textures: {
		}
	};
	
	result.skins.menuBackground = new Skin({ fill:blendColors(0.5,TRANSPARENT,page) }),
	result.skins.tab = new Skin({ fill:page });
	
	result.skins.title = new Skin({ fill:[title,title,title,blendColors(0.25,title,WHITE)] });
	result.styles.title = new Style({ font:`medium 18px ${FONT}`, color:WHITE, horizontal:"left" });
	result.skins.titleIcon = new Skin({ texture:textures.glyphs, color:WHITE, x:0, y:0, width:40, height:40 });
	result.skins.titleMenu = new Skin({ fill:sideBar, stroke:title, left:1, right:1, top:1, bottom:1 }),
	result.skins.titleMenuItem = new Skin({ fill:[TRANSPARENT,TRANSPARENT,TRANSPARENT,title] });
	result.styles.titleMenuItem = new Style({ font:`medium 18px ${FONT}`, color:[halfGray,groupText,groupText,WHITE], horizontal:"left" });
	result.skins.titleMenuItemIcon = new Skin({ texture:textures.glyphs, color:[halfGray,groupText,groupText,WHITE], x:200, y:0, width:40, height:40 });
	
	result.skins.group = new Skin({ fill:group, stroke:groupBorder, bottom:1 });
	result.styles.group = new Style({ font:`medium 18px ${FONT}`, color:[groupText,groupText,groupText,groupText], horizontal:"left" });
	result.skins.groupIcon = new Skin({ texture:textures.glyphs, color:[groupText,groupText,groupText,groupText], x:40, y:0, width:40, height:40, variants:40 });
	
	result.skins.button = new Skin({ texture:textures.button, color:[TRANSPARENT,widget,widget,blendColors(0.25,widget,WHITE)], x:0, y:0, width:60, height:60, left:20, right:20, top:20, bottom:20 });
	result.styles.button = new Style({ font:`medium 18px ${FONT}`, color:[halfGray,WHITE,WHITE,WHITE] });
	
// 	result.skins.dropDown = new Skin({ texture:textures.popup, color:[TRANSPARENT,TRANSPARENT,TRANSPARENT,widget], x:0, y:0, width:60, height:60, left:20, right:20, top:20, bottom:20 });
	result.skins.dropDown = new Skin({ fill:[TRANSPARENT,TRANSPARENT,TRANSPARENT,widget], stroke:[TRANSPARENT,halfGray,halfGray,widget], left:1, right:1, top:1, bottom:1 }),
	result.styles.dropDown = new Style({ font:`medium 18px ${FONT}`, color:[halfGray,widgetText,widgetText,WHITE], horizontal:"left", left:10 });
	result.skins.dropDownIcon = new Skin({ texture:textures.glyphs, color:[halfGray,widgetText,widgetText,WHITE], x:160, y:0, width:40, height:40 });
	result.skins.dropDownMenu = new Skin({ fill:group, stroke:widget, left:1, right:1, top:1, bottom:1 }),
	result.skins.dropDownMenuItem = new Skin({ fill:[TRANSPARENT,TRANSPARENT,TRANSPARENT,widget] });
	result.styles.dropDownMenuItem = new Style({ font:`medium 18px ${FONT}`, color:[halfGray,widgetText,widgetText,WHITE], horizontal:"left", left:10 });
	result.skins.dropDownMenuItemIcon = new Skin({ texture:textures.glyphs, color:[halfGray,widgetText,widgetText,WHITE], x:200, y:0, width:40, height:40 });
	
	result.skins.numericLeft = new Skin({ texture:textures.button, color:[TRANSPARENT,TRANSPARENT,TRANSPARENT,widget], x:0, y:0, width:60, height:60, left:20, right:20, top:20, bottom:20 });
	result.skins.numericLess = new Skin({ texture:textures.glyphs, color:[halfGray,widgetText,widgetText,WHITE], x:240, y:0, width:40, height:40 });
	result.skins.numericRight = new Skin({ texture:textures.button, color:[TRANSPARENT,TRANSPARENT,TRANSPARENT,widget], x:0, y:0, width:60, height:60, left:20, right:20, top:20, bottom:20 });
	result.skins.numericMore = new Skin({ texture:textures.glyphs, color:[halfGray,widgetText,widgetText,WHITE], x:280, y:0, width:40, height:40 });
	
	result.skins.sliderBar = new Skin({ texture:textures.slider, color:[halfGray,halfWidget], x:0, y:0, width:80, height:40, left:20, right:20 });
	result.skins.sliderThumb = new Skin({ texture:textures.slider, color:widget, x:80, y:0, width:40, height:40 });
	
	result.skins.switchBar = new Skin({ texture:textures.switch, color: [TRANSPARENT,halfGray,halfWidget], x:0, y:0, width:60, height:40 });
	result.skins.switchThumb = new Skin({ texture:textures.switch, color: [TRANSPARENT,gray,widget], x:60, y:0, width:40, height:40 });
	
	result.skins.compass = new Skin({ fill:widget, stroke:widget });
	
	result.skins.toast = new Skin({ fill:group, stroke:widget, left:2, right:2, top:2, bottom:2 }),
	result.skins.textField = new Skin({ stroke:[TRANSPARENT,widgetText,widgetText,widget], bottom:1 });
	
	globalThis.REDTheme = result;
}

class ButtonBehavior extends Behavior {
	changeState(container, state) {
		container.state = state;
		var content = container.first;
		while (content) {
			content.state = state;
			content = content.next;
		}
	}
	onCreate(container, data) {
		this.data = data;
	}
	onDisplaying(container) {
		this.onStateChanged(container);
	}
	onStateChanged(container) {
		this.changeState(container, container.active ? 1 : 0);
	}
	onTap(container) {
	}
	onTouchBegan(container, id, x, y, ticks) {
		this.changeState(container, 3);
// 		container.captureTouch(id, x, y, ticks);
	}
	onTouchCancelled(container, id, x, y, ticks) {
		this.changeState(container, 1);
	}
	onTouchEnded(container, id, x, y, ticks) {
		if (container.hit(x, y)) {
			this.onTap(container);
		}
		this.changeState(container, 1);
	}
	onTouchMoved(container, id, x, y, ticks) {
// 		this.changeState(container, container.hit(x, y) ? 3 : 2);
	}
};

class PopupMenuBehavior extends Behavior {	
	onClose(layout, index) {
		let data = this.data;
		application.remove(application.last);
		data.button.delegate("onMenuSelected", index);
	}
	onCreate(layout, data) {
		this.data = data;
	}
	onFitVertically(layout, value) {
		debugger
	}
	onTouchEnded(layout, id, x, y, ticks) {
		if (layout.application) {
			this.onClose(layout, -1);
		}
	}
};

class PopupMenuItemBehavior extends ButtonBehavior {
	onTap(item, id, x, y, ticks) {
		item.bubble("onClose", item.index);
	}
}

class REDBehavior extends Behavior {
	onCreate(container, data) {
		this.data = data;
		data.container = container;
	}
	onDisplaying(container) {
		this.onUpdate(container);
	}
	onUndisplaying(container) {
		this.data.container = null;
	}
	onUpdate(container) {
	}
}

class REDButtonBehavior extends REDBehavior {
	changeState(container, state) {
		container.state = state;
		var content = container.first;
		while (content) {
			content.state = state;
			content = content.next;
		}
	}
	onCreate(container, data) {
		super.onCreate(container, data);
		let { bgcolor, color } = data;
		if (color) {
			container.first.style = new Style({ font:`medium 18px ${FONT}`, color:[REDTheme.colors.halfGray,color,color,color] });
		}
		if (bgcolor || color) {
			if (!bgcolor) bgcolor = REDTheme.colors.widget;
			if (!color) color = REDTheme.colors.white;
			container.skin = new Skin({ texture:textures.button, color:[REDTheme.colors.transparent,bgcolor,bgcolor,blendColors(0.25,bgcolor,color)], x:0, y:0, width:60, height:60, left:20, right:20, top:20, bottom:20 });
		}
	}
	onDisplaying(container) {
		super.onDisplaying(container);
		this.changeState(container, container.active ? 1 : 0);
	}
	onTap(container) {
		this.data.onTap();
	}
	onTouchBegan(container, id, x, y, ticks) {
		this.changeState(container, 3);
	}
	onTouchCancelled(container, id, x, y, ticks) {
		this.changeState(container, 1);
	}
	onTouchEnded(container, id, x, y, ticks) {
		this.changeState(container, 1);
		this.onTap(container);
	}
}
let REDButton = Container.template($ => ({
	left:$.left, width:$.width, top:$.top, height:$.height, skin:REDTheme.skins.button, clip:true, active:true, Behavior: REDButtonBehavior,
	contents: [
		Label($, { top:0, bottom:0, style:REDTheme.styles.button, string:$.label }),
	],
}));

class REDDropDownBehavior extends REDButtonBehavior {
	onCreate(container, data) {
		super.onCreate(container, data);
		let style = REDTheme.styles.dropDownMenuItem;
		let size = style.measure(data.placeHolder);
		let width = size.width;
		data.options.forEach(option => {
			size = style.measure(option.label);
			if (width < size.width)
				width = size.width;
		});
		width = (Math.floor(width / UNIT) + 1) * UNIT;
		width += UNIT;
		container.coordinates = {left:0, width, top:0, bottom:0};
	}
	onMenuSelected(container, index) {
		if ((index >= 0) && (this.selection != index)) {
			let data = this.data;
			data.selection = index;
			data.onChanged();
			this.onUpdate(container);
		}
	}
	onTap(container) {
		let data = this.data;
		let it = {
			button: container,
			items: data.options,
			selection: data.selection,
		};
		application.add(new REDDropDownMenu(it));
	}
	onUpdate(container) {
		const data = this.data;
		const selection = data.selection;
		container.first.string = (selection < 0) ? data.placeHolder : data.options[selection].label;
	}
}
let REDDropDown = Row.template($ => ({
	left:$.left, width:$.width, top:$.top, height:$.height, clip:true,
	contents: [
		Label($, { left:0, right:0, top:0, bottom:0, style:REDTheme.styles.textNameLeft, string:$.label }),
		Row($, {
			width:0, top:0, bottom:0, skin:REDTheme.skins.dropDown, active:true, Behavior: REDDropDownBehavior,
			contents: [
				Label($, { left:0, right:0, top:0, bottom:0, style:REDTheme.styles.dropDown }),
				Content($, { width:UNIT, top:0, bottom:0, skin:REDTheme.skins.dropDownIcon  }),
			],
		})
	],
}));
let REDDropDownMenu = Layout.template($ => ({
	left:0, right:0, top:0, bottom:0, active:true, backgroundTouch:true, skin:REDTheme.skins.menuBackground,
	Behavior: class extends PopupMenuBehavior {	
		onFitVertically(layout, value) {
			let data = this.data;
			let button = data.button;
			let container = layout.first;
			let scroller = container.first;
			let layoutHeight = application.height;
			let menuHeight = data.items.length * UNIT;
			let y, height;
			if (layoutHeight > menuHeight) {
				y = (data.selection >= 0) ? button.y - (data.selection * UNIT) : button.y + UNIT;
				if (y < 0)
					y = 0;
				else if (y > layoutHeight - menuHeight)
					y = layoutHeight - menuHeight;
				height = menuHeight;
			}
			else {
				y = 0;
				height = layoutHeight;
			}
			container.coordinates = { left:button.x, width:button.width, top:y, height:height };
			scroller.coordinates = { left:0, width:button.width, top:0, height:height };
			if (data.selection >= 0)
				scroller.first.content(data.selection).last.visible = true;
			return value;
		}
	},
	contents: [
		Container($, {
			clip:true, skin:REDTheme.skins.dropDownMenu, state:1,
			contents:[
				Scroller($, { active:true, backgroundTouch:true, Behavior:VerticalScrollerBehavior, 
					contents:[
						Column($, { left:0, right:0, top:0, 
							contents: $.items.map($$ => new REDDropDownMenuItem($$)),
						}),
					]
				}),
			]
		}),
	],
}));
let REDDropDownMenuItem = Row.template($ => ({
	left:0, right:0, height:UNIT, skin:REDTheme.skins.dropDownMenuItem, active:true,
	Behavior: PopupMenuItemBehavior,
	contents: [
		Label($, { left:0, right:0, top:0, bottom:0, style:REDTheme.styles.dropDownMenuItem, string:$.label }),
		Content($, { width:UNIT, top:0, bottom:0, skin:REDTheme.skins.dropDownMenuItemIcon, visible:false  }),
	],
}));

class REDNumericBehavior extends REDBehavior {
	onTrack(container, direction) {
		const data = this.data;
		const { min, max, step, wrap } = data;
		let value = data.value + (direction * step);
		if (value < min) {
			value = wrap ? max : min;
		}
		else if (value > max) {
			value = wrap ? min : max;
		}
		if (data.value != value) {
			data.value = value;
			data.onChanged();
		}
		this.onUpdate(container);
	}
	onUpdate(container) {
		container.first.next.string = this.data.value;
	}
};
class REDNumericButtonBehavior extends ButtonBehavior {
	onFinished(container) {
		let count = this.count;
		let duration = (count >= 50) ? 50 : (50 - count) * 5;
		this.onTap(container);
		this.count = count + 1;
		container.duration = duration;
		container.time = 0;
		container.start();
	}
	onTouchBegan(container, id, x, y, ticks) {
		this.changeState(container, 3);
		this.onTap(container);
		this.count = 0;
		container.duration = 500;
		container.time = 0;
		container.start();
	}
	onTouchCancelled(container, id, x, y, ticks) {
		this.changeState(container, 1);
		container.stop();
	}
	onTouchEnded(container, id, x, y, ticks) {
		this.changeState(container, 1);
		container.stop();
	}
	onTap(container) {
		container.bubble("onTrack", this.data);
	}
};
let REDNumeric = Row.template($ => ({
	left:$.left, width:$.width, top:$.top, height:$.height, clip:true,
	contents: [
		Label($, { left:0, right:0, top:0, bottom:0, style:REDTheme.styles.textNameLeft, string:$.label }),
		Row($, {
			width:3*UNIT, height:UNIT, Behavior:REDNumericBehavior,
			contents: [
				Container(-1, {
					width:UNIT, height:UNIT, skin:REDTheme.skins.numericLeft, active:true, Behavior:REDNumericButtonBehavior,
					contents: [
						Content($, { width:UNIT, height:UNIT, skin:REDTheme.skins.numericLess }),
					],
				}),
				Label($, { width:UNIT, height:UNIT, style:REDTheme.styles.textValue, state:1 }),
				Container(1, {
					width:UNIT, height:UNIT, skin:REDTheme.skins.numericRight, active:true, Behavior:REDNumericButtonBehavior,
					contents: [
						Content($, { width:UNIT, height:UNIT, skin:REDTheme.skins.numericMore }),
					],
				}),
			],
		}),
	],
}));

class REDSliderBehavior extends REDBehavior {
	onTouchBegan(container, id, x, y, ticks) {
		container.captureTouch(id, x, y, ticks);
		this.onTouchMoved(container, id, x, y, ticks);
	}
	onTouchMoved(container, id, x, y, ticks) {
		const data = this.data;
		const min = data.min;
		const max = data.max;
		const step = data.step;
		const width = container.last.width;
		let fraction = (x - (container.x + (width >> 1))) / (container.width - width);
		let value = min + (fraction * (max - min));
		if (value < min)
			value = min;
		else if (value > max)
			value = max;
		else
			value = Math.round(value / step) * step;
		data.value = value;
		if (data.continuous)
			data.onChanged();
		this.onUpdate(container);
	}
	onTouchEnded(container, id, x, y, ticks) {
		this.data.onChanged();
	}
	onUpdate(container) {
		var button = container.last;
		var bar = button.previous;
		const data = this.data;
		const min = data.min;
		const max = data.max;
		const value = data.value;
		const x = container.x;
		const width = container.width - button.width;
		const offset = Math.round(((value - min) / (max - min)) * width);
		bar.width = offset + button.width;
		button.x = x + offset;
	}
};
let REDSlider = Row.template($ => ({
	left:$.left, width:$.width, top:$.top, height:$.height, clip:true,
	contents: [
		$.label ? Label($, { height:UNIT, style:REDTheme.styles.textNameLeft, string:$.label }) : null,
		Container($, {
			left:0, right:0, height:UNIT, active:true, Behavior:REDSliderBehavior,
			contents: [
				Content($, { left:0, right:0, top:0, bottom:0, skin:REDTheme.skins.sliderBar }),
				Content($, { left:0, width:0, top:0, bottom:0, skin:REDTheme.skins.sliderBar, state:1 }),
				Content($, { left:0, width:UNIT, top:0, bottom:0, skin:REDTheme.skins.sliderThumb  }),
			],
		}),
	],
}));

let REDSpacer = Content.template($ => ({
	left:$.left, width:$.width, top:$.top, height:$.height
}));

class REDSwitchBehavior extends REDBehavior {
	changeOffset(container, offset) {
		var bar = container.first;
		var button = bar.next;
		if (offset < 0)
			offset = 0;
		else if (offset > this.size)
			offset = this.size;
		else
			offset = Math.round(offset);
		this.offset = offset;
		bar.state = button.state = container.active ? 1 + (this.offset / this.size) : 0;
		button.x = bar.x + this.offset + 1;
	}
	onDisplaying(container) {
		var bar = container.first;
		var button = bar.next;
		this.size = bar.width - button.width;
		super.onDisplaying(container);
	}
	onTimeChanged(container) {
		this.changeOffset(container, this.anchor + Math.round(this.delta * container.fraction));
	}
	onTouchBegan(container, id, x, y, ticks) {
		if (container.running) {
			container.stop();
			container.time = container.duration;
		}
		this.anchor = x;
		this.moved = false;
		this.delta = this.offset;
		container.captureTouch(id, x, y, ticks);
	}
	onTouchEnded(container, id, x, y, ticks) {
		var offset = this.offset;
		var size =  this.size;
		var delta = size >> 1;
		if (this.moved) {
			if (offset < delta)
				delta = 0 - offset;
			else 
				delta = size - offset;
		}
		else {
			if (offset == 0)
				delta = size;
			else if (offset == size)
				delta = 0 - size;
			else if (x > (container.x + (container.width >> 1)))
				delta = size - offset;
			else
				delta = 0 - offset;
		}
		if (delta) {
			this.anchor = offset;
			this.delta = delta;
			container.duration = 125 * Math.abs(delta) / size;
			container.time = 0;
			container.start();
		}
		var selection = ((this.offset + delta) == 0) ? 0 : 1;
		let data = this.data;
		if (data.selection != selection) {
			data.selection = selection;
			data.onChanged();
		}
	}
	onTouchMoved(container, id, x, y, ticks) {
		this.moved = Math.abs(x - this.anchor) >= 8;
		this.changeOffset(container, this.delta + x - this.anchor);
	}
	onUpdate(container) {
		this.changeOffset(container, this.data.selection ? this.size : 0);
	}
};
let REDSwitch = Row.template($ => ({
	left:$.left, width:$.width, top:$.top, height:$.height, clip:true,
	contents: [
		Label($, { left:0, right:0, top:0, bottom:0, style:REDTheme.styles.textNameLeft, string:$.label }),
		Container($, {
			width:60, height:UNIT, active:true, Behavior:REDSwitchBehavior,
			contents: [
				Content($, { left:0, right:0, top:0, bottom:0, skin:REDTheme.skins.switchBar }),
				Content($, { left:0, width:UNIT, top:0, bottom:0, skin:REDTheme.skins.switchThumb  }),
			],
		}),
	],
}));

class REDTextBehavior extends REDBehavior {
	onUndisplaying(container) {
		super.onUndisplaying(container);
		delete this.data.VALUE;
	}
	onUpdate(container) {
		this.data.VALUE.string = this.data.value;
	}
}
let REDTextRowLeft = Container.template($ => ({
	left:$.left, width:$.width, top:$.top, height:$.height, clip:true, Behavior:REDTextBehavior,
	contents: [
		Row($, { 
			left:0, top:0, bottom:0,
			contents: [
				$.label ? Label($, { top:0, bottom:0, style:REDTheme.styles.textNameLeft, string:$.label }) : null,
				Label($, { anchor:"VALUE", top:0, bottom:0, style:REDTheme.styles.textValueLeft, string:"" }),
			],
		}),
	],
}));
let REDTextRowCenter = Container.template($ => ({
	left:$.left, width:$.width, top:$.top, height:$.height, clip:true, Behavior:REDTextBehavior,
	contents: [
		Row($, { 
			top:0, bottom:0,
			contents: [
				$.label ? Label($, { top:0, bottom:0, style:REDTheme.styles.textName, string:$.label }) : null,
				Label($, { anchor:"VALUE", top:0, bottom:0, style:REDTheme.styles.textValue, string:"" }),
			],
		}),
	],
}));
let REDTextRowRight = Container.template($ => ({
	left:$.left, width:$.width, top:$.top, height:$.height, clip:true, Behavior:REDTextBehavior,
	contents: [
		Row($, { 
			right:0, top:0, bottom:0,
			contents: [
				$.label ? Label($, { top:0, bottom:0, style:REDTheme.styles.textNameRight, string:$.label }) : null,
				Label($, { anchor:"VALUE", top:0, bottom:0, style:REDTheme.styles.textValueRight, string:"" }),
			],
		}),
	],
}));
let REDTextRowSpread = Container.template($ => ({
	left:$.left, width:$.width, top:$.top, height:$.height, clip:true, Behavior:REDTextBehavior,
	contents: [
		Row($, { 
			left:0, right:0, top:0, bottom:0,
			contents: [
				$.label ? Label($, { left:0, right:0, top:0, bottom:0, style:REDTheme.styles.textNameLeft, string:$.label }) : null,
				Label($, { anchor:"VALUE", left:0, right:0, top:0, bottom:0, style:REDTheme.styles.textValueRight, string:"" }),
			],
		}),
	],
}));
let REDTextColumnCenter = Container.template($ => ({
	left:$.left, width:$.width, top:$.top, height:$.height, clip:true, Behavior:REDTextBehavior,
	contents: [
		Column($, { 
			left:0, right:0,
			contents: [
				$.label ? Label($, { left:0, right:0, style:REDTheme.styles.textName, string:$.label }) : null,
				Label($, { anchor:"VALUE", left:0, right:0, style:REDTheme.styles.textValue, string:"" }),
			],
		}),
	],
}));

let REDGroup = Container.template($ => ({
	left:0, right:0, top:0, height:$.height, skin:REDTheme.skins.group, clip:true,
	contents: [
		$.disp ? new REDGroupTitle($) : null,
		Container($, {
			left:0, right:0, top:$.disp ? UNIT : 0, bottom:0,
			contents: [
				($.width > screen.width) ? new REDGroupScroller($) : new REDGroupContainer($)
			],
		}),
	]
}));
let REDGroupTitle = Row.template($ => ({
	left:0, right:0, top:0, height:UNIT,
	Behavior: class extends ButtonBehavior {
		changeState(container, state) {
			super.changeState(container, state);
			if (state == 3)
				container.first.variant = 1;
			else {
				const groupContainer = container.container;
				const height = this.data.height;
				container.first.variant = (groupContainer.height == height) ? 2 : 0;
			}
		}
		onCreate(container, $) {
			super.onCreate(container, $);
			if ($.collapse)
				container.active = true;
		}
		onTap(container) {
			const groupContainer = container.container;
			const height = this.data.height;
			if (groupContainer.height == height)
				groupContainer.height = UNIT;
			else
				groupContainer.height = height;
		}
	},
	contents: [
		$.collapse ? Content($, { width:UNIT, top:0, bottom:0, skin:REDTheme.skins.groupIcon, variant:2  }) : Content($, { width:10 }),
		Label($, { left:0, right:0, top:0, bottom:0, style:REDTheme.styles.group, string:$.name }),
	],
}));
let REDGroupScroller = Scroller.template($ => ({
	left:0, right:0, top:0, bottom:0, active:true, backgroundTouch:true, Behavior:HorizontalScrollerBehavior, clip:true,
	contents: [
		new REDGroupContainer($),
	]
}));
let REDGroupContainer = Container.template($ => ({
	left:0, width:$.width, top:0, bottom:0,
	contents: [
		$.controls.map($$ => new $$.Template($$)),
	],
}));

let REDTab = Container.template($ => ({
	left:0, right:0, top:0, bottom:0, skin:REDTheme.skins.tab,
	contents: [
		Container($, {
			left:0, right:0, top:$.showTitleBar ? UNIT : 0, height:$.showTitleBar ? screen.height - UNIT : screen.height,
			contents: [
				$.height > screen.height ? new REDTabScroller($) : new REDTabColumn($),
			],
		}),
		$.showTitleBar ? new REDTabTitle($) : null,
	]
}));
let REDTabTitle = Row.template($ => ({
	left:0, right:0, top:0, height:UNIT, skin:REDTheme.skins.title, active:$.enableTitleBar,
	Behavior: class extends ButtonBehavior {
		onTap(container) {
			container.bubble("onSelectTab");
		}
	},
	contents: [
		$.enableTitleBar ? Content($, { width:UNIT, top:0, bottom:0, skin:REDTheme.skins.titleIcon }) : Content($, { width:10 }),
		Label($, { left:0, right:0, top:0, bottom:0, style:REDTheme.styles.title, string:$.name }),
	],
}));
let REDTabScroller = Scroller.template($ => ({
	left:0, right:0, top:0, bottom:0, clip:true, active:true, backgroundTouch:true, Behavior:VerticalScrollerBehavior,
	contents: [
		new REDTabColumn($)
	]
}));
let REDTabColumn = Column.template($ => ({
	left:0, right:0, top:0,
	contents: [
		$.groups.map($$ => new REDGroup($$))
	],
}));


let REDTabMenu = Layout.template($ => ({
	left:0, right:0, top:0, bottom:0, active:true, backgroundTouch:true, skin:REDTheme.skins.menuBackground,
	Behavior: class extends PopupMenuBehavior {	
		onFitVertically(layout, value) {
			let data = this.data;
			let container = layout.first;
			let scroller = container.first;
			let column = scroller.first;
			let row = column.content(data.selection);
			let size = column.measure();
			let height = Math.min(size.height, application.height);
			container.coordinates = { left:0, right:0, top:0, height:height }
			scroller.coordinates = { left:0, right:0, top:0, height:height }
			row.first.visible = true;
			return value;
		}
	},
	contents: [
		Container($, { contents:[
			Scroller($, { clip:true, active:true, skin:REDTheme.skins.titleMenu, contents:[
				Column($, { left:0, right:0, top:0, 
					contents: $.tabs.map($$ => new REDTabMenuItem($$)),
				}),
			]}),
		]}),
	],
}));
let REDTabMenuItem = Row.template($ => ({
	left:0, right:0, height:UNIT, skin:REDTheme.skins.titleMenuItem, active:true,
	Behavior: PopupMenuItemBehavior,
	contents: [
		Content($, { width:UNIT, top:0, bottom:0, skin:REDTheme.skins.titleMenuItemIcon, visible:false  }),
		Label($, { left:0, right:0, top:0, bottom:0, style:REDTheme.styles.titleMenuItem, string:$.name }),
	],
}));

class REDToastDialogBehavior extends REDBehavior {
	onClose(container, value) {
		const application = container.application;
		if (application)
			application.remove(container);
		this.data.value = value;
		this.data.onChanged();
	}
}
const REDToastDialog = Container.template($ => ({
	left:0, right:0, top:0, bottom:0, skin:REDTheme.skins.menuBackground, Behavior:REDToastDialogBehavior,
	contents: [
		Column($, {
			width:240, skin:REDTheme.skins.toast,
			contents: [
				Text($, { left:0, right:0, style:REDTheme.styles.notification, string:$.text }),
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
									container.bubble("onClose", this.data.ok);
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

class REDToastNotificationBehavior extends REDBehavior {
	onCreate(container, data) {
		super.onCreate(container, data);
		const stroke = data.highlight;
		if (stroke)
			container.first.skin = new Skin({ fill:REDTheme.colors.group, stroke, left:2, right:2, top:2, bottom:2 });
	}
	onDisplaying(container) {
		const column = container.first;
		const { position, displayTime } = this.data;
		if (position != "dialog") {
			switch (position) {
				case "top left": column.coordinates = { top:0, left:0, width:160 }; break;
				case "top right": column.coordinates = { top:0, right:0, width:160 }; break;
				case "bottom right": column.coordinates = { bottom:0, right:0, width:160 }; break;
				case "bottom left": column.coordinates = { bottom:0, left:0, width:160 }; break;
			}
			container.duration = displayTime;
			container.start();
		}
	}
	onFinished(container, id, x, y, ticks) {
		const application = container.application;
		if (application)
			application.remove(container);
	}
	onTouchEnded(container, id, x, y, ticks) {
		if (container.running) {
			container.stop();
			this.onFinished(container);
		}
	}
}
const REDToastNotification = Container.template($ => ({
	left:0, right:0, top:0, bottom:0, skin:REDTheme.skins.menuBackground, active:true, backgroundTouch:true, Behavior:REDToastNotificationBehavior,
	contents: [
		Column($, {
			width:240, skin:REDTheme.skins.toast,
			contents: [
				Text($, { left:0, right:0, style:REDTheme.styles.notification, string:$.text }),
			]
		}),
	],
}));

class REDApplicationBehavior extends Behavior {
	display(application, selection) {
		const container = application.first;
		const data = this.data;
		container.distribute("onUndisplaying");
		application.replace(application.first, new REDTab(data.tabs[selection]));
		data.selection = selection;
		application.purge();
	}
	goTo(tab) {
		const data = this.data;
		const selection = data.tabs.indexOf(tab);
		if (data.selection != selection)
			application.defer("display", selection);
	}
	onCreate(application, $) {
		this.data = $;
	}
	onMenuSelected(application, selection) {
		if ((selection >= 0) && (this.data.selection != selection))
			application.defer("display", selection);
	}
	onNotify(application, data) {
		application.add(new data.Template(data));
	}
	onSelectTab(application) {
		this.data.button = application;
		application.add(new REDTabMenu(this.data));
	}
}
let REDApplication = Application.template($ => ({
	skin:REDTheme.skins.tab, Behavior: REDApplicationBehavior,
	contents: [
		new REDTab($.tabs[$.selection])
	]
}));

export {
	buildTheme,
	ButtonBehavior,
	REDApplication,
	REDBehavior,
	REDButton,
	REDButtonBehavior,
	REDDropDown,
	REDDropDownBehavior,
	REDNumeric,
	REDNumericBehavior,
	REDSlider,
	REDSliderBehavior,
	REDSpacer,
	REDSwitch,
	REDSwitchBehavior,
	REDTextBehavior,
	REDTextRowLeft,
	REDTextRowCenter,
	REDTextRowRight,
	REDTextRowSpread,
	REDTextColumnCenter,
	REDToastDialog,
	REDToastNotification,
	UNIT
};