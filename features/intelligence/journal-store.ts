/**
 * Passive activity journal — silent background layer.
 *
 * Converts the raw ChronaStream event stream into compact session records.
 * A session is a contiguous block of app activity; any gap longer than
 * GAP_THRESHOLD_MS between consecutive events closes the current session and
 * starts a new one.
 *
 * For each session, records total dwell time (seconds) per bundle ID.
 * Nothing is surfaced to the user — this is a data layer only.
 *
 * Lifecycle (mirror of auto-tracker):
 *   startJournalTracker() — call alongside startAutoTracker()
 *   stopJournalTracker()  — call alongside stopAutoTracker()
 */

import { mmkvStorage } from '@/storage';
import { emitter } from '@/modules/chrona-stream';
import type { ActivityEvent } from '@/modules/chrona-stream';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const GAP_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ENTRIES = 500;
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/** bundleId → total seconds spent in that app within one session */
export type AppDwell = Record<string, number>;

export type JournalSession = {
  id: string;
  /** Unix ms — when the first app_change in this session arrived */
  startedAt: number;
  /** Unix ms — timestamp of the last event that closed this session */
  endedAt: number;
  /** Dwell times keyed by bundle ID */
  apps: AppDwell;
};

type JournalState = {
  sessions: JournalSession[];
  /** Maps bundleId → display name, populated as ActivityEvents arrive. */
  nameIndex: Record<string, string>;
  /** Internal — called by the tracker; not meant for UI consumption */
  _addSession: (session: JournalSession) => void;
  _updateNameIndex: (bundleId: string, appName: string) => void;
  /** Debug only: seed a display name for a bundle ID without waiting for real events. */
  debugSeedName: (bundleId: string, appName: string) => void;
};

export const useJournalStore = create<JournalState>()(
  persist(
    (set) => ({
      sessions: [],
      nameIndex: {},

      _addSession: (session) =>
        set((state) => {
          const cutoff = Date.now() - MAX_AGE_MS;
          const next = [...state.sessions, session]
            .filter((s) => s.endedAt >= cutoff)
            .slice(-MAX_ENTRIES);
          return { sessions: next };
        }),

      _updateNameIndex: (bundleId, appName) =>
        set((state) => {
          if (state.nameIndex[bundleId]) return state;
          return { nameIndex: { ...state.nameIndex, [bundleId]: appName } };
        }),

      debugSeedName: (bundleId, appName) =>
        set((state) => ({
          nameIndex: { ...state.nameIndex, [bundleId]: appName },
        })),
    }),
    {
      name: 'activity-journal',
      storage: mmkvStorage,
      partialize: (state) => ({
        sessions: state.sessions,
        nameIndex: state.nameIndex,
      }),
    },
  ),
);

// ---------------------------------------------------------------------------
// Module-level tracker state — survives re-renders, no React dependency
// ---------------------------------------------------------------------------

type Sub = ReturnType<typeof emitter.addListener>;
let journalSub: Sub | null = null;

let activeSession: JournalSession | null = null;
let activeBundleId: string | null = null;
/** Timestamp (ms) when the current frontmost app became active */
let appStartMs: number | null = null;
/** Timestamp (ms) of the most recent event of any type */
let lastEventMs: number | null = null;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function flushApp(toMs: number) {
  if (!activeSession || !activeBundleId || appStartMs === null) return;
  const dwell = Math.round((toMs - appStartMs) / 1000);
  if (dwell > 0) {
    activeSession.apps[activeBundleId] =
      (activeSession.apps[activeBundleId] ?? 0) + dwell;
  }
}

function closeSession(endedAt: number) {
  if (!activeSession) return;
  flushApp(endedAt);
  activeSession.endedAt = endedAt;
  useJournalStore.getState()._addSession({ ...activeSession });
  activeSession = null;
  activeBundleId = null;
  appStartMs = null;
}

function handleJournalEvent(event: ActivityEvent) {
  // Heartbeats carry no app data — update the gap clock and return
  if (event.type === 'heartbeat') {
    lastEventMs = event.timestamp;
    return;
  }

  // Guard: app_change / hello must have a bundleId
  if (!event.bundleId) {
    lastEventMs = event.timestamp;
    return;
  }

  // Keep the display-name index up-to-date (no-op if bundleId already known)
  if (event.appName && !useJournalStore.getState().nameIndex[event.bundleId]) {
    useJournalStore.getState()._updateNameIndex(event.bundleId, event.appName);
  }

  const now = event.timestamp;
  const gap = lastEventMs !== null ? now - lastEventMs : 0;

  // Gap exceeds threshold → close whatever session is open
  if (activeSession !== null && gap > GAP_THRESHOLD_MS) {
    closeSession(lastEventMs!); // close at last-seen timestamp, not at now
  }

  // Open a new session if we don't have one
  if (activeSession === null) {
    activeSession = {
      id: `${now}-${Math.random().toString(36).slice(2, 7)}`,
      startedAt: now,
      endedAt: now,
      apps: {},
    };
    activeBundleId = null;
    appStartMs = null;
  }

  // App transition within the session
  if (activeBundleId !== null && activeBundleId !== event.bundleId) {
    flushApp(now);
    activeBundleId = event.bundleId;
    appStartMs = now;
  } else if (activeBundleId === null) {
    // First app in this session
    activeBundleId = event.bundleId;
    appStartMs = now;
  }
  // If same bundleId → no-op (hello fired again for same app, or duplicate event)

  lastEventMs = now;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function snapshotActiveApps(): AppDwell {
  if (!activeSession) return {};
  const result = { ...activeSession.apps };
  if (activeBundleId && appStartMs !== null) {
    const dwell = Math.round((Date.now() - appStartMs) / 1000);
    if (dwell > 0) {
      result[activeBundleId] = (result[activeBundleId] ?? 0) + dwell;
    }
  }
  return result;
}

export function startJournalTracker() {
  if (process.env.EXPO_OS !== 'ios') return;
  // Idempotent
  journalSub?.remove();
  journalSub = emitter.addListener('onEvent', handleJournalEvent);
}

export function stopJournalTracker() {
  if (process.env.EXPO_OS !== 'ios') return;
  journalSub?.remove();
  journalSub = null;
  // Flush whatever session is in progress
  if (activeSession !== null && lastEventMs !== null) {
    closeSession(lastEventMs);
  }
}
