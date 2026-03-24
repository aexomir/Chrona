import { mmkvStorage } from "@/storage";
import type { AdapterMode } from "@/features/activity-watch/aw-adapter";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type TimerStartMode = "a" | "b" | "c";

type SettingsState = {
  auroraEnabled: boolean;
  setAuroraEnabled: (enabled: boolean) => void;
  constellationEnabled: boolean;
  setConstellationEnabled: (enabled: boolean) => void;
  autoTrackingEnabled: boolean;
  setAutoTrackingEnabled: (enabled: boolean) => void;
  developerMode: boolean;
  setDeveloperMode: (enabled: boolean) => void;
  awAdapterMode: AdapterMode;
  setAwAdapterMode: (mode: AdapterMode) => void;
  /** Hostname or IP of the FocusHelper collector (stream mode only). Defaults to "localhost". */
  awStreamHost: string;
  setAwStreamHost: (host: string) => void;
  timerStartMode: TimerStartMode;
  setTimerStartMode: (mode: TimerStartMode) => void;
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
      developerMode: false,
      setDeveloperMode: (enabled) => set({ developerMode: enabled }),
      awAdapterMode: "localhost",
      setAwAdapterMode: (mode) => set({ awAdapterMode: mode }),
      awStreamHost: "localhost",
      setAwStreamHost: (host) => set({ awStreamHost: host }),
      timerStartMode: "a",
      setTimerStartMode: (mode) => set({ timerStartMode: mode }),
    }),
    {
      name: "settings",
      storage: mmkvStorage,
    }
  )
);
