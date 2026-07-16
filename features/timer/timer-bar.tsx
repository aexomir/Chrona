import { Neutral } from "@/constants/theme";
import {
  CALENDAR_REFRESH_INTERVAL_MS,
  useCalendarStore,
} from "@/features/calendar/calendar-store";
import { usePendingReviewStore } from "@/features/auto-track/pending-review-store";
import { useUntrackedStore } from "@/features/auto-track/untracked-store";
import { getAppsForWindow } from "@/features/intelligence/journal-store";
import { useProjects } from "@/features/projects/projects-store";
import { useSessionsStore } from "@/features/sessions/sessions-store";
import { useTimerStore } from "@/features/timer/timer-store";
import { formatTime } from "@/features/timer/timer-utils";
import { trackEvent } from "@/lib/sentry";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";

const INTERRUPTED_SESSION_TTL_MS = 30 * 60 * 1000;

export function TimerBar() {
  const isTracking = useTimerStore(s => s.isTracking);
  const isAutoTracked = useTimerStore(s => s.isAutoTracked);
  const title = useTimerStore(s => s.title);
  const projectId = useTimerStore(s => s.projectId);
  const startTimestamp = useTimerStore(s => s.startTimestamp);
  const stopTimer = useTimerStore(s => s.stopTimer);
  const startTimer = useTimerStore(s => s.startTimer);
  const interruptedSession = useTimerStore(s => s.interruptedSession);
  const setInterruptedSession = useTimerStore(s => s.setInterruptedSession);
  const addSession = useSessionsStore(s => s.addSession);
  const calendarEnabled = useCalendarStore(s => s.isEnabled);
  const getActiveEventSuggestion = useCalendarStore(s => s.getActiveEventSuggestion);
  const fetchCalendarEvents = useCalendarStore(s => s.fetchEvents);
  const project = useProjects(s => projectId ? s.projects.find(p => p.id === projectId) ?? null : null);
  const projects = useProjects(s => s.projects);
  const pendingHint = useUntrackedStore(s => s.pendingHint);
  const dismissHint = useUntrackedStore(s => s.dismissHint);
  const [elapsed, setElapsed] = useState(0);
  const [calendarSuggestion, setCalendarSuggestion] = useState<{
    eventTitle: string;
    projectId: string;
  } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const hasCheckCalendarRef = useRef(false);

  useEffect(() => {
    if (!isTracking || !startTimestamp) return;
    const tick = () => {
      const e = Math.floor((Date.now() - new Date(startTimestamp).getTime()) / 1000);
      setElapsed(e);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isTracking, startTimestamp]);

  useEffect(() => {
    if (isTracking || !calendarEnabled) {
      hasCheckCalendarRef.current = false;
      return;
    }
    if (hasCheckCalendarRef.current) return;

    hasCheckCalendarRef.current = true;
    const check = () => {
      const suggestion = getActiveEventSuggestion();
      if (suggestion) {
        setCalendarSuggestion({
          eventTitle: suggestion.event.title,
          projectId: suggestion.projectId,
        });
      }
    };
    check();
  }, [isTracking, calendarEnabled, getActiveEventSuggestion]);

  useEffect(() => {
    if (!calendarEnabled || isTracking) return;
    const interval = setInterval(() => {
      fetchCalendarEvents();
    }, CALENDAR_REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [calendarEnabled, isTracking, fetchCalendarEvents]);

  useEffect(() => {
    if (!interruptedSession || isTracking) return;
    const interval = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, [interruptedSession, isTracking]);

  // calendarEnabled/isTracking aren't reflected in cleared state (only in the
  // effect above, which skips resetting to satisfy react-hooks/set-state-in-effect)
  // so gate the display here instead — same effective behavior.
  const activeCalendarSuggestion =
    calendarEnabled && !isTracking ? calendarSuggestion : null;

  const calendarProj = activeCalendarSuggestion
    ? projects.find((p) => p.id === activeCalendarSuggestion.projectId)
    : null;

  const resumableSession =
    !isTracking &&
    interruptedSession !== null &&
    now - new Date(interruptedSession.interruptedAt).getTime() < INTERRUPTED_SESSION_TTL_MS
      ? interruptedSession
      : null;

  const resumableProject = resumableSession
    ? projects.find(p => p.id === resumableSession.projectId) ?? null
    : null;

  function handleResumeSession() {
    if (!resumableSession) return;
    startTimer(resumableSession.title, resumableSession.projectId, resumableSession.elapsedSeconds);
  }

  function handleStopAutoSession() {
    const sessionData = stopTimer();
    if (sessionData) {
      trackEvent("timer", "timer_stop", { auto: true, duration: sessionData.duration });
      const startMs = new Date(sessionData.startTime).getTime();
      const endMs = new Date(sessionData.endTime).getTime();
      const apps = getAppsForWindow(startMs, endMs);
      if (apps.length > 1) {
        usePendingReviewStore.getState().offer({ ...sessionData, apps });
        trackEvent("session", "session_save", {
          auto: true,
          duration: sessionData.duration,
          appCount: apps.length,
          queuedForReview: true,
        });
      } else {
        addSession({
          ...sessionData,
          id: Date.now().toString(),
          auto: true,
          ...(apps.length > 0 ? { apps } : {}),
        });
        trackEvent("session", "session_save", {
          auto: true,
          duration: sessionData.duration,
          appCount: apps.length,
          queuedForReview: false,
        });
      }
    }
  }

  return (
    <Pressable
      className="flex-1 justify-center items-center"
      onPress={() => {
        if (isTracking) {
          router.push("/timer");
          return;
        }
        if (activeCalendarSuggestion && calendarProj) {
          router.push(
            `/timer?suggestProjectId=${activeCalendarSuggestion.projectId}&suggestEventTitle=${encodeURIComponent(activeCalendarSuggestion.eventTitle)}`,
          );
        } else {
          router.push("/timer");
        }
      }}
    >
      {isTracking && isAutoTracked ? (
        <View className="flex-row items-center justify-center gap-2">
          {project ? (
            <Image
              source={`sf:${project.icon}`}
              style={{ width: 13, height: 13, tintColor: project.color }}
            />
          ) : (
            <View className="w-1.5 h-1.5 rounded-full bg-white/40" />
          )}
          <Text className="text-white/70 text-sm shrink" numberOfLines={1}>
            {title}
          </Text>
          <Text className="text-white text-sm font-mono shrink-0">
            {formatTime(elapsed)}
          </Text>
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              handleStopAutoSession();
            }}
            hitSlop={8}
          >
            <View className="px-2 py-0.5 rounded-md bg-white/[0.08]">
              <Text className="text-white/50 text-xs font-medium">Stop</Text>
            </View>
          </Pressable>
        </View>
      ) : isTracking ? (
        <View className="flex-row items-center justify-center gap-2">
          {project ? (
            <Image
              source={`sf:${project.icon}`}
              style={{ width: 13, height: 13, tintColor: project.color }}
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
            <View className="px-2 py-0.5 rounded-md bg-white/[0.08]">
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
      ) : activeCalendarSuggestion ? (
        <View className="flex-row items-center justify-center gap-1.5">
          <Text className="text-white/50 text-sm shrink-0">Suggested:</Text>
          <View
            className="w-1 h-1 rounded-full shrink-0"
            style={{ backgroundColor: calendarProj?.color ?? Neutral.z600 }}
          />
          <Text className="text-white text-sm shrink" numberOfLines={1}>
            {activeCalendarSuggestion.eventTitle}
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
      ) : pendingHint ? (
        <View className="flex-row items-center justify-center gap-1.5">
          <View className="w-1 h-1 rounded-full shrink-0 bg-amber-400" />
          <Text className="text-amber-400/80 text-sm shrink" numberOfLines={1}>
            {pendingHint.appName} untracked
          </Text>
          <Text className="text-amber-400/50 text-xs shrink-0">
            {formatTime(pendingHint.durationSeconds)}
          </Text>
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              dismissHint();
            }}
            hitSlop={8}
          >
            <Text className="text-amber-400/50 text-sm font-semibold">×</Text>
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
