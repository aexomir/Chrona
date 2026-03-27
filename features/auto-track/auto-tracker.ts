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

const IDLE_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes

// Module-level state — survives re-renders, cleaned up in stopAutoTracker()
type Sub = ReturnType<typeof emitter.addListener>;
let eventSub: Sub | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
/** The id of the rule that auto-started the current timer. Null if manual. */
let autoStartedRuleId: string | null = null;

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
  autoStartedRuleId = rule.id;
}

function handleEvent(event: ActivityEvent) {
  // Heartbeats carry no app data — only reset the idle timer
  if (event.type === 'heartbeat') {
    scheduleIdleTimer();
    return;
  }

  const { isTracking } = useTimerStore.getState();
  const { rules } = useTrackingRulesStore.getState();
  const match = matchRule(event, rules);

  if (isTracking && autoStartedRuleId !== null) {
    // A timer was auto-started. Stop it if the activity no longer matches.
    if (!match || match.id !== autoStartedRuleId) {
      stopAndSave();
      // If the new activity matches a different rule, begin a new auto-session
      if (match) startAutoTimer(match, event);
    }
    // Else: same rule still matches — let the timer keep running
  } else if (!isTracking) {
    if (match) startAutoTimer(match, event);
  }
  // isTracking && autoStartedRuleId === null → manual session, leave it alone

  scheduleIdleTimer();
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

  // If an auto-tracked session is in progress, save it before stopping
  if (autoStartedRuleId !== null) {
    stopAndSave();
  }
}
