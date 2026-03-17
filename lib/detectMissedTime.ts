import { getAppUsage } from "./activitywatch";
import type { AppUsage, Session } from "@/stores/sessions-store";

export type RecoveryPeriod = {
  startTime: string;
  endTime: string;
  apps: AppUsage[];
  suggestion: { projectId: string; matchedApps: string[] };
  source?: "calendar"; // omitted = AW-based (default)
  eventTitle?: string; // calendar event title, present when source === "calendar"
};

// Constants
const LOOK_BACK_MS = 8 * 60 * 60 * 1000; // 8 hours
const MIN_GAP_MS = 15 * 60 * 1000; // 15 minutes
const MIN_AW_USAGE_S = 10 * 60; // 10 minutes
const END_BUFFER_MS = 5 * 60 * 1000; // 5 minutes

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

/**
 * Main detection function: finds all missed time periods grouped by project
 */
export async function detectMissedTime(
  sessions: Session[],
  suggestProject: (apps: AppUsage[]) => { projectId: string; matchedApps: string[] } | null
): Promise<RecoveryPeriod[]> {
  try {
    const now = new Date();
    const lookBackWindow = new Date(now.getTime() - LOOK_BACK_MS);

    // Find gaps in session coverage
    const gaps = findGaps(sessions, lookBackWindow, now);

    if (gaps.length === 0) return [];

    const results: RecoveryPeriod[] = [];

    // Evaluate gaps sequentially (AW is local HTTP, no need for concurrency)
    for (const gap of gaps) {
      // Subtract END_BUFFER from end to avoid capturing very recent activity
      const adjustedEnd = new Date(gap.end.getTime() - END_BUFFER_MS);
      if (adjustedEnd <= gap.start) continue;

      const apps = await getAppUsage(gap.start.toISOString(), adjustedEnd.toISOString());

      // Skip if insufficient activity
      const totalDuration = apps.reduce((sum, a) => sum + a.duration, 0);
      if (totalDuration < MIN_AW_USAGE_S) continue;

      // Group apps by individual project suggestions
      const projectMap = new Map<string, AppUsage[]>();

      for (const app of apps) {
        const suggestion = suggestProject([app]);
        if (!suggestion) continue; // Skip apps with no valid suggestion

        const projectId = suggestion.projectId;
        if (!projectMap.has(projectId)) {
          projectMap.set(projectId, []);
        }
        projectMap.get(projectId)!.push(app);
      }

      // Emit a RecoveryPeriod for each project group
      for (const [projectId, groupedApps] of projectMap) {
        results.push({
          startTime: gap.start.toISOString(),
          endTime: adjustedEnd.toISOString(),
          apps: groupedApps,
          suggestion: {
            projectId,
            matchedApps: groupedApps.map((a) => a.app),
          },
        });
      }
    }

    return results;
  } catch {
    // Silent fail: AW offline, network error, etc.
    return [];
  }
}
