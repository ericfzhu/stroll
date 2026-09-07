#include <common>
#ifndef FLOWER_DEPTH_PASS
#include <shadowmap_pars_vertex>
#endif

uniform float uTime;
uniform sampler2D uNoiseTexture;
uniform float uWindScale;
uniform float uWindStrength;
uniform float uWindSpeed;
uniform float uWindDirection;
uniform vec2 uCursorWindPosition;
uniform vec2 uCursorWindTrailPosition;
uniform vec2 uCursorWindDirection;
uniform float uCursorWindStrength;
uniform float uCursorWindRadius;
uniform float uStemHeight;
uniform float uRoseBloomDuration;
uniform float uRoseBloomStart;
uniform float uRoseStemDuration;
uniform vec3 uCircleCenter;
uniform float uCurvatureRadius;
uniform float uCurvatureStart;

attribute vec3 color;
attribute float aHeadRigidity;
attribute vec3 aBudPosition;
attribute float aBloomStart;

#ifdef FLOWER_DEPTH_PASS
varying vec2 vHighPrecisionZW;
#else
varying vec3 vColor;
varying vec3 vNormal;
varying vec3 vWorldPosition;
#endif

mat3 rotateAxis(vec3 axis, float angle) {
  float s = sin(angle);
  float c = cos(angle);
  float oc = 1.0 - c;

  return mat3(
    oc * axis.x * axis.x + c,
    oc * axis.x * axis.y - axis.z * s,
    oc * axis.z * axis.x + axis.y * s,
    oc * axis.x * axis.y + axis.z * s,
    oc * axis.y * axis.y + c,
    oc * axis.y * axis.z - axis.x * s,
    oc * axis.z * axis.x - axis.y * s,
    oc * axis.y * axis.z + axis.x * s,
    oc * axis.z * axis.z + c
  );
}

mat3 transposeMat3(mat3 matrix) {
  return mat3(
    matrix[0][0], matrix[1][0], matrix[2][0],
    matrix[0][1], matrix[1][1], matrix[2][1],
    matrix[0][2], matrix[1][2], matrix[2][2]
  );
}

void main() {
  vec3 flowerBase = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  mat3 instanceWorldTransform = mat3(modelMatrix * instanceMatrix);
  float bloomAge = max(0.0, uTime - aBloomStart);
  float stemProgress = clamp(bloomAge / uRoseStemDuration, 0.0, 1.0);
  float easedStemProgress = 1.0 - pow(1.0 - stemProgress, 3.0);
  float bloomProgress = smoothstep(uRoseBloomStart, uRoseBloomDuration, bloomAge);
  vec3 animatedPosition = mix(aBudPosition, position, bloomProgress);
  animatedPosition.y *= mix(0.01, 1.0, easedStemProgress);
  float animatedStemHeight = uStemHeight * mix(0.01, 1.0, easedStemProgress);
  float heightPercent = smoothstep(0.0, animatedStemHeight, animatedPosition.y);

  vec2 windUv = flowerBase.xz * uWindScale * 0.1 + vec2(uTime * uWindSpeed * 0.1);
  float windNoise = texture2D(uNoiseTexture, windUv).r * 2.0 - 1.0;
  vec2 detailUv = flowerBase.xz * 0.5 + vec2(uTime * uWindSpeed * 0.02);
  float detailNoise = texture2D(uNoiseTexture, detailUv).r * 2.0 - 1.0;

  vec3 windAxis = vec3(cos(uWindDirection), 0.0, sin(uWindDirection));
  float fullWindAngle = windNoise * uWindStrength + detailNoise * 0.12;
  vec2 cursorWindTrail = uCursorWindPosition - uCursorWindTrailPosition;
  float cursorWindTrailLengthSq = max(dot(cursorWindTrail, cursorWindTrail), 0.0001);
  float cursorWindTrailProgress = clamp(
    dot(flowerBase.xz - uCursorWindTrailPosition, cursorWindTrail) / cursorWindTrailLengthSq,
    0.0,
    1.0
  );
  vec2 closestCursorWindPoint = uCursorWindTrailPosition + cursorWindTrail * cursorWindTrailProgress;
  float cursorWindDistance = distance(flowerBase.xz, closestCursorWindPoint);
  float cursorWindFalloff = 1.0 - smoothstep(0.0, uCursorWindRadius, cursorWindDistance);
  cursorWindFalloff *= mix(0.3, 1.0, cursorWindTrailProgress);
  vec2 cursorWindDirection = normalize(uCursorWindDirection);
  vec3 cursorWindAxisWorld = vec3(-cursorWindDirection.y, 0.0, cursorWindDirection.x);
  vec3 cursorWindAxis = normalize(transposeMat3(instanceWorldTransform) * cursorWindAxisWorld);
  float cursorWindAngle = uCursorWindStrength * cursorWindFalloff * 0.55;
  mat3 localWindRotation = rotateAxis(cursorWindAxis, cursorWindAngle * heightPercent) * rotateAxis(windAxis, fullWindAngle * heightPercent);
  mat3 tipWindRotation = rotateAxis(cursorWindAxis, cursorWindAngle) * rotateAxis(windAxis, fullWindAngle);
  vec3 stemTip = tipWindRotation * vec3(0.0, animatedStemHeight, 0.0);
  vec3 rigidHeadPosition = stemTip + tipWindRotation * (animatedPosition - vec3(0.0, animatedStemHeight, 0.0));
  vec3 flexiblePosition = localWindRotation * animatedPosition;
  vec3 transformed = mix(flexiblePosition, rigidHeadPosition, aHeadRigidity);
  vec4 worldPosition = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
	float curvatureDistance = max(0.0, length(worldPosition.xz - uCircleCenter.xz) - uCurvatureStart);
	worldPosition.y -= curvatureDistance * curvatureDistance / (2.0 * uCurvatureRadius);
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
#ifdef FLOWER_DEPTH_PASS
  vHighPrecisionZW = gl_Position.zw;
#else
  mat3 vertexWindRotation = aHeadRigidity > 0.5 ? tipWindRotation : localWindRotation;
  mat3 worldRotation = instanceWorldTransform * vertexWindRotation;

  vColor = color;
  vNormal = normalize(worldRotation * normal);
  vWorldPosition = worldPosition.xyz;
	vec3 transformedNormal = normalize((viewMatrix * vec4(vNormal, 0.0)).xyz);
	#include <shadowmap_vertex>
#endif
}
