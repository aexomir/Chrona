import { useProjects } from "@/features/projects/projects-store";
import { useSessionsStore } from "@/features/sessions/sessions-store";
import { useTimerStore } from "@/features/timer/timer-store";
import { endActivity, startActivity, updateActivity } from "@/features/widgets/live-activity";
import { syncTimelineData, syncWidgetData } from "@/features/widgets/widget-sync";
import { useEffect, useRef } from "react";

export function useWidgetSync() {
  const wasTrackingRef = useRef(false);

  useEffect(() => {
    const sync = () => {
      const { sessions } = useSessionsStore.getState();
      const { isTracking, startTimestamp, title, projectId } =
        useTimerStore.getState();
      const { projects } = useProjects.getState();

      // ── Chrona widget ─────────────────────────────────────────────
      const projectById = new Map(projects.map((p) => [p.id, p]));

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
        ? (projectById.get(resolvedProjectId) ?? null)
        : null;

      const currentProject =
        isTracking && projectId
          ? (projectById.get(projectId) ?? null)
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
          startActivity({
            startDate: startTimestamp,
            title,
            projectName: currentProject?.name ?? "",
            projectIcon: currentProject?.icon ?? "",
            projectColor: currentProject?.color ?? "",
          }).catch(() => {});
        } else if (isTracking && wasTracking && startTimestamp) {
          updateActivity({
            startDate: startTimestamp,
            title,
            projectName: currentProject?.name ?? "",
            projectIcon: currentProject?.icon ?? "",
            projectColor: currentProject?.color ?? "",
          }).catch(() => {});
        } else if (!isTracking && wasTracking) {
          endActivity().catch(() => {});
        }
      }
    };

    sync();

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedSync = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(sync, 300);
    };

    const unsubSessions = useSessionsStore.subscribe(debouncedSync);
    const unsubTimer = useTimerStore.subscribe(debouncedSync);
    const unsubProjects = useProjects.subscribe(debouncedSync);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      unsubSessions();
      unsubTimer();
      unsubProjects();
    };
  }, []);
}
