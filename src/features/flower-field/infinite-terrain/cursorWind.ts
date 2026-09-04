import * as THREE from 'three';
import { terrainHeight } from './worldMath';

export interface CursorWindState {
	position: THREE.Vector2;
	trailPosition: THREE.Vector2;
	velocity: THREE.Vector2;
	direction: THREE.Vector2;
	strength: number;
	radius: number;
}

export function createCursorWindState(): CursorWindState {
	return {
		position: new THREE.Vector2(10000, 10000),
		trailPosition: new THREE.Vector2(10000, 10000),
		velocity: new THREE.Vector2(),
		direction: new THREE.Vector2(1, 0),
		strength: 0,
		radius: 8,
	};
}

export function intersectTerrainHeightField(
	ray: THREE.Ray,
	result: THREE.Vector3,
	maxDistance: number,
) {
	if (ray.direction.y >= -0.001) return false;

	let previousDistance = 0;
	let previousClearance = ray.origin.y - terrainHeight(ray.origin.x, ray.origin.z);

	for (let distance = 1; distance <= maxDistance; distance += 1) {
		const x = ray.origin.x + ray.direction.x * distance;
		const y = ray.origin.y + ray.direction.y * distance;
		const z = ray.origin.z + ray.direction.z * distance;
		const clearance = y - terrainHeight(x, z);

		if (clearance <= 0 && previousClearance > 0) {
			let low = previousDistance;
			let high = distance;
			for (let iteration = 0; iteration < 8; iteration += 1) {
				const midpoint = (low + high) * 0.5;
				const midpointX = ray.origin.x + ray.direction.x * midpoint;
				const midpointY = ray.origin.y + ray.direction.y * midpoint;
				const midpointZ = ray.origin.z + ray.direction.z * midpoint;
				if (midpointY > terrainHeight(midpointX, midpointZ)) low = midpoint;
				else high = midpoint;
			}

			const hitDistance = (low + high) * 0.5;
			const hitX = ray.origin.x + ray.direction.x * hitDistance;
			const hitZ = ray.origin.z + ray.direction.z * hitDistance;
			result.set(hitX, terrainHeight(hitX, hitZ), hitZ);
			return true;
		}

		previousDistance = distance;
		previousClearance = clearance;
	}

	return false;
}
