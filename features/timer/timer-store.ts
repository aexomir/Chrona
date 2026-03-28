import { mmkvStorage } from "@/storage";
import { create } from "zustand";
import { persist } from "zustand/middleware";

type TimerState = {
  isTracking: boolean;
  isAutoTracked: boolean;
  startTimestamp: string | null;
  title: string;
  projectId: string | null;
  startTimer: (title: string, projectId?: string | null) => void;
  setAutoTracked: (value: boolean) => void;
  stopTimer: () => {
    startTime: string;
    endTime: string;
    duration: number;
    title: string;
    projectId: string | null;
  } | null;
  updateTitle: (title: string) => void;
  updateProjectId: (id: string | null) => void;
};

export const useTimerStore = create<TimerState>()(
  persist(
    (set, get) => ({
      isTracking: false,
      isAutoTracked: false,
      startTimestamp: null,
      title: "",
      projectId: null,
      startTimer: (title, projectId = null) =>
        set({
          isTracking: true,
          startTimestamp: new Date().toISOString(),
          title,
          projectId: projectId ?? null,
        }),
      setAutoTracked: (value) => set({ isAutoTracked: value }),
      stopTimer: () => {
        const { isTracking, startTimestamp, title, projectId } = get();
        if (!isTracking || !startTimestamp) return null;
        const endTime = new Date().toISOString();
        const duration = Math.floor(
          (new Date(endTime).getTime() - new Date(startTimestamp).getTime()) /
            1000
        );
        set({ isTracking: false, isAutoTracked: false, startTimestamp: null, title: "", projectId: null });
        return { startTime: startTimestamp, endTime, duration, title, projectId };
      },
      updateTitle: (title) => set({ title }),
      updateProjectId: (id) => set({ projectId: id }),
    }),
    {
      name: "timer",
      storage: mmkvStorage,
      onRehydrateStorage: () => (state) => {
        if (!state || !state.isTracking || !state.startTimestamp) return;
        const age = Date.now() - new Date(state.startTimestamp).getTime();
        if (age > 12 * 60 * 60 * 1000) {
          state.isTracking = false;
          state.isAutoTracked = false;
          state.startTimestamp = null;
          state.title = "";
          state.projectId = null;
        }
      },
    }
  )
);
