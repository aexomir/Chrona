/**
 * useWatch — bridges the Apple Watch button presses into the RN timer flow.
 *
 * Drop this into any component (e.g. the root layout or timer screen) and
 * it will respond to { action: "start" } / { action: "stop" } messages from
 * the watch, as well as expose `syncWatch()` to push live state back.
 *
 * Only runs on iOS native builds (noop on web/Android).
 */
import { useCallback } from 'react';
import { Platform } from 'react-native';

// Lazy import — module only exists in native iOS builds.
let watchModule: typeof import('@/modules/watch-connectivity') | null = null;
if (Platform.OS === 'ios') {
  try {
    watchModule = require('@/modules/watch-connectivity');
  } catch {
    // Native module not linked (Expo Go, web, Android)
  }
}

export interface WatchState {
  isTracking: boolean;
  title?: string;
  projectName?: string;
}

/**
 * Subscribe to watch button presses.
 * @param onStart - called when the watch sends `{ action: "start" }`
 * @param onStop  - called when the watch sends `{ action: "stop" }`
 */
export function useWatchMessages(
  onStart: () => void,
  onStop: () => void
) {
  watchModule?.useWatchMessages((msg) => {
    if (msg.action === 'start') onStart();
    if (msg.action === 'stop') onStop();
  });
}

/**
 * Push the current timer state to the watch face.
 * Call this whenever `isTracking`, `title`, or `projectName` changes.
 */
export function useSyncWatch() {
  return useCallback((state: WatchState) => {
    watchModule?.sendToWatch(state as Record<string, unknown>);
  }, []);
}
