import type { Matrix4 } from 'three';

// A four-unit dead band prevents repeated switches at the same boundary.
export function distantFlower(distanceSquared: number, wasDistant: boolean) {
	const threshold = wasDistant ? 38 : 42;
	return distanceSquared > threshold * threshold;
}

export function updateFlowerDetails(matrices: readonly Matrix4[], details: Uint8Array, x: number, z: number) {
	let changed = false;
	for (let index = 0; index < matrices.length; index += 1) {
		const elements = matrices[index].elements;
		const distanceSquared = (elements[12] - x) ** 2 + (elements[14] - z) ** 2;
		const next = distantFlower(distanceSquared, details[index] === 1) ? 1 : 0;
		if (next !== details[index]) { details[index] = next; changed = true; }
	}
	return changed;
}
