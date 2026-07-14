import type { Project } from "@/constants/projects";
import type { Session } from "@/features/sessions/sessions-store";
import chronaTimeWidget from "@/widgets/chrona-time-widget";
import timelineWidget, { type TimelineWidgetSession } from "@/widgets/timeline-widget";

export type WidgetProject = {
  name: string;
  icon: string;
  color: string;
};

const IDLE_SUGGESTIONS = [
  "Deep work",
  "Study session",
  "Creative flow",
  "Focus block",
  "Writing sprint",
  "Problem solving",
];

/** How many minutes of rotating idle-suggestion timeline entries to precompute at once. */
const IDLE_TIMELINE_MINUTES = 15;

function suggestionForEpochMinute(epochMinutes: number): string {
  return IDLE_SUGGESTIONS[epochMinutes % IDLE_SUGGESTIONS.length];
}

// ─── Chrona widget ───────────────────────────────────────────────────────────

export function syncWidgetData(
  sessions: Session[],
  isTracking: boolean,
  startTimestamp: string | null,
  currentTitle: string,
  project: WidgetProject | null,
) {
  if (process.env.EXPO_OS !== "ios") return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const focusSecondsToday = sessions
    .filter((s) => new Date(s.startTime) >= today)
    .reduce((sum, s) => sum + s.duration, 0);

  let currentSessionMinutes = 0;
  if (isTracking && startTimestamp) {
    currentSessionMinutes = Math.floor(
      (Date.now() - new Date(startTimestamp).getTime()) / 1000 / 60,
    );
  }

  const baseProps = {
    focusMinutesToday: Math.floor(focusSecondsToday / 60),
    isTracking,
    currentSessionMinutes,
    startTimestamp: isTracking && startTimestamp ? startTimestamp : "",
    currentSessionTitle: currentTitle || "",
    projectName: project?.name || "",
    projectIcon: project?.icon || "",
    projectColor: project?.color || "",
  };

  if (isTracking) {
    // The live `.timer` text ticks natively — this data only changes on
    // real state changes, so a single "now" entry is all that's needed.
    chronaTimeWidget.updateTimeline([
      { date: new Date(), props: { ...baseProps, suggestion: "" } },
    ]);
    return;
  }

  // Idle: precompute the next N minutes of rotating suggestion text so
  // WidgetKit flips it natively on its own schedule, with no further JS
  // involvement — replacing the old "reload every 5 minutes" polling.
  const now = Date.now();
  const entries = Array.from({ length: IDLE_TIMELINE_MINUTES }, (_, i) => {
    const date = new Date(now + i * 60_000);
    const epochMinutes = Math.floor(date.getTime() / 1000 / 60);
    return {
      date,
      props: { ...baseProps, suggestion: suggestionForEpochMinute(epochMinutes) },
    };
  });
  chronaTimeWidget.updateTimeline(entries);
}

// ─── Timeline widget ──────────────────────────────────────────────────────────

export function syncTimelineData(
  sessions: Session[],
  projects: Project[],
  isTracking: boolean,
  startTimestamp: string | null,
  currentTitle: string,
  currentProject: WidgetProject | null,
) {
  if (process.env.EXPO_OS !== "ios") return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const timelineSessions: TimelineWidgetSession[] = [];

  if (isTracking && startTimestamp) {
    timelineSessions.push({
      title: currentTitle || "",
      projectName: currentProject?.name || "",
      projectIcon: currentProject?.icon || "",
      projectColor: currentProject?.color || "",
      startTime: startTimestamp,
      durationMinutes: Math.floor(
        (Date.now() - new Date(startTimestamp).getTime()) / 1000 / 60,
      ),
      isActive: true,
    });
  }

  const todaySessions = sessions
    .filter((s) => new Date(s.startTime) >= today)
    .sort(
      (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime(),
    );

  for (const s of todaySessions) {
    const project = s.projectId ? projects.find((p) => p.id === s.projectId) : null;
    timelineSessions.push({
      title: s.title || "",
      projectName: project?.name || "",
      projectIcon: project?.icon || "",
      projectColor: project?.color || "",
      startTime: s.startTime,
      durationMinutes: Math.floor(s.duration / 60),
      isActive: false,
    });
  }

  timelineWidget.updateTimeline([
    { date: new Date(), props: { sessions: timelineSessions, isTracking } },
  ]);
}
