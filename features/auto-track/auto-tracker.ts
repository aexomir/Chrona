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

import { getAppsForWindow, markTimerStart } from "@/features/intelligence/journal-store";
import { matchRule } from "./matcher";
import { IDLE_TIMEOUT_MS, SWITCH_GRACE_MS } from "./timing-config";
import type { TrackingRule } from "./tracking-rules-store";
import { useTrackingRulesStore } from "./tracking-rules-store";

// Module-level state — survives re-renders, cleaned up in stopAutoTracker()
type Sub = ReturnType<typeof emitter.addListener>;
let eventSub: Sub | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let autoStartedRuleId: string | null = null;
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
      stopAndSave();
    }
  }, timeoutMs);
}

function stopAndSave() {
  const sessionData = useTimerStore.getState().stopTimer();
  if (sessionData) {
    const effectiveEndMs = appLeftAt ?? new Date(sessionData.endTime).getTime();
    const effectiveDuration = Math.floor(
      (effectiveEndMs - new Date(sessionData.startTime).getTime()) / 1000,
    );
    const minDuration = useSettingsStore.getState().autoTrackMinDurationSec;
    if (effectiveDuration >= minDuration) {
      const startMs = new Date(sessionData.startTime).getTime();
      const apps = getAppsForWindow(startMs, effectiveEndMs);
      useSessionsStore.getState().addSession({
        ...sessionData,
        endTime: new Date(effectiveEndMs).toISOString(),
        duration: effectiveDuration,
        id: Date.now().toString(),
        auto: true,
        ...(apps.length > 0 ? { apps } : {}),
      });
    }
  }
  appLeftAt = null;
  autoStartedRuleId = null;
}

function startAutoTimer(rule: TrackingRule, event: ActivityEvent) {
  const title = rule.defaultTitle ?? event.appName;
  markTimerStart();
  useTimerStore.getState().startTimer(title, rule.projectId);
  useTimerStore.getState().setAutoTracked(true);
  autoStartedRuleId = rule.id;
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

  const { isTracking, isAutoTracked } = useTimerStore.getState();

  if (autoStartedRuleId !== null && (!isTracking || !isAutoTracked)) {
    autoStartedRuleId = null;
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
        stopAndSave();
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
          stopAndSave();
          startAutoTimer(rule, evt);
          clearIdleTimer();
        }, SWITCH_GRACE_MS);
        // onTrackedApp stays false — user is not on app-A right now.
        // appLeftAt records the real departure time; heartbeats won't reset
        // the idle timer during the pending state.
      }
    }
    // Else: switched to an untracked app — idle timer will stop the session
    // after IDLE_TIMEOUT_MS if the user doesn't return to the tracked app
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
  if (autoStartedRuleId !== null && !onTrackedApp && appLeftAt === null) {
    appLeftAt = Date.now();
  } else if (onTrackedApp) {
    appLeftAt = null;
  }

  // Schedule (or keep) the idle countdown. When on the tracked app this acts
  // as a safety net in case no further events arrive; it will be reset by the
  // next heartbeat. When on an untracked app it starts the 2-min countdown.
  if (onTrackedApp || autoStartedRuleId !== null) {
    scheduleIdleTimer();
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function startAutoTracker() {
  if (process.env.EXPO_OS !== "ios") return;

  // Idempotent — tear down any existing subscription before re-attaching
  eventSub?.remove();
  eventSub = emitter.addListener("onEvent", handleEvent);
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
    stopAndSave();
  } else {
    appLeftAt = null;
  }
}
