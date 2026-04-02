import {
  snapshotActiveApps,
  snapshotActiveTitles,
  useJournalStore,
} from "@/features/intelligence/journal-store";
import type { Session } from "@/features/sessions/sessions-store";
import { useSessionsStore } from "@/features/sessions/sessions-store";
import { useTrackingRulesStore } from "@/features/auto-track/tracking-rules-store";
import type { TrackingRule } from "@/features/auto-track/tracking-rules-store";
import { mmkvStorage } from "@/storage";
import { create } from "zustand";
import { persist } from "zustand/middleware";

const MIN_DWELL_SECONDS = 120;
const MIN_DWELL_FRACTION = 0.5;
const SUGGESTION_THRESHOLD = 1;
const OVERRIDE_SPLIT_THRESHOLD = 3;
export const DISMISS_TTL_MS = 14 * 24 * 60 * 60 * 1000;

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "in", "of", "to", "is", "at", "by", "for",
  "on", "with", "as", "be", "was", "are", "from", "it", "its", "this", "that",
  "not", "but",
]);
const KEYWORD_THRESHOLD = 0.7;
const MIN_WORD_LENGTH = 3;
const MIN_SESSIONS_FOR_KEYWORDS = 3;

export function extractKeywords(titleHistory: string[][]): string[] {
  if (titleHistory.length < MIN_SESSIONS_FOR_KEYWORDS) return [];
  const sessionCount: Record<string, number> = {};
  for (const sessionTitles of titleHistory) {
    const sessionWords = new Set<string>();
    for (const title of sessionTitles) {
      title
        .toLowerCase()
        .split(/[\s\-–—|•·\/\\()[\]{}<>,:;!"'`@#$%^&*+=?]+/)
        .map((t) => t.trim())
        .filter(
          (t) =>
            t.length >= MIN_WORD_LENGTH &&
            !STOPWORDS.has(t) &&
            !/^\d+$/.test(t),
        )
        .forEach((w) => sessionWords.add(w));
    }
    for (const w of sessionWords) sessionCount[w] = (sessionCount[w] ?? 0) + 1;
  }
  return Object.entries(sessionCount)
    .filter(([, c]) => c / titleHistory.length >= KEYWORD_THRESHOLD)
    .sort((a, b) => b[1] - a[1])
    .map(([w]) => w);
}

type OverrideObservation = {
  projectId: string;
  titles: string[];
  count: number;
};

type PatternState = {
  counts: Record<string, number>;
  nameIndex: Record<string, string>;
  dismissed: Record<string, number>;
  titleHistory: Record<string, string[][]>;
  overrides: Record<string, OverrideObservation[]>;

  _recordObservation: (
    bundleId: string,
    appName: string,
    projectId: string,
    titles: string[],
  ) => void;
  _recordOverride: (
    ruleId: string,
    projectId: string,
    titles: string[],
  ) => void;
  dismiss: (key: string) => void;
};

export const usePatternStore = create<PatternState>()(
  persist(
    (set) => ({
      counts: {},
      nameIndex: {},
      dismissed: {},
      titleHistory: {},
      overrides: {},

      _recordObservation: (bundleId, appName, projectId, titles) =>
        set((state) => {
          const key = `${bundleId}::${projectId}`;
          const prev = state.titleHistory[key] ?? [];
          const newHistory =
            titles.length > 0 ? [...prev, titles].slice(-50) : prev;
          return {
            counts: {
              ...state.counts,
              [key]: (state.counts[key] ?? 0) + 1,
            },
            nameIndex: state.nameIndex[bundleId]
              ? state.nameIndex
              : { ...state.nameIndex, [bundleId]: appName },
            titleHistory: { ...state.titleHistory, [key]: newHistory },
          };
        }),

      _recordOverride: (ruleId, projectId, titles) =>
        set((state) => {
          const existing = state.overrides[ruleId] ?? [];
          const match = existing.find((o) => o.projectId === projectId);
          if (match) {
            return {
              overrides: {
                ...state.overrides,
                [ruleId]: existing.map((o) =>
                  o.projectId === projectId
                    ? {
                        ...o,
                        count: o.count + 1,
                        titles: [
                          ...new Set([...o.titles, ...titles]),
                        ].slice(0, 40),
                      }
                    : o,
                ),
              },
            };
          }
          return {
            overrides: {
              ...state.overrides,
              [ruleId]: [...existing, { projectId, titles, count: 1 }],
            },
          };
        }),

      dismiss: (key) =>
        set((state) => ({
          dismissed: { ...state.dismissed, [key]: Date.now() },
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

function collectTitles(dominantBundleId: string, session: Session): string[] {
  const startMs = new Date(session.startTime).getTime();
  const endMs = new Date(session.endTime).getTime();
  const { sessions: journalSessions } = useJournalStore.getState();
  const titleSet = new Set<string>();
  for (const js of journalSessions) {
    if (js.startedAt >= endMs || js.endedAt <= startMs) continue;
    for (const t of js.titles?.[dominantBundleId] ?? []) titleSet.add(t);
  }
  for (const t of snapshotActiveTitles()[dominantBundleId] ?? []) titleSet.add(t);
  return Array.from(titleSet);
}

function checkForDrift(
  dominantBundleId: string,
  sessionProjectId: string,
  titles: string[],
) {
  const { rules } = useTrackingRulesStore.getState();
  const appName =
    useJournalStore.getState().nameIndex[dominantBundleId] ?? dominantBundleId;
  const appOnlyRules = rules.filter(
    (r) =>
      r.titleKeywords.length === 0 &&
      r.active !== false &&
      r.projectId !== sessionProjectId &&
      (r.primaryBundleId === dominantBundleId ||
        r.appName.toLowerCase() === appName.toLowerCase()),
  );
  for (const rule of appOnlyRules) {
    usePatternStore.getState()._recordOverride(rule.id, sessionProjectId, titles);
  }
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
  const titles = collectTitles(dominantId, session);
  usePatternStore
    .getState()
    ._recordObservation(dominantId, appName, session.projectId, titles);
  checkForDrift(dominantId, session.projectId, titles);
}

function updateRuleCompanions(session: Session) {
  if (!session.projectId) return;
  const { rules, updateRule } = useTrackingRulesStore.getState();
  const projectRules = rules.filter(
    (r) => r.projectId === session.projectId && !!r.primaryBundleId,
  );
  for (const rule of projectRules) {
    const computed = computeCompanionBundleIds(
      rule.primaryBundleId!,
      rule.projectId,
    );
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
  titleKeywords: string[];
};

export function computeRuleSuggestion(
  counts: Record<string, number>,
  nameIndex: Record<string, string>,
  dismissed: Record<string, number>,
  titleHistory: Record<string, string[][]>,
  existingRules: {
    primaryBundleId?: string;
    appName: string;
    titleKeywords: string[];
  }[],
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

    const dismissedAt = dismissed[key] ?? dismissed[bundleId];
    if (dismissedAt && now - dismissedAt < DISMISS_TTL_MS) continue;

    const appName = nameIndex[bundleId];
    const proposed = extractKeywords(titleHistory[key] ?? []);

    const conflicts = existingRules.some((r) => {
      const sameApp =
        r.primaryBundleId === bundleId ||
        (appName && r.appName.toLowerCase() === appName.toLowerCase());
      if (!sameApp) return false;
      if (proposed.length === 0 && r.titleKeywords.length === 0) return true;
      if (proposed.length > 0 && r.titleKeywords.length === 0) return false;
      if (proposed.length === 0 && r.titleKeywords.length > 0) return true;
      const existingSet = new Set(r.titleKeywords.map((k) => k.toLowerCase()));
      return proposed.every((k) => existingSet.has(k.toLowerCase()));
    });

    if (conflicts) continue;

    if (!best || count > best.count) {
      best = {
        bundleId,
        appName: appName ?? bundleId,
        projectId,
        count,
        titleKeywords: proposed,
      };
    }
  }

  return best;
}

export type SplitSuggestion = {
  ruleId: string;
  existingProjectId: string;
  newProjectId: string;
  appName: string;
  bundleId: string;
  titleKeywords: string[];
  overrideCount: number;
};

export function computeSplitSuggestion(
  overrides: Record<string, OverrideObservation[]>,
  titleHistory: Record<string, string[][]>,
  existingRules: TrackingRule[],
  dismissed: Record<string, number>,
  nameIndex: Record<string, string>,
  projectIds: Set<string>,
): SplitSuggestion | null {
  const now = Date.now();

  for (const [ruleId, observations] of Object.entries(overrides)) {
    const rule = existingRules.find((r) => r.id === ruleId);
    if (!rule || rule.active === false) continue;
    if (!rule.primaryBundleId) continue;

    for (const obs of observations) {
      if (obs.count < OVERRIDE_SPLIT_THRESHOLD) continue;
      if (!projectIds.has(obs.projectId)) continue;

      const splitDismissKey = `split::${ruleId}::${obs.projectId}`;
      const dismissedAt = dismissed[splitDismissKey];
      if (dismissedAt && now - dismissedAt < DISMISS_TTL_MS) continue;

      const historyKey = `${rule.primaryBundleId}::${obs.projectId}`;
      const proposed = extractKeywords(titleHistory[historyKey] ?? []);
      if (proposed.length === 0) continue;

      const alreadyExists = existingRules.some(
        (r) =>
          r.projectId === obs.projectId &&
          (r.primaryBundleId === rule.primaryBundleId ||
            r.appName.toLowerCase() === rule.appName.toLowerCase()) &&
          proposed.every((k) =>
            r.titleKeywords.map((t) => t.toLowerCase()).includes(k.toLowerCase()),
          ),
      );
      if (alreadyExists) continue;

      return {
        ruleId,
        existingProjectId: rule.projectId,
        newProjectId: obs.projectId,
        appName: rule.appName,
        bundleId: rule.primaryBundleId,
        titleKeywords: proposed,
        overrideCount: obs.count,
      };
    }
  }

  return null;
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
