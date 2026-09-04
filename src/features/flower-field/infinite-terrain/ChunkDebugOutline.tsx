import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { CHUNK_SIZE, TERRAIN_SEGMENTS, terrainHeight } from './worldMath';

interface ChunkDebugOutlineProps {
	x: number;
	z: number;
	material: THREE.Material;
}

const SURFACE_OFFSET = 0.08;

function createChunkPerimeter(chunkX: number, chunkZ: number) {
	const halfSize = CHUNK_SIZE * 0.5;
	const points: THREE.Vector3[] = [];
	const addPoint = (localX: number, localZ: number) => {
		const worldX = chunkX * CHUNK_SIZE + localX;
		const worldZ = chunkZ * CHUNK_SIZE + localZ;
		points.push(new THREE.Vector3(localX, terrainHeight(worldX, worldZ) + SURFACE_OFFSET, localZ));
	};

	for (let step = 0; step < TERRAIN_SEGMENTS; step += 1) {
		addPoint(-halfSize + step / TERRAIN_SEGMENTS * CHUNK_SIZE, -halfSize);
	}
	for (let step = 0; step < TERRAIN_SEGMENTS; step += 1) {
		addPoint(halfSize, -halfSize + step / TERRAIN_SEGMENTS * CHUNK_SIZE);
	}
	for (let step = 0; step < TERRAIN_SEGMENTS; step += 1) {
		addPoint(halfSize - step / TERRAIN_SEGMENTS * CHUNK_SIZE, halfSize);
	}
	for (let step = 0; step < TERRAIN_SEGMENTS; step += 1) {
		addPoint(-halfSize, halfSize - step / TERRAIN_SEGMENTS * CHUNK_SIZE);
	}

	return new THREE.BufferGeometry().setFromPoints(points);
}

export default function ChunkDebugOutline({ x, z, material }: ChunkDebugOutlineProps) {
	const geometry = useMemo(() => createChunkPerimeter(x, z), [x, z]);
	useEffect(() => () => geometry.dispose(), [geometry]);

	return (
		<lineLoop
			geometry={geometry}
			material={material}
			position={[x * CHUNK_SIZE, 0, z * CHUNK_SIZE]}
			renderOrder={10}
			frustumCulled={false}
		/>
	);
}
