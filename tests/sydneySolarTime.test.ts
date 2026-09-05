import { describe, expect, it } from 'vitest';
import { sydneySolarTimes } from '../src/weather/sydneySolarTime';

const seconds = (date: string) => Date.parse(date) / 1000;

describe('Sydney solar time', () => {
	it.each([
		// Approximate Sydney solstice times: 07:00/16:54 AEST and 05:41/20:05 AEDT.
		['2026-06-21T02:00:00Z', '2026-06-20T21:00:00Z', '2026-06-21T06:54:00Z'],
		['2026-12-21T02:00:00Z', '2026-12-20T18:41:00Z', '2026-12-21T09:05:00Z'],
	])('matches expected seasonal times for %s within eight minutes', (now, sunrise, sunset) => {
		const times = sydneySolarTimes(seconds(now));
		expect(Math.abs(times.sunrise - seconds(sunrise))).toBeLessThan(8 * 60);
		expect(Math.abs(times.sunset - seconds(sunset))).toBeLessThan(8 * 60);
	});

	it('selects the Sydney date before the UTC date rolls over', () => {
		const early = sydneySolarTimes(seconds('2026-12-20T13:30:00Z'));
		const noon = sydneySolarTimes(seconds('2026-12-21T01:00:00Z'));
		expect(early).toEqual(noon);
		expect(early.sunrise).toBeGreaterThan(seconds('2026-12-20T13:30:00Z'));
	});

	it.each(['2026-04-05', '2026-10-04', '2028-02-29'])('handles daylight-saving boundaries and leap days on %s', (date) => {
		const now = seconds(`${date}T02:00:00Z`);
		const times = sydneySolarTimes(now);
		expect(times.sunrise).toBeLessThan(now);
		expect(times.sunset).toBeGreaterThan(now);
		expect(times.sunset - times.sunrise).toBeGreaterThan(9 * 3600);
		expect(times.sunset - times.sunrise).toBeLessThan(15 * 3600);
	});
});
