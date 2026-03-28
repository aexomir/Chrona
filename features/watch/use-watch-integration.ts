import { useProjects } from "@/features/projects/projects-store";
import { useSessionsStore } from "@/features/sessions/sessions-store";
import { useTimerStore } from "@/features/timer/timer-store";
import { useSyncWatch, useWatchMessages } from "@/features/watch/use-watch";
import { getAppsForWindow, markTimerStart } from "@/features/intelligence/journal-store";
import { useEffect } from "react";

export function useWatchIntegration() {
  const syncWatch = useSyncWatch();

  useWatchMessages(
    () => {
      const { isTracking, startTimer } = useTimerStore.getState();
      if (!isTracking) { markTimerStart(); startTimer("Watch Session"); }
    },
    () => {
      const { stopTimer } = useTimerStore.getState();
      const { addSession } = useSessionsStore.getState();
      const result = stopTimer();
      if (result) {
        const startMs = new Date(result.startTime).getTime();
        const endMs = new Date(result.endTime).getTime();
        const apps = getAppsForWindow(startMs, endMs);
        addSession({
          id: Date.now().toString(),
          title: result.title || "Watch Session",
          projectId: result.projectId,
          startTime: result.startTime,
          endTime: result.endTime,
          duration: result.duration,
          ...(apps.length > 0 ? { apps } : {}),
        });
      }
    },
    (projectId) => {
      const { isTracking, startTimer } = useTimerStore.getState();
      if (!isTracking) { markTimerStart(); startTimer("", projectId); }
    },
    (title) => {
      const { isTracking, updateTitle } = useTimerStore.getState();
      if (isTracking) updateTitle(title);
    },
  );

  useEffect(() => {
    if (process.env.EXPO_OS !== "ios") return;

    const sync = () => {
      const { isTracking, startTimestamp, title, projectId } = useTimerStore.getState();
      const { sessions } = useSessionsStore.getState();
      const { projects } = useProjects.getState();

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todaySessions = sessions.filter((s) => new Date(s.startTime) >= today);
      const todaySeconds = todaySessions.reduce((sum, s) => sum + s.duration, 0);
      const currentProject = projectId ? (projects.find((p) => p.id === projectId) ?? null) : null;
      const projectById = new Map(projects.map((p) => [p.id, p]));

      syncWatch({
        isTracking,
        title: title || "",
        projectName: currentProject?.name ?? "",
        projectColor: currentProject?.color ?? "",
        startTimestamp: isTracking && startTimestamp ? startTimestamp : "",
        todayMinutes: Math.floor(todaySeconds / 60),
        todaySessions: todaySessions.length,
        recentProjects: JSON.stringify(
          projects.slice(0, 6).map((p) => ({ id: p.id, name: p.name, color: p.color, icon: p.icon })),
        ),
        recentSessions: JSON.stringify(
          todaySessions.slice(0, 8).map((s) => {
            const project = s.projectId ? projectById.get(s.projectId) : undefined;
            return {
              id: s.id,
              title: s.title || "",
              projectName: project?.name ?? "",
              projectColor: project?.color ?? "",
              startTime: s.startTime,
              duration: s.duration,
            };
          }),
        ),
      });
    };

    sync();
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedSync = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(sync, 300);
    };
    const unsubTimer = useTimerStore.subscribe(debouncedSync);
    const unsubSessions = useSessionsStore.subscribe(debouncedSync);
    const unsubProjects = useProjects.subscribe(debouncedSync);
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      unsubTimer();
      unsubSessions();
      unsubProjects();
    };
  }, [syncWatch]);
}
