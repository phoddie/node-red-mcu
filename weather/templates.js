import {} from "piu/MC";
import {
	registerTemplate
} from "ui_nodes";
import {
	REDBehavior,
	REDTextBehavior,
} from "ui_templates";



const BLACK = "black";
const LIGHT_GRAY = "#a9a9a9";
const WHITE = "white";
const GREEN = "#57ad62"
const TRANSPARENT = "transparent";

const theme = Object.freeze({
	styles: {
		text: { font:"24px Roboto", color:WHITE },
		temperature: { font:"bold 48px Temperature", color:WHITE },
		weather: { font:"120px Weather", color:WHITE },
	},
	weatherCharacters: {
		"wi-owm-01d": "\uf00d",
		"wi-owm-02d": "\uf00c",
		"wi-owm-03d": "\uf002",
		"wi-owm-04d": "\uf013",
		"wi-owm-09d": "\uf017",
		"wi-owm-10d": "\uf019",
		"wi-owm-11d": "\uf01e",
		"wi-owm-13d": "\uf01b",
		"wi-owm-50d": "\uf014",
		"wi-owm-01n": "\uf02e",
		"wi-owm-02n": "\uf081",
		"wi-owm-03n": "\uf07e",
		"wi-owm-04n": "\uf086",
		"wi-owm-09n": "\uf026",
		"wi-owm-10n": "\uf028",
		"wi-owm-11n": "\uf02c",
		"wi-owm-13n": "\uf02a",
		"wi-owm-50n": "\uf04a",
	}
}, true);

let CityText = Label.template($ => ({
	anchor:"VALUE", left:$.left, width:$.width, top:$.top, height:$.height, style:theme.styles.text,
	Behavior: REDTextBehavior,
}));
registerTemplate("piu-text-city", CityText);

let TemperatureText = Label.template($ => ({
	anchor:"VALUE", left:$.left, width:$.width, top:$.top, height:$.height, style:theme.styles.temperature,
	Behavior: REDTextBehavior,
}));
registerTemplate("piu-text-temperature", TemperatureText);

let WeatherTemplate = Label.template($ => ({
	left:$.left, width:$.width, top:$.top, height:$.height, style:theme.styles.weather,
	Behavior: class extends REDBehavior {
		onUpdate(label) {
			const string = theme.weatherCharacters[this.data.payload];
			if (string)
				label.string = string;
		}
	}
}));
registerTemplate("piu-template-weather", WeatherTemplate);

let WeatherText = Label.template($ => ({
	anchor:"VALUE", left:$.left, width:$.width, top:$.top, height:$.height, style:theme.styles.text,
	Behavior: REDTextBehavior,
}));
registerTemplate("piu-text-weather", WeatherText);
