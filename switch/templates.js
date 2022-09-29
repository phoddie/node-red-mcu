import {} from "piu/MC";
import {
	registerTemplate
} from "ui_nodes";
import {
	REDBehavior,
	REDSliderBehavior,
	REDSwitchBehavior,
} from "ui_templates";

const BLACK = "black";
const LIGHT_GRAY = "#a9a9a9";
const WHITE = "white";
const GREEN = "#57ad62"
const TRANSPARENT = "transparent";

const theme = Object.freeze({
	skins: {
		brightnessBar: { texture:{ path:"brightness-bar.png" }, color:[LIGHT_GRAY, WHITE], x:0, y:0, width:64, height:60, left:16, right:16 },
		brightnessIcon: { texture:{ path:"brightness-icon.png" }, color: [WHITE, BLACK], x:0, y:0, width:40, height:40 },
		colorWheel: { texture:{ path:"color-wheel.png" }, x:0, y:0, width:160, height:160 },
		colorThumb: { texture:{ path:"color-thumb.png" }, color:["#333333", WHITE], x:0, y:0, width:40, height:40, variants:40 },
		powerBar: { texture:{ path:"power-bar.png" }, color:[TRANSPARENT, LIGHT_GRAY, GREEN], x:0, y:0, width:120, height:60 },
		powerThumb: { texture:{ path:"power-thumb.png" }, color:WHITE, x:0, y:0, width:60, height:60 },
	}
}, true);


let BrightnessSlider = Container.template($ => ({
	left:$.left, width:$.width, top:$.top, height:$.height,
	contents: [
		Container($, {
			left:20, right:20, height:60, skin:theme.skins.brightnessBar, active:true, Behavior:REDSliderBehavior,
			contents: [
				Content($, { skin:theme.skins.brightnessIcon }),
				Container($, {
					left:0, width:0, top:0, bottom:0, clip:true,
					contents: [
						Content($, { left:0, width:$.width - 40, top:0, bottom:0, skin:theme.skins.brightnessBar, state:1 }),
						Content($, { left:($.width - 80) >> 1, skin:theme.skins.brightnessIcon, state:1 }),
					],
				}),
				Content($, { }),
			],
		}),
	],
}));
registerTemplate("piu-slider-brightness", BrightnessSlider);

class ColorWheelBehavior extends REDBehavior {
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
		const a = Math.atan2(y, x);
		let d = Math.sqrt(x ** 2 + y ** 2);
		if (d > r) {
			x = Math.cos(a) * r;
			y = Math.sin(a) * r;
			d = r;
		}
		thumb.x = cx + x - thumbRadius;
		thumb.y = cy + y - thumbRadius;
		data.hsv = { h:-a * 180 / Math.PI, s:d / r, v:1 };
		if (data.dynOutput)
			data.onChanged();
		thumb.first.invalidate();
	}
	onTouchEnded(container, id, x, y, ticks) {
		this.data.onChanged();
	}
	onUpdate(container) {
		const thumb = container.last;
		const thumbRadius = thumb.width >> 1;
		const wheelRadius = container.width >> 1;
		const r = wheelRadius - thumbRadius;
		const cx = container.x + wheelRadius;
		const cy = container.y + wheelRadius;
		const hsv = this.data.hsv;
		const a = -hsv.h * Math.PI / 180;
		const d = hsv.s * r;
		const x = Math.cos(a) * d;
		const y = Math.sin(a) * d;
		thumb.x = cx + x - thumbRadius;
		thumb.y = cy + y - thumbRadius;
		thumb.first.invalidate();
	}
}

const ColorWheel = Container.template($ => ({
	left:$.left, width:$.width, top:$.top, height:$.height, clip:true,
	contents: [
		Container($, {
			width:160, height:160, active:true, Behavior:ColorWheelBehavior,
			contents: [
				Content($, { skin:theme.skins.colorWheel }),
				Container($, {
					left:60, width:40, top:60, height:40,
					contents: [
						Port($, {
							width:40, height:40,
							Behavior: class extends Behavior {
								onCreate(port, data) {
									this.data = data;
									this.texture = new Texture(theme.skins.colorThumb.texture);
								}
								onDraw(port) {
									const color = this.data.color;
									port.drawTexture(this.texture, rgb(color.r, color.g, color.b), 0, 0, 0, 0, 40, 40);
								}
							},
						}),
						Content($, { skin:theme.skins.colorThumb, variant:1 }),
					],
				}),
			],
		}),
	],
}));
registerTemplate("piu-color-wheel", ColorWheel);

const PowerSwitch = Container.template($ => ({
	left:$.left, width:$.width, top:$.top, height:$.height, clip:true,
	contents: [
		Container($, {
			width:120, active:true, Behavior:REDSwitchBehavior,
			contents: [
				Content($, { width:120, skin:theme.skins.powerBar }),
				Content($, { left:0, width:60, top:0, skin:theme.skins.powerThumb  }),
			],
		}),
	],
}));
registerTemplate("piu-switch-power", PowerSwitch);
