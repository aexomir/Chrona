import {
  drainPendingUsage,
  usePendingUsageStore,
} from "@/features/intelligence/pending-usage-store";
import { useSessionsStore } from "@/features/sessions/sessions-store";
import { useTimerStore } from "@/features/timer/timer-store";
import { captureError } from "@/lib/sentry";
import { router, type Href } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";

export default function StopScreen() {
  useEffect(() => {
    try {
      const session = useTimerStore.getState().stopTimer();
      if (session) {
        // Deep-link / widget entry point: there is no UI to wait in, so save
        // immediately and let the reconnect drain attach the app breakdown.
        const id = Date.now().toString();
        useSessionsStore.getState().addSession({ id, ...session });
        usePendingUsageStore
          .getState()
          .enqueue(
            id,
            new Date(session.startTime).getTime(),
            new Date(session.endTime).getTime(),
          );
        // Usually the Mac is right there — patch immediately rather than
        // waiting for the next reconnect. No-ops if it isn't.
        void drainPendingUsage();
      }
    } catch (error) {
      captureError(error, "stop_screen");
    }
    router.replace("/" as Href);
  }, []);

  return <View />;
}
