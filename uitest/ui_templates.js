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
	},
	styles: {
		tabTitle: { font:"600 18px Open Sans", color:[OFF_WHITE,OFF_WHITE,OFF_WHITE,WHITE], horizontal:"left", left:10 },
		tabMenuItem: { font:"600 18px Open Sans", color:[GRAY_4,OFF_WHITE,OFF_WHITE,WHITE], horizontal:"left", left:10 },
		groupTitle: { font:"600 18px Open Sans", color:[OFF_WHITE,OFF_WHITE,OFF_WHITE,WHITE], horizontal:"left", left:10 },
		button: { font:"600 18px Open Sans", color:[GRAY_4,OFF_WHITE,OFF_WHITE,WHITE] },
		dropDownLabel: { font:"18px Open Sans", color:OFF_WHITE, left:10, right:10 },
		textName: { font:"18px Open Sans", color:[OFF_WHITE] },
		textValue: { font:"600 18px Open Sans", color:[OFF_WHITE] },
		textNameLeft: { font:"18px Open Sans", color:[OFF_WHITE], horizontal:"left", left:10 },
		textValueLeft: { font:"600 18px Open Sans", color:[OFF_WHITE], horizontal:"left", left:10 },
		textNameRight: { font:"18px Open Sans", color:[OFF_WHITE], horizontal:"right", right:10 },
		textValueRight: { font:"600 18px Open Sans", color:[OFF_WHITE], horizontal:"right", right:10 },
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
	onDisplaying(container) {
		super.onDisplaying(container);
		this.selection = -1;
		container.first.next.string = this.data.place;
	}
	onMenuSelected(container, index) {
		if ((index >= 0) && (this.selection != index)) {
			let data = this.data;
			let item = data.options[index];
			this.selection = index;
			data.value = item.value;
			container.first.next.string = item.label;
			this.data.onSelect(index);
		}
	}
	onTap(container) {
		let data = this.data;
		let it = {
			button: container,
			items: data.options,
			selection: this.selection,
		};
		application.add(new REDDropDownMenu(it));
	}
}

let REDDropDown = Row.template($ => ({
	left:$.left, width:$.width, top:$.top, height:$.height, clip:true,
	contents: [
		$.label ? Label($, { top:0, bottom:0, style:theme.styles.dropDownLabel, string:$.label }) : null,
		Row($, {
			left:0, right:0, top:0, bottom:0, skin:theme.skins.dropDown, active:true, Behavior: REDDropDownBehavior,
			contents: [
				Content($, { width:UNIT, top:0, bottom:0, skin:theme.skins.dropDownIcon  }),
				Label($, { left:0, right:0, top:0, bottom:0, style:theme.styles.tabTitle }),
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
			let size = scroller.first.measure();
			let selection = scroller.first.measure();
			let y;
			if (data.selection >= 0)
				y = Math.max(button.y - ((size.height / data.items.length) * data.selection), 0);
			else
				y = button.y + button.height;
			let height = Math.min(size.height, application.height - y);
			container.coordinates = { left:button.x - 10, width:button.width + 20, top:y, height:height + 10 };
			scroller.coordinates = { left:10, width:button.width + 10, top:0, height:height };
			if (data.selection >= 0)
				scroller.first.content(data.selection).first.visible = true;
			return value;
		}
	},
	contents: [
		Container($, { contents:[
			Scroller($, { skin:theme.skins.tabMenu, clip:true, active:true, backgroundTouch:true, Behavior:VerticalScrollerBehavior, 
				contents:[
					Column($, { left:0, right:0, top:0, 
						contents: $.items.map($$ => new REDDropDownMenuItem($$)),
					}),
				]
			}),
		]}),
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

let REDSpacer = Content.template($ => ({
	left:$.left, width:$.width, top:$.top, height:$.height
}));

class REDTextBehavior extends Behavior {
	onCreate(container, data) {
		data.container = container;
	}
	onMessage(container, string) {
		container.first.last.string = string;
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
	REDSpacer,
	REDTextRowLeft,
	REDTextRowCenter,
	REDTextRowRight,
	REDTextRowSpread,
	REDTextColumnCenter,
	UNIT
};