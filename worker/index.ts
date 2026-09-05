interface Env {
	ASSETS: Fetcher;
	OPENWEATHERMAP_API_KEY: string;
}

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
}

async function getWeatherResponse(env: Env) {
	try {
		// Sydney coordinates
		const latitude = '-33.8688';
		const longitude = '151.2093';

		const apiKey = env.OPENWEATHERMAP_API_KEY;
		const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&units=metric&appid=${apiKey}`;
		const weatherResponse = await fetch(weatherUrl);

		if (!weatherResponse.ok) {
			throw new Error(`OpenWeatherMap API error: ${weatherResponse.status}`);
		}

		const weatherData: OpenWeatherResponse = await weatherResponse.json();

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
}

export default {
	async fetch(request, env): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === '/api/weather') {
			if (request.method !== 'GET') {
				return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET' } });
			}
			return getWeatherResponse(env);
		}

		if (url.pathname.startsWith('/api/')) {
			return Response.json({ error: 'Not found' }, { status: 404 });
		}

		return env.ASSETS.fetch(request);
	},
} satisfies ExportedHandler<Env>;
