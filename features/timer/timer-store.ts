import { mmkvStorage } from "@/storage";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type InterruptedSession = {
  title: string;
  projectId: string | null;
  interruptedAt: string;
  elapsedSeconds: number;
};

type TimerState = {
  isTracking: boolean;
  isAutoTracked: boolean;
  startTimestamp: string | null;
  title: string;
  projectId: string | null;
  interruptedSession: InterruptedSession | null;
  startTimer: (title: string, projectId?: string | null, fromElapsedSeconds?: number) => void;
  stopTimer: () => {
    startTime: string;
    endTime: string;
    duration: number;
    title: string;
    projectId: string | null;
  } | null;
  updateTitle: (title: string) => void;
  updateProjectId: (id: string | null) => void;
  setInterruptedSession: (session: InterruptedSession | null) => void;
  setAutoTracked: (value: boolean) => void;
};

export const useTimerStore = create<TimerState>()(
  persist(
    (set, get) => ({
      isTracking: false,
      isAutoTracked: false,
      startTimestamp: null,
      title: "",
      projectId: null,
      interruptedSession: null,
      startTimer: (title, projectId = null, fromElapsedSeconds = 0) =>
        set({
          isTracking: true,
          isAutoTracked: false,
          startTimestamp: new Date(Date.now() - fromElapsedSeconds * 1000).toISOString(),
          title,
          projectId: projectId ?? null,
          interruptedSession: null,
        }),
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
      setInterruptedSession: (session) => set({ interruptedSession: session }),
      setAutoTracked: (value) => set({ isAutoTracked: value }),
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
