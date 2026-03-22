import { detectMissedTime } from "@/features/recovery/detectMissedTime";
import { getAppUsage } from "@/features/activity-watch/activitywatch";
import type { Session, AppUsage } from "@/features/sessions/sessions-store";

jest.mock("react-native-mmkv");
jest.mock("react-native-reanimated", () =>
  require("react-native-reanimated/mock")
);

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("@/features/activity-watch/activitywatch", () => ({
  getAppUsage: jest.fn(),
}));

const mockGetAppUsage = getAppUsage as jest.MockedFunction<typeof getAppUsage>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NOW = Date.now();
const MINS = (n: number) => n * 60 * 1000;
const HOURS = (n: number) => n * 60 * 60 * 1000;

function makeSession(startMinsAgo: number, endMinsAgo: number): Session {
  return {
    id: `s-${startMinsAgo}-${endMinsAgo}`,
    title: "Test session",
    projectId: null,
    startTime: new Date(NOW - MINS(startMinsAgo)).toISOString(),
    endTime: new Date(NOW - MINS(endMinsAgo)).toISOString(),
    duration: MINS(startMinsAgo - endMinsAgo) / 1000,
  };
}

function appUsage(name: string, duration: number): AppUsage {
  return { app: name, duration };
}

// A suggestProject mock that maps app names to project IDs
function makeSuggestProject(
  mapping: Record<string, { projectId: string; score: number }>
) {
  return (apps: AppUsage[]) => {
    const a = apps[0];
    const entry = mapping[a?.app];
    if (!entry) return null;
    return {
      projectId: entry.projectId,
      matchedApps: [a.app],
      score: entry.score,
      totalCoveredDuration: a.duration,
    };
  };
}

// ---------------------------------------------------------------------------
// Core detection
// ---------------------------------------------------------------------------

describe("detectMissedTime", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns [] when there are no gaps (all time covered by sessions)", async () => {
    // Sessions cover the entire 8-hour window
    const sessions = [
      makeSession(8 * 60, 4 * 60),
      makeSession(4 * 60, 60),
      makeSession(60, 31), // ends 31 min ago — gap to now is trimmed by 30-min buffer → <1 min → skipped
    ];
    mockGetAppUsage.mockResolvedValue([]);
    const results = await detectMissedTime(sessions, jest.fn().mockReturnValue(null));
    expect(results).toEqual([]);
  });

  it("returns [] when there are gaps but AW reports < 10 minutes of activity", async () => {
    // No sessions = one big gap, but only 5 min of AW activity
    mockGetAppUsage.mockResolvedValue([appUsage("Cursor", 300)]); // 5 min < 10 min threshold
    const results = await detectMissedTime([], jest.fn().mockReturnValue(null));
    expect(results).toEqual([]);
  });

  it("returns [] when AW is offline (empty app list)", async () => {
    mockGetAppUsage.mockResolvedValue([]);
    const results = await detectMissedTime([], jest.fn().mockReturnValue(null));
    expect(results).toEqual([]);
  });

  it("silently returns [] when getAppUsage throws", async () => {
    mockGetAppUsage.mockRejectedValue(new Error("AW offline"));
    const results = await detectMissedTime([], jest.fn().mockReturnValue(null));
    expect(results).toEqual([]);
  });

  // ---- 30-minute end buffer ------------------------------------------------

  it("skips a gap that is trimmed to zero length by the 30-minute buffer", async () => {
    // Session ending 20 min ago → gap from 20 min ago to now
    // adjustedEnd = now - 30 min < gap.start (now - 20 min) → skip
    // BUT: the gap is 20 min >= 15 min (MIN_GAP_MS) so it passes findGaps
    const sessions = [makeSession(8 * 60, 20)]; // session ends 20 min ago
    mockGetAppUsage.mockResolvedValue([]);
    const results = await detectMissedTime(sessions, jest.fn().mockReturnValue(null));
    // getAppUsage should not be called (gap trimmed to empty)
    expect(mockGetAppUsage).not.toHaveBeenCalled();
    expect(results).toEqual([]);
  });

  it("does query a gap that still has > 0 duration after the 30-minute buffer", async () => {
    // Session ending 45 min ago → gap from [45 min ago, now], trimmed to [45 min ago, now-30min] = 15 min
    const sessions = [makeSession(8 * 60, 45)];
    mockGetAppUsage.mockResolvedValue([]); // returns nothing, but it IS called
    await detectMissedTime(sessions, jest.fn().mockReturnValue(null));
    expect(mockGetAppUsage).toHaveBeenCalled();
  });

  // ---- Coverage filter -----------------------------------------------------

  it("filters out candidates with coverage below 50%", async () => {
    // Total AW: 1000s. Cursor: 400s → 40% coverage < 50% → filtered
    mockGetAppUsage.mockResolvedValue([
      appUsage("Cursor", 400),
      appUsage("OtherApp", 600),
    ]);

    const suggestProject = jest.fn().mockImplementation((apps: AppUsage[]) => {
      if (apps[0].app === "Cursor") {
        return { projectId: "proj-1", matchedApps: ["Cursor"], score: 8, totalCoveredDuration: 400 };
      }
      return null;
    });

    const results = await detectMissedTime([], suggestProject);
    // proj-1 coverage: 400 / 1000 = 40% < 50% → filtered out
    expect(results).toEqual([]);
  });

  it("includes candidates with coverage >= 50%", async () => {
    // Total AW: 1200s. Cursor: 700s → 58.3% coverage ≥ 50% ✓
    mockGetAppUsage.mockResolvedValue([
      appUsage("Cursor", 700),
      appUsage("Chrome", 500),
    ]);

    const suggestProject = makeSuggestProject({
      Cursor: { projectId: "proj-1", score: 6 },
      Chrome: { projectId: "proj-1", score: 6 }, // same project → coveredDuration = 1200 = 100%
    });

    const results = await detectMissedTime([], suggestProject);
    expect(results.length).toBe(1);
    expect(results[0].suggestion.projectId).toBe("proj-1");
  });

  // ---- Confidence scoring --------------------------------------------------

  it("attaches a confidence value between 0 and 1 to each RecoveryPeriod", async () => {
    mockGetAppUsage.mockResolvedValue([appUsage("Cursor", 1200)]);
    const suggestProject = makeSuggestProject({
      Cursor: { projectId: "proj-1", score: 7 },
    });

    const results = await detectMissedTime([], suggestProject);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].confidence).toBeDefined();
    expect(results[0].confidence!).toBeGreaterThan(0);
    expect(results[0].confidence!).toBeLessThanOrEqual(1);
  });

  it("higher score produces higher confidence when coverage is equal", async () => {
    // Run two separate detections and compare confidences
    mockGetAppUsage.mockResolvedValueOnce([appUsage("Cursor", 1200)]);
    const highScore = makeSuggestProject({ Cursor: { projectId: "proj-1", score: 9 } });
    const [highResult] = await detectMissedTime([], highScore);

    mockGetAppUsage.mockResolvedValueOnce([appUsage("Cursor", 1200)]);
    const lowScore = makeSuggestProject({ Cursor: { projectId: "proj-1", score: 3 } });
    const [lowResult] = await detectMissedTime([], lowScore);

    expect(highResult.confidence!).toBeGreaterThan(lowResult.confidence!);
  });

  // ---- Top-2 limit ---------------------------------------------------------

  it("returns at most 2 results when multiple gaps produce candidates", async () => {
    // 2 sessions create 3 gaps:
    //   Gap 1: [8h ago, 6h ago]
    //   Gap 2: [5h ago, 4h ago]
    //   Gap 3: [3h ago, now] → trimmed to [3h ago, now-30min] ≈ 2.5h
    const sessions = [
      makeSession(6 * 60, 5 * 60), // covers [6h, 5h]
      makeSession(4 * 60, 3 * 60), // covers [4h, 3h]
    ];

    // Each call to getAppUsage returns different dominant apps
    mockGetAppUsage
      .mockResolvedValueOnce([appUsage("Cursor", 6000)]) // gap 1
      .mockResolvedValueOnce([appUsage("Figma", 3000)])  // gap 2
      .mockResolvedValueOnce([appUsage("Slack", 2400)]); // gap 3

    const suggestProject = makeSuggestProject({
      Cursor: { projectId: "proj-1", score: 9 }, // highest confidence
      Figma: { projectId: "proj-2", score: 6 },  // second
      Slack: { projectId: "proj-3", score: 4 },  // third — should be cut
    });

    const results = await detectMissedTime(sessions, suggestProject);
    // Each gap has 100% coverage (single app, maps to one project)
    expect(results.length).toBe(2);
  });

  it("sorts results by confidence descending", async () => {
    const sessions = [
      makeSession(6 * 60, 5 * 60),
      makeSession(4 * 60, 3 * 60),
    ];

    mockGetAppUsage
      .mockResolvedValueOnce([appUsage("Cursor", 6000)]) // gap 1 — score 9
      .mockResolvedValueOnce([appUsage("Figma", 3000)]) // gap 2 — score 6
      .mockResolvedValueOnce([appUsage("Slack", 2400)]); // gap 3 — score 4

    const suggestProject = makeSuggestProject({
      Cursor: { projectId: "proj-1", score: 9 },
      Figma:  { projectId: "proj-2", score: 6 },
      Slack:  { projectId: "proj-3", score: 4 },
    });

    const results = await detectMissedTime(sessions, suggestProject);
    expect(results[0].confidence!).toBeGreaterThanOrEqual(results[1].confidence!);
    expect(results[0].suggestion.projectId).toBe("proj-1");
    expect(results[1].suggestion.projectId).toBe("proj-2");
  });

  // ---- RecoveryPeriod structure --------------------------------------------

  it("returned RecoveryPeriod has correct shape and ISO timestamps", async () => {
    mockGetAppUsage.mockResolvedValue([appUsage("Cursor", 1200)]);
    const suggestProject = makeSuggestProject({
      Cursor: { projectId: "proj-1", score: 5 },
    });

    const results = await detectMissedTime([], suggestProject);
    expect(results.length).toBeGreaterThan(0);

    const period = results[0];
    expect(period.startTime).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO string
    expect(period.endTime).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(new Date(period.endTime).getTime()).toBeLessThan(NOW - MINS(29)); // respects 30-min buffer
    expect(period.apps).toBeInstanceOf(Array);
    expect(period.suggestion.projectId).toBe("proj-1");
    expect(period.suggestion.matchedApps).toContain("Cursor");
    expect(period.source).toBeUndefined(); // AW-based, not calendar
  });

  it("groups multiple apps under one RecoveryPeriod when they share the same project", async () => {
    // Both Cursor and Chrome map to proj-1 → single RecoveryPeriod, not two
    mockGetAppUsage.mockResolvedValue([
      appUsage("Cursor", 2000),
      appUsage("Chrome", 1000),
    ]);
    const suggestProject = makeSuggestProject({
      Cursor: { projectId: "proj-1", score: 5 },
      Chrome: { projectId: "proj-1", score: 5 },
    });

    const results = await detectMissedTime([], suggestProject);
    expect(results.length).toBe(1);
    expect(results[0].apps.length).toBe(2);
    expect(results[0].apps.map((a) => a.app)).toContain("Cursor");
    expect(results[0].apps.map((a) => a.app)).toContain("Chrome");
  });

  it("skips apps that have no project suggestion", async () => {
    mockGetAppUsage.mockResolvedValue([
      appUsage("Cursor", 2400), // has suggestion
      appUsage("RandomApp", 600), // no suggestion
    ]);

    const suggestProject = jest.fn().mockImplementation((apps: AppUsage[]) => {
      if (apps[0].app === "Cursor") {
        return { projectId: "proj-1", matchedApps: ["Cursor"], score: 5, totalCoveredDuration: 2400 };
      }
      return null; // RandomApp → no suggestion
    });

    const results = await detectMissedTime([], suggestProject);
    // Coverage: Cursor 2400 / total (2400+600) = 80% ≥ 50% ✓
    expect(results.length).toBe(1);
    expect(results[0].apps.map((a) => a.app)).not.toContain("RandomApp");
  });
});
