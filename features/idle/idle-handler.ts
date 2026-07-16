/**
 * Idle handler — responds to explicit system-idle signals from ChronaHelper.
 *
 * When the Mac detects no keyboard or mouse input for 5 minutes it sends a
 * `user_idle` event. When input resumes it sends `user_active`. This module:
 *
 *   user_idle  → stops any active session and stores `interruptedSession`
 *                in the timer store so the TimerBar can offer a one-tap
 *                resume when the user returns.
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

import { forceStopForSystemIdle } from "@/features/auto-track/auto-tracker";
import { useSessionsStore } from "@/features/sessions/sessions-store";
import { useTimerStore } from "@/features/timer/timer-store";
import { captureError, trackEvent } from "@/lib/sentry";

type Sub = ReturnType<typeof emitter.addListener>;
let eventSub: Sub | null = null;

function handleEvent(event: ActivityEvent) {
  if (event.type !== "user_idle") return;

  const { isTracking, isAutoTracked, title, projectId, startTimestamp } = useTimerStore.getState();
  if (!isTracking) return;

  const elapsedSeconds = startTimestamp
    ? Math.floor((Date.now() - new Date(startTimestamp).getTime()) / 1000)
    : 0;

  trackEvent("timer", "timer_stop", { auto: isAutoTracked, reason: "system_idle" });

  if (isAutoTracked) {
    // Auto-tracked sessions must go through the auto-tracker's own save path
    // so the session is tagged `auto: true` and gets its app breakdown attached.
    forceStopForSystemIdle();
  } else {
    const sessionData = useTimerStore.getState().stopTimer();
    if (sessionData) {
      useSessionsStore.getState().addSession({
        ...sessionData,
        id: Date.now().toString(),
      });
      trackEvent("session", "session_save", {
        auto: false,
        duration: sessionData.duration,
        appCount: 0,
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
  eventSub = emitter.addListener("onEvent", (event: ActivityEvent) => {
    try {
      handleEvent(event);
    } catch (error) {
      captureError(error, "idle_handler", { eventType: event.type });
    }
  });
}

export function stopIdleHandler() {
  if (process.env.EXPO_OS !== "ios") return;
  eventSub?.remove();
  eventSub = null;
}
