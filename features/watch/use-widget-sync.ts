import ActivityController from "@/modules/activity-controller";
import { syncTimelineData, syncWidgetData } from "@/storage/widget-storage";
import { useCalendarStore } from "@/features/calendar/calendar-store";
import { useProjects } from "@/features/projects/projects-store";
import { useSessionsStore } from "@/features/sessions/sessions-store";
import { useTimerStore } from "@/features/timer/timer-store";
import { useEffect, useRef } from "react";

export function useWidgetSync() {
  const wasTrackingRef = useRef(false);

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

      // ── Live Activity ─────────────────────────────────────────────
      if (process.env.EXPO_OS === "ios") {
        const wasTracking = wasTrackingRef.current;
        wasTrackingRef.current = isTracking;

        if (isTracking && !wasTracking && startTimestamp) {
          ActivityController.startActivity({
            title,
            projectName: currentProject?.name ?? "",
            projectIcon: currentProject?.icon ?? "",
            projectColor: currentProject?.color ?? "",
            startTimestamp,
          }).catch(() => {});
        } else if (isTracking && wasTracking) {
          ActivityController.updateActivity({
            title,
            projectName: currentProject?.name ?? "",
            projectIcon: currentProject?.icon ?? "",
            projectColor: currentProject?.color ?? "",
          }).catch(() => {});
        } else if (!isTracking && wasTracking) {
          ActivityController.endActivity().catch(() => {});
        }
      }
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
