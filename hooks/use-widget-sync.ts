import { syncTimelineData, syncWidgetData } from "@/storage/widget-storage";
import { useCalendarStore } from "@/stores/calendar-store";
import { useProjects } from "@/stores/projects-store";
import { useSessionsStore } from "@/stores/sessions-store";
import { useTimerStore } from "@/stores/timer-store";
import { useEffect } from "react";

export function useWidgetSync() {
  useEffect(() => {
    const sync = () => {
      const { sessions } = useSessionsStore.getState();
      const { isTracking, startTimestamp, title, projectId } =
        useTimerStore.getState();
      const { projects } = useProjects.getState();
      const { events, permissionStatus, isEnabled } =
        useCalendarStore.getState();

      const calendarGranted = isEnabled && permissionStatus === "granted";

      // ── Focus widget ──────────────────────────────────────────────
      let resolvedProjectId = isTracking ? projectId : null;
      if (!resolvedProjectId) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const lastToday = sessions.find(
          (s) => new Date(s.startTime) >= today && s.projectId,
        );
        resolvedProjectId = lastToday?.projectId ?? null;
      }
      const project = resolvedProjectId
        ? (projects.find((p) => p.id === resolvedProjectId) ?? null)
        : null;

      const currentProject =
        isTracking && projectId
          ? (projects.find((p) => p.id === projectId) ?? null)
          : null;

      syncWidgetData(sessions, isTracking, startTimestamp, title, project);
      syncTimelineData(
        sessions,
        projects,
        isTracking,
        startTimestamp,
        title,
        currentProject,
      );
    };

    sync();

    const unsubSessions = useSessionsStore.subscribe(sync);
    const unsubTimer = useTimerStore.subscribe(sync);
    const unsubProjects = useProjects.subscribe(sync);
    const unsubCalendar = useCalendarStore.subscribe(sync);

    return () => {
      unsubSessions();
      unsubTimer();
      unsubProjects();
      unsubCalendar();
    };
  }, []);
}
