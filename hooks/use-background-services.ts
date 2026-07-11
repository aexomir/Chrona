import { startIdleHandler, stopIdleHandler } from "@/features/idle/idle-handler";
import { startJournalTracker, stopJournalTracker } from "@/features/intelligence/journal-store";
import { useProjects } from "@/features/projects/projects-store";
import { useStreamStore } from "@/features/stream/stream-store";
import { useTimerStore } from "@/features/timer/timer-store";
import { useEffect } from "react";

function pushTimerState() {
  const { status, sendTimerState } = useStreamStore.getState();
  if (status !== "connected") return;
  const { isTracking, startTimestamp, title, projectId } = useTimerStore.getState();
  const project = useProjects.getState().projects.find((p) => p.id === projectId);
  sendTimerState(
    isTracking,
    projectId ?? "",
    project?.name ?? "",
    project?.color ?? "",
    title,
    startTimestamp ?? ""
  );
}

export function useBackgroundServices() {
  useEffect(() => {
    if (process.env.EXPO_OS !== "ios") return;
    const { start, stop } = useStreamStore.getState();
    start();
    startIdleHandler();
    startJournalTracker();

    const unsubTimer = useTimerStore.subscribe(() => pushTimerState());
    const unsubStream = useStreamStore.subscribe((state, prev) => {
      if (state.status === "connected" && prev.status !== "connected") {
        pushTimerState();
      }
    });

    return () => {
      unsubTimer();
      unsubStream();
      stopIdleHandler();
      stopJournalTracker();
      stop();
    };
  }, []);
}
