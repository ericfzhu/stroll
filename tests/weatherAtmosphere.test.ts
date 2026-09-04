import { describe, expect, it } from 'vitest';
import {
	createFlowerFieldAtmosphere,
	weatherStateFromCode,
} from '../src/features/flower-field/infinite-terrain/weatherAtmosphere';
import type { WeatherData } from '../src/features/weather/weatherTypes';

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
			fallbackSkyColor: '#77c4ee',
			baseSunStrength: 0.2,
			now: 20_000,
		});
		const afternoon = createFlowerFieldAtmosphere(weather(), {
			fallbackSkyColor: '#77c4ee',
			baseSunStrength: 0.2,
			now: 40_000,
		});

		expect(morning.sunDirection.x).toBeLessThan(0);
		expect(afternoon.sunDirection.x).toBeGreaterThan(0);
		expect(morning.sunDirection.y).toBeGreaterThan(0);
	});

	it('dims the sun with cloud cover and removes it at night', () => {
		const clear = createFlowerFieldAtmosphere(weather(), {
			fallbackSkyColor: '#77c4ee',
			baseSunStrength: 0.2,
			now: 30_000,
		});
		const overcast = createFlowerFieldAtmosphere(weather({ conditionCode: 804, cloudCover: 100 }), {
			fallbackSkyColor: '#77c4ee',
			baseSunStrength: 0.2,
			now: 30_000,
		});
		const night = createFlowerFieldAtmosphere(weather(), {
			fallbackSkyColor: '#77c4ee',
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
			fallbackSkyColor: '#77c4ee',
			baseSunStrength: 0.2,
			now: 0,
		});
		const cloudyNight = createFlowerFieldAtmosphere(weather({ cloudCover: 90 }), {
			fallbackSkyColor: '#77c4ee',
			baseSunStrength: 0.2,
			now: 0,
		});

		expect(cloudyNight.starVisibility).toBeLessThan(clearNight.starVisibility * 0.2);
	});

	it('brings fog closer when visibility is low', () => {
		const clear = createFlowerFieldAtmosphere(weather(), {
			fallbackSkyColor: '#77c4ee',
			baseSunStrength: 0.2,
			now: 30_000,
		});
		const fog = createFlowerFieldAtmosphere(weather({ conditionCode: 741, visibility: 2 }), {
			fallbackSkyColor: '#77c4ee',
			baseSunStrength: 0.2,
			now: 30_000,
		});

		expect(fog.fogFar).toBeLessThan(clear.fogFar);
	});

	it('adds precipitation only for rainy weather states', () => {
		const clear = createFlowerFieldAtmosphere(weather(), {
			fallbackSkyColor: '#77c4ee',
			baseSunStrength: 0.2,
			now: 30_000,
		});
		const lightRain = createFlowerFieldAtmosphere(weather({ conditionCode: 500 }), {
			fallbackSkyColor: '#77c4ee',
			baseSunStrength: 0.2,
			now: 30_000,
		});
		const heavyRain = createFlowerFieldAtmosphere(weather({ conditionCode: 502 }), {
			fallbackSkyColor: '#77c4ee',
			baseSunStrength: 0.2,
			now: 30_000,
		});
		const thunderstorm = createFlowerFieldAtmosphere(weather({ conditionCode: 211 }), {
			fallbackSkyColor: '#77c4ee',
			baseSunStrength: 0.2,
			now: 30_000,
		});

		expect(clear.rainIntensity).toBe(0);
		expect(lightRain.rainIntensity).toBeGreaterThan(0);
		expect(heavyRain.rainIntensity).toBeGreaterThan(lightRain.rainIntensity);
		expect(thunderstorm.rainIntensity).toBe(heavyRain.rainIntensity);
	});
});
