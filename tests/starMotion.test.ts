import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { SIDEREAL_DAY_SECONDS, STAR_ROTATION_AXIS, starRotationAt } from '../src/field/starMotion';
import { createFlowerFieldAtmosphere } from '../src/field/weatherAtmosphere';
import { Color } from 'three';

describe('night sky motion', () => {
	it('turns about 15 degrees per hour and repeats after a sidereal day', () => {
		expect(Math.abs(starRotationAt(3600)) * 180 / Math.PI).toBeCloseTo(15.041, 2);
		expect(starRotationAt(SIDEREAL_DAY_SECONDS)).toBeCloseTo(0);
	});
	it('keeps the celestial pole fixed while stars rise in the east', () => {
		expect(STAR_ROTATION_AXIS.length()).toBeCloseTo(1);
		expect(STAR_ROTATION_AXIS.clone().applyAxisAngle(STAR_ROTATION_AXIS, starRotationAt(3600)).distanceTo(STAR_ROTATION_AXIS)).toBeLessThan(1e-10);
		expect(new Vector3(1, 0, 0).applyAxisAngle(STAR_ROTATION_AXIS, starRotationAt(3600)).y).toBeGreaterThan(0);
	});
});

it('dims and cools ambient lighting at night without changing daytime brightness', () => {
	const options = { fallbackSkyColor: '#389ddd', baseSunStrength: 0.2, solarTimes: { sunrise: 21600, sunset: 64800 } };
	const day = createFlowerFieldAtmosphere(null, { ...options, now: 43200 });
	const night = createFlowerFieldAtmosphere(null, { ...options, now: 0 });
	expect(day.ambientTint).toBe('#ffffff');
	const tint = new Color(night.ambientTint);
	expect(Math.max(tint.r, tint.g, tint.b)).toBeLessThan(0.25);
	expect(tint.b).toBeGreaterThan(tint.r);
	expect(night.sunStrength).toBe(0);
});
