import { useState } from "react";
import type { AIComponentSpec } from "@/lib/component-spec";

// Timeline components
import { SessionRow } from "@/components/timeline/session-row";
import { GapSeparator } from "@/components/timeline/gap-separator";
import { CalendarEventMarker } from "@/components/timeline/calendar-event-marker";
import { LiveSessionRow } from "@/components/timeline/live-session-row";
import { DatePill } from "@/components/timeline/date-pill";

// Stats components
import { SectionHeader } from "@/components/stats/section-header";
import { MetricCard } from "@/components/stats/metric-card";
import { BarChart24 } from "@/components/stats/bar-chart24";
import { ProjectDistribution } from "@/components/stats/project-distribution";
import { StreakCallout } from "@/components/stats/streak-callout";
import { AiInsightCard } from "@/components/stats/ai-insight-card";
import { SuggestedFollowUps } from "@/components/stats/suggested-follow-ups";

// Stores
import { useSessionsStore } from "@/stores/sessions-store";
import { useCalendarStore } from "@/stores/calendar-store";
import { useProjects } from "@/stores/projects-store";

// Utils
import type { Insight } from "@/lib/inference";
import type { InferenceResult } from "@/stores/inference-store";

/**
 * AIComponentRenderer resolves AI-generated component specs into real React Native components.
 * Handles store lookups, local state, and type-safe rendering.
 */
export function AIComponentRenderer({
  spec,
  onSelectFollowUp,
}: {
  spec: AIComponentSpec;
  onSelectFollowUp?: (query: string) => void;
}) {
  const { sessions } = useSessionsStore();
  const { events: calendarEvents } = useCalendarStore();
  const { projects } = useProjects();

  // calendar_event_marker manages expanded state locally
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  // ──── Timeline specs ────

  if (spec.type === "session_row") {
    const session = sessions.find((s) => s.id === spec.sessionId);
    if (!session) return null;

    // Find overlapping calendar events
    const sessionStart = new Date(session.startTime);
    const sessionEnd = new Date(session.endTime);
    const overlappingEvents = calendarEvents.filter((event) => {
      const eventStart = new Date(event.startDate);
      const eventEnd = new Date(event.endDate);
      return eventStart < sessionEnd && eventEnd > sessionStart;
    });

    return (
      <SessionRow
        session={session}
        index={spec.index ?? 0}
        overlappingEvents={overlappingEvents}
      />
    );
  }

  if (spec.type === "gap_separator") {
    return <GapSeparator durationMs={spec.durationMs} />;
  }

  if (spec.type === "calendar_event_marker") {
    const event = calendarEvents.find((e) => e.id === spec.eventId);
    if (!event) return null;

    return (
      <CalendarEventMarker
        event={event}
        index={spec.index ?? 0}
        expanded={expandedEventId === spec.eventId}
        onToggle={() =>
          setExpandedEventId((prev) =>
            prev === spec.eventId ? null : spec.eventId
          )
        }
      />
    );
  }

  if (spec.type === "live_session_row") {
    return (
      <LiveSessionRow
        startTimestamp={new Date().toISOString()}
        index={spec.index ?? 0}
      />
    );
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

  if (spec.type === "ai_insight_card") {
    // Reconstruct Insight object
    const insight: Insight = {
      headline: spec.headline,
      body: spec.body,
      tip: spec.tip,
      sentiment: spec.sentiment,
    };

    // Wrap in InferenceResult structure with synthetic metadata
    const result: InferenceResult<Insight> = {
      data: insight,
      fingerprint: "",
      timeframe: "generative",
      generatedAt: spec.generatedAt,
    };

    return (
      <AiInsightCard
        insight={result}
        isGenerating={false}
        isReady={true}
        downloadProgress={0}
        error={null}
        onRefresh={() => {
          // No-op: generative UI displays cached insight; re-inference is out of scope
        }}
      />
    );
  }

  if (spec.type === "suggested_follow_ups") {
    return (
      <SuggestedFollowUps
        queries={spec.queries}
        onSelectQuery={onSelectFollowUp || (() => {})}
      />
    );
  }

  // Unknown spec type — render nothing gracefully
  return null;
}
