import { detectMissedCalendarEvent } from "@/features/calendar/detectMissedCalendarEvent";
import { detectMissedTime } from "@/features/recovery/detectMissedTime";
import { getCurrentApp, getMeetingState, onMeetingChange } from "@/features/activity-watch/aw-adapter";
import { useCalendarStore } from "@/features/calendar/calendar-store";
import { useProjects } from "@/features/projects/projects-store";
import { useRecoveryStore } from "@/features/recovery/recovery-store";
import { useSessionsStore } from "@/features/sessions/sessions-store";
import { useSuggestionsStore } from "@/features/activity-watch/suggestions-store";
import { useSettingsStore } from "@/features/settings/settings-store";
import { useTimerStore } from "@/features/timer/timer-store";
import { useTrackingRulesStore } from "@/features/tracking-rules/tracking-rules-store";
import { useAutoTrackingStore } from "@/features/activity-watch/auto-tracking-store";
import { Neutral } from "@/constants/theme";
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
  const { sessions, addSession } = useSessionsStore();
  const { suggestProject, learnFromSession } = useSuggestionsStore();
  const { autoTrackingEnabled } = useSettingsStore();
  const { period: recoveryPeriod, set: setRecovery, clear: clearRecovery, isDismissed } = useRecoveryStore();
  const {
    isEnabled: calendarEnabled,
    permissionStatus,
    events: calendarEvents,
    mappings,
    getActiveEventSuggestion,
    fetchEvents: fetchCalendarEvents,
  } = useCalendarStore();
  const { rules, matchRule, addRule } = useTrackingRulesStore();
  const {
    isAutoTracking,
    autoStartTimestamp,
    detectedApp,
    detectedTitle,
    matchedRuleId,
    consecutiveOfflineCount,
    startAutoTracking,
    stopAutoTracking,
    setDetectedApp,
    incrementOfflineCount,
    resetOfflineCount,
  } = useAutoTrackingStore();
  const project = projects.find((p) => p.id === projectId) ?? null;
  const [elapsed, setElapsed] = useState(0);
  const [autoElapsed, setAutoElapsed] = useState(0);
  const [calendarSuggestion, setCalendarSuggestion] = useState<{
    eventTitle: string;
    projectId: string;
  } | null>(null);
  const [activeMeeting, setActiveMeeting] = useState(getMeetingState);
  const [untrackedApp, setUntrackedApp] = useState<string | null>(null);
  const [untrackedTitle, setUntrackedTitle] = useState<string | null>(null);
  const [untrackedDismissed, setUntrackedDismissed] = useState(false);
  const [ruleCreationOffer, setRuleCreationOffer] = useState<{
    app: string;
    projectId: string;
  } | null>(null);
  const hasDetectedRef = useRef(false);
  const hasCheckCalendarRef = useRef(false);
  const prevIsTrackingRef = useRef(isTracking);
  const prevSessionsRef = useRef(sessions);
  const isAutoTrackingRef = useRef(isAutoTracking);
  const matchedRuleIdRef = useRef(matchedRuleId);
  const consecutiveOfflineCountRef = useRef(consecutiveOfflineCount);
  const untrackedDismissedRef = useRef(untrackedDismissed);

  // Sync refs (read inside effects)
  isAutoTrackingRef.current = isAutoTracking;
  matchedRuleIdRef.current = matchedRuleId;
  consecutiveOfflineCountRef.current = consecutiveOfflineCount;
  untrackedDismissedRef.current = untrackedDismissed;

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

  // Auto-elapsed effect: update when auto-tracking
  useEffect(() => {
    if (!isAutoTracking || !autoStartTimestamp) {
      setAutoElapsed(0);
      return;
    }
    const tick = () =>
      setAutoElapsed(
        Math.floor((Date.now() - new Date(autoStartTimestamp).getTime()) / 1000),
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isAutoTracking, autoStartTimestamp]);

  // saveAutoSession helper: save and reset auto-tracking state
  const saveAutoSession = () => {
    const session = stopAutoTracking();
    if (!session || session.duration < 60) return; // Discard sessions < 60s
    const rule = rules.find((r) => r.id === session.ruleId);
    if (!rule) return;
    addSession({
      id: Date.now().toString(),
      title: rule.defaultTitle || session.app,
      projectId: rule.projectId,
      startTime: session.startTime,
      endTime: session.endTime,
      duration: session.duration,
      auto: true,
    });
    learnFromSession([{ app: session.app, duration: session.duration }], rule.projectId);
  };

  // Reset untracked hint when tracking starts or sessions change
  useEffect(() => {
    if (isTracking) {
      setUntrackedDismissed(false);
      setUntrackedApp(null);
    }
  }, [isTracking, sessions]);

  // Offer to create rule after manual session is logged
  useEffect(() => {
    if (isTracking || sessions.length === 0 || !autoTrackingEnabled) {
      setRuleCreationOffer(null);
      return;
    }

    const lastSession = sessions[0];
    // Only offer for manual sessions (not auto-tracked)
    if (lastSession.auto) {
      setRuleCreationOffer(null);
      return;
    }

    (async () => {
      const current = await getCurrentApp();
      if (!current || !lastSession.projectId) {
        setRuleCreationOffer(null);
        return;
      }

      // Check if app already has a rule
      const existingRule = matchRule(current.app, current.title);
      if (existingRule) {
        setRuleCreationOffer(null);
        return;
      }

      // Offer to create rule
      setRuleCreationOffer({
        app: current.app,
        projectId: lastSession.projectId,
      });
    })();
  }, [sessions, isTracking, autoTrackingEnabled]);

  // Polling effect: auto-track apps when idle (if enabled)
  useEffect(() => {
    if (isTracking || !autoTrackingEnabled) {
      if (isAutoTrackingRef.current) saveAutoSession();
      setUntrackedApp(null);
      setUntrackedDismissed(false);
      return;
    }

    const poll = async () => {
      const current = await getCurrentApp();
      if (!current) {
        incrementOfflineCount();
        if (consecutiveOfflineCountRef.current >= 2 && isAutoTrackingRef.current) {
          saveAutoSession();
        }
        setDetectedApp(null, null);
        return;
      }

      resetOfflineCount();
      setDetectedApp(current.app, current.title);

      const rule = matchRule(current.app, current.title);
      if (rule) {
        setUntrackedApp(null);
        setUntrackedDismissed(false);
        if (isAutoTrackingRef.current && matchedRuleIdRef.current !== rule.id) {
          saveAutoSession();
        }
        if (!isAutoTrackingRef.current) {
          startAutoTracking(current.app, current.title, rule.id);
        }
      } else {
        if (isAutoTrackingRef.current) {
          saveAutoSession();
        }
        if (!untrackedDismissedRef.current) {
          setUntrackedApp(current.app);
          setUntrackedTitle(current.title);
        }
      }
    };

    poll();
    const id = setInterval(poll, 30_000);
    return () => clearInterval(id);
  }, [isTracking, autoTrackingEnabled]);

  // If a newly logged session covers the pending recovery period, clear it
  useEffect(() => {
    if (!recoveryPeriod) return;
    const pStart = new Date(recoveryPeriod.startTime);
    const pEnd = new Date(recoveryPeriod.endTime);
    if (sessions.some((s) => new Date(s.startTime) < pEnd && new Date(s.endTime) > pStart)) {
      clearRecovery();
    }
  }, [sessions, recoveryPeriod, clearRecovery]);

  // Detection: run once when idle. Reset only when tracking stops or sessions change.
  // Never resets on dismiss — dismissed gaps are blocked via isDismissed().
  useEffect(() => {
    const trackingChanged = prevIsTrackingRef.current !== isTracking;
    const sessionsChanged = prevSessionsRef.current !== sessions;
    prevIsTrackingRef.current = isTracking;
    prevSessionsRef.current = sessions;

    if (trackingChanged || sessionsChanged) hasDetectedRef.current = false;

    if (isTracking || hasDetectedRef.current || recoveryPeriod !== null) return;

    hasDetectedRef.current = true;
    (async () => {
      const awResult = await detectMissedTime(sessions, suggestProject, isDismissed);
      if (awResult) { setRecovery(awResult); return; }

      if (!calendarEnabled || permissionStatus !== "granted") return;
      const calResult = await detectMissedCalendarEvent(calendarEvents, mappings, sessions);
      if (calResult) setRecovery(calResult);
    })();
  }, [
    isTracking,
    sessions,
    suggestProject,
    recoveryPeriod,
    setRecovery,
    isDismissed,
    calendarEnabled,
    permissionStatus,
    calendarEvents,
    mappings,
  ]);

  // Calendar event suggestion effect: check when not tracking
  useEffect(() => {
    if (isTracking || recoveryPeriod !== null || !calendarEnabled) {
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
  }, [isTracking, recoveryPeriod, calendarEnabled, getActiveEventSuggestion]);

  // Subscribe to meeting state changes from the Mac app stream
  useEffect(() => {
    return onMeetingChange(setActiveMeeting);
  }, []);

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
  const autoRule = isAutoTracking ? rules.find((r) => r.id === matchedRuleId) : null;
  const autoProject = autoRule ? projects.find((p) => p.id === autoRule.projectId) : null;

  return (
    <Pressable
      style={styles.container}
      onPress={() => {
        if (ruleCreationOffer) {
          // Don't navigate when rule creation is offered - let inline actions handle it
          return;
        } else if (isAutoTracking) {
          router.push("/timer");
        } else if (untrackedApp && !untrackedDismissed) {
          router.push(
            `/untracked?app=${encodeURIComponent(untrackedApp)}${
              untrackedTitle ? `&title=${encodeURIComponent(untrackedTitle)}` : ""
            }`,
          );
        } else if (recoveryPeriod !== null) {
          router.push("/recover");
        } else if (activeMeeting && !isTracking) {
          router.push(
            `/timer?suggestTitle=${encodeURIComponent(`${activeMeeting.appDisplayName} Meeting`)}`,
          );
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
      ) : ruleCreationOffer ? (
        <View className="flex-row items-center justify-center gap-2">
          <View className="w-1.5 h-1.5 rounded-full bg-blue-400" />
          <Text className="text-blue-400 text-sm shrink" numberOfLines={1}>
            Create rule for {ruleCreationOffer.app}?
          </Text>
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              addRule(ruleCreationOffer.app, ruleCreationOffer.projectId);
              setRuleCreationOffer(null);
            }}
            hitSlop={8}
          >
            <Text className="text-blue-400 text-sm font-semibold">✓</Text>
          </Pressable>
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              setRuleCreationOffer(null);
            }}
            hitSlop={8}
          >
            <Text className="text-blue-400/50 text-sm font-semibold">×</Text>
          </Pressable>
        </View>
      ) : recoveryPeriod !== null ? (
        recoveryPeriod.source === "calendar" ? (
          <View className="flex-row items-center justify-center gap-2">
            <View className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <Text className="text-amber-400 text-sm" numberOfLines={1}>
              {recoveryPeriod.eventTitle} · Tap to log
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
      ) : activeMeeting && !isTracking ? (
        <View className="flex-row items-center justify-center gap-2">
          <View className="w-1.5 h-1.5 rounded-full bg-violet-400" />
          <Text className="text-violet-300 text-sm" numberOfLines={1}>
            In {activeMeeting.appDisplayName} · Tap to track
          </Text>
        </View>
      ) : isAutoTracking && autoProject ? (
        <View className="flex-row items-center justify-center gap-2">
          <Image
            source={`sf:${autoProject.icon}`}
            style={[styles.icon, { tintColor: autoProject.color }]}
          />
          <Text className="text-white text-sm shrink" numberOfLines={1}>
            {autoProject.name}
          </Text>
          <Text className="text-neutral-500 text-sm shrink-0">Auto</Text>
          <Text className="text-white text-sm font-mono font-semibold shrink-0">
            {formatTime(autoElapsed)}
          </Text>
        </View>
      ) : untrackedApp && !untrackedDismissed ? (
        <View className="flex-row items-center justify-center gap-2">
          <View className="w-1.5 h-1.5 rounded-full bg-neutral-500" />
          <Text className="text-neutral-400 text-sm shrink" numberOfLines={1}>
            {untrackedApp} · Untracked
          </Text>
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              setUntrackedDismissed(true);
            }}
            hitSlop={8}
          >
            <Text className="text-neutral-500 text-sm font-semibold">×</Text>
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
