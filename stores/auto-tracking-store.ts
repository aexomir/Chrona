import { create } from "zustand";

export type AutoSession = {
  startTime: string;
  endTime: string;
  duration: number;
  ruleId: string;
  app: string;
};

type AutoTrackingState = {
  isAutoTracking: boolean;
  autoStartTimestamp: string | null;
  detectedApp: string | null;
  detectedTitle: string | null;
  matchedRuleId: string | null;
  consecutiveOfflineCount: number;
  startAutoTracking: (app: string, title: string | null, ruleId: string) => void;
  stopAutoTracking: () => AutoSession | null;
  setDetectedApp: (app: string | null, title: string | null) => void;
  incrementOfflineCount: () => void;
  resetOfflineCount: () => void;
  clear: () => void;
};

/**
 * Ephemeral Zustand store for automatic tracking state (no persist).
 * Resets on app launch — auto-tracking state is never persisted.
 */
export const useAutoTrackingStore = create<AutoTrackingState>()((set, get) => ({
  isAutoTracking: false,
  autoStartTimestamp: null,
  detectedApp: null,
  detectedTitle: null,
  matchedRuleId: null,
  consecutiveOfflineCount: 0,

  startAutoTracking: (app, title, ruleId) => {
    set({
      isAutoTracking: true,
      autoStartTimestamp: new Date().toISOString(),
      detectedApp: app,
      detectedTitle: title,
      matchedRuleId: ruleId,
      consecutiveOfflineCount: 0,
    });
  },

  stopAutoTracking: () => {
    const state = get();
    if (!state.isAutoTracking || !state.autoStartTimestamp || !state.matchedRuleId) {
      set({
        isAutoTracking: false,
        autoStartTimestamp: null,
        detectedApp: null,
        detectedTitle: null,
        matchedRuleId: null,
        consecutiveOfflineCount: 0,
      });
      return null;
    }

    const startTime = new Date(state.autoStartTimestamp);
    const endTime = new Date();
    const duration = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);

    const autoSession: AutoSession = {
      startTime: state.autoStartTimestamp,
      endTime: endTime.toISOString(),
      duration,
      ruleId: state.matchedRuleId,
      app: state.detectedApp || "unknown",
    };

    set({
      isAutoTracking: false,
      autoStartTimestamp: null,
      detectedApp: null,
      detectedTitle: null,
      matchedRuleId: null,
      consecutiveOfflineCount: 0,
    });

    return autoSession;
  },

  setDetectedApp: (app, title) => {
    set({
      detectedApp: app,
      detectedTitle: title,
    });
  },

  incrementOfflineCount: () => {
    set((state) => ({
      consecutiveOfflineCount: state.consecutiveOfflineCount + 1,
    }));
  },

  resetOfflineCount: () => {
    set({ consecutiveOfflineCount: 0 });
  },

  clear: () => {
    set({
      isAutoTracking: false,
      autoStartTimestamp: null,
      detectedApp: null,
      detectedTitle: null,
      matchedRuleId: null,
      consecutiveOfflineCount: 0,
    });
  },
}));
