import { describe, expect, it } from 'vitest';
import { grassDensityForDistance } from '../src/field/grassLod';

describe('grassDensityForDistance', () => {
	it('keeps the established density plateaus', () => {
		expect(grassDensityForDistance(0)).toBe(1);
		expect(grassDensityForDistance(45)).toBe(0.64);
		expect(grassDensityForDistance(80)).toBe(0.3);
	});

	it('changes continuously through both transition bands', () => {
		const nearStart = grassDensityForDistance(27);
		const nearMiddle = grassDensityForDistance(32);
		const nearEnd = grassDensityForDistance(37);
		const farStart = grassDensityForDistance(57);
		const farMiddle = grassDensityForDistance(62);
		const farEnd = grassDensityForDistance(67);

		expect(nearStart).toBe(1);
		expect(nearMiddle).toBeCloseTo(0.82);
		expect(nearEnd).toBe(0.64);
		expect(farStart).toBe(0.64);
		expect(farMiddle).toBeCloseTo(0.47);
		expect(farEnd).toBe(0.3);
	});
});
