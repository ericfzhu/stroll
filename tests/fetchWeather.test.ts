import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchWeather, WEATHER_TIMEOUT_MS, WeatherTimeoutError } from '../src/weather/fetchWeather';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('weather deadline', () => {
	it('accepts a response before the deadline and clears the timer', async () => {
		vi.useFakeTimers();
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ conditionCode: 800 }) }));
		await expect(fetchWeather(new AbortController().signal)).resolves.toEqual({ conditionCode: 800 });
		expect(vi.getTimerCount()).toBe(0);
	});

	it('times out a stalled JSON body and never accepts its late result', async () => {
		vi.useFakeTimers();
		let complete!: (value: unknown) => void;
		const json = new Promise((resolve) => { complete = resolve; });
		const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: () => json });
		vi.stubGlobal('fetch', mockFetch);
		const result = fetchWeather(new AbortController().signal);
		const rejected = expect(result).rejects.toBeInstanceOf(WeatherTimeoutError);
		await vi.advanceTimersByTimeAsync(WEATHER_TIMEOUT_MS);
		await rejected;
		expect(mockFetch.mock.calls[0][1].signal.aborted).toBe(true);
		complete({ conditionCode: 800 });
		await expect(result).rejects.toBeInstanceOf(WeatherTimeoutError);
		expect(vi.getTimerCount()).toBe(0);
	});

	it('cancels immediately on unmount even when fetch does not settle', async () => {
		vi.useFakeTimers();
		vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
		const controller = new AbortController();
		const result = fetchWeather(controller.signal);
		controller.abort();
		await expect(result).rejects.toMatchObject({ name: 'AbortError' });
		expect(vi.getTimerCount()).toBe(0);
	});
});
