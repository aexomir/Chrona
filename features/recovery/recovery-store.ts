import { create } from "zustand";
import type { RecoveryPeriod } from "@/features/recovery/detectMissedTime";

type RecoveryState = {
  period: RecoveryPeriod | null;
  dismissedStarts: string[];
  set: (period: RecoveryPeriod) => void;
  dismiss: () => void;
  clear: () => void;
  isDismissed: (startTime: string) => boolean;
};

/**
 * Ephemeral store for missed time recovery (no persist).
 * Holds at most one pending period. Dismissed periods never resurface this session.
 */
export const useRecoveryStore = create<RecoveryState>()((set, get) => ({
  period: null,
  dismissedStarts: [],
  set: (period) => set({ period }),
  dismiss: () =>
    set((state) => ({
      period: null,
      dismissedStarts: state.period
        ? [...state.dismissedStarts, state.period.startTime]
        : state.dismissedStarts,
    })),
  clear: () => set({ period: null }),
  isDismissed: (startTime) => get().dismissedStarts.includes(startTime),
}));
