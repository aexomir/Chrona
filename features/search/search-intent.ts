import type { Project } from "@/constants/projects";
import {
  computeStreak,
  filterSessions,
  formatFocusTime,
  formatHourLabel,
  getHourBuckets,
  getPrevRange,
  getProjectTotals,
  getRange,
  getTotalSeconds,
} from "@/features/analytics/stats-utils";
import { generate } from "@/features/intelligence/on-device-model";
import type { SearchResult } from "@/features/search/search-result";
import type { Session } from "@/features/sessions/sessions-store";
import { z } from "zod";

export type QueryTimeframe = "today" | "week" | "month" | "all";

const TOP_PROJECT_COUNT = 4;

const STATS_TIMEFRAME = {
  today: "day",
  week: "week",
  month: "month",
  all: "all",
} as const;

const PERIOD_LABEL: Record<QueryTimeframe, string> = {
  today: "today",
  week: "this week",
  month: "this month",
  all: "all time",
};

const PREVIOUS_PERIOD_LABEL: Record<QueryTimeframe, string> = {
  today: "Yesterday",
  week: "Last week",
  month: "Last month",
  all: "",
};

const searchIntentSchema = z.object({
  timeframe: z
    .enum(["today", "week", "month", "all"])
    .describe("The period the question is about"),
  show_timeline: z.boolean().describe("List of individual sessions"),
  show_metrics: z.boolean().describe("Total focus time and session count"),
  show_chart: z.boolean().describe("Focus by hour of day"),
  show_projects: z.boolean().describe("How time splits across projects"),
  show_streak: z.boolean().describe("Consecutive days with a session"),
  sentiment: z.enum(["positive", "neutral", "cautionary"]),
  headline: z.string().describe("One calm line, under 60 characters"),
  body: z.string().describe("One or two short sentences"),
});

const SYSTEM = `You answer questions about the user's focus time in Chrona, a calm time-tracking app.
Pick the timeframe the question is about: today, week, month, or all for all time.
Pick only the sections that answer the question, usually one or two.
Write a calm one-line headline and a short body.
Use only numbers that appear in the facts. Never estimate or invent a figure.
No emoji, no exclamation marks, no praise.
Sentiment is positive when focus grew, cautionary when it dropped, otherwise neutral.`;

function sessionCount(n: number): string {
  return `${n} session${n === 1 ? "" : "s"}`;
}

export function buildSearchFacts(
  timeframe: QueryTimeframe,
  allSessions: Session[],
  projects: Project[],
  now: Date,
): string {
  const tf = STATS_TIMEFRAME[timeframe];
  const { start, end } = getRange(tf, now);
  const sessions = filterSessions(allSessions, start, end);
  const lines = [`Period: ${PERIOD_LABEL[timeframe]}`];

  if (sessions.length === 0) {
    lines.push("No sessions in this period.");
  } else {
    const totalSeconds = getTotalSeconds(sessions);
    lines.push(
      `Total focus: ${formatFocusTime(totalSeconds)} across ${sessionCount(sessions.length)}`,
    );

    if (tf !== "all") {
      const prev = getPrevRange(tf, now);
      const prevSessions = filterSessions(allSessions, prev.start, prev.end);
      lines.push(
        `${PREVIOUS_PERIOD_LABEL[timeframe]}: ${formatFocusTime(getTotalSeconds(prevSessions))} across ${sessionCount(prevSessions.length)}`,
      );
    }

    const top = getProjectTotals(sessions, projects).slice(0, TOP_PROJECT_COUNT);
    if (top.length > 0) {
      const split = top
        .map(({ project, seconds }) =>
          `${project.name} ${Math.round((seconds / totalSeconds) * 100)}%`,
        )
        .join(", ");
      lines.push(`Top projects: ${split}`);
    }

    const buckets = getHourBuckets(sessions);
    lines.push(`Peak hour: ${formatHourLabel(buckets.indexOf(Math.max(...buckets)))}`);
  }

  const streak = computeStreak(allSessions);
  lines.push(
    streak.current > 0
      ? `Current streak: ${streak.current} days${streak.ongoing ? ", including today" : ""}`
      : "Current streak: none",
  );

  return lines.join("\n");
}

export type SearchIntent = {
  result: SearchResult;
  timeframe: QueryTimeframe;
  /** False when the model moved off the period its facts described, so its numbers don't apply. */
  insightMatchesFacts: boolean;
};

export async function inferSearchIntent(
  query: string,
  factsTimeframe: QueryTimeframe,
  allSessions: Session[],
  projects: Project[],
  now: Date,
): Promise<SearchIntent | null> {
  const facts = buildSearchFacts(factsTimeframe, allSessions, projects, now);
  const intent = await generate(
    searchIntentSchema,
    `Question: ${query.trim()}\n\nFacts:\n${facts}`,
    SYSTEM,
  );
  if (!intent) return null;

  const { timeframe, ...result } = intent;
  return { result, timeframe, insightMatchesFacts: timeframe === factsTimeframe };
}
