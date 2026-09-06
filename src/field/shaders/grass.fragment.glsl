#include <common>
#include <lights_pars_begin>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>

uniform float uPixelSize;
uniform int uDitherMode;
uniform vec3 uSunDirection;
uniform vec3 uSunColor;
uniform vec3 uSkyLightColor;
uniform float uSunStrength;
uniform vec3 uAmbientTint;

varying vec3 vColor;
varying vec3 vNormal;
varying float vGrassMask;

float getDiamondThreshold(vec2 fragCoord, float pixelSize) {
  vec2 uv = mod(fragCoord + 0.01, pixelSize);
  vec2 centered = (uv / pixelSize) * 2.0 - 1.0;
  return (abs(centered.x) + abs(centered.y)) / 2.0;
}

float getBayerThreshold(vec2 fragCoord, float pixelSize) {
  vec2 pixelCoord = floor(fragCoord / pixelSize);
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
  return float(M[y * 8 + x]) / 64.0;
}

bool shouldDiscard(vec2 fragCoord, float pixelSize, float fadeLevel, int mode) {
  if (fadeLevel <= 0.0) return false;
  if (fadeLevel >= 1.0) return true;
  float threshold = mode == 0
    ? getDiamondThreshold(fragCoord, pixelSize + 4.0)
    : getBayerThreshold(fragCoord, pixelSize);
  return threshold < fadeLevel;
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
  vec3 lighting = diffuseLighting * uSunStrength * shadow + ambientLighting * 0.42 * uAmbientTint;
  vec3 color = vColor * lighting;

  if (vGrassMask < 0.99) {
    float fade = 1.0 - vGrassMask;
    if (shouldDiscard(gl_FragCoord.xy, uPixelSize, fade, uDitherMode)) discard;
  }

  gl_FragColor = vec4(color, 1.0);

  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
