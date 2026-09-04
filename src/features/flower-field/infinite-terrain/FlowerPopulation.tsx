import { useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { createNoise2D } from 'simplex-noise';
import * as THREE from 'three';
import {
	createDaisyGeometry,
	createFieldRoseGeometry,
	DAISY_STEM_HEIGHT,
	ROSE_BLOOM_DURATION,
	ROSE_BLOOM_START,
	ROSE_STEM_DURATION,
	type DaisyVariantId,
} from '../flowerGeometry';
import flowerVertexShader from './shaders/flowers/vertex.glsl?raw';
import flowerFragmentShader from './shaders/flowers/fragment.glsl?raw';
import type { CursorWindState } from './cursorWind';
import type { FlowerFieldDiagnosticValues } from './flowerFieldDiagnosticState';
import {
	PLANTABLE_ROSE_VARIANTS,
	type PlantableRoseVariant,
	type PlantedRose,
} from './plantedRoses';
import { CHUNK_SIZE, FIELD_CURVATURE_RADIUS, FIELD_CURVATURE_START, chunkSeed, mulberry32, terrainHeight } from './worldMath';

type FieldDaisyVariant = Extract<DaisyVariantId, 'oxeye' | 'meadow' | 'cupped'>;

interface FlowerPopulationProps {
	chunks: Array<{ x: number; z: number; key: string }>;
	candidatesPerChunk: number;
	noiseTexture: THREE.Texture;
	sunDirection: THREE.Vector3;
	skyColor: string;
	sunColor: string;
	sunStrength: number;
	windSpeed: number;
	windStrength: number;
	windDirection: number;
	windScale: number;
	cursorWindRef: RefObject<CursorWindState>;
	diagnosticsRef: RefObject<FlowerFieldDiagnosticValues>;
	plantedRoses: PlantedRose[];
}

interface Colony {
	x: number;
	z: number;
	radius: number;
	strength: number;
	variant: Exclude<FieldDaisyVariant, 'cupped'>;
	phenotype: number;
}

interface DominantColony {
	colony: Colony;
	score: number;
}

interface FlowerGroup {
	key: string;
	variant: FieldDaisyVariant;
	phenotype: number;
	matrices: THREE.Matrix4[];
}

interface FlowerTile {
	chunkGroups: Map<string, FlowerGroup[]>;
}

interface CachedFlowerPopulation {
	groups: FlowerGroup[];
	flowerInstances: number;
	flowerTiles: number;
	flowerChunksGenerated: number;
}

interface MatrixBuildTiming {
	population: FlowerGroup[] | null;
	totalMs: number;
	completedBatches: number;
	expectedBatches: number;
}

const COLONY_CELL_SIZE = 36;
const COLONY_GRID_OFFSET = COLONY_CELL_SIZE * 0.5;
const CUPPED_CELL_SIZE = 30;
const FLOWER_TILE_CHUNKS = 3;
const FLOWER_SUN_MULTIPLIER = 1.35;
const boundaryNoise = createNoise2D(mulberry32(5519));
const ENTRANCE_COLONY: Colony = {
	x: 0,
	z: -25,
	radius: 13,
	strength: 0.96,
	variant: 'oxeye',
	phenotype: 2,
};

function createColony(cellX: number, cellZ: number): Colony | null {
	const random = mulberry32(chunkSeed(cellX, cellZ, 211));
	if (random() < 0.12) return null;
	return {
		x: (cellX + 0.12 + random() * 0.76) * COLONY_CELL_SIZE - COLONY_GRID_OFFSET,
		z: (cellZ + 0.12 + random() * 0.76) * COLONY_CELL_SIZE - COLONY_GRID_OFFSET,
		radius: 9 + random() * 6,
		strength: 0.78 + random() * 0.2,
		variant: random() < 0.54 ? 'oxeye' : 'meadow',
		phenotype: 1 + Math.floor(random() * 4),
	};
}

function findDominantColony(x: number, z: number, cache: Map<string, Colony | null>): DominantColony | null {
	const centerCellX = Math.floor((x + COLONY_GRID_OFFSET) / COLONY_CELL_SIZE);
	const centerCellZ = Math.floor((z + COLONY_GRID_OFFSET) / COLONY_CELL_SIZE);
	const entranceDistance = Math.hypot(x - ENTRANCE_COLONY.x, z - ENTRANCE_COLONY.z);
	const entranceNormalized = Math.max(0, 1 - entranceDistance / ENTRANCE_COLONY.radius);
	const entranceScore = entranceNormalized * entranceNormalized * ENTRANCE_COLONY.strength;
	let dominant: DominantColony | null = entranceScore > 0
		? { colony: ENTRANCE_COLONY, score: entranceScore }
		: null;

	for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
		for (let offsetZ = -1; offsetZ <= 1; offsetZ += 1) {
			const cellX = centerCellX + offsetX;
			const cellZ = centerCellZ + offsetZ;
			const key = `${cellX},${cellZ}`;
			if (!cache.has(key)) cache.set(key, createColony(cellX, cellZ));
			const colony = cache.get(key);
			if (!colony) continue;

			const edgeWarp = boundaryNoise(x * 0.095, z * 0.095) * 1.8;
			const distance = Math.max(0, Math.hypot(x - colony.x, z - colony.z) + edgeWarp);
			const normalized = Math.max(0, 1 - distance / colony.radius);
			const score = normalized * normalized * colony.strength;
			if (!dominant || score > dominant.score) dominant = { colony, score };
		}
	}

	return dominant;
}

function addMatrix(
	groups: Map<string, FlowerGroup>,
	variant: FieldDaisyVariant,
	phenotype: number,
	x: number,
	z: number,
	random: () => number,
	scaleRange: [number, number],
) {
	const key = `${variant}-${phenotype}`;
	if (!groups.has(key)) groups.set(key, { key, variant, phenotype, matrices: [] });
	const dummy = new THREE.Object3D();
	const scale = THREE.MathUtils.lerp(scaleRange[0], scaleRange[1], random());
	dummy.position.set(x, terrainHeight(x, z), z);
	dummy.rotation.set((random() - 0.5) * 0.07, random() * Math.PI * 2, (random() - 0.5) * 0.07);
	dummy.scale.setScalar(scale);
	dummy.updateMatrix();
	groups.get(key)?.matrices.push(dummy.matrix.clone());
}

function createFieldPopulation(
	chunks: FlowerPopulationProps['chunks'],
	candidatesPerChunk: number,
) {
	const groups = new Map<string, FlowerGroup>();
	const colonyCache = new Map<string, Colony | null>();
	const chunkKeys = new Set(chunks.map((chunk) => chunk.key));
	const gridSize = Math.ceil(Math.sqrt(candidatesPerChunk));
	const spacing = CHUNK_SIZE / gridSize;

	for (const chunk of chunks) {
		const random = mulberry32(chunkSeed(chunk.x, chunk.z, 73));
		for (let index = 0; index < candidatesPerChunk; index += 1) {
			const gridX = index % gridSize;
			const gridZ = Math.floor(index / gridSize);
			const x = chunk.x * CHUNK_SIZE - CHUNK_SIZE * 0.5 + (gridX + 0.5) * spacing + (random() - 0.5) * spacing * 0.72;
			const z = chunk.z * CHUNK_SIZE - CHUNK_SIZE * 0.5 + (gridZ + 0.5) * spacing + (random() - 0.5) * spacing * 0.72;
			const dominant = findDominantColony(x, z, colonyCache);
			if (!dominant || random() > Math.min(0.88, dominant.score * 1.9)) continue;
			addMatrix(groups, dominant.colony.variant, dominant.colony.phenotype, x, z, random, [0.9, 1.22]);
		}
	}

	const minX = Math.min(...chunks.map((chunk) => chunk.x * CHUNK_SIZE - CHUNK_SIZE * 0.5));
	const maxX = Math.max(...chunks.map((chunk) => chunk.x * CHUNK_SIZE + CHUNK_SIZE * 0.5));
	const minZ = Math.min(...chunks.map((chunk) => chunk.z * CHUNK_SIZE - CHUNK_SIZE * 0.5));
	const maxZ = Math.max(...chunks.map((chunk) => chunk.z * CHUNK_SIZE + CHUNK_SIZE * 0.5));
	const minCellX = Math.floor(minX / CUPPED_CELL_SIZE);
	const maxCellX = Math.floor(maxX / CUPPED_CELL_SIZE);
	const minCellZ = Math.floor(minZ / CUPPED_CELL_SIZE);
	const maxCellZ = Math.floor(maxZ / CUPPED_CELL_SIZE);

	for (let cellX = minCellX; cellX <= maxCellX; cellX += 1) {
		for (let cellZ = minCellZ; cellZ <= maxCellZ; cellZ += 1) {
			const random = mulberry32(chunkSeed(cellX, cellZ, 397));
			if (random() > 0.5) continue;
			const x = (cellX + 0.5) * CUPPED_CELL_SIZE + (random() - 0.5) * 8;
			const z = (cellZ + 0.5) * CUPPED_CELL_SIZE + (random() - 0.5) * 8;
			if (x < minX || x > maxX || z < minZ || z > maxZ) continue;
			if (!chunkKeys.has(`${Math.round(x / CHUNK_SIZE)},${Math.round(z / CHUNK_SIZE)}`)) continue;
			const dominant = findDominantColony(x, z, colonyCache);
			if (dominant && dominant.score >= 0.025) continue;
			addMatrix(groups, 'cupped', 1 + Math.floor(random() * 4), x, z, random, [0.88, 1.06]);
		}
	}

	return Array.from(groups.values());
}

function flowerTileCoordinate(chunkCoordinate: number) {
	return Math.floor((chunkCoordinate + 1) / FLOWER_TILE_CHUNKS);
}

function flowerTileKey(chunkX: number, chunkZ: number) {
	return `${flowerTileCoordinate(chunkX)},${flowerTileCoordinate(chunkZ)}`;
}

class FlowerTileCache {
	private readonly tiles = new Map<string, FlowerTile>();
	private readonly candidatesPerChunk: number;

	constructor(candidatesPerChunk: number) {
		this.candidatesPerChunk = candidatesPerChunk;
	}

	build(
		chunks: FlowerPopulationProps['chunks'],
	): CachedFlowerPopulation {
		const activeTileKeys = new Set<string>();
		let flowerChunksGenerated = 0;

		for (let index = 0; index < chunks.length; index += 1) {
			const chunk = chunks[index];
			const tileKey = flowerTileKey(chunk.x, chunk.z);
			activeTileKeys.add(tileKey);
			let tile = this.tiles.get(tileKey);
			if (!tile) {
				tile = { chunkGroups: new Map() };
				this.tiles.set(tileKey, tile);
			}
			if (!tile.chunkGroups.has(chunk.key)) {
				tile.chunkGroups.set(chunk.key, createFieldPopulation([chunk], this.candidatesPerChunk));
				flowerChunksGenerated += 1;
			}
		}

		for (const key of this.tiles.keys()) {
			if (!activeTileKeys.has(key)) this.tiles.delete(key);
		}

		const combinedGroups = new Map<string, FlowerGroup>();
		let flowerInstances = 0;
		for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex += 1) {
			const chunk = chunks[chunkIndex];
			const tile = this.tiles.get(flowerTileKey(chunk.x, chunk.z));
			const groups = tile?.chunkGroups.get(chunk.key);
			if (!groups) continue;
			for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
				const sourceGroup = groups[groupIndex];
				let combinedGroup = combinedGroups.get(sourceGroup.key);
				if (!combinedGroup) {
					combinedGroup = {
						key: sourceGroup.key,
						variant: sourceGroup.variant,
						phenotype: sourceGroup.phenotype,
						matrices: [],
					};
					combinedGroups.set(sourceGroup.key, combinedGroup);
				}
				for (let matrixIndex = 0; matrixIndex < sourceGroup.matrices.length; matrixIndex += 1) {
					combinedGroup.matrices.push(sourceGroup.matrices[matrixIndex]);
					flowerInstances += 1;
				}
			}
		}

		return {
			groups: Array.from(combinedGroups.values()),
			flowerInstances,
			flowerTiles: this.tiles.size,
			flowerChunksGenerated,
		};
	}
}

function FlowerInstances({ group, geometry, material, population, matrixTimingRef, diagnosticsRef }: {
	group: FlowerGroup;
	geometry: THREE.BufferGeometry;
	material: THREE.ShaderMaterial;
	population: FlowerGroup[];
	matrixTimingRef: RefObject<MatrixBuildTiming>;
	diagnosticsRef: RefObject<FlowerFieldDiagnosticValues>;
}) {
	const instanceRef = useRef<THREE.InstancedMesh>(null);

	useLayoutEffect(() => {
		const mesh = instanceRef.current;
		if (!mesh) return;
		const startedAt = performance.now();
		mesh.count = group.matrices.length;
		geometry.setAttribute('aBloomStart', new THREE.InstancedBufferAttribute(
			new Float32Array(group.matrices.length).fill(-ROSE_BLOOM_DURATION),
			1,
		));
		for (let index = 0; index < group.matrices.length; index += 1) mesh.setMatrixAt(index, group.matrices[index]);
		mesh.instanceMatrix.needsUpdate = true;
		const matrixTiming = matrixTimingRef.current;
		if (matrixTiming.population !== population) {
			matrixTiming.population = population;
			matrixTiming.totalMs = 0;
			matrixTiming.completedBatches = 0;
			matrixTiming.expectedBatches = population.length;
		}
		matrixTiming.totalMs += performance.now() - startedAt;
		matrixTiming.completedBatches += 1;
		if (matrixTiming.completedBatches === matrixTiming.expectedBatches) {
			diagnosticsRef.current.flowerMatrixMs = matrixTiming.totalMs;
		}
	}, [diagnosticsRef, geometry, group.matrices, matrixTimingRef, population]);

	return (
		<instancedMesh
			ref={instanceRef}
			args={[geometry, material, group.matrices.length]}
			frustumCulled={false}
			castShadow
			receiveShadow
			dispose={null}
		/>
	);
}

function PlantedRoseInstances({ roses, variant, geometry, material }: {
	roses: PlantedRose[];
	variant: PlantableRoseVariant;
	geometry: THREE.BufferGeometry;
	material: THREE.ShaderMaterial;
}) {
	const instanceRef = useRef<THREE.InstancedMesh>(null);
	const instances = useMemo(() => {
		const dummy = new THREE.Object3D();
		return roses
			.filter((rose) => rose.variant === variant)
			.map((rose) => {
				dummy.position.set(rose.x, terrainHeight(rose.x, rose.z), rose.z);
				dummy.rotation.set(0, rose.rotation, 0);
				dummy.updateMatrix();
				return { matrix: dummy.matrix.clone(), plantedAt: rose.plantedAt };
			});
	}, [roses, variant]);

	useLayoutEffect(() => {
		const mesh = instanceRef.current;
		if (!mesh) return;
		mesh.count = instances.length;
		geometry.setAttribute('aBloomStart', new THREE.InstancedBufferAttribute(
			new Float32Array(instances.map((instance) => instance.plantedAt)),
			1,
		));
		for (let index = 0; index < instances.length; index += 1) mesh.setMatrixAt(index, instances[index].matrix);
		mesh.instanceMatrix.needsUpdate = true;
	}, [geometry, instances]);

	if (instances.length === 0) return null;
	return (
		<instancedMesh
			ref={instanceRef}
			args={[geometry, material, instances.length]}
			frustumCulled={false}
			castShadow
			receiveShadow
			dispose={null}
		/>
	);
}

export default function FlowerPopulation({
	chunks,
	candidatesPerChunk,
	noiseTexture,
	sunDirection,
	skyColor,
	sunColor,
	sunStrength,
	windSpeed,
	windStrength,
	windDirection,
	windScale,
	cursorWindRef,
	diagnosticsRef,
	plantedRoses,
}: FlowerPopulationProps) {
	const geometries = useMemo(() => {
		const generated = new Map<string, THREE.BufferGeometry>();
		for (const variant of ['oxeye', 'meadow', 'cupped'] as const) {
			for (let phenotype = 1; phenotype <= 4; phenotype += 1) {
				const geometry = createDaisyGeometry(variant, phenotype);
				geometry.setAttribute('aBudPosition', geometry.getAttribute('position').clone());
				generated.set(`${variant}-${phenotype}`, geometry);
			}
		}
		for (const variant of PLANTABLE_ROSE_VARIANTS) {
			generated.set(`rose-${variant}`, createFieldRoseGeometry(variant));
		}
		return generated;
	}, []);
	const material = useMemo(() => new THREE.ShaderMaterial({
		uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.lights, {
			uTime: { value: 0 },
			uNoiseTexture: { value: noiseTexture },
			uWindScale: { value: windScale },
			uWindStrength: { value: windStrength },
			uWindSpeed: { value: windSpeed },
			uWindDirection: { value: windDirection },
			uCursorWindPosition: { value: new THREE.Vector2(10000, 10000) },
			uCursorWindTrailPosition: { value: new THREE.Vector2(10000, 10000) },
			uCursorWindDirection: { value: new THREE.Vector2(1, 0) },
			uCursorWindStrength: { value: 0 },
			uCursorWindRadius: { value: 8 },
			uStemHeight: { value: DAISY_STEM_HEIGHT },
			uRoseBloomDuration: { value: ROSE_BLOOM_DURATION },
			uRoseBloomStart: { value: ROSE_BLOOM_START },
			uRoseStemDuration: { value: ROSE_STEM_DURATION },
			uCircleCenter: { value: new THREE.Vector3() },
			uCurvatureRadius: { value: FIELD_CURVATURE_RADIUS },
			uCurvatureStart: { value: FIELD_CURVATURE_START },
			uSunDirection: { value: sunDirection.clone() },
			uSunColor: { value: new THREE.Color(sunColor) },
			uSkyLightColor: { value: new THREE.Color(skyColor).lerp(new THREE.Color('#ffffff'), 0.55) },
			uSunStrength: { value: sunStrength * FLOWER_SUN_MULTIPLIER },
		}]),
		vertexShader: flowerVertexShader,
		fragmentShader: flowerFragmentShader,
		side: THREE.DoubleSide,
		lights: true,
	}), [noiseTexture, skyColor, sunColor, sunDirection, sunStrength, windDirection, windScale, windSpeed, windStrength]);
	const tileCache = useMemo(() => new FlowerTileCache(candidatesPerChunk), [candidatesPerChunk]);
	const population = useMemo(() => {
		// Diagnostics intentionally sample the wall time of this deterministic rebuild.
		// eslint-disable-next-line react-hooks/purity
		const startedAt = performance.now();
		const cachedPopulation = tileCache.build(chunks);
		return {
			...cachedPopulation,
			// eslint-disable-next-line react-hooks/purity
			generationMs: performance.now() - startedAt,
		};
	},
		[chunks, tileCache],
	);
	const matrixTimingRef = useRef<MatrixBuildTiming>({
		population: null,
		totalMs: 0,
		completedBatches: 0,
		expectedBatches: 0,
	});

	useLayoutEffect(() => {
		const diagnostics = diagnosticsRef.current;
		diagnostics.flowerInstances = population.flowerInstances;
		diagnostics.flowerBatches = population.groups.length;
		diagnostics.flowerTiles = population.flowerTiles;
		diagnostics.flowerChunksGenerated = population.flowerChunksGenerated;
		diagnostics.flowerGenerationMs = population.generationMs;
		if (population.groups.length === 0) diagnostics.flowerMatrixMs = 0;
	}, [diagnosticsRef, population]);

	useFrame(({ camera, clock }) => {
		const cursorWind = cursorWindRef.current;
		// All phenotype batches share one material, clock and wind field.
		// eslint-disable-next-line react-hooks/immutability
		material.uniforms.uTime.value = clock.elapsedTime;
		material.uniforms.uCursorWindPosition.value.copy(cursorWind.position);
		material.uniforms.uCursorWindTrailPosition.value.copy(cursorWind.trailPosition);
		material.uniforms.uCursorWindDirection.value.copy(cursorWind.direction);
		material.uniforms.uCursorWindStrength.value = cursorWind.strength;
		material.uniforms.uCursorWindRadius.value = cursorWind.radius;
		material.uniforms.uCircleCenter.value.set(camera.position.x, 0, camera.position.z);
	});

	useEffect(() => () => {
		geometries.forEach((geometry) => geometry.dispose());
		material.dispose();
	}, [geometries, material]);

	return (
		<>
			{population.groups.map((group) => {
				const geometry = geometries.get(group.key);
				if (!geometry) return null;
				return (
					<FlowerInstances
						key={group.key}
						group={group}
						geometry={geometry}
						material={material}
						population={population.groups}
						matrixTimingRef={matrixTimingRef}
						diagnosticsRef={diagnosticsRef}
					/>
				);
			})}
			{PLANTABLE_ROSE_VARIANTS.map((variant) => {
				const geometry = geometries.get(`rose-${variant}`);
				if (!geometry) return null;
				return (
					<PlantedRoseInstances
						key={variant}
						roses={plantedRoses}
						variant={variant}
						geometry={geometry}
						material={material}
					/>
				);
			})}
		</>
	);
}
