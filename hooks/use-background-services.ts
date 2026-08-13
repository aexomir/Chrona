import { startAutoTracker, stopAutoTracker } from "@/features/auto-track/auto-tracker";
import { useUntrackedStore } from "@/features/auto-track/untracked-store";
import { startIdleHandler, stopIdleHandler } from "@/features/idle/idle-handler";
import { startAppCatalog, stopAppCatalog } from "@/features/intelligence/app-catalog";
import { drainPendingUsage } from "@/features/intelligence/pending-usage-store";
import { useProjects } from "@/features/projects/projects-store";
import { useStreamStore } from "@/features/stream/stream-store";
import { useTimerStore } from "@/features/timer/timer-store";
import { trackEvent } from "@/lib/sentry";
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
    const { _startWatching, _stopWatching } = useUntrackedStore.getState();
    start();
    startAutoTracker();
    startIdleHandler();
    startAppCatalog();
    _startWatching();

    const unsubTimer = useTimerStore.subscribe(() => pushTimerState());
    const unsubStream = useStreamStore.subscribe((state, prev) => {
      if (state.status === prev.status) return;
      trackEvent("mac_helper", "connection_status_changed", {
        from: prev.status,
        to: state.status,
      });
      if (state.status === "connected" && prev.status !== "connected") {
        pushTimerState();
        // Sessions saved while the Mac was unreachable are still missing their
        // app breakdown; the ledger has it, so fetch it now.
        void drainPendingUsage();
      }
    });

    return () => {
      unsubTimer();
      unsubStream();
      stopAutoTracker();
      stopIdleHandler();
      stopAppCatalog();
      _stopWatching();
      stop();
    };
  }, []);
}
