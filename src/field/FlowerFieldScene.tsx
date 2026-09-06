import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import './FlowerField.css';
import ChunkDebugOutline from './ChunkDebugOutline';
import FlowerPopulation from './FlowerPopulation';
import {
	PLANTABLE_ROSE_VARIANTS,
	type PlantedRose,
} from './plantedRoses';
import TerrainChunk from './TerrainChunk';
import StylizedClouds from './StylizedClouds';
import StylizedStars from './StylizedStars';
import { createCursorWindState, intersectTerrainHeightField } from './cursorWind';
import {
	createFlowerFieldDiagnosticHistory,
	createFlowerFieldDiagnosticValues,
	type FlowerFieldDiagnosticValues,
} from './flowerFieldDiagnosticState';
import { useInfiniteGrassMaterial, useInfiniteTerrainMaterial } from './fieldMaterials';
import { CHUNK_SIZE, FIELD_CURVATURE_RADIUS, FIELD_CURVATURE_START, terrainHeight } from './worldMath';
import type { WeatherData } from '../weather/weatherTypes';
import { createFlowerFieldAtmosphere } from './weatherAtmosphere';
import { needsPostprocessing } from './renderFrame';

const FlowerFieldDiagnostics = lazy(() => import('./FlowerFieldDiagnostics'));
const FieldRenderEffects = lazy(() => import('./FieldRenderEffects'));

type CloudRendering = 'sheet' | 'stylized';

interface FlowerFieldSceneProps {
	reducedMotion: boolean;
	showDiagnostics?: boolean;
	cameraHeight: number;
	cameraAngle: number;
	showChunkBoundaries: boolean;
	skyColor: string;
	sunStrength: number;
	cameraSpeed: number;
	windSpeed: number;
	windStrength: number;
	windDirection: number;
	windScale: number;
	ditherMode: 0 | 1;
	ditherPixelSize: number;
	ditherStrength: number;
	noiseStrength: number;
	noiseScale: number;
	weather?: WeatherData | null;
	weatherNow?: number;
	cloudRendering: CloudRendering;
	onReady: () => void;
}

const CAMERA_VERTICAL_FOV = 48;
const FOG_FAR = 90;
const FOOTPRINT_BUFFER_CHUNKS = 1;
const FOOTPRINT_ROWS_BEHIND = 1;
const CURSOR_GUST_DURATION = 0.12;
const CURSOR_GUST_MAX_STRENGTH = 0.9;
const CURSOR_REVERSAL_DOT_THRESHOLD = -0.5;
const CURSOR_REVERSAL_MIN_SPEED = 0.05;
const CURSOR_REVERSAL_SETTLED_STRENGTH = 0.025;
const CURSOR_REVERSAL_BRAKE_RATE = 22;

function chunkFootprint(centerX: number, centerZ: number, aspectRatio: number) {
	const chunks = [];
	const verticalHalfFov = THREE.MathUtils.degToRad(CAMERA_VERTICAL_FOV * 0.5);
	const horizontalHalfFov = Math.atan(Math.tan(verticalHalfFov) * aspectRatio);
	const forwardRows = Math.ceil(FOG_FAR / CHUNK_SIZE);

	for (let row = -FOOTPRINT_ROWS_BEHIND; row <= forwardRows; row += 1) {
		const farEdgeDistance = Math.min(
			FOG_FAR,
			Math.max(1, row + 1) * CHUNK_SIZE,
		);
		const visibleHalfWidth = farEdgeDistance * Math.tan(horizontalHalfFov);
		const chunksOnEachSide = Math.ceil(visibleHalfWidth / CHUNK_SIZE) + FOOTPRINT_BUFFER_CHUNKS;
		const chunkZ = centerZ - row;

		for (let x = -chunksOnEachSide; x <= chunksOnEachSide; x += 1) {
			const chunkX = centerX + x;
			chunks.push({ x: chunkX, z: chunkZ, key: `${chunkX},${chunkZ}` });
		}
	}
	return chunks;
}

function DirectionalSun({ strength, direction, color }: { strength: number; direction: THREE.Vector3; color: string }) {
	// Shadows only modulate direct sunlight in the field shaders. At zero
	// strength, skip the shadow pass and its shader sampling entirely.
	const castsShadows = strength > 0;
	const lightRef = useRef<THREE.DirectionalLight>(null);
	const target = useMemo(() => new THREE.Object3D(), []);
	const { camera, scene } = useThree();

	useEffect(() => {
		scene.add(target);
		if (lightRef.current) lightRef.current.target = target;
		return () => {
			scene.remove(target);
		};
	}, [scene, target]);

	useFrame(() => {
		if (!castsShadows) return;
		const focusX = camera.position.x;
		const focusZ = camera.position.z - 18;
		target.position.set(focusX, terrainHeight(focusX, focusZ), focusZ);
		target.updateMatrixWorld();
		lightRef.current?.position.copy(target.position).addScaledVector(direction, 48);
	});

	return (
		<directionalLight
			ref={lightRef}
			color={color}
			intensity={strength * 1.35}
			castShadow={castsShadows}
			shadow-mapSize-width={1024}
			shadow-mapSize-height={1024}
			shadow-camera-left={-28}
			shadow-camera-right={28}
			shadow-camera-top={25}
			shadow-camera-bottom={-25}
			shadow-camera-near={1}
			shadow-camera-far={100}
			shadow-bias={-0.00035}
			shadow-normalBias={0.025}
			shadow-radius={1.5}
		/>
	);
}

function BackgroundSphere({ zenithColor, horizonColor, sunColor, sunDirection, sunVisibility, moonDirection, moonVisibility }: {
	zenithColor: string;
	horizonColor: string;
	sunColor: string;
	sunDirection: THREE.Vector3;
	sunVisibility: number;
	moonDirection: THREE.Vector3;
	moonVisibility: number;
}) {
	const meshRef = useRef<THREE.Mesh>(null);
	const [material] = useState(() => new THREE.ShaderMaterial({
		uniforms: {
			uZenithColor: { value: new THREE.Color(zenithColor) },
			uHorizonColor: { value: new THREE.Color(horizonColor) },
			uSunColor: { value: new THREE.Color(sunColor) },
			uSunDirection: { value: sunDirection.clone() },
			uSunVisibility: { value: sunVisibility },
			uMoonDirection: { value: moonDirection.clone() },
			uMoonVisibility: { value: moonVisibility },
		},
		vertexShader: `
			varying vec3 vDirection;
			void main() {
				vDirection = normalize(position);
				gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
			}
		`,
		fragmentShader: `
			uniform vec3 uZenithColor;
			uniform vec3 uHorizonColor;
			uniform vec3 uSunColor;
			uniform vec3 uSunDirection;
			uniform float uSunVisibility;
			uniform vec3 uMoonDirection;
			uniform float uMoonVisibility;
			varying vec3 vDirection;
			void main() {
				vec3 direction = normalize(vDirection);
				float skyGradient = smoothstep(-0.03, 0.16, direction.y);
				vec3 color = mix(uHorizonColor, uZenithColor, skyGradient);
				float sunDistance = length(direction - uSunDirection);
				float sunAA = max(fwidth(sunDistance), 0.0001);
				float sunDisc = 1.0 - smoothstep(0.00465 - sunAA, 0.00465 + sunAA, sunDistance);
				// Analytic glare: preserve the disc's angular size while giving its
				// brightness a concentrated shoulder and a soft outer falloff.
				float sunHalo = exp(-pow(sunDistance / 0.012, 2.0));
				float sunGlare = exp(-sunDistance / 0.045);
				vec3 sunWhite = mix(uSunColor, vec3(1.0), 0.85);
				color += (sunWhite * (sunDisc * 12.0 + sunHalo * 1.4)
					+ uSunColor * sunGlare * 0.28) * uSunVisibility;
				// A small sphere lit from the true sun direction gives the lunar phase
				// and its orientation, including the southern-hemisphere perspective.
				vec3 moonRight = normalize(cross(uMoonDirection, vec3(0.0, 1.0, 0.0)));
				vec3 moonUp = cross(moonRight, uMoonDirection);
				vec2 moonUV = vec2(dot(direction, moonRight), dot(direction, moonUp)) / 0.00465;
				float moonRadius = length(moonUV);
				float moonAA = max(fwidth(moonRadius), 0.001);
				float moonMask = (1.0 - smoothstep(1.0 - moonAA, 1.0 + moonAA, moonRadius))
					* step(0.0, dot(direction, uMoonDirection)) * uMoonVisibility;
				vec3 moonNormal = moonRight * moonUV.x + moonUp * moonUV.y
					- uMoonDirection * sqrt(max(0.0, 1.0 - dot(moonUV, moonUV)));
				float moonLight = smoothstep(-0.04, 0.04, dot(moonNormal, uSunDirection));
				// Broad, low-contrast maria remain legible at the small disc size.
				// These are procedural markings, not a map of the lunar surface.
				float maria = exp(-dot((moonUV - vec2(-0.25, 0.22)) / vec2(0.42, 0.52),
					(moonUV - vec2(-0.25, 0.22)) / vec2(0.42, 0.52)))
					+ 0.6 * exp(-dot((moonUV - vec2(0.32, 0.35)) / vec2(0.28, 0.3),
					(moonUV - vec2(0.32, 0.35)) / vec2(0.28, 0.3)));
				float lunarAlbedo = 1.0 - 0.28 * clamp(maria, 0.0, 1.0);
				vec3 moonSurface = vec3(1.85, 1.83, 1.76) * lunarAlbedo;
				float illuminatedFraction = clamp((1.0 - dot(uMoonDirection, uSunDirection)) * 0.5, 0.0, 1.0);
				float moonDistance = length(direction - uMoonDirection);
				float moonHalo = exp(-moonDistance / 0.008) * pow(illuminatedFraction, 2.0);
				color += vec3(0.8, 0.86, 1.0) * moonHalo * 0.035 * uMoonVisibility;
				color = mix(color, moonSurface, moonMask * moonLight);
				gl_FragColor = vec4(color, 1.0);
				#include <tonemapping_fragment>
				#include <colorspace_fragment>
			}
		`,
		side: THREE.BackSide,
		depthWrite: false,
	}));
	useLayoutEffect(() => {
		material.uniforms.uZenithColor.value.set(zenithColor);
		material.uniforms.uHorizonColor.value.set(horizonColor);
		material.uniforms.uSunColor.value.set(sunColor);
		material.uniforms.uSunDirection.value.copy(sunDirection);
		// eslint-disable-next-line react/immutability -- Mutable shader uniform.
		material.uniforms.uSunVisibility.value = sunVisibility;
		material.uniforms.uMoonDirection.value.copy(moonDirection);
		material.uniforms.uMoonVisibility.value = moonVisibility;
	}, [horizonColor, material, moonDirection, moonVisibility, sunColor, sunDirection, sunVisibility, zenithColor]);
	useFrame(({ camera }) => {
		meshRef.current?.position.copy(camera.position);
	});
	useEffect(() => () => material.dispose(), [material]);
	return (
		<mesh ref={meshRef}>
			<sphereGeometry args={[160]} />
			<primitive object={material} attach="material" />
		</mesh>
	);
}

const CLOUD_VERTEX_SHADER = `
	varying vec3 vWorldPosition;
	void main() {
		vec4 worldPosition = modelMatrix * vec4(position, 1.0);
		vWorldPosition = worldPosition.xyz;
		gl_Position = projectionMatrix * viewMatrix * worldPosition;
	}
`;

const CLOUD_FRAGMENT_SHADER = `
	uniform float uCloudCover;
	uniform float uOpacity;
	uniform vec2 uPatternOffset;
	uniform vec3 uCloudLight;
	uniform vec3 uCloudDark;
	varying vec3 vWorldPosition;

	float hash(vec2 value) {
		return fract(sin(dot(value, vec2(127.1, 311.7))) * 43758.5453);
	}

	float noise(vec2 point) {
		vec2 cell = floor(point);
		vec2 blend = fract(point);
		blend = blend * blend * (3.0 - 2.0 * blend);
		return mix(mix(hash(cell), hash(cell + vec2(1.0, 0.0)), blend.x), mix(hash(cell + vec2(0.0, 1.0)), hash(cell + vec2(1.0, 1.0)), blend.x), blend.y);
	}

	float cloudNoise(vec2 point) {
		float value = 0.0;
		float amplitude = 0.55;
		for (int octave = 0; octave < 4; octave++) {
			value += noise(point) * amplitude;
			point = point * 2.03 + vec2(7.1, 3.4);
			amplitude *= 0.48;
		}
		return value;
	}

	void main() {
		vec2 cloudPoint = vWorldPosition.xz * 0.035 + uPatternOffset;
		float broadShape = cloudNoise(cloudPoint);
		float detail = noise(cloudPoint * 7.2 + vec2(12.7, 4.2));
		float threshold = mix(0.78, 0.35, uCloudCover);
		float density = smoothstep(threshold, threshold + 0.12, broadShape + (detail - 0.5) * 0.16);
		float distanceFromCamera = length(vWorldPosition.xz - cameraPosition.xz);
		float distanceFade = 1.0 - smoothstep(135.0, 175.0, distanceFromCamera);
		float opacity = density * distanceFade * uOpacity;
		if (opacity < 0.005) discard;
		vec3 color = mix(uCloudDark, uCloudLight, smoothstep(0.3, 0.78, detail));
		gl_FragColor = vec4(color, opacity);
		#include <tonemapping_fragment>
		#include <colorspace_fragment>
	}
`;

function CloudLayer({ cloudCover, lightColor, darkColor }: {
	cloudCover: number;
	lightColor: string;
	darkColor: string;
}) {
	const groupRef = useRef<THREE.Group>(null);
	const materials = useMemo(() => [
		new THREE.ShaderMaterial({
			uniforms: {
				uCloudCover: { value: THREE.MathUtils.clamp(cloudCover / 100, 0, 1) },
				uOpacity: { value: 0.68 },
				uPatternOffset: { value: new THREE.Vector2(0, 0) },
				uCloudLight: { value: new THREE.Color(lightColor) },
				uCloudDark: { value: new THREE.Color(darkColor).multiplyScalar(0.62) },
			},
			vertexShader: CLOUD_VERTEX_SHADER,
			fragmentShader: CLOUD_FRAGMENT_SHADER,
			transparent: true,
			depthWrite: false,
			side: THREE.DoubleSide,
		}),
		new THREE.ShaderMaterial({
			uniforms: {
				uCloudCover: { value: THREE.MathUtils.clamp(cloudCover / 100, 0, 1) },
				uOpacity: { value: 0.38 },
				uPatternOffset: { value: new THREE.Vector2(8.4, -5.7) },
				uCloudLight: { value: new THREE.Color(lightColor) },
				uCloudDark: { value: new THREE.Color(darkColor).multiplyScalar(0.62) },
			},
			vertexShader: CLOUD_VERTEX_SHADER,
			fragmentShader: CLOUD_FRAGMENT_SHADER,
			transparent: true,
			depthWrite: false,
			side: THREE.DoubleSide,
		}),
	], [cloudCover, darkColor, lightColor]);

	useEffect(() => () => {
		for (const material of materials) material.dispose();
	}, [materials]);
	useFrame(({ camera }) => {
		if (!groupRef.current) return;
		groupRef.current.position.x = camera.position.x;
		groupRef.current.position.z = camera.position.z;
	});

	if (cloudCover <= 0) return null;
	return (
		<group ref={groupRef}>
			<mesh position={[0, 27, 0]} rotation={[-Math.PI / 2, 0, 0]} material={materials[0]}>
				<planeGeometry args={[380, 380, 1, 1]} />
			</mesh>
			<mesh position={[0, 30, 0]} rotation={[-Math.PI / 2, 0, 0]} material={materials[1]}>
				<planeGeometry args={[380, 380, 1, 1]} />
			</mesh>
		</group>
	);
}

const MAX_RAIN_DROPS = 1500;
const RAIN_WIDTH = 72;
const RAIN_DEPTH = 72;
const RAIN_HEIGHT = 28;

function Rainfall({ intensity, windSpeed, windDirection }: {
	intensity: number;
	windSpeed: number;
	windDirection: number;
}) {
	const linesRef = useRef<THREE.LineSegments>(null);
	const geometry = useMemo(() => {
		const positions = new Float32Array(MAX_RAIN_DROPS * 2 * 3);
		let seed = 0x7a11fa11;
		const random = () => {
			seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
			return seed / 0x100000000;
		};
		for (let index = 0; index < MAX_RAIN_DROPS; index += 1) {
			const offset = index * 6;
			const x = (random() - 0.5) * RAIN_WIDTH;
			const y = (random() - 0.25) * RAIN_HEIGHT;
			const z = -random() * RAIN_DEPTH;
			const length = 0.38 + random() * 0.5;
			positions[offset] = x;
			positions[offset + 1] = y;
			positions[offset + 2] = z;
			positions[offset + 3] = x;
			positions[offset + 4] = y - length;
			positions[offset + 5] = z;
		}
		const result = new THREE.BufferGeometry();
		const positionAttribute = new THREE.BufferAttribute(positions, 3);
		positionAttribute.setUsage(THREE.DynamicDrawUsage);
		result.setAttribute('position', positionAttribute);
		return result;
	}, []);
	const material = useMemo(() => new THREE.LineBasicMaterial({
		color: '#d7e4e8',
		transparent: true,
		opacity: 0.27,
		depthWrite: false,
	}), []);
	const driftX = Math.sin(windDirection) * windSpeed * 0.28;
	const driftZ = Math.cos(windDirection) * windSpeed * 0.28;

	useEffect(() => () => {
		geometry.dispose();
		material.dispose();
	}, [geometry, material]);

	useFrame(({ camera }, delta) => {
		const lines = linesRef.current;
		if (!lines) return;
		lines.position.copy(camera.position);
		const positions = geometry.attributes.position.array as Float32Array;
		const fallDistance = Math.min(delta, 0.05) * (17 + intensity * 12);
		const driftScale = Math.min(delta, 0.05);
		for (let index = 0; index < MAX_RAIN_DROPS; index += 1) {
			const offset = index * 6;
			positions[offset] += driftX * driftScale;
			positions[offset + 1] -= fallDistance;
			positions[offset + 2] += driftZ * driftScale;
			positions[offset + 3] += driftX * driftScale;
			positions[offset + 4] -= fallDistance;
			positions[offset + 5] += driftZ * driftScale;
			if (positions[offset + 4] < -7) {
				const length = positions[offset + 1] - positions[offset + 4];
				positions[offset + 1] += RAIN_HEIGHT;
				positions[offset + 4] = positions[offset + 1] - length;
			}
			if (positions[offset] > RAIN_WIDTH * 0.5) {
				positions[offset] -= RAIN_WIDTH;
				positions[offset + 3] -= RAIN_WIDTH;
			} else if (positions[offset] < -RAIN_WIDTH * 0.5) {
				positions[offset] += RAIN_WIDTH;
				positions[offset + 3] += RAIN_WIDTH;
			}
			if (positions[offset + 2] > 0) {
				positions[offset + 2] -= RAIN_DEPTH;
				positions[offset + 5] -= RAIN_DEPTH;
			} else if (positions[offset + 2] < -RAIN_DEPTH) {
				positions[offset + 2] += RAIN_DEPTH;
				positions[offset + 5] += RAIN_DEPTH;
			}
		}
		geometry.setDrawRange(0, Math.round(MAX_RAIN_DROPS * intensity) * 2);
		geometry.attributes.position.needsUpdate = true;
	});

	if (intensity <= 0) return null;
	return <lineSegments ref={linesRef} geometry={geometry} material={material} frustumCulled={false} />;
}

function StormLightning({ enabled }: { enabled: boolean }) {
	const skyMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
	const fieldLightRef = useRef<THREE.HemisphereLight>(null);
	const meshRef = useRef<THREE.Mesh>(null);
	const sequenceRef = useRef({
		activeSince: -1,
		nextFlash: 0,
		seed: 0x11ab011,
		wasEnabled: false,
	});

	useFrame(({ camera, clock }) => {
		const skyMaterial = skyMaterialRef.current;
		const fieldLight = fieldLightRef.current;
		const mesh = meshRef.current;
		if (!skyMaterial || !fieldLight || !mesh) return;
		mesh.position.copy(camera.position);

		const sequence = sequenceRef.current;
		const now = clock.elapsedTime;
		if (!enabled) {
			sequence.wasEnabled = false;
			skyMaterial.opacity = 0;
			fieldLight.intensity = 0;
			return;
		}
		if (!sequence.wasEnabled) {
			sequence.wasEnabled = true;
			sequence.activeSince = -1;
			sequence.nextFlash = now + 0.65;
		}
		if (now >= sequence.nextFlash) {
			sequence.activeSince = now;
			sequence.seed = (Math.imul(sequence.seed, 1664525) + 1013904223) >>> 0;
			sequence.nextFlash = now + 3.5 + sequence.seed / 0x100000000 * 5.5;
		}

		const age = now - sequence.activeSince;
		let flash = 0;
		if (age >= 0 && age < 0.07) flash = Math.sin(age / 0.07 * Math.PI);
		else if (age >= 0.12 && age < 0.21) flash = Math.sin((age - 0.12) / 0.09 * Math.PI) * 0.62;
		else if (age >= 0.29 && age < 0.38) flash = Math.sin((age - 0.29) / 0.09 * Math.PI) * 0.24;
		skyMaterial.opacity = flash * 0.24;
		fieldLight.intensity = flash * 2.6;
	});

	return (
		<>
			<hemisphereLight ref={fieldLightRef} color="#d9e6ff" groundColor="#d7ddca" intensity={0} />
			<mesh ref={meshRef} renderOrder={2}>
				<sphereGeometry args={[158]} />
				<meshBasicMaterial
					ref={skyMaterialRef}
					color="#e7efff"
					side={THREE.BackSide}
					transparent
					opacity={0}
					depthWrite={false}
					toneMapped={false}
				/>
			</mesh>
		</>
	);
}

interface FlowerFieldWorldProps extends Omit<FlowerFieldSceneProps, 'reducedMotion' | 'showDiagnostics' | 'ditherStrength'> {
	diagnosticsRef: RefObject<FlowerFieldDiagnosticValues>;
}

function FlowerFieldWorld({ cameraHeight, cameraAngle, showChunkBoundaries, skyColor, sunStrength, cameraSpeed, windSpeed, windStrength, windDirection, windScale, ditherMode, ditherPixelSize, noiseStrength, noiseScale, weather, weatherNow, cloudRendering, onReady, diagnosticsRef }: FlowerFieldWorldProps) {
	const [liveNow, setLiveNow] = useState(() => Date.now() / 1000);
	useEffect(() => {
		if (weatherNow !== undefined) return;
		const update = () => setLiveNow(Date.now() / 1000);
		update();
		const interval = window.setInterval(update, 15_000);
		document.addEventListener('visibilitychange', update);
		return () => {
			window.clearInterval(interval);
			document.removeEventListener('visibilitychange', update);
		};
	}, [weatherNow]);
	const atmosphere = useMemo(
		() => createFlowerFieldAtmosphere(weather ?? null, {
			fallbackSkyColor: skyColor,
			baseSunStrength: sunStrength,
			now: weatherNow ?? liveNow,
			// Only the demo's explicit clock uses its synthetic solar events.
			solarTimes: weatherNow !== undefined && weather
				? { sunrise: weather.sunrise, sunset: weather.sunset }
				: undefined,
		}),
		[skyColor, sunStrength, weather, weatherNow, liveNow],
	);
	const atmosphericWindSpeed = weather?.windSpeed ?? windSpeed;
	const atmosphericWindDirection = weather ? THREE.MathUtils.degToRad(weather.windDirection) : windDirection;
	const loadedNoiseTexture = useLoader(THREE.TextureLoader, '/assets/terrain/noiseTexture.png');
	const noiseTexture = useMemo(() => {
		const texture = loadedNoiseTexture.clone();
		texture.wrapS = THREE.RepeatWrapping;
		texture.wrapT = THREE.RepeatWrapping;
		texture.minFilter = THREE.LinearFilter;
		texture.magFilter = THREE.LinearFilter;
		texture.needsUpdate = true;
		return texture;
	}, [loadedNoiseTexture]);
	const terrainMaterial = useInfiniteTerrainMaterial(noiseTexture, atmosphere.sunDirection, atmosphere.sunStrength, ditherMode, ditherPixelSize, noiseStrength, noiseScale, atmosphere.ambientTint);
	const grassMaterial = useInfiniteGrassMaterial(
		noiseTexture,
		atmosphere.sunDirection,
		atmosphere.zenithColor,
		atmosphere.sunColor,
		atmosphere.sunStrength,
		windSpeed,
		windStrength,
		windDirection,
		windScale,
		ditherMode,
		ditherPixelSize,
		noiseStrength,
		noiseScale,
		atmosphere.ambientTint,
	);
	const chunkOutlineMaterial = useMemo(() => new THREE.ShaderMaterial({
		uniforms: {
			uCircleCenter: { value: new THREE.Vector3() },
			uCurvatureRadius: { value: FIELD_CURVATURE_RADIUS },
			uCurvatureStart: { value: FIELD_CURVATURE_START },
		},
		vertexShader: `
			uniform vec3 uCircleCenter;
			uniform float uCurvatureRadius;
			uniform float uCurvatureStart;
			void main() {
				vec4 worldPosition = modelMatrix * vec4(position, 1.0);
				float curvatureDistance = max(0.0, length(worldPosition.xz - uCircleCenter.xz) - uCurvatureStart);
				worldPosition.y -= curvatureDistance * curvatureDistance / (2.0 * uCurvatureRadius);
				gl_Position = projectionMatrix * viewMatrix * worldPosition;
			}
		`,
		fragmentShader: `
			void main() {
				gl_FragColor = vec4(1.0, 0.23, 0.09, 0.95);
			}
		`,
		transparent: true,
		depthTest: false,
		depthWrite: false,
	}), []);
	const [chunkCenter, setChunkCenter] = useState({ x: 0, z: 0 });
	const [plantedRoses, setPlantedRoses] = useState<PlantedRose[]>([]);
	const nextPlantedRoseIdRef = useRef(0);
	const currentChunkRef = useRef({ x: 0, z: 0 });
	const travelRef = useRef(0);
	const circleCenter = useMemo(() => new THREE.Vector3(), []);
	const cursorWindRef = useRef(createCursorWindState());
	const pointerInputRef = useRef({
		active: false,
		hasPreviousPosition: false,
		remainingGustTime: 0,
		reversing: false,
		ndc: new THREE.Vector2(),
		velocity: new THREE.Vector2(),
		queuedVelocity: new THREE.Vector2(),
		previousClientX: 0,
		previousClientY: 0,
		previousEventTime: 0,
	});
	const raycaster = useMemo(() => new THREE.Raycaster(), []);
	const pointerTerrainHit = useMemo(() => new THREE.Vector3(), []);
	const pointerTerrainTarget = useMemo(() => new THREE.Vector2(), []);
	const { camera, clock, gl, size } = useThree();
	const baseGrassCount = size.width <= 760 ? 1500 : 2500;
	const flowerCandidateCount = size.width <= 760 ? 72 : 110;
	const aspectRatio = size.width / Math.max(size.height, 1);
	const chunks = useMemo(
		() => chunkFootprint(chunkCenter.x, chunkCenter.z, aspectRatio),
		[aspectRatio, chunkCenter],
	);

	useEffect(() => {
		diagnosticsRef.current.chunks = chunks.length;
	}, [chunks.length, diagnosticsRef]);

	useEffect(() => {
		const canvas = gl.domElement;
		const pointerInput = pointerInputRef.current;
		const updatePointerNdc = (event: PointerEvent | MouseEvent) => {
			const bounds = canvas.getBoundingClientRect();
			if (bounds.width <= 0 || bounds.height <= 0) return false;
			pointerInput.ndc.set(
				((event.clientX - bounds.left) / bounds.width) * 2 - 1,
				-((event.clientY - bounds.top) / bounds.height) * 2 + 1,
			);
			return true;
		};

		const updatePointerPosition = (event: PointerEvent) => {
			const bounds = canvas.getBoundingClientRect();
			if (!updatePointerNdc(event)) return;

			if (pointerInput.hasPreviousPosition) {
				const deltaX = (event.clientX - pointerInput.previousClientX) / bounds.width;
				const deltaY = (event.clientY - pointerInput.previousClientY) / bounds.height;
				const elapsedSeconds = Math.max(0.008, (event.timeStamp - pointerInput.previousEventTime) / 1000);
				const distance = Math.hypot(deltaX, deltaY);
				if (distance > 0.00001) {
					const inverseDistance = 1 / distance;
					const speedSample = THREE.MathUtils.clamp(distance / elapsedSeconds / 1.5, 0, 1);
					const velocityX = deltaX * inverseDistance * speedSample;
					const velocityY = deltaY * inverseDistance * speedSample;
					pointerInput.velocity.x = THREE.MathUtils.lerp(pointerInput.velocity.x, velocityX, 0.35);
					pointerInput.velocity.y = THREE.MathUtils.lerp(pointerInput.velocity.y, velocityY, 0.35);
					pointerInput.remainingGustTime = CURSOR_GUST_DURATION;
				}
			}

			pointerInput.active = true;
			pointerInput.hasPreviousPosition = true;
			pointerInput.previousClientX = event.clientX;
			pointerInput.previousClientY = event.clientY;
			pointerInput.previousEventTime = event.timeStamp;
		};

		const startPointer = (event: PointerEvent) => {
			pointerInput.active = true;
			pointerInput.hasPreviousPosition = false;
			updatePointerPosition(event);
		};

		const stopPointer = () => {
			pointerInput.active = false;
			pointerInput.hasPreviousPosition = false;
			pointerInput.remainingGustTime = 0;
			pointerInput.reversing = false;
			pointerInput.velocity.set(0, 0);
			pointerInput.queuedVelocity.set(0, 0);
		};

		const plantRose = (event: MouseEvent) => {
			if (!updatePointerNdc(event)) return;
			raycaster.setFromCamera(pointerInput.ndc, camera);
			if (!intersectTerrainHeightField(raycaster.ray, pointerTerrainHit, FOG_FAR + 15)) return;
			const id = nextPlantedRoseIdRef.current;
			nextPlantedRoseIdRef.current += 1;
			setPlantedRoses((current) => [...current, {
				id,
				variant: PLANTABLE_ROSE_VARIANTS[id % PLANTABLE_ROSE_VARIANTS.length],
				x: pointerTerrainHit.x,
				z: pointerTerrainHit.z,
				rotation: id * 2.399963,
				plantedAt: clock.elapsedTime,
			}]);
		};

		canvas.addEventListener('pointerenter', startPointer);
		canvas.addEventListener('pointermove', updatePointerPosition);
		canvas.addEventListener('pointerleave', stopPointer);
		canvas.addEventListener('click', plantRose);
		return () => {
			canvas.removeEventListener('pointerenter', startPointer);
			canvas.removeEventListener('pointermove', updatePointerPosition);
			canvas.removeEventListener('pointerleave', stopPointer);
			canvas.removeEventListener('click', plantRose);
		};
	}, [camera, clock, gl, pointerTerrainHit, raycaster]);

	useEffect(() => {
		onReady();
		return () => {
			noiseTexture.dispose();
			chunkOutlineMaterial.dispose();
		};
	}, [chunkOutlineMaterial, noiseTexture, onReady]);

	useFrame(({ clock }, delta) => {
		const cursorWind = cursorWindRef.current;
		const frameDelta = Math.min(delta, 0.05);
		travelRef.current += frameDelta * cameraSpeed;
		const distance = travelRef.current;
		const x = 0;
		const z = -distance;
		const y = terrainHeight(x, z) + cameraHeight;

		camera.position.set(x, y, z);
		camera.rotation.set(-THREE.MathUtils.degToRad(cameraAngle), 0, 0);
		camera.updateMatrixWorld();

		const pointerInput = pointerInputRef.current;
		pointerInput.remainingGustTime = Math.max(0, pointerInput.remainingGustTime - frameDelta);
		let targetCursorStrength = 0;
		raycaster.setFromCamera(pointerInput.ndc, camera);
		if (pointerInput.active && intersectTerrainHeightField(raycaster.ray, pointerTerrainHit, FOG_FAR + 15)) {
			if (cursorWind.strength < 0.005) {
				cursorWind.position.set(pointerTerrainHit.x, pointerTerrainHit.z);
				cursorWind.trailPosition.copy(cursorWind.position);
			}
			else {
				const positionResponse = 1 - Math.exp(-9 * frameDelta);
				pointerTerrainTarget.set(pointerTerrainHit.x, pointerTerrainHit.z);
				cursorWind.position.lerp(pointerTerrainTarget, positionResponse);
			}
			const trailResponse = 1 - Math.exp(-3 * frameDelta);
			cursorWind.trailPosition.lerp(cursorWind.position, trailResponse);
			const hasActiveGust = pointerInput.remainingGustTime > 0;
			const inputSpeed = pointerInput.velocity.length();
			if (
				hasActiveGust
				&& !pointerInput.reversing
				&& cursorWind.strength > CURSOR_REVERSAL_SETTLED_STRENGTH
				&& inputSpeed > CURSOR_REVERSAL_MIN_SPEED
				&& cursorWind.direction.dot(pointerInput.velocity) / inputSpeed < CURSOR_REVERSAL_DOT_THRESHOLD
			) {
				pointerInput.reversing = true;
				pointerInput.queuedVelocity.copy(pointerInput.velocity);
			}

			if (pointerInput.reversing) {
				if (hasActiveGust) pointerInput.queuedVelocity.copy(pointerInput.velocity);
				if (cursorWind.strength <= CURSOR_REVERSAL_SETTLED_STRENGTH) {
					pointerInput.reversing = false;
					if (hasActiveGust && pointerInput.queuedVelocity.lengthSq() > 0.0001) {
						cursorWind.velocity.copy(pointerInput.queuedVelocity);
						const speed = THREE.MathUtils.clamp(cursorWind.velocity.length(), 0, 1);
						cursorWind.direction.copy(cursorWind.velocity).multiplyScalar(1 / speed);
						const easedSpeed = speed * speed * (3 - 2 * speed);
						targetCursorStrength = CURSOR_GUST_MAX_STRENGTH * easedSpeed;
					}
				}
			} else if (hasActiveGust) {
				const velocityResponse = 1 - Math.exp(-8 * frameDelta);
				cursorWind.velocity.lerp(pointerInput.velocity, velocityResponse);
				const speed = THREE.MathUtils.clamp(cursorWind.velocity.length(), 0, 1);
				if (speed > 0.0001) cursorWind.direction.copy(cursorWind.velocity).multiplyScalar(1 / speed);
				const easedSpeed = speed * speed * (3 - 2 * speed);
				targetCursorStrength = CURSOR_GUST_MAX_STRENGTH * easedSpeed;
			} else {
				const velocityDecay = Math.exp(-6 * frameDelta);
				pointerInput.velocity.multiplyScalar(velocityDecay);
				cursorWind.velocity.multiplyScalar(velocityDecay);
			}
		}

		const strengthRate = pointerInput.reversing
			? CURSOR_REVERSAL_BRAKE_RATE
			: targetCursorStrength > cursorWind.strength ? 9 : 2.5;
		const strengthResponse = 1 - Math.exp(-strengthRate * frameDelta);
		cursorWind.strength = THREE.MathUtils.lerp(cursorWind.strength, targetCursorStrength, strengthResponse);

		circleCenter.set(x, 0, z);
		// Shader uniforms are the imperative animation boundary used by Infinite Terrain.
		terrainMaterial.uniforms.uCircleCenter.value.copy(circleCenter);
		chunkOutlineMaterial.uniforms.uCircleCenter.value.copy(circleCenter);
		grassMaterial.uniforms.uCircleCenter.value.copy(circleCenter);
		grassMaterial.uniforms.uCursorWindPosition.value.copy(cursorWind.position);
		grassMaterial.uniforms.uCursorWindTrailPosition.value.copy(cursorWind.trailPosition);
		grassMaterial.uniforms.uCursorWindDirection.value.copy(cursorWind.direction);
		// eslint-disable-next-line react-hooks/immutability
		grassMaterial.uniforms.uCursorWindStrength.value = cursorWind.strength;
		grassMaterial.uniforms.uCursorWindRadius.value = cursorWind.radius;
		grassMaterial.uniforms.uTime.value = clock.elapsedTime;

		const chunkX = Math.round(x / CHUNK_SIZE);
		const chunkZ = Math.round(z / CHUNK_SIZE);
		if (chunkX !== currentChunkRef.current.x || chunkZ !== currentChunkRef.current.z) {
			currentChunkRef.current = { x: chunkX, z: chunkZ };
			setChunkCenter({ x: chunkX, z: chunkZ });
		}
	});

	return (
		<>
			<color args={[atmosphere.zenithColor]} attach="background" />
			<fog attach="fog" args={[atmosphere.fogColor, atmosphere.fogNear, atmosphere.fogFar]} />
			<DirectionalSun strength={atmosphere.sunStrength} direction={atmosphere.sunDirection} color={atmosphere.sunColor} />
			<group renderOrder={cloudRendering === 'stylized' ? -2 : 0}>
				<StylizedStars visibility={atmosphere.starVisibility} now={weatherNow} />
			</group>
			{cloudRendering === 'sheet' && (
				<CloudLayer cloudCover={weather?.cloudCover ?? 0} lightColor={atmosphere.sunColor} darkColor={atmosphere.horizonColor} />
			)}
			{cloudRendering === 'stylized' && (
				<StylizedClouds
					cloudCover={weather?.cloudCover ?? 0}
					sunDirection={atmosphere.sunDirection}
					sunColor={atmosphere.sunColor}
					skyColor={atmosphere.zenithColor}
					horizonColor={atmosphere.horizonColor}
					windSpeed={atmosphericWindSpeed}
					windDirection={atmosphericWindDirection}
				/>
			)}
			<Rainfall intensity={atmosphere.rainIntensity} windSpeed={atmosphericWindSpeed} windDirection={atmosphericWindDirection} />
			<StormLightning enabled={atmosphere.state === 'thunderstorm'} />
			{chunks.map((chunk) => (
					<TerrainChunk
						key={chunk.key}
						x={chunk.x}
						z={chunk.z}
						baseGrassCount={baseGrassCount}
						terrainMaterial={terrainMaterial}
						grassMaterial={grassMaterial}
					/>
			))}
			{showChunkBoundaries && chunks.map((chunk) => (
				<ChunkDebugOutline
					key={`outline-${chunk.key}`}
					x={chunk.x}
					z={chunk.z}
					material={chunkOutlineMaterial}
				/>
			))}
			<FlowerPopulation
				chunks={chunks}
				candidatesPerChunk={flowerCandidateCount}
				noiseTexture={noiseTexture}
				sunDirection={atmosphere.sunDirection}
				skyColor={atmosphere.zenithColor}
				sunColor={atmosphere.sunColor}
				sunStrength={atmosphere.sunStrength}
				ambientTint={atmosphere.ambientTint}
				windSpeed={windSpeed}
				windStrength={windStrength}
				windDirection={windDirection}
				windScale={windScale}
				cursorWindRef={cursorWindRef}
				diagnosticsRef={diagnosticsRef}
				plantedRoses={plantedRoses}
			/>
			<BackgroundSphere
				zenithColor={atmosphere.zenithColor}
				horizonColor={atmosphere.horizonColor}
				sunColor={atmosphere.sunColor}
				sunDirection={atmosphere.sunDirection}
				sunVisibility={atmosphere.sunVisibility}
				moonDirection={atmosphere.moonDirection}
				moonVisibility={atmosphere.moonVisibility}
			/>
		</>
	);
}

export default function FlowerFieldScene({ reducedMotion, showDiagnostics = true, cameraHeight, cameraAngle, showChunkBoundaries, skyColor, sunStrength, cameraSpeed, windSpeed, windStrength, windDirection, windScale, ditherMode, ditherPixelSize, ditherStrength, noiseStrength, noiseScale, weather, weatherNow, cloudRendering, onReady }: FlowerFieldSceneProps) {
	const diagnosticsRef = useRef(createFlowerFieldDiagnosticValues());
	const diagnosticHistoryRef = useRef(createFlowerFieldDiagnosticHistory());
	const handleCreated = useCallback(({ gl }: { gl: THREE.WebGLRenderer }) => {
		gl.toneMapping = THREE.ACESFilmicToneMapping;
		gl.toneMappingExposure = 1;
	}, []);

	return (
		<>
			<Canvas
			shadows="percentage"
			className="flower-field-canvas"
			dpr={[1, 1.75]}
			camera={{ fov: CAMERA_VERTICAL_FOV, near: 0.05, far: 180, position: [0, 1, 4] }}
			gl={{ antialias: true, powerPreference: 'high-performance' }}
			frameloop={reducedMotion ? 'demand' : 'always'}
			onCreated={handleCreated}
			>
				<Suspense fallback={null}>
					<FlowerFieldWorld
					cameraHeight={cameraHeight}
					cameraAngle={cameraAngle}
					showChunkBoundaries={showChunkBoundaries}
					skyColor={skyColor}
					sunStrength={sunStrength}
					cameraSpeed={cameraSpeed}
					windSpeed={windSpeed}
					windStrength={windStrength}
					windDirection={windDirection}
					windScale={windScale}
					ditherMode={ditherMode}
					ditherPixelSize={ditherPixelSize}
					noiseStrength={noiseStrength}
					noiseScale={noiseScale}
					weather={weather}
					weatherNow={weatherNow}
					cloudRendering={cloudRendering}
						onReady={onReady}
						diagnosticsRef={diagnosticsRef}
					/>
					{(showDiagnostics || needsPostprocessing(ditherStrength, noiseStrength)) && (
						<Suspense fallback={null}>
							<FieldRenderEffects
								diagnostics={showDiagnostics ? { metricsRef: diagnosticsRef, historyRef: diagnosticHistoryRef } : undefined}
								ditherMode={ditherMode}
								ditherPixelSize={ditherPixelSize}
								ditherStrength={ditherStrength}
								noiseStrength={noiseStrength}
								noiseScale={noiseScale}
							/>
						</Suspense>
					)}
				</Suspense>
			</Canvas>
			{showDiagnostics && (
				<Suspense fallback={null}>
					<FlowerFieldDiagnostics metricsRef={diagnosticsRef} historyRef={diagnosticHistoryRef} />
				</Suspense>
			)}
		</>
	);
}
