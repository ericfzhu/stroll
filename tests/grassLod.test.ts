import { describe, expect, it } from 'vitest';
import { createGrassIndices, GRASS_DETAIL_RANGES, grassDensityForDistance, grassDetailForDistance } from '../src/field/grassLod';

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

describe('grass geometry detail', () => {
	it('waits for the closest corner of a chunk to finish morphing before switching topology', () => {
		const radius = 10 * Math.SQRT2 / 2;
		expect(grassDetailForDistance(37 + radius - 0.01, radius)).toBe(GRASS_DETAIL_RANGES.near);
		expect(grassDetailForDistance(37 + radius + 0.01, radius)).toBe(GRASS_DETAIL_RANGES.mid);
		expect(grassDetailForDistance(67 + radius - 0.01, radius)).toBe(GRASS_DETAIL_RANGES.mid);
		expect(grassDetailForDistance(67 + radius + 0.01, radius)).toBe(GRASS_DETAIL_RANGES.far);
		expect(grassDetailForDistance(0, radius)).toBe(GRASS_DETAIL_RANGES.near);
	});

	it('halves segment triangles at each level while retaining both sides and the full blade height', () => {
		const indices = createGrassIndices();
		expect(indices.length).toBe(84);
		for (const [range, rows] of [
			[GRASS_DETAIL_RANGES.near, [0, 1, 2, 3, 4]],
			[GRASS_DETAIL_RANGES.mid, [0, 2, 4]],
			[GRASS_DETAIL_RANGES.far, [0, 4]],
		] as const) {
			const selected = indices.slice(range.start, range.start + range.count);
			expect(Math.min(...selected)).toBe(0);
			expect(Math.max(...selected)).toBe(19);
			expect([...new Set(selected.map((index) => Math.floor(index % 10 / 2)))].sort()).toEqual(rows);
			expect(selected.filter((index) => index < 10)).toHaveLength(range.count / 2);
		}
		expect(GRASS_DETAIL_RANGES.mid.count).toBe(GRASS_DETAIL_RANGES.near.count / 2);
		expect(GRASS_DETAIL_RANGES.far.count).toBe(GRASS_DETAIL_RANGES.near.count / 4);
	});
});
