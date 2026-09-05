import { afterEach, expect, it, vi } from 'vitest';
import worker from '../worker/index';

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it('returns scene weather with a single current-weather request', async () => {
	const fetch = vi.fn().mockResolvedValue(Response.json({
		main: { temp: 21.4, feels_like: 20.2, humidity: 60, pressure: 1015 },
		visibility: 10000, wind: { speed: 2.4, deg: 90 }, clouds: { all: 35 },
		weather: [{ id: 802, main: 'Clouds', description: 'scattered clouds' }],
		sys: { sunrise: 10000, sunset: 50000 }, timezone: 36000,
	}));
	vi.stubGlobal('fetch', fetch);
	const response = await worker.fetch(new Request('https://example.test/api/weather'), {
		OPENWEATHERMAP_API_KEY: 'test-key', ASSETS: {} as never,
	});
	expect(fetch).toHaveBeenCalledTimes(1);
	expect(new URL(fetch.mock.calls[0][0]).pathname).toBe('/data/2.5/weather');
	expect(response.status).toBe(200);
	expect(await response.json()).toMatchObject({ city: 'Sydney', conditionCode: 802, cloudCover: 35, visibility: 10, windSpeed: 2.4 });
	expect(response.headers.get('Cache-Control')).toBe('public, max-age=600');
});

it('returns a recoverable failure when current weather is unavailable', async () => {
	vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 503 })));
	vi.spyOn(console, 'error').mockImplementation(() => {});
	const response = await worker.fetch(new Request('https://example.test/api/weather'), {
		OPENWEATHERMAP_API_KEY: 'test-key', ASSETS: {} as never,
	});
	expect(response.status).toBe(503);
	expect(await response.json()).toEqual({ error: 'Weather data unavailable' });
});
