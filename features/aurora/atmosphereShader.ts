/**
 * Aurora shader using SKSL (Skia Shading Language)
 *
 * Visual layers (each unlocks gradually as uIntensity grows):
 *   0.00 – 0.05  → Deep sky gradient, bare atmosphere
 *   0.05 – 0.20  → Faint aurora wisps appear
 *   0.15 – 0.55  → Stars emerge and twinkle
 *   0.20 – 0.60  → Domain-warped aurora bands undulate
 *   0.30 – 0.70  → Third deep band sweeps in
 *   0.45 – 1.00  → Curtain rays — vertical light shafts pulse
 *
 * uIntensity is now continuous 0.0→1.0 (0 min → 10 h of focus)
 */

export const AURORA_SKSL = `
  uniform vec2  uResolution;
  uniform float uTime;
  uniform float uSpeed;
  uniform float uIntensity;
  uniform vec3  uSkyTop;
  uniform vec3  uSkyBottom;
  uniform vec3  uColor1;
  uniform vec3  uColor2;
  uniform vec3  uColor3;

  // ─── Noise primitives ───────────────────────────────────────────────────────

  float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
  }

  float noise(vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);
    f = f * f * (3.0 - 2.0 * f);
    float a = random(i);
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  // Manually unrolled FBM (2 octaves) — safe for SKSL
  // 3rd octave dropped (12.5% contribution, imperceptible at render scale)
  float fbm(vec2 st) {
    return 0.571 * noise(st)
         + 0.286 * noise(st * 2.0);
  }

  // ─── Domain warp ────────────────────────────────────────────────────────────
  // Displaces UV space via two fbm passes for organic, silk-like band shapes

  vec2 domainWarp(vec2 p) {
    float t = uTime * uSpeed * 0.000045;
    float wx = fbm(p * 0.9 + vec2(t, 0.0));
    float wy = fbm(p * 0.9 + vec2(0.0, t * 0.75) + vec2(3.14, 1.59));
    return vec2(wx - 0.5, wy - 0.5) * 0.28;
  }

  // ─── Star field ─────────────────────────────────────────────────────────────
  // Two layers: large sparse stars + small dense stars, both twinkling

  float starField(vec2 uv) {
    // Layer 1 — brighter, sparser
    vec2 g1 = floor(uv * 105.0);
    vec2 f1 = fract(uv * 105.0) - 0.5;
    float r1 = random(g1);
    float twinkle1 = sin(r1 * 317.0 + uTime * r1 * 0.0018) * 0.35 + 0.65;
    float s1 = smoothstep(0.09, 0.0, length(f1)) * step(0.958, r1) * twinkle1;

    // Layer 2 — dimmer, denser
    vec2 g2 = floor(uv * 230.0 + vec2(43.7, 19.1));
    vec2 f2 = fract(uv * 230.0 + vec2(43.7, 19.1)) - 0.5;
    float r2 = random(g2);
    float twinkle2 = sin(r2 * 213.0 + uTime * r2 * 0.0013) * 0.40 + 0.60;
    float s2 = smoothstep(0.046, 0.0, length(f2)) * step(0.976, r2) * twinkle2 * 0.60;

    return s1 + s2;
  }

  // ─── Curtain ray ────────────────────────────────────────────────────────────
  // Vertical light shaft — mimics real aurora curtains

  float curtainRay(float centerX, float uvx, float uvy, float phase) {
    float sway = sin(uTime * uSpeed * 0.00011 + phase) * 0.022;
    float dist = abs(uvx - centerX - sway);
    float ray = smoothstep(0.055, 0.0, dist);
    // Fade from top downward (rays hang from the aurora band)
    float vertFade = pow(max(1.0 - uvy * 1.9, 0.0), 1.4);
    float pulse = sin(uTime * uSpeed * 0.00032 + phase * 2.6) * 0.20 + 0.80;
    return ray * vertFade * pulse;
  }

  // ─── Main ───────────────────────────────────────────────────────────────────

  vec4 main(vec2 fragCoord) {
    vec2 uv = fragCoord / uResolution;
    float drift = uTime * uSpeed * 0.0001;

    // ── Sky gradient ──────────────────────────────────────────────────────────
    vec3 sky = mix(uSkyTop, uSkyBottom, pow(uv.y, 1.25));

    // ── Stars ─────────────────────────────────────────────────────────────────
    // Fade in from 15% intensity; only in upper half of screen
    float starAmt = smoothstep(0.13, 0.52, uIntensity) * smoothstep(0.7, 0.2, uv.y);
    float stars = starField(uv) * starAmt;
    sky += vec3(stars * 0.60, stars * 0.72, stars * 0.98);

    // ── Aurora zone ───────────────────────────────────────────────────────────
    // Aurora expands further down the screen as intensity grows
    float auroraReach = mix(0.28, 0.58, uIntensity);
    float auroraZone = smoothstep(auroraReach, 0.0, uv.y);

    // ── Domain-warped Y offset ────────────────────────────────────────────────
    // Gives bands a flowing, organic silhouette instead of clean sine waves
    vec2 warpOffset = domainWarp(uv * 2.2);
    float warpedY = uv.y + warpOffset.y * 0.14;

    // ── Band 1 — upper primary band ───────────────────────────────────────────
    float b1Center = 0.10 + fbm(vec2(uv.x * 1.9 + drift, 0.15)) * 0.055;
    float b1Shape  = smoothstep(0.044, 0.0, abs(warpedY - b1Center));
    float b1Shimmer = noise(uv * 24.0 + uTime * 0.0085) * uIntensity;
    float b1 = (b1Shape * 1.45 + b1Shimmer * 0.32) * auroraZone;

    // ── Band 2 — mid undulating band ──────────────────────────────────────────
    float b2Center = 0.21 + fbm(vec2(uv.x * 1.3 - drift * 0.85, 0.65)) * 0.075;
    float b2Shape  = smoothstep(0.052, 0.0, abs(warpedY - b2Center));
    float b2Shimmer = noise(uv * 17.0 + uTime * 0.011 + 100.0) * uIntensity;
    float b2 = (b2Shape * 1.15 + b2Shimmer * 0.27) * auroraZone
             * smoothstep(0.34, 0.11, uv.y);

    // ── Band 3 — deep sweep (fades in above 30% intensity) ────────────────────
    float b3Appear = smoothstep(0.28, 0.68, uIntensity);
    float b3Center = 0.31 + fbm(vec2(uv.x * 0.85 + drift * 0.55, 1.35)) * 0.095;
    float b3Shape  = smoothstep(0.060, 0.0, abs(warpedY - b3Center));
    float b3Shimmer = noise(uv * 11.0 + uTime * 0.013 + 200.0) * uIntensity;
    float b3 = (b3Shape * 0.95 + b3Shimmer * 0.20) * auroraZone
             * smoothstep(0.44, 0.23, uv.y) * b3Appear;

    // ── Curtain rays (45–100% intensity) ─────────────────────────────────────
    float rayAmt = smoothstep(0.43, 0.85, uIntensity);
    float rays = 0.0;
    rays += curtainRay(0.13, uv.x, uv.y, 0.00);
    rays += curtainRay(0.35, uv.x, uv.y, 2.13);
    rays += curtainRay(0.57, uv.x, uv.y, 4.71);
    rays += curtainRay(0.80, uv.x, uv.y, 1.37);
    rays = rays * rayAmt * 0.26;

    // ── Nebula wisps — ambient low-frequency glow ─────────────────────────────
    float wispAmt = smoothstep(0.22, 0.62, uIntensity) * 0.065;
    float wisp = fbm(uv * 1.7 + vec2(drift * 0.22, 0.0));
    float wispGlow = wisp * wispAmt * auroraZone;

    // ── Combine ───────────────────────────────────────────────────────────────
    vec3 rayColor = mix(uColor1, uColor2, 0.5);

    vec3 aurora = vec3(0.0);
    aurora += b1 * uColor1 * uIntensity * 1.10;
    aurora += b2 * uColor2 * uIntensity * 0.90;
    aurora += b3 * uColor3 * uIntensity * 0.75;
    aurora += rays * rayColor * uIntensity;
    aurora += wispGlow * uColor2;

    vec3 result = sky + aurora;

    // ── Vignette ──────────────────────────────────────────────────────────────
    float vigTop = 1.0 - smoothstep(0.0, 0.13, uv.y) * 0.13;
    float vigBot = 1.0 - smoothstep(0.62, 1.0, uv.y) * 0.27;
    result *= vigTop * vigBot;

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
