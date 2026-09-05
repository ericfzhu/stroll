import { useCallback, useEffect, useMemo, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FlowerFieldSceneMetrics } from './FlowerFieldDiagnostics';
import type { FlowerFieldDiagnosticValues, FlowerFieldDiagnosticHistory } from './flowerFieldDiagnosticState';
import { needsPostprocessing } from './renderFrame';

const FIELD_EFFECT_FRAGMENT_SHADER = `
	uniform sampler2D tDiffuse;
	uniform float uPixelSize;
	uniform int uDitherMode;
	uniform float uDitherStrength;
	uniform float uNoiseStrength;
	uniform float uNoiseScale;
	varying vec2 vUv;

	float hash(vec2 point) {
		return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453);
	}

	float valueNoise(vec2 point) {
		vec2 cell = floor(point);
		vec2 blend = fract(point);
		blend = blend * blend * (3.0 - 2.0 * blend);
		return mix(
			mix(hash(cell), hash(cell + vec2(1.0, 0.0)), blend.x),
			mix(hash(cell + vec2(0.0, 1.0)), hash(cell + vec2(1.0, 1.0)), blend.x),
			blend.y
		);
	}

	float gradientNoise(vec2 point) {
		float value = 0.0;
		float amplitude = 0.57;
		for (int octave = 0; octave < 4; octave++) {
			value += valueNoise(point) * amplitude;
			point = point * 2.03 + vec2(19.1, 7.7);
			amplitude *= 0.48;
		}
		return value;
	}

	float diamondThreshold(vec2 fragCoord, float pixelSize) {
		vec2 cell = fract(fragCoord / max(pixelSize, 1.0));
		vec2 centered = cell * 2.0 - 1.0;
		return clamp((abs(centered.x) + abs(centered.y)) * 0.5, 0.0, 1.0);
	}

	float bayerThreshold(vec2 fragCoord, float pixelSize) {
		vec2 pixelCoord = floor(fragCoord / max(pixelSize, 1.0));
		int x = int(mod(pixelCoord.x, 8.0));
		int y = int(mod(pixelCoord.y, 8.0));
		int M[64];
		M[0]=0;  M[1]=32; M[2]=8;  M[3]=40; M[4]=2;  M[5]=34; M[6]=10; M[7]=42;
		M[8]=48; M[9]=16; M[10]=56;M[11]=24;M[12]=50;M[13]=18;M[14]=58;M[15]=26;
		M[16]=12;M[17]=44;M[18]=4; M[19]=36;M[20]=14;M[21]=46;M[22]=6; M[23]=38;
		M[24]=60;M[25]=28;M[26]=52;M[27]=20;M[28]=62;M[29]=30;M[30]=54;M[31]=22;
		M[32]=3; M[33]=35;M[34]=11;M[35]=43;M[36]=1; M[37]=33;M[38]=9; M[39]=41;
		M[40]=51;M[41]=19;M[42]=59;M[43]=27;M[44]=49;M[45]=17;M[46]=57;M[47]=25;
		M[48]=15;M[49]=47;M[50]=7; M[51]=39;M[52]=13;M[53]=45;M[54]=5; M[55]=37;
		M[56]=63;M[57]=31;M[58]=55;M[59]=23;M[60]=61;M[61]=29;M[62]=53;M[63]=21;
		return (float(M[y * 8 + x]) + 0.5) / 64.0;
	}

	void main() {
		vec3 color = texture2D(tDiffuse, vUv).rgb;
		float noiseFrequency = mix(0.008, 0.085, clamp(uNoiseScale / 1.5, 0.0, 1.0));
		float noiseValue = gradientNoise(gl_FragCoord.xy * noiseFrequency) - 0.5;
		color = clamp(color + noiseValue * uNoiseStrength * 0.18, 0.0, 1.0);

		float threshold = uDitherMode == 0
			? diamondThreshold(gl_FragCoord.xy, uPixelSize + 3.0)
			: bayerThreshold(gl_FragCoord.xy, uPixelSize);
		const float colorLevels = 10.0;
		vec3 ditheredColor = floor(color * colorLevels + threshold) / colorLevels;
		color = mix(color, ditheredColor, clamp(uDitherStrength, 0.0, 1.0));

		gl_FragColor = vec4(color, 1.0);
		#include <tonemapping_fragment>
		#include <colorspace_fragment>
	}
`;

export default function FieldRenderEffects({ ditherMode, ditherPixelSize, ditherStrength, noiseStrength, noiseScale, diagnostics }: {
	diagnostics?: { metricsRef: RefObject<FlowerFieldDiagnosticValues>; historyRef: RefObject<FlowerFieldDiagnosticHistory> };
	ditherMode: 0 | 1;
	ditherPixelSize: number;
	ditherStrength: number;
	noiseStrength: number;
	noiseScale: number;
}) {
	const { camera, gl, scene, size } = useThree();
	const enabled = needsPostprocessing(ditherStrength, noiseStrength);
	const pipeline = useMemo(() => {
		if (!enabled) return null;
		const nextComposer = new EffectComposer(gl);
		nextComposer.addPass(new RenderPass(scene, camera));
		const nextEffectPass = new ShaderPass({
			uniforms: {
				tDiffuse: { value: null },
				uPixelSize: { value: 1 },
				uDitherMode: { value: 0 },
				uDitherStrength: { value: 0 },
				uNoiseStrength: { value: 0 },
				uNoiseScale: { value: 0 },
			},
			vertexShader: `
				varying vec2 vUv;
				void main() {
					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
				}
			`,
			fragmentShader: FIELD_EFFECT_FRAGMENT_SHADER,
		});
		nextComposer.addPass(nextEffectPass);
		return { composer: nextComposer, effectPass: nextEffectPass };
	}, [camera, enabled, gl, scene]);

	useEffect(() => {
		if (!pipeline) return;
		pipeline.composer.setPixelRatio(gl.getPixelRatio());
		pipeline.composer.setSize(size.width, size.height);
	}, [pipeline, gl, size.height, size.width]);

	useEffect(() => {
		if (!pipeline) return;
		const { effectPass } = pipeline;
		effectPass.uniforms.uPixelSize.value = ditherPixelSize;
		effectPass.uniforms.uDitherMode.value = ditherMode;
		effectPass.uniforms.uDitherStrength.value = ditherStrength;
		effectPass.uniforms.uNoiseStrength.value = noiseStrength;
		effectPass.uniforms.uNoiseScale.value = noiseScale;
	}, [ditherMode, ditherPixelSize, ditherStrength, pipeline, noiseScale, noiseStrength]);

	useEffect(() => () => {
		pipeline?.effectPass.dispose();
		pipeline?.composer.dispose();
	}, [pipeline]);
	const renderFrame = useCallback(() => {
		if (pipeline) pipeline.composer.render();
		else gl.render(scene, camera);
	}, [camera, gl, pipeline, scene]);
	useFrame(() => {
		if (!diagnostics) renderFrame();
	}, 1);
	return diagnostics ? <FlowerFieldSceneMetrics {...diagnostics} renderFrame={renderFrame} /> : null;
}

