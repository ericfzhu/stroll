import { useEffect, useState } from 'react';
import type { WeatherData } from './weatherTypes';

const REFRESH_INTERVAL_MS = 30 * 60 * 1000;

export default function useWeather() {
	const [weather, setWeather] = useState<WeatherData | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let active = true;
		const fetchWeather = async () => {
			try {
				const response = await fetch('/api/weather');
				if (!response.ok) {
					console.error('Weather API error:', response.status);
					return;
				}
				const data: WeatherData | { error: string } = await response.json();
				if (active && !('error' in data)) setWeather(data);
			} catch (error) {
				console.error('Failed to fetch weather:', error);
			} finally {
				if (active) setLoading(false);
			}
		};

		void fetchWeather();
		const interval = window.setInterval(fetchWeather, REFRESH_INTERVAL_MS);
		return () => {
			active = false;
			window.clearInterval(interval);
		};
	}, []);

	return { weather, loading };
}
