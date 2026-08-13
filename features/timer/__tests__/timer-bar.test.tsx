import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";

import { TimerBar } from "../timer-bar";

import { useCalendarStore } from "@/features/calendar/calendar-store";
import { useUntrackedStore } from "@/features/auto-track/untracked-store";
import { useProjects } from "@/features/projects/projects-store";
import { useSessionsStore } from "@/features/sessions/sessions-store";
import { useTimerStore } from "@/features/timer/timer-store";

jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("expo-image", () => {
  const { View } = require("react-native");
  return { Image: (props: any) => <View {...props} /> };
});
jest.mock("@/features/intelligence/usage-query", () => ({
  getAppsForWindow: jest.fn(async () => ({ status: "ok", apps: [] })),
  INTERACTIVE_TIMEOUT_MS: 3000,
  BACKFILL_TIMEOUT_MS: 8000,
}));
jest.mock("@/features/intelligence/pending-usage-store", () => ({
  usePendingUsageStore: { getState: jest.fn(() => ({ enqueue: jest.fn() })) },
}));

jest.mock("@/features/timer/timer-store", () => ({ useTimerStore: jest.fn() }));
jest.mock("@/features/sessions/sessions-store", () => ({
  useSessionsStore: jest.fn(),
}));
jest.mock("@/features/projects/projects-store", () => ({
  useProjects: jest.fn(),
}));
jest.mock("@/features/calendar/calendar-store", () => ({
  useCalendarStore: jest.fn(),
  CALENDAR_REFRESH_INTERVAL_MS: 5 * 60 * 1000,
}));
jest.mock("@/features/auto-track/pending-review-store", () => ({
  usePendingReviewStore: { getState: jest.fn(() => ({ offer: jest.fn() })) },
}));
jest.mock("@/features/auto-track/untracked-store", () => ({
  useUntrackedStore: jest.fn(),
}));

function mockSelectorHook(hook: jest.Mock, state: Record<string, any>) {
  hook.mockImplementation((selector?: (s: any) => any) =>
    selector ? selector(state) : state,
  );
}

const baseTimerState = {
  isTracking: false,
  isAutoTracked: false,
  title: "",
  projectId: null,
  startTimestamp: null,
  stopTimer: jest.fn(),
  startTimer: jest.fn(),
  interruptedSession: null,
  setInterruptedSession: jest.fn(),
};

const baseProjects = [
  { id: "p1", name: "Deep Work", color: "#fff", icon: "bolt" },
];

describe("TimerBar priority ordering", () => {
  beforeEach(() => {
    mockSelectorHook(useSessionsStore as unknown as jest.Mock, {
      addSession: jest.fn(),
    });
    mockSelectorHook(useProjects as unknown as jest.Mock, {
      projects: baseProjects,
    });
    mockSelectorHook(useCalendarStore as unknown as jest.Mock, {
      isEnabled: false,
      getActiveEventSuggestion: jest.fn(() => null),
      fetchEvents: jest.fn(),
    });
    mockSelectorHook(useUntrackedStore as unknown as jest.Mock, {
      pendingHint: null,
      dismissHint: jest.fn(),
    });
  });

  it("shows the auto-tracked view when tracking and auto-tracked, ignoring lower-priority states", async () => {
    mockSelectorHook(useTimerStore as unknown as jest.Mock, {
      ...baseTimerState,
      isTracking: true,
      isAutoTracked: true,
      title: "Xcode",
      startTimestamp: new Date().toISOString(),
    });

    await render(<TimerBar />);

    expect(screen.getByText("Xcode")).toBeTruthy();
    expect(screen.getByText("Stop")).toBeTruthy();
    expect(screen.queryByText("Tap to start a timer")).toBeNull();
  });

  it("shows the plain tracking view when tracking but not auto-tracked", async () => {
    mockSelectorHook(useTimerStore as unknown as jest.Mock, {
      ...baseTimerState,
      isTracking: true,
      isAutoTracked: false,
      title: "Writing",
      startTimestamp: new Date().toISOString(),
    });

    await render(<TimerBar />);

    expect(screen.getByText("Writing")).toBeTruthy();
    expect(screen.queryByText("Stop")).toBeNull();
  });

  it("prefers a resumable session over a calendar suggestion and a pending hint when idle", async () => {
    mockSelectorHook(useTimerStore as unknown as jest.Mock, {
      ...baseTimerState,
      interruptedSession: {
        title: "Resume Me",
        projectId: "p1",
        interruptedAt: new Date().toISOString(),
        elapsedSeconds: 60,
      },
    });
    mockSelectorHook(useCalendarStore as unknown as jest.Mock, {
      isEnabled: true,
      getActiveEventSuggestion: jest.fn(() => ({
        event: { title: "Standup" },
        projectId: "p1",
      })),
      fetchEvents: jest.fn(),
    });
    mockSelectorHook(useUntrackedStore as unknown as jest.Mock, {
      pendingHint: { appName: "Slack", durationSeconds: 700 },
      dismissHint: jest.fn(),
    });

    await render(<TimerBar />);

    expect(screen.getByText("Resume Me")).toBeTruthy();
    expect(screen.queryByText("Standup")).toBeNull();
    expect(screen.queryByText(/untracked/)).toBeNull();
  });

  it("prefers a calendar suggestion over a pending hint when no resumable session exists", async () => {
    mockSelectorHook(useTimerStore as unknown as jest.Mock, baseTimerState);
    mockSelectorHook(useCalendarStore as unknown as jest.Mock, {
      isEnabled: true,
      getActiveEventSuggestion: jest.fn(() => ({
        event: { title: "Standup" },
        projectId: "p1",
      })),
      fetchEvents: jest.fn(),
    });
    mockSelectorHook(useUntrackedStore as unknown as jest.Mock, {
      pendingHint: { appName: "Slack", durationSeconds: 700 },
      dismissHint: jest.fn(),
    });

    await render(<TimerBar />);

    expect(screen.getByText("Standup")).toBeTruthy();
    expect(screen.queryByText(/untracked/)).toBeNull();
  });

  it("falls back to the pending hint, then to the idle prompt, when nothing else applies", async () => {
    mockSelectorHook(useTimerStore as unknown as jest.Mock, baseTimerState);
    mockSelectorHook(useUntrackedStore as unknown as jest.Mock, {
      pendingHint: { appName: "Slack", durationSeconds: 700 },
      dismissHint: jest.fn(),
    });

    await render(<TimerBar />);
    expect(screen.getByText("Slack untracked")).toBeTruthy();

    mockSelectorHook(useUntrackedStore as unknown as jest.Mock, {
      pendingHint: null,
      dismissHint: jest.fn(),
    });
    await render(<TimerBar />);
    expect(screen.getByText("Tap to start a timer")).toBeTruthy();
  });

  it("dismisses the pending hint without starting a timer when the × is pressed", async () => {
    const dismissHint = jest.fn();
    mockSelectorHook(useTimerStore as unknown as jest.Mock, baseTimerState);
    mockSelectorHook(useUntrackedStore as unknown as jest.Mock, {
      pendingHint: { appName: "Slack", durationSeconds: 700 },
      dismissHint,
    });

    await render(<TimerBar />);
    fireEvent.press(screen.getByText("×"));

    expect(dismissHint).toHaveBeenCalledTimes(1);
    const { router } = require("expo-router");
    expect(router.push).not.toHaveBeenCalled();
  });
});
