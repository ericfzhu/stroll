import { describe, expect, it } from 'vitest';
import { Color } from 'three';
import { sydneyMoon, moonlightAmount } from '../src/weather/sydneyMoon';
import { createFlowerFieldAtmosphere } from '../src/field/weatherAtmosphere';

const full = { altitude: Math.PI / 2, azimuth: 0, illuminatedFraction: 1, phase: 0.5 };

describe('moonlight exposure', () => {
	it('adds no moonlight below the horizon, at new moon, under overcast skies, or by day', () => {
		expect(moonlightAmount({ ...full, altitude: -0.1 }, 0, 0)).toBe(0);
		expect(moonlightAmount({ ...full, illuminatedFraction: 0 }, 0, 0)).toBe(0);
		expect(moonlightAmount(full, 100, 0)).toBe(0);
		expect(moonlightAmount(full, 0, 1)).toBe(0);
	});
	it('brightens with elevation and fullness and dims with cloud cover', () => {
		expect(moonlightAmount(full, 0, 0)).toBe(1);
		expect(moonlightAmount({ ...full, altitude: 0.1 }, 0, 0)).toBeLessThan(0.11);
		expect(moonlightAmount({ ...full, illuminatedFraction: 0.5 }, 0, 0)).toBeLessThan(0.2);
		expect(moonlightAmount(full, 50, 0)).toBeLessThan(moonlightAmount(full, 0, 0));
	});
});

it('calculates changing Sydney moon elevation and phase from absolute time', () => {
	const start = Date.parse('2026-01-03T13:00:00Z') / 1000;
	const moon = sydneyMoon(start);
	expect(moon.illuminatedFraction).toBeGreaterThan(0.98);
	expect(moon.altitude).toBeGreaterThan(0);
	expect(sydneyMoon(start + 12 * 3600).altitude).toBeLessThan(0);
	expect(sydneyMoon(start + 15 * 86400).illuminatedFraction).toBeLessThan(0.05);
});

it('uses moonlight in the field without API data and leaves daytime ambient white', () => {
	const options = { fallbackSkyColor: '#389ddd', baseSunStrength: 0.2 };
	const night = createFlowerFieldAtmosphere(null, { ...options, now: Date.parse('2026-01-03T13:00:00Z') / 1000 });
	const day = createFlowerFieldAtmosphere(null, { ...options, now: Date.parse('2026-01-04T02:00:00Z') / 1000 });
	expect(night.moonlight).toBeGreaterThan(0.3);
	expect(new Color(night.ambientTint).b).toBeGreaterThan(new Color('#39465b').b);
	expect(day.moonlight).toBe(0);
	expect(day.ambientTint).toBe('#ffffff');
});
