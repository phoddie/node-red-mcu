import { UIControlNode, registerConstructor, registerThemeBuilder } from "ui_nodes";

class UIColorPickerNode extends UIControlNode {
	constructor(id, flow, name) {
		super(id, flow, name);
	}
	onChanged() {
		const { r, g, b, a } = this.color;
		let payload;
		function toHex(n) {
			return (n < 16) ? "0" + n.toString(16) : n.toString(16);
		}
		if (this.format == "hex") {
			payload = toHex(r) + toHex(g) + toHex(b);
		}
		else if (this.format == "hex8") {
			payload = toHex(r) + toHex(g) + toHex(b) + toHex(a);
		}
		else if (this.outformat == "object") {
			if (this.format == "hsl")
				payload = this.hsl;
			else if (this.format == "hsv")
				payload = this.hsv;
			else
				payload = this.rgb;
		}
		else {
			if (this.format == "hsl") {
				const hsl = this.hsl;
				if (rgb.a != 1) 
					payload = `hsla(${hsl.h},${hsl.s},${hsl.l},${hsl.a.toFixed(2)})`;
				else
					payload = `hsl(${hsl.h},${hsl.s},${hsl.l})`;
			}
			else if (this.format == "hsv") {
				const hsv = this.hsv;
				if (rgb.a != 1) 
					payload = `hsva(${hsv.h},${hsv.s},${hsv.v},${hsv.a.toFixed(2)})`;
				else
					payload = `hsv(${hsv.h},${hsv.s},${hsv.v})`;
			}
			else {
				const rgb = this.rgb;
				if (rgb.a != 1) 
					payload = `rgba(${rgb.r},${rgb.g},${rgb.b},${rgb.a.toFixed(2)})`;
				else
					payload = `rgb(${rgb.r},${rgb.g},${rgb.b})`;
			}
		}
		this.msg.payload = payload;
		this.send(this.msg);
	}
	onMessage(msg) {
		const payload = msg.payload;
		const r = 0, g = 0, b = 0, a = 255;
		if (typeof(payload) == "object") {
			if (payload.hasOwnProperty("r") && payload.hasOwnProperty("g") && payload.hasOwnProperty("b"))
				this.rgb = payload;
			else if (payload.hasOwnProperty("h") && payload.hasOwnProperty("s")) {
				if (payload.hasOwnProperty("l"))
					this.hsl = payload;
				else if (payload.hasOwnProperty("v"))
					this.hsv = payload;
			}
		}
		else if (typeof(payload) == "string") {
			debugger
		}
		this.container?.delegate("onUpdate");
		if (this.passthru && (this.msg._msgid != msg._msgid))
			this.send(this.msg);
	}
	onStart(config) {
		super.onStart(config);
		this.dynOutput = config.dynOutput;
		this.format = config.format;
		this.label = config.label;
		this.outformat = config.outformat;
		this.msg = { topic: config.topic }
		this.passthru = config.passthru;
		this.showAlpha = config.showAlpha;
		this.showHue = config.showHue;
		this.showLightness = config.showLightness;
		this.color = { r:128, g:128, b:128, a:255 };
		this.Template = this.lookupTemplate(config, REDColorPicker);
	}
	get hsl() {
		const color = this.color;
		const r = color.r / 255;
		const g = color.g / 255;
		const b = color.b / 255;
		const a = color.a / 255;
		const l = Math.max(r, g, b);
		const s = l - Math.min(r, g, b);
		const h = s ? l === r ? (g - b) / s : l === g ? 2 + (b - r) / s : 4 + (r - g) / s : 0;
		return {
			h:60 * h < 0 ? 60 * h + 360 : 60 * h,
			s:(s ? (l <= 0.5 ? s / (2 * l - s) : s / (2 - (2 * l - s))) : 0),
			l:((2 * l - s)) / 2,
			a
		};
	}
	set hsl(it) {
		let h = Math.mod(it.h, 360);
		if (h < 0)
			h += 360;
		let s = Math.max(0, Math.min(1, it.s));
		let l = Math.max(0, Math.min(1, it.l));
		const k = n => (n + h / 30) % 12;
		const a = s * Math.min(l, 1 - l);
		const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
		const color = this.color;
		color.r = Math.round(255 * f(0));
		color.g = Math.round(255 * f(8));
		color.b = Math.round(255 * f(4));
		if (it.hasOwnProperty("a"))
			color.a = Math.max(0, Math.min(255, Math.round(it.a * 255)));
		else
			color.a = 255;
	}
	get hsv() {
		const color = this.color;
		const r = color.r / 255;
		const g = color.g / 255;
		const b = color.b / 255;
		const a = color.a / 255;
		const v = Math.max(r, g, b), n = v - Math.min(r, g, b);
		const h = n === 0 ? 0 : n && v === r ? (g - b) / n : v === g ? 2 + (b - r) / n : 4 + (r - g) / n;
		return {
			h:60 * (h < 0 ? h + 6 : h),
			s:v && (n / v),
			v,
			a
		};
	}
	set hsv(it) {
		let h = Math.mod(it.h, 360);
		if (h < 0)
			h += 360;
		let s = Math.max(0, Math.min(1, it.s));
		let v = Math.max(0, Math.min(1, it.v));
		const k = (n) => (n + h / 60) % 6;
		const f = (n) => v * (1 - s * Math.max(0, Math.min(k(n), 4 - k(n), 1)));
		const color = this.color;
		color.r = Math.round(255 * f(5));
		color.g = Math.round(255 * f(3));
		color.b = Math.round(255 * f(1));
		if (it.hasOwnProperty("a"))
			color.a = Math.max(0, Math.min(255, Math.round(it.a * 255)));
		else
			color.a = 255;
	}
	get rgb() {
		const color = this.color;
		return {
			r: color.r,
			g: color.g,
			b: color.b,
			a: color.a / 255
		}
	}
	set rgb(it) {
		const color = this.color;
		color.r = Math.max(0, Math.min(255, Math.round(it.r)));
		color.g = Math.max(0, Math.min(255, Math.round(it.g)));
		color.b = Math.max(0, Math.min(255, Math.round(it.b)));
		if (it.hasOwnProperty("a"))
			color.a = Math.max(0, Math.min(255, Math.round(it.a * 255)));
		else
			color.a = 255;
	}
}
registerConstructor("ui_colour_picker", UIColorPickerNode);

import {} from "piu/MC";
import {} from "piu/shape";

import {
	REDBehavior,
	REDButtonBehavior,
	UNIT
}  from "./ui_templates";

const BLACK = "black";
const GRAY = "#7f8182";
const WHITE = "white";
const TRANSPARENT = "transparent";

function buildTheme(theme) {
	let colors = globalThis.REDTheme.colors;
	let skins = globalThis.REDTheme.skins;
	let texture, color;
	
	skins.colorPicker = new Skin({ fill:GRAY, stroke:WHITE, left:1, right:1, top:1, bottom:1 });
	
	texture = new Texture({ path:"ui-color-picker.png" });
	
	skins.colorWheel = new Skin({ texture, x:0, y:0, width:120, height:120 });
	skins.colorHueSlider = new Skin({ texture, x:0, y:120, width:120, height:20 });
	skins.colorLightnessOverlay = new Skin({ fill:[BLACK,TRANSPARENT,WHITE] });
	skins.colorTranparencyOverlay = new Skin({ texture, x:0, y:140, width:40, height:40, left:0, right:0, top:0, bottom:0, states:40 });
	skins.colorThumbTranparency = new Skin({ texture, x:40, y:140, width:20, height:20, states:40 });

	texture = new Texture({ path:"ui-color-picker-mask.png" });

	skins.colorWheelMask = new Skin({ texture, color:GRAY, x:0, y:0, width:120, height:120 });
	skins.colorSliderMask = new Skin({ texture, color:GRAY, x:0, y:120, width:120, height:20, left:20, right:20 });
	skins.colorSliderLightness = new Skin({ texture, color:[BLACK,WHITE], x:0, y:140, width:60, height:20, variants:60 });
	skins.colorSliderTransparency = new Skin({ texture, x:0, y:160, width:120, height:20 });
	skins.colorThumbMask = new Skin({ texture, color:[TRANSPARENT,WHITE,GRAY], x:0, y:180, width:40, height:40, variants:40 });
}
registerThemeBuilder(buildTheme);

class REDColorPickerBehavior extends REDBehavior {
	onTouchEnded(container, id, x, y, ticks) {
		application.add(new REDColorDialog(this.data));
	}
	onUpdate(container) {
		const data = this.data;
		const color = data.rgb;
		container.distribute("onUpdateColor", data.hsl, rgb(color.r, color.g, color.b));
	}
}

class REDColorPickerDialogBehavior extends Behavior {
	onCreate(container, data) {
		this.data = data;
	}
	onColorChanging(container, h, s, l, a) {
		const data = this.data;
		if (h !== undefined)
			this.hsl.h = h;
		if (s !== undefined)
			this.hsl.s = s;
		if (l !== undefined)
			this.hsl.l = l;
		if (a !== undefined)
			this.hsl.a = a;
		data.hsl = this.hsl;
		const color = data.rgb;
		container.distribute("onUpdateColor", this.hsl, rgb(color.r, color.g, color.b));
		if (data.dynOutput)
			data.onChanged();
	}
	onColorChanged(container, id, x, y, ticks) {
		this.data.onChanged();
	}
	onCreate(container, data) {
		this.data = data;
	}
	onDisplaying(container) {
		this.onUpdate(container);
	}
	onTouchEnded(layout, id, x, y, ticks) {
		const application = layout.application;
		if (application) {
			application.remove(layout);
		}
	}
	onUpdate(container) {
		const data = this.data;
		this.hsl = data.hsl;
		const color = data.rgb;
		container.distribute("onUpdateColor", this.hsl, rgb(color.r, color.g, color.b));
	}
	onUpdateColor(container, hsl, color) {
		this.data.container.distribute("onUpdateColor", hsl, color);
	}
};

class REDColorWheelBehavior extends Behavior {
	onCreate(container, data) {
		this.data = data;
	}
	onTouchBegan(container, id, x, y, ticks) {
		container.captureTouch(id, x, y, ticks);
		this.onTouchMoved(container, id, x, y, ticks);
	}
	onTouchMoved(container, id, x, y, ticks) {
		const data = this.data;
		const thumb = container.last;
		const thumbRadius = thumb.width >> 1;
		const wheelRadius = container.width >> 1;
		const r = wheelRadius - thumbRadius;
		const cx = container.x + wheelRadius;
		const cy = container.y + wheelRadius;
		x -= cx;
		y -= cy;
		let a = Math.atan2(y, x);
		let d = Math.sqrt(x ** 2 + y ** 2);
		if (d > r) {
			x = Math.cos(a) * r;
			y = Math.sin(a) * r;
			d = r;
		}
		thumb.x = cx + x - thumbRadius;
		thumb.y = cy + y - thumbRadius;
		a = -a * 180 / Math.PI;
		if (a < 0)
			a += 360;
		container.bubble("onColorChanging", a, d / r, undefined, undefined);
	}
	onTouchEnded(container, id, x, y, ticks) {
		container.bubble("onColorChanged");
	}
	onUpdateColor(container, hsl, color) {
		const thumb = container.last;
		const thumbRadius = thumb.width >> 1;
		const wheelRadius = container.width >> 1;
		const r = wheelRadius - thumbRadius;
		const cx = container.x + wheelRadius;
		const cy = container.y + wheelRadius;
		const a = -hsl.h * Math.PI / 180;
		const d = hsl.s * r;
		const x = Math.cos(a) * d;
		const y = Math.sin(a) * d;
		thumb.x = cx + x - thumbRadius;
		thumb.y = cy + y - thumbRadius;
	}
}

class REDColorSliderBehavior extends Behavior {
	onCreate(container, data) {
		this.data = data;
	}
	onFractionChanging(container, fraction) {
		debugger
	}
	onTouchBegan(container, id, x, y, ticks) {
		container.captureTouch(id, x, y, ticks);
		this.onTouchMoved(container, id, x, y, ticks);
	}
	onTouchMoved(container, id, x, y, ticks) {
		const thumb = container.last.last;
		const width = thumb.width;
		let fraction = (x - (container.x + (width >> 1))) / (container.width - width);
		if (fraction < 0)
			fraction = 0;
		else if (fraction > 1)
			fraction = 1;
		this.onFractionChanging(container, fraction);
	}
	onTouchEnded(container, id, x, y, ticks) {
		container.bubble("onColorChanged");
	}
}
class REDColorHueSliderBehavior extends REDColorSliderBehavior {
	onFractionChanging(container, fraction) {
		container.bubble("onColorChanging", fraction * 360, undefined, undefined, undefined);
	}
	onUpdateColor(container, hsl, color) {
		const thumb = container.last;
		const width = container.width - thumb.width;
		thumb.x = container.x + Math.round((hsl.h) * width / 360);
	}
}
class REDColorLightnessSliderBehavior extends REDColorSliderBehavior {
	onFractionChanging(container, fraction) {
		container.bubble("onColorChanging", undefined, undefined, fraction, undefined);
	}
	onUpdateColor(container, hsl, color) {
		const thumb = container.last;
		const width = container.width - thumb.width;
		thumb.x = container.x + Math.round((hsl.l) * width);
	}
}
class REDColorTransparencySliderBehavior extends REDColorSliderBehavior {
	onFractionChanging(container, fraction) {
		container.bubble("onColorChanging", undefined, undefined, undefined, 1 - fraction);
	}
	onUpdateColor(container, hsl, color) {
		const thumb = container.last;
		const width = container.width - thumb.width;
		thumb.x = container.x + Math.round((1 - hsl.a) * width);
	}
}

class REDColorLightnessOverlayBehavior extends Behavior {
	onUpdateColor(content, hsl, color) {
		content.state = hsl.l * 2;
	}
};
class REDColorTransparencyOverlayBehavior extends Behavior {
	onUpdateColor(content, hsl, color) {
		content.state = 1 - hsl.a;
	}
};

const REDColorPicker = Row.template($ => ({
	left:$.left, width:$.width, top:$.top, height:$.height, clip:true, active:true, Behavior:REDColorPickerBehavior,
	contents: [
		Label($, { left:0, right:0, top:0, bottom:0, style:REDTheme.styles.textNameLeft, string:$.label }),
		REDColorThumb($, {}),
		Content($, { width:10 }),
	],
}));
const REDColorThumb = Container.template($ => ({
	left:0, width:40, top:0, height:40,
	contents: [
		Content($, { skin:REDTheme.skins.colorThumbMask, state:2, variant:2 }),
		Content($, { skin:REDTheme.skins.colorThumbMask, state:1, variant:1 }),
		Port($, {
			width:40, height:40,
			Behavior: class extends Behavior {
				onCreate(port, data) {
					this.color = 0;
					this.skin = REDTheme.skins.colorThumbMask;
				}
				onDraw(port) {
					const skin = this.skin;
					port.drawTexture(skin.texture, this.color, 0, 0, skin.x, skin.y, skin.width, skin.height);
				}
				onUpdateColor(port, hsl, color) {
					this.color = color;
					port.invalidate();
				}
			},
		}),
		Content($, { skin:REDTheme.skins.colorThumbTranparency, Behavior:REDColorTransparencyOverlayBehavior }),
	],
}));

const REDColorDialog = Container.template($ => ({
	left:0, right:0, top:0, bottom:0, active:true, backgroundTouch:true, skin:REDTheme.skins.menuBackground, Behavior:REDColorPickerDialogBehavior,
	contents: [
		Column($, {
			skin:REDTheme.skins.colorPicker,
			contents: [
				REDColorWheel($, {}),
				$.showHue ? REDColorHueSlider($, {}) : null,
				$.showLightness ? REDColorLightnessSlider($, {}) : null,,
				$.showAlpha ? REDColorTransparencySlider($, {}) : null,,
			],
		}),
	],
}));
const REDColorWheel = Container.template($ => ({
	width:160, height:160, active:true, Behavior:REDColorWheelBehavior,
	contents: [
		Container($, {
			width:120, height:120,
			contents: [
				Content($, { skin:REDTheme.skins.colorWheel }),
				Content($, { left:0, right:0, top:0, bottom:0, skin:REDTheme.skins.colorLightnessOverlay, Behavior:REDColorLightnessOverlayBehavior }),
				Content($, { left:0, right:0, top:0, bottom:0, skin:REDTheme.skins.colorTranparencyOverlay, Behavior:REDColorTransparencyOverlayBehavior }),
				Content($, { skin:REDTheme.skins.colorWheelMask }),
			],
		}),
		REDColorThumb($, {}),
	],
}));
const REDColorHueSlider = Container.template($ => ({
	width:140, height:40, skin:REDTheme.skins.colorHueSlider, active:true, Behavior:REDColorHueSliderBehavior,
	contents: [
		Container($, {
			width:120, height:20,
			contents: [
				Content($, { left:0, right:0, top:0, bottom:0, skin:REDTheme.skins.colorLightnessOverlay, Behavior:REDColorLightnessOverlayBehavior }),
				Content($, { left:0, right:0, top:0, bottom:0, skin:REDTheme.skins.colorTranparencyOverlay, Behavior:REDColorTransparencyOverlayBehavior }),
			],
		}),
		Content($, { left:0, right:0, height:20, skin:REDTheme.skins.colorSliderMask }),
		REDColorThumb($, {}),
	],
}));
const REDColorLightnessSlider = Container.template($ => ({
	width:140, height:40, active:true, Behavior:REDColorLightnessSliderBehavior,
	contents: [
		Container($, {
			width:120, height:20,
			contents: [
				Port($, {
					left:0, right:0, top:0, bottom:0,
					Behavior: class extends Behavior {
						onCreate(port, data) {
							this.color = 0;
						}
						onDraw(port) {
							port.fillColor(this.color, 0, 0, port.width, port.height);
						}
						onUpdateColor(port, hsl, color) {
							this.color = color;
							port.invalidate();
						}
					},
				}),
				Content($, { left:0, width:60, top:0, bottom:0, skin:REDTheme.skins.colorSliderLightness }),
				Content($, { right:0, width:60, top:0, heighbottom:0, skin:REDTheme.skins.colorSliderLightness, state:1, variant:1 }),
				Content($, { left:0, right:0, top:0, bottom:0, skin:REDTheme.skins.colorTranparencyOverlay, Behavior:REDColorTransparencyOverlayBehavior }),
			],
		}),
		Content($, { left:0, right:0, height:20, skin:REDTheme.skins.colorSliderMask }),
		REDColorThumb($, {}),
	],
}));
const REDColorTransparencySlider = Container.template($ => ({
	width:140, height:40, active:true, Behavior:REDColorTransparencySliderBehavior,
	contents: [
		Container($, {
			width:120, height:20,
			contents: [
				Content($, { left:0, right:0, top:0, bottom:0, skin:REDTheme.skins.colorTranparencyOverlay, state:1 }),
				Port($, { left:0, right:0, top:0, bottom:0,
					Behavior: class extends Behavior {
						onCreate(port, data) {
							this.color = 0;
							this.skin = REDTheme.skins.colorSliderTransparency;
						}
						onDraw(port) {
							const skin = this.skin;
							port.fillTexture(skin.texture, this.color, 0, 0, port.width, port.height, skin.x, skin.y, skin.width, skin.height);
						}
						onUpdateColor(port, hsl, color) {
							this.color = color;
							port.invalidate();
						}
					},
				}),
			],
		}),
		Content($, { left:0, right:0, height:20, skin:REDTheme.skins.colorSliderMask }),
		REDColorThumb($, {}),
	],
}));







