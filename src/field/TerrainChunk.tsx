import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { updateGrassBounds } from './grassBounds';
import { createGrassIndices, GRASS_DETAIL_RANGES, grassDensityForDistance, grassDetailForDistance } from './grassLod';
import {
	CHUNK_SIZE,
	TERRAIN_AMPLITUDE,
	TERRAIN_SCALE,
	TERRAIN_SEGMENTS,
	chunkSeed,
	mulberry32,
	sharedNoise2D,
} from './worldMath';

interface TerrainChunkProps {
	x: number;
	z: number;
	baseGrassCount: number;
	terrainMaterial: THREE.Material;
	grassMaterial: THREE.Material;
}

const GRASS_CHUNK_RADIUS = CHUNK_SIZE * Math.SQRT2 / 2;

function createGrassGeometry(x: number, z: number, count: number) {
	const geometry = new THREE.InstancedBufferGeometry();
	geometry.instanceCount = 0;
	geometry.setIndex(new THREE.BufferAttribute(createGrassIndices(), 1));
	geometry.setDrawRange(GRASS_DETAIL_RANGES.near.start, GRASS_DETAIL_RANGES.near.count);
	geometry.boundingSphere = new THREE.Sphere();
	updateGrassBounds(geometry.boundingSphere, 0);

	const positions = new Float32Array(count * 3);
	const random = mulberry32(chunkSeed(x, z, 0xdecafbad));
	const chunkWorldX = x * CHUNK_SIZE;
	const chunkWorldZ = z * CHUNK_SIZE;

	for (let index = 0; index < count; index += 1) {
		const localX = (random() - 0.5) * CHUNK_SIZE;
		const localZ = (random() - 0.5) * CHUNK_SIZE;
		const worldX = localX + chunkWorldX;
		const worldZ = localZ + chunkWorldZ;
		positions[index * 3] = localX;
		positions[index * 3 + 1] = sharedNoise2D(worldX * TERRAIN_SCALE, worldZ * TERRAIN_SCALE) * TERRAIN_AMPLITUDE;
		positions[index * 3 + 2] = localZ;
	}

	geometry.setAttribute('aInstancePosition', new THREE.InstancedBufferAttribute(positions, 3));
	return geometry;
}

export default function TerrainChunk({ x, z, baseGrassCount, terrainMaterial, grassMaterial }: TerrainChunkProps) {
	const grassMeshRef = useRef<THREE.Mesh>(null);
	const grassCountRef = useRef(-1);
	const terrainGeometry = useMemo(() => {
		const geometry = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, TERRAIN_SEGMENTS, TERRAIN_SEGMENTS);
		const positions = geometry.attributes.position;
		const chunkWorldX = x * CHUNK_SIZE;
		const chunkWorldZ = z * CHUNK_SIZE;

		for (let index = 0; index < positions.count; index += 1) {
			const worldX = positions.getX(index) + chunkWorldX;
			const worldZ = -positions.getY(index) + chunkWorldZ;
			positions.setZ(index, sharedNoise2D(worldX * TERRAIN_SCALE, worldZ * TERRAIN_SCALE) * TERRAIN_AMPLITUDE);
		}
		geometry.computeVertexNormals();
		return geometry;
	}, [x, z]);

	const grassGeometry = useMemo(
		() => createGrassGeometry(x, z, baseGrassCount),
		[baseGrassCount, x, z],
	);

	useFrame(({ camera }) => {
		const geometry = grassMeshRef.current?.geometry as THREE.InstancedBufferGeometry | undefined;
		if (!geometry) return;
		const distance = Math.hypot(
			camera.position.x - x * CHUNK_SIZE,
			camera.position.z - z * CHUNK_SIZE,
		);
		const grassCount = Math.round(baseGrassCount * grassDensityForDistance(distance));
		updateGrassBounds(geometry.boundingSphere!, distance);
		const detail = grassDetailForDistance(distance, GRASS_CHUNK_RADIUS);
		if (geometry.drawRange.start !== detail.start) geometry.setDrawRange(detail.start, detail.count);
		if (grassCount === grassCountRef.current) return;
		grassCountRef.current = grassCount;
		geometry.instanceCount = grassCount;
	});

	useEffect(() => () => terrainGeometry.dispose(), [terrainGeometry]);
	useEffect(() => () => grassGeometry.dispose(), [grassGeometry]);

	return (
		<group position={[x * CHUNK_SIZE, 0, z * CHUNK_SIZE]} dispose={null}>
			<mesh geometry={terrainGeometry} material={terrainMaterial} rotation-x={-Math.PI / 2} receiveShadow />
			<mesh ref={grassMeshRef} geometry={grassGeometry} material={grassMaterial} receiveShadow />
		</group>
	);
}
