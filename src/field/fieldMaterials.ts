/* eslint-disable react/immutability -- Three.js uniforms are mutable GPU state, updated after React commits. */
import { useEffect, useLayoutEffect, useState } from 'react';
import * as THREE from 'three';
import grassIncludes from './shaders/grass.includes.glsl?raw';
import grassVertexSource from './shaders/grass.vertex.glsl?raw';
import grassFragmentShader from './shaders/grass.fragment.glsl?raw';
import terrainVertexShader from './shaders/terrain.vertex.glsl?raw';
import terrainFragmentShader from './shaders/terrain.fragment.glsl?raw';
import {
	GRASS_FAR_TRANSITION_END,
	GRASS_FAR_TRANSITION_START,
	GRASS_FAR_WIDTH,
	GRASS_MID_WIDTH,
	GRASS_NEAR_TRANSITION_END,
	GRASS_NEAR_TRANSITION_START,
	GRASS_NEAR_WIDTH,
	GRASS_SEGMENTS,
} from './grassLod';
import { CHUNK_SIZE, FIELD_CURVATURE_RADIUS, FIELD_CURVATURE_START } from './worldMath';

const grassVertexShader = grassVertexSource.replace('#include includes.glsl', grassIncludes);

export function useInfiniteTerrainMaterial(
	noiseTexture: THREE.Texture,
	sunDirection: THREE.Vector3,
	sunStrength: number,
	ditherMode: 0 | 1,
	ditherPixelSize: number,
	noiseStrength: number,
	noiseScale: number,
	ambientTint = '#ffffff',
) {
	const [material] = useState(() => new THREE.ShaderMaterial({
		uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.lights, {
			uBaseColor: { value: new THREE.Color('#908343') },
			uCircleCenter: { value: new THREE.Vector3() },
			uCurvatureRadius: { value: FIELD_CURVATURE_RADIUS },
			uCurvatureStart: { value: FIELD_CURVATURE_START },
			uTrailPatchSize: { value: CHUNK_SIZE },
			uCircleRadiusFactor: { value: 20 },
			uGrassFadeOffset: { value: 3.5 },
			uGroundOffset: { value: -0.75 },
			uGroundFadeOffset: { value: 1 },
			uNoiseTexture: { value: noiseTexture },
			uNoiseStrength: { value: noiseStrength },
			uNoiseScale: { value: noiseScale },
			uPixelSize: { value: ditherPixelSize },
			uDitherMode: { value: ditherMode },
			uSunDirection: { value: sunDirection.clone() },
			uSunStrength: { value: sunStrength },
			uAmbientTint: { value: new THREE.Color(ambientTint) },
		}]),
		vertexShader: terrainVertexShader,
		fragmentShader: terrainFragmentShader,
		lights: true,
	}));

	useLayoutEffect(() => {
		material.uniforms.uNoiseTexture.value = noiseTexture;
		material.uniforms.uNoiseStrength.value = noiseStrength;
		material.uniforms.uNoiseScale.value = noiseScale;
		material.uniforms.uPixelSize.value = ditherPixelSize;
		material.uniforms.uDitherMode.value = ditherMode;
		material.uniforms.uSunDirection.value.copy(sunDirection);
		material.uniforms.uSunStrength.value = sunStrength;
		material.uniforms.uAmbientTint.value.set(ambientTint);
	}, [ambientTint, ditherMode, ditherPixelSize, noiseScale, noiseStrength, noiseTexture, sunDirection, sunStrength, material]);

	useEffect(() => () => material.dispose(), [material]);
	return material;
}

export function useInfiniteGrassMaterial(
	noiseTexture: THREE.Texture,
	sunDirection: THREE.Vector3,
	skyColor: string,
	sunColor: string,
	sunStrength: number,
	windSpeed: number,
	windStrength: number,
	windDirection: number,
	windScale: number,
	ditherMode: 0 | 1,
	ditherPixelSize: number,
	noiseStrength: number,
	noiseScale: number,
	ambientTint = '#ffffff',
) {
	const [material] = useState(() => new THREE.ShaderMaterial({
		uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.lights, {
			uPixelSize: { value: ditherPixelSize },
			uDitherMode: { value: ditherMode },
			uTime: { value: 0 },
			uGrassSegments: { value: GRASS_SEGMENTS },
			uGrassChunkSize: { value: CHUNK_SIZE },
			uGrassWidth: { value: GRASS_NEAR_WIDTH },
			uGrassMidWidth: { value: GRASS_MID_WIDTH },
			uGrassFarWidth: { value: GRASS_FAR_WIDTH },
			uGrassNearTransitionStart: { value: GRASS_NEAR_TRANSITION_START },
			uGrassNearTransitionEnd: { value: GRASS_NEAR_TRANSITION_END },
			uGrassFarTransitionStart: { value: GRASS_FAR_TRANSITION_START },
			uGrassFarTransitionEnd: { value: GRASS_FAR_TRANSITION_END },
			uGrassHeight: { value: 1.15 },
			uGrassBaseColor: { value: new THREE.Color('#669019') },
			uGrassTopColor: { value: new THREE.Color('#acc125') },
			uLeanFactor: { value: 0.2 },
			uWindDirection: { value: windDirection },
			uWindScale: { value: windScale },
			uWindStrength: { value: windStrength },
			uWindSpeed: { value: windSpeed },
			uCursorWindPosition: { value: new THREE.Vector2(10000, 10000) },
			uCursorWindTrailPosition: { value: new THREE.Vector2(10000, 10000) },
			uCursorWindDirection: { value: new THREE.Vector2(1, 0) },
			uCursorWindStrength: { value: 0 },
			uCursorWindRadius: { value: 8 },
			uCircleCenter: { value: new THREE.Vector3() },
			uCurvatureRadius: { value: FIELD_CURVATURE_RADIUS },
			uCurvatureStart: { value: FIELD_CURVATURE_START },
			uNoiseTexture: { value: noiseTexture },
			uNoiseStrength: { value: noiseStrength },
			uNoiseScale: { value: noiseScale },
			uCircleRadiusFactor: { value: 20 },
			uGrassFadeOffset: { value: 3.5 },
			uSunDirection: { value: sunDirection.clone() },
			uSunColor: { value: new THREE.Color(sunColor) },
			uSkyLightColor: { value: new THREE.Color(skyColor).lerp(new THREE.Color('#ffffff'), 0.55) },
			uSunStrength: { value: sunStrength },
			uAmbientTint: { value: new THREE.Color(ambientTint) },
		}]),
		vertexShader: grassVertexShader,
		fragmentShader: grassFragmentShader,
		side: THREE.FrontSide,
		lights: true,
	}));

	useLayoutEffect(() => {
		material.uniforms.uNoiseTexture.value = noiseTexture;
		material.uniforms.uNoiseStrength.value = noiseStrength;
		material.uniforms.uNoiseScale.value = noiseScale;
		material.uniforms.uPixelSize.value = ditherPixelSize;
		material.uniforms.uDitherMode.value = ditherMode;
		material.uniforms.uSunDirection.value.copy(sunDirection);
		material.uniforms.uSunStrength.value = sunStrength;
		material.uniforms.uAmbientTint.value.set(ambientTint);
		material.uniforms.uSunColor.value.set(sunColor);
		material.uniforms.uSkyLightColor.value.set(skyColor).lerp(new THREE.Color('#ffffff'), 0.55);
		material.uniforms.uWindDirection.value = windDirection;
		material.uniforms.uWindScale.value = windScale;
		material.uniforms.uWindStrength.value = windStrength;
		material.uniforms.uWindSpeed.value = windSpeed;
	}, [ambientTint, ditherMode, ditherPixelSize, noiseScale, noiseStrength, noiseTexture, skyColor, sunColor, sunDirection, sunStrength, windDirection, windScale, windSpeed, windStrength, material]);

	useEffect(() => () => material.dispose(), [material]);
	return material;
}
