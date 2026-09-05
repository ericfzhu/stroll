import type { Sphere } from 'three';
import { CHUNK_SIZE, TERRAIN_AMPLITUDE, FIELD_CURVATURE_START, FIELD_CURVATURE_RADIUS } from './worldMath';

// Covers the 1.15-unit blade, its +/-0.2 height variation, width, and
// view-space thickening. Wind rotations preserve the blade's length.
const BLADE_ENVELOPE = 2;
const HORIZONTAL_RADIUS = CHUNK_SIZE * Math.SQRT2 / 2 + BLADE_ENVELOPE;

export function updateGrassBounds(sphere: Sphere, distance: number) {
	// Curvature is applied in the shader, so CPU culling must include its
	// displacement at both the nearest and farthest possible blade vertex.
	const near = Math.max(0, distance - HORIZONTAL_RADIUS - FIELD_CURVATURE_START);
	const far = Math.max(0, distance + HORIZONTAL_RADIUS - FIELD_CURVATURE_START);
	const minDrop = near * near / (2 * FIELD_CURVATURE_RADIUS);
	const maxDrop = far * far / (2 * FIELD_CURVATURE_RADIUS);
	sphere.center.set(0, -(minDrop + maxDrop) / 2, 0);
	sphere.radius = Math.hypot(
		HORIZONTAL_RADIUS,
		TERRAIN_AMPLITUDE + BLADE_ENVELOPE + (maxDrop - minDrop) / 2,
	);
}
