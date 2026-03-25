import type { AdapterMode } from "@/features/activity-watch/aw-adapter";
import { mmkvStorage } from "@/storage";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type TimerStartMode = "a" | "b" | "c";

export interface RecentHost {
  host: string;
  lastConnectedAt: number;
}

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
  awStreamHost: string;
  setAwStreamHost: (host: string) => void;

  recentHosts: RecentHost[];
  addRecentHost: (host: string) => void;
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
      autoTrackingEnabled: false,
      setAutoTrackingEnabled: (enabled) =>
        set({ autoTrackingEnabled: enabled }),
      developerMode: false,
      setDeveloperMode: (enabled) => set({ developerMode: enabled }),
      awAdapterMode: "localhost",
      setAwAdapterMode: (mode) => set({ awAdapterMode: mode }),
      awStreamHost: "localhost",
      setAwStreamHost: (host) => set({ awStreamHost: host }),
      recentHosts: [],
      addRecentHost: (host) =>
        set((state) => {
          if (host === "localhost") return state;
          const updated = state.recentHosts.filter((h) => h.host !== host);
          updated.unshift({ host, lastConnectedAt: Date.now() });
          return { recentHosts: updated.slice(0, 3) };
        }),
      timerStartMode: "a",
      setTimerStartMode: (mode) => set({ timerStartMode: mode }),
    }),
    {
      name: "settings",
      storage: mmkvStorage,
    },
  ),
);
