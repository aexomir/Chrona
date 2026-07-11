import {
  CALENDAR_REFRESH_INTERVAL_MS,
  useCalendarStore,
} from "@/features/calendar/calendar-store";
import { useProjects } from "@/features/projects/projects-store";
import { useTimerStore } from "@/features/timer/timer-store";
import { Neutral } from "@/constants/theme";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

const INTERRUPTED_SESSION_TTL_MS = 30 * 60 * 1000;

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
  const isTracking = useTimerStore(s => s.isTracking);
  const title = useTimerStore(s => s.title);
  const projectId = useTimerStore(s => s.projectId);
  const startTimestamp = useTimerStore(s => s.startTimestamp);
  const startTimer = useTimerStore(s => s.startTimer);
  const interruptedSession = useTimerStore(s => s.interruptedSession);
  const setInterruptedSession = useTimerStore(s => s.setInterruptedSession);
  const calendarEnabled = useCalendarStore(s => s.isEnabled);
  const getActiveEventSuggestion = useCalendarStore(s => s.getActiveEventSuggestion);
  const fetchCalendarEvents = useCalendarStore(s => s.fetchEvents);
  const project = useProjects(s => projectId ? s.projects.find(p => p.id === projectId) ?? null : null);
  const projects = useProjects(s => s.projects);
  const [elapsed, setElapsed] = useState(0);
  const [calendarSuggestion, setCalendarSuggestion] = useState<{
    eventTitle: string;
    projectId: string;
  } | null>(null);
  const hasCheckCalendarRef = useRef(false);

  // Elapsed timer
  useEffect(() => {
    const source = isTracking ? startTimestamp : null;
    if (!source) {
      setElapsed(0);
      return;
    }
    const tick = () => {
      const e = Math.floor((Date.now() - new Date(source).getTime()) / 1000);
      setElapsed(e);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isTracking, startTimestamp]);

  // Calendar event suggestion: check when not tracking
  useEffect(() => {
    if (isTracking || !calendarEnabled) {
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
  }, [isTracking, calendarEnabled, getActiveEventSuggestion]);

  // Periodic calendar refresh every 5 minutes when idle
  useEffect(() => {
    if (!calendarEnabled || isTracking) return;
    const interval = setInterval(() => {
      fetchCalendarEvents();
    }, CALENDAR_REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [calendarEnabled, isTracking, fetchCalendarEvents]);

  const calendarProj = calendarSuggestion
    ? projects.find((p) => p.id === calendarSuggestion.projectId)
    : null;

  const resumableSession =
    !isTracking &&
    interruptedSession !== null &&
    Date.now() - new Date(interruptedSession.interruptedAt).getTime() < INTERRUPTED_SESSION_TTL_MS
      ? interruptedSession
      : null;

  const resumableProject = resumableSession
    ? projects.find(p => p.id === resumableSession.projectId) ?? null
    : null;

  function handleResumeSession() {
    if (!resumableSession) return;
    startTimer(resumableSession.title, resumableSession.projectId, resumableSession.elapsedSeconds);
  }

  return (
    <Pressable
      style={styles.container}
      onPress={() => {
        if (isTracking) {
          router.push("/timer");
          return;
        }
        if (calendarSuggestion && calendarProj) {
          router.push(
            `/timer?suggestProjectId=${calendarSuggestion.projectId}&suggestEventTitle=${encodeURIComponent(calendarSuggestion.eventTitle)}`,
          );
        } else {
          router.push("/timer");
        }
      }}
    >
      {isTracking ? (
        // Manual tracking state
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
      ) : resumableSession ? (
        // Interrupted session resume prompt
        <View className="flex-row items-center justify-center gap-1.5">
          <Text className="text-white/50 text-sm shrink-0">Resume</Text>
          <View
            className="w-1 h-1 rounded-full shrink-0"
            style={{ backgroundColor: resumableProject?.color ?? Neutral.z600 }}
          />
          <Text className="text-white text-sm shrink" numberOfLines={1}>
            {resumableSession.title}
          </Text>
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              handleResumeSession();
            }}
            hitSlop={8}
          >
            <View className="px-2 py-0.5 rounded-md" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
              <Text className="text-white/70 text-xs font-medium">Resume</Text>
            </View>
          </Pressable>
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              setInterruptedSession(null);
            }}
            hitSlop={8}
          >
            <Text className="text-white/50 text-sm font-semibold">×</Text>
          </Pressable>
        </View>
      ) : calendarSuggestion ? (
        // Calendar suggestion state
        <View className="flex-row items-center justify-center gap-1.5">
          <Text className="text-white/50 text-sm shrink-0">Suggested:</Text>
          <View
            className="w-1 h-1 rounded-full shrink-0"
            style={{ backgroundColor: calendarProj?.color ?? Neutral.z600 }}
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
        // Idle state
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
