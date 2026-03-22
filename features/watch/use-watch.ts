/**
 * useWatch — bridges the Apple Watch button presses into the RN timer flow.
 *
 * Drop this into any component (e.g. the root layout or timer screen) and
 * it will respond to { action: "start" } / { action: "stop" } messages from
 * the watch, as well as expose `syncWatch()` to push live state back.
 *
 * Only runs on iOS native builds (noop on web/Android).
 */
import { useCallback } from "react";
import { Platform } from "react-native";

// Lazy import — module only exists in native iOS builds.
let watchModule: typeof import("@/modules/watch-connectivity") | null = null;
if (Platform.OS === "ios") {
  try {
    watchModule = require("@/modules/watch-connectivity");
  } catch {
    // Native module not linked (Expo Go, web, Android)
  }
}

export interface WatchState {
  isTracking: boolean;
  title?: string;
  projectName?: string;
  projectColor?: string;
  startTimestamp?: string; // ISO8601 — watch computes elapsed locally
  todayMinutes?: number;
  todaySessions?: number;
  recentProjects?: string; // JSON-encoded array — WC dict doesn't support nested arrays
  recentSessions?: string; // JSON-encoded array of today's sessions
}

/**
 * Subscribe to watch button presses.
 * @param onStart
 * @param onStop
 * @param onStartWithProject
 */
export function useWatchMessages(
  onStart: () => void,
  onStop: () => void,
  onStartWithProject?: (projectId: string) => void,
  onUpdateTitle?: (title: string) => void,
) {
  watchModule?.useWatchMessages((msg) => {
    if (msg.action === "start") onStart();
    if (msg.action === "stop") onStop();
    if (msg.action === "startWithProject")
      onStartWithProject?.(msg.projectId as string);
    if (msg.action === "updateTitle") onUpdateTitle?.(msg.title as string);
  });
}

/**
 * Push the current timer state to the watch face.
 * Call this whenever timer state, sessions, or projects change.
 */
export function useSyncWatch() {
  return useCallback((state: WatchState) => {
    watchModule?.sendToWatch(state as Record<string, unknown>);
  }, []);
}
