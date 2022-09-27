
import "nodered";
import builder from "flows";
import buildModel from "./ui_nodes";
import { REDApplication }  from "./ui_templates";

RED.build(builder);
const model = buildModel();

export default new REDApplication(model, { commandListLength:4096, displayListLength:8192, touchCount:1, pixels: 240 * 64 });

globalThis.parseWeather = function(msg) {
var windDirection = {};
var windDirectionIcon = {};
var windSpeed = {};
var windSpeedIcon = {};
var sunRise = {};
var sunSet = {};
var conditionIcon = {};
var date = new Date ();

/* function for converting meteorogical degree to text */

var degToCard = function(deg){
if (deg>11.25 && deg<=33.75){
return "NNE";
  }else if (deg>33.75 && deg<56.25){
return "NE";
  }else if (deg>56.25 && deg<78.75){
return "ENE";
  }else if (deg>78.75 && deg<101.25){
return "E";
  }else if (deg>101.25 && deg<123.75){
return "ESE";
  }else if (deg>123.75 && deg<146.25){
return "SE";
  }else if (deg>146.25 && deg<168.75){
return "SSE";
  }else if (deg>168.75 && deg<191.25){
return "S";
  }else if (deg>191.25 && deg<213.75){
return "SSW";
  }else if (deg>213.75 && deg<236.25){
return "SW";
  }else if (deg>236.25 && deg<258.75){
return "WSW";
  }else if (deg>258.75 && deg<281.25){
return "W";
  }else if (deg>281.25 && deg<303.75){
return "WNW";
  }else if (deg>303.75 && deg<326.25){
return "NW";
  }else if (deg>326.25 && deg<348.75){
return "NNW";
  }else{
return "N"; 
  }
}

/* function for converting meteorogical degree to weather icons */

var degToCardIcon = function(deg){
if (deg>11.25 && deg<=33.75){
return "wi-from-nne";
  }else if (deg>33.75 && deg<56.25){
return "wi-from-ne";
  }else if (deg>56.25 && deg<78.75){
return "wi-from-ene";
  }else if (deg>78.75 && deg<101.25){
return "wi-from-e";
  }else if (deg>101.25 && deg<123.75){
return "wi-from-ese";
  }else if (deg>123.75 && deg<146.25){
return "wi-from-se";
  }else if (deg>146.25 && deg<168.75){
return "wi-from-sse";
  }else if (deg>168.75 && deg<191.25){
return "wi-from-s";
  }else if (deg>191.25 && deg<213.75){
return "wi-from-ssw";
  }else if (deg>213.75 && deg<236.25){
return "wi-from-sw";
  }else if (deg>236.25 && deg<258.75){
return "wi-from-wsw";
  }else if (deg>258.75 && deg<281.25){
return "wi-from-w";
  }else if (deg>281.25 && deg<303.75){
return "wi-from-wnw";
  }else if (deg>303.75 && deg<326.25){
return "wi-from-nw";
  }else if (deg>326.25 && deg<348.75){
return "wi-from-nnw";
  }else{
return "wi-from-n"; 
  }
}

/* Function for converting wind speed into Beaufort scale icon */

var speedToCardIcon = function(speed){
if (speed>0.5 && speed<=1.5){
return "wi-wind-beaufort-1";
  }else if (speed>1.5 && speed<=3.3){
return "wi-wind-beaufort-2";
  }else if (speed>3.3 && speed<=5.5){
return "wi-wind-beaufort-3";
  }else if (speed>5.5 && speed<=7.9){
return "wi-wind-beaufort-4";
  }else if (speed>7.9 && speed<=10.7){
return "wi-wind-beaufort-5";
  }else if (speed>10.7 && speed<=13.8){
return "wi-wind-beaufort-6";
  }else if (speed>13.8 && speed<=17.1){
return "wi-wind-beaufort-7";
  }else if (speed>17.1 && speed<=20.7){
return "wi-wind-beaufort-8";
  }else if (speed>20.7 && speed<=24.4){
return "wi-wind-beaufort-9";
  }else if (speed>24.4 && speed<=28.4){
return "wi-wind-beaufort-10";
  }else if (speed>28.4 && speed<=32.6){
return "wi-wind-beaufort-11";
  }else if (speed>32.6){
return "wi-wind-beaufort-12";
  }else{
return "wi-wind-beaufort-0"; 
  }
}

/* Function for Time Conversions */

function timeConverter(UNIX_timestamp){
  var a = new Date(UNIX_timestamp * 1000);
  var hour = a.getHours();
  var min = a.getMinutes();
  if (min < 10) {min = "0" + min;}
    else {min = min;}
  var sec = a.getSeconds();
  if (sec < 10) {sec = "0" + sec;}
    else {sec = sec;}
    
  var time = hour + ':' + min + ':' + sec ;
  return time;
}

/* Convert OpenWeeather Map Icon to https://erikflowers.github.io/weather-icons/ */

const owIconMap = new Map();

owIconMap.set('01d', 'wi-day-sunny'); // clear sky
owIconMap.set('02d', 'wi-day-cloudy'); // few clouds
owIconMap.set('03d', 'wi-cloud'); // scattered clouds
owIconMap.set('04d', 'wi-cloudy'); // broken clouds
owIconMap.set('09d', 'wi-day-showers'); // shower rain
owIconMap.set('10d', 'wi-day-rain'); // rain
owIconMap.set('11d', 'wi-thunderstorm'); // thunderstorm
owIconMap.set('13d', 'wi-snow'); // snow
owIconMap.set('50d', 'wi-fog'); // mist
owIconMap.set('01n', 'wi-night-clear'); // clear sky
owIconMap.set('02n', 'wi-night-alt-cloudy'); // few clouds
owIconMap.set('03n', 'wi-cloud'); // scattered clouds
owIconMap.set('04n', 'wi-cloudy'); // broken clouds
owIconMap.set('09n', 'wi-night-alt-showers'); // shower rain
owIconMap.set('10n', 'wi-night-alt-rain'); // rain
owIconMap.set('11n', 'wi-thunderstorm'); // thunderstorm
owIconMap.set('13n', 'wi-snow'); // snow
owIconMap.set('50n', 'wi-fog'); // mist

conditionIcon.topic = "ConditionIcon";
conditionIcon.payload = owIconMap.get(msg.payload.icon);

windDirection.topic = "WindDirection";
windDirection.payload = degToCard(msg.payload.winddirection);

windDirectionIcon.topic = "WindDirectionIcon";
windDirectionIcon.payload = degToCardIcon(msg.payload.winddirection);

windSpeed.topic = "WindSpeed";
windSpeed.payload = msg.payload.windspeed +  " m/s"; /* " + windDirection.payload; */

windSpeedIcon.topic = "WindSpeedIcon";
windSpeedIcon.payload = speedToCardIcon(msg.payload.windspeed);

sunRise.topic = "SunRise";
sunRise.payload = timeConverter(msg.payload.sunrise);

sunSet.topic = "SunRet";
sunSet.payload = timeConverter(msg.payload.sunset);

owIconMap.clear(); //freeing resource

return [conditionIcon, windSpeedIcon, windSpeed, windDirection, windDirectionIcon, sunRise, sunSet];}