import { getSmartDefaultApps, useSuggestionsStore } from "@/stores/suggestions-store";
import type { AppUsage } from "@/stores/sessions-store";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// MMKV is a native module — use the auto-mock from __mocks__/react-native-mmkv.ts
jest.mock("react-native-mmkv");

// Mock react-native-reanimated (not needed by store tests but storage/index.ts may pull it in)
jest.mock("react-native-reanimated", () =>
  require("react-native-reanimated/mock")
);

// Mock the getAppCategory used inside suggestProject
jest.mock("@/lib/activitywatch", () => ({
  getAppCategory: (appName: string) => {
    const map: Record<string, string> = {
      chrome: "browser",
      safari: "browser",
      arc: "browser",
      firefox: "browser",
      cursor: "ide",
      xcode: "ide",
      code: "ide",
      slack: "communication",
      discord: "communication",
      figma: "design",
    };
    return map[appName.toLowerCase()] ?? null;
  },
  checkAwAvailability: jest.fn(),
  APP_CATEGORIES: {},
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function app(name: string, duration: number, titles?: string[]): AppUsage {
  return { app: name, duration, titles };
}

const DAY_MS = 86_400_000;

// ---------------------------------------------------------------------------
// getSmartDefaultApps
// ---------------------------------------------------------------------------

describe("getSmartDefaultApps", () => {
  it("returns historically associated apps when projectId is given", () => {
    const assocs = {
      Cursor: { "proj-1": { count: 3, totalDuration: 2700, lastUsed: Date.now() } },
      Slack: { "proj-2": { count: 2, totalDuration: 1200, lastUsed: Date.now() } },
    };
    const result = getSmartDefaultApps(
      [app("Cursor", 900), app("Slack", 600)],
      "proj-1",
      assocs
    );
    expect(result).toEqual(new Set(["Cursor"]));
    expect(result.has("Slack")).toBe(false);
  });

  it("falls back to 80% duration threshold when no historical match", () => {
    // Cursor covers 60%, Chrome 40% — need both to hit 80%
    const result = getSmartDefaultApps(
      [app("Cursor", 3000), app("Chrome", 2000)],
      null,
      {}
    );
    expect(result.has("Cursor")).toBe(true);
    expect(result.has("Chrome")).toBe(true);
  });

  it("selects only dominant app when it covers 80%+", () => {
    // Cursor covers 84% — stops there, Chrome not needed
    const result = getSmartDefaultApps(
      [app("Cursor", 4200), app("Chrome", 800)],
      null,
      {}
    );
    expect(result.has("Cursor")).toBe(true);
    expect(result.has("Chrome")).toBe(false);
  });

  it("returns empty set when no apps provided", () => {
    const result = getSmartDefaultApps([], null, {});
    expect(result.size).toBe(0);
  });

  it("returns all apps when total duration is zero", () => {
    const apps = [app("Cursor", 0), app("Chrome", 0)];
    const result = getSmartDefaultApps(apps, null, {});
    expect(result).toEqual(new Set(["Cursor", "Chrome"]));
  });

  it("falls back to all apps when projectId given but no historical match exists", () => {
    // projectId set but no association → falls through to duration threshold
    const result = getSmartDefaultApps(
      [app("Cursor", 4200), app("Chrome", 800)],
      "proj-x",
      {} // no associations
    );
    // Falls back to 80% threshold: Cursor alone covers 84% → only Cursor
    expect(result.has("Cursor")).toBe(true);
    expect(result.has("Chrome")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// learnFromSession
// ---------------------------------------------------------------------------

describe("useSuggestionsStore — learnFromSession", () => {
  beforeEach(() => {
    (global as any).__clearMmkv?.();
    useSuggestionsStore.setState({ associations: {} });
  });

  it("creates a new association with count 1, correct duration, and lastUsed timestamp", () => {
    const before = Date.now();
    useSuggestionsStore.getState().learnFromSession([app("Cursor", 1800)], "proj-1");
    const after = Date.now();

    const entry = useSuggestionsStore.getState().associations["Cursor"]["proj-1"];
    expect(entry.count).toBe(1);
    expect(entry.totalDuration).toBe(1800);
    expect(entry.lastUsed).toBeGreaterThanOrEqual(before);
    expect(entry.lastUsed).toBeLessThanOrEqual(after);
  });

  it("increments count and duration on repeated calls", () => {
    const { learnFromSession } = useSuggestionsStore.getState();
    learnFromSession([app("Cursor", 600)], "proj-1");
    learnFromSession([app("Cursor", 900)], "proj-1");
    learnFromSession([app("Cursor", 300)], "proj-1");

    const entry = useSuggestionsStore.getState().associations["Cursor"]["proj-1"];
    expect(entry.count).toBe(3);
    expect(entry.totalDuration).toBe(1800);
  });

  it("tracks multiple apps in the same session independently", () => {
    useSuggestionsStore.getState().learnFromSession(
      [app("Cursor", 1800), app("Chrome", 600)],
      "proj-1"
    );
    const assocs = useSuggestionsStore.getState().associations;
    expect(assocs["Cursor"]["proj-1"].count).toBe(1);
    expect(assocs["Chrome"]["proj-1"].count).toBe(1);
    expect(assocs["Cursor"]["proj-1"].totalDuration).toBe(1800);
    expect(assocs["Chrome"]["proj-1"].totalDuration).toBe(600);
  });

  it("tracks the same app associated with multiple projects", () => {
    const { learnFromSession } = useSuggestionsStore.getState();
    learnFromSession([app("Cursor", 900)], "proj-1");
    learnFromSession([app("Cursor", 900)], "proj-2");

    const assocs = useSuggestionsStore.getState().associations;
    expect(assocs["Cursor"]["proj-1"].count).toBe(1);
    expect(assocs["Cursor"]["proj-2"].count).toBe(1);
  });

  it("updates lastUsed on every call", async () => {
    const { learnFromSession } = useSuggestionsStore.getState();
    learnFromSession([app("Cursor", 900)], "proj-1");
    const first = useSuggestionsStore.getState().associations["Cursor"]["proj-1"].lastUsed;

    await new Promise((r) => setTimeout(r, 5));
    learnFromSession([app("Cursor", 900)], "proj-1");
    const second = useSuggestionsStore.getState().associations["Cursor"]["proj-1"].lastUsed;

    expect(second).toBeGreaterThan(first);
  });
});

// ---------------------------------------------------------------------------
// suggestProject
// ---------------------------------------------------------------------------

describe("useSuggestionsStore — suggestProject", () => {
  beforeEach(() => {
    (global as any).__clearMmkv?.();
    useSuggestionsStore.setState({ associations: {} });
  });

  it("returns null when no associations exist", () => {
    const result = useSuggestionsStore.getState().suggestProject([app("Cursor", 1800)]);
    expect(result).toBeNull();
  });

  it("returns null when score is below threshold (score < 3)", () => {
    // 2 sessions with fresh timestamps → score = 2 * 1.0 = 2.0 < 3
    const { learnFromSession, suggestProject } = useSuggestionsStore.getState();
    learnFromSession([app("Cursor", 900)], "proj-1");
    learnFromSession([app("Cursor", 900)], "proj-1");
    expect(suggestProject([app("Cursor", 1800)])).toBeNull();
  });

  it("returns suggestion when score >= 3 and coverage >= 40%", () => {
    const { learnFromSession, suggestProject } = useSuggestionsStore.getState();
    // 3 sessions → score = 3 * 1.0 = 3.0 ≥ 3
    for (let i = 0; i < 3; i++) learnFromSession([app("Cursor", 900)], "proj-1");

    const result = suggestProject([app("Cursor", 1800)]);
    expect(result).not.toBeNull();
    expect(result!.projectId).toBe("proj-1");
    expect(result!.matchedApps).toContain("Cursor");
    expect(result!.score).toBeGreaterThanOrEqual(3);
    expect(result!.totalCoveredDuration).toBe(1800);
  });

  it("returns null when coverage is below 40%", () => {
    const { learnFromSession, suggestProject } = useSuggestionsStore.getState();
    // 5 sessions → score = 5 — but Cursor is only 100s out of 3100s total (3.2% coverage < 40%)
    for (let i = 0; i < 5; i++) learnFromSession([app("Cursor", 900)], "proj-1");

    const result = suggestProject([
      app("Cursor", 100),
      app("OtherA", 600),
      app("OtherB", 600),
      app("OtherC", 600),
      app("OtherD", 600),
      app("OtherE", 600), // total = 3100, Cursor = 100 = 3.2%
    ]);
    expect(result).toBeNull();
  });

  it("returns the highest-scoring project when multiple qualify", () => {
    const { learnFromSession, suggestProject } = useSuggestionsStore.getState();
    // proj-1: 5 sessions, proj-2: 3 sessions — both pass threshold with Cursor
    for (let i = 0; i < 5; i++) learnFromSession([app("Cursor", 900)], "proj-1");
    for (let i = 0; i < 3; i++) learnFromSession([app("Cursor", 900)], "proj-2");

    const result = suggestProject([app("Cursor", 1800)]);
    expect(result!.projectId).toBe("proj-1");
  });

  it("exposes score and totalCoveredDuration on the return value", () => {
    const { learnFromSession, suggestProject } = useSuggestionsStore.getState();
    for (let i = 0; i < 4; i++) learnFromSession([app("Cursor", 900)], "proj-1");

    const result = suggestProject([app("Cursor", 1800)]);
    expect(result).not.toBeNull();
    expect(typeof result!.score).toBe("number");
    expect(typeof result!.totalCoveredDuration).toBe("number");
    expect(result!.totalCoveredDuration).toBe(1800);
  });

  // ---- Recency decay -------------------------------------------------------

  it("applies full weight (1.0×) to associations used within 24 hours", () => {
    // Fresh: 3 sessions → score should be 3 * 1.0 = 3.0 (just above threshold)
    const { suggestProject } = useSuggestionsStore.getState();
    useSuggestionsStore.setState({
      associations: {
        Cursor: {
          "proj-1": { count: 3, totalDuration: 2700, lastUsed: Date.now() - 1000 },
        },
      },
    });
    expect(suggestProject([app("Cursor", 1800)])).not.toBeNull();
  });

  it("applies 0.8× weight to associations used 2–6 days ago", () => {
    const { suggestProject } = useSuggestionsStore.getState();
    // count 4, 4 days ago → score = 4 * 0.8 = 3.2 ≥ 3, passes
    useSuggestionsStore.setState({
      associations: {
        Cursor: {
          "proj-1": { count: 4, totalDuration: 3600, lastUsed: Date.now() - 4 * DAY_MS },
        },
      },
    });
    expect(suggestProject([app("Cursor", 1800)])).not.toBeNull();
  });

  it("applies 0.5× weight to associations older than 7 days", () => {
    const { suggestProject } = useSuggestionsStore.getState();
    // count 5, 10 days ago → score = 5 * 0.5 = 2.5 < 3 → null
    useSuggestionsStore.setState({
      associations: {
        Cursor: {
          "proj-1": { count: 5, totalDuration: 4500, lastUsed: Date.now() - 10 * DAY_MS },
        },
      },
    });
    expect(suggestProject([app("Cursor", 1800)])).toBeNull();
  });

  it("applies 0.5× weight (old) to legacy entries missing lastUsed", () => {
    const { suggestProject } = useSuggestionsStore.getState();
    // count 5, lastUsed undefined (legacy) → score = 5 * 0.5 = 2.5 < 3 → null
    useSuggestionsStore.setState({
      associations: {
        Cursor: {
          // @ts-expect-error — simulating legacy data without lastUsed
          "proj-1": { count: 5, totalDuration: 4500 },
        },
      },
    });
    expect(suggestProject([app("Cursor", 1800)])).toBeNull();
  });

  it("applies 0.5× weight to legacy entries and suggestion still returns with enough count", () => {
    const { suggestProject } = useSuggestionsStore.getState();
    // count 8, lastUsed undefined → score = 8 * 0.5 = 4.0 ≥ 3 → qualifies
    useSuggestionsStore.setState({
      associations: {
        Cursor: {
          // @ts-expect-error — simulating legacy data without lastUsed
          "proj-1": { count: 8, totalDuration: 7200 },
        },
      },
    });
    expect(suggestProject([app("Cursor", 1800)])).not.toBeNull();
  });

  // ---- Category enrichment -------------------------------------------------

  it("category enrichment boosts score but does NOT grant coverage credit", () => {
    const { suggestProject } = useSuggestionsStore.getState();
    // Chrome → proj-1: 10 sessions (category enrichment for Arc = 10 * 0.5 = 5.0 score)
    // Arc has no direct associations → coveredDuration = 0 → coverage = 0% < 40% → null
    useSuggestionsStore.setState({
      associations: {
        Chrome: {
          "proj-1": { count: 10, totalDuration: 9000, lastUsed: Date.now() },
        },
      },
    });
    // Arc is same category as Chrome, but no direct Arc association
    const result = suggestProject([app("Arc", 1800)]);
    expect(result).toBeNull(); // coverage check blocks it even though score is high
  });

  it("category enrichment tips score over threshold when combined with direct associations", () => {
    // Arc → proj-1: 2 sessions (direct score 2.0)
    // Chrome → proj-1: 4 sessions (category boost 4 * 0.5 = 2.0)
    // Total score = 4.0 ≥ 3. Coverage = Arc duration / total = 100% ≥ 40% ✓
    useSuggestionsStore.setState({
      associations: {
        Arc: {
          "proj-1": { count: 2, totalDuration: 1800, lastUsed: Date.now() },
        },
        Chrome: {
          "proj-1": { count: 4, totalDuration: 3600, lastUsed: Date.now() },
        },
      },
    });
    const result = useSuggestionsStore.getState().suggestProject([app("Arc", 1800)]);
    expect(result).not.toBeNull();
    expect(result!.projectId).toBe("proj-1");
  });

  it("category enrichment does not cross-project-pollute: only enriches the right project", () => {
    // Chrome → proj-1: 4 sessions
    // Arc → proj-2: 4 sessions (different project)
    // Query with [Safari] (browser category): Chrome enriches proj-1, Arc enriches proj-2
    // Neither has direct Safari association → coverage = 0 for both → both return null
    useSuggestionsStore.setState({
      associations: {
        Chrome: { "proj-1": { count: 4, totalDuration: 3600, lastUsed: Date.now() } },
        Arc: { "proj-2": { count: 4, totalDuration: 3600, lastUsed: Date.now() } },
      },
    });
    const result = useSuggestionsStore.getState().suggestProject([app("Safari", 1800)]);
    // Both proj-1 and proj-2 get boosted scores but have zero direct-match coverage → null
    expect(result).toBeNull();
  });
});
