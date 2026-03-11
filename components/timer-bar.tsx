import { useTimerStore } from "@/stores/timer-store";
import { useProjects } from "@/stores/projects-store";
import { useSessionsStore } from "@/stores/sessions-store";
import { useSuggestionsStore } from "@/stores/suggestions-store";
import { useRecoveryStore } from "@/stores/recovery-store";
import { useCalendarStore } from "@/stores/calendar-store";
import { detectMissedTime } from "@/lib/detectMissedTime";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function TimerBar() {
  const { isTracking, title, projectId, startTimestamp } = useTimerStore();
  const { projects } = useProjects();
  const { sessions } = useSessionsStore();
  const { suggestProject } = useSuggestionsStore();
  const { pending, set: setRecovery } = useRecoveryStore();
  const {
    isEnabled: calendarEnabled,
    getActiveEventSuggestion,
    fetchEvents: fetchCalendarEvents,
  } = useCalendarStore();
  const project = projects.find((p) => p.id === projectId) ?? null;
  const [elapsed, setElapsed] = useState(0);
  const [calendarSuggestion, setCalendarSuggestion] = useState<{
    eventTitle: string;
    projectId: string;
  } | null>(null);
  const hasDetectedRef = useRef(false);
  const hasCheckCalendarRef = useRef(false);

  useEffect(() => {
    if (!isTracking || !startTimestamp) {
      setElapsed(0);
      return;
    }
    const tick = () =>
      setElapsed(
        Math.floor((Date.now() - new Date(startTimestamp).getTime()) / 1000)
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isTracking, startTimestamp]);

  // Detection effect: run when not tracking
  useEffect(() => {
    if (isTracking) {
      hasDetectedRef.current = false;
      return;
    }
    if (hasDetectedRef.current || pending) return;

    hasDetectedRef.current = true;
    detectMissedTime(sessions, suggestProject).then((result) => {
      if (result) {
        setRecovery(result);
      }
    });
  }, [isTracking, sessions, suggestProject, pending, setRecovery]);

  // Calendar event suggestion effect: check when not tracking
  useEffect(() => {
    if (isTracking || pending || !calendarEnabled) {
      hasCheckCalendarRef.current = false;
      setCalendarSuggestion(null);
      return;
    }
    if (hasCheckCalendarRef.current) return;

    hasCheckCalendarRef.current = true;
    const suggestion = getActiveEventSuggestion();
    if (suggestion) {
      setCalendarSuggestion({
        eventTitle: suggestion.event.title,
        projectId: suggestion.projectId,
      });
    }
  }, [isTracking, pending, calendarEnabled, getActiveEventSuggestion]);

  // Periodic calendar refresh: refresh events every 5 minutes when idle
  useEffect(() => {
    if (!calendarEnabled || isTracking) return;

    const interval = setInterval(() => {
      fetchCalendarEvents();
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [calendarEnabled, isTracking, fetchCalendarEvents]);

  const calendarProj = calendarSuggestion
    ? projects.find((p) => p.id === calendarSuggestion.projectId)
    : null;

  return (
    <Pressable
      onPress={() => {
        if (pending) {
          router.push("/recover");
        } else if (calendarSuggestion && calendarProj) {
          router.push(`/timer?suggestProjectId=${calendarSuggestion.projectId}&suggestEventTitle=${encodeURIComponent(calendarSuggestion.eventTitle)}`);
        } else {
          router.push("/timer");
        }
      }}
    >
      <BlurView intensity={60} tint="dark" style={styles.blur}>
        {isTracking ? (
          <View className="flex-row items-center justify-center gap-2">
            {project ? (
              <Image
                source={`sf:${project.icon}`}
                style={[styles.icon, { tintColor: project.color }]}
              />
            ) : (
              <View className="w-2 h-2 rounded-full bg-red-500" />
            )}
            <Text className="text-white text-sm shrink" numberOfLines={1}>
              {title}
            </Text>
            {project && (
              <Text
                className="text-neutral-500 text-sm shrink-0"
                numberOfLines={1}
              >
                {project.name}
              </Text>
            )}
            <Text className="text-white text-sm font-mono font-semibold shrink-0">
              {formatTime(elapsed)}
            </Text>
          </View>
        ) : pending ? (
          <View className="flex-row items-center justify-center gap-2">
            <View className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <Text className="text-amber-400 text-sm">
              Activity not tracked · Tap to review
            </Text>
          </View>
        ) : calendarSuggestion ? (
          <View className="flex-row items-center justify-center gap-1.5">
            <Text className="text-white/50 text-sm shrink-0">suggested:</Text>
            <View
              className="w-1 h-1 rounded-full shrink-0"
              style={{ backgroundColor: calendarProj?.color || "#888" }}
            />
            <Text className="text-white text-sm shrink" numberOfLines={1}>
              {calendarSuggestion.eventTitle}
            </Text>
          </View>
        ) : (
          <Text className="text-white/50 text-sm text-center">
            Tap to start a timer
          </Text>
        )}
      </BlurView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  blur: {
    borderTopWidth: 0.5,
    borderTopColor: "rgba(255,255,255,0.12)",
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "rgba(18,18,20,0.55)",
  },
  icon: {
    width: 13,
    height: 13,
  },
});
