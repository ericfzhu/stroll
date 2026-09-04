import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface StylizedCloudsProps {
	cloudCover: number;
}

interface CloudPuff {
	cluster: number;
	distance: number;
	x: number;
	y: number;
	z: number;
	scaleX: number;
	scaleY: number;
	scaleZ: number;
	rotation: number;
	color: THREE.Color;
}

const CLOUD_CLUSTER_COUNT = 18;
const CLOUD_NEAR_DISTANCE = 30;
const CLOUD_DISTANCE_SPAN = 130;
const CLOUD_COLORS = ['#f4f2e9', '#e8e8e2', '#dce0df', '#f0ede5'];

function seededRandom(seed: number) {
	let value = seed >>> 0;
	return () => {
		value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
		return value / 0x100000000;
	};
}

function createCloudPuffs() {
	const random = seededRandom(0x8a7f31d2);
	const puffs: CloudPuff[] = [];
	const clusterEnds: number[] = [];
	const goldenRatioConjugate = 0.61803398875;

	for (let cluster = 0; cluster < CLOUD_CLUSTER_COUNT; cluster += 1) {
		const distancePhase = (cluster * goldenRatioConjugate) % 1;
		const distance = CLOUD_NEAR_DISTANCE + distancePhase * CLOUD_DISTANCE_SPAN;
		const x = (random() - 0.5) * distance * 1.35;
		const y = 10.5 + random() * 7.5;
		const puffCount = 7 + Math.floor(random() * 5);
		const clusterWidth = 9 + random() * 13;
		const clusterDepth = 4 + random() * 7;

		for (let puff = 0; puff < puffCount; puff += 1) {
			const centerBias = puff === 0 ? 0 : Math.pow(random(), 0.72);
			const angle = random() * Math.PI * 2;
			const edgeScale = 1 - centerBias * 0.42;
			const size = (2.8 + random() * 3.1) * edgeScale;
			puffs.push({
				cluster,
				distance,
				x: x + Math.cos(angle) * centerBias * clusterWidth,
				y: y + (random() - 0.38) * 3.8 + (puff === 0 ? 1.4 : 0),
				z: Math.sin(angle) * centerBias * clusterDepth,
				scaleX: size * (1.2 + random() * 0.65),
				scaleY: size * (0.46 + random() * 0.25),
				scaleZ: size * (0.9 + random() * 0.5),
				rotation: random() * Math.PI,
				color: new THREE.Color(CLOUD_COLORS[Math.floor(random() * CLOUD_COLORS.length)]),
			});
		}
		clusterEnds.push(puffs.length);
	}

	return { puffs, clusterEnds };
}

export default function StylizedClouds({ cloudCover }: StylizedCloudsProps) {
	const meshRef = useRef<THREE.InstancedMesh>(null);
	const dummy = useMemo(() => new THREE.Object3D(), []);
	const { puffs, clusterEnds } = useMemo(createCloudPuffs, []);
	const visibleClusters = cloudCover <= 0
		? 0
		: THREE.MathUtils.clamp(Math.ceil(CLOUD_CLUSTER_COUNT * cloudCover / 100), 1, CLOUD_CLUSTER_COUNT);
	const visiblePuffCount = visibleClusters === 0 ? 0 : clusterEnds[visibleClusters - 1];

	useEffect(() => {
		const mesh = meshRef.current;
		if (!mesh) return;
		for (let index = 0; index < puffs.length; index += 1) {
			mesh.setColorAt(index, puffs[index].color);
		}
		if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
	}, [puffs]);

	useFrame(({ camera }) => {
		const mesh = meshRef.current;
		if (!mesh || visiblePuffCount === 0) return;
		const cameraTravel = -camera.position.z;

		for (let index = 0; index < visiblePuffCount; index += 1) {
			const puff = puffs[index];
			const distanceAhead = CLOUD_NEAR_DISTANCE + THREE.MathUtils.euclideanModulo(
				puff.distance - cameraTravel - CLOUD_NEAR_DISTANCE,
				CLOUD_DISTANCE_SPAN,
			);
			dummy.position.set(
				camera.position.x + puff.x,
				puff.y,
				camera.position.z - distanceAhead + puff.z,
			);
			dummy.rotation.set(0, puff.rotation, 0);
			dummy.scale.set(puff.scaleX, puff.scaleY, puff.scaleZ);
			dummy.updateMatrix();
			mesh.setMatrixAt(index, dummy.matrix);
		}

		mesh.count = visiblePuffCount;
		mesh.instanceMatrix.needsUpdate = true;
	});

	if (visiblePuffCount === 0) return null;
	return (
		<instancedMesh
			ref={meshRef}
			args={[undefined, undefined, puffs.length]}
			count={visiblePuffCount}
			frustumCulled={false}
		>
			<icosahedronGeometry args={[1, 1]} />
			<meshStandardMaterial
				color="#ffffff"
				vertexColors
				flatShading
				roughness={1}
				metalness={0}
				emissive="#d4d6d1"
				emissiveIntensity={0.4}
			/>
		</instancedMesh>
	);
}
