import {} from "piu/MC";
import {
	registerTemplate
} from "ui_nodes";
import {
	REDSliderBehavior,
	REDSwitchBehavior,
	
} from "ui_templates";

const BLACK = "black";
const GRAY = "#555555";
const LIGHT_GRAY = "#a9a9a9";
const LIGHTEST_GRAY = "#ebebeb";
const WHITE = "white";
const GREEN = "#57ad62"
const TRANSPARENT = "transparent";

const theme = Object.freeze({
	skins: {
		brightnessBar: { texture:{ path:"brightness-bar.png" }, color:[LIGHT_GRAY, WHITE], x:0, y:0, width:64, height:60, left:16, right:16 },
		brightnessIcon: { texture:{ path:"brightness-icon.png" }, color: [WHITE, BLACK], x:0, y:0, width:40, height:40 },
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
