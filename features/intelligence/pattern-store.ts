import {
  snapshotActiveApps,
  useJournalStore,
} from "@/features/intelligence/journal-store";
import type { Session } from "@/features/sessions/sessions-store";
import { useSessionsStore } from "@/features/sessions/sessions-store";
import { useTrackingRulesStore } from "@/features/auto-track/tracking-rules-store";
import { mmkvStorage } from "@/storage";
import { create } from "zustand";
import { persist } from "zustand/middleware";

const MIN_DWELL_SECONDS = 120;
const MIN_DWELL_FRACTION = 0.5;
const SUGGESTION_THRESHOLD = 1;
export const DISMISS_TTL_MS = 14 * 24 * 60 * 60 * 1000;

type PatternState = {
  counts: Record<string, number>;
  nameIndex: Record<string, string>;
  dismissed: Record<string, number>;

  _recordObservation: (
    bundleId: string,
    appName: string,
    projectId: string,
  ) => void;
  dismiss: (bundleId: string) => void;
};

export const usePatternStore = create<PatternState>()(
  persist(
    (set) => ({
      counts: {},
      nameIndex: {},
      dismissed: {},

      _recordObservation: (bundleId, appName, projectId) =>
        set((state) => {
          const key = `${bundleId}::${projectId}`;
          return {
            counts: { ...state.counts, [key]: (state.counts[key] ?? 0) + 1 },
            nameIndex: state.nameIndex[bundleId]
              ? state.nameIndex
              : { ...state.nameIndex, [bundleId]: appName },
          };
        }),

      dismiss: (bundleId) =>
        set((state) => ({
          dismissed: { ...state.dismissed, [bundleId]: Date.now() },
        })),
    }),
    {
      name: "pattern-learning",
      storage: mmkvStorage,
    },
  ),
);

let patternUnsub: (() => void) | null = null;

function collectDwell(session: Session): Record<string, number> {
  const startMs = new Date(session.startTime).getTime();
  const endMs = new Date(session.endTime).getTime();

  const { sessions: journalSessions } = useJournalStore.getState();

  const totalDwell: Record<string, number> = {};

  for (const js of journalSessions) {
    if (js.startedAt >= endMs || js.endedAt <= startMs) continue;
    for (const [bundleId, seconds] of Object.entries(js.apps)) {
      totalDwell[bundleId] = (totalDwell[bundleId] ?? 0) + seconds;
    }
  }

  for (const [bundleId, seconds] of Object.entries(snapshotActiveApps())) {
    totalDwell[bundleId] = (totalDwell[bundleId] ?? 0) + seconds;
  }

  return totalDwell;
}

function analyzeSession(session: Session) {
  if (!session.projectId) return;

  const startMs = new Date(session.startTime).getTime();
  const endMs = new Date(session.endTime).getTime();
  if (endMs <= startMs) return;

  const totalDwell = collectDwell(session);
  if (Object.keys(totalDwell).length === 0) return;

  let dominantId: string | null = null;
  let maxDwell = 0;
  for (const [bundleId, seconds] of Object.entries(totalDwell)) {
    if (seconds > maxDwell) {
      maxDwell = seconds;
      dominantId = bundleId;
    }
  }

  if (!dominantId) return;

  const totalTracked = Object.values(totalDwell).reduce((a, b) => a + b, 0);
  if (totalTracked === 0) return;
  if (maxDwell < MIN_DWELL_SECONDS) return;
  if (maxDwell / totalTracked < MIN_DWELL_FRACTION) return;

  const { nameIndex } = useJournalStore.getState();
  const appName = nameIndex[dominantId] ?? dominantId;
  usePatternStore
    .getState()
    ._recordObservation(dominantId, appName, session.projectId);
}

function updateRuleCompanions(session: Session) {
  if (!session.projectId) return;
  const { rules, updateRule } = useTrackingRulesStore.getState();
  const projectRules = rules.filter(
    (r) => r.projectId === session.projectId && !!r.primaryBundleId
  );
  for (const rule of projectRules) {
    const computed = computeCompanionBundleIds(rule.primaryBundleId!, rule.projectId);
    if (computed.length === 0) continue;
    const existing = new Set(rule.companionBundleIds ?? []);
    const added = computed.filter((id) => !existing.has(id));
    if (added.length > 0) {
      updateRule(rule.id, {
        companionBundleIds: [...Array.from(existing), ...added],
      });
    }
  }
}

export function startPatternTracker() {
  if (process.env.EXPO_OS !== "ios") return;
  patternUnsub?.();
  let prevLength = useSessionsStore.getState().sessions.length;
  patternUnsub = useSessionsStore.subscribe((state) => {
    if (state.sessions.length <= prevLength) {
      prevLength = state.sessions.length;
      return;
    }
    prevLength = state.sessions.length;
    const newest = state.sessions[0];
    if (newest && newest.projectId) {
      if (!newest.auto) analyzeSession(newest);
      updateRuleCompanions(newest);
    }
  });
}

export function stopPatternTracker() {
  if (process.env.EXPO_OS !== "ios") return;
  patternUnsub?.();
  patternUnsub = null;
}

export type RuleSuggestion = {
  bundleId: string;
  appName: string;
  projectId: string;
  count: number;
};

export function computeRuleSuggestion(
  counts: Record<string, number>,
  nameIndex: Record<string, string>,
  dismissed: Record<string, number>,
  existingRules: { primaryBundleId?: string; appName: string }[],
  projectIds: Set<string>,
): RuleSuggestion | null {
  const now = Date.now();
  let best: RuleSuggestion | null = null;

  for (const [key, count] of Object.entries(counts)) {
    if (count < SUGGESTION_THRESHOLD) continue;

    const sep = key.indexOf("::");
    if (sep === -1) continue;
    const bundleId = key.slice(0, sep);
    const projectId = key.slice(sep + 2);
    if (!projectId) continue;
    if (!projectIds.has(projectId)) continue;

    const dismissedAt = dismissed[bundleId];
    if (dismissedAt && now - dismissedAt < DISMISS_TTL_MS) continue;

    const appName = nameIndex[bundleId];
    const hasRule = existingRules.some(
      (r) =>
        r.primaryBundleId === bundleId ||
        (appName && r.appName.toLowerCase() === appName.toLowerCase()),
    );
    if (hasRule) continue;

    if (!best || count > best.count) {
      best = { bundleId, appName: appName ?? bundleId, projectId, count };
    }
  }

  return best;
}

export function computeCompanionBundleIds(
  dominantBundleId: string,
  projectId: string,
): string[] {
  const { sessions } = useSessionsStore.getState();
  const { sessions: journalSessions } = useJournalStore.getState();

  const manualSessions = sessions.filter(
    (s) => !s.auto && s.projectId === projectId,
  );
  if (manualSessions.length < 2) return [];

  const coOccurrenceCount: Record<string, number> = {};

  for (const session of manualSessions) {
    const startMs = new Date(session.startTime).getTime();
    const endMs = new Date(session.endTime).getTime();

    const sessionDwell: Record<string, number> = {};
    for (const js of journalSessions) {
      if (js.startedAt >= endMs || js.endedAt <= startMs) continue;
      for (const [bundleId, seconds] of Object.entries(js.apps)) {
        if (bundleId === dominantBundleId) continue;
        sessionDwell[bundleId] = (sessionDwell[bundleId] ?? 0) + seconds;
      }
    }

    for (const [bundleId, seconds] of Object.entries(sessionDwell)) {
      if (seconds >= 30) {
        coOccurrenceCount[bundleId] = (coOccurrenceCount[bundleId] ?? 0) + 1;
      }
    }
  }

  const threshold = Math.ceil(manualSessions.length * 0.5);
  return Object.entries(coOccurrenceCount)
    .filter(([, count]) => count >= threshold)
    .map(([bundleId]) => bundleId);
}
