import { mmkvStorage } from "@/storage";
import { create } from "zustand";
import { persist } from "zustand/middleware";

type SettingsState = {
  auroraEnabled: boolean;
  setAuroraEnabled: (enabled: boolean) => void;
  constellationEnabled: boolean;
  setConstellationEnabled: (enabled: boolean) => void;
  autoTrackingEnabled: boolean;
  setAutoTrackingEnabled: (enabled: boolean) => void;
  dailyGoalMinutes: number;
  setDailyGoalMinutes: (minutes: number) => void;
  developerMode: boolean;
  setDeveloperMode: (enabled: boolean) => void;
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      auroraEnabled: true,
      setAuroraEnabled: (enabled) => set({ auroraEnabled: enabled }),
      constellationEnabled: true,
      setConstellationEnabled: (enabled) => set({ constellationEnabled: enabled }),
      autoTrackingEnabled: false,
      setAutoTrackingEnabled: (enabled) => set({ autoTrackingEnabled: enabled }),
      dailyGoalMinutes: 240,
      setDailyGoalMinutes: (minutes) => set({ dailyGoalMinutes: minutes }),
      developerMode: false,
      setDeveloperMode: (enabled) => set({ developerMode: enabled }),
    }),
    {
      name: "settings",
      storage: mmkvStorage,
    }
  )
);
