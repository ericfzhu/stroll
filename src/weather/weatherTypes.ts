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
}
