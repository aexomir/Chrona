import type { AppUsage, Session } from "@/features/sessions/sessions-store";
import { useSessionsStore } from "@/features/sessions/sessions-store";

type DemoSession = {
  dayOffset: number;
  hour: number;
  minute: number;
  durationMin: number;
  title: string;
  projectId: string;
  apps?: AppUsage[];
  notes?: string;
};

const DEMO_SESSIONS: DemoSession[] = [
  {
    dayOffset: 0,
    hour: 9,
    minute: 15,
    durationMin: 25,
    title: "Weekly planning",
    projectId: "personal",
  },
  {
    dayOffset: 0,
    hour: 10,
    minute: 0,
    durationMin: 95,
    title: "Auth refactor",
    projectId: "work",
    apps: [
      { app: "Xcode", duration: 3720, titles: ["AuthStore.swift", "KeychainBridge.swift"] },
      { app: "Safari", duration: 1080, titles: ["Keychain Services | Apple Developer"] },
      { app: "Slack", duration: 900, titles: ["#eng-mobile"] },
    ],
    notes: "Moved the token refresh off the main actor. Still need to cover the 401 retry path.",
  },
  {
    dayOffset: 0,
    hour: 14,
    minute: 30,
    durationMin: 50,
    title: "Designing Data-Intensive Applications",
    projectId: "study",
  },
  {
    dayOffset: 1,
    hour: 8,
    minute: 40,
    durationMin: 35,
    title: "Morning run",
    projectId: "exercise",
  },
  {
    dayOffset: 1,
    hour: 10,
    minute: 10,
    durationMin: 110,
    title: "Auth refactor",
    projectId: "work",
    apps: [
      { app: "Xcode", duration: 4980, titles: ["AuthStore.swift", "TokenRefreshTests.swift"] },
      { app: "Terminal", duration: 1140, titles: ["xcodebuild test"] },
      { app: "Safari", duration: 480 },
    ],
  },
  {
    dayOffset: 1,
    hour: 13,
    minute: 20,
    durationMin: 30,
    title: "Standup and inbox",
    projectId: "work",
  },
  {
    dayOffset: 1,
    hour: 15,
    minute: 0,
    durationMin: 75,
    title: "Portfolio redesign",
    projectId: "creative",
    apps: [
      { app: "Figma", duration: 3900, titles: ["Portfolio — Case studies"] },
      { app: "Safari", duration: 600 },
    ],
  },
  {
    dayOffset: 2,
    hour: 9,
    minute: 50,
    durationMin: 65,
    title: "Swift concurrency notes",
    projectId: "study",
  },
  {
    dayOffset: 2,
    hour: 14,
    minute: 0,
    durationMin: 85,
    title: "Auth refactor",
    projectId: "work",
    apps: [
      { app: "Xcode", duration: 4020, titles: ["AuthStore.swift"] },
      { app: "Slack", duration: 1080, titles: ["#eng-mobile", "#design-review"] },
    ],
  },
  {
    dayOffset: 2,
    hour: 20,
    minute: 30,
    durationMin: 40,
    title: "Reading",
    projectId: "rest",
  },
  {
    dayOffset: 3,
    hour: 7,
    minute: 30,
    durationMin: 30,
    title: "Morning run",
    projectId: "exercise",
  },
  {
    dayOffset: 3,
    hour: 10,
    minute: 20,
    durationMin: 120,
    title: "Timeline drag-to-merge",
    projectId: "work",
    apps: [
      { app: "Cursor", duration: 5400, titles: ["timeline/index.tsx", "drag-overlay.tsx"] },
      { app: "Simulator", duration: 1500, titles: ["iPhone 16 Pro — Chrona"] },
      { app: "Safari", duration: 300 },
    ],
    notes: "Gesture handler fights the scroll view above 300ms. Long-press activation fixed it.",
  },
  {
    dayOffset: 3,
    hour: 15,
    minute: 40,
    durationMin: 55,
    title: "Sketching icon ideas",
    projectId: "creative",
  },
  {
    dayOffset: 4,
    hour: 9,
    minute: 30,
    durationMin: 90,
    title: "Distributed systems course",
    projectId: "study",
  },
  {
    dayOffset: 4,
    hour: 14,
    minute: 10,
    durationMin: 45,
    title: "Bug triage",
    projectId: "work",
    apps: [
      { app: "Safari", duration: 1980, titles: ["Issues · Chrona"] },
      { app: "Slack", duration: 720 },
    ],
  },
  {
    dayOffset: 6,
    hour: 10,
    minute: 0,
    durationMin: 100,
    title: "Widget prototype",
    projectId: "work",
    apps: [
      { app: "Xcode", duration: 4500, titles: ["ChronaTimeWidget.swift"] },
      { app: "Simulator", duration: 1500 },
    ],
  },
  {
    dayOffset: 6,
    hour: 16,
    minute: 0,
    durationMin: 45,
    title: "Guitar",
    projectId: "creative",
  },
  {
    dayOffset: 7,
    hour: 9,
    minute: 0,
    durationMin: 80,
    title: "Distributed systems course",
    projectId: "study",
  },
  {
    dayOffset: 7,
    hour: 18,
    minute: 30,
    durationMin: 50,
    title: "Long walk",
    projectId: "exercise",
  },
];

function buildSession(demo: DemoSession, index: number): Session {
  const start = new Date();
  start.setDate(start.getDate() - demo.dayOffset);
  start.setHours(demo.hour, demo.minute, 0, 0);

  const duration = demo.durationMin * 60;
  const end = new Date(start.getTime() + duration * 1000);

  return {
    id: `demo-${index}`,
    title: demo.title,
    projectId: demo.projectId,
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    duration,
    apps: demo.apps,
    notes: demo.notes,
    auto: demo.apps !== undefined,
  };
}

export function buildDemoSessions(): Session[] {
  return DEMO_SESSIONS.map(buildSession).sort(
    (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime(),
  );
}

export function seedDemoData(): number {
  const sessions = buildDemoSessions();
  useSessionsStore.setState({ sessions });
  return sessions.length;
}

export function clearAllSessions() {
  useSessionsStore.setState({ sessions: [] });
}
