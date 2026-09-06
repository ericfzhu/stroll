import { describe, expect, it } from 'vitest';
import { Matrix4 } from 'three';
import { distantFlower, updateFlowerDetails } from '../src/field/flowerLod';
import { createDaisyGeometry } from '../src/field/flowerGeometry';

describe('flower detail selection', () => {
	it('retains the previous detail level within the transition band', () => {
		expect(distantFlower(40 ** 2, false)).toBe(false);
		expect(distantFlower(40 ** 2, true)).toBe(true);
		expect(distantFlower(43 ** 2, false)).toBe(true);
		expect(distantFlower(37 ** 2, true)).toBe(false);
	});

	it('tracks each instance through forward and backward movement without changing placement', () => {
		const matrices = [new Matrix4().makeTranslation(0, 2, -20), new Matrix4().makeTranslation(0, 1, -60)];
		const original = matrices.map((matrix) => matrix.toArray());
		const details = new Uint8Array(2);
		expect(updateFlowerDetails(matrices, details, 0, 0)).toBe(true);
		expect([...details]).toEqual([0, 1]);
		expect(updateFlowerDetails(matrices, details, 0, 0)).toBe(false);
		expect(updateFlowerDetails(matrices, details, 0, -30)).toBe(true);
		expect([...details]).toEqual([0, 0]);
		expect(updateFlowerDetails(matrices, details, 0, 0)).toBe(true);
		expect([...details]).toEqual([0, 1]);
		expect(matrices.map((matrix) => matrix.toArray())).toEqual(original);
	});
});

describe('distant daisy geometry', () => {
	it.each(['oxeye', 'meadow', 'cupped'] as const)('reduces %s geometry while keeping its extent and shader attributes', (variant) => {
		for (let seed = 1; seed <= 4; seed += 1) {
			const near = createDaisyGeometry(variant, seed);
			const far = createDaisyGeometry(variant, seed, true);
			expect(far.index!.count).toBeLessThan(near.index!.count * 0.6);
			near.computeBoundingBox();
			far.computeBoundingBox();
			expect(far.boundingBox!.min.distanceTo(near.boundingBox!.min)).toBeLessThan(0.025);
			expect(far.boundingBox!.max.distanceTo(near.boundingBox!.max)).toBeLessThan(0.025);
			for (const name of ['normal', 'color', 'aHeadRigidity']) {
				expect(far.getAttribute(name).count).toBe(far.getAttribute('position').count);
				expect(Array.from(far.getAttribute(name).array).every(Number.isFinite)).toBe(true);
			}
			near.dispose();
			far.dispose();
		}
	});
});
