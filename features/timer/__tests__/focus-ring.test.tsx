import { render, screen } from "@testing-library/react-native";
import React from "react";

import { FocusRing } from "../focus-ring";
import { useProjects } from "@/features/projects/projects-store";
import { useSessionsStore } from "@/features/sessions/sessions-store";
import { useTimerStore } from "@/features/timer/timer-store";

jest.mock("react-native-reanimated", () => {
  const ReactLocal = require("react");
  const RN = require("react-native");

  const chainNoop = () => undefined;

  return {
    __esModule: true,
    default: {
      createAnimatedComponent: (Component: any) => (props: any) =>
        ReactLocal.createElement(Component, props),
      View: RN.View,
      Text: RN.Text,
    },
    makeMutable: (initial: unknown) => ({ value: initial }),
    useSharedValue: (initial: unknown) => {
      const ref = ReactLocal.useRef({ value: initial });
      return ref.current;
    },
    useAnimatedProps: (fn: () => any) => fn(),
    useAnimatedStyle: (fn: () => any) => fn(),
    useAnimatedRef: () => ({ current: null }),
    interpolate: (_value: number, _input: number[], output: number[]) =>
      output[0],
    runOnJS: (fn: (...args: any[]) => any) => fn,
    withDelay: (_delay: number, animation: unknown) => animation,
    withRepeat: (animation: unknown) => animation,
    withTiming: (toValue: unknown) => toValue,
  };
});

jest.mock("react-native-gesture-handler", () => {
  const ReactLocal = require("react");
  const builder = () => {
    const obj: any = {};
    ["activateAfterLongPress", "onStart", "onUpdate", "onEnd"].forEach(
      (method) => {
        obj[method] = () => obj;
      },
    );
    return obj;
  };
  return {
    Gesture: {
      Pan: builder,
      Tap: builder,
      Exclusive: (...gestures: unknown[]) => builder(),
    },
    GestureDetector: ({ children }: { children: React.ReactNode }) =>
      children,
  };
});

jest.mock("react-native-svg", () => {
  const ReactLocal = require("react");
  const RN = require("react-native");
  const pass =
    (name: string) =>
    (props: any) =>
      ReactLocal.createElement(RN.View, { ...props, testID: name });
  return {
    __esModule: true,
    default: pass("Svg"),
    Circle: pass("Circle"),
  };
});

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light" },
}));

jest.mock("@/features/timer/timer-store", () => ({ useTimerStore: jest.fn() }));
jest.mock("@/features/sessions/sessions-store", () => ({
  useSessionsStore: jest.fn(),
}));
jest.mock("@/features/projects/projects-store", () => ({
  useProjects: jest.fn(),
}));

function mockHook(hook: jest.Mock, state: Record<string, any>) {
  hook.mockImplementation((selector?: (s: any) => any) =>
    selector ? selector(state) : state,
  );
}

function isoAt(hour: number, minute = 0): string {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

describe("FocusRing", () => {
  beforeEach(() => {
    mockHook(useProjects as unknown as jest.Mock, { projects: [] });
    mockHook(useTimerStore as unknown as jest.Mock, {
      isTracking: false,
      startTimestamp: null,
    });
  });

  it("shows today's total focused time by default", async () => {
    mockHook(useSessionsStore as unknown as jest.Mock, {
      sessions: [
        {
          id: "1",
          title: "Deep Work",
          projectId: null,
          startTime: isoAt(9),
          endTime: isoAt(10),
          duration: 3600,
        },
        {
          id: "2",
          title: "Reading",
          projectId: null,
          startTime: isoAt(11),
          endTime: isoAt(11, 30),
          duration: 1800,
        },
      ],
    });

    await render(<FocusRing />);

    expect(screen.getByText("1h 30m")).toBeTruthy();
    expect(screen.getByText("TODAY")).toBeTruthy();
  });

  it("only counts sessions that started today toward the total", async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    mockHook(useSessionsStore as unknown as jest.Mock, {
      sessions: [
        {
          id: "1",
          title: "Old",
          projectId: null,
          startTime: yesterday.toISOString(),
          endTime: yesterday.toISOString(),
          duration: 9999,
        },
        {
          id: "2",
          title: "Today",
          projectId: null,
          startTime: isoAt(9),
          endTime: isoAt(9, 20),
          duration: 1200,
        },
      ],
    });

    await render(<FocusRing />);

    expect(screen.getByText("20m")).toBeTruthy();
  });

  it("renders 0m with no sessions today", async () => {
    mockHook(useSessionsStore as unknown as jest.Mock, { sessions: [] });

    await render(<FocusRing />);

    expect(screen.getByText("0m")).toBeTruthy();
    expect(screen.getByText("TODAY")).toBeTruthy();
  });
});
