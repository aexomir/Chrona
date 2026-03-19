import { ExtensionStorage } from "@bacons/apple-targets";
import type { Session } from "@/stores/sessions-store";

const APP_GROUP = "group.com.aexomir.Focus";
const WIDGET_KEY = "focus_data";

const widgetStorage = new ExtensionStorage(APP_GROUP);

export type WidgetProject = {
  name: string;
  icon: string;
  color: string;
};

export function syncWidgetData(
  sessions: Session[],
  isTracking: boolean,
  startTimestamp: string | null,
  currentTitle: string,
  project: WidgetProject | null
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
      (Date.now() - new Date(startTimestamp).getTime()) / 1000 / 60
    );
  }

  widgetStorage.set(WIDGET_KEY, {
    focusMinutesToday: Math.floor(focusSecondsToday / 60),
    isTracking: isTracking ? 1 : 0,
    currentSessionMinutes,
    currentSessionTitle: currentTitle || "",
    projectName: project?.name || "",
    projectIcon: project?.icon || "",
    projectColor: project?.color || "",
  });

  ExtensionStorage.reloadWidget();
}
