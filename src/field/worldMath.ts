import { createNoise2D } from 'simplex-noise';

export const CHUNK_SIZE = 10;
export const TERRAIN_SCALE = 0.05;
export const TERRAIN_AMPLITUDE = 2;
export const TERRAIN_SEGMENTS = 16;
export const FIELD_CURVATURE_START = 40;
export const FIELD_CURVATURE_RADIUS = 200;

export function mulberry32(seed: number) {
	let value = seed >>> 0;
	return () => {
		value += 0x6d2b79f5;
		let result = value;
		result = Math.imul(result ^ result >>> 15, result | 1);
		result ^= result + Math.imul(result ^ result >>> 7, result | 61);
		return ((result ^ result >>> 14) >>> 0) / 4294967296;
	};
}

export const sharedNoise2D = createNoise2D(mulberry32(1337));

export function terrainHeight(x: number, z: number) {
	return sharedNoise2D(x * TERRAIN_SCALE, z * TERRAIN_SCALE) * TERRAIN_AMPLITUDE;
}

export function chunkSeed(x: number, z: number, salt: number) {
	return (
		Math.imul(x, 73856093)
		^ Math.imul(z, 19349663)
		^ Math.imul(salt, 83492791)
	) >>> 0;
}
