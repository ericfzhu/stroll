import * as THREE from 'three';
import flowerVertexShader from './shaders/flowers.vertex.glsl?raw';

export function createFlowerDepthMaterial(material: THREE.ShaderMaterial): THREE.MeshDepthMaterial {
	const depthMaterial = new THREE.MeshDepthMaterial({
		depthPacking: THREE.RGBADepthPacking,
		side: THREE.DoubleSide,
	});
	depthMaterial.defines = { FLOWER_DEPTH_PASS: 1 };
	depthMaterial.onBeforeCompile = (shader) => {
		// Share uniform objects so shadows use the exact same clock, bloom and wind.
		Object.assign(shader.uniforms, material.uniforms);
		shader.vertexShader = flowerVertexShader;
	};
	depthMaterial.customProgramCacheKey = () => 'flower-depth';
	return depthMaterial;
}
