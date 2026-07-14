import { useSessionsStore } from "@/features/sessions/sessions-store";
import { useTimerStore } from "@/features/timer/timer-store";
import { getAppsForWindow } from "@/features/intelligence/journal-store";
import { router } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";

export default function StopScreen() {
  useEffect(() => {
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
    router.replace("/");
  }, []);

  return <View />;
}
