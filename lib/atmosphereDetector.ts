import { Session } from '@/stores/sessions-store';

/**
 * Atmosphere state thresholds (easily adjustable)
 */
export const ATMOSPHERE_THRESHOLDS = {
  // Minutes
  GENTLE_MIN_SESSIONS: 2, // Must have at least this many sessions
  GENTLE_MAX_TOTAL_MINUTES: 60, // And total focus < this value

  // Aurora appears when either:
  AURORA_MIN_SESSION_COUNT: 3, // 3+ sessions, OR
  AURORA_MIN_TOTAL_MINUTES: 60, // Total focus >= 60 minutes

  // Strong aurora when either:
  STRONG_AURORA_MIN_SINGLE_SESSION_MINUTES: 90, // Single session >= 90 min, OR
  STRONG_AURORA_MIN_TOTAL_MINUTES: 120, // Total focus >= 120 minutes
};

export type AtmosphereState = 'calm' | 'gentle' | 'aurora' | 'strong-aurora';

interface AtmosphereMetrics {
  totalMinutes: number;
  sessionCount: number;
  longestSessionMinutes: number;
  state: AtmosphereState;
}

/**
 * Calculate atmosphere state from today's sessions
 * Metrics are computed from sessions that occurred today (local timezone)
 */
export function detectAtmosphere(sessions: Session[]): AtmosphereMetrics {
  const now = new Date();
  const today = now.toDateString();

  // Filter sessions from today only
  const todaySessions = sessions.filter(
    (s) => new Date(s.startTime).toDateString() === today
  );

  // Calculate metrics
  const totalSeconds = todaySessions.reduce((sum, s) => sum + s.duration, 0);
  const totalMinutes = Math.round(totalSeconds / 60);
  const sessionCount = todaySessions.length;
  const longestSessionMinutes = todaySessions.length > 0
    ? Math.round(Math.max(...todaySessions.map((s) => s.duration)) / 60)
    : 0;

  // Determine state based on thresholds
  let state: AtmosphereState = 'calm';

  // Check for strong aurora first (highest priority)
  if (
    longestSessionMinutes >= ATMOSPHERE_THRESHOLDS.STRONG_AURORA_MIN_SINGLE_SESSION_MINUTES ||
    totalMinutes >= ATMOSPHERE_THRESHOLDS.STRONG_AURORA_MIN_TOTAL_MINUTES
  ) {
    state = 'strong-aurora';
  }
  // Check for aurora
  else if (
    sessionCount >= ATMOSPHERE_THRESHOLDS.AURORA_MIN_SESSION_COUNT ||
    totalMinutes >= ATMOSPHERE_THRESHOLDS.AURORA_MIN_TOTAL_MINUTES
  ) {
    state = 'aurora';
  }
  // Check for gentle
  else if (
    sessionCount >= ATMOSPHERE_THRESHOLDS.GENTLE_MIN_SESSIONS &&
    totalMinutes < ATMOSPHERE_THRESHOLDS.GENTLE_MAX_TOTAL_MINUTES
  ) {
    state = 'gentle';
  }
  // Otherwise calm

  return {
    totalMinutes,
    sessionCount,
    longestSessionMinutes,
    state,
  };
}
