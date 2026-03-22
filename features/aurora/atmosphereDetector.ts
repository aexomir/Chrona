import { Session } from '@/features/sessions/sessions-store';

/**
 * Atmosphere state thresholds
 */
export const ATMOSPHERE_THRESHOLDS = {
  // Full intensity is reached at 10 hours of total focus
  MAX_DAILY_MINUTES: 600,

  // State thresholds (for color palette + speed selection only)
  GENTLE_MIN_MINUTES: 30,
  AURORA_MIN_MINUTES: 90,
  STRONG_AURORA_MIN_MINUTES: 300,
};

export type AtmosphereState = 'calm' | 'gentle' | 'aurora' | 'strong-aurora';

interface AtmosphereMetrics {
  totalMinutes: number;
  sessionCount: number;
  longestSessionMinutes: number;
  state: AtmosphereState;
  /** Continuous intensity progress: 0.0 (no sessions) → 1.0 (10h of focus) */
  progress: number;
}

/**
 * Calculate atmosphere state from today's sessions.
 * Returns a continuous `progress` value (0–1) so intensity scales
 * gradually across the full day rather than snapping between 4 levels.
 */
export function detectAtmosphere(sessions: Session[]): AtmosphereMetrics {
  const now = new Date();
  const today = now.toDateString();

  const todaySessions = sessions.filter(
    (s) => new Date(s.startTime).toDateString() === today
  );

  const totalSeconds = todaySessions.reduce((sum, s) => sum + s.duration, 0);
  const totalMinutes = Math.round(totalSeconds / 60);
  const sessionCount = todaySessions.length;
  const longestSessionMinutes = todaySessions.length > 0
    ? Math.round(Math.max(...todaySessions.map((s) => s.duration)) / 60)
    : 0;

  // Continuous progress: 0 at 0 min, 1.0 at MAX_DAILY_MINUTES (10h)
  const progress = Math.min(totalMinutes / ATMOSPHERE_THRESHOLDS.MAX_DAILY_MINUTES, 1.0);

  // Discrete state is still used for color palette and animation speed
  let state: AtmosphereState = 'calm';

  if (totalMinutes >= ATMOSPHERE_THRESHOLDS.STRONG_AURORA_MIN_MINUTES) {
    state = 'strong-aurora';
  } else if (
    totalMinutes >= ATMOSPHERE_THRESHOLDS.AURORA_MIN_MINUTES ||
    sessionCount >= 3
  ) {
    state = 'aurora';
  } else if (
    totalMinutes >= ATMOSPHERE_THRESHOLDS.GENTLE_MIN_MINUTES ||
    sessionCount >= 2
  ) {
    state = 'gentle';
  }

  return {
    totalMinutes,
    sessionCount,
    longestSessionMinutes,
    state,
    progress,
  };
}
