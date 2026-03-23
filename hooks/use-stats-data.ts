import {
  type Timeframe,
  computeFocusConsistency,
  computeStreak,
  filterSessions,
  getDelta,
  getHourBuckets,
  getPrevRange,
  getProjectTotals,
  getRange,
  getTotalSeconds,
} from "@/features/analytics/stats-utils";
import type { Project } from "@/constants/projects";
import type { Session } from "@/features/sessions/sessions-store";
import { useMemo } from "react";

export function useStatsData(
  allSessions: Session[],
  projects: Project[],
  timeframe: Timeframe,
) {
  return useMemo(() => {
    const now = new Date();
    const { start, end } = getRange(timeframe, now);
    const { start: prevStart, end: prevEnd } = getPrevRange(timeframe, now);

    const sessions = filterSessions(allSessions, start, end);
    const prevSessions = filterSessions(allSessions, prevStart, prevEnd);

    const totalSeconds = getTotalSeconds(sessions);
    const delta = getDelta(totalSeconds, getTotalSeconds(prevSessions));
    const hourBuckets = getHourBuckets(sessions);
    const projectTotals = getProjectTotals(sessions, projects);
    const streak = computeStreak(allSessions);
    const consistency = computeFocusConsistency(sessions, start, end);
    const prevConsistency = computeFocusConsistency(prevSessions, prevStart, prevEnd);
    const consistencyDelta = getDelta(consistency.percentage, prevConsistency.percentage);
    const isEmpty = sessions.length === 0;

    return {
      sessions,
      totalSeconds,
      delta,
      hourBuckets,
      projectTotals,
      streak,
      consistency,
      consistencyDelta,
      isEmpty,
    };
  }, [allSessions, projects, timeframe]);
}
