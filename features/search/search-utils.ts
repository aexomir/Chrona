import type { Session } from '@/features/sessions/sessions-store';
import type { Project } from '@/constants/projects';
import type { SearchResultSpec } from '@/features/search/component-spec';
import type { SearchResult } from '@/features/search/search-result';
import {
  getRange,
  filterSessions,
  formatFocusTime,
  getTotalSeconds,
  getDelta,
  getPrevRange,
  getHourBuckets,
  getProjectTotals,
  computeStreak,
  type Timeframe,
} from '@/features/analytics/stats-utils';
import {
  generateContextualHeadline,
  generateFollowUpSuggestions,
} from '@/features/search/search-generation';
import { GAP_THRESHOLD_MS } from '@/features/timeline/timeline-utils';

/**
 * Timeframe string from query to Timeframe type mapping
 */
function queryTimeframeToTimeframe(
  queryTimeframe: 'today' | 'week' | 'month' | 'all'
): Timeframe {
  const mapping: Record<'today' | 'week' | 'month' | 'all', Timeframe> = {
    today: 'day',
    week: 'week',
    month: 'month',
    all: 'all',
  };
  return mapping[queryTimeframe];
}

/**
 * Groups sessions by calendar date (most recent first) and flattens them into
 * date_pill + session_row specs, inserting a gap_separator wherever consecutive
 * sessions on the same date are more than GAP_THRESHOLD_MS apart.
 */
function buildTimelineSpecs(sessions: Session[]): SearchResultSpec[] {
  const specs: SearchResultSpec[] = [];

  const sessionsByDate = new Map<string, Session[]>();
  for (const session of sessions) {
    const dateKey = new Date(session.startTime).toDateString();
    if (!sessionsByDate.has(dateKey)) {
      sessionsByDate.set(dateKey, []);
    }
    sessionsByDate.get(dateKey)!.push(session);
  }

  const sortedDates = Array.from(sessionsByDate.keys()).sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime()
  );

  for (const dateStr of sortedDates) {
    const dateSessions = sessionsByDate.get(dateStr)!;

    specs.push({
      type: 'date_pill',
      date: new Date(dateStr).toISOString(),
    });

    const sorted = [...dateSessions].sort(
      (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    );

    for (let i = 0; i < sorted.length; i++) {
      specs.push({
        type: 'session_row',
        sessionId: sorted[i].id,
        index: i,
      });

      if (i < sorted.length - 1) {
        const current = new Date(sorted[i].endTime).getTime();
        const next = new Date(sorted[i + 1].startTime).getTime();
        const gapMs = current - next;
        if (gapMs >= GAP_THRESHOLD_MS) {
          specs.push({
            type: 'gap_separator',
            durationMs: gapMs,
          });
        }
      }
    }
  }

  return specs;
}

/**
 * Builds an array of SearchResultSpecs from the rule-based SearchResult and computed data.
 * Always starts with insight_card, then conditionally adds components based on boolean flags.
 */
export function buildSearchSpecs(
  result: SearchResult,
  queryTimeframe: 'today' | 'week' | 'month' | 'all',
  allSessions: Session[],
  projects: Project[],
  now: Date,
  query?: string,
): SearchResultSpec[] {
  const specs: SearchResultSpec[] = [];

  // Get timeframe-based session data for context
  const tf = queryTimeframeToTimeframe(queryTimeframe);
  const { start, end } = getRange(tf, now);
  const sessions = filterSessions(allSessions, start, end);

  // Generate contextual headline if query provided
  const { headline, tip } = query
    ? generateContextualHeadline(query, queryTimeframe, sessions, projects)
    : { headline: result.headline, tip: result.tip };

  // 1. Always push insight_card at top
  specs.push({
    type: 'insight_card',
    headline,
    body: result.body,
    tip,
    sentiment: result.sentiment,
    generatedAt: now.toISOString(),
  });

  // 2. Timeline: date pill + session rows with gap separators
  if (result.show_timeline && sessions.length > 0) {
    specs.push(...buildTimelineSpecs(sessions));
  }

  // 3. Metrics: total focus time + session count with deltas
  if (result.show_metrics && sessions.length > 0) {
    specs.push({
      type: 'section_header',
      title: 'Your Stats',
      description: 'Key metrics for this period',
    });

    const totalSeconds = getTotalSeconds(sessions);
    const { start: prevStart, end: prevEnd } = getPrevRange(tf, now);
    const prevSessions = filterSessions(allSessions, prevStart, prevEnd);
    const prevTotalSeconds = getTotalSeconds(prevSessions);
    const delta = getDelta(totalSeconds, prevTotalSeconds);

    specs.push({
      type: 'metric_card',
      label: 'Total Focus Time',
      value: formatFocusTime(totalSeconds),
      delta,
    });

    specs.push({
      type: 'metric_card',
      label: 'Sessions',
      value: String(sessions.length),
      delta: getDelta(sessions.length, prevSessions.length),
    });
  }

  // 4. Chart: hourly distribution
  if (result.show_chart && sessions.length > 0) {
    specs.push({
      type: 'section_header',
      title: 'Activity by Hour',
      description: 'When you focused most',
    });

    const buckets = getHourBuckets(sessions);
    specs.push({
      type: 'bar_chart_24',
      buckets,
    });
  }

  // 5. Projects: distribution
  if (result.show_projects && sessions.length > 0) {
    const projectTotals = getProjectTotals(sessions, projects);
    if (projectTotals.length > 0) {
      specs.push({
        type: 'section_header',
        title: 'Projects',
        description: 'How your focus time is split',
      });

      specs.push({
        type: 'project_distribution',
        totals: projectTotals.map(({ project, seconds }) => ({
          projectId: project.id,
          seconds,
        })),
      });
    }
  }

  // 6. Streak: only if current > 0
  if (result.show_streak) {
    const streak = computeStreak(allSessions);
    if (streak.current > 0) {
      specs.push({
        type: 'streak_callout',
        streak,
      });
    }
  }

  // 7. Add follow-up suggestions at the end
  if (query) {
    const followUps = generateFollowUpSuggestions(query);
    if (followUps.length > 0) {
      specs.push({
        type: 'suggested_follow_ups',
        queries: followUps,
      });
    }
  }

  return specs;
}

/**
 * Fallback specs when rule-based analysis throws or no sessions exist.
 * Returns a simple insight card + timeline if sessions exist.
 */
export function buildFallbackSearchSpecs(
  query: string,
  queryTimeframe: 'today' | 'week' | 'month' | 'all',
  allSessions: Session[],
  now: Date
): SearchResultSpec[] {
  const specs: SearchResultSpec[] = [];

  const headline = 'Could not process query';
  const body = `I couldn't analyze your question "${query}". Try asking about your focus time, projects, or activity patterns.`;

  specs.push({
    type: 'insight_card',
    headline,
    body,
    sentiment: 'neutral',
    generatedAt: now.toISOString(),
  });

  // Show timeline if sessions exist
  const { start, end } = getRange(queryTimeframeToTimeframe(queryTimeframe), now);
  const sessions = filterSessions(allSessions, start, end);

  if (sessions.length > 0) {
    specs.push(...buildTimelineSpecs(sessions));
  }

  // Add follow-up suggestions
  const followUps = generateFollowUpSuggestions(query);
  if (followUps.length > 0) {
    specs.push({
      type: 'suggested_follow_ups',
      queries: followUps,
    });
  }

  return specs;
}
