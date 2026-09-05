import { describe, expect, it } from 'vitest';
import { Color } from 'three';
import {
	createFlowerFieldAtmosphere as calculateAtmosphere,
	DEFAULT_SKY_COLOR,
	weatherStateFromCode,
} from '../src/field/weatherAtmosphere';
import type { WeatherData } from '../src/weather/weatherTypes';

// Fixed solar events keep palette tests independent of real-world dates.
function createFlowerFieldAtmosphere(weather: WeatherData | null, options: Parameters<typeof calculateAtmosphere>[1]) {
	return calculateAtmosphere(weather, { ...options, solarTimes: { sunrise: 10_000, sunset: 50_000 } });
}

function weather(overrides: Partial<WeatherData> = {}): WeatherData {
	return {
		temperature: 20,
		feelsLike: 20,
		humidity: 60,
		pressure: 1015,
		visibility: 10,
		windSpeed: 2,
		windDirection: 90,
		windGust: null,
		cloudCover: 0,
		condition: 'Clear',
		conditionCode: 800,
		description: 'clear sky',
		city: 'Sydney',
		timezone: 36000,
		sunrise: 10_000,
		sunset: 50_000,
		tempHigh: 24,
		tempLow: 16,
		hourly: [],
		...overrides,
	};
}

describe('flower field weather atmosphere', () => {
	it.each([DEFAULT_SKY_COLOR, '#273a45', '#d96f91'])('retains the clear-day gradient without API data for %s', (skyColor) => {
		const options = { fallbackSkyColor: skyColor, baseSunStrength: 0.2, now: 30_000 };
		const fallback = createFlowerFieldAtmosphere(null, options);
		const clear = createFlowerFieldAtmosphere(weather(), options);
		expect(fallback.zenithColor).toBe(clear.zenithColor);
		expect(fallback.horizonColor).toBe(clear.horizonColor);
		expect(fallback.horizonColor).not.toBe(fallback.zenithColor);
		expect(fallback.fogColor).toBe(fallback.horizonColor);
		expect(fallback.rainIntensity).toBe(0);
	});

	it.each([
		[211, 'thunderstorm'],
		[311, 'light-rain'],
		[501, 'light-rain'],
		[502, 'heavy-rain'],
		[611, 'snow'],
		[721, 'haze'],
		[741, 'fog'],
		[781, 'severe'],
		[800, 'clear'],
		[802, 'light-clouds'],
		[804, 'heavy-clouds'],
	] as const)('maps condition %i to %s', (code, state) => {
		expect(weatherStateFromCode(code)).toBe(state);
	});

	it('moves the sun across the sky between sunrise and sunset', () => {
		const morning = createFlowerFieldAtmosphere(weather(), {
			fallbackSkyColor: DEFAULT_SKY_COLOR,
			baseSunStrength: 0.2,
			now: 20_000,
		});
		const afternoon = createFlowerFieldAtmosphere(weather(), {
			fallbackSkyColor: DEFAULT_SKY_COLOR,
			baseSunStrength: 0.2,
			now: 40_000,
		});

		expect(morning.sunDirection.x).toBeLessThan(0);
		expect(afternoon.sunDirection.x).toBeGreaterThan(0);
		expect(morning.sunDirection.y).toBeGreaterThan(0);
	});

	it('dims the sun with cloud cover and removes it at night', () => {
		const clear = createFlowerFieldAtmosphere(weather(), {
			fallbackSkyColor: DEFAULT_SKY_COLOR,
			baseSunStrength: 0.2,
			now: 30_000,
		});
		const overcast = createFlowerFieldAtmosphere(weather({ conditionCode: 804, cloudCover: 100 }), {
			fallbackSkyColor: DEFAULT_SKY_COLOR,
			baseSunStrength: 0.2,
			now: 30_000,
		});
		const night = createFlowerFieldAtmosphere(weather(), {
			fallbackSkyColor: DEFAULT_SKY_COLOR,
			baseSunStrength: 0.2,
			now: 0,
		});

		expect(overcast.sunStrength).toBeLessThan(clear.sunStrength);
		expect(night.sunStrength).toBe(0);
		expect(night.sunVisibility).toBe(0);
		expect(night.starVisibility).toBe(1);
		expect(overcast.starVisibility).toBe(0);
	});

	it('hides most nighttime stars behind cloud cover', () => {
		const clearNight = createFlowerFieldAtmosphere(weather(), {
			fallbackSkyColor: DEFAULT_SKY_COLOR,
			baseSunStrength: 0.2,
			now: 0,
		});
		const cloudyNight = createFlowerFieldAtmosphere(weather({ cloudCover: 90 }), {
			fallbackSkyColor: DEFAULT_SKY_COLOR,
			baseSunStrength: 0.2,
			now: 0,
		});

		expect(cloudyNight.starVisibility).toBeLessThan(clearNight.starVisibility * 0.2);
	});

	it('brings fog closer when visibility is low', () => {
		const clear = createFlowerFieldAtmosphere(weather(), {
			fallbackSkyColor: DEFAULT_SKY_COLOR,
			baseSunStrength: 0.2,
			now: 30_000,
		});
		const fog = createFlowerFieldAtmosphere(weather({ conditionCode: 741, visibility: 2 }), {
			fallbackSkyColor: DEFAULT_SKY_COLOR,
			baseSunStrength: 0.2,
			now: 30_000,
		});

		expect(fog.fogFar).toBeLessThan(clear.fogFar);
	});

	it('uses the selected sky color for both zenith and horizon without changing the default palette', () => {
		const defaultSky = createFlowerFieldAtmosphere(weather(), {
			fallbackSkyColor: DEFAULT_SKY_COLOR,
			baseSunStrength: 0.2,
			now: 30_000,
		});
		const adjustedSky = createFlowerFieldAtmosphere(weather(), {
			fallbackSkyColor: '#d96f91',
			baseSunStrength: 0.2,
			now: 30_000,
		});

		expect(defaultSky.zenithColor).toBe(DEFAULT_SKY_COLOR);
		expect(defaultSky.horizonColor).toBe('#b2dcef');
		expect(adjustedSky.zenithColor).not.toBe(defaultSky.zenithColor);
		expect(adjustedSky.horizonColor).not.toBe(defaultSky.horizonColor);
	});

	it('keeps a dark blue sky and its horizon cool instead of shifting them yellow', () => {
		const atmosphere = createFlowerFieldAtmosphere(weather(), {
			fallbackSkyColor: '#273a45',
			baseSunStrength: 0.2,
			now: 30_000,
		});
		const horizon = new Color(atmosphere.horizonColor);
		expect(atmosphere.zenithColor).toBe('#273a45');
		expect(horizon.b).toBeGreaterThan(horizon.r);
		expect(horizon.g).toBeGreaterThan(horizon.r);
		expect(horizon.b).toBeGreaterThan(new Color(atmosphere.zenithColor).b);
		expect(atmosphere.fogColor).toBe(atmosphere.horizonColor);
	});

	it.each(['#000000', '#808080', '#ffffff'])('keeps a neutral sky %s neutral at the horizon', (skyColor) => {
		const atmosphere = createFlowerFieldAtmosphere(weather(), {
			fallbackSkyColor: skyColor,
			baseSunStrength: 0.2,
			now: 30_000,
		});
		const horizon = new Color(atmosphere.horizonColor);
		expect(horizon.r).toBeCloseTo(horizon.g, 5);
		expect(horizon.g).toBeCloseTo(horizon.b, 5);
	});

	it('preserves blue gaps under scattered clouds but mutes a closed cloud deck', () => {
		const options = { fallbackSkyColor: DEFAULT_SKY_COLOR, baseSunStrength: 0.2, now: 30_000 };
		const clear = createFlowerFieldAtmosphere(weather(), options);
		const scattered = createFlowerFieldAtmosphere(weather({ cloudCover: 45 }), options);
		const covered = createFlowerFieldAtmosphere(weather({ cloudCover: 100 }), options);
		expect(scattered.zenithColor).toBe(clear.zenithColor);
		expect(scattered.horizonColor).toBe(clear.horizonColor);
		const saturation = (color: string) => new Color(color).getHSL({ h: 0, s: 0, l: 0 }).s;
		expect(saturation(covered.zenithColor)).toBeLessThan(saturation(clear.zenithColor));
		const rain = createFlowerFieldAtmosphere(weather({ conditionCode: 502, cloudCover: 95 }), options);
		expect(saturation(rain.zenithColor)).toBeLessThan(saturation(scattered.zenithColor));
	});

	it.each([10_000, 50_000])('warms the horizon near solar event %i, with less warmth in overcast weather', (now) => {
		const options = { fallbackSkyColor: DEFAULT_SKY_COLOR, baseSunStrength: 0.2, now };
		const twilight = createFlowerFieldAtmosphere(weather(), options);
		const midday = createFlowerFieldAtmosphere(weather(), { ...options, now: 30_000 });
		const covered = createFlowerFieldAtmosphere(weather({ conditionCode: 804, cloudCover: 100 }), options);
		const warmth = (color: string) => {
			const rgb = new Color(color);
			return rgb.r - rgb.b;
		};
		expect(warmth(twilight.horizonColor)).toBeGreaterThan(warmth(midday.horizonColor));
		expect(warmth(twilight.sunColor)).toBeGreaterThan(warmth(midday.sunColor));
		expect(warmth(covered.horizonColor)).toBeLessThan(warmth(twilight.horizonColor));
		const night = createFlowerFieldAtmosphere(weather(), { ...options, now: 60_000 });
		expect(night.zenithColor).toBe('#07111d');
		expect(night.horizonColor).toBe('#182630');
	});

	it('adds precipitation only for rainy weather states', () => {
		const clear = createFlowerFieldAtmosphere(weather(), {
			fallbackSkyColor: DEFAULT_SKY_COLOR,
			baseSunStrength: 0.2,
			now: 30_000,
		});
		const lightRain = createFlowerFieldAtmosphere(weather({ conditionCode: 500 }), {
			fallbackSkyColor: DEFAULT_SKY_COLOR,
			baseSunStrength: 0.2,
			now: 30_000,
		});
		const heavyRain = createFlowerFieldAtmosphere(weather({ conditionCode: 502 }), {
			fallbackSkyColor: DEFAULT_SKY_COLOR,
			baseSunStrength: 0.2,
			now: 30_000,
		});
		const thunderstorm = createFlowerFieldAtmosphere(weather({ conditionCode: 211 }), {
			fallbackSkyColor: DEFAULT_SKY_COLOR,
			baseSunStrength: 0.2,
			now: 30_000,
		});

		expect(clear.rainIntensity).toBe(0);
		expect(lightRain.rainIntensity).toBeGreaterThan(0);
		expect(heavyRain.rainIntensity).toBeGreaterThan(lightRain.rainIntensity);
		expect(thunderstorm.rainIntensity).toBe(heavyRain.rainIntensity);
	});
});

it('uses Sydney night lighting without weather and ignores API solar timestamps', () => {
	const options = { fallbackSkyColor: DEFAULT_SKY_COLOR, baseSunStrength: 0.2, now: Date.parse('2026-06-21T13:00:00Z') / 1000 };
	const fallback = calculateAtmosphere(null, options);
	const live = calculateAtmosphere(weather({ sunrise: 0, sunset: Number.MAX_SAFE_INTEGER }), options);
	expect(fallback.starVisibility).toBe(1);
	expect(fallback.sunStrength).toBe(0);
	expect(live.zenithColor).toBe(fallback.zenithColor);
	expect(live.starVisibility).toBe(fallback.starVisibility);
});

it('uses Sydney daylight without weather', () => {
	const atmosphere = calculateAtmosphere(null, { fallbackSkyColor: DEFAULT_SKY_COLOR, baseSunStrength: 0.2, now: Date.parse('2026-06-21T02:00:00Z') / 1000 });
	expect(atmosphere.starVisibility).toBe(0);
	expect(atmosphere.sunStrength).toBe(0.2);
});
