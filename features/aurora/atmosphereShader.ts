/**
 * Aurora shader using SKSL (Skia Shading Language)
 * Renders a living aurora sky with flowing bands and shimmer
 */

export const AURORA_SKSL = `
  // Uniforms
  uniform vec2  uResolution;
  uniform float uTime;
  uniform float uSpeed;
  uniform float uIntensity;
  uniform vec3  uSkyTop;
  uniform vec3  uSkyBottom;
  uniform vec3  uColor1;
  uniform vec3  uColor2;
  uniform vec3  uColor3;

  // Pseudo-random number generator
  float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
  }

  // Simplex-like noise approximation
  float noise(vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);
    f = f * f * (3.0 - 2.0 * f);

    float a = random(i);
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));

    float ab = mix(a, b, f.x);
    float cd = mix(c, d, f.x);
    return mix(ab, cd, f.y);
  }

  // Fractal Brownian Motion (FBM) for natural-looking patterns
  float fbm(vec2 st) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;

    for (int i = 0; i < 2; i++) {
      value += amplitude * noise(st * frequency);
      amplitude *= 0.5;
      frequency *= 2.0;
    }

    return value;
  }

  vec4 main(vec2 fragCoord) {
    vec2 uv = fragCoord / uResolution;

    // Sky gradient: top to bottom
    vec3 sky = mix(uSkyTop, uSkyBottom, uv.y);

    // Aurora zone: strong at top (header), fades quickly toward content
    // Inverted: 1.0 near top (y=0), 0.0 by ~y=0.35
    float auroraZone = smoothstep(0.4, 0.0, uv.y);

    // Drift the aurora bands horizontally over time
    float drift = uTime * uSpeed * 0.0001;

    // Aurora band 1
    float band1Y = 0.12;
    float band1Center = band1Y + fbm(vec2(uv.x + drift, uTime * uSpeed * 0.00005)) * 0.06;
    float band1Shape = smoothstep(0.04, 0.0, abs(uv.y - band1Center));
    float band1Shimmer = noise(uv * 20.0 + uTime * 0.01) * uIntensity * uIntensity;
    float band1 = (band1Shape * 1.2 + band1Shimmer * 0.4) * auroraZone;

    // Aurora band 2 (mid - still visible, transitioning)
    float band2Y = 0.22;
    float band2Center = band2Y + fbm(vec2(uv.x + drift * 0.7, uTime * uSpeed * 0.00008)) * 0.07;
    float band2Shape = smoothstep(0.045, 0.0, abs(uv.y - band2Center));
    float band2Shimmer = noise(uv * 15.0 + uTime * 0.012 + 100.0) * uIntensity * uIntensity;
    float band2 = (band2Shape * 1.1 + band2Shimmer * 0.35) * auroraZone * smoothstep(0.35, 0.15, uv.y);

    // Aurora band 3 (low - subtle, fading)
    float band3Y = 0.32;
    float band3Center = band3Y + fbm(vec2(uv.x + drift * 0.5, uTime * uSpeed * 0.0001)) * 0.08;
    float band3Shape = smoothstep(0.05, 0.0, abs(uv.y - band3Center));
    float band3Shimmer = noise(uv * 10.0 + uTime * 0.014 + 200.0) * uIntensity * uIntensity;
    float band3 = (band3Shape * 0.9 + band3Shimmer * 0.3) * auroraZone * smoothstep(0.4, 0.25, uv.y);

    // Combine aurora bands with intensity
    vec3 aurora = vec3(0.0);
    aurora += band1 * uColor1 * uIntensity * 1.1;  // Top band: brightest
    aurora += band2 * uColor2 * uIntensity * 0.9;  // Mid band: moderate
    aurora += band3 * uColor3 * uIntensity * 0.6;  // Low band: subtle

    // Blend aurora into sky
    vec3 result = sky + aurora;

    // Elegant vignette: subtle at top, darker toward bottom for content separation
    float vignetteTop = 1.0 - smoothstep(0.0, 0.15, uv.y) * 0.15;  // Slight fade at very top
    float vignetteBottom = 1.0 - smoothstep(0.65, 1.0, uv.y) * 0.25;  // Gradual darkening below content
    float vignette = vignetteTop * vignetteBottom;
    result *= vignette;

    return vec4(result, 1.0);
  }
`;

/**
 * Convert RGBA [0-255] to float vec3 [0-1] for shader input
 * Marked as worklet to run on the UI thread
 */
export function toFloat3(
  rgba: [number, number, number, number],
): [number, number, number] {
  "worklet";
  return [rgba[0] / 255, rgba[1] / 255, rgba[2] / 255];
}
