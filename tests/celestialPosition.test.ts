import { expect, it } from 'vitest';
import { skyDirection, sydneySunDirection } from '../src/weather/sydneyCelestialPosition';
import { sydneyMoon } from '../src/weather/sydneyMoon';

it('maps astronomical azimuths into the north-facing scene', () => {
	expect(skyDirection(0, Math.PI).z).toBeCloseTo(-1);
	expect(skyDirection(0, -Math.PI / 2).x).toBeCloseTo(1);
	expect(skyDirection(0, Math.PI / 2).x).toBeCloseTo(-1);
	expect(skyDirection(Math.PI / 2, 0).y).toBeCloseTo(1);
});

it('puts the Sydney midday sun to the north and higher in summer', () => {
	const winter = sydneySunDirection(Date.parse('2026-06-21T02:00:00Z') / 1000);
	const summer = sydneySunDirection(Date.parse('2026-12-21T02:00:00Z') / 1000);
	expect(winter.z).toBeLessThan(0);
	expect(summer.z).toBeLessThan(0);
	expect(summer.y).toBeGreaterThan(winter.y);
	expect(winter.length()).toBeCloseTo(1);
});

it('places a full moon opposite the sun and below-horizon sun below the scene', () => {
	const now = Date.parse('2026-01-03T13:00:00Z') / 1000;
	const sun = sydneySunDirection(now);
	const moon = sydneyMoon(now);
	expect(sun.y).toBeLessThan(0);
	expect(skyDirection(moon.altitude, moon.azimuth).dot(sun)).toBeLessThan(-0.98);
});
