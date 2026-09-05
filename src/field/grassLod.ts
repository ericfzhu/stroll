export const GRASS_SEGMENTS = 4;
export const GRASS_NEAR_WIDTH = 0.15;
export const GRASS_MID_WIDTH = 0.18;
export const GRASS_FAR_WIDTH = 0.24;

const GRASS_NEAR_DENSITY = 1;
const GRASS_MID_DENSITY = 0.64;
const GRASS_FAR_DENSITY = 0.3;
export const GRASS_NEAR_TRANSITION_START = 27;
export const GRASS_NEAR_TRANSITION_END = 37;
export const GRASS_FAR_TRANSITION_START = 57;
export const GRASS_FAR_TRANSITION_END = 67;

// All levels reference the same four-segment vertex layout, so blade hashes,
// placement and animation remain identical when the draw range changes.
export const GRASS_DETAIL_RANGES = {
	near: { start: 0, count: 48 },
	mid: { start: 48, count: 24 },
	far: { start: 72, count: 12 },
} as const;

export function createGrassIndices() {
	const indices: number[] = [];
	const backOffset = (GRASS_SEGMENTS + 1) * 2;
	for (const step of [1, 2, 4]) {
		for (let level = 0; level < GRASS_SEGMENTS; level += step) {
			const bottom = level * 2;
			const top = (level + step) * 2;
			indices.push(
				bottom, bottom + 1, top,
				top, bottom + 1, top + 1,
				backOffset + top, backOffset + bottom + 1, backOffset + bottom,
				backOffset + top + 1, backOffset + bottom + 1, backOffset + top,
			);
		}
	}
	return new Uint16Array(indices);
}

export function grassDetailForDistance(distance: number, chunkRadius: number) {
	// Wait until even the nearest blade has completed its shader morph.
	const nearestDistance = Math.max(0, distance - chunkRadius);
	if (nearestDistance >= GRASS_FAR_TRANSITION_END) return GRASS_DETAIL_RANGES.far;
	if (nearestDistance >= GRASS_NEAR_TRANSITION_END) return GRASS_DETAIL_RANGES.mid;
	return GRASS_DETAIL_RANGES.near;
}

function smoothstep(start: number, end: number, value: number) {
	const progress = Math.min(1, Math.max(0, (value - start) / (end - start)));
	return progress * progress * (3 - 2 * progress);
}

function mix(start: number, end: number, progress: number) {
	return start + (end - start) * progress;
}

export function grassDensityForDistance(distance: number) {
	const nearBlend = smoothstep(
		GRASS_NEAR_TRANSITION_START,
		GRASS_NEAR_TRANSITION_END,
		distance,
	);
	const farBlend = smoothstep(
		GRASS_FAR_TRANSITION_START,
		GRASS_FAR_TRANSITION_END,
		distance,
	);
	const nearToMid = mix(GRASS_NEAR_DENSITY, GRASS_MID_DENSITY, nearBlend);
	return mix(nearToMid, GRASS_FAR_DENSITY, farBlend);
}
