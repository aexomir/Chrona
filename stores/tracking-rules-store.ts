import { mmkvStorage } from "@/storage";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type TrackingRule = {
  id: string;
  appName: string;
  windowTitleContains?: string;
  projectId: string;
  defaultTitle?: string;
  createdAt: string;
};

type TrackingRulesState = {
  rules: TrackingRule[];
  addRule: (
    appName: string,
    projectId: string,
    windowTitleContains?: string,
    defaultTitle?: string
  ) => void;
  removeRule: (id: string) => void;
  updateRule: (id: string, patch: Partial<Omit<TrackingRule, "id" | "createdAt">>) => void;
  matchRule: (app: string, title: string | null) => TrackingRule | null;
};

/**
 * Persisted Zustand store for automatic tracking rules.
 * Rules are matched synchronously against detected apps.
 */
export const useTrackingRulesStore = create<TrackingRulesState>()(
  persist(
    (set, get) => ({
      rules: [],
      addRule: (appName, projectId, windowTitleContains, defaultTitle) =>
        set((state) => {
          // Normalize empty windowTitleContains to undefined
          const normalized = windowTitleContains?.trim() ? windowTitleContains : undefined;
          return {
            rules: [
              ...state.rules,
              {
                id: Date.now().toString(),
                appName,
                projectId,
                windowTitleContains: normalized,
                defaultTitle,
                createdAt: new Date().toISOString(),
              },
            ],
          };
        }),
      removeRule: (id) =>
        set((state) => ({
          rules: state.rules.filter((r) => r.id !== id),
        })),
      updateRule: (id, patch) =>
        set((state) => ({
          rules: state.rules.map((r) =>
            r.id === id
              ? {
                  ...r,
                  ...patch,
                  windowTitleContains: patch.windowTitleContains?.trim()
                    ? patch.windowTitleContains
                    : undefined,
                }
              : r
          ),
        })),
      matchRule: (app, title) => {
        const rules = get().rules;
        // Filter by exact appName match
        const candidates = rules.filter((r) => r.appName === app);
        if (candidates.length === 0) return null;

        // Sort: rules with windowTitleContains first (title-specific), then app-only
        candidates.sort((a, b) => {
          const aHasTitle = a.windowTitleContains != null;
          const bHasTitle = b.windowTitleContains != null;
          return bHasTitle ? 1 : -1;
        });

        // Test windowTitleContains if present, case-insensitive
        for (const rule of candidates) {
          if (!rule.windowTitleContains) {
            return rule; // No title filter, match
          }
          if (title && title.toLowerCase().includes(rule.windowTitleContains.toLowerCase())) {
            return rule; // Title matches
          }
        }

        return null; // No match
      },
    }),
    {
      name: "tracking-rules",
      storage: mmkvStorage,
    }
  )
);
