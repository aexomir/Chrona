import type { Session } from "@/features/sessions/sessions-store";
import type { Project } from "@/constants/projects";
import {
  getTotalSeconds,
  getHourBuckets,
  computeStreak,
  formatFocusTime,
  formatHourLabel,
} from "@/features/analytics/stats-utils";
import { isProjectIntent, isStatsIntent, isStreakIntent } from "@/features/search/query-intent";

/**
 * Generate contextual headline based on query and actual data
 */
export function generateContextualHeadline(
  query: string,
  timeframe: "today" | "week" | "month" | "all",
  sessions: Session[],
  projects: Project[],
): { headline: string; tip?: string } {
  const lowerQuery = query.toLowerCase();
  const totalSeconds = getTotalSeconds(sessions);
  const totalFormatted = formatFocusTime(totalSeconds);

  // Detect query intent
  const isStatsQuery = isStatsIntent(lowerQuery);
  const isTimeQuery =
    lowerQuery.includes("when") ||
    lowerQuery.includes("time") ||
    lowerQuery.includes("hour");
  const isStreakQuery = isStreakIntent(lowerQuery);
  const isProjectQuery = isProjectIntent(lowerQuery);
  const isTodayQuery = lowerQuery.includes("today");
  const isWeekQuery = lowerQuery.includes("week") || timeframe === "week";

  if (sessions.length === 0) {
    return {
      headline: "No focus sessions yet",
      tip: "Start tracking your time to see insights",
    };
  }

  // Stats queries — mention actual total
  if (isStatsQuery) {
    const sessionCount = sessions.length;
    if (isTodayQuery) {
      return {
        headline: `You've focused for ${totalFormatted} today`,
        tip: `Across ${sessionCount} session${sessionCount !== 1 ? "s" : ""}`,
      };
    }
    if (isWeekQuery) {
      const avgPerDay = Math.round(totalSeconds / 7 / 60);
      return {
        headline: `${totalFormatted} focused this week`,
        tip: `Average ${avgPerDay}m per day`,
      };
    }
    return {
      headline: `Your focus time: ${totalFormatted}`,
      tip: `${sessionCount} session${sessionCount !== 1 ? "s" : ""}`,
    };
  }

  // Time/hour queries — mention peak hour
  if (isTimeQuery) {
    const hourBuckets = getHourBuckets(sessions);
    const peakHourIdx = hourBuckets.indexOf(Math.max(...hourBuckets));
    const peakHourStr = formatHourLabel(peakHourIdx);

    return {
      headline: `Your peak focus time is around ${peakHourStr}`,
      tip: `That's when you're most productive`,
    };
  }

  // Streak queries
  if (isStreakQuery) {
    const streak = computeStreak(sessions);
    if (streak.current === 0) {
      return {
        headline: "Start a focus streak today",
        tip: "Track sessions consistently to build momentum",
      };
    }
    return {
      headline: `🔥 ${streak.current}-day streak going`,
      tip: streak.ongoing ? "Keep it going today" : "Get back on track to extend it",
    };
  }

  // Project queries
  if (isProjectQuery) {
    const projectMap = new Map(projects.map((p) => [p.id, p.name]));
    const projectTotals = new Map<string, number>();
    for (const session of sessions) {
      const projectId = session.projectId || "unassigned";
      projectTotals.set(projectId, (projectTotals.get(projectId) || 0) + session.duration);
    }

    const [topProjectId, topSeconds] = Array.from(projectTotals.entries()).sort(
      (a, b) => b[1] - a[1],
    )[0] || [null, 0];

    if (!topProjectId) {
      return { headline: "Your projects breakdown is ready" };
    }

    const topName =
      topProjectId === "unassigned"
        ? "Unassigned"
        : projectMap.get(topProjectId) || "Unknown";
    const pct = Math.round((topSeconds / totalSeconds) * 100);

    return {
      headline: `${topName} is your top focus (${pct}%)`,
      tip: "See how your projects compare",
    };
  }

  // Generic fallback
  return {
    headline: `Here's your ${timeframe} focus summary`,
    tip: `Total: ${totalFormatted} across ${sessions.length} session${sessions.length !== 1 ? "s" : ""}`,
  };
}

/**
 * Generate 2-3 follow-up question suggestions based on original query
 */
export function generateFollowUpSuggestions(
  query: string,
): { text: string; icon: string }[] {
  const lowerQuery = query.toLowerCase();
  const suggestions: { text: string; icon: string }[] = [];

  // If they asked about stats, suggest breakdown
  if (isStatsIntent(lowerQuery)) {
    suggestions.push({
      text: "See my projects breakdown",
      icon: "sf:folder.fill",
    });
    suggestions.push({
      text: "When do I focus most?",
      icon: "sf:clock.fill",
    });
  }
  // If they asked about time/hours, suggest projects and streak
  else if (
    lowerQuery.includes("when") ||
    lowerQuery.includes("hour") ||
    lowerQuery.includes("time") ||
    lowerQuery.includes("pattern")
  ) {
    suggestions.push({
      text: "Show me this week stats",
      icon: "sf:chart.bar.fill",
    });
    suggestions.push({
      text: "How's my focus streak?",
      icon: "sf:flame.fill",
    });
  }
  // If they asked about projects, suggest time patterns and stats
  else if (isProjectIntent(lowerQuery)) {
    suggestions.push({
      text: "When do I work most?",
      icon: "sf:clock.fill",
    });
    suggestions.push({
      text: "Show me this week stats",
      icon: "sf:chart.bar.fill",
    });
  }
  // If they asked about streak, suggest stats and projects
  else if (isStreakIntent(lowerQuery)) {
    suggestions.push({
      text: "Show me this week stats",
      icon: "sf:chart.bar.fill",
    });
    suggestions.push({
      text: "See my projects breakdown",
      icon: "sf:folder.fill",
    });
  }
  // Generic: suggest all exploration paths
  else {
    suggestions.push({
      text: "Show me this week stats",
      icon: "sf:chart.bar.fill",
    });
    suggestions.push({
      text: "See my projects breakdown",
      icon: "sf:folder.fill",
    });
    suggestions.push({
      text: "How's my focus streak?",
      icon: "sf:flame.fill",
    });
  }

  return suggestions.slice(0, 3);
}
