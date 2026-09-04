import type { Env } from '../types';

interface OpenWeatherResponse {
	main: {
		temp: number;
		feels_like: number;
		humidity: number;
		pressure: number;
		temp_min: number;
		temp_max: number;
	};
	visibility: number;
	wind: {
		speed: number;
		deg: number;
		gust?: number;
	};
	clouds: { all: number };
	weather: Array<{
		id: number;
		main: string;
		description: string;
	}>;
	sys: {
		sunrise: number;
		sunset: number;
	};
	name: string;
	timezone: number;
}

interface ForecastItem {
	dt: number;
	pop?: number;
	main: {
		temp: number;
		temp_min: number;
		temp_max: number;
	};
	weather: Array<{
		id: number;
		main: string;
	}>;
}

interface OpenWeatherForecastResponse {
	list: ForecastItem[];
}

interface HourlyForecast {
	time: number;
	temperature: number;
	conditionCode: number;
	precipitationChance: number;
}

interface WeatherResponse {
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

export const onRequestGet: PagesFunction<Env> = async (context) => {
	try {
		// Sydney coordinates
		const latitude = '-33.8688';
		const longitude = '151.2093';

		const apiKey = context.env.OPENWEATHERMAP_API_KEY;
		const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&units=metric&appid=${apiKey}`;
		const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${latitude}&lon=${longitude}&units=metric&cnt=8&appid=${apiKey}`;

		// Fetch both current weather and forecast in parallel
		const [weatherResponse, forecastResponse] = await Promise.all([
			fetch(weatherUrl),
			fetch(forecastUrl),
		]);

		if (!weatherResponse.ok) {
			throw new Error(`OpenWeatherMap API error: ${weatherResponse.status}`);
		}

		const weatherData: OpenWeatherResponse = await weatherResponse.json();

		// Process forecast data for hourly temps
		let hourly: HourlyForecast[] = [];
		let tempHigh = Math.round(weatherData.main.temp);
		let tempLow = Math.round(weatherData.main.temp);

		if (forecastResponse.ok) {
			const forecastData: OpenWeatherForecastResponse = await forecastResponse.json();

			// Get next 6 forecast entries (3-hour intervals)
			hourly = forecastData.list.slice(0, 6).map((item) => ({
				time: item.dt,
				temperature: Math.round(item.main.temp),
				conditionCode: item.weather[0]?.id || 800,
				precipitationChance: Math.round((item.pop || 0) * 100),
			}));

			// Calculate high/low from today's forecasts
			const allTemps = [weatherData.main.temp, ...forecastData.list.slice(0, 8).map((item) => item.main.temp)];
			tempHigh = Math.round(Math.max(...allTemps));
			tempLow = Math.round(Math.min(...allTemps));
		}

		const response: WeatherResponse = {
			temperature: Math.round(weatherData.main.temp),
			feelsLike: Math.round(weatherData.main.feels_like),
			humidity: weatherData.main.humidity,
			pressure: weatherData.main.pressure,
			visibility: Math.round(weatherData.visibility / 100) / 10,
			windSpeed: Math.round(weatherData.wind.speed * 10) / 10,
			windDirection: weatherData.wind.deg,
			windGust: weatherData.wind.gust == null ? null : Math.round(weatherData.wind.gust * 10) / 10,
			cloudCover: weatherData.clouds.all,
			condition: weatherData.weather[0]?.main || 'Clear',
			conditionCode: weatherData.weather[0]?.id || 800,
			description: weatherData.weather[0]?.description || 'clear sky',
			city: 'Sydney',
			timezone: weatherData.timezone,
			sunrise: weatherData.sys.sunrise,
			sunset: weatherData.sys.sunset,
			tempHigh,
			tempLow,
			hourly,
		};

		return new Response(JSON.stringify(response), {
			headers: {
				'Content-Type': 'application/json',
				'Cache-Control': 'public, max-age=600',
			},
		});
	} catch (error) {
		console.error('Weather API error:', error);

		return new Response(JSON.stringify({ error: 'Weather data unavailable' }), {
			status: 503,
			headers: {
				'Content-Type': 'application/json',
				'Cache-Control': 'public, max-age=60',
			},
		});
	}
};
