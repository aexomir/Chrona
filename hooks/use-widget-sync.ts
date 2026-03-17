import { useEffect } from 'react';
import { useSessionsStore } from '@/stores/sessions-store';
import { computeStreak, getTotalSeconds } from '@/lib/stats-utils';
import { Platform } from 'react-native';

export function useWidgetSync() {
  const sessions = useSessionsStore((s) => s.sessions);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;

    // Compute today's total focus minutes
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const todaySessions = sessions.filter(
      (s) => new Date(s.startTime).getTime() >= startOfDay
    );
    const todayMinutes = Math.round(getTotalSeconds(todaySessions) / 60);

    // Compute current streak
    const streak = computeStreak(sessions);

    import('@/widgets/FocusTimeWidget').then((mod) => {
      mod.default.updateSnapshot({ todayMinutes, streakDays: streak.current });
    });
  }, [sessions]);
}
