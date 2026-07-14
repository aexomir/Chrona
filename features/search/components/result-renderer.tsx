import { useMemo } from "react";
import type { SearchResultSpec } from "@/features/search/component-spec";

// Timeline components
import { SessionRow } from "@/features/timeline/components/session-row";
import { GapSeparator } from "@/features/timeline/components/gap-separator";
import { DatePill } from "@/features/timeline/components/date-pill";

// Stats components
import { SectionHeader } from "@/features/analytics/components/section-header";
import { MetricCard } from "@/features/analytics/components/metric-card";
import { BarChart24 } from "@/features/analytics/components/bar-chart24";
import { ProjectDistribution } from "@/features/analytics/components/project-distribution";
import { StreakCallout } from "@/features/analytics/components/streak-callout";
import { InsightCard } from "@/features/search/components/insight-card";
import { SuggestedFollowUps } from "@/features/search/components/suggested-follow-ups";

import type { Project } from "@/constants/projects";
import type { CalendarEvent } from "@/features/calendar/calendar";
import { findOverlappingEvents } from "@/features/calendar/calendar";
import type { Insight, GeneratedResult } from "@/features/search/search-result";
import type { Session } from "@/features/sessions/sessions-store";

const noopSelectFollowUp = () => {};

/** Memoizes the overlap scan so it only reruns when this row's session or the calendar events change. */
function SessionRowWithOverlaps({
  session,
  index,
  calendarEvents,
}: {
  session: Session;
  index: number;
  calendarEvents: CalendarEvent[];
}) {
  const overlappingEvents = useMemo(
    () => findOverlappingEvents(calendarEvents, new Date(session.startTime), new Date(session.endTime)),
    [calendarEvents, session.startTime, session.endTime],
  );

  return <SessionRow session={session} index={index} overlappingEvents={overlappingEvents} />;
}

/**
 * SearchResultRenderer resolves search result specs into real React Native components.
 * Rendered once per spec in a results list, so store lookups are resolved once by the parent
 * and passed in as props/maps rather than each instance subscribing to the full stores.
 */
export function SearchResultRenderer({
  spec,
  sessionsById,
  projects,
  calendarEvents,
  onSelectFollowUp,
}: {
  spec: SearchResultSpec;
  sessionsById: Map<string, Session>;
  projects: Project[];
  calendarEvents: CalendarEvent[];
  onSelectFollowUp?: (query: string) => void;
}) {
  // ──── Timeline specs ────

  if (spec.type === "session_row") {
    const session = sessionsById.get(spec.sessionId);
    if (!session) return null;

    return (
      <SessionRowWithOverlaps
        session={session}
        index={spec.index ?? 0}
        calendarEvents={calendarEvents}
      />
    );
  }

  if (spec.type === "gap_separator") {
    return <GapSeparator durationMs={spec.durationMs} />;
  }

  if (spec.type === "date_pill") {
    const date = new Date(spec.date);
    return <DatePill date={date} />;
  }

  // ──── Stats specs ────

  if (spec.type === "section_header") {
    return <SectionHeader title={spec.title} description={spec.description} />;
  }

  if (spec.type === "metric_card") {
    return (
      <MetricCard
        label={spec.label}
        value={spec.value}
        delta={spec.delta}
        noData={spec.noData}
      />
    );
  }

  if (spec.type === "bar_chart_24") {
    return <BarChart24 buckets={spec.buckets} />;
  }

  if (spec.type === "project_distribution") {
    // Resolve projectIds to Project objects
    const totals = spec.totals
      .map(({ projectId, seconds }) => {
        const project = projects.find((p) => p.id === projectId);
        return project ? { project, seconds } : null;
      })
      .filter((item) => item !== null) as {
      project: NonNullable<(typeof projects)[0]>;
      seconds: number;
    }[];

    return <ProjectDistribution totals={totals} />;
  }

  if (spec.type === "streak_callout") {
    return <StreakCallout streak={spec.streak} />;
  }

  if (spec.type === "insight_card") {
    // Reconstruct Insight object
    const insight: Insight = {
      headline: spec.headline,
      body: spec.body,
      tip: spec.tip,
      sentiment: spec.sentiment,
    };

    // Wrap in GeneratedResult structure with synthetic metadata
    const result: GeneratedResult<Insight> = {
      data: insight,
      fingerprint: "",
      timeframe: "generative",
      generatedAt: spec.generatedAt,
    };

    return <InsightCard insight={result} />;
  }

  if (spec.type === "suggested_follow_ups") {
    return (
      <SuggestedFollowUps
        queries={spec.queries}
        onSelectQuery={onSelectFollowUp || noopSelectFollowUp}
      />
    );
  }

  // Unknown spec type — render nothing gracefully
  return null;
}
