/**
 * Auto-tracker orchestration layer.
 *
 * Subscribes directly to the ChronaStream emitter (not through the stream
 * store) so it receives ALL event types, including heartbeats — these are used
 * to reset the idle timer without triggering rule evaluation.
 *
 * Lifecycle:
 *   startAutoTracker() — call after useStreamStore.start()
 *   stopAutoTracker()  — call when tearing down (e.g. stream disconnects)
 *
 * Invariant: if a timer is running and autoStartedRuleId is null, it was
 * started manually. The auto-tracker never touches a manually-started timer.
 */

import type { ActivityEvent } from "@/modules/chrona-stream";
import { emitter } from "@/modules/chrona-stream";

import { useSessionsStore } from "@/features/sessions/sessions-store";
import { useSettingsStore } from "@/features/settings/settings-store";
import { useTimerStore } from "@/features/timer/timer-store";

import { usePendingUsageStore } from "@/features/intelligence/pending-usage-store";
import { getAppsForWindow } from "@/features/intelligence/usage-query";
import { captureError, trackEvent } from "@/lib/sentry";
import { matchRule } from "./matcher";
import { usePendingReviewStore } from "./pending-review-store";
import { IDLE_TIMEOUT_MS, SWITCH_GRACE_MS } from "./timing-config";
import type { TrackingRule } from "./tracking-rules-store";
import { useTrackingRulesStore } from "./tracking-rules-store";

// Module-level state — survives re-renders, cleaned up in stopAutoTracker()
type Sub = ReturnType<typeof emitter.addListener>;
let eventSub: Sub | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let autoStartedRuleId: string | null = null;
let autoStartedBundleId: string | null = null;
let lastEventWasTracked = false;
let appLeftAt: number | null = null;
let pendingRule: TrackingRule | null = null;
let pendingEvent: ActivityEvent | null = null;
let switchGraceTimer: ReturnType<typeof setTimeout> | null = null;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function clearIdleTimer() {
  if (idleTimer !== null) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
}

function clearSwitchGraceTimer() {
  if (switchGraceTimer !== null) {
    clearTimeout(switchGraceTimer);
    switchGraceTimer = null;
  }
  pendingRule = null;
  pendingEvent = null;
}

function scheduleIdleTimer() {
  clearIdleTimer();

  let timeoutMs = IDLE_TIMEOUT_MS;

  if (appLeftAt !== null) {
    const { startTimestamp } = useTimerStore.getState();
    const minDurationMs =
      useSettingsStore.getState().autoTrackMinDurationSec * 1000;
    if (startTimestamp) {
      const effectiveDurationMs =
        appLeftAt - new Date(startTimestamp).getTime();
      if (effectiveDurationMs < minDurationMs) {
        timeoutMs = minDurationMs - effectiveDurationMs;
      }
    }
  }

  idleTimer = setTimeout(() => {
    if (autoStartedRuleId !== null) {
      stopAndSaveSafely();
    }
  }, timeoutMs);
}

async function stopAndSave() {
  const sessionData = useTimerStore.getState().stopTimer();
  // Reset up front: the await below yields, and an event arriving in the
  // meantime must not see this session as still auto-tracked.
  const effectiveEndMs =
    appLeftAt ?? (sessionData ? new Date(sessionData.endTime).getTime() : Date.now());
  appLeftAt = null;
  autoStartedRuleId = null;
  autoStartedBundleId = null;

  if (!sessionData) return;

  const startMs = new Date(sessionData.startTime).getTime();
  const effectiveDuration = Math.floor((effectiveEndMs - startMs) / 1000);
  trackEvent("timer", "timer_stop", { auto: true, duration: effectiveDuration });

  const minDuration = useSettingsStore.getState().autoTrackMinDurationSec;
  if (effectiveDuration < minDuration) return;

  const { status, apps } = await getAppsForWindow(startMs, effectiveEndMs);
  const endTime = new Date(effectiveEndMs).toISOString();

  if (apps.length > 1) {
    // More than one app touched during the window — queue for review
    // instead of silently baking every distraction into the breakdown.
    // The review sheet drains this whenever the app is next foregrounded,
    // whether that's immediately or after a long system-idle absence.
    usePendingReviewStore.getState().offer({
      startTime: sessionData.startTime,
      endTime,
      duration: effectiveDuration,
      title: sessionData.title,
      projectId: sessionData.projectId,
      apps,
    });
    trackEvent("session", "session_save", {
      auto: true,
      duration: effectiveDuration,
      appCount: apps.length,
      queuedForReview: true,
    });
    return;
  }

  const id = Date.now().toString();
  useSessionsStore.getState().addSession({
    ...sessionData,
    endTime,
    duration: effectiveDuration,
    id,
    auto: true,
    ...(apps.length > 0 ? { apps } : {}),
  });
  if (status === "unreachable") {
    usePendingUsageStore.getState().enqueue(id, startMs, effectiveEndMs);
  }
  trackEvent("session", "session_save", {
    auto: true,
    duration: effectiveDuration,
    appCount: apps.length,
    queuedForReview: false,
  });
}

function stopAndSaveSafely() {
  stopAndSave().catch((error) => captureError(error, "auto_tracker_stop"));
}

function startAutoTimer(rule: TrackingRule, event: ActivityEvent) {
  const title = rule.defaultTitle ?? event.appName;
  useTimerStore.getState().startTimer(title, rule.projectId);
  useTimerStore.getState().setAutoTracked(true);
  autoStartedRuleId = rule.id;
  autoStartedBundleId = event.bundleId;
  trackEvent("timer", "timer_start", { auto: true, hasProject: !!rule.projectId });
}

function isCompanionApp(ruleId: string, bundleId: string): boolean {
  const { rules } = useTrackingRulesStore.getState();
  const rule = rules.find((r) => r.id === ruleId);
  return rule?.companionBundleIds?.includes(bundleId) ?? false;
}

function handleEvent(event: ActivityEvent) {
  if (event.type === "heartbeat") {
    if (lastEventWasTracked) {
      scheduleIdleTimer();
    }
    return;
  }

  // Only app_change/hello carry real app data (appName/windowTitle/bundleId).
  // pong (connection-liveness reply to the iOS client's ping, unrelated to app
  // tracking) and user_idle/user_active all have those fields empty — treating
  // them as "switched to an untracked app" would start the departure countdown
  // every ~15s (the ping interval) even while the user never left the tracked
  // app, since an empty bundleId never matches autoStartedBundleId either.
  if (event.type !== "app_change" && event.type !== "hello") {
    return;
  }

  const { isTracking, isAutoTracked } = useTimerStore.getState();

  if (autoStartedRuleId !== null && (!isTracking || !isAutoTracked)) {
    autoStartedRuleId = null;
    autoStartedBundleId = null;
    appLeftAt = null;
    clearIdleTimer();
    clearSwitchGraceTimer();
    lastEventWasTracked = false;
  }
  const { rules } = useTrackingRulesStore.getState();
  const match = matchRule(event, rules);
  let onTrackedApp = false;

  if (isTracking && autoStartedRuleId !== null) {
    if (match && match.id === autoStartedRuleId) {
      // Same rule still matches — user may be returning within the grace period.
      // Cancel any pending switch and keep the session running.
      clearSwitchGraceTimer();
      clearIdleTimer();
      onTrackedApp = true;
    } else if (isCompanionApp(autoStartedRuleId, event.bundleId)) {
      // Switched to a companion app — session continues, treat as tracked.
      // Cancel any pending switch (companion visit = still in the same session).
      clearSwitchGraceTimer();
      onTrackedApp = true;
    } else if (match) {
      // Switched to a different tracked app.
      //
      // If A hasn't reached minDuration yet, immediately discard it and start B.
      // The grace period would only delay B's tracking for no benefit — A gets
      // discarded by stopAndSave() either way.
      //
      // If A already has a valid session (≥ minDuration), apply a grace period:
      // if the user returns within SWITCH_GRACE_MS the session continues
      // uninterrupted. A→B→C: cancel the existing timer and restart for C.
      const now = Date.now();
      const { startTimestamp } = useTimerStore.getState();
      const minDurationMs =
        useSettingsStore.getState().autoTrackMinDurationSec * 1000;
      const elapsed = startTimestamp
        ? now - new Date(startTimestamp).getTime()
        : 0;

      clearSwitchGraceTimer();

      if (elapsed < minDurationMs) {
        stopAndSaveSafely();
        startAutoTimer(match, event);
        clearIdleTimer();
        onTrackedApp = true;
      } else {
        pendingRule = match;
        pendingEvent = event;
        switchGraceTimer = setTimeout(() => {
          const rule = pendingRule!;
          const evt = pendingEvent!;
          pendingRule = null;
          pendingEvent = null;
          switchGraceTimer = null;
          stopAndSaveSafely();
          startAutoTimer(rule, evt);
          clearIdleTimer();
        }, SWITCH_GRACE_MS);
        // onTrackedApp stays false — user is not on app-A right now.
        // appLeftAt records the real departure time; heartbeats won't reset
        // the idle timer during the pending state.
      }
    } else if (event.bundleId === autoStartedBundleId) {
      // Still the same running app that started this session — just a
      // transient window-title state that doesn't currently satisfy the
      // rule's keywords (build status, unsaved-changes dot, a popup/secondary
      // window). This is NOT a departure: matching is only meant to decide
      // whether to START a session, not whether an already-running one
      // should keep going. Treating this as "switched away" would fire the
      // idle/min-duration stop while the user never left the app.
      clearSwitchGraceTimer();
      clearIdleTimer();
      onTrackedApp = true;
    }
    // Else: switched to a genuinely different, untracked app — idle timer
    // will stop the session after IDLE_TIMEOUT_MS if the user doesn't return
  } else if (!isTracking) {
    if (match) {
      startAutoTimer(match, event);
      clearIdleTimer();
      onTrackedApp = true;
    }
  }
  // isTracking && autoStartedRuleId === null → manual session, leave it alone

  lastEventWasTracked = onTrackedApp;

  // Track the moment the user leaves the tracked app so stopAndSave can use
  // the real session end time rather than the inflated idle-timer fire time.
  //
  // Only (re)schedule the idle countdown on the transition itself — either
  // just returned to a tracked/companion app (fresh safety-net timer, reset
  // by the next heartbeat) or just left one (starts the real countdown).
  // Further app_change events on the SAME still-untracked app (e.g. a title
  // change in Slack/Safari/etc.) must NOT reschedule, or the countdown would
  // never reach zero as long as that app keeps emitting events.
  if (onTrackedApp) {
    appLeftAt = null;
    scheduleIdleTimer();
  } else if (autoStartedRuleId !== null && appLeftAt === null) {
    appLeftAt = Date.now();
    scheduleIdleTimer();
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function forceStopForSystemIdle() {
  if (process.env.EXPO_OS !== "ios") return;
  clearIdleTimer();
  clearSwitchGraceTimer();
  if (autoStartedRuleId !== null) {
    stopAndSaveSafely();
  }
  lastEventWasTracked = false;
}

export function startAutoTracker() {
  if (process.env.EXPO_OS !== "ios") return;

  // Idempotent — tear down any existing subscription before re-attaching
  eventSub?.remove();
  eventSub = emitter.addListener("onEvent", (event: ActivityEvent) => {
    try {
      handleEvent(event);
    } catch (error) {
      captureError(error, "auto_tracker", { eventType: event.type });
    }
  });
}

export function stopAutoTracker() {
  if (process.env.EXPO_OS !== "ios") return;

  eventSub?.remove();
  eventSub = null;

  clearIdleTimer();
  clearSwitchGraceTimer();
  lastEventWasTracked = false;

  // If an auto-tracked session is in progress, save it before stopping.
  // appLeftAt is reset inside stopAndSave; clear it here for the no-session case.
  if (autoStartedRuleId !== null) {
    stopAndSaveSafely();
  } else {
    appLeftAt = null;
  }
}
