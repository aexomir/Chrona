import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useSessionsStore } from '@/stores/sessions-store';
import { useTimerStore } from '@/stores/timer-store';
import { useProjects } from '@/stores/projects-store';
import { useSettingsStore } from '@/stores/settings-store';
import { computeStreak, getTotalSeconds } from '@/lib/stats-utils';
import { suggestProjectByTime } from '@/lib/time-suggestion';

export function useWidgetSync() {
  const sessions = useSessionsStore((s) => s.sessions);
  const isTracking = useTimerStore((s) => s.isTracking);
  const startTimestamp = useTimerStore((s) => s.startTimestamp);
  const projectId = useTimerStore((s) => s.projectId);
  const projects = useProjects((s) => s.projects);
  const dailyGoalMinutes = useSettingsStore((s) => s.dailyGoalMinutes);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;

    const sync = () => {
      const today = new Date();
      const startOfDay = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
      ).getTime();
      const todaySessions = sessions.filter(
        (s) => new Date(s.startTime).getTime() >= startOfDay
      );
      const todayMinutes = Math.round(getTotalSeconds(todaySessions) / 60);
      const streak = computeStreak(sessions);

      const elapsedMinutes =
        isTracking && startTimestamp
          ? Math.floor((Date.now() - new Date(startTimestamp).getTime()) / 60000)
          : 0;

      let suggestedProjectName = '';
      let suggestedProjectId = '';

      if (isTracking && projectId) {
        const project = projects.find((p) => p.id === projectId);
        suggestedProjectName = project?.name ?? '';
        suggestedProjectId = projectId;
      } else if (!isTracking) {
        const hour = today.getHours();
        const suggested = suggestProjectByTime(sessions, hour);
        if (suggested) {
          const project = projects.find((p) => p.id === suggested);
          suggestedProjectName = project?.name ?? '';
          suggestedProjectId = suggested;
        }
      }

      import('@/widgets/FocusTimeWidget').then((mod) => {
        mod.default.updateSnapshot({
          todayMinutes,
          streakDays: streak.current,
          isTracking,
          elapsedMinutes,
          suggestedProjectName,
          suggestedProjectId,
        });
      });

      import('@/widgets/StreakWidget').then((mod) => {
        mod.default.updateSnapshot({ streakDays: streak.current });
      });

      import('@/widgets/GoalProgressWidget').then((mod) => {
        mod.default.updateSnapshot({ todayMinutes, goalMinutes: dailyGoalMinutes });
      });
    };

    sync();

    if (isTracking) {
      intervalRef.current = setInterval(sync, 5 * 60 * 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [sessions, isTracking, startTimestamp, projectId, projects, dailyGoalMinutes]);
}
