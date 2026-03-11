import { create } from "zustand";
import type { RecoveryPeriod } from "@/lib/detectMissedTime";

type RecoveryState = {
  pending: RecoveryPeriod | null;
  set: (period: RecoveryPeriod) => void;
  clear: () => void;
};

/**
 * Ephemeral Zustand store for missed time recovery (no persist).
 * Resets on app launch — stale banners never resurface.
 */
export const useRecoveryStore = create<RecoveryState>()((set) => ({
  pending: null,
  set: (period) => set({ pending: period }),
  clear: () => set({ pending: null }),
}));
