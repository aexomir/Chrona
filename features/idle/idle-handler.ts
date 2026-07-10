/**
 * Idle handler — responds to explicit system-idle signals from ChronaHelper.
 *
 * When the Mac detects no keyboard or mouse input for 5 minutes it sends a
 * `user_idle` event. When input resumes it sends `user_active`. This module:
 *
 *   user_idle  → stops any active session (manual or auto-tracked) and stores
 *                `interruptedSession` in the timer store so the TimerBar can
 *                offer a one-tap resume when the user returns.
 *
 *   user_active → no action needed; the TimerBar reads `interruptedSession`
 *                 directly from the store to show the resume prompt.
 *
 * Lifecycle:
 *   startIdleHandler() — call after useStreamStore.start()
 *   stopIdleHandler()  — call when tearing down
 */

import type { ActivityEvent } from "@/modules/chrona-stream";
import { emitter } from "@/modules/chrona-stream";

import { useSessionsStore } from "@/features/sessions/sessions-store";
import { useTimerStore } from "@/features/timer/timer-store";
import { forceStopForSystemIdle } from "@/features/auto-track/auto-tracker";

type Sub = ReturnType<typeof emitter.addListener>;
let eventSub: Sub | null = null;

function handleEvent(event: ActivityEvent) {
  if (event.type !== "user_idle") return;

  const { isTracking, isAutoTracked, title, projectId, startTimestamp } = useTimerStore.getState();
  if (!isTracking) return;

  const elapsedSeconds = startTimestamp
    ? Math.floor((Date.now() - new Date(startTimestamp).getTime()) / 1000)
    : 0;

  if (isAutoTracked) {
    forceStopForSystemIdle();
  } else {
    const sessionData = useTimerStore.getState().stopTimer();
    if (sessionData) {
      useSessionsStore.getState().addSession({
        ...sessionData,
        id: Date.now().toString(),
      });
    }
  }

  useTimerStore.getState().setInterruptedSession({
    title,
    projectId,
    interruptedAt: new Date().toISOString(),
    elapsedSeconds,
  });
}

export function startIdleHandler() {
  if (process.env.EXPO_OS !== "ios") return;
  eventSub?.remove();
  eventSub = emitter.addListener("onEvent", handleEvent);
}

export function stopIdleHandler() {
  if (process.env.EXPO_OS !== "ios") return;
  eventSub?.remove();
  eventSub = null;
}
