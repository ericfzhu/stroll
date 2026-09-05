import type { WeatherData } from './weatherTypes';

export const WEATHER_TIMEOUT_MS = 5_000;
export class WeatherTimeoutError extends Error {
	constructor() { super('Weather request timed out'); }
}

export async function fetchWeather(signal: AbortSignal): Promise<WeatherData> {
	const controller = new AbortController();
	let timer: ReturnType<typeof setTimeout> | undefined;
	let onAbort = () => {};
	const deadline = new Promise<never>((_, reject) => {
		onAbort = () => {
			reject(new DOMException('Weather request cancelled', 'AbortError'));
			controller.abort();
		};
		if (signal.aborted) { onAbort(); return; }
		signal.addEventListener('abort', onAbort, { once: true });
		timer = setTimeout(() => {
			reject(new WeatherTimeoutError());
			controller.abort();
		}, WEATHER_TIMEOUT_MS);
	});
	try {
		// The deadline includes reading JSON, and wins even if fetch ignores abort.
		return await Promise.race([deadline, (async () => {
			const response = await fetch('/api/weather', { signal: controller.signal });
			if (!response.ok) throw new Error(`Weather API error: ${response.status}`);
			const data: WeatherData | { error: string } = await response.json();
			if ('error' in data) throw new Error(data.error);
			return data;
		})()]);
	} finally {
		clearTimeout(timer);
		signal.removeEventListener('abort', onAbort);
	}
}
