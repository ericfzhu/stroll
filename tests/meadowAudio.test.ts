import { describe, expect, it } from 'vitest';
import { rainMix, synthesizeRainPatter } from '../src/field/meadowAudio';
import { mulberry32 } from '../src/field/worldMath';

describe('rain audio', () => {
	it('is silent in dry weather and increases both layers as rain intensifies', () => {
		expect(rainMix(0)).toEqual({ wash: 0, patter: 0 });
		const light = rainMix(0.42);
		const heavy = rainMix(1);
		expect(light.wash).toBeGreaterThan(0);
		expect(light.patter).toBeGreaterThan(0);
		expect(heavy.wash).toBeGreaterThan(light.wash);
		expect(heavy.patter).toBeGreaterThan(light.patter);
	});

	it('bounds the mix and treats invalid weather intensity as dry', () => {
		expect(rainMix(-1)).toEqual(rainMix(0));
		expect(rainMix(5)).toEqual(rainMix(1));
		expect(rainMix(NaN)).toEqual(rainMix(0));
	});

	it.each([44100, 48000])('synthesizes finite, unclipped, varied patter at %s Hz', (rate) => {
		const a = synthesizeRainPatter(rate, 2, mulberry32(42));
		const b = synthesizeRainPatter(rate, 2, mulberry32(43));
		expect(a.length).toBe(rate * 2);
		let energy = 0;
		let peak = 0;
		let difference = 0;
		let edgeEnergy = 0;
		for (let i = 0; i < a.length; i++) {
			energy += a[i] ** 2;
			if (i > 0) edgeEnergy += (a[i] - a[i - 1]) ** 2;
			peak = Math.max(peak, Math.abs(a[i]));
			difference += Math.abs(a[i] - b[i]);
		}
		expect(Number.isFinite(energy)).toBe(true);
		expect(peak).toBeLessThan(1);
		expect(Math.sqrt(energy / a.length)).toBeGreaterThan(0.005);
		expect(difference).toBeGreaterThan(1);
		// Damped grass impacts should contain little rapid, high-frequency variation.
		expect(edgeEnergy / energy).toBeLessThan(0.1);
	});
});
