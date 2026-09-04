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
