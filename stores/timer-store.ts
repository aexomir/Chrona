import { mmkvStorage } from "@/storage";
import { create } from "zustand";
import { persist } from "zustand/middleware";

type TimerState = {
  isTracking: boolean;
  startTimestamp: string | null;
  title: string;
  projectId: string | null;
  startTimer: (title: string, projectId?: string | null) => void;
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
      stopTimer: () => {
        const { isTracking, startTimestamp, title, projectId } = get();
        if (!isTracking || !startTimestamp) return null;
        const endTime = new Date().toISOString();
        const duration = Math.floor(
          (new Date(endTime).getTime() - new Date(startTimestamp).getTime()) /
            1000
        );
        set({ isTracking: false, startTimestamp: null, title: "", projectId: null });
        return { startTime: startTimestamp, endTime, duration, title, projectId };
      },
      updateTitle: (title) => set({ title }),
      updateProjectId: (id) => set({ projectId: id }),
    }),
    {
      name: "timer",
      storage: mmkvStorage,
    }
  )
);
