import { describe, expect, it } from 'vitest';
import { Sphere, Vector3 } from 'three';
import { updateGrassBounds } from '../src/field/grassBounds';
import { CHUNK_SIZE, TERRAIN_AMPLITUDE, FIELD_CURVATURE_START, FIELD_CURVATURE_RADIUS } from '../src/field/worldMath';

describe('grass culling bounds', () => {
	it.each([0, 35, 65, 120])('contains bent blades at chunk corners and terrain extremes at distance %s', (distance) => {
		const sphere = new Sphere();
		updateGrassBounds(sphere, distance);
		for (const x of [-CHUNK_SIZE / 2, CHUNK_SIZE / 2]) {
			for (const z of [-CHUNK_SIZE / 2, CHUNK_SIZE / 2]) {
				for (const terrainY of [-TERRAIN_AMPLITUDE, TERRAIN_AMPLITUDE]) {
					for (const offset of [new Vector3(0, 1.35, 0), new Vector3(1.35, 0, 0), new Vector3(0, 0, -1.35)]) {
						const point = new Vector3(x, terrainY, z).add(offset);
						const curveDistance = Math.max(0, Math.hypot(point.x - distance, point.z) - FIELD_CURVATURE_START);
						point.y -= curveDistance ** 2 / (2 * FIELD_CURVATURE_RADIUS);
						expect(sphere.containsPoint(point)).toBe(true);
					}
				}
			}
		}
	});
});
