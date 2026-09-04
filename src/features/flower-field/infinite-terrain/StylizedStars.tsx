import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface StylizedStarsProps {
	visibility: number;
}

const STAR_COUNT = 1500;
const STAR_RADIUS = 145;

const STAR_VERTEX_SHADER = `
	uniform float uTime;
	uniform float uVisibility;
	attribute float aSize;
	attribute float aPhase;
	attribute float aTwinkleSpeed;
	varying vec3 vColor;
	varying float vOpacity;

	void main() {
		float pulse = sin(uTime * aTwinkleSpeed + aPhase);
		vColor = color;
		vOpacity = uVisibility * (0.82 + pulse * 0.12);
		vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
		gl_PointSize = aSize * (1.0 + pulse * 0.08);
		gl_Position = projectionMatrix * viewPosition;
	}
`;

const STAR_FRAGMENT_SHADER = `
	varying vec3 vColor;
	varying float vOpacity;

	void main() {
		float distanceFromCenter = distance(gl_PointCoord, vec2(0.5));
		float softDisc = 1.0 - smoothstep(0.12, 0.5, distanceFromCenter);
		float brightCore = 1.0 - smoothstep(0.0, 0.15, distanceFromCenter);
		float opacity = (softDisc * 0.72 + brightCore * 0.28) * vOpacity;
		if (opacity < 0.01) discard;
		gl_FragColor = vec4(vColor, opacity);
		#include <tonemapping_fragment>
		#include <colorspace_fragment>
	}
`;

function seededRandom(seed: number) {
	let value = seed >>> 0;
	return () => {
		value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
		return value / 0x100000000;
	};
}

function createStarGeometry() {
	const random = seededRandom(0x5f3759df);
	const positions = new Float32Array(STAR_COUNT * 3);
	const colors = new Float32Array(STAR_COUNT * 3);
	const sizes = new Float32Array(STAR_COUNT);
	const phases = new Float32Array(STAR_COUNT);
	const twinkleSpeeds = new Float32Array(STAR_COUNT);
	const coolWhite = new THREE.Color('#dbe9f4');
	const warmWhite = new THREE.Color('#fff0cf');
	const color = new THREE.Color();

	for (let index = 0; index < STAR_COUNT; index += 1) {
		const angle = random() * Math.PI * 2;
		const heightSample = random();
		const y = index % 2 === 0
			? 0.02 + Math.pow(heightSample, 2.6) * 0.32
			: 0.04 + heightSample * 0.94;
		const horizontalRadius = Math.sqrt(1 - y * y) * STAR_RADIUS;
		positions[index * 3] = Math.cos(angle) * horizontalRadius;
		positions[index * 3 + 1] = y * STAR_RADIUS;
		positions[index * 3 + 2] = Math.sin(angle) * horizontalRadius;

		color.copy(coolWhite).lerp(warmWhite, random() * 0.42);
		const brightness = 0.72 + random() * 0.28;
		colors[index * 3] = color.r * brightness;
		colors[index * 3 + 1] = color.g * brightness;
		colors[index * 3 + 2] = color.b * brightness;
		sizes[index] = 1.05 + Math.pow(random(), 3.2) * 2.35;
		phases[index] = random() * Math.PI * 2;
		twinkleSpeeds[index] = 0.28 + random() * 0.55;
	}

	const geometry = new THREE.BufferGeometry();
	geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
	geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
	geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
	geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
	geometry.setAttribute('aTwinkleSpeed', new THREE.BufferAttribute(twinkleSpeeds, 1));
	return geometry;
}

export default function StylizedStars({ visibility }: StylizedStarsProps) {
	const pointsRef = useRef<THREE.Points>(null);
	const geometry = useMemo(createStarGeometry, []);
	const material = useMemo(() => new THREE.ShaderMaterial({
		uniforms: {
			uTime: { value: 0 },
			uVisibility: { value: 0 },
		},
		vertexShader: STAR_VERTEX_SHADER,
		fragmentShader: STAR_FRAGMENT_SHADER,
		blending: THREE.AdditiveBlending,
		transparent: true,
		depthWrite: false,
		vertexColors: true,
		toneMapped: false,
	}), []);

	useEffect(() => {
		material.uniforms.uVisibility.value = visibility;
	}, [material, visibility]);
	useEffect(() => () => {
		geometry.dispose();
		material.dispose();
	}, [geometry, material]);

	useFrame(({ camera, clock }) => {
		const points = pointsRef.current;
		if (!points) return;
		points.position.copy(camera.position);
		material.uniforms.uTime.value = clock.elapsedTime;
	});

	if (visibility <= 0.01) return null;
	return (
		<points
			ref={pointsRef}
			geometry={geometry}
			material={material}
			frustumCulled={false}
			renderOrder={1}
		/>
	);
}
