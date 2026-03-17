import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { addUserInteractionListener } from 'expo-widgets';
import { useTimerStore } from '@/stores/timer-store';
import { useSessionsStore } from '@/stores/sessions-store';
import { suggestProjectByTime } from '@/lib/time-suggestion';

export function useWidgetInteraction() {
  const router = useRouter();

  useEffect(() => {
    if (Platform.OS !== 'ios') return;

    const subscription = addUserInteractionListener((event) => {
      if (event.source !== 'FocusTimeWidget') return;

      const { isTracking, stopTimer } = useTimerStore.getState();
      const { sessions, addSession } = useSessionsStore.getState();

      if (isTracking) {
        const session = stopTimer();
        if (session) {
          addSession({ id: Date.now().toString(), ...session });
        }
      } else {
        const hour = new Date().getHours();
        const suggestedId = suggestProjectByTime(sessions, hour);
        const path = suggestedId
          ? (`/timer?suggestProjectId=${suggestedId}` as const)
          : '/timer';
        router.push(path as any);
      }
    });

    return () => subscription.remove();
  }, [router]);
}
