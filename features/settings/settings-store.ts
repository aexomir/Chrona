import { mmkvStorage } from "@/storage";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type TimerStartMode = "a" | "b" | "c";

type SettingsState = {
  auroraEnabled: boolean;
  setAuroraEnabled: (enabled: boolean) => void;
  constellationEnabled: boolean;
  setConstellationEnabled: (enabled: boolean) => void;
  developerMode: boolean;
  setDeveloperMode: (enabled: boolean) => void;
  timerStartMode: TimerStartMode;
  setTimerStartMode: (mode: TimerStartMode) => void;
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      auroraEnabled: true,
      setAuroraEnabled: (enabled) => set({ auroraEnabled: enabled }),
      constellationEnabled: true,
      setConstellationEnabled: (enabled) =>
        set({ constellationEnabled: enabled }),
      developerMode: false,
      setDeveloperMode: (enabled) => set({ developerMode: enabled }),
      timerStartMode: "a",
      setTimerStartMode: (mode) => set({ timerStartMode: mode }),
    }),
    {
      name: "settings",
      storage: mmkvStorage,
    },
  ),
);
