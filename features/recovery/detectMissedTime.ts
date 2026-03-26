import { getAppUsage } from "@/features/activity-watch/aw-adapter";
import type { AppUsage, Session } from "@/features/sessions/sessions-store";

export type RecoveryPeriod = {
  startTime: string;
  endTime: string;
  apps: AppUsage[];
  suggestion: { projectId: string; matchedApps: string[] } | null;
  source?: "calendar"; // omitted = AW-based (default)
  eventTitle?: string; // calendar event title, present when source === "calendar"
  confidence?: number; // 0..1, used for internal ranking
};

const LOOK_BACK_MS = 8 * 60 * 60 * 1000; // 8 hours
const MIN_GAP_MS = 15 * 60 * 1000; // 15 minutes
const MIN_AW_USAGE_S = 10 * 60; // 10 minutes of activity required
const END_BUFFER_MS = 5 * 60 * 1000; // 5 minutes — skip very recent gaps

interface Gap {
  start: Date;
  end: Date;
}

function findGaps(
  sessions: Session[],
  windowStart: Date,
  windowEnd: Date,
): Gap[] {
  const sorted = sessions
    .filter(
      (s) =>
        new Date(s.startTime) < windowEnd && new Date(s.endTime) > windowStart,
    )
    .sort(
      (a, b) =>
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
    );

  const gaps: Gap[] = [];
  let cursor = windowStart;

  for (const session of sorted) {
    const clampedStart = new Date(
      Math.max(new Date(session.startTime).getTime(), windowStart.getTime()),
    );
    const clampedEnd = new Date(
      Math.min(new Date(session.endTime).getTime(), windowEnd.getTime()),
    );

    if (clampedStart > cursor) gaps.push({ start: cursor, end: clampedStart });
    if (clampedEnd > cursor) cursor = clampedEnd;
  }

  if (cursor < windowEnd) gaps.push({ start: cursor, end: windowEnd });

  return gaps.filter((g) => g.end.getTime() - g.start.getTime() >= MIN_GAP_MS);
}

type SuggestProjectFn = (apps: AppUsage[]) => {
  projectId: string;
  matchedApps: string[];
  score: number;
  totalCoveredDuration: number;
} | null;

/**
 * Finds the single best missed time period to surface for recovery.
 * Returns null if nothing meets the threshold or all gaps are dismissed.
 */
export async function detectMissedTime(
  sessions: Session[],
  suggestProject: SuggestProjectFn,
  isDismissed?: (startTime: string) => boolean,
): Promise<RecoveryPeriod | null> {
  try {
    const now = new Date();
    const gaps = findGaps(
      sessions,
      new Date(now.getTime() - LOOK_BACK_MS),
      now,
    );

    let best: RecoveryPeriod | null = null;

    for (const gap of gaps) {
      const startISO = gap.start.toISOString();

      // Skip gaps the user already dismissed this session
      if (isDismissed?.(startISO)) continue;

      const adjustedEnd = new Date(gap.end.getTime() - END_BUFFER_MS);
      if (adjustedEnd <= gap.start) continue;

      const apps = await getAppUsage(startISO, adjustedEnd.toISOString());
      const totalDuration = apps.reduce((sum, a) => sum + a.duration, 0);
      if (totalDuration < MIN_AW_USAGE_S) continue;

      const suggestion = suggestProject(apps);
      const coverage = suggestion
        ? suggestion.totalCoveredDuration / totalDuration
        : 0;
      const confidence = suggestion
        ? 0.6 * Math.min(suggestion.score / 10, 1) + 0.4 * coverage
        : 0.2;

      if (!best || confidence > (best.confidence ?? 0)) {
        best = {
          startTime: startISO,
          endTime: adjustedEnd.toISOString(),
          apps,
          suggestion: suggestion
            ? {
                projectId: suggestion.projectId,
                matchedApps: suggestion.matchedApps,
              }
            : null,
          confidence,
        };
      }
    }

    return best;
  } catch {
    return null;
  }
}
