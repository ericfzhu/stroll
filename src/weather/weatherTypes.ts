export interface HourlyForecast {
	time: number;
	temperature: number;
	conditionCode: number;
	precipitationChance: number;
}

export interface WeatherData {
	temperature: number;
	feelsLike: number;
	humidity: number;
	pressure: number;
	visibility: number;
	windSpeed: number;
	windDirection: number;
	windGust: number | null;
	cloudCover: number;
	condition: string;
	conditionCode: number;
	description: string;
	city: string;
	timezone: number;
	sunrise: number;
	sunset: number;
	tempHigh: number;
	tempLow: number;
	hourly: HourlyForecast[];
}
