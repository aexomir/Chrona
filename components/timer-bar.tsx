import { detectMissedCalendarEvent } from "@/lib/detectMissedCalendarEvent";
import { detectMissedTime } from "@/lib/detectMissedTime";
import { useCalendarStore } from "@/stores/calendar-store";
import { useProjects } from "@/stores/projects-store";
import { useRecoveryStore } from "@/stores/recovery-store";
import { useSessionsStore } from "@/stores/sessions-store";
import { useSuggestionsStore } from "@/stores/suggestions-store";
import { useTimerStore } from "@/stores/timer-store";
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
    permissionStatus,
    events: calendarEvents,
    mappings,
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
        Math.floor((Date.now() - new Date(startTimestamp).getTime()) / 1000),
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isTracking, startTimestamp]);

  // Detection effect: run both AW and calendar detection sequentially when not tracking
  useEffect(() => {
    if (isTracking) {
      hasDetectedRef.current = false;
      return;
    }
    // Reset detection flag when sessions change so we re-validate pending recovery
    // If a new session was logged, detection will re-run and find no gap
    hasDetectedRef.current = false;
  }, [isTracking, sessions]);

  // Validate pending recovery against current sessions
  // If a newly logged session overlaps with the pending period, clear it
  useEffect(() => {
    if (!pending) return;

    const pendingStart = new Date(pending.startTime);
    const pendingEnd = new Date(pending.endTime);

    // Check if any session overlaps with the pending period
    const isOverlapped = sessions.some((s) => {
      const sStart = new Date(s.startTime);
      const sEnd = new Date(s.endTime);
      return sStart < pendingEnd && sEnd > pendingStart;
    });

    if (isOverlapped) {
      setRecovery(null as any); // Clear pending
    }
  }, [sessions, pending, setRecovery]);

  // Separate effect for running detection when conditions are met
  useEffect(() => {
    if (isTracking || hasDetectedRef.current || pending) return;

    hasDetectedRef.current = true;
    (async () => {
      // Pass 1: AW gap-based detection
      const awResult = await detectMissedTime(sessions, suggestProject);
      if (awResult) {
        setRecovery(awResult);
        return;
      }

      // Pass 2: calendar-based detection (only if calendar enabled + granted)
      if (!calendarEnabled || permissionStatus !== "granted") return;
      const calResult = await detectMissedCalendarEvent(
        calendarEvents,
        mappings,
        sessions,
      );
      if (calResult) {
        setRecovery(calResult);
      }
    })();
  }, [
    isTracking,
    sessions,
    suggestProject,
    pending,
    setRecovery,
    calendarEnabled,
    permissionStatus,
    calendarEvents,
    mappings,
  ]);

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

    const interval = setInterval(
      () => {
        fetchCalendarEvents();
      },
      5 * 60 * 1000,
    ); // 5 minutes

    return () => clearInterval(interval);
  }, [calendarEnabled, isTracking, fetchCalendarEvents]);

  const calendarProj = calendarSuggestion
    ? projects.find((p) => p.id === calendarSuggestion.projectId)
    : null;

  return (
    <Pressable
      style={styles.container}
      onPress={() => {
        if (pending) {
          router.push("/recover");
        } else if (calendarSuggestion && calendarProj) {
          router.push(
            `/timer?suggestProjectId=${calendarSuggestion.projectId}&suggestEventTitle=${encodeURIComponent(calendarSuggestion.eventTitle)}`,
          );
        } else {
          router.push("/timer");
        }
      }}
    >
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
        pending.source === "calendar" ? (
          <View className="flex-row items-center justify-center gap-2">
            <View className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <Text className="text-amber-400 text-sm" numberOfLines={1}>
              {pending.eventTitle} · Tap to log
            </Text>
          </View>
        ) : (
          <View className="flex-row items-center justify-center gap-2">
            <View className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <Text className="text-amber-400 text-sm">
              Activity not tracked · Tap to review
            </Text>
          </View>
        )
      ) : calendarSuggestion ? (
        <View className="flex-row items-center justify-center gap-1.5">
          <Text className="text-white/50 text-sm shrink-0">Suggested:</Text>
          <View
            className="w-1 h-1 rounded-full shrink-0"
            style={{ backgroundColor: calendarProj?.color || "#888" }}
          />
          <Text className="text-white text-sm shrink" numberOfLines={1}>
            {calendarSuggestion.eventTitle}
          </Text>
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              setCalendarSuggestion(null);
            }}
            hitSlop={8}
          >
            <Text className="text-white/50 text-sm font-semibold">×</Text>
          </Pressable>
        </View>
      ) : (
        <Text className="text-white/50 text-sm text-center">
          Tap to start a timer
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  icon: {
    width: 13,
    height: 13,
  },
});
