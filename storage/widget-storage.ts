import type { Project } from "@/constants/projects";
import type { Session } from "@/features/sessions/sessions-store";
import { ExtensionStorage } from "@bacons/apple-targets";

const APP_GROUP = "group.com.aexomir.Focus";
const FOCUS_KEY = "focus_data";

const widgetStorage = new ExtensionStorage(APP_GROUP);

export type WidgetProject = {
  name: string;
  icon: string;
  color: string;
};

// ─── Focus widget ────────────────────────────────────────────────────────────

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

  widgetStorage.set(FOCUS_KEY, {
    focusMinutesToday: Math.floor(focusSecondsToday / 60),
    isTracking: isTracking ? 1 : 0,
    currentSessionMinutes,
    startTimestamp: isTracking && startTimestamp ? startTimestamp : "",
    currentSessionTitle: currentTitle || "",
    projectName: project?.name || "",
    projectIcon: project?.icon || "",
    projectColor: project?.color || "",
  });

  ExtensionStorage.reloadWidget();
}

// ─── Timeline widget ──────────────────────────────────────────────────────────

const TIMELINE_KEY = "timeline_data";

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

  const timelineSessions: Array<{
    title: string;
    projectName: string;
    projectIcon: string;
    projectColor: string;
    startTime: string;
    durationMinutes: number;
    isActive: number;
  }> = [];

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
      isActive: 1,
    });
  }

  const todaySessions = sessions
    .filter((s) => new Date(s.startTime) >= today)
    .sort(
      (a, b) =>
        new Date(b.startTime).getTime() - new Date(a.startTime).getTime(),
    );

  for (const s of todaySessions) {
    const project = s.projectId
      ? projects.find((p) => p.id === s.projectId)
      : null;
    timelineSessions.push({
      title: s.title || "",
      projectName: project?.name || "",
      projectIcon: project?.icon || "",
      projectColor: project?.color || "",
      startTime: s.startTime,
      durationMinutes: Math.floor(s.duration / 60),
      isActive: 0,
    });
  }

  widgetStorage.set(TIMELINE_KEY, {
    sessions: timelineSessions,
    isTracking: isTracking ? 1 : 0,
  });
}
