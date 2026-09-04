#include <common>
#include <lights_pars_begin>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>

uniform float uPixelSize;
uniform vec3 uSunDirection;
uniform vec3 uSunColor;
uniform vec3 uSkyLightColor;
uniform float uSunStrength;

varying vec3 vColor;
varying vec3 vNormal;
varying float vGrassMask;

float getDiamondThreshold(vec2 fragCoord, float pixelSize) {
  vec2 uv = mod(fragCoord + 0.01, pixelSize);
  vec2 centered = (uv / pixelSize) * 2.0 - 1.0;
  return (abs(centered.x) + abs(centered.y)) / 2.0;
}

bool shouldDiscard(vec2 fragCoord, float pixelSize, float fadeLevel) {
  if (fadeLevel <= 0.0) return false;
  if (fadeLevel >= 1.0) return true;
  return getDiamondThreshold(fragCoord, pixelSize + 4.0) < fadeLevel;
}

vec3 lambertLight(vec3 normal, vec3 lightDirection, vec3 lightColor) {
  return max(dot(normal, lightDirection), 0.0) * lightColor;
}

vec3 hemiLight(vec3 normal, vec3 groundColor, vec3 skyColor) {
  return mix(groundColor, skyColor, 0.5 * normal.y + 0.5);
}

void main() {
  vec3 normal = normalize(vNormal);
  vec3 ambientLighting = hemiLight(normal, vec3(0.12, 0.16, 0.07), uSkyLightColor);
  vec3 diffuseLighting = lambertLight(normal, normalize(uSunDirection), uSunColor);
  float shadow = getShadowMask();
  vec3 lighting = diffuseLighting * uSunStrength * shadow + ambientLighting * 0.42;
  vec3 color = vColor * lighting;

  if (vGrassMask < 0.99) {
    float fade = 1.0 - vGrassMask;
    if (shouldDiscard(gl_FragCoord.xy, uPixelSize, fade)) discard;
  }

  gl_FragColor = vec4(color, 1.0);

  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
