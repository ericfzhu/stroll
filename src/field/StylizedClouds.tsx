/* eslint-disable react/immutability -- Three.js shader uniforms are updated imperatively in effects and the render loop. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { cloudShape, type CloudShapeOverrides } from './cloudShape';
import type { FlowerFieldWeatherState } from './weatherAtmosphere';

interface StylizedCloudsProps {
	cloudCover: number;
	shapeOverrides?: CloudShapeOverrides;
	weatherState: FlowerFieldWeatherState;
	sunDirection: THREE.Vector3;
	lightColor: string;
	skyColor: string;
	horizonColor: string;
	windSpeed: number;
	windDirection: number;
}

// A small, deterministic, repeating volume. Hardware interpolation keeps the
// density lookup cheap; smooth interpolation below removes grid-shaped edges.
function createDensityTexture() {
	const size = 32;
	const data = new Uint8Array(size ** 3);
	let seed = 0x8a7f31d2;
	for (let i = 0; i < data.length; i += 1) {
		seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
		data[i] = seed >>> 24;
	}
	const texture = new THREE.Data3DTexture(data, size, size, size);
	texture.format = THREE.RedFormat;
	texture.minFilter = texture.magFilter = THREE.LinearFilter;
	texture.wrapS = texture.wrapT = texture.wrapR = THREE.RepeatWrapping;
	texture.unpackAlignment = 1;
	texture.needsUpdate = true;
	return texture;
}

const fragmentShader = `
	precision highp sampler3D;
	uniform sampler3D uNoise;
	uniform float uCover;
	uniform float uBaseVariation;
	uniform float uTowers;
	uniform vec4 uShape; // base, depth, horizontal scale, overcast blend
	uniform vec2 uWindOffset;
	uniform vec3 uSunDirection;
	uniform vec3 uLight;
	uniform vec3 uShade;
	uniform vec3 uHorizon;
	varying vec3 vDirection;

	float noise3(vec3 p) {
		vec3 f = fract(p);
		f = f * f * (3.0 - 2.0 * f);
		return texture(uNoise, (floor(p) + f + 0.5) / 32.0).r;
	}

	float densityAt(vec3 p) {
		if (p.y < uShape.x - 4.0 * uBaseVariation || p.y > uShape.x + uShape.y + 32.0 * uTowers + 4.0 * uBaseVariation) return 0.0;
		p.xz += uWindOffset;
		// Broad footprints persist vertically, while the second noise carves lobes.
		// Both families use the same two texture lookups and deterministic field.
		float footprint = noise3(vec3(p.xz * uShape.z, 4.7));
		float lobes = noise3(p * vec3(0.16, 0.11, 0.16) + vec3(7.1, 3.4, 12.0));
		// Reuse the shape noise for gently uneven bases, with smaller scallops.
		// The whole cluster shifts together; this is not a horizontal clipping plane.
		float baseOffset = (footprint - 0.5) * mix(6.0, 3.5, uShape.w)
			+ (lobes - 0.5) * 1.2;
		float h = (p.y - uShape.x - baseOffset * uBaseVariation) / uShape.y;
		if (h <= 0.0) return 0.0;
		float base = smoothstep(0.0, mix(0.12, 0.2, uShape.w), h);
		// Narrow toward the top: rounded heaps above a shared, flatter base.
		float crown = smoothstep(0.18, 1.0, h);
		float threshold = mix(0.72, 0.26, uCover);
		float cumulus = footprint + (lobes - 0.5) * 0.3 - crown * 0.32;
		// A shallower layer connects the masses without losing underside texture.
		float deck = footprint + (lobes - 0.5) * 0.13 - crown * 0.09;
		float shape = mix(cumulus, deck, uShape.w);
		float top = 1.0 - smoothstep(0.75, 1.0, h);
		float layer = smoothstep(threshold, threshold + 0.1, shape) * base * top;
		// Selected broad footprints grow above the deck, rather than stretching
		// the whole sky into a thick slab. Reuse the two existing noise samples.
		float towerH = (p.y - uShape.x - baseOffset * uBaseVariation) / (uShape.y + 32.0 * uTowers);
		float towerTop = 1.0 - smoothstep(0.72, 1.0, towerH);
		float towerCrown = smoothstep(0.5, 1.0, towerH) * 0.18;
		float towerShape = footprint + (lobes - 0.5) * 0.24 - towerCrown;
		float towers = smoothstep(0.51, 0.65, towerShape) * base * towerTop;
		return max(layer, towers * uTowers) * smoothstep(0.0, 0.12, uCover);
	}

	void main() {
		vec3 ray = normalize(vDirection);
		if (abs(ray.y) < 0.0001) discard;
		vec2 bounds = (vec2(uShape.x - 4.0 * uBaseVariation, uShape.x + uShape.y + 32.0 * uTowers + 4.0 * uBaseVariation) - cameraPosition.y) / ray.y;
		float nearT = max(0.0, min(bounds.x, bounds.y));
		float farT = min(155.0, max(bounds.x, bounds.y));
		if (farT <= nearT) discard;
		float stepSize = (farT - nearT) / 40.0;
		// Stable screen-space jitter breaks up ray-step bands without extra samples.
		float sampleOffset = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
		float transmission = 1.0;
		vec3 lightSum = vec3(0.0);
		float sunAmount = smoothstep(-0.12, 0.22, uSunDirection.y);
		float rim = pow(max(dot(ray, uSunDirection), 0.0), 6.0) * 0.16 * sunAmount;
		for (int i = 0; i < 40; i++) {
			float t = nearT + (float(i) + sampleOffset) * stepSize;
			vec3 p = cameraPosition + ray * t;
			float density = densityAt(p);
			if (density > 0.001) {
				// Two coarse sunward samples give soft internal shadows.
				float shadow = densityAt(p + uSunDirection * 3.0) * 0.7
					+ densityAt(p + uSunDirection * 7.0) * 0.3;
				float illumination = exp(-shadow * mix(1.8, 2.8, uTowers));
				vec3 color = mix(uShade, uLight, 0.25 + illumination * 0.65);
				color += uLight * rim * (1.0 - density);
				color = mix(color, uHorizon, smoothstep(70.0, 155.0, t) * 0.65);
				float alpha = 1.0 - exp(-density * stepSize * 0.32);
				alpha *= 1.0 - smoothstep(125.0, 155.0, t);
				lightSum += transmission * alpha * color;
				transmission *= 1.0 - alpha;
				if (transmission < 0.025) break;
			}
		}
		float alpha = 1.0 - transmission;
		if (alpha < 0.002) discard;
		gl_FragColor = vec4(lightSum / alpha, alpha);
		#include <tonemapping_fragment>
		#include <colorspace_fragment>
	}
`;

export default function StylizedClouds({ cloudCover, shapeOverrides, weatherState, sunDirection, lightColor, skyColor, horizonColor, windSpeed, windDirection }: StylizedCloudsProps) {
	const meshRef = useRef<THREE.Mesh>(null);
	const target = useMemo(() => ({ ...cloudShape(cloudCover, weatherState), ...shapeOverrides }), [cloudCover, weatherState, shapeOverrides]);
	const [initialShape] = useState(() => target);
	const targetRef = useRef(target);
	useEffect(() => { targetRef.current = target; }, [target]);
	const densityTexture = useMemo(() => createDensityTexture(), []);
	const material = useMemo(() => new THREE.ShaderMaterial({
		uniforms: {
			uNoise: { value: densityTexture },
			uCover: { value: initialShape.cover },
			uBaseVariation: { value: initialShape.baseVariation },
			uTowers: { value: initialShape.towers },
			uShape: { value: new THREE.Vector4(initialShape.base, initialShape.depth, initialShape.scale, initialShape.overcast) },
			uWindOffset: { value: new THREE.Vector2() },
			uSunDirection: { value: new THREE.Vector3() },
			uLight: { value: new THREE.Color() },
			uShade: { value: new THREE.Color() },
			uHorizon: { value: new THREE.Color() },
		},
		vertexShader: `
			varying vec3 vDirection;
			void main() {
				vDirection = position;
				gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
			}
		`,
		fragmentShader,
		transparent: true,
		depthWrite: false,
		side: THREE.BackSide,
	}), [densityTexture, initialShape]);

	useEffect(() => {
		material.uniforms.uSunDirection.value.copy(sunDirection).normalize();
		material.uniforms.uLight.value.set(lightColor);
		material.uniforms.uShade.value.set(horizonColor).lerp(new THREE.Color(skyColor), 0.3).multiplyScalar(0.65);
		material.uniforms.uHorizon.value.set(horizonColor);
	}, [cloudCover, horizonColor, material, skyColor, lightColor, sunDirection]);

	useEffect(() => () => {
		material.dispose();
		densityTexture.dispose();
	}, [densityTexture, material]);

	useFrame(({ camera }, delta) => {
		meshRef.current?.position.copy(camera.position);
		const blend = 1 - Math.exp(-Math.min(delta, 0.1) * 1.5);
		const next = targetRef.current;
		material.uniforms.uTowers.value = THREE.MathUtils.lerp(material.uniforms.uTowers.value, next.towers, blend);
		material.uniforms.uBaseVariation.value = THREE.MathUtils.lerp(material.uniforms.uBaseVariation.value, next.baseVariation, blend);
		material.uniforms.uCover.value = THREE.MathUtils.lerp(material.uniforms.uCover.value, next.cover, blend);
		const shape = material.uniforms.uShape.value as THREE.Vector4;
		shape.x = THREE.MathUtils.lerp(shape.x, next.base, blend);
		shape.y = THREE.MathUtils.lerp(shape.y, next.depth, blend);
		shape.z = THREE.MathUtils.lerp(shape.z, next.scale, blend);
		shape.w = THREE.MathUtils.lerp(shape.w, next.overcast, blend);
		if (meshRef.current) meshRef.current.visible = material.uniforms.uCover.value > 0.001;
		// Integrate wind so changing its speed does not jump the cloud pattern.
		const travel = Math.min(delta, 0.1) * windSpeed * 0.12;
		material.uniforms.uWindOffset.value.x -= Math.sin(windDirection) * travel;
		material.uniforms.uWindOffset.value.y -= Math.cos(windDirection) * travel;
	});

	return (
		<mesh ref={meshRef} material={material} frustumCulled={false} renderOrder={-1}>
			{/* Just inside the existing sky dome; opaque meadow depth occludes it. */}
			<sphereGeometry args={[158, 32, 16]} />
		</mesh>
	);
}
