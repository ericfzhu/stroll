#include <common>
#include <shadowmap_pars_vertex>

uniform float uTime;

// Blade parameters
uniform float uGrassSegments;
uniform float uGrassChunkSize;
uniform float uGrassWidth;
uniform float uGrassMidWidth;
uniform float uGrassFarWidth;
uniform float uGrassNearTransitionStart;
uniform float uGrassNearTransitionEnd;
uniform float uGrassFarTransitionStart;
uniform float uGrassFarTransitionEnd;
uniform float uGrassHeight;
uniform float uLeanFactor;
uniform vec3 uGrassBaseColor;
uniform vec3 uGrassTopColor;

// Wind parameters
uniform float uWindScale;
uniform float uWindStrength;
uniform float uWindSpeed;
uniform float uWindDirection;
uniform vec2 uCursorWindPosition;
uniform vec2 uCursorWindTrailPosition;
uniform vec2 uCursorWindDirection;
uniform float uCursorWindStrength;
uniform float uCursorWindRadius;

uniform vec3 uCircleCenter;      // smoothed center for visual circle effect (lerps with camera)
uniform float uCurvatureRadius;
uniform float uCurvatureStart;

// Border parameters
uniform sampler2D uNoiseTexture;
uniform float uNoiseStrength;    
uniform float uNoiseScale;       
uniform float uCircleRadiusFactor; 
uniform float uGrassFadeOffset;

// Attributes
attribute vec3 aInstancePosition; // per-blade base position in chunk space

// Varyings
varying vec3 vColor;
varying vec3 vNormal;
varying float vGrassMask;

#include includes.glsl

void main() {
  int GRASS_SEGMENTS = int(uGrassSegments);
  int GRASS_VERTICES = (GRASS_SEGMENTS + 1) * 2;
  float GRASS_PATCH_SIZE = uGrassChunkSize * 0.5;
  float GRASS_HEIGHT = uGrassHeight;
  float grassHeight = 1.0;
  float grassMinHeight = 0.25;
  
  // world space position of the blade
  vec3 grassOffset = aInstancePosition;
  vec3 grassBladeWorldPos = (modelMatrix * vec4(grassOffset, 1.0)).xyz;
  vec2 worldXZ = grassBladeWorldPos.xz;  
  vec3 hashVal = hash(grassBladeWorldPos); // hash value for the blade

  // blade distance from center
  vec2 circleXZ = uCircleCenter.xz;
  vec2 deltaXZCircle = worldXZ - circleXZ;
  float distToCircle = length(deltaXZCircle);
  float nearLodBlend = smoothstep(uGrassNearTransitionStart, uGrassNearTransitionEnd, distToCircle);
  float farLodBlend = smoothstep(uGrassFarTransitionStart, uGrassFarTransitionEnd, distToCircle);
  float GRASS_WIDTH = mix(mix(uGrassWidth, uGrassMidWidth, nearLodBlend), uGrassFarWidth, farLodBlend);
  
  // Sample noise texture at world position
  vec2 noiseUV = worldXZ * uNoiseScale * 0.1;
  float noiseValue = texture2D(uNoiseTexture, noiseUV).r;
  
  // Remap noise from [0, 1] to [-1, 1] and apply strength
  float noiseOffset = (noiseValue * 2.0 - 1.0) * uNoiseStrength;
  
  // grass circle border with noise applied
  float grassRadius = uGrassChunkSize * uCircleRadiusFactor * (1.0 + noiseOffset);
  float grassMask = 1.0 - smoothstep(grassRadius - uGrassFadeOffset, grassRadius, distToCircle);
  grassHeight *= grassMask;

  // blade geometry
  int vertFB_ID = gl_VertexID % (GRASS_VERTICES * 2);
  int vertID = vertFB_ID % GRASS_VERTICES;

  int xTest = vertID & 0x1;
  int zTest = vertFB_ID >= GRASS_VERTICES ? 1 : -1;
  float xSide = float(xTest);   // 0 = left, 1 = right
  float zSide = float(zTest);   // front/back side
  float heightPercent = float(vertID - xTest) / (float(GRASS_SEGMENTS) * 2.0);

  // Collapse the intermediate rows continuously before the CPU switches to
  // their equivalent lower-detail indices. Shared endpoints never move.
  float twoSegmentHeight = floor(heightPercent * 2.0 + 0.0001) * 0.5;
  heightPercent = mix(heightPercent, twoSegmentHeight, nearLodBlend);
  float oneSegmentHeight = floor(heightPercent + 0.0001);
  heightPercent = mix(heightPercent, oneSegmentHeight, farLodBlend);

  float randomHeight = (rand(float(gl_InstanceID)) * 2.0 - 1.0) * 0.2;
  float width = GRASS_WIDTH * easeOut(1.08 - heightPercent, 2.0) * grassHeight;
  float height = GRASS_HEIGHT * grassHeight + randomHeight;

  float x = (xSide - 0.5) * width;
  float y = heightPercent * height;
  float z = 0.0;

  // wind + base bending (bezier curve)
  // Use texture noise for wind
  vec2 windUV = (grassBladeWorldPos.xz * uWindScale * 0.1) + vec2(uTime * uWindSpeed * 0.1);
  float windStrength = texture2D(uNoiseTexture, windUV).r * 2.0 - 1.0;
  
  vec3 windAxis = vec3(cos(uWindDirection), 0.0, sin(uWindDirection));
  float windLeanAngle = windStrength * uWindStrength * heightPercent;

  vec2 cursorWindTrail = uCursorWindPosition - uCursorWindTrailPosition;
  float cursorWindTrailLengthSq = max(dot(cursorWindTrail, cursorWindTrail), 0.0001);
  float cursorWindTrailProgress = clamp(
    dot(worldXZ - uCursorWindTrailPosition, cursorWindTrail) / cursorWindTrailLengthSq,
    0.0,
    1.0
  );
  vec2 closestCursorWindPoint = uCursorWindTrailPosition + cursorWindTrail * cursorWindTrailProgress;
  float cursorWindDistance = distance(worldXZ, closestCursorWindPoint);
  float cursorWindFalloff = 1.0 - smoothstep(0.0, uCursorWindRadius, cursorWindDistance);
  cursorWindFalloff *= mix(0.3, 1.0, cursorWindTrailProgress);
  vec2 cursorWindDirection = normalize(uCursorWindDirection);
  vec3 cursorWindAxis = vec3(-cursorWindDirection.y, 0.0, cursorWindDirection.x);
  float cursorWindAngle = uCursorWindStrength * cursorWindFalloff * heightPercent;
  
  // Secondary high-frequency noise for random animation
  vec2 windUV2 = (grassBladeWorldPos.xz * 0.5) + vec2(uTime * uWindSpeed * 0.02);
  float randomLeanAnimation = (texture2D(uNoiseTexture, windUV2).r * 2.0 - 1.0) * (windStrength * 0.5 + 0.125);

  float leanFactor =
    remap(hashVal.y, -1.0, 1.0, -uLeanFactor, uLeanFactor) + randomLeanAnimation;

  // bezier curve describes the blade center-line bending
  vec3 p1 = vec3(0.0);
  vec3 p2 = vec3(0.0, 0.33, 0.0);
  vec3 p3 = vec3(0.0, 0.66, 0.0);
  vec3 p4 = vec3(0.0, cos(leanFactor), sin(leanFactor));
  vec3 curve = bezier(p1, p2, p3, p4, heightPercent);

  y = curve.y * height;
  z = curve.z * height;

  float angle = remap(hashVal.x, -1.0, 1.0, -PI / 4.0, PI / 4.0);
  mat3 grassMat = rotateAxis(cursorWindAxis, cursorWindAngle) * rotateAxis(windAxis, windLeanAngle) * rotateY(angle);

  vec3 grassLocalPosition = grassMat * vec3(x, y, z) + grassOffset;

  // Grass local normal
  vec3 curveGrad = bezierGrad(p1, p2, p3, p4, heightPercent);
  mat2 curveRot90 = mat2(
       0.0,  1.0,
      -1.0,  0.0
    ) * -zSide;

  vec3 grassLocalNormal = grassMat * vec3(0.0, curveRot90 * curveGrad.yz);
  float distanceBlend = smoothstep(0.0, 10.0, distance(cameraPosition, grassBladeWorldPos));
  grassLocalNormal = mix(grassLocalNormal, vec3(0.0, 1.0, 0.0), distanceBlend * 0.5);
  grassLocalNormal = normalize(grassLocalNormal);

  vec4 worldPosition = modelMatrix * vec4(grassLocalPosition, 1.0);
  float curvatureDistance = max(0.0, length(worldPosition.xz - uCircleCenter.xz) - uCurvatureStart);
  worldPosition.y -= curvatureDistance * curvatureDistance / (2.0 * uCurvatureRadius);
  vec4 mvPosition = viewMatrix * worldPosition;

  // View space thickening
  vec3 viewDir = normalize(cameraPosition - grassBladeWorldPos);
  vec3 grassFaceNormal = grassMat * vec3(0.0, 0.0, -zSide);
  float viewDotNormal = saturateValue(dot(grassFaceNormal, viewDir));
  float viewSpaceThickenFactor = easeOut(1.0 - viewDotNormal, 4.0) * smoothstep(0.0, 0.2, viewDotNormal);
  mvPosition.x += viewSpaceThickenFactor * (xSide - 0.5) * width * 0.5 * -zSide;

  gl_Position = projectionMatrix * mvPosition;
  gl_Position.w = grassHeight < grassMinHeight ? 0.0 : gl_Position.w;


  // Varyings
  vColor = mix(uGrassBaseColor, uGrassTopColor, heightPercent);
  vNormal = normalize((modelMatrix * vec4(grassLocalNormal, 0.0)).xyz);
	#include <shadowmap_vertex>
  vGrassMask = grassMask;
}
