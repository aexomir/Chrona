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
};

type TrackingRulesState = {
  rules: TrackingRule[];
  addRule: (draft: Omit<TrackingRule, 'id' | 'createdAt'>) => void;
  updateRule: (
    id: string,
    patch: Partial<Omit<TrackingRule, 'id' | 'createdAt'>>,
  ) => void;
  removeRule: (id: string) => void;
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
    }),
    {
      name: 'tracking-rules',
      storage: mmkvStorage,
    },
  ),
);
