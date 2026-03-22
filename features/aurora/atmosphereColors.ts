import { AtmosphereState } from './atmosphereDetector';

export interface AtmosphereColors {
  background: [number, number, number, number]; // RGBA [0-255]
  auroraLow: [number, number, number, number];
  auroraMid: [number, number, number, number];
  auroraHigh: [number, number, number, number];
  particleColor: [number, number, number, number];
}

/**
 * Get current hour (0-23)
 */
function getCurrentHour(): number {
  return new Date().getHours();
}

/**
 * Interpolate between two colors based on hour
 * Used to smoothly transition colors throughout the day
 */
function interpolateColor(
  color1: [number, number, number, number],
  color2: [number, number, number, number],
  t: number
): [number, number, number, number] {
  return [
    Math.round(color1[0] + (color2[0] - color1[0]) * t),
    Math.round(color1[1] + (color2[1] - color1[1]) * t),
    Math.round(color1[2] + (color2[2] - color1[2]) * t),
    Math.round(color1[3] + (color2[3] - color1[3]) * t),
  ];
}

/**
 * Color palettes for each state at different times of day
 *
 * Morning (5-11am): Cool blues, pale greens
 * Afternoon (11am-5pm): Warm golds, muted greens
 * Evening (5-11pm): Deep purples, vibrant greens, blues
 * Night (11pm-5am): Deep blues, purples, occasional greens
 */

const CALM_COLORS = {
  morning: { background: [15, 20, 40, 255], auroraLow: [30, 45, 80, 100], auroraMid: [50, 70, 120, 80], auroraHigh: [70, 100, 150, 60], particleColor: [150, 180, 220, 150] } as AtmosphereColors,
  afternoon: { background: [20, 25, 50, 255], auroraLow: [40, 55, 95, 100], auroraMid: [60, 80, 130, 80], auroraHigh: [80, 110, 160, 60], particleColor: [160, 190, 230, 150] } as AtmosphereColors,
  evening: { background: [25, 15, 40, 255], auroraLow: [45, 30, 80, 100], auroraMid: [70, 50, 120, 80], auroraHigh: [95, 75, 150, 60], particleColor: [160, 140, 200, 150] } as AtmosphereColors,
  night: { background: [10, 15, 30, 255], auroraLow: [20, 30, 60, 100], auroraMid: [40, 55, 100, 80], auroraHigh: [60, 85, 140, 60], particleColor: [130, 160, 210, 150] } as AtmosphereColors,
};

const GENTLE_COLORS = {
  morning: { background: [20, 28, 45, 255], auroraLow: [50, 75, 120, 140], auroraMid: [80, 110, 160, 110], auroraHigh: [110, 140, 190, 80], particleColor: [180, 210, 240, 160] } as AtmosphereColors,
  afternoon: { background: [30, 35, 55, 255], auroraLow: [70, 90, 130, 140], auroraMid: [100, 130, 170, 110], auroraHigh: [130, 160, 200, 80], particleColor: [200, 220, 240, 160] } as AtmosphereColors,
  evening: { background: [35, 20, 50, 255], auroraLow: [80, 50, 120, 140], auroraMid: [120, 80, 160, 110], auroraHigh: [150, 110, 190, 80], particleColor: [200, 170, 230, 160] } as AtmosphereColors,
  night: { background: [15, 22, 40, 255], auroraLow: [45, 60, 110, 140], auroraMid: [75, 95, 150, 110], auroraHigh: [110, 140, 190, 80], particleColor: [170, 200, 240, 160] } as AtmosphereColors,
};

const AURORA_COLORS = {
  morning: { background: [25, 35, 55, 255], auroraLow: [80, 140, 150, 180], auroraMid: [120, 180, 180, 150], auroraHigh: [150, 210, 200, 120], particleColor: [200, 230, 240, 180] } as AtmosphereColors,
  afternoon: { background: [40, 45, 65, 255], auroraLow: [100, 150, 140, 180], auroraMid: [140, 190, 170, 150], auroraHigh: [170, 220, 200, 120], particleColor: [220, 240, 230, 180] } as AtmosphereColors,
  evening: { background: [50, 30, 65, 255], auroraLow: [120, 70, 140, 180], auroraMid: [160, 110, 180, 150], auroraHigh: [190, 150, 210, 120], particleColor: [230, 190, 240, 180] } as AtmosphereColors,
  night: { background: [25, 30, 55, 255], auroraLow: [80, 120, 180, 180], auroraMid: [120, 160, 220, 150], auroraHigh: [160, 200, 240, 120], particleColor: [200, 230, 250, 180] } as AtmosphereColors,
};

const STRONG_AURORA_COLORS = {
  morning: { background: [30, 45, 70, 255], auroraLow: [120, 180, 180, 220], auroraMid: [160, 220, 200, 190], auroraHigh: [200, 240, 220, 160], particleColor: [240, 255, 240, 220] } as AtmosphereColors,
  afternoon: { background: [50, 55, 80, 255], auroraLow: [140, 180, 160, 220], auroraMid: [180, 220, 190, 190], auroraHigh: [220, 240, 220, 160], particleColor: [255, 255, 240, 220] } as AtmosphereColors,
  evening: { background: [65, 40, 80, 255], auroraLow: [160, 100, 170, 220], auroraMid: [200, 150, 210, 190], auroraHigh: [240, 190, 240, 160], particleColor: [255, 230, 255, 220] } as AtmosphereColors,
  night: { background: [40, 45, 75, 255], auroraLow: [140, 170, 220, 220], auroraMid: [180, 210, 240, 190], auroraHigh: [220, 240, 255, 160], particleColor: [240, 255, 255, 220] } as AtmosphereColors,
};

/**
 * Get color palette for the given atmosphere state
 * Interpolates between time-of-day variants based on current hour
 */
export function getAtmosphereColors(state: AtmosphereState): AtmosphereColors {
  const hour = getCurrentHour();

  // Determine which two palettes to interpolate between
  let palettes: typeof CALM_COLORS;
  if (state === 'calm') palettes = CALM_COLORS;
  else if (state === 'gentle') palettes = GENTLE_COLORS;
  else if (state === 'aurora') palettes = AURORA_COLORS;
  else palettes = STRONG_AURORA_COLORS;

  let color1: AtmosphereColors;
  let color2: AtmosphereColors;
  let t: number; // interpolation factor [0, 1]

  // Time-of-day transition points
  if (hour >= 5 && hour < 11) {
    // Morning (5-11am)
    color1 = palettes.morning;
    color2 = palettes.afternoon;
    t = (hour - 5) / 6;
  } else if (hour >= 11 && hour < 17) {
    // Afternoon (11am-5pm)
    color1 = palettes.afternoon;
    color2 = palettes.evening;
    t = (hour - 11) / 6;
  } else if (hour >= 17 && hour < 23) {
    // Evening (5-11pm)
    color1 = palettes.evening;
    color2 = palettes.night;
    t = (hour - 17) / 6;
  } else {
    // Night (11pm-5am)
    if (hour >= 23) {
      color1 = palettes.night;
      color2 = palettes.morning;
      t = (hour - 23) / 6;
    } else {
      color1 = palettes.morning;
      color2 = palettes.night;
      t = (hour + 1) / 6; // 0-4am maps to [1/6, 5/6]
    }
  }

  return {
    background: interpolateColor(color1.background, color2.background, t),
    auroraLow: interpolateColor(color1.auroraLow, color2.auroraLow, t),
    auroraMid: interpolateColor(color1.auroraMid, color2.auroraMid, t),
    auroraHigh: interpolateColor(color1.auroraHigh, color2.auroraHigh, t),
    particleColor: interpolateColor(color1.particleColor, color2.particleColor, t),
  };
}
