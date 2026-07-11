/**
 * SearchResultSpec is a discriminated union of all serializable search result specs.
 * Each variant contains only JSON-serializable props (no functions, no Date objects).
 * The renderer resolves store lookups and converts string dates to Date objects as needed.
 */

// ──── Timeline Component Specs ────

export type SessionRowSpec = {
  type: "session_row";
  sessionId: string;
  index?: number;
};

export type GapSeparatorSpec = {
  type: "gap_separator";
  durationMs: number;
};

export type DatePillSpec = {
  type: "date_pill";
  date: string; // ISO string
};

// ──── Stats / Insights Component Specs ────

export type SectionHeaderSpec = {
  type: "section_header";
  title: string;
  description: string;
};

export type MetricCardSpec = {
  type: "metric_card";
  label: string;
  value?: string;
  delta?: { dir: "up" | "down" | "same"; pct: number };
  noData?: boolean;
};

export type BarChart24Spec = {
  type: "bar_chart_24";
  buckets: number[]; // length must be 24
};

export type ProjectDistributionSpec = {
  type: "project_distribution";
  totals: {
    projectId: string;
    seconds: number;
  }[];
};

export type StreakCalloutSpec = {
  type: "streak_callout";
  streak: { current: number; ongoing: boolean };
};

export type InsightCardSpec = {
  type: "insight_card";
  headline: string;
  body: string;
  tip?: string;
  sentiment: "positive" | "neutral" | "cautionary";
  generatedAt: string; // ISO string
};

export type SuggestedFollowUpsSpec = {
  type: "suggested_follow_ups";
  queries: {
    text: string;
    icon: string; // SF symbol name
  }[];
};

// ──── Discriminated Union ────

export type SearchResultSpec =
  | SessionRowSpec
  | GapSeparatorSpec
  | DatePillSpec
  | SectionHeaderSpec
  | MetricCardSpec
  | BarChart24Spec
  | ProjectDistributionSpec
  | StreakCalloutSpec
  | InsightCardSpec
  | SuggestedFollowUpsSpec;
