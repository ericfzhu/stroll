import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { afterEach, expect, it, vi } from 'vitest';
import { fetchInitialWeather, WEATHER_TIMEOUT_MS, WeatherTimeoutError } from '../src/weather/fetchWeather';

const script = readFileSync(new URL('../index.html', import.meta.url), 'utf8').match(/<script>([\s\S]*?)<\/script>/)![1];
function boot(fetch: ReturnType<typeof vi.fn>, pathname = '/') {
	const window = {};
	runInNewContext(script, { window, location: { pathname }, fetch, AbortController, setTimeout, clearTimeout });
	vi.stubGlobal('window', window);
	vi.stubGlobal('fetch', fetch);
	return window;
}
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it('reuses the HTML response across initial consumers without a second fetch', async () => {
	vi.useFakeTimers();
	const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ conditionCode: 800 }) });
	boot(fetch);
	await vi.advanceTimersByTimeAsync(100);
	const signal = new AbortController().signal;
	await expect(fetchInitialWeather(signal)).resolves.toEqual({ conditionCode: 800 });
	await expect(fetchInitialWeather(signal)).resolves.toEqual({ conditionCode: 800 });
	expect(fetch).toHaveBeenCalledTimes(1);
	expect(vi.getTimerCount()).toBe(0);
});

it('retains timeout before React starts and ignores a late JSON body', async () => {
	vi.useFakeTimers();
	let complete!: (value: unknown) => void;
	const json = new Promise(resolve => { complete = resolve; });
	const fetch = vi.fn().mockResolvedValue({ ok: true, json: () => json });
	boot(fetch);
	await vi.advanceTimersByTimeAsync(WEATHER_TIMEOUT_MS);
	expect(fetch.mock.calls[0][1].signal.aborted).toBe(true);
	complete({ conditionCode: 800 });
	await vi.advanceTimersByTimeAsync(1000);
	await expect(fetchInitialWeather(new AbortController().signal)).rejects.toBeInstanceOf(WeatherTimeoutError);
	expect(fetch).toHaveBeenCalledTimes(1);
});

it('does not start a weather request on demo pages', () => {
	const fetch = vi.fn();
	boot(fetch, '/demo');
	expect(fetch).not.toHaveBeenCalled();
});
