import { getAppUsage } from "./aw-adapter";
import type { AppUsage, Session } from "@/stores/sessions-store";

export type RecoveryPeriod = {
  startTime: string;
  endTime: string;
  apps: AppUsage[];
  suggestion: { projectId: string; matchedApps: string[] };
  source?: "calendar"; // omitted = AW-based (default)
  eventTitle?: string; // calendar event title, present when source === "calendar"
  confidence?: number; // 0..1, used for internal ranking
};

// Constants
const LOOK_BACK_MS = 8 * 60 * 60 * 1000; // 8 hours
const MIN_GAP_MS = 15 * 60 * 1000; // 15 minutes
const MIN_AW_USAGE_S = 10 * 60; // 10 minutes
const END_BUFFER_MS = 30 * 60 * 1000; // 30 minutes — skip very recent gaps
const MIN_COVERAGE_RECOVERY = 0.5; // matched app duration vs total gap AW activity
const MAX_SURFACED = 2; // cap surfaced recovery periods

interface Gap {
  start: Date;
  end: Date;
}

/**
 * Find gaps (uncovered intervals) in session data using cursor pattern
 */
function findGaps(
  sessions: Session[],
  windowStart: Date,
  windowEnd: Date
): Gap[] {
  // Filter and sort sessions that overlap the window
  const overlapping = sessions
    .filter((s) => {
      const sStart = new Date(s.startTime);
      const sEnd = new Date(s.endTime);
      return sStart < windowEnd && sEnd > windowStart;
    })
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  const gaps: Gap[] = [];
  let cursor = windowStart;

  for (const session of overlapping) {
    const sStart = new Date(session.startTime);
    const sEnd = new Date(session.endTime);

    // Clamp session to window
    const clampedStart = sStart < windowStart ? windowStart : sStart;
    const clampedEnd = sEnd > windowEnd ? windowEnd : sEnd;

    // Add gap if there's a gap between cursor and session start
    if (clampedStart > cursor) {
      gaps.push({ start: cursor, end: clampedStart });
    }

    // Move cursor past this session
    cursor = clampedEnd > cursor ? clampedEnd : cursor;
  }

  // Add trailing gap
  if (cursor < windowEnd) {
    gaps.push({ start: cursor, end: windowEnd });
  }

  // Filter to gaps >= MIN_GAP_MS
  return gaps.filter((g) => g.end.getTime() - g.start.getTime() >= MIN_GAP_MS);
}

type SuggestProjectFn = (
  apps: AppUsage[]
) => { projectId: string; matchedApps: string[]; score: number; totalCoveredDuration: number } | null;

/**
 * Main detection function: finds high-confidence missed time periods grouped by project
 */
export async function detectMissedTime(
  sessions: Session[],
  suggestProject: SuggestProjectFn
): Promise<RecoveryPeriod[]> {
  try {
    const now = new Date();
    const lookBackWindow = new Date(now.getTime() - LOOK_BACK_MS);

    // Find gaps in session coverage
    const gaps = findGaps(sessions, lookBackWindow, now);

    if (gaps.length === 0) return [];

    const candidates: RecoveryPeriod[] = [];

    // Evaluate gaps sequentially (AW is local HTTP, no need for concurrency)
    for (const gap of gaps) {
      // Subtract END_BUFFER from end to avoid capturing very recent activity
      const adjustedEnd = new Date(gap.end.getTime() - END_BUFFER_MS);
      if (adjustedEnd <= gap.start) continue;

      const apps = await getAppUsage(gap.start.toISOString(), adjustedEnd.toISOString());

      // Skip if insufficient activity
      const totalGapDuration = apps.reduce((sum, a) => sum + a.duration, 0);
      if (totalGapDuration < MIN_AW_USAGE_S) continue;

      // Group apps by individual project suggestions
      const projectMap = new Map<
        string,
        { apps: AppUsage[]; score: number; coveredDuration: number }
      >();

      for (const app of apps) {
        const suggestion = suggestProject([app]);
        if (!suggestion) continue;

        const { projectId, score, totalCoveredDuration } = suggestion;
        const entry = projectMap.get(projectId) ?? { apps: [], score: 0, coveredDuration: 0 };
        entry.apps.push(app);
        entry.score = Math.max(entry.score, score);
        entry.coveredDuration += app.duration;
        projectMap.set(projectId, entry);
      }

      // Score and filter each project group
      for (const [projectId, data] of projectMap) {
        const coverageRatio = totalGapDuration > 0
          ? data.coveredDuration / totalGapDuration
          : 0;

        if (coverageRatio < MIN_COVERAGE_RECOVERY) continue;

        const normalizedScore = Math.min(data.score / 10, 1.0);
        const confidence = 0.6 * normalizedScore + 0.4 * coverageRatio;

        candidates.push({
          startTime: gap.start.toISOString(),
          endTime: adjustedEnd.toISOString(),
          apps: data.apps,
          suggestion: {
            projectId,
            matchedApps: data.apps.map((a) => a.app),
          },
          confidence,
        });
      }
    }

    // Return top high-confidence candidates
    return candidates
      .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))
      .slice(0, MAX_SURFACED);
  } catch {
    // Silent fail: AW offline, network error, etc.
    return [];
  }
}
