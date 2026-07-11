/**
 * Passive activity journal — silent background layer.
 *
 * Converts the raw ChronaStream event stream into compact session records.
 * A session is a contiguous block of app activity; any gap longer than
 * GAP_THRESHOLD_MS between consecutive events closes the current session and
 * starts a new one.
 *
 * For each session, records total dwell time (seconds) per bundle ID and the
 * unique window titles seen per bundle ID.
 * Nothing is surfaced to the user — this is a data layer only.
 *
 * Lifecycle:
 *   startJournalTracker() — call after useStreamStore.start()
 *   stopJournalTracker()  — call when tearing down
 */

import type { ActivityEvent } from "@/modules/chrona-stream";
import { emitter } from "@/modules/chrona-stream";
import { mmkvStorage } from "@/storage";
import { create } from "zustand";
import { persist } from "zustand/middleware";

const GAP_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ENTRIES = 500;
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const MIN_REVIEW_DWELL_SECONDS = 5;
const MAX_TITLES_PER_BUNDLE = 20;

const SYSTEM_BUNDLE_PREFIXES = [
  "com.apple.loginwindow",
  "com.apple.dock",
  "com.apple.finder",
  "com.apple.systemuiserver",
  "com.apple.notificationcenterui",
  "com.apple.ScreenSaverEngine",
  "com.apple.screensaver.",
  "com.apple.UserNotificationCenter",
  "com.apple.SecurityAgent",
  "com.apple.controlcenter",
  "com.apple.Spotlight",
  "com.apple.springboard",
  "com.apple.PIPAgent",
  "com.apple.WindowManager",
] as const;

const SYSTEM_APP_NAMES = new Set([
  "Finder",
  "Dock",
  "loginwindow",
  "SystemUIServer",
  "NotificationCenter",
  "Notification Center",
  "ScreenSaverEngine",
  "Control Center",
  "Spotlight",
  "UserNotificationCenter",
  "SecurityAgent",
  "WindowManager",
  "PIPAgent",
]);

function isSystemProcess(bundleId: string, displayName: string): boolean {
  if (SYSTEM_APP_NAMES.has(displayName)) return true;
  return SYSTEM_BUNDLE_PREFIXES.some((p) => bundleId === p || bundleId.startsWith(p));
}

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
  /** Unique window titles seen per bundle ID (max 20 per bundle) */
  titles?: Record<string, string[]>;
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
      name: "activity-journal",
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
/** Most recent window title for the current frontmost app */
let activeWindowTitle: string | null = null;
/** Per-bundle unique window titles accumulated in the current session */
let activeTitles: Record<string, Set<string>> = {};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function _recordTitle(bundleId: string, title: string | null) {
  if (!bundleId || !title || title.trim() === "") return;
  if (!activeTitles[bundleId]) activeTitles[bundleId] = new Set();
  const set = activeTitles[bundleId];
  if (set.size >= MAX_TITLES_PER_BUNDLE) return;
  set.add(title.trim());
}

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
  _recordTitle(activeBundleId, activeWindowTitle);
  flushApp(endedAt);

  const titlesRecord: Record<string, string[]> = {};
  for (const [id, set] of Object.entries(activeTitles)) {
    if (set.size > 0) titlesRecord[id] = Array.from(set);
  }

  const sessionToCommit: JournalSession = {
    ...activeSession,
    endedAt,
    ...(Object.keys(titlesRecord).length > 0 ? { titles: titlesRecord } : {}),
  };

  useJournalStore.getState()._addSession(sessionToCommit);
  activeSession = null;
  activeBundleId = null;
  appStartMs = null;
  activeWindowTitle = null;
  activeTitles = {};
}

function handleJournalEvent(event: ActivityEvent) {
  const now = event.timestamp * 1000;

  // Heartbeats carry no app data — update the gap clock and return
  if (event.type === "heartbeat") {
    lastEventMs = now;
    return;
  }

  // Guard: app_change / hello must have a bundleId
  if (!event.bundleId) {
    lastEventMs = now;
    return;
  }

  // Keep the display-name index up-to-date (no-op if bundleId already known)
  if (event.appName && !useJournalStore.getState().nameIndex[event.bundleId]) {
    useJournalStore.getState()._updateNameIndex(event.bundleId, event.appName);
  }
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
    activeWindowTitle = null;
    activeTitles = {};
  }

  // App transition within the session
  if (activeBundleId !== null && activeBundleId !== event.bundleId) {
    _recordTitle(activeBundleId, activeWindowTitle);
    flushApp(now);
    activeBundleId = event.bundleId;
    appStartMs = now;
    activeWindowTitle = event.windowTitle || null;
  } else if (activeBundleId === null) {
    // First app in this session
    activeBundleId = event.bundleId;
    appStartMs = now;
    activeWindowTitle = event.windowTitle || null;
  } else {
    // Same app — update the current window title
    activeWindowTitle = event.windowTitle || null;
  }

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

export function snapshotActiveTitles(): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const [bundleId, set] of Object.entries(activeTitles)) {
    if (set.size > 0) result[bundleId] = Array.from(set);
  }
  if (activeBundleId && activeWindowTitle) {
    if (!result[activeBundleId]) result[activeBundleId] = [];
    if (!result[activeBundleId].includes(activeWindowTitle)) {
      result[activeBundleId] = [...result[activeBundleId], activeWindowTitle];
    }
  }
  return result;
}

// Baseline captured at focus-timer start so getAppsForWindow can diff against it
let baselineJournalId: string | null = null;
let baselineApps: AppDwell = {};

/**
 * Call this the moment a focus timer starts. Records a snapshot of the current
 * in-flight journal session so getAppsForWindow can diff against it later —
 * otherwise pre-timer app usage bleeds into the session's app breakdown.
 */
export function markTimerStart() {
  if (activeSession !== null) {
    baselineJournalId = activeSession.id;
    baselineApps = snapshotActiveApps();
  } else {
    baselineJournalId = null;
    baselineApps = {};
  }
}

export function getAppsForWindow(
  _startMs: number,
  _endMs: number,
): import("@/features/sessions/sessions-store").AppUsage[] {
  const { sessions, nameIndex } = useJournalStore.getState();
  const agg: Record<string, number> = {};
  const aggTitles: Record<string, Set<string>> = {};

  function mergeTitles(bundleId: string, titles: string[]) {
    if (!aggTitles[bundleId]) aggTitles[bundleId] = new Set();
    for (const t of titles) aggTitles[bundleId].add(t);
  }

  // Committed journal sessions that started fresh DURING the focus window
  // (i.e. after the baseline was captured — the baseline session is handled
  // separately via delta below)
  for (const s of sessions) {
    if (s.id === baselineJournalId) continue;
    if (s.startedAt < _startMs) continue;
    for (const [bundleId, dwell] of Object.entries(s.apps)) {
      if (dwell > 0) agg[bundleId] = (agg[bundleId] ?? 0) + dwell;
    }
    for (const [bundleId, titles] of Object.entries(s.titles ?? {})) {
      mergeTitles(bundleId, titles);
    }
  }

  if (activeSession !== null) {
    const current = snapshotActiveApps();
    const currentTitles = snapshotActiveTitles();
    if (activeSession.id === baselineJournalId) {
      // Same journal session that was open when the timer started —
      // subtract the baseline so we get only what accumulated during the focus
      for (const [bundleId, currentDwell] of Object.entries(current)) {
        const delta = currentDwell - (baselineApps[bundleId] ?? 0);
        if (delta > 0) agg[bundleId] = (agg[bundleId] ?? 0) + delta;
      }
      for (const [bundleId, titles] of Object.entries(currentTitles)) {
        mergeTitles(bundleId, titles);
      }
    } else {
      // Journal session rolled over during the focus (5-min idle gap) —
      // the current session started fresh inside the focus window
      for (const [bundleId, dwell] of Object.entries(current)) {
        if (dwell > 0) agg[bundleId] = (agg[bundleId] ?? 0) + dwell;
      }
      for (const [bundleId, titles] of Object.entries(currentTitles)) {
        mergeTitles(bundleId, titles);
      }
    }
  } else if (baselineJournalId !== null) {
    // The baseline session was committed to the store during the focus period
    // (journal closed due to a gap). Find it and delta against the baseline.
    const baselineSession = sessions.find((s) => s.id === baselineJournalId);
    if (baselineSession) {
      for (const [bundleId, dwell] of Object.entries(baselineSession.apps)) {
        const delta = dwell - (baselineApps[bundleId] ?? 0);
        if (delta > 0) agg[bundleId] = (agg[bundleId] ?? 0) + delta;
      }
      for (const [bundleId, titles] of Object.entries(baselineSession.titles ?? {})) {
        mergeTitles(bundleId, titles);
      }
    }
  }

  return Object.entries(agg)
    .filter(([bundleId, duration]) => {
      if (duration < MIN_REVIEW_DWELL_SECONDS) return false;
      const name = nameIndex[bundleId] ?? bundleId;
      return !isSystemProcess(bundleId, name);
    })
    .map(([bundleId, duration]) => {
      const titleArr = Array.from(aggTitles[bundleId] ?? []);
      return {
        app: nameIndex[bundleId] ?? bundleId,
        duration: Math.round(duration),
        ...(titleArr.length > 0 ? { titles: titleArr } : {}),
      };
    })
    .sort((a, b) => b.duration - a.duration);
}

export function startJournalTracker() {
  if (process.env.EXPO_OS !== "ios") return;
  // Idempotent
  journalSub?.remove();
  journalSub = emitter.addListener("onEvent", handleJournalEvent);
}

export function stopJournalTracker() {
  if (process.env.EXPO_OS !== "ios") return;
  journalSub?.remove();
  journalSub = null;
  // Flush whatever session is in progress
  if (activeSession !== null && lastEventMs !== null) {
    closeSession(lastEventMs);
  }
}
