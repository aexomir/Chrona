import { suggestProjectByTime } from "@/lib/time-suggestion";
import { useSessionsStore } from "@/stores/sessions-store";
import { useTimerStore } from "@/stores/timer-store";
import { useRouter } from "expo-router";
import { addUserInteractionListener } from "expo-widgets";
import { useEffect } from "react";
import { Platform } from "react-native";

export function useWidgetInteraction() {
  const router = useRouter();

  useEffect(() => {
    if (Platform.OS !== "ios") return;

    const subscription = addUserInteractionListener((event) => {
      if (event.source !== "FocusTimeWidget") return;

      const { isTracking, stopTimer } = useTimerStore.getState();
      const { sessions, addSession } = useSessionsStore.getState();

      // If tracking, stop and save the session
      if (isTracking) {
        const session = stopTimer();
        if (session) {
          addSession({ id: Date.now().toString(), ...session });
        }
        return;
      }

      if (event.target === "start-suggested") {
        const hour = new Date().getHours();
        const suggestedId = suggestProjectByTime(sessions, hour);
        if (suggestedId) {
          router.push(`/timer?suggestProjectId=${suggestedId}` as any);
        }
      } else if (event.target === "start-manual") {
        router.push("/timer" as any);
      }
    });

    return () => subscription.remove();
  }, [router]);
}
