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

import { emitter } from '@/modules/chrona-stream';
import type { ActivityEvent } from '@/modules/chrona-stream';

import { useSessionsStore } from '@/features/sessions/sessions-store';
import { useTimerStore } from '@/features/timer/timer-store';

import { matchRule } from './matcher';
import { useTrackingRulesStore } from './tracking-rules-store';
import type { TrackingRule } from './tracking-rules-store';
import { IDLE_TIMEOUT_MS } from './timing-config';

// Module-level state — survives re-renders, cleaned up in stopAutoTracker()
type Sub = ReturnType<typeof emitter.addListener>;
let eventSub: Sub | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
/** The id of the rule that auto-started the current timer. Null if manual. */
let autoStartedRuleId: string | null = null;
/**
 * True when the most recent app_change event matched the tracked app (or a
 * companion). Heartbeats may only reset the idle timer when this is true —
 * i.e. only while the user is still on the tracked app. Once they switch to
 * an untracked app this becomes false and heartbeats are ignored, letting the
 * idle countdown run to completion.
 */
let lastEventWasTracked = false;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function clearIdleTimer() {
  if (idleTimer !== null) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
}

function scheduleIdleTimer() {
  clearIdleTimer();
  idleTimer = setTimeout(() => {
    if (autoStartedRuleId !== null) {
      stopAndSave();
    }
  }, IDLE_TIMEOUT_MS);
}

function stopAndSave() {
  const sessionData = useTimerStore.getState().stopTimer();
  if (sessionData) {
    useSessionsStore.getState().addSession({
      ...sessionData,
      id: Date.now().toString(),
      auto: true,
    });
  }
  autoStartedRuleId = null;
}

function startAutoTimer(rule: TrackingRule, event: ActivityEvent) {
  const title = rule.defaultTitle ?? event.appName;
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
  // Heartbeats carry no app data. Only reset the idle timer if the last known
  // app was the tracked one — i.e. the user is still on it, just not switching.
  // If they already moved to an untracked app, let the countdown run.
  if (event.type === 'heartbeat') {
    if (lastEventWasTracked) {
      scheduleIdleTimer();
    }
    return;
  }

  const { isTracking } = useTimerStore.getState();
  const { rules } = useTrackingRulesStore.getState();
  const match = matchRule(event, rules);
  let onTrackedApp = false;

  if (isTracking && autoStartedRuleId !== null) {
    if (match && match.id === autoStartedRuleId) {
      // Same rule still matches — reset idle timer and keep running
      clearIdleTimer();
      onTrackedApp = true;
    } else if (isCompanionApp(autoStartedRuleId, event.bundleId)) {
      // Switched to a companion app — session continues, treat as tracked
      onTrackedApp = true;
    } else if (match) {
      // Switched to a different tracked app — start a new session immediately
      stopAndSave();
      startAutoTimer(match, event);
      clearIdleTimer();
      onTrackedApp = true;
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
  if (process.env.EXPO_OS !== 'ios') return;

  // Idempotent — tear down any existing subscription before re-attaching
  eventSub?.remove();
  eventSub = emitter.addListener('onEvent', handleEvent);
}

export function stopAutoTracker() {
  if (process.env.EXPO_OS !== 'ios') return;

  eventSub?.remove();
  eventSub = null;

  clearIdleTimer();
  lastEventWasTracked = false;

  // If an auto-tracked session is in progress, save it before stopping
  if (autoStartedRuleId !== null) {
    stopAndSave();
  }
}
