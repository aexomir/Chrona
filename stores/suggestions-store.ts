import { mmkvStorage } from "@/storage";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AppUsage } from "@/stores/sessions-store";

type AssociationMap = {
  [appName: string]: {
    [projectId: string]: { count: number; totalDuration: number };
  };
};

type SuggestionsState = {
  associations: AssociationMap;
  learnFromSession: (apps: AppUsage[], projectId: string) => void;
  suggestProject: (
    apps: AppUsage[]
  ) => { projectId: string; matchedApps: string[] } | null;
};

export const useSuggestionsStore = create<SuggestionsState>()(
  persist(
    (set, get) => ({
      associations: {},
      learnFromSession: (apps, projectId) => {
        set((state) => {
          const newAssociations = { ...state.associations };
          for (const app of apps) {
            if (!newAssociations[app.app]) {
              newAssociations[app.app] = {};
            }
            if (!newAssociations[app.app][projectId]) {
              newAssociations[app.app][projectId] = {
                count: 0,
                totalDuration: 0,
              };
            }
            newAssociations[app.app][projectId].count += 1;
            newAssociations[app.app][projectId].totalDuration += app.duration;
          }
          return { associations: newAssociations };
        });
      },
      suggestProject: (apps) => {
        const associations = get().associations;
        const projectScores: {
          [projectId: string]: {
            score: number;
            matchedApps: string[];
          };
        } = {};

        for (const app of apps) {
          const appAssocs = associations[app.app];
          if (!appAssocs) continue;

          for (const [projectId, data] of Object.entries(appAssocs)) {
            if (!projectScores[projectId]) {
              projectScores[projectId] = { score: 0, matchedApps: [] };
            }
            projectScores[projectId].score += data.count;
            if (!projectScores[projectId].matchedApps.includes(app.app)) {
              projectScores[projectId].matchedApps.push(app.app);
            }
          }
        }

        // Filter by threshold (score >= 2) and sort
        const candidates = Object.entries(projectScores)
          .filter(([_, data]) => data.score >= 2)
          .sort(([_, a], [__, b]) => b.score - a.score);

        if (candidates.length === 0) return null;

        const [projectId, data] = candidates[0];
        return {
          projectId,
          matchedApps: data.matchedApps,
        };
      },
    }),
    {
      name: "suggestions",
      storage: mmkvStorage,
    }
  )
);
