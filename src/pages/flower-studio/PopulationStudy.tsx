import { Canvas, useThree } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { createDaisyGeometry, type DaisyVariantId } from '../../field/flowerGeometry';

type PopulationVariant = Extract<DaisyVariantId, 'oxeye' | 'meadow' | 'cupped'>;

interface Colony {
	x: number;
	z: number;
	radius: number;
	strength: number;
	variant: PopulationVariant;
	phenotype: number;
}

interface Plant {
	position: [number, number, number];
	rotation: [number, number, number];
	scale: number;
}

interface PopulationGroup {
	key: string;
	variant: PopulationVariant;
	phenotype: number;
	plants: Plant[];
}

const FIELD_SEED = 4107;

function mulberry32(seed: number) {
	return () => {
		let value = seed += 0x6D2B79F5;
		value = Math.imul(value ^ value >>> 15, value | 1);
		value ^= value + Math.imul(value ^ value >>> 7, value | 61);
		return ((value ^ value >>> 14) >>> 0) / 4294967296;
	};
}

function createColonies(random: () => number): Colony[] {
	const variants: PopulationVariant[] = ['oxeye', 'meadow', 'oxeye', 'meadow', 'oxeye', 'meadow'];
	return variants.map((variant, index) => ({
		x: (random() - 0.5) * 9.2,
		z: (random() - 0.5) * 5.3,
		radius: 1.65 + random() * 0.8,
		strength: 0.78 + random() * 0.18,
		variant,
		phenotype: index % 4 + 1,
	}));
}

function createPopulation() {
	const random = mulberry32(FIELD_SEED);
	const colonies = createColonies(random);
	const groups = new Map<string, PopulationGroup>();
	const spacing = 0.36;
	const colonySuitability = (x: number, z: number) => colonies.reduce((highest, colony) => {
		const distance = Math.hypot(x - colony.x, z - colony.z);
		const normalized = Math.max(0, 1 - distance / colony.radius);
		return Math.max(highest, normalized * normalized * colony.strength);
	}, 0);

	for (let gridZ = -3.3; gridZ <= 3.3; gridZ += spacing) {
		for (let gridX = -5.5; gridX <= 5.5; gridX += spacing) {
			const x = gridX + (random() - 0.5) * spacing * 0.65;
			const z = gridZ + (random() - 0.5) * spacing * 0.65;
			let dominant: Colony | null = null;
			let suitability = 0;

			for (const colony of colonies) {
				const distance = Math.hypot(x - colony.x, z - colony.z);
				const normalized = Math.max(0, 1 - distance / colony.radius);
				const score = normalized * normalized * colony.strength;
				if (score > suitability) {
					suitability = score;
					dominant = colony;
				}
			}

			if (!dominant || random() > suitability * 1.7) continue;
			const key = `${dominant.variant}-${dominant.phenotype}`;
			if (!groups.has(key)) groups.set(key, {
				key,
				variant: dominant.variant,
				phenotype: dominant.phenotype,
				plants: [],
			});
			groups.get(key)?.plants.push({
				position: [x, 0, z],
				rotation: [(random() - 0.5) * 0.055, random() * Math.PI * 2, (random() - 0.5) * 0.055],
				scale: 0.58 + random() * 0.32,
			});
		}
	}

	const isolatedCupped: Plant[] = [];
	for (let attempt = 0; attempt < 180 && isolatedCupped.length < 4; attempt += 1) {
		const x = (random() - 0.5) * 10.4;
		const z = (random() - 0.5) * 6.2;
		const clearOfColonies = colonySuitability(x, z) < 0.035;
		const clearOfOtherCupped = isolatedCupped.every((plant) => Math.hypot(x - plant.position[0], z - plant.position[2]) > 2.5);
		if (!clearOfColonies || !clearOfOtherCupped) continue;
		isolatedCupped.push({
			position: [x, 0, z],
			rotation: [(random() - 0.5) * 0.04, random() * Math.PI * 2, (random() - 0.5) * 0.04],
			scale: 0.66 + random() * 0.2,
		});
	}
	if (isolatedCupped.length > 0) groups.set('cupped-isolated', {
		key: 'cupped-isolated',
		variant: 'cupped',
		phenotype: 2,
		plants: isolatedCupped,
	});

	return Array.from(groups.values());
}

function PopulationInstances({ group }: { group: PopulationGroup }) {
	const meshRef = useRef<THREE.InstancedMesh>(null);
	const geometry = useMemo(() => createDaisyGeometry(group.variant, group.phenotype), [group.phenotype, group.variant]);

	useLayoutEffect(() => {
		const mesh = meshRef.current;
		if (!mesh) return;
		const dummy = new THREE.Object3D();
		group.plants.forEach((plant, index) => {
			dummy.position.set(...plant.position);
			dummy.rotation.set(...plant.rotation);
			dummy.scale.setScalar(plant.scale);
			dummy.updateMatrix();
			mesh.setMatrixAt(index, dummy.matrix);
		});
		mesh.instanceMatrix.needsUpdate = true;
		return () => geometry.dispose();
	}, [geometry, group.plants]);

	return (
		<instancedMesh ref={meshRef} args={[geometry, undefined, group.plants.length]} frustumCulled={false}>
			<meshStandardMaterial vertexColors side={THREE.DoubleSide} roughness={0.9} flatShading />
		</instancedMesh>
	);
}

function PopulationCamera() {
	const { camera } = useThree();
	useLayoutEffect(() => {
		camera.position.set(0, 6.2, 8.8);
		camera.lookAt(0, 0.65, -0.25);
		camera.updateProjectionMatrix();
	}, [camera]);
	return null;
}

function PopulationScene() {
	const groups = useMemo(() => createPopulation(), []);
	return (
		<>
			<PopulationCamera />
			<color attach="background" args={['#d5d5cb']} />
			<fog attach="fog" args={['#d5d5cb', 8, 16]} />
			<ambientLight intensity={1.1} />
			<hemisphereLight args={['#ffffff', '#65704b', 1.4]} />
			<directionalLight position={[4, 7, 4]} intensity={1.8} />
			<mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.012, 0]}>
				<planeGeometry args={[13, 8.2]} />
				<meshStandardMaterial color="#7e9455" roughness={1} />
			</mesh>
			{groups.map((group) => <PopulationInstances key={group.key} group={group} />)}
		</>
	);
}

export default function PopulationStudy() {
	return (
		<div className="flower-population-canvas" aria-label="Seeded colonies of ox-eye and meadow irregular daisies with isolated cupped garden daisies">
			<Canvas dpr={[1, 1.5]} camera={{ fov: 38, near: 0.1, far: 30 }} gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}>
				<PopulationScene />
			</Canvas>
		</div>
	);
}
