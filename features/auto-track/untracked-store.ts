/**
 * Untracked-app detection.
 *
 * Watches the activity stream independently of the auto-tracker. When an app
 * has been active for ≥ 10 minutes with no matching rule and no timer running,
 * it surfaces a pending hint that the UI layer can read reactively.
 *
 * Lifecycle:
 *   useUntrackedStore.getState()._startWatching()
 *   useUntrackedStore.getState()._stopWatching()
 */

import { emitter } from '@/modules/chrona-stream';
import type { ActivityEvent } from '@/modules/chrona-stream';

import { useTimerStore } from '@/features/timer/timer-store';
import { captureError } from '@/lib/sentry';
import { create } from 'zustand';

import { matchRule } from './matcher';
import { useTrackingRulesStore } from './tracking-rules-store';
import { UNTRACKED_THRESHOLD_MS } from './timing-config';

type UntrackedHint = {
  appName: string;
  durationSeconds: number;
};

type UntrackedState = {
  pendingHint: UntrackedHint | null;
  dismissHint: () => void;
  _startWatching: () => void;
  _stopWatching: () => void;
};

// Module-level tracking — outside the store so it doesn't trigger rerenders
type UntrackedEntry = { appName: string; since: number };
let untrackedEntry: UntrackedEntry | null = null;

type Sub = ReturnType<typeof emitter.addListener>;
let eventSub: Sub | null = null;

function handleEvent(event: ActivityEvent, set: (fn: (s: UntrackedState) => Partial<UntrackedState>) => void) {
  if (event.type === 'heartbeat') return;

  // pong/user_idle/user_active carry empty appName/bundleId (see auto-tracker.ts
  // for the full explanation) — treating them as "a different app" would reset
  // the untracked-app dwell clock every ~15s (the ping interval), and the hint
  // would practically never reach UNTRACKED_THRESHOLD_MS.
  if (event.type !== 'app_change' && event.type !== 'hello') return;

  const { isTracking } = useTimerStore.getState();

  // A running timer means the user is intentionally tracked — clear any hint
  if (isTracking) {
    untrackedEntry = null;
    set(() => ({ pendingHint: null }));
    return;
  }

  const { rules } = useTrackingRulesStore.getState();
  const match = matchRule(event, rules);

  if (match) {
    // A rule covers this activity — not untracked
    untrackedEntry = null;
    set(() => ({ pendingHint: null }));
    return;
  }

  // No rule matches and no timer running — track time in this app
  const now = Date.now();

  if (untrackedEntry && untrackedEntry.appName === event.appName) {
    const elapsed = now - untrackedEntry.since;
    if (elapsed >= UNTRACKED_THRESHOLD_MS) {
      set(() => ({
        pendingHint: {
          appName: event.appName,
          durationSeconds: Math.floor(elapsed / 1000),
        },
      }));
    }
  } else {
    // Different app — reset the tracker
    untrackedEntry = { appName: event.appName, since: now };
    set(() => ({ pendingHint: null }));
  }
}

export const useUntrackedStore = create<UntrackedState>()((set) => ({
  pendingHint: null,

  dismissHint: () => set({ pendingHint: null }),

  _startWatching: () => {
    if (process.env.EXPO_OS !== 'ios') return;

    // Idempotent
    eventSub?.remove();
    eventSub = emitter.addListener('onEvent', (event: ActivityEvent) => {
      try {
        handleEvent(event, set);
      } catch (error) {
        captureError(error, 'untracked_store', { eventType: event.type });
      }
    });
  },

  _stopWatching: () => {
    if (process.env.EXPO_OS !== 'ios') return;

    eventSub?.remove();
    eventSub = null;
    untrackedEntry = null;
  },
}));
