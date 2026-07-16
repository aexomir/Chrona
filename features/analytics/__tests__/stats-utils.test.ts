import type { Session } from "@/features/sessions/sessions-store";

import { computeFocusConsistency, computeStreak } from "../stats-utils";

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: Math.random().toString(),
    title: "Session",
    projectId: null,
    startTime: new Date().toISOString(),
    endTime: new Date().toISOString(),
    duration: 1800,
    ...overrides,
  };
}

describe("computeStreak", () => {
  it("returns 0 for no sessions", () => {
    expect(computeStreak([])).toEqual({ current: 0, ongoing: false });
  });

  it("returns 0 when the most recent session is neither today nor yesterday", () => {
    const sessions = [makeSession({ startTime: daysAgo(3).toISOString() })];
    expect(computeStreak(sessions)).toEqual({ current: 0, ongoing: false });
  });

  it("counts a single consecutive run ending today as ongoing", () => {
    const sessions = [0, 1, 2].map((n) =>
      makeSession({ startTime: daysAgo(n).toISOString() }),
    );
    expect(computeStreak(sessions)).toEqual({ current: 3, ongoing: true });
  });

  it("counts a run ending yesterday as not ongoing when today has no session", () => {
    const sessions = [1, 2, 3].map((n) =>
      makeSession({ startTime: daysAgo(n).toISOString() }),
    );
    expect(computeStreak(sessions)).toEqual({ current: 3, ongoing: false });
  });

  it("stops counting at the first gap", () => {
    const sessions = [0, 1, 3].map((n) =>
      makeSession({ startTime: daysAgo(n).toISOString() }),
    );
    expect(computeStreak(sessions)).toEqual({ current: 2, ongoing: true });
  });

  it("collapses multiple sessions on the same day into a single streak day", () => {
    const sessions = [
      makeSession({ startTime: daysAgo(0).toISOString() }),
      makeSession({ startTime: daysAgo(0).toISOString() }),
      makeSession({ startTime: daysAgo(1).toISOString() }),
    ];
    expect(computeStreak(sessions)).toEqual({ current: 2, ongoing: true });
  });
});

describe("computeFocusConsistency", () => {
  it("returns all zeros for no sessions", () => {
    expect(
      computeFocusConsistency([], daysAgo(6), daysAgo(0)),
    ).toEqual({ percentage: 0, daysWithSessions: 0, totalDays: 0 });
  });

  it("computes 100% when every day in range has a session", () => {
    const start = daysAgo(2);
    const end = daysAgo(0);
    const sessions = [0, 1, 2].map((n) =>
      makeSession({ startTime: daysAgo(n).toISOString() }),
    );
    const result = computeFocusConsistency(sessions, start, end);
    expect(result.totalDays).toBe(3);
    expect(result.daysWithSessions).toBe(3);
    expect(result.percentage).toBe(100);
  });

  it("computes a partial percentage when only some days have sessions", () => {
    const start = daysAgo(3);
    const end = daysAgo(0);
    const sessions = [makeSession({ startTime: daysAgo(0).toISOString() })];
    const result = computeFocusConsistency(sessions, start, end);
    expect(result.totalDays).toBe(4);
    expect(result.daysWithSessions).toBe(1);
    expect(result.percentage).toBe(25);
  });

  it("does not filter sessions by range itself — callers must pre-filter with filterSessions", () => {
    // totalDays comes purely from the start/end range; daysWithSessions comes
    // purely from the distinct days among the sessions passed in.
    const start = daysAgo(1);
    const end = daysAgo(0);
    const sessions = [makeSession({ startTime: daysAgo(10).toISOString() })];
    const result = computeFocusConsistency(sessions, start, end);
    expect(result.totalDays).toBe(2);
    expect(result.daysWithSessions).toBe(1);
    expect(result.percentage).toBe(50);
  });
});
