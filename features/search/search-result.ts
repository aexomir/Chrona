// ──── Types ────────────────────────────────────────────────────────────

export type Insight = {
  headline: string;
  body: string;
  tip?: string;
  sentiment: "positive" | "neutral" | "cautionary";
};

export type SearchResult = Insight & {
  show_timeline: boolean;
  show_metrics: boolean;
  show_chart: boolean;
  show_projects: boolean;
  show_streak: boolean;
};

/** A generated result plus the metadata used to decide whether it needs regenerating. */
export type GeneratedResult<T> = {
  data: T;
  fingerprint: string;
  timeframe: string;
  generatedAt: string;
};

// ──── Query Parsing ────────────────────────────────────────────────────

export function parseQueryTimeframe(
  query: string,
): "today" | "week" | "month" | "all" {
  const lowerQuery = query.toLowerCase();
  if (lowerQuery.includes("today")) return "today";
  if (lowerQuery.includes("week") || lowerQuery.includes("this week"))
    return "week";
  if (lowerQuery.includes("month") || lowerQuery.includes("this month"))
    return "month";
  return "week";
}
