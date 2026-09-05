/* eslint-disable react/immutability -- Three.js shader uniforms are updated imperatively in effects and the render loop. */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface StylizedCloudsProps {
	cloudCover: number;
	sunDirection: THREE.Vector3;
	sunColor: string;
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
		float h = (p.y - 16.0) / 17.0;
		if (h <= 0.0 || h >= 1.0) return 0.0;
		p.xz += uWindOffset;
		// Broad masses with a small amount of erosion, rather than wispy detail.
		float shape = noise3(p * vec3(0.06, 0.045, 0.06));
		float detail = noise3(p * 0.13 + vec3(7.1, 3.4, 12.0));
		float profile = smoothstep(0.0, 0.15, h) * (1.0 - smoothstep(0.38, 1.0, h));
		float threshold = mix(0.78, 0.22, uCover) + (1.0 - profile) * 0.3;
		return smoothstep(threshold, threshold + 0.12, shape + (detail - 0.5) * 0.13)
			* profile * smoothstep(0.0, 0.12, uCover);
	}

	void main() {
		vec3 ray = normalize(vDirection);
		if (abs(ray.y) < 0.0001) discard;
		vec2 bounds = (vec2(16.0, 33.0) - cameraPosition.y) / ray.y;
		float nearT = max(0.0, min(bounds.x, bounds.y));
		float farT = min(155.0, max(bounds.x, bounds.y));
		if (farT <= nearT) discard;
		float stepSize = (farT - nearT) / 40.0;
		float transmission = 1.0;
		vec3 lightSum = vec3(0.0);
		float sunAmount = smoothstep(-0.12, 0.22, uSunDirection.y);
		float rim = pow(max(dot(ray, uSunDirection), 0.0), 6.0) * 0.16 * sunAmount;
		for (int i = 0; i < 40; i++) {
			float t = nearT + (float(i) + 0.5) * stepSize;
			vec3 p = cameraPosition + ray * t;
			float density = densityAt(p);
			if (density > 0.001) {
				// Two coarse sunward samples give soft internal shadows.
				float shadow = densityAt(p + uSunDirection * 3.0) * 0.7
					+ densityAt(p + uSunDirection * 7.0) * 0.3;
				float illumination = exp(-shadow * 1.8);
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

export default function StylizedClouds({ cloudCover, sunDirection, sunColor, skyColor, horizonColor, windSpeed, windDirection }: StylizedCloudsProps) {
	const meshRef = useRef<THREE.Mesh>(null);
	const densityTexture = useMemo(() => createDensityTexture(), []);
	const material = useMemo(() => new THREE.ShaderMaterial({
		uniforms: {
			uNoise: { value: densityTexture },
			uCover: { value: 0 },
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
	}), [densityTexture]);

	useEffect(() => {
		const daylight = THREE.MathUtils.smoothstep(sunDirection.y, -0.12, 0.22);
		material.uniforms.uCover.value = THREE.MathUtils.clamp(cloudCover / 100, 0, 1);
		material.uniforms.uSunDirection.value.copy(sunDirection).normalize();
		material.uniforms.uLight.value.set('#f3eee2').lerp(new THREE.Color(sunColor), 0.35).multiplyScalar(0.015 + daylight * 0.985);
		material.uniforms.uShade.value.set(horizonColor).lerp(new THREE.Color(skyColor), 0.3).multiplyScalar(0.65);
		material.uniforms.uHorizon.value.set(horizonColor);
	}, [cloudCover, horizonColor, material, skyColor, sunColor, sunDirection]);

	useEffect(() => () => {
		material.dispose();
		densityTexture.dispose();
	}, [densityTexture, material]);

	useFrame(({ camera }, delta) => {
		meshRef.current?.position.copy(camera.position);
		// Integrate wind so changing its speed does not jump the cloud pattern.
		const travel = Math.min(delta, 0.1) * windSpeed * 0.12;
		material.uniforms.uWindOffset.value.x -= Math.sin(windDirection) * travel;
		material.uniforms.uWindOffset.value.y -= Math.cos(windDirection) * travel;
	});

	if (cloudCover <= 0) return null;
	return (
		<mesh ref={meshRef} material={material} frustumCulled={false} renderOrder={-1}>
			{/* Just inside the existing sky dome; opaque meadow depth occludes it. */}
			<sphereGeometry args={[158, 32, 16]} />
		</mesh>
	);
}
