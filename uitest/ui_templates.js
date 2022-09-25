import {} from "piu/MC";
import {} from "piu/shape";
import {Outline} from "commodetto/outline";
import { HorizontalScrollerBehavior, VerticalScrollerBehavior } from "ScrollerBehaviors";

const textures = {
	button: { path:"button.png" },
	glyphs: { path:"glyphs.png" },
	popup: { path:"popup.png" },
	slider: { path:"slider.png" },
	switch: { path:"switch.png" },
};
const UNIT = 40;

function buildTheme(theme) {
	const gray = "#949494";
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
	
	const hilite = blendColors(0.75,group,base);
		
	const result = {
		gaugeBackground: halfGray,
		skins: {},
		styles: {
			textName: new Style({ font:"18px Open Sans", color:widgetText, left:5, right:5 }),
			textValue: new Style({ font:"600 18px Open Sans", color:widgetText, left:5, right:5 }),
			textNameLeft: new Style({ font:"18px Open Sans", color:widgetText, horizontal:"left", left:10 }),
			textValueLeft: new Style({ font:"600 18px Open Sans", color:widgetText, horizontal:"left", left:10 }),
			textNameRight: new Style({ font:"18px Open Sans", color:widgetText, horizontal:"right", right:10 }),
			textValueRight: new Style({ font:"600 18px Open Sans", color:widgetText, horizontal:"right", right:10 }),
		}
	};
	
	result.skins.menuBackground = new Skin({ fill:blendColors(0.5,TRANSPARENT,page) }),
	result.skins.tab = new Skin({ fill:page });
	
	result.skins.title = new Skin({ fill:[TRANSPARENT,title,title,hilite] });
	result.styles.title = new Style({ font:"600 18px Open Sans", color:WHITE, horizontal:"left" });
	result.skins.titleIcon = new Skin({ texture:textures.glyphs, color:WHITE, x:0, y:0, width:40, height:40 });
	result.skins.titleMenu = new Skin({ fill:sideBar, stroke:title, left:1, right:1, top:1, bottom:1 }),
	result.skins.titleMenuItem = new Skin({ fill:[TRANSPARENT,TRANSPARENT,TRANSPARENT,title] });
	result.styles.titleMenuItem = new Style({ font:"600 18px Open Sans", color:[halfGray,groupText,groupText,WHITE], horizontal:"left" });
	result.skins.titleMenuItemIcon = new Skin({ texture:textures.glyphs, color:[halfGray,groupText,groupText,WHITE], x:200, y:0, width:40, height:40 });
	
	result.skins.group = new Skin({ fill:group, stroke:groupBorder, bottom:1 });
	result.styles.group = new Style({ font:"600 18px Open Sans", color:[groupText,groupText,groupText,groupText], horizontal:"left" });
	result.skins.groupIcon = new Skin({ texture:textures.glyphs, color:[groupText,groupText,groupText,groupText], x:40, y:0, width:40, height:40, variants:40 });
	
	result.skins.button = new Skin({ texture:textures.button, color:[TRANSPARENT,widget,widget,hilite], x:0, y:0, width:60, height:60, left:20, right:20, top:20, bottom:20 });
	result.styles.button = new Style({ font:"600 18px Open Sans", color:[halfGray,WHITE,WHITE,WHITE] });
	
// 	result.skins.dropDown = new Skin({ texture:textures.popup, color:[TRANSPARENT,TRANSPARENT,TRANSPARENT,hilite], x:0, y:0, width:60, height:60, left:20, right:20, top:20, bottom:20 });
	result.skins.dropDown = new Skin({ fill:[TRANSPARENT,TRANSPARENT,TRANSPARENT,hilite], stroke:[TRANSPARENT,halfGray,halfGray,hilite], left:1, right:1, top:1, bottom:1 }),
	result.styles.dropDown = new Style({ font:"600 18px Open Sans", color:[halfGray,widgetText,widgetText,WHITE], horizontal:"left", left:10 });
	result.skins.dropDownIcon = new Skin({ texture:textures.glyphs, color:[halfGray,widgetText,widgetText,WHITE], x:160, y:0, width:40, height:40 });
	result.skins.dropDownMenu = new Skin({ fill:group, stroke:widget, left:1, right:1, top:1, bottom:1 }),
	result.skins.dropDownMenuItem = new Skin({ fill:[TRANSPARENT,TRANSPARENT,TRANSPARENT,widget] });
	result.styles.dropDownMenuItem = new Style({ font:"600 18px Open Sans", color:[halfGray,widgetText,widgetText,WHITE], horizontal:"left", left:10 });
	result.skins.dropDownMenuItemIcon = new Skin({ texture:textures.glyphs, color:[halfGray,widgetText,widgetText,WHITE], x:200, y:0, width:40, height:40 });
	
	result.skins.numericLeft = new Skin({ texture:textures.button, color:[TRANSPARENT,TRANSPARENT,TRANSPARENT,hilite], x:0, y:0, width:60, height:60, left:20, right:20, top:20, bottom:20 });
	result.skins.numericLess = new Skin({ texture:textures.glyphs, color:[halfGray,widgetText,widgetText,WHITE], x:240, y:0, width:40, height:40 });
	result.skins.numericRight = new Skin({ texture:textures.button, color:[TRANSPARENT,TRANSPARENT,TRANSPARENT,hilite], x:0, y:0, width:60, height:60, left:20, right:20, top:20, bottom:20 });
	result.skins.numericMore = new Skin({ texture:textures.glyphs, color:[halfGray,widgetText,widgetText,WHITE], x:280, y:0, width:40, height:40 });
	
	result.skins.sliderBar = new Skin({ texture:textures.slider, color:[halfGray,halfWidget], x:0, y:0, width:80, height:40, left:20, right:20 });
	result.skins.sliderThumb = new Skin({ texture:textures.slider, color:widget, x:80, y:0, width:40, height:40 });
	
	result.skins.switchBar = new Skin({ texture:textures.switch, color: [TRANSPARENT,halfGray,halfWidget], x:0, y:0, width:60, height:40 });
	result.skins.switchThumb = new Skin({ texture:textures.switch, color: [TRANSPARENT,gray,widget], x:60, y:0, width:40, height:40 });
	
	result.skins.compass = new Skin({ fill:widget, stroke:widget });
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

let REDButton = Container.template($ => ({
	left:$.left, width:$.width, top:$.top, height:$.height, skin:REDTheme.skins.button, clip:true, active:true,
	Behavior: class extends ButtonBehavior {
		onTap(button) {
			this.data.onTap();
		}
	},
	contents: [
		Label($, { style:REDTheme.styles.button, string:$.label }),
	],
}));

class REDDropDownBehavior extends ButtonBehavior {
	onCreate(container, data) {
		super.onCreate(container, data);
		data.container = container;
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
	onDisplaying(container) {
		super.onDisplaying(container);
		this.onUpdate(container);
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

class REDGaugeBehavior extends Behavior {
	onCreate(container, data) {
		this.data = data;
		data.container = container;
		
		const shape = container.first;
		shape.skin = new Skin({fill:REDTheme.gaugeBackground, stroke:data.colors});
	}
	onDisplaying(container) {
		this.onUpdate(container);
	}
	onUpdate(container) {
		const data = this.data;
		const { min, max, value, seg1, seg2, title } = data;
		const fraction = (value - min) / (max - min);
		const { width, height } = container;
		const shape = container.first;
		const label = container.last;
		
		const x = width >> 1;
		const y = height;
		const r = Math.min(x, y);
		
		if (shape.fillOutline == null) {
			const path = new Outline.CanvasPath;
			path.arc(x, y, r - 20, Math.PI, 0);
			shape.fillOutline = Outline.stroke(path, 40, Outline.LINECAP_BUTT, Outline.LINEJOIN_MITER);
		}
		const path = new Outline.CanvasPath;
		path.arc(x, y, r - 20, Math.PI, Math.PI * (1 +  fraction) );
		shape.strokeOutline = Outline.stroke(path, 40, Outline.LINECAP_BUTT, Outline.LINEJOIN_MITER);
		if ((seg1 !== undefined) && (seg2 !== undefined))
			shape.state = (value <= seg1) ? 0 : (value <= seg2) ? 1 : 2;
		else
			shape.state = fraction * 2;
		label.string = value;
	}
};

let REDGauge = Container.template($ => ({
	left:$.left, width:$.width, top:$.top, height:$.height, clip:true,
	contents: [
		$.title ? Label($, { left:0, right:0, height:UNIT, style:REDTheme.styles.textName, string:$.title }) : null,
		Container($, {
			left:0, right:0, top:0, bottom:0, Behavior: REDGaugeBehavior,
			contents: [
				Shape($, { left:0, right:0, top:0, bottom:0 } ),
				Label($, { left:0, right:0, bottom:0, height:40, style:REDTheme.styles.textValue }),
			],
		}),
	],
}));

class REDGaugeCompassBehavior extends Behavior {
	onCreate(container, data) {
		this.data = data;
		data.container = container;
	}
	onDisplaying(container) {
		this.onUpdate(container);
	}
	onUpdate(container) {
		const data = this.data;
		const { min, max, value, seg1, seg2, title } = data;
		const fraction = (value - min) / (max - min);
		const { width, height } = container;
		const shape = container.first;
		const label = container.last;
		
		const x = width >> 1;
		const y = height >> 1;
		let r = Math.min(x, y);
		
		if (shape.fillOutline == null) {
			const path = new Outline.CanvasPath;
			path.arc(x, y, r - 12, 0, 2 * Math.PI);
			shape.fillOutline = Outline.stroke(path, 6, Outline.LINECAP_BUTT, Outline.LINEJOIN_MITER);
		}
		const path = new Outline.CanvasPath;
		let angle = (2 * Math.PI * fraction) - (Math.PI / 2);
		path.moveTo(x + (r * Math.cos(angle)), y + (r * Math.sin(angle)));
		r -= 25;
		angle -= Math.PI / 12;
		path.lineTo(x + (r * Math.cos(angle)), y + (r * Math.sin(angle)));
		angle += Math.PI / 6;
		path.lineTo(x + (r * Math.cos(angle)), y + (r * Math.sin(angle)));
		path.closePath();
		shape.strokeOutline = Outline.fill(path);

		label.string = value;
	}
};
let REDGaugeCompass = Column.template($ => ({
	left:$.left, width:$.width, top:$.top, height:$.height, clip:true,
	contents: [
		$.title ? Label($, { left:0, right:0, height:UNIT, style:REDTheme.styles.textName, string:$.title }) : null,
		Container($, {
			left:0, right:0, top:0, bottom:0, Behavior: REDGaugeCompassBehavior,
			contents: [
				Shape($, { left:0, right:0, top:0, bottom:0, skin:REDTheme.skins.compass }),
				Label($, { left:0, right:0, height:40, style:REDTheme.styles.textValue }),
			],
		}),
	],
}));

class REDGaugeDonutBehavior extends REDGaugeBehavior {
	onUpdate(container) {
		const data = this.data;
		const { min, max, value, seg1, seg2, title } = data;
		const fraction = (value - min) / (max - min);
		const { width, height } = container;
		const shape = container.first;
		const label = container.last;
		
		const x = width >> 1;
		const y = height >> 1;
		const r = Math.min(x, y);
		
		if (shape.fillOutline == null) {
			const path = new Outline.CanvasPath;
			path.arc(x, y, r - 10, 0, 2 * Math.PI);
			shape.fillOutline = Outline.stroke(path, 20, Outline.LINECAP_BUTT, Outline.LINEJOIN_MITER);
		}
		const path = new Outline.CanvasPath;
		path.arc(x, y, r - 10, 3 * Math.PI / 2, (3 * Math.PI / 2) + (2 * Math.PI * fraction) );
		shape.strokeOutline = Outline.stroke(path, 20, Outline.LINECAP_BUTT, Outline.LINEJOIN_MITER);
		if ((seg1 !== undefined) && (seg2 !== undefined))
			shape.state = (value <= seg1) ? 0 : (value <= seg2) ? 1 : 2;
		else
			shape.state = fraction * 2;
		label.string = value;
	}
};
let REDGaugeDonut = Column.template($ => ({
	left:$.left, width:$.width, top:$.top, height:$.height, clip:true,
	contents: [
		$.title ? Label($, { left:0, right:0, height:UNIT, style:REDTheme.styles.textName, string:$.title }) : null,
		Container($, {
			left:0, right:0, top:0, bottom:0, Behavior: REDGaugeDonutBehavior,
			contents: [
				Shape($, { left:0, right:0, top:0, bottom:0 } ),
				Label($, { left:0, right:0, height:40, style:REDTheme.styles.textValue }),
			],
		}),
	],
}));

class REDNumericBehavior extends Behavior {
	onCreate(container, data) {
		this.data = data;
		data.container = container;
	}
	onDisplaying(container) {
		this.onUpdate(container);
	}
	onTrack(container, direction) {
		const data = this.data;
		const { min, max, step } = data;
		let value = data.value + (direction * step);
		if (value < min)
			value = min;
		else if (value > max)
			value = max;
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
	onTap(container) {
		container.bubble("onTrack", this.data);
	}
};

let REDNumeric = Row.template($ => ({
	left:$.left, width:$.width, top:$.top, height:$.height, clip:true,
	contents: [
		Label($, { left:0, right:0, top:0, bottom:0, style:REDTheme.styles.textNameLeft, string:$.label }),
		Row($, {
			width:3*UNIT, height:UNIT, Behavior: REDNumericBehavior,
			contents: [
				Container(-1, {
					width:UNIT, height:UNIT, skin:REDTheme.skins.numericLeft, active:true, Behavior: REDNumericButtonBehavior,
					contents: [
						Content($, { width:UNIT, height:UNIT, skin:REDTheme.skins.numericLess }),
					],
				}),
				Label($, { width:UNIT, height:UNIT, style:REDTheme.styles.textValue, state:1 }),
				Container(1, {
					width:UNIT, height:UNIT, skin:REDTheme.skins.numericRight, active:true, Behavior: REDNumericButtonBehavior,
					contents: [
						Content($, { width:UNIT, height:UNIT, skin:REDTheme.skins.numericMore }),
					],
				}),
			],
		}),
	],
}));

class REDSliderBehavior extends Behavior {
	onCreate(container, data) {
		this.data = data;
		data.container = container;
	}
	onDisplaying(container) {
		this.onUpdate(container);
	}
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
		data.onChanged(true);
		this.onUpdate(container);
	}
	onTouchEnded(container, id, x, y, ticks) {
		this.data.onChanged(false);
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
			left:0, right:0, height:UNIT, active:true, Behavior: REDSliderBehavior,
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


class REDSwitchBehavior extends Behavior {
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
	onCreate(container, data) {
		this.data = data;
		data.container = container;
	}
	onDisplaying(container) {
		var bar = container.first;
		var button = bar.next;
		this.size = bar.width - button.width;
		this.onUpdate(container);
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

class REDTextBehavior extends Behavior {
	onCreate(container, data) {
		this.data = data;
		data.container = container;
	}
	onDisplaying(container) {
		this.onUpdate(container);
	}
	onUpdate(container) {
		container.first.last.string = this.data.value;
	}
}

let REDTextRowLeft = Container.template($ => ({
	left:$.left, width:$.width, top:$.top, height:$.height, clip:true,
	Behavior: REDTextBehavior,
	contents: [
		Row($, { 
			left:0, top:0, bottom:0,
			contents: [
				Label($, { top:0, bottom:0, style:REDTheme.styles.textNameLeft, string:$.label }),
				Label($, { top:0, bottom:0, style:REDTheme.styles.textValueLeft, string:"" }),
			],
		}),
	],
}));

let REDTextRowCenter = Container.template($ => ({
	left:$.left, width:$.width, top:$.top, height:$.height, clip:true,
	Behavior: REDTextBehavior,
	contents: [
		Row($, { 
			top:0, bottom:0,
			contents: [
				Label($, { top:0, bottom:0, style:REDTheme.styles.textName, string:$.label }),
				Label($, { top:0, bottom:0, style:REDTheme.styles.textValue, string:"" }),
			],
		}),
	],
}));

let REDTextRowRight = Container.template($ => ({
	left:$.left, width:$.width, top:$.top, height:$.height, clip:true,
	Behavior: REDTextBehavior,
	contents: [
		Row($, { 
			right:0, top:0, bottom:0,
			contents: [
				Label($, { top:0, bottom:0, style:REDTheme.styles.textNameRight, string:$.label }),
				Label($, { top:0, bottom:0, style:REDTheme.styles.textValueRight, string:"" }),
			],
		}),
	],
}));

let REDTextRowSpread = Container.template($ => ({
	left:$.left, width:$.width, top:$.top, height:$.height, clip:true,
	Behavior: REDTextBehavior,
	contents: [
		Row($, { 
			left:0, right:0, top:0, bottom:0,
			contents: [
				Label($, { left:0, right:0, top:0, bottom:0, style:REDTheme.styles.textNameLeft, string:$.label }),
				Label($, { left:0, right:0, top:0, bottom:0, style:REDTheme.styles.textValueRight, string:"" }),
			],
		}),
	],
}));

let REDTextColumnCenter = Container.template($ => ({
	left:$.left, width:$.width, top:$.top, height:$.height, clip:true,
	Behavior: REDTextBehavior,
	contents: [
		Column($, { 
			left:0, right:0,
			contents: [
				Label($, { left:0, right:0, style:REDTheme.styles.textName, string:$.label }),
				Label($, { left:0, right:0, style:REDTheme.styles.textValue, string:"" }),
			],
		}),
	],
}));

let REDGroupTitle = Row.template($ => ({
	left:0, right:0, top:0, height:UNIT,
	Behavior: class extends ButtonBehavior {
		changeState(container, state) {
			super.changeState(container, state);
			if (state == 3)
				container.first.variant = 1;
			else {
				const scroller = container.container.container;
				const height = this.data.height;
				container.first.variant = (scroller.height == height) ? 2 : 0;
			}
		}
		onCreate(container, $) {
			super.onCreate(container, $);
			if ($.collapse)
				container.active = true;
		}
		onTap(container) {
			const scroller = container.container.container;
			const height = this.data.height;
			if (scroller.height == height)
				scroller.height = UNIT;
			else
				scroller.height = height;
		}
	},
	contents: [
		Content($, { width:($.collapse) ? UNIT : 0, top:0, bottom:0, skin:REDTheme.skins.groupIcon, variant:2  }),
		Label($, { left:0, right:0, top:0, bottom:0, style:REDTheme.styles.group, string:$.name }),
	],
}));

let REDGroupScroller = Scroller.template($ => ({
	left:0, right:0, height:$.height, active:true, backgroundTouch:true, Behavior:HorizontalScrollerBehavior, clip:true,
	contents: [
		Container($, {
			left:0, width:$.width, top:0, bottom:0, skin:REDTheme.skins.group,
			contents: [
				$.disp ? new REDGroupTitle($) : null,
				$.controls.map($$ => new $$.Template($$)),
			],
		}),
	]
}));

let REDTabScroller = Scroller.template($ => ({
	anchor:"SCROLLER", left:0, right:0, top:0, bottom:0, visible:false, clip:true, active:true, backgroundTouch:true, Behavior:VerticalScrollerBehavior,
	contents: [
		Column($, {
			left:0, right:0, top:0,
			contents: [
				$.groups.map($$ => new REDGroupScroller($$))
			],
		}),
	]
}));


let REDTabTitle = Row.template($ => ({
	left:0, right:0, top:0, height:UNIT, skin:REDTheme.skins.title,
	Behavior: class extends ButtonBehavior {
		onCreate(container, $) {
			this.data = $;
			if ($.tabs.length > 1)
				container.active = true;
		}
		onDisplaying(container) {
			super.onDisplaying(container);
			let data = this.data;
			data.button = container;
			data.selection = 0;
			let current = data.tabs[data.selection];
			container.first.next.string = current.name;
			current.SCROLLER.visible = true;
		}
		onMenuSelected(container, index) {
			if (index > 0) {
				let data = this.data;
				let selection = data.items[index].value;
				let tabs = data.tabs;
				let former = tabs[data.selection];
				let current = tabs[selection];
				container.first.next.string = current.name;
				former.SCROLLER.visible = false;
				current.SCROLLER.visible = true;
				data.selection = selection;
			}
		}
		onTap(container) {
			let data = this.data;
			data.items = data.tabs.map((tab, index) => ({ title: tab.name, value:index }));
			const deletions = data.items.splice(data.selection, 1);
			data.items = deletions.concat(data.items);
			application.add(new REDTabMenu(data));
		}
	},
	contents: [
		Content($, { width:($.tabs.length > 1) ? UNIT : 0, top:0, bottom:0, skin:REDTheme.skins.titleIcon  }),
		Label($, { left:0, right:0, top:0, bottom:0, style:REDTheme.styles.title }),
	],
}));

let REDTabMenu = Layout.template($ => ({
	left:0, right:0, top:0, bottom:0, active:true, backgroundTouch:true, skin:REDTheme.skins.menuBackground,
	Behavior: class extends PopupMenuBehavior {	
		onFitVertically(layout, value) {
			let data = this.data;
			let button = data.button;
			let container = layout.first;
			let scroller = container.first;
			let size = scroller.first.measure();
			let height = Math.min(size.height, application.height);
			container.coordinates = { left:0, right:0, top:0, height:height }
			scroller.coordinates = { left:0, right:0, top:0, height:height }
			scroller.first.first.first.visible = true;
			return value;
		}
	},
	contents: [
		Container($, { contents:[
			Scroller($, { clip:true, active:true, skin:REDTheme.skins.titleMenu, contents:[
				Column($, { left:0, right:0, top:0, 
					contents: $.items.map($$ => new REDTabMenuItem($$)),
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
		Label($, { left:0, right:0, top:0, bottom:0, style:REDTheme.styles.titleMenuItem, string:$.title }),
	],
}));

let REDApplication = Application.template($ => ({
	skin:REDTheme.skins.tab,
	Behavior: class extends Behavior {
		onCreate(application, $) {
		}
	},
	
	contents: [
		new REDTabTitle($),
		Container($, {
			left:0, right:0, top:UNIT, bottom:0,
			contents: [
				$.tabs.map($$ => new REDTabScroller($$))
			],
		}),
	]
}));

export {
	buildTheme,
	REDApplication,
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
};