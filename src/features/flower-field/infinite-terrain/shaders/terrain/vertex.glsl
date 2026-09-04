#include <common>
#include <shadowmap_pars_vertex>

varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
varying vec2 vUv;

uniform vec3 uCircleCenter;
uniform float uCurvatureRadius;
uniform float uCurvatureStart;

void main() {
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
	float curvatureDistance = max(0.0, length(worldPos.xz - uCircleCenter.xz) - uCurvatureStart);
	worldPos.y -= curvatureDistance * curvatureDistance / (2.0 * uCurvatureRadius);
	vec4 worldPosition = worldPos;
	vec3 transformedNormal = normalize(normalMatrix * normal);

  vWorldPosition = worldPos.xyz;
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  vUv = uv;

  gl_Position = projectionMatrix * viewMatrix * worldPos;
	#include <shadowmap_vertex>
}
