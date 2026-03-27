import { mmkvStorage } from '@/storage';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type TrackingRule = {
  id: string;
  /** Exact display name of the app, e.g. "Xcode". Matched case-insensitively. */
  appName: string;
  /** ALL keywords must appear in the window title (case-insensitive) to match. */
  titleKeywords: string[];
  projectId: string;
  /** If set, used as the session title instead of the app name. */
  defaultTitle?: string;
  createdAt: string; // ISO 8601
  /**
   * Bundle ID of the primary app that produced this rule, set when the rule
   * was created from an intelligence suggestion. Required for the learning loop
   * (companion expansion, drift detection, auto-deactivation).
   */
  primaryBundleId?: string;
  /**
   * Bundle IDs of companion apps at the time the rule was confirmed.
   * Silently expanded by the learning loop when new co-occurring apps cross 60%.
   */
  companionBundleIds?: string[];
  /**
   * Whether this rule is currently active. Undefined or true = active.
   * Set to false by auto-deactivation when the primary app has not appeared
   * for 21 consecutive days. The rule is preserved so it can be reactivated.
   */
  active?: boolean;
};

type TrackingRulesState = {
  rules: TrackingRule[];
  addRule: (draft: Omit<TrackingRule, 'id' | 'createdAt'>) => void;
  updateRule: (
    id: string,
    patch: Partial<Omit<TrackingRule, 'id' | 'createdAt'>>,
  ) => void;
  removeRule: (id: string) => void;
  /** Mark a rule as inactive without deleting it. Triggered by auto-deactivation. */
  deactivateRule: (id: string) => void;
};

export const useTrackingRulesStore = create<TrackingRulesState>()(
  persist(
    (set) => ({
      rules: [],

      addRule: (draft) =>
        set((state) => ({
          rules: [
            ...state.rules,
            {
              ...draft,
              id: Date.now().toString(),
              createdAt: new Date().toISOString(),
            },
          ],
        })),

      updateRule: (id, patch) =>
        set((state) => ({
          rules: state.rules.map((r) =>
            r.id === id ? { ...r, ...patch } : r,
          ),
        })),

      removeRule: (id) =>
        set((state) => ({
          rules: state.rules.filter((r) => r.id !== id),
        })),

      deactivateRule: (id) =>
        set((state) => ({
          rules: state.rules.map((r) =>
            r.id === id ? { ...r, active: false } : r,
          ),
        })),
    }),
    {
      name: 'tracking-rules',
      storage: mmkvStorage,
      version: 0,
      migrate: () => ({ rules: [] }),
    },
  ),
);
