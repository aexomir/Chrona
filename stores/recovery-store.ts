import { create } from "zustand";
import type { RecoveryPeriod } from "@/lib/detectMissedTime";

type RecoveryState = {
  pending: RecoveryPeriod[];
  add: (period: RecoveryPeriod) => void;
  set: (periods: RecoveryPeriod[]) => void;
  removeFirst: () => void;
  clear: () => void;
};

/**
 * Ephemeral Zustand store for missed time recovery (no persist).
 * Resets on app launch — stale banners never resurface.
 */
export const useRecoveryStore = create<RecoveryState>()((set) => ({
  pending: [],
  add: (period) => set((state) => ({ pending: [...state.pending, period] })),
  set: (periods) => set({ pending: periods }),
  removeFirst: () => set((state) => ({ pending: state.pending.slice(1) })),
  clear: () => set({ pending: [] }),
}));
