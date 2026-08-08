import { useSessionsStore } from "@/features/sessions/sessions-store";
import { useTimerStore } from "@/features/timer/timer-store";
import { getAppsForWindow } from "@/features/intelligence/journal-store";
import { captureError } from "@/lib/sentry";
import { router, type Href } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";

export default function StopScreen() {
  useEffect(() => {
    try {
      const session = useTimerStore.getState().stopTimer();
      if (session) {
        const startMs = new Date(session.startTime).getTime();
        const endMs = new Date(session.endTime).getTime();
        const apps = getAppsForWindow(startMs, endMs);
        useSessionsStore.getState().addSession({
          id: Date.now().toString(),
          ...session,
          ...(apps.length > 0 ? { apps } : {}),
        });
      }
    } catch (error) {
      captureError(error, "stop_screen");
    }
    router.replace("/" as Href);
  }, []);

  return <View />;
}
