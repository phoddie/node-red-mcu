import Mustache from "mustache";
import { UIControlNode, registerConstructor } from "ui_nodes";

class UIGaugeNode extends UIControlNode {
	constructor(id, flow, name) {
		super(id, flow, name);
	}
	onMessage(msg) {
		const { min, max } = this;
		let value = Number(msg.payload);
		if (value < min)
			value = min;
		else if (value > max)
			value = max;
		this.value = value;
		this.container?.delegate("onUpdate");
	}
	onStart(config) {
		super.onStart(config);
		this.colors = config.colors;
		this.format = config.format;
		this.label = config.label;
		const min = this.min = config.min;
		const max = this.max = config.max;
		let seg1 = config.seg1;
		let seg2 = config.seg2;
		if ((seg1 != "") && (seg2 != "")) {
			seg1 =  Math.min(max, Math.max(min, Number(seg1)));
			seg2 =  Math.min(max, Math.max(min, Number(seg2)));
			this.seg1 = Math.min(seg1, seg2);
			this.seg2 = Math.max(seg1, seg2);
		}
		else {
			this.seg1 = undefined;
			this.seg2 = undefined;
		}
		this.title = config.title;
		this.value = this.min;
		let Template;
		switch (config.gtype) {
		case "compass": Template = REDGaugeCompass; break;
		case "donut": Template = REDGaugeDonut; break;
		default: Template = REDGauge; break;
		}
		this.Template = this.lookupTemplate(config, Template);
	}
	measure(group) {
		if (this.width == 0)
			this.width = group.width;
		if (this.height == 0) {
			this.height = group.width >> 1;
			if (this.title)
				this.height++;
		}
	}
}
registerConstructor("ui_gauge", UIGaugeNode);

import {} from "piu/MC";
import {} from "piu/shape";
import {Outline} from "commodetto/outline";

import {
	REDBehavior,
	UNIT
}  from "./ui_templates";

class REDGaugeBehavior extends REDBehavior {
	onCreate(container, data) {
		super.onCreate(container, data);
		const shape = container.first;
		shape.skin = new Skin({fill:REDTheme.colors.gauge, stroke:data.colors});
	}
	onUpdate(container) {
		const data = this.data;
		const { min, max, value, seg1, seg2, title, format } = data;
		const fraction = (value - min) / (max - min);
		const { width, height } = container;
		const shape = container.first;
		const label = container.last.first;
		
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
		if (format)
			label.string = Mustache.render(format, { value });
	}
};
let REDGauge = Column.template($ => ({
	left:$.left, width:$.width, top:$.top, height:$.height, clip:true,
	contents: [
		$.title ? Label($, { left:0, right:0, height:UNIT, style:REDTheme.styles.textName, string:$.title }) : null,
		Container($, {
			left:0, right:0, top:0, bottom:0, Behavior:REDGaugeBehavior,
			contents: [
				Shape($, { left:0, right:0, top:0, bottom:0 } ),
				Column($, {
					left:0, right:0, bottom:0,
					contents: [
						Label($, { left:0, right:0, style:REDTheme.styles.textValue }),
						$.label ? Label($, { left:0, right:0, style:REDTheme.styles.textName, string:$.label }) : null,
					],
				}),
			],
		}),
	],
}));

class REDGaugeCompassBehavior extends REDBehavior {
	onUpdate(container) {
		const data = this.data;
		const { min, max, value, seg1, seg2, title, format } = data;
		const fraction = (value - min) / (max - min);
		const { width, height } = container;
		const shape = container.first;
		const label = container.last.first;
		
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
		if (format)
			label.string = Mustache.render(format, { value });
	}
};
let REDGaugeCompass = Column.template($ => ({
	left:$.left, width:$.width, top:$.top, height:$.height, clip:true,
	contents: [
		$.title ? Label($, { left:0, right:0, height:UNIT, style:REDTheme.styles.textName, string:$.title }) : null,
		Container($, {
			left:0, right:0, top:0, bottom:0, Behavior:REDGaugeCompassBehavior,
			contents: [
				Shape($, { left:0, right:0, top:0, bottom:0, skin:REDTheme.skins.compass }),
				Column($, {
					left:0, right:0,
					contents: [
						Label($, { left:0, right:0, style:REDTheme.styles.textValue }),
						$.label ? Label($, { left:0, right:0, style:REDTheme.styles.textName, string:$.label }) : null,
					],
				}),
			],
		}),
	],
}));

class REDGaugeDonutBehavior extends REDGaugeBehavior {
	onUpdate(container) {
		const data = this.data;
		const { min, max, value, seg1, seg2, title, format } = data;
		const fraction = (value - min) / (max - min);
		const { width, height } = container;
		const shape = container.first;
		const label = container.last.first;
		
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
		if (format)
			label.string = Mustache.render(format, { value });
	}
};
let REDGaugeDonut = Column.template($ => ({
	left:$.left, width:$.width, top:$.top, height:$.height, clip:true,
	contents: [
		$.title ? Label($, { left:0, right:0, height:UNIT, style:REDTheme.styles.textName, string:$.title }) : null,
		Container($, {
			left:0, right:0, top:0, bottom:0, Behavior:REDGaugeDonutBehavior,
			contents: [
				Shape($, { left:0, right:0, top:0, bottom:0 } ),
				Column($, {
					left:0, right:0,
					contents: [
						Label($, { left:0, right:0, style:REDTheme.styles.textValue }),
						$.label ? Label($, { left:0, right:0, style:REDTheme.styles.textName, string:$.label }) : null,
					],
				}),
			],
		}),
	],
}));
