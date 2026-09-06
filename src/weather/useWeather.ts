import { useEffect, useState } from 'react';
import type { WeatherData } from './weatherTypes';
import { fetchInitialWeather, fetchWeather, WeatherTimeoutError } from './fetchWeather';

const REFRESH_INTERVAL_MS = 30 * 60 * 1000;

export default function useWeather() {
	const [weather, setWeather] = useState<WeatherData | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let active = true;
		let timedOut = false;
		const controller = new AbortController();
		const refresh = async (initial = false) => {
			if (timedOut) return;
			try {
				const data = await (initial ? fetchInitialWeather : fetchWeather)(controller.signal);
				if (active) setWeather(data);
			} catch (error) {
				if (error instanceof WeatherTimeoutError) timedOut = true;
				else if (active) console.error('Failed to fetch weather:', error);
			} finally {
				if (active) setLoading(false);
			}
		};

		void refresh(true);
		const interval = window.setInterval(refresh, REFRESH_INTERVAL_MS);
		return () => {
			active = false;
			controller.abort();
			window.clearInterval(interval);
		};
	}, []);

	return { weather, loading };
}
