#include <common>
#include <lights_pars_begin>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>

varying vec3 vColor;
varying vec3 vNormal;
varying vec3 vWorldPosition;

uniform vec3 uSunDirection;
uniform vec3 uSunColor;
uniform vec3 uSkyLightColor;
uniform float uSunStrength;

float saturateValue(float value) {
  return clamp(value, 0.0, 1.0);
}

vec3 lambertLight(vec3 normal, vec3 lightDirection, vec3 lightColor) {
  return saturateValue(dot(normal, lightDirection)) * lightColor;
}

vec3 hemiLight(vec3 normal, vec3 groundColor, vec3 skyColor) {
  return mix(groundColor, skyColor, 0.5 * normal.y + 0.5);
}

void main() {
  vec3 normal = normalize(gl_FrontFacing ? vNormal : -vNormal);
  vec3 ambient = hemiLight(normal, vec3(0.18, 0.22, 0.1), uSkyLightColor);
  vec3 diffuse = lambertLight(normal, normalize(uSunDirection), uSunColor);
  float shadow = getShadowMask();
  vec3 lighting = diffuse * uSunStrength * shadow + ambient * 0.42;

  gl_FragColor = vec4(vColor * lighting, 1.0);

  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
