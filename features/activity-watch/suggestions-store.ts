import { mmkvStorage } from "@/storage";
import { getAppCategory } from "@/features/activity-watch/activitywatch";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AppUsage } from "@/features/sessions/sessions-store";

export type AssociationMap = {
  [appName: string]: {
    [projectId: string]: { count: number; totalDuration: number; lastUsed: number };
  };
};

function recencyMultiplier(lastUsed: number | undefined): number {
  if (!lastUsed) return 0.5;
  const ageMs = Date.now() - lastUsed;
  const DAY = 86_400_000;
  if (ageMs <= DAY) return 1.0;
  if (ageMs <= 7 * DAY) return 0.8;
  return 0.5;
}

export function getSmartDefaultApps(
  apps: AppUsage[],
  projectId: string | null,
  associations: AssociationMap
): Set<string> {
  if (projectId !== null) {
    const historicalMatches = apps.filter(
      (a) => (associations[a.app]?.[projectId]?.count ?? 0) > 0
    );
    if (historicalMatches.length > 0) {
      return new Set(historicalMatches.map((a) => a.app));
    }
  }

  if (apps.length > 0) {
    const totalDuration = apps.reduce((sum, a) => sum + a.duration, 0);
    if (totalDuration > 0) {
      const sorted = [...apps].sort((a, b) => b.duration - a.duration);
      const threshold = totalDuration * 0.8;
      let cumulative = 0;
      const selected = new Set<string>();
      for (const app of sorted) {
        selected.add(app.app);
        cumulative += app.duration;
        if (cumulative >= threshold) break;
      }
      return selected;
    }
  }

  return new Set(apps.map((a) => a.app));
}

type SuggestionResult = {
  projectId: string;
  matchedApps: string[];
  score: number;
  totalCoveredDuration: number;
};

type SuggestionsState = {
  associations: AssociationMap;
  learnFromSession: (apps: AppUsage[], projectId: string) => void;
  suggestProject: (apps: AppUsage[]) => SuggestionResult | null;
};

export const useSuggestionsStore = create<SuggestionsState>()(
  persist(
    (set, get) => ({
      associations: {},
      learnFromSession: (apps, projectId) => {
        set((state) => {
          const newAssociations = { ...state.associations };
          const now = Date.now();
          const CUTOFF_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

          // Prune stale entries before writing
          for (const appName of Object.keys(newAssociations)) {
            for (const pid of Object.keys(newAssociations[appName])) {
              if (now - (newAssociations[appName][pid].lastUsed ?? 0) > CUTOFF_MS) {
                delete newAssociations[appName][pid];
              }
            }
            if (Object.keys(newAssociations[appName]).length === 0) {
              delete newAssociations[appName];
            }
          }

          for (const app of apps) {
            if (!newAssociations[app.app]) {
              newAssociations[app.app] = {};
            }
            const existing = newAssociations[app.app][projectId];
            newAssociations[app.app][projectId] = {
              count: (existing?.count ?? 0) + 1,
              totalDuration: (existing?.totalDuration ?? 0) + app.duration,
              lastUsed: now,
            };
          }
          return { associations: newAssociations };
        });
      },
      suggestProject: (apps) => {
        const associations = get().associations;
        const totalInputDuration = apps.reduce((sum, a) => sum + a.duration, 0);
        if (totalInputDuration === 0) return null;

        // Build category → stored app names index for enrichment
        const categoryApps: Record<string, string[]> = {};
        for (const storedApp of Object.keys(associations)) {
          const cat = getAppCategory(storedApp);
          if (cat) {
            if (!categoryApps[cat]) categoryApps[cat] = [];
            categoryApps[cat].push(storedApp);
          }
        }

        const projectScores: {
          [projectId: string]: {
            score: number;
            matchedApps: string[];
            coveredDuration: number;
          };
        } = {};

        for (const app of apps) {
          // Direct associations
          const direct = associations[app.app];
          if (direct) {
            for (const [projectId, data] of Object.entries(direct)) {
              const mult = recencyMultiplier(data.lastUsed);
              if (!projectScores[projectId]) {
                projectScores[projectId] = { score: 0, matchedApps: [], coveredDuration: 0 };
              }
              projectScores[projectId].score += data.count * mult;
              if (!projectScores[projectId].matchedApps.includes(app.app)) {
                projectScores[projectId].matchedApps.push(app.app);
                projectScores[projectId].coveredDuration += app.duration;
              }
            }
          }

          // Category enrichment — score only, 0.5× weight, no coverage credit
          const cat = getAppCategory(app.app);
          if (cat) {
            const related = categoryApps[cat] ?? [];
            for (const relatedApp of related) {
              if (relatedApp === app.app) continue; // already counted above
              const relatedAssocs = associations[relatedApp];
              if (!relatedAssocs) continue;
              for (const [projectId, data] of Object.entries(relatedAssocs)) {
                const mult = recencyMultiplier(data.lastUsed);
                if (!projectScores[projectId]) {
                  projectScores[projectId] = { score: 0, matchedApps: [], coveredDuration: 0 };
                }
                projectScores[projectId].score += data.count * mult * 0.5;
              }
            }
          }
        }

        // Filter: score >= 3 AND direct-matched coverage >= 40%
        const candidates = Object.entries(projectScores)
          .filter(([_, d]) => {
            const coverage = d.coveredDuration / totalInputDuration;
            return d.score >= 3 && coverage >= 0.4;
          })
          .sort(([_, a], [__, b]) => b.score - a.score);

        if (candidates.length === 0) return null;

        const [projectId, data] = candidates[0];
        return {
          projectId,
          matchedApps: data.matchedApps,
          score: data.score,
          totalCoveredDuration: data.coveredDuration,
        };
      },
    }),
    {
      name: "suggestions",
      storage: mmkvStorage,
    }
  )
);
