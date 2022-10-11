import { UIControlNode, registerConstructor } from "ui_nodes";

class UIChartNode extends UIControlNode {
	constructor(id, flow, name) {
		super(id, flow, name);
	}
	computeTicks() {
		// adapted from Nice Number For Graphs Labels, Paul S. Heckbert, Graphics Gems, page 61
		function nicenum(x, round) {
			const exp = Math.floor(Math.log10(x));
			const f = x / Math.pow(10, exp);
			let nf;
			if (round) {
				if (f < 1.5)
					nf = 1;
				else if (f < 3)
					nf = 2;
				else if (f < 7)
					nf = 5;
				else
					nf = 10;
			}
			else {
				if (f <= 1)
					nf = 1;
				else if (f <= 2)
					nf = 2;
				else if (f <= 5)
					nf = 5;
				else
					nf = 10;
			}
			return nf * Math.pow(10, exp);
		}
		let { ymin, ymax, nticks } = this;
		const range = nicenum(ymax - ymin, false);
		const d = nicenum(range / (nticks - 1), true);
		this.ymin = ymin = Math.floor(ymin / d) * d;
		this.ymax = ymax = Math.ceil(ymax / d) * d;
		const nfrac = Math.max(-Math.floor(Math.log10(d)), 0);
		const limit = ymax + (0.5 * d);
		const result = [];
		while (ymin < limit) {
			result.push(ymin.toFixed(nfrac));
			ymin += d;
		}
		this.ticks = result;
	}
	formatTime(time) {
		const date = new Date(time);
		const hours = date.getHours();
		const minutes = date.getMinutes();
		const seconds = date.getSeconds();
		let result = "";
		if (hours < 10) result += "0";
		result += hours + ":";
		if (minutes < 10) result += "0";
		result += minutes + ":";
		if (seconds < 10) result += "0";
		result += seconds;
		return result;
	}
	parsePayload(payload) {
		if ((typeof(payload) == "object") && Array.isArray(payload)) {
			this.labels = null;
			this.series = null;
			if (payload.length == 0)
				return;
			payload = payload[0];
			if (typeof(payload) != "object")
				return;
			let data = payload.data;
			if ((typeof(data) != "object") || !Array.isArray(data))
				return;
			let labels = payload.labels;
			if ((typeof(labels) != "object") || !Array.isArray(labels))
				return;
			let series = payload.series;
			if ((typeof(series) != "object") || !Array.isArray(series))
				return;
			let dataLength = data.length;
			let labelsLength = labels.length;
			let seriesLength = series.length;
			if (dataLength != seriesLength)
				return;
			let bad = false;
			let samplesLength, time, xmin, xmax, ymin, ymax;
			let result = data.map((samples, index) => {
				if ((typeof(samples) != "object") || !Array.isArray(samples))
					bad = true;
				else {
					samples = samples.map((sample, x) => {
						let y;
						if ((typeof(sample) == "object") && sample.hasOwnProperty("x") && sample.hasOwnProperty("y")) {
							if (time == undefined)
								time = true;
							else if (!time)
								bad = true;
							x = Number(sample.x);
							y = Number(sample.y);
						}
						else {
							if (time == undefined)
								time = false;
							else if (time)
								bad = true; 
							y = Number(sample);
						}
						if ((xmin == undefined) || (xmin > x))
							xmin = x;
						if ((xmax == undefined) || (xmax < x))
							xmax = x;
						if ((ymin == undefined) || (ymin > y))
							ymin = y;
						if ((ymax == undefined) || (ymax < y))
							ymax = y;
						return { x, y };
					});
					if (!time) {
						if (samplesLength == undefined)
							samplesLength = samples.length;
						else if (samplesLength != samples.length)
							bad = true;
					}
				}
				return {
					name: series[index],
					samples
				}
			});
			if (bad)
				return;
			if (time) {
				this.labels = [ this.formatTime(xmin), this.formatTime(xmax) ];
			}
			else {
				if (labelsLength != samplesLength)
					return;
				this.labels = labels;
			}	
			this.series = result;
			this.xmin = xmin;
			this.xmax = xmax;
			if (this.adjustMin) {
				if (this.zero) {
					if (ymin > 0)
						ymin = 0;
				}
				this.ymin = ymin;
			}
			if (this.adjustMax) {
				if (this.zero) {
					if (ymax < 0)
						ymax = 0;
				}
				this.ymax = ymax;
			}
			if (this.adjustMin || this.adjustMax) {
				if (this.ymin < this.ymax)
					this.computeTicks();
			}
		}
	}
	onMessage(msg) {
		let payload = msg.payload;
		if ((typeof(payload) == "object") && Array.isArray(payload))
			this.parsePayload(msg.payload);
		else {
			payload = Number(msg.payload);
			if (isNaN(payload)) {
				this.labels = null;
				this.ticks = null;
				this.series = null;
			}
			else {
				const { ymin, ymax, series } = this;
				let name = msg.topic;
				let serie = series.find(serie => serie.name == name);
				if (!serie) {
					serie = { name, samples:[] };
					series.push(serie);
				}
				let payload = Number(msg.payload);
				let when = Date.now();
				serie.samples.push({ x:when, y:payload });
				if (this.xmin == undefined)
					this.xmin = when;
				this.xmax = when;
				const xmin = this.xmax - this.duration;
				if (this.xmin < xmin) {
					this.xmin = xmin;
					series.forEach(serie => {
						const index = serie.samples.findIndex(sample => sample.x >= xmin);
						if (index > 0)
							serie.samples.splice(0, index);
					});
				}
				this.labels = [ this.formatTime(xmin), this,formatTime(xmax) ];
				if (this.adjustMin) {
					if ((ymin == undefined) || (ymin > payload))
						this.ymin = payload;
				}
				if (this.adjustMax) {
					if ((ymax == undefined) || (ymax < payload))
						this.ymax = payload;
				}
				if (this.adjustMin || this.adjustMax) {
					if (this.ymin < this.ymax)
						this.computeTicks();
				}
			}
		}	
		this.container?.delegate("onUpdate");
		this.send(msg);
	}
	onStart(config) {
		super.onStart(config);
		this.colors = config.colors;
		this.label = config.label;
		this.nodata = config.nodata;
		this.series = [];
		this.ticks = undefined;
		
		this.xmin = undefined;
		this.xmax = undefined;
		this.duration = Number(config.removeOlderUnit) * 1000;
		
		if (config.ymin == "") {
			this.adjustMin = true;
			this.ymin = undefined;
		}
		else {
			this.adjustMin = false;
			this.ymin = Number(config.ymin);
		}
		if (config.ymax == "") {
			this.adjustMax = true;
			this.ymax = undefined;
		}
		else {
			this.adjustMax = false;
			this.ymax = Number(config.ymax);
		}
		this.zero = false;
		switch (config.chartType) {
		case "bar": Template = REDChartBar; this.zero = true; break;
		default: Template = REDChartLine; break;
		}
		this.Template = this.lookupTemplate(config, Template);
	}
	measure(group) {
		if (this.width == 0)
			this.width = group.width;
		if (this.height == 0) {
			this.height = (group.width >> 1) + 1;
			if (this.label)
				this.height++;
		}
		let nticks = this.height;
		if (this.label)
			nticks--;
		this.nticks = (2 * nticks) - 1;
		if (this.adjustMin || this.adjustMax)
			return;
		this.computeTicks();
	}
}
registerConstructor("ui_chart", UIChartNode);

import {} from "piu/MC";
import {} from "piu/shape";
import {Outline} from "commodetto/outline";

import {
	REDBehavior,
	UNIT
}  from "./ui_templates";

class REDChartGridBehavior extends REDBehavior {
	onCreate(container) {
	
		
	}
}

class REDChartLineBehavior extends REDBehavior {
	onCreate(container, data) {
		super.onCreate(container, data);
	}
	onUpdate(container) {
		const shapes = container.last;
		const port = shapes.previous;
		port.invalidate();

		const data = this.data;
		const { series, labels, ticks, xmin, xmax, ymin, ymax, colors  } = data;
		if (!series || !labels || !ticks) {
			shapes.empty(0);
			return;
		}
		let leftMargin = 0;
		let rightMargin = 0;
		if (labels) {
			let style = REDTheme.styles.chartX;
			leftMargin = (style.measure(labels[0]).width >> 1) - 5;
			if (leftMargin < 10)
				leftMargin = 10;
			rightMargin = (style.measure(labels[labels.length - 1]).width >> 1) - 5;
			if (rightMargin < 10)
				rightMargin = 10;
		}
		if (ticks) {
			let style = REDTheme.styles.chartY;
			ticks.forEach(tick => {
				let width = style.measure(tick).width;
				if (leftMargin < width)
					leftMargin = width;
			});
			leftMargin += 10;
			if (shapes.x - container.x != leftMargin) {
				shapes.x = container.x + leftMargin + 10;
				shapes.width = container.width - leftMargin - rightMargin - 20;
			}
		}
		data.leftMargin = leftMargin;
		data.rightMargin = rightMargin;

		const seriesLength = series.length;
		let shapesLength = shapes.length;
		if (shapesLength > seriesLength)
			shapes.empty(seriesLength);
		else {
			while (shapesLength < seriesLength) {
				const stroke = colors[shapesLength];
				shapes.add(new Shape(undefined, { left:0, right:0, top:0, bottom:0, skin:new Skin({ stroke }) }));
				shapesLength++;
			}
		}
		let shape = shapes.first;
		let serieIndex = 0;
		if (xmin < xmax) {
			const dx = shapes.width / (xmax - xmin);
			const dy = shapes.height / (ymax - ymin);
			while (shape) {
				const path = new Outline.CanvasPath;
				const samples = series[serieIndex].samples;
				const samplesLength = samples.length;
				let sampleIndex = 0;
				let sample = samples[sampleIndex];
				path.moveTo((sample.x - xmin) * dx, (ymax - sample.y) * dy);
				sampleIndex++;
				while (sampleIndex < samplesLength) {
					sample = samples[sampleIndex];
					path.lineTo((sample.x - xmin) * dx, (ymax - sample.y) * dy);
					sampleIndex++;
				}
				shape.strokeOutline = Outline.stroke(path, 2, Outline.LINECAP_BUTT, Outline.LINEJOIN_MITER);
				shape = shape.next;
				serieIndex++;
			}
		}
		else {
			const dy = shapes.height / (ymax - ymin);
			while (shape) {
				const path = new Outline.CanvasPath;
				const samples = series[serieIndex].samples;
				let sample = samples[0];
				path.moveTo(0, (ymax - sample.y) * dy);
				path.lineTo(1, (ymax - sample.y) * dy);
				shape.strokeOutline = Outline.stroke(path, 2, Outline.LINECAP_BUTT, Outline.LINEJOIN_MITER);
				shape = shape.next;
				serieIndex++;
			}
		}
	}
};

let REDChartLine = Container.template($ => ({
	left:$.left, width:$.width, top:$.top, height:$.height, clip:true, Behavior:REDChartLineBehavior,
	contents: [
		$.label ? Label($, { left:0, right:0, top:0, height:UNIT, style:REDTheme.styles.textName, string:$.label }) : null,
		Port($, {
			left:0, right:0, top:$.label ? UNIT : 0, bottom:0,
			Behavior: class extends Behavior {
				onCreate(port, data) {
					this.data = data;
				}
				onDraw(port) {
					let { series, labels, ticks, leftMargin, rightMargin, nodata } = this.data;
					let width = port.width;
					let height = port.height;
					if (!series) {
						port.drawStyle(nodata,  REDTheme.styles.textName, 0, 0, width, height);
						return;
					}
					
					let color = REDTheme.colors.halfGray;
					
					if (ticks) {
						let style = REDTheme.styles.chartY;
						let index = 0;
						let length = ticks.length;
						let y = height - 30;
						let w = port.width - leftMargin - rightMargin;
						let delta = (height - 40) / (length - 1);
						while (index < length) {
							const iy = Math.round(y);
							port.fillColor(color, leftMargin, iy - 1, w, 1);
							port.drawStyle(ticks[index], style, 0, iy - 10, leftMargin - 5, 15);
							index++;
							y -= delta;
						}
					}
					if (labels) {
						let style = REDTheme.styles.chartX;
						let index = 0;
						let length = labels.length;
						let x = leftMargin + 10;
						let h = height - 20;
						let delta = (width - rightMargin - leftMargin - 20) / (length - 1);
						let offset = 0;
						while (index < length) {
							const ix = Math.round(x);
							port.fillColor(color, ix - 1,  0, 1, h);
							
							const label = labels[index];
							const size = (style.measure(label).width + 10) >> 1;
							if (offset < ix - size) {
								port.drawStyle(label, style, ix - 30, h, 60, 15);
								offset = ix + size;
							}
							index++;
							x += delta;
						}
					}
				}
			},
		}),
		Container($, {
			left:0, width:0, top:$.label ? UNIT + 10 : 10, bottom:30,
			contents: [
			],
		}),
	],
}));

class REDChartBarBehavior extends REDBehavior {
	onCreate(container, data) {
		super.onCreate(container, data);
	}
	onUpdate(container) {
		const port = container.last;
		port.invalidate();

		const data = this.data;
		const { series, labels, ticks, xmin, xmax, ymin, ymax, colors  } = data;
		if (!series || !labels || !ticks)
			return;
		let leftMargin = 0;
		let rightMargin = 0;
		if (labels) {
			let style = REDTheme.styles.chartX;
			leftMargin = (style.measure(labels[0]).width >> 1) - 5;
			if (leftMargin < 10)
				leftMargin = 10;
			rightMargin = (style.measure(labels[labels.length - 1]).width >> 1) - 5;
			if (rightMargin < 10)
				rightMargin = 10;
		}
		if (ticks) {
			let style = REDTheme.styles.chartY;
			ticks.forEach(tick => {
				let width = style.measure(tick).width;
				if (leftMargin < width)
					leftMargin = width;
			});
			leftMargin += 10;
		}
		data.leftMargin = leftMargin;
		data.rightMargin = rightMargin;
	}
};

let REDChartBar = Container.template($ => ({
	left:$.left, width:$.width, top:$.top, height:$.height, clip:true, Behavior:REDChartBarBehavior,
	contents: [
		$.label ? Label($, { left:0, right:0, top:0, height:UNIT, style:REDTheme.styles.textName, string:$.label }) : null,
		Port($, {
			left:0, right:0, top:$.label ? UNIT : 0, bottom:0,
			Behavior: class extends Behavior {
				onCreate(port, data) {
					this.data = data;
				}
				onDraw(port) {
					let { series, labels, ticks, leftMargin, rightMargin, nodata, xmin, xmax, ymin, ymax, colors } = this.data;
					let width = port.width;
					let height = port.height;
					if (!series) {
						port.drawStyle(nodata,  REDTheme.styles.textName, 0, 0, width, height);
						return;
					}
					let gray = REDTheme.colors.halfGray;
					const seriesLength = series.length;
					const labelsLength = labels.length;
					const ticksLength = ticks.length;
					
					let graphWidth = width - rightMargin - leftMargin - 20;
					let labelWidth = Math.floor(graphWidth / labelsLength);
					const barWidth = Math.floor((labelWidth - 3) / seriesLength);
					labelWidth = (barWidth * seriesLength) + 3;
					graphWidth = labelWidth * labelsLength;
				
					let style = REDTheme.styles.chartY;
					let w = 10 + graphWidth + 10;
					let delta = (height - 40) / (ticksLength - 1);
					let tickIndex = 0;
					let y = height - 30;
					while (tickIndex < ticksLength) {
						const iy = Math.round(y);
						port.fillColor(gray, leftMargin, iy - 1, w, 1);
						port.drawStyle(ticks[tickIndex], style, 0, iy - 10, leftMargin - 5, 15);
						tickIndex++;
						y -= delta;
					}
					style = REDTheme.styles.chartX;
					
					const dy = (height - 40) / (ymax - ymin);
					const barHeight = height - 30;
					let labelX = leftMargin + 10;
					let labelIndex = 0;
					let offset = 0;
					port.fillColor(gray, labelX, 0, 1, height - 20);
					while (labelIndex < labelsLength) {
						const label = labels[labelIndex];
						const size = ((style.measure(label).width + 4) - labelWidth) >> 1;
						if (offset < labelX - size) {
							port.drawStyle(label, style, labelX, height - 20, labelWidth, 15);
							offset = labelX + labelWidth + size;
						}

						let barX = labelX + 2;
						let serieIndex = 0;
						while (serieIndex < seriesLength) {
							const color = colors[serieIndex];
							const sample = series[serieIndex].samples[labelIndex];
							let y = 10 + Math.round(((ymax - sample.y) * dy));
							port.fillColor(color, barX, y, barWidth, barHeight - y);
							barX += barWidth;
							serieIndex++;
						}
						
						
						labelX += labelWidth;
						labelIndex++;
						port.fillColor(gray, labelX, 0, 1, height - 20);
					}
				}
			},
		}),
	],
}));

