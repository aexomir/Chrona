import { act, renderHook } from "@testing-library/react-native";

import type { Project } from "@/constants/projects";
import { buildSearchFacts } from "@/features/search/search-intent";
import { useSearchQuery } from "@/features/search/use-search-query";
import type { Session } from "@/features/sessions/sessions-store";
import { apple } from "@react-native-ai/apple";

import { promptOf, reply, useFakeModel } from "@/features/intelligence/__tests__/fake-model";

jest.mock("@/lib/sentry", () => ({ captureError: jest.fn() }));
jest.mock("@/features/timeline/timeline-utils", () => ({ GAP_THRESHOLD_MS: 30 * 60 * 1000 }));

const doGenerate = useFakeModel();

const now = new Date();
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600_000);

function session(id: string, start: Date, minutes: number, projectId: string | null): Session {
  return {
    id,
    title: id,
    projectId,
    startTime: start.toISOString(),
    endTime: new Date(start.getTime() + minutes * 60_000).toISOString(),
    duration: minutes * 60,
  };
}

const startOfToday = new Date(now);
startOfToday.setHours(0, 0, 0, 0);

const sessions = [
  session("a", startOfToday, 60, "p-writing"),
  session("b", new Date(startOfToday.getTime() + 60 * 60_000), 30, "p-code"),
  session("old", hoursAgo(24 * 60), 10, null),
];
const projects = [
  { id: "p-writing", name: "Writing" },
  { id: "p-code", name: "Code" },
] as Project[];

const modelAnswer = {
  timeframe: "today",
  show_timeline: false,
  show_metrics: true,
  show_chart: false,
  show_projects: true,
  show_streak: false,
  sentiment: "neutral",
  headline: "Writing led today",
  body: "An hour of writing and half an hour of code.",
};

async function searchFor(query: string) {
  const { result } = await renderHook(() => useSearchQuery());
  await act(() => result.current.search(query, sessions, projects));
  return result.current.specs!;
}

const headlineOf = (specs: Awaited<ReturnType<typeof searchFor>>) =>
  specs[0].type === "insight_card" ? specs[0].headline : undefined;

describe("buildSearchFacts", () => {
  it("summarises the period instead of listing sessions", () => {
    const facts = buildSearchFacts("today", sessions, projects, now);

    expect(facts).toContain("Period: today");
    expect(facts).toContain("Total focus: 1h 30m across 2 sessions");
    expect(facts).toContain("Top projects: Writing 67%, Code 33%");
    expect(facts).toContain("Current streak: 1 day, including today");
  });

  it("says so when the period is empty", () => {
    expect(buildSearchFacts("week", [], projects, now)).toContain("No sessions in this period.");
  });
});

describe("useSearchQuery", () => {
  it("shows the sections and headline the model chose", async () => {
    doGenerate.mockResolvedValue(reply(modelAnswer));

    const specs = await searchFor("what did I do today");

    expect(promptOf(doGenerate)).toContain("Question: what did I do today");
    expect(headlineOf(specs)).toBe("Writing led today");
    expect(specs.map((s) => s.type)).toEqual([
      "insight_card",
      "section_header",
      "metric_card",
      "metric_card",
      "section_header",
      "project_distribution",
      "suggested_follow_ups",
    ]);
  });

  it("drops the model's headline when it answers for a different period than its facts", async () => {
    doGenerate.mockResolvedValue(reply({ ...modelAnswer, timeframe: "month" }));

    const specs = await searchFor("what did I do today");

    expect(headlineOf(specs)).not.toBe("Writing led today");
    expect(specs.map((s) => s.type)).toContain("project_distribution");
  });

  it("falls back to keyword rules when the model is unavailable", async () => {
    jest.mocked(apple.isAvailable).mockReturnValue(false);

    const specs = await searchFor("which project today");

    expect(doGenerate).not.toHaveBeenCalled();
    expect(headlineOf(specs)).toBe("Writing is your top focus (67%)");
  });
});
