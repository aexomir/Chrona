import type { Project } from "@/constants/projects";
import type { AIComponentSpec } from "@/lib/component-spec";
import { parseQueryTimeframe, type SearchResult } from "@/lib/inference";
import { buildFallbackSearchSpecs, buildSearchSpecs } from "@/lib/search-utils";
import type { Session } from "@/stores/sessions-store";
import { useState } from "react";

export interface UseSearchQueryReturn {
  isReady: boolean;
  isSearching: boolean;
  specs: AIComponentSpec[] | null;
  lastQuery: string;
  search(
    query: string,
    allSessions: Session[],
    projects: Project[],
  ): Promise<void>;
  reset(): void;
}

function analyzeQuery(query: string): SearchResult {
  const lowerQuery = query.toLowerCase();

  const askingAboutTimeline =
    lowerQuery.includes("when") ||
    lowerQuery.includes("timeline") ||
    lowerQuery.includes("session") ||
    lowerQuery.includes("log");

  const askingAboutMetrics =
    lowerQuery.includes("how much") ||
    lowerQuery.includes("total") ||
    lowerQuery.includes("time") ||
    lowerQuery.includes("duration") ||
    lowerQuery.includes("stat");

  const askingAboutChart =
    lowerQuery.includes("hour") ||
    lowerQuery.includes("activity") ||
    lowerQuery.includes("when") ||
    lowerQuery.includes("pattern");

  const askingAboutProjects =
    lowerQuery.includes("project") || lowerQuery.includes("which");

  const askingAboutStreak =
    lowerQuery.includes("streak") ||
    lowerQuery.includes("consistency") ||
    lowerQuery.includes("consecutive");

  // Default: show timeline and metrics
  const showTimeline =
    askingAboutTimeline ||
    (!askingAboutMetrics &&
      !askingAboutChart &&
      !askingAboutProjects &&
      !askingAboutStreak);
  const showMetrics =
    askingAboutMetrics ||
    (!askingAboutTimeline &&
      !askingAboutChart &&
      !askingAboutProjects &&
      !askingAboutStreak);
  const showChart = askingAboutChart;
  const showProjects = askingAboutProjects;
  const showStreak = askingAboutStreak;

  return {
    headline: "Here's what I found",
    body: "Based on your focus sessions data.",
    sentiment: "neutral",
    show_timeline: showTimeline,
    show_metrics: showMetrics,
    show_chart: showChart,
    show_projects: showProjects,
    show_streak: showStreak,
  };
}

export function useSearchQuery(): UseSearchQueryReturn {
  const [isSearching, setIsSearching] = useState(false);
  const [specs, setSpecs] = useState<AIComponentSpec[] | null>(null);
  const [lastQuery, setLastQuery] = useState("");

  const search = async (
    query: string,
    allSessions: Session[],
    projects: Project[],
  ): Promise<void> => {
    if (isSearching || !query.trim()) return;

    setIsSearching(true);
    setLastQuery(query);
    const now = new Date();
    const queryTimeframe = parseQueryTimeframe(query);

    // Simulate brief processing delay for UX (optional)
    await new Promise((resolve) => setTimeout(resolve, 100));

    try {
      // Analyze query using rule-based logic
      const result = analyzeQuery(query);

      // Build specs based on analysis
      const resultSpecs = buildSearchSpecs(
        result,
        queryTimeframe,
        allSessions,
        projects,
        now,
        query,
      );
      setSpecs(resultSpecs);
    } catch {
      // Fallback if analysis fails (shouldn't happen)
      const fallbackSpecs = buildFallbackSearchSpecs(
        query,
        queryTimeframe,
        allSessions,
        now,
      );
      setSpecs(fallbackSpecs);
    } finally {
      setIsSearching(false);
    }
  };

  const reset = () => {
    setSpecs(null);
    setLastQuery("");
  };

  return {
    isReady: true, // Always ready—no model to download
    isSearching,
    specs,
    lastQuery,
    search,
    reset,
  };
}
