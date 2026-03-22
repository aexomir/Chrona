import type { CalendarMapping } from "@/features/calendar/calendar-store";
import type { Session } from "@/features/sessions/sessions-store";
import { getAppUsage } from "@/features/activity-watch/aw-adapter";
import type { CalendarEvent } from "./calendar";
import { eventMatchesMapping } from "./calendar";
import type { RecoveryPeriod } from "@/features/recovery/detectMissedTime";

// Constants
const LOOK_BACK_MS = 8 * 60 * 60 * 1000; // 8 hours
const MIN_EVENT_MS = 15 * 60 * 1000; // 15 minutes
const MIN_AW_USAGE_S = 5 * 60; // 5 minutes (lower bar than AW-based detection)
const MIN_COVERAGE_RATIO = 0.5; // skip if sessions already cover ≥ 50% of event duration
const EVENT_END_BUFFER_MS = 2 * 60 * 1000; // 2 minutes before now (event just ended)

/**
 * Compute total milliseconds of coverage from sessions overlapping [start, end]
 */
function computeCoveredMs(sessions: Session[], start: Date, end: Date): number {
  const overlapping = sessions
    .filter((s) => {
      const sStart = new Date(s.startTime);
      const sEnd = new Date(s.endTime);
      return sStart < end && sEnd > start;
    })
    .sort(
      (a, b) =>
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
    );

  let cursor = start;
  let totalCovered = 0;

  for (const session of overlapping) {
    const sStart = new Date(session.startTime);
    const sEnd = new Date(session.endTime);

    // Clamp session to event window
    const clampedStart = sStart < start ? start : sStart;
    const clampedEnd = sEnd > end ? end : sEnd;

    // Add coverage if session overlaps
    if (clampedStart < clampedEnd && clampedStart >= cursor) {
      totalCovered += clampedEnd.getTime() - clampedStart.getTime();
      cursor = clampedEnd > cursor ? clampedEnd : cursor;
    } else if (clampedEnd > cursor) {
      totalCovered += clampedEnd.getTime() - cursor.getTime();
      cursor = clampedEnd;
    }
  }

  return totalCovered;
}

/**
 * Detect recently-ended calendar events that match mappings and have no logged sessions
 */
export async function detectMissedCalendarEvent(
  events: CalendarEvent[],
  mappings: CalendarMapping[],
  sessions: Session[],
): Promise<RecoveryPeriod | null> {
  try {
    const now = new Date();
    const lookBackTime = new Date(now.getTime() - LOOK_BACK_MS);

    // Filter events: just ended (within 2 min) AND within look-back window
    const candidateEvents = events.filter((event) => {
      const eventEnd = new Date(event.endDate);
      const eventStart = new Date(event.startDate);
      const duration = eventEnd.getTime() - eventStart.getTime();

      // Event must be ≥ 15 minutes
      if (duration < MIN_EVENT_MS) return false;

      // Event must have ended in the last 2 minutes
      if (eventEnd.getTime() > now.getTime() - EVENT_END_BUFFER_MS)
        return false;

      // Event must be within look-back window
      if (eventEnd.getTime() < lookBackTime.getTime()) return false;

      return true;
    });

    if (candidateEvents.length === 0) return null;

    // Find events matching a mapping
    const matchedCandidates: {
      event: CalendarEvent;
      projectId: string;
    }[] = [];

    for (const event of candidateEvents) {
      for (const mapping of mappings) {
        if (eventMatchesMapping(event, mapping)) {
          matchedCandidates.push({ event, projectId: mapping.projectId });
          break; // Only match once per event
        }
      }
    }

    if (matchedCandidates.length === 0) return null;

    // Sort by most recently ended first
    matchedCandidates.sort((a, b) => {
      const aEnd = new Date(a.event.endDate).getTime();
      const bEnd = new Date(b.event.endDate).getTime();
      return bEnd - aEnd;
    });

    // Check each candidate
    for (const { event, projectId } of matchedCandidates) {
      const eventStart = new Date(event.startDate);
      const eventEnd = new Date(event.endDate);
      const eventDuration = eventEnd.getTime() - eventStart.getTime();

      // Check if already logged: skip if ≥ 50% already covered by sessions
      const coveredMs = computeCoveredMs(sessions, eventStart, eventEnd);
      if (coveredMs / eventDuration >= MIN_COVERAGE_RATIO) continue;

      // Get AW data for event window
      const apps = await getAppUsage(event.startDate, event.endDate);

      // Check minimum activity
      const totalDuration = apps.reduce((sum, a) => sum + a.duration, 0);
      if (totalDuration < MIN_AW_USAGE_S) continue;

      // Valid recovery period found
      return {
        startTime: event.startDate,
        endTime: event.endDate,
        apps,
        suggestion: { projectId, matchedApps: [] },
        source: "calendar",
        eventTitle: event.title,
      };
    }

    return null;
  } catch {
    // Silent fail: calendar error, AW offline, etc.
    return null;
  }
}
