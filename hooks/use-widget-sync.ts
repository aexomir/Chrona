import { syncWidgetData } from "@/storage/widget-storage";
import { useSessionsStore } from "@/stores/sessions-store";
import { useTimerStore } from "@/stores/timer-store";
import { useProjects } from "@/stores/projects-store";
import { useEffect } from "react";

export function useWidgetSync() {
  useEffect(() => {
    const sync = () => {
      const { sessions } = useSessionsStore.getState();
      const { isTracking, startTimestamp, title, projectId } =
        useTimerStore.getState();
      const { projects } = useProjects.getState();

      // Use the active project, or fall back to the most recent session's project today
      let resolvedProjectId = projectId;
      if (!isTracking || !resolvedProjectId) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const lastToday = sessions.find(
          (s) => new Date(s.startTime) >= today && s.projectId
        );
        resolvedProjectId = lastToday?.projectId ?? null;
      }

      const project = resolvedProjectId
        ? (projects.find((p) => p.id === resolvedProjectId) ?? null)
        : null;

      syncWidgetData(sessions, isTracking, startTimestamp, title, project);
    };

    sync();

    const unsubSessions = useSessionsStore.subscribe(sync);
    const unsubTimer = useTimerStore.subscribe(sync);
    const unsubProjects = useProjects.subscribe(sync);

    return () => {
      unsubSessions();
      unsubTimer();
      unsubProjects();
    };
  }, []);
}
