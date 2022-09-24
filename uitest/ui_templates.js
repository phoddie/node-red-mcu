import {} from "piu/MC";
import {} from "piu/shape";
import {Outline} from "commodetto/outline";
import { HorizontalScrollerBehavior, VerticalScrollerBehavior } from "ScrollerBehaviors";

const BLACK = "black";
const TRANSPARENT = "transparent";
const WHITE = "white";

const GRAY_2 = "#1b1c26";
const GRAY_3 = "#2d2f40";
const GRAY_4 = "#3e4259";


const COLOR = "#192eab";
const LITE_COLOR = "#6573c7";
const OFF_WHITE = "#E0E0E0";

const textures = {
	button: { path:"button.png" },
	glyphs: { path:"glyphs.png" },
	popup: { path:"popup.png" },
	slider: { path:"slider.png" },
	switch: { path:"switch.png" },
};
const theme = Object.freeze({
	skins: {
		placeHolder: { stroke:"red", left:1, right:1, top:1, bottom:1 },

		tab: { fill:BLACK },
		tabMenu: { fill:GRAY_3, stroke:GRAY_4, bottom:1 },
		tabMenuBackground: { fill:"#00000080" },
		tabMenuIcon: { texture:textures.glyphs, color:[GRAY_4,OFF_WHITE,OFF_WHITE,WHITE], x:0, y:0, width:40, height:40 },
		tabMenuItem: { fill:[TRANSPARENT,TRANSPARENT,TRANSPARENT,COLOR] },
		tabMenuItemIcon: { texture:textures.glyphs, color:[GRAY_4,OFF_WHITE,OFF_WHITE,WHITE], x:200, y:0, width:40, height:40 },
		tabTitle: { fill:[TRANSPARENT,GRAY_2,GRAY_2,COLOR], stroke:BLACK, bottom:1 },
		
		group: { fill:GRAY_2, stroke:GRAY_4, bottom:1 },
		groupIcon: { texture:textures.glyphs, color:[OFF_WHITE,OFF_WHITE,OFF_WHITE,WHITE], x:40, y:0, width:40, height:40, variants:40 },
		groupTitle: { fill:GRAY_3, stroke:GRAY_4, bottom:1 },
		
		button: { texture:textures.button, color: [TRANSPARENT,GRAY_4,GRAY_4,COLOR], x:0, y:0, width:60, height:60, left:20, right:20, top:20, bottom:20 },
		
		dropDown: { texture:textures.popup, color: [TRANSPARENT,GRAY_4,GRAY_4,COLOR], x:0, y:0, width:60, height:60, left:20, right:20, top:20, bottom:20 },
		dropDownIcon: { texture:textures.glyphs, color:[GRAY_4,OFF_WHITE,OFF_WHITE,WHITE], x:160, y:0, width:40, height:40 },

		numericLeft: { texture:textures.popup, color: [TRANSPARENT,GRAY_4,GRAY_4,COLOR], x:0, y:0, width:40, height:60, top:20, bottom:20 },
		numericCenter: { texture:textures.popup, color: [TRANSPARENT,GRAY_4,GRAY_4,COLOR], x:20, y:0, width:20, height:60, left:0, right:0, top:20, bottom:20 },
		numericRight: { texture:textures.popup, color: [TRANSPARENT,GRAY_4,GRAY_4,COLOR], x:20, y:0, width:40, height:60, top:20, bottom:20 },
		numericLess: { texture:textures.glyphs, color: [GRAY_4,OFF_WHITE,OFF_WHITE,WHITE], x:240, y:0, width:40, height:40 },
		numericMore: { texture:textures.glyphs, color: [GRAY_4,OFF_WHITE,OFF_WHITE,WHITE], x:280, y:0, width:40, height:40 },

		sliderBar: { texture:textures.slider, color: [GRAY_4,COLOR], x:0, y:0, width:80, height:40, left:20, right:20 },
		sliderThumb: { texture:textures.slider, color: [OFF_WHITE,WHITE], x:80, y:0, width:40, height:40 },
		
		switchBar: { texture:textures.switch, color: [TRANSPARENT,GRAY_4,COLOR], x:0, y:0, width:60, height:40 },
		switchThumb: { texture:textures.switch, color: [OFF_WHITE,WHITE], x:60, y:0, width:40, height:40 },
	},
	styles: {
		tabTitle: { font:"600 18px Open Sans", color:[OFF_WHITE,OFF_WHITE,OFF_WHITE,WHITE], horizontal:"left", left:10 },
		tabMenuItem: { font:"600 18px Open Sans", color:[GRAY_4,OFF_WHITE,OFF_WHITE,WHITE], horizontal:"left", right:10 },
		groupTitle: { font:"600 18px Open Sans", color:[OFF_WHITE,OFF_WHITE,OFF_WHITE,WHITE], horizontal:"left", left:10 },
		button: { font:"600 18px Open Sans", color:[GRAY_4,OFF_WHITE,OFF_WHITE,WHITE] },
		
		textName: { font:"18px Open Sans", color:OFF_WHITE },
		textValue: { font:"600 18px Open Sans", color:OFF_WHITE },
		textNameLeft: { font:"18px Open Sans", color:OFF_WHITE, horizontal:"left", left:10 },
		textValueLeft: { font:"600 18px Open Sans", color:OFF_WHITE, horizontal:"left", left:10 },
		textNameRight: { font:"18px Open Sans", color:OFF_WHITE, horizontal:"right", right:10 },
		textValueRight: { font:"600 18px Open Sans", color:OFF_WHITE, horizontal:"right", right:10 },
	},
}, true);

const UNIT = 40;

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
	left:$.left, width:$.width, top:$.top, height:$.height, skin:theme.skins.button, clip:true, active:true,
	Behavior: class extends ButtonBehavior {
		onTap(button) {
			this.data.onTap();
		}
	},
	contents: [
		Label($, { style:theme.styles.button, string:$.label }),
	],
}));

class REDDropDownBehavior extends ButtonBehavior {
	onCreate(container, data) {
		super.onCreate(container, data);
		data.container = container;
		let style = globalThis.menuItemStyle;
		if (!style)
			style = globalThis.menuItemStyle = new Style(theme.styles.tabMenuItem);
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
		container.first.next.string = (selection < 0) ? data.placeHolder : data.options[selection].label;
	}
}

let REDDropDown = Row.template($ => ({
	left:$.left, width:$.width, top:$.top, height:$.height, clip:true,
	contents: [
		Label($, { left:0, right:0, top:0, bottom:0, style:theme.styles.textNameLeft, string:$.label }),
		Row($, {
			left:0, width:0, top:0, bottom:0, skin:theme.skins.dropDown, active:true, Behavior: REDDropDownBehavior,
			contents: [
				Content($, { width:UNIT, top:0, bottom:0, skin:theme.skins.dropDownIcon  }),
				Label($, { left:0, right:0, top:0, bottom:0, style:theme.styles.tabMenuItem }),
			],
		}),
	],
}));

let REDDropDownMenu = Layout.template($ => ({
	left:0, right:0, top:0, bottom:0, active:true, backgroundTouch:true, skin:theme.skins.tabMenuBackground,
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
				scroller.first.content(data.selection).first.visible = true;
			return value;
		}
	},
	contents: [
		Container($, {
			clip:true, skin:theme.skins.dropDown, state:1,
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
	left:0, right:0, height:UNIT, skin:theme.skins.tabMenuItem, active:true,
	Behavior: PopupMenuItemBehavior,
	contents: [
		Content($, { width:UNIT, top:0, bottom:0, skin:theme.skins.tabMenuItemIcon, visible:false  }),
		Label($, { left:0, right:0, top:0, bottom:0, style:theme.styles.tabMenuItem, string:$.label }),
	],
}));

class REDGaugeBehavior extends Behavior {
	onCreate(container, data) {
		this.data = data;
		data.container = container;
		
		const shape = container.first;
		shape.skin = new Skin({fill:GRAY_4, stroke:data.colors});
	}
	onDisplaying(container) {
		this.onUpdate(container);
	}
	onUpdate(container) {
		const data = this.data;
		const { min, max, value, seg1, seg2 } = data;
		const fraction = (value - min) / (max - min);
		const { width, height } = container;
		const shape = container.first;
		const label = container.last;
		
		const x = width >> 1;
		const y = height - 10;
		let r = height - 50;
		if (r > x) r = x;
		
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
	left:$.left, width:$.width, top:$.top, height:$.height, clip:true, Behavior: REDGaugeBehavior,
	contents: [
		Shape(1, { left:0, right:0, top:0, bottom:0 } ),
		Label($, { left:0, right:0, top:0, height:40, style:theme.styles.textName, string:$.title }),
		Label($, { left:0, right:0, bottom:0, height:40, style:theme.styles.textValue }),
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
		Label($, { left:0, right:0, top:0, bottom:0, style:theme.styles.textNameLeft, string:$.label }),
		Row($, {
			width:3*UNIT, height:UNIT, Behavior: REDNumericBehavior,
			contents: [
				Container(-1, {
					width:UNIT, height:UNIT, skin:theme.skins.numericLeft, active:true, Behavior: REDNumericButtonBehavior,
					contents: [
						Content($, { width:UNIT, height:UNIT, skin:theme.skins.numericLess }),
					],
				}),
				Label($, { width:UNIT, height:UNIT, skin:theme.skins.numericCenter, style:theme.styles.textValue, state:1 }),
				Container(1, {
					width:UNIT, height:UNIT, skin:theme.skins.numericRight, active:true, Behavior: REDNumericButtonBehavior,
					contents: [
						Content($, { width:UNIT, height:UNIT, skin:theme.skins.numericMore }),
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
		$.label ? Label($, { height:UNIT, style:theme.styles.textNameLeft, string:$.label }) : null,
		Container($, {
			left:0, right:0, height:UNIT, active:true, Behavior: REDSliderBehavior,
			contents: [
				Content($, { left:0, right:0, top:0, bottom:0, skin:theme.skins.sliderBar }),
				Content($, { left:0, width:0, top:0, bottom:0, skin:theme.skins.sliderBar, state:1 }),
				Content($, { left:0, width:UNIT, top:0, bottom:0, skin:theme.skins.sliderThumb  }),
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
		bar.state = container.active ? 1 + (this.offset / this.size) : 0;
		button.state = container.active ? 1 : 0;
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
		Label($, { left:0, right:0, top:0, bottom:0, style:theme.styles.textNameLeft, string:$.label }),
		Container($, {
			width:60, height:UNIT, active:true, Behavior:REDSwitchBehavior,
			contents: [
				Content($, { left:0, right:0, top:0, bottom:0, skin:theme.skins.switchBar }),
				Content($, { left:0, width:UNIT, top:0, bottom:0, skin:theme.skins.sliderThumb  }),
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
				Label($, { top:0, bottom:0, style:theme.styles.textNameLeft, string:$.label }),
				Label($, { top:0, bottom:0, style:theme.styles.textValueLeft, string:"" }),
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
				Label($, { top:0, bottom:0, style:theme.styles.textName, string:$.label }),
				Label($, { top:0, bottom:0, style:theme.styles.textValue, string:"" }),
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
				Label($, { top:0, bottom:0, style:theme.styles.textNameRight, string:$.label }),
				Label($, { top:0, bottom:0, style:theme.styles.textValueRight, string:"" }),
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
				Label($, { left:0, right:0, top:0, bottom:0, style:theme.styles.textNameLeft, string:$.label }),
				Label($, { left:0, right:0, top:0, bottom:0, style:theme.styles.textValueRight, string:"" }),
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
				Label($, { left:0, right:0, style:theme.styles.textName, string:$.label }),
				Label($, { left:0, right:0, style:theme.styles.textValue, string:"" }),
			],
		}),
	],
}));

let REDGroupTitle = Row.template($ => ({
	left:0, right:0, top:0, height:UNIT, skin:theme.skins.groupTitle,
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
		Content($, { width:($.collapse) ? UNIT : 0, top:0, bottom:0, skin:theme.skins.groupIcon, variant:2  }),
		Label($, { left:0, right:0, top:0, bottom:0, style:theme.styles.groupTitle, string:$.name }),
	],
}));

let REDGroupScroller = Scroller.template($ => ({
	left:0, right:0, height:$.height, active:true, backgroundTouch:true, Behavior:HorizontalScrollerBehavior, clip:true,
	contents: [
		Container($, {
			left:0, width:$.width, top:0, bottom:0, skin:theme.skins.group,
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
	left:0, right:0, top:0, height:UNIT, skin:theme.skins.tabTitle,
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
		Content($, { width:($.tabs.length > 1) ? UNIT : 0, top:0, bottom:0, skin:theme.skins.tabMenuIcon  }),
		Label($, { left:0, right:0, top:0, bottom:0, style:theme.styles.tabTitle }),
	],
}));

let REDTabMenu = Layout.template($ => ({
	left:0, right:0, top:0, bottom:0, active:true, backgroundTouch:true, skin:theme.skins.tabMenuBackground,
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
			Scroller($, { clip:true, active:true, skin:theme.skins.tabMenu, contents:[
				Column($, { left:0, right:0, top:0, 
					contents: $.items.map($$ => new REDTabMenuItem($$)),
				}),
			]}),
		]}),
	],
}));

let REDTabMenuItem = Row.template($ => ({
	left:0, right:0, height:UNIT, skin:theme.skins.tabMenuItem, active:true,
	Behavior: PopupMenuItemBehavior,
	contents: [
		Content($, { width:UNIT, top:0, bottom:0, skin:theme.skins.tabMenuItemIcon, visible:false  }),
		Label($, { left:0, right:0, top:0, bottom:0, style:theme.styles.tabMenuItem, string:$.title }),
	],
}));

let REDApplication = Application.template($ => ({
	skin:theme.skins.tab,
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
	REDApplication,
	REDButton,
	REDDropDown,
	REDGauge,
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