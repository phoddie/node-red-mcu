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
		this.duration = Number(config.removeOlderUnit) * 1000;
		this.nodata = config.nodata;
		this.title = config.label;
		
		this.labels = null;
		this.series = null;
		this.ticks = null;
		
		this.xmin = undefined;
		this.xmax = undefined;
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
		case "bar": Template = REDChartVerticalBar; this.zero = true; break;
		case "horizontalBar": Template = REDChartHorizontalBar; this.zero = true; break;
		case "radar": Template = REDChartRadar; this.zero = true; break;
		default: Template = REDChartLine; break;
		}
		this.Template = this.lookupTemplate(config, Template);
	}
	measure(group) {
		if (this.width == 0)
			this.width = group.width;
		if (this.height == 0) {
			this.height = (group.width >> 1) + 1;
			if (this.title)
				this.height++;
		}
		let nticks = this.height;
		if (this.title)
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

const padding = 10;

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
		let left = 0;
		let right = 0;
		let top = 0;
		let bottom = 20;
		if (labels) {
			let style = REDTheme.styles.chartX;
			left = (style.measure(labels[0]).width >> 1) - 5;
			if (left < 10)
				left = 10;
			right = (style.measure(labels[labels.length - 1]).width >> 1) - 5;
			if (right < 10)
				right = 10;
		}
		if (ticks) {
			let style = REDTheme.styles.chartY;
			ticks.forEach(tick => {
				let width = style.measure(tick).width;
				if (left < width)
					left = width;
			});
			left += 10;
			if (shapes.x - container.x != left) {
				shapes.x = container.x + left + 10;
				shapes.width = container.width - left - right - 20;
			}
		}
		data.margins = { left, right, top, bottom };

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
		$.title ? Label($, { left:0, right:0, top:0, height:UNIT, style:REDTheme.styles.textName, string:$.title }) : null,
		Port($, {
			left:0, right:0, top:$.title ? UNIT : 0, bottom:0,
			Behavior: class extends Behavior {
				onCreate(port, data) {
					this.data = data;
				}
				onDraw(port) {
					let { series, labels, ticks, nodata, xmin, xmax, ymin, ymax, colors, margins } = this.data;
					let width = port.width;
					let height = port.height;
					if (!series) {
						port.drawStyle(nodata,  REDTheme.styles.textName, 0, 0, width, height);
						return;
					}
					let { left, right, top, bottom } = margins;
					
					let color = REDTheme.colors.halfGray;
					
					if (ticks) {
						let style = REDTheme.styles.chartY;
						let index = 0;
						let length = ticks.length;
						let y = height - 30;
						let tickWidth = port.width - left - right;
						let tickHeight = (height - 40) / (length - 1);
						while (index < length) {
							const iy = Math.round(y);
							port.fillColor(color, left, iy - 1, tickWidth, 1);
							port.drawStyle(ticks[index], style, 0, iy - 10, left - 5, 15);
							index++;
							y -= tickHeight;
						}
					}
					if (labels) {
						let style = REDTheme.styles.chartX;
						let index = 0;
						let length = labels.length;
						let x = left + 10;
						let h = height - 20;
						let delta = (width - right - left - 20) / (length - 1);
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
			left:0, width:0, top:$.title ? UNIT + 10 : 10, bottom:30,
			contents: [
			],
		}),
	],
}));


class REDChartVerticalBarBehavior extends REDBehavior {
	onCreate(container, data) {
		super.onCreate(container, data);
	}
	onUpdate(container) {
		const data = this.data;
		const ticks = data.ticks;
		let left = 0;
		let right = 0;
		let top = 0;
		let bottom = 20;
		if (ticks) {
			let style = REDTheme.styles.chartY;
			ticks.forEach(tick => {
				let width = style.measure(tick).width;
				if (left < width)
					left = width;
			});
		}
		left += 10;
		right += 10;
		data.margins = { left, right, top, bottom };

		const port = container.last;
		port.invalidate();
	}
};
let REDChartVerticalBar = Container.template($ => ({
	left:$.left, width:$.width, top:$.top, height:$.height, clip:true, Behavior:REDChartVerticalBarBehavior,
	contents: [
		$.title ? Label($, { left:0, right:0, top:0, height:UNIT, style:REDTheme.styles.textName, string:$.title }) : null,
		Port($, {
			left:0, right:0, top:$.title ? UNIT : 0, bottom:0,
			Behavior: class extends Behavior {
				onCreate(port, data) {
					this.data = data;
				}
				onDraw(port) {
					const { series, labels, ticks, nodata, xmin, xmax, ymin, ymax, colors, margins } = this.data;
					const width = port.width;
					const height = port.height;
					if (!series) {
						port.drawStyle(nodata,  REDTheme.styles.textName, 0, 0, width, height);
						return;
					}
					const { left, right, top, bottom } = margins;
					const gray = REDTheme.colors.halfGray;
					const styleX = REDTheme.styles.chartX;
					const styleY = REDTheme.styles.chartY;

					const seriesLength = series.length;
					const labelsLength = labels.length;
					const ticksLength = ticks.length;
					
					let graphWidth = width - left - padding - padding - right;
					let graphHeight = height - top - padding - padding - bottom;

					let labelWidth = Math.floor(graphWidth / labelsLength);
					const barWidth = Math.floor((labelWidth - 3) / seriesLength);
					labelWidth = (barWidth * seriesLength) + 3;
					graphWidth = labelWidth * labelsLength;
					const tickWidth = padding + graphWidth + padding;
					
					const tickHeight = Math.floor(graphHeight / (ticksLength - 1));
					graphHeight = tickHeight * (ticksLength - 1);
					const labelHeight = padding + graphHeight + padding;
					
					let tickIndex = 0;
					let tickY = top + padding + graphHeight;
					while (tickIndex < ticksLength) {
						port.fillColor(gray, left, tickY - 1, tickWidth, 1);
						port.drawStyle(ticks[tickIndex], styleY, 0, tickY - 10, left - 5, 15);
						tickIndex++;
						tickY -= tickHeight;
					}
					
					const barRatio = graphHeight / (ymax - ymin);
					const barY = top + padding + graphHeight;
					let labelX = left + padding;
					let labelIndex = 0;
					let offset = 0;
					port.fillColor(gray, labelX, top, 1, labelHeight);
					while (labelIndex < labelsLength) {
						const label = labels[labelIndex];
						const size = ((styleX.measure(label).width + 4) - labelWidth) >> 1;
						if (offset < labelX - size) {
							port.drawStyle(label, styleX, labelX, labelHeight, labelWidth, 15);
							offset = labelX + labelWidth + size;
						}
						let barX = labelX + 2;
						let serieIndex = 0;
						while (serieIndex < seriesLength) {
							const color = colors[serieIndex];
							const sample = series[serieIndex].samples[labelIndex];
							const barHeight = Math.round((sample.y - ymin) * barRatio);
							port.fillColor(color, barX, barY - barHeight, barWidth, barHeight);
							barX += barWidth;
							serieIndex++;
						}
						labelX += labelWidth;
						labelIndex++;
						port.fillColor(gray, labelX, top, 1, labelHeight);
					}
				}
			},
		}),
	],
}));


class REDChartHorizontalBarBehavior extends REDBehavior {
	onCreate(container, data) {
		super.onCreate(container, data);
	}
	onUpdate(container) {
		const data = this.data;
		const labels = data.labels;
		let left = 0;
		let right = 0;
		let top = 0;
		let bottom = 20;
		if (labels) {
			let style = REDTheme.styles.chartY;
			labels.forEach(label => {
				let width = style.measure(label).width;
				if (left < width)
					left = width;
			});
		}
		left += 10;
		right += 10;
		data.margins = { left, right, top, bottom };

		const port = container.last;
		port.invalidate();
	}
};
let REDChartHorizontalBar = Container.template($ => ({
	left:$.left, width:$.width, top:$.top, height:$.height, clip:true, Behavior:REDChartHorizontalBarBehavior,
	contents: [
		$.title ? Label($, { left:0, right:0, top:0, height:UNIT, style:REDTheme.styles.textName, string:$.title }) : null,
		Port($, {
			left:0, right:0, top:$.title ? UNIT : 0, bottom:0,
			Behavior: class extends Behavior {
				onCreate(port, data) {
					this.data = data;
				}
				onDraw(port) {
					const { series, labels, ticks, nodata, xmin, xmax, ymin, ymax, colors, margins } = this.data;
					const width = port.width;
					const height = port.height;
					if (!series) {
						port.drawStyle(nodata,  REDTheme.styles.textName, 0, 0, width, height);
						return;
					}
					const { left, right, top, bottom } = margins;
					const gray = REDTheme.colors.halfGray;
					const styleX = REDTheme.styles.chartX;
					const styleY = REDTheme.styles.chartY;

					const seriesLength = series.length;
					const labelsLength = labels.length;
					const ticksLength = ticks.length;
					
					let graphWidth = width - left - padding - padding - right;
					let graphHeight = height - top - padding - padding - bottom;
					
					let labelHeight = Math.floor(graphHeight / labelsLength);
					const barHeight = Math.floor((labelHeight - 3) / seriesLength);
					labelHeight = (barHeight * seriesLength) + 3;
					graphHeight = labelHeight * labelsLength;
					const tickHeight = padding + graphHeight + padding;
					
					const tickWidth = Math.floor(graphWidth / (ticksLength - 1));
					graphWidth = tickWidth * (ticksLength - 1);
					const labelWidth = padding + graphWidth + padding;
					
					const tickY = top + padding + graphHeight + padding;
					let tickIndex = 0;
					let tickX = left + padding;
					while (tickIndex < ticksLength) {
						port.fillColor(gray, tickX - 1, top, 1, tickHeight);
						port.drawStyle(ticks[tickIndex], styleX, tickX - 30, tickY, 60, 15);
						tickIndex++;
						tickX += tickWidth;
					}
					
					const barRatio = graphWidth / (ymax - ymin);
					const barX = left + padding;
					let labelY = top + padding;
					let labelIndex = 0;
					let offset = 0;
					port.fillColor(gray, left, labelY, labelWidth, 1);
					while (labelIndex < labelsLength) {
						const label = labels[labelIndex];
						port.drawStyle(label, styleY, 0, labelY, left - 5, labelHeight);
						let barY = labelY + 2;
						let serieIndex = 0;
						while (serieIndex < seriesLength) {
							const color = colors[serieIndex];
							const sample = series[serieIndex].samples[labelIndex];
							const barWidth = Math.round((sample.y - ymin) * barRatio);
							port.fillColor(color, barX, barY, barWidth, barHeight);
							barY += barHeight;
							serieIndex++;
						}
						labelY += labelHeight;
						labelIndex++;
						port.fillColor(gray, left, labelY, labelWidth, 1);
					}
				}
			},
		}),
	],
}));

class REDChartRadarBehavior extends REDBehavior {
	onCreate(container, data) {
		super.onCreate(container, data);
	}
	onUpdate(container) {
		const data = this.data;
		let { series, labels, ticks, ymin, ymax, colors } = data;
		const port = container.last;
		const shapes = port.previous;
		let shape = shapes.previous;
		if (!series || !labels || !ticks) {
			shapes.empty(0);
			shape.strokeOutline = null;
			return;
		}
		let style = REDTheme.styles.chartX;
		let left = 0;
		const labelsLength = labels.length;
		const ticksLength = ticks.length;
		let labelIndex, tickIndex;
		
		const labelXs = new Array(labelsLength).fill(0);
		const labelYs = new Array(labelsLength).fill(0);
		labelIndex = 0;
		while (labelIndex < labelsLength) {
			let width = style.measure(labels[labelIndex]).width;
			if (left < width)
				left = width;
			labelXs[labelIndex] = width + 10;
			labelYs[labelIndex] = 16;
			labelIndex++;
		};
		left += 10;
		let right = left;
		let top = 20;
		let bottom = 20;
		data.margins = { left, right, top, bottom };

		const width = container.width;
		let height = container.height;
		if (data.title)
			height -= UNIT;
			
		const delta = (2 * Math.PI) / labels.length;
		const r = Math.min(width - left - right, height - top - bottom) / 2;
		const cx = width >> 1;
		const cy = height >> 1;
		
		const xs = new Array(labelsLength).fill(0);
		const ys = new Array(labelsLength).fill(0);
		let angle = (3 * Math.PI) / 2;
		labelIndex = 0;
		while (labelIndex < labelsLength) {
			const cos = Math.cos(angle);
			const sin = Math.sin(angle);
			xs[labelIndex] = r * cos;
			ys[labelIndex] = r * sin
			labelXs[labelIndex] = cx + ((r + (labelXs[labelIndex] >> 1)) * cos);
			labelYs[labelIndex] = cy + ((r + (labelYs[labelIndex] >> 1)) * sin);
			labelIndex++;
			angle += delta;
		}
		data.labelXs = labelXs;
		data.labelYs = labelYs;
		
		const path = new Outline.FreeTypePath;
		labelIndex = 0;
		while (labelIndex < labelsLength) {
			path.beginSubpath(cx, cy, true);
			path.lineTo(cx + xs[labelIndex], cy + ys[labelIndex]);
			path.endSubpath();
			labelIndex++;
		}
		let fraction = 1 / (ticksLength - 1);
		let ratio = fraction;
		tickIndex = 1;
		while (tickIndex < ticksLength) {
			labelIndex = 0;
			path.beginSubpath(cx + (ratio * xs[labelIndex]), cy + (ratio * ys[labelIndex]));
			labelIndex++;
			while (labelIndex < labelsLength) {
				path.lineTo(cx + (ratio * xs[labelIndex]), cy + (ratio * ys[labelIndex]));
				labelIndex++;
			}
			path.endSubpath();
			ratio += fraction;
			tickIndex++;
		}
		shape.strokeOutline = Outline.stroke(path, 1, Outline.LINECAP_BUTT, Outline.LINEJOIN_MITER);
		
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
		let serieIndex = 0;
		shape = shapes.first;
		while (shape) {
			const path = new Outline.FreeTypePath;
			const samples = series[serieIndex].samples;
			labelIndex = 0;
			let ratio = (samples[labelIndex].y - ymin) / (ymax - ymin);
			path.beginSubpath(cx + (ratio * xs[labelIndex]), cy + (ratio * ys[labelIndex]));
			labelIndex++;
			while (labelIndex < labelsLength) {
				ratio = (samples[labelIndex].y - ymin) / (ymax - ymin);
				path.lineTo(cx + (ratio * xs[labelIndex]), cy + (ratio * ys[labelIndex]));
				labelIndex++;
			}
			path.endSubpath();
			shape.strokeOutline = Outline.stroke(path, 2, Outline.LINECAP_BUTT, Outline.LINEJOIN_MITER);
			serieIndex++;
			shape = shape.next;
		}

		port.invalidate();
	}
};
let REDChartRadar = Container.template($ => ({
	left:$.left, width:$.width, top:$.top, height:$.height, clip:true, Behavior:REDChartRadarBehavior,
	contents: [
		$.title ? Label($, { left:0, right:0, top:0, height:UNIT, style:REDTheme.styles.textName, string:$.title }) : null,
		Shape($, { left:0, right:0, top:$.title ? UNIT : 0, bottom:0, skin:new Skin({ stroke:REDTheme.colors.halfGray }) }),
		Container($, {
			left:0, right:0, top:$.title ? UNIT : 0, bottom:0,
			contents: [
			],
		}),
		Port($, {
			left:0, right:0, top:$.title ? UNIT : 0, bottom:0,
			Behavior: class extends Behavior {
				onCreate(port, data) {
					this.data = data;
				}
				onDraw(port) {
					const { series, labels, ticks, nodata, labelXs, labelYs } = this.data;
					const styleX = REDTheme.styles.chartX;
					if (!series || !labels || !ticks) {
						port.drawStyle(nodata,  styleX, 0, 0, port.width, port.height);
						return;
					}
					const labelsLength = labels.length;
					let labelIndex = 0;
					while (labelIndex < labelsLength) {
						let label = labels[labelIndex];
						let x = labelXs[labelIndex];
						let y = labelYs[labelIndex];
						port.drawStyle(label, styleX, x - 30, y - 10, 60, 16);
						labelIndex++;
					}
				}
			},
		}),
	],
}));
