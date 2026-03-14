import { StaticAuraBackground } from "@/components/static-aura-background";
import { useAuroraTheme } from "@/hooks/use-aurora-theme";
import type { CalendarEvent } from "@/lib/calendar";
import { useCalendarStore } from "@/stores/calendar-store";
import { useProjects } from "@/stores/projects-store";
import { type Session, useSessionsStore } from "@/stores/sessions-store";
import { useTimerStore } from "@/stores/timer-store";
import { DatePicker, Host } from "@expo/ui/swift-ui";
import { datePickerStyle } from "@expo/ui/swift-ui/modifiers";
import { Image } from "expo-image";
import { Link, router, Stack } from "expo-router";
import { Button } from "heroui-native";
import { Fragment, useEffect, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getWeekStart(base: Date, offsetWeeks: number): Date {
  const d = new Date(base);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff + offsetWeeks * 7);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
function formatDate(d: Date) {
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}
function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
function formatTime24(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function formatDuration(seconds: number): string {
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatGapDuration(ms: number): string {
  const totalMinutes = Math.floor(ms / 60000);
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

const DAY_ABBREVS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const CIRCLE_SIZE = 36;
const STRIP_PT = 12;
const ABBREV_H = 16;
const GAP = 8;
const CIRCLE_TOP = STRIP_PT + ABBREV_H + GAP;
const CIRCLE_EASING = Easing.out(Easing.cubic);
const CIRCLE_DURATION = 240;

function circleXForIndexInWidth(idx: number, width: number): number {
  const cw = (width - 6) / 7;
  return idx * (cw + 1) + (cw - CIRCLE_SIZE) / 2;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DatePill({ date }: { date: Date }) {
  return (
    <View className="rounded-full px-4 py-1.5">
      <Text className="text-white text-sm font-medium">{formatDate(date)}</Text>
    </View>
  );
}

function GapSeparator({ durationMs }: { durationMs: number }) {
  return (
    <View className="flex-row items-center gap-2" style={{ opacity: 0.35 }}>
      <View className="w-14" />
      <View className="w-4" />
      <View className="flex-1 flex-row items-center gap-2">
        <View className="flex-1 h-px bg-zinc-600" />
        <Text className="text-zinc-500 text-xs">
          {formatGapDuration(durationMs)}
        </Text>
        <View className="flex-1 h-px bg-zinc-600" />
      </View>
    </View>
  );
}

function SessionRow({
  session,
  index,
  overlappingEvents,
}: {
  session: Session;
  index: number;
  overlappingEvents: CalendarEvent[];
}) {
  const { projects } = useProjects();
  const theme = useAuroraTheme();
  const project = session.projectId
    ? projects.find((p) => p.id === session.projectId)
    : null;

  const appsString = session.apps
    ? session.apps
        .slice(0, 3)
        .map((a) => a.app)
        .join(" · ")
    : null;

  const pressScale = useSharedValue(1);
  const scaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  return (
    <Animated.View
      className="flex-row items-start gap-2"
      entering={FadeInDown.delay(index * 50)
        .duration(400)
        .easing(Easing.out(Easing.cubic))}
    >
      <View className="w-14 items-end pt-3.5">
        <Text className="text-zinc-500 text-xs tabular-nums">
          {formatTime24(new Date(session.startTime))}
        </Text>
      </View>
      <View className="items-center pt-[18px]">
        <View className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
      </View>
      <Link href={`/(tabs)/timeline/${session.id}`} asChild className="flex-1">
        <Link.AppleZoom>
          <Pressable
            className="flex-1"
            onPressIn={() => {
              pressScale.value = withTiming(0.96, {
                duration: 100,
                easing: Easing.out(Easing.quad),
              });
            }}
            onPressOut={() => {
              pressScale.value = withTiming(1, {
                duration: 220,
                easing: Easing.out(Easing.cubic),
              });
            }}
          >
            <Animated.View style={scaleStyle}>
              <View
                className="rounded-2xl px-4 py-3 gap-1 overflow-hidden"
                style={{ backgroundColor: theme.card }}
              >
                <View className="flex-row items-start justify-between gap-2">
                  <Text
                    className="text-white text-base font-semibold flex-1"
                    numberOfLines={1}
                  >
                    {session.title}
                  </Text>
                  <View
                    className="rounded-full px-2 py-0.5 mt-0.5"
                    style={{ backgroundColor: theme.chip }}
                  >
                    <Text className="text-zinc-300 text-xs font-medium">
                      {formatDuration(session.duration)}
                    </Text>
                  </View>
                </View>
                {project && (
                  <View className="flex-row items-center gap-1.5">
                    <Image
                      source={`sf:${project.icon}`}
                      style={{
                        width: 11,
                        height: 11,
                        tintColor: project.color,
                      }}
                    />
                    <Text className="text-zinc-500 text-xs">
                      {project.name}
                    </Text>
                  </View>
                )}
                {appsString && (
                  <Text
                    className="text-zinc-600 text-xs mt-1 leading-4"
                    numberOfLines={1}
                  >
                    {appsString}
                  </Text>
                )}
              </View>
            </Animated.View>
          </Pressable>
        </Link.AppleZoom>
      </Link>
    </Animated.View>
  );
}

function LiveSessionRow({
  startTimestamp,
  index,
}: {
  startTimestamp: string;
  index: number;
}) {
  const { title, projectId } = useTimerStore();
  const { projects } = useProjects();
  const theme = useAuroraTheme();
  const project = projectId ? projects.find((p) => p.id === projectId) : null;
  const [elapsed, setElapsed] = useState(0);

  const pressScale = useSharedValue(1);
  const scaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  useEffect(() => {
    const tick = () =>
      setElapsed(
        Math.floor((Date.now() - new Date(startTimestamp).getTime()) / 1000),
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startTimestamp]);

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 50)
        .duration(400)
        .easing(Easing.out(Easing.cubic))}
    >
      <Pressable
        onPress={() => router.push("/timer")}
        onPressIn={() => {
          pressScale.value = withTiming(0.96, {
            duration: 100,
            easing: Easing.out(Easing.quad),
          });
        }}
        onPressOut={() => {
          pressScale.value = withTiming(1, {
            duration: 220,
            easing: Easing.out(Easing.cubic),
          });
        }}
      >
        <View className="flex-row items-start gap-2">
          <View className="w-14 items-end pt-3.5">
            <Text className="text-zinc-500 text-xs tabular-nums">
              {formatTime24(new Date(startTimestamp))}
            </Text>
          </View>
          <View className="items-center pt-[18px]">
            <View className="w-1.5 h-1.5 rounded-full bg-red-500" />
          </View>
          <Animated.View style={scaleStyle} className="flex-1">
            <View
              className="flex-1 rounded-2xl px-4 py-3 gap-1 border border-red-500/30"
              style={{ backgroundColor: theme.card }}
            >
              <View className="flex-row items-start justify-between gap-2">
                <Text
                  className="text-white text-base font-semibold flex-1"
                  numberOfLines={1}
                >
                  {title || "Untitled"}
                </Text>
                <View className="flex-row items-center gap-1.5 mt-0.5">
                  <View className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  <Text className="text-red-400 text-xs font-mono">
                    {formatDuration(elapsed)}
                  </Text>
                </View>
              </View>
              {project && (
                <View className="flex-row items-center gap-1.5">
                  <Image
                    source={`sf:${project.icon}`}
                    style={{ width: 11, height: 11, tintColor: project.color }}
                  />
                  <Text className="text-zinc-500 text-xs">{project.name}</Text>
                </View>
              )}
            </View>
          </Animated.View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function CalendarEventMarker({
  event,
  index,
  expanded,
  onToggle,
}: {
  event: CalendarEvent;
  index: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { projects } = useProjects();
  const { mappings } = useCalendarStore();

  // Find the project color for this event
  const mapping = mappings.find((m) => {
    if (m.calendarName && m.calendarName === event.calendarName) return true;
    if (
      m.titleKeywords?.some((kw) =>
        event.title.toLowerCase().includes(kw.toLowerCase()),
      )
    ) {
      return true;
    }
    return false;
  });

  const project = mapping
    ? projects.find((p) => p.id === mapping.projectId)
    : null;
  const eventColor = project?.color ?? "#3b82f6"; // Fallback to blue

  const collapsedHeight = 20; // height of single line
  const expandedHeight = 100; // height of card with padding

  const containerHeight = useSharedValue(collapsedHeight);
  const collapsedOpacity = useSharedValue(1);
  const expandedOpacity = useSharedValue(0);

  useEffect(() => {
    containerHeight.value = withTiming(
      expanded ? expandedHeight : collapsedHeight,
      {
        duration: 280,
        easing: Easing.out(Easing.cubic),
      },
    );
    collapsedOpacity.value = withTiming(expanded ? 0 : 1, {
      duration: 200,
      easing: Easing.out(Easing.cubic),
    });
    expandedOpacity.value = withTiming(expanded ? 1 : 0, {
      duration: 200,
      easing: Easing.out(Easing.cubic),
    });
  }, [expanded, containerHeight, collapsedOpacity, expandedOpacity]);

  const containerStyle = useAnimatedStyle(() => ({
    height: containerHeight.value,
    overflow: "hidden",
  }));

  const collapsedStyle = useAnimatedStyle(() => ({
    opacity: collapsedOpacity.value,
  }));

  const expandedStyle = useAnimatedStyle(() => ({
    opacity: expandedOpacity.value,
  }));

  return (
    <Animated.View entering={FadeIn.delay(index * 30).duration(350)}>
      <Pressable onPress={onToggle}>
        <View className="flex-row items-start gap-2">
          {/* Time column */}
          <View className="w-14 items-end pt-2">
            <Text className="text-zinc-700 text-xs tabular-nums">
              {formatTime24(new Date(event.startDate))}
            </Text>
          </View>

          {/* Connector: thin vertical line + small dot */}
          <View className="w-4 items-center pt-[10px] gap-px">
            <View
              className="w-px flex-1"
              style={{ minHeight: 16, backgroundColor: `${eventColor}33` }}
            />
            <View
              className="w-1 h-1 rounded-full"
              style={{ backgroundColor: `${eventColor}80` }}
            />
          </View>

          {/* Event marker content - animated container */}
          <Animated.View className="flex-1" style={containerStyle}>
            {/* Collapsed state */}
            <Animated.View
              className="flex-row items-center gap-1.5"
              style={collapsedStyle}
              pointerEvents={expanded ? "none" : "auto"}
            >
              <Image
                source="sf:calendar"
                style={{ width: 10, height: 10, tintColor: `${eventColor}99` }}
              />
              <Text
                className="text-xs flex-1"
                numberOfLines={1}
                style={{ color: `${eventColor}99` }}
              >
                {event.title}
              </Text>
              <Text className="text-zinc-700 text-xs tabular-nums">
                {formatTime24(new Date(event.startDate))}–
                {formatTime24(new Date(event.endDate))}
              </Text>
            </Animated.View>

            {/* Expanded state */}
            <Animated.View
              className="rounded-xl px-3 py-2.5 border mt-1"
              style={[
                expandedStyle,
                {
                  backgroundColor: `${eventColor}14`,
                  borderColor: `${eventColor}33`,
                },
              ]}
              pointerEvents={expanded ? "auto" : "none"}
            >
              <Text
                className="text-sm font-medium"
                numberOfLines={2}
                style={{ color: eventColor }}
              >
                {event.title}
              </Text>
              <Text className="text-zinc-500 text-xs mt-0.5">
                {event.calendarName}
              </Text>
              <Text className="text-zinc-600 text-xs mt-1">
                {formatTime24(new Date(event.startDate))} –{" "}
                {formatTime24(new Date(event.endDate))}
              </Text>
            </Animated.View>
          </Animated.View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function TimelineScreen() {
  const today = new Date();
  const [selectedDate, setSelectedDate] = useState(today);
  const [weekOffset, setWeekOffset] = useState(0);
  const [showPicker, setShowPicker] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const theme = useAuroraTheme();

  const {
    isTracking,
    startTimestamp,
    projectId: timerProjectId,
  } = useTimerStore();
  const { sessions } = useSessionsStore();
  const { projects } = useProjects();
  const {
    events: calendarEvents,
    isEnabled: calendarEnabled,
    permissionStatus,
  } = useCalendarStore();

  const weekStart = getWeekStart(today, weekOffset);
  const weekDays = getWeekDays(weekStart);

  const filtersActive = selectedProjectIds.length > 0;

  function toggleProject(id: string) {
    setSelectedProjectIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  // Filter to selected day + active project filters, sort ascending
  const daySessions = sessions
    .filter((s) => {
      if (!isSameDay(new Date(s.startTime), selectedDate)) return false;
      if (filtersActive) return selectedProjectIds.includes(s.projectId ?? "");
      return true;
    })
    .sort(
      (a, b) =>
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
    );

  // Filter calendar events to selected day (only when enabled + permission granted)
  const dayCalendarEvents =
    calendarEnabled && permissionStatus === "granted"
      ? calendarEvents.filter((e) =>
          isSameDay(new Date(e.startDate), selectedDate),
        )
      : [];

  const liveInDay =
    isTracking &&
    startTimestamp &&
    isSameDay(new Date(startTimestamp), selectedDate) &&
    (!filtersActive || selectedProjectIds.includes(timerProjectId ?? ""));

  // Merge live timer and calendar events into sorted list by startTimestamp
  type BaseItem =
    | { kind: "session"; session: Session; startTime: number }
    | { kind: "live"; startTime: number }
    | { kind: "calendar"; event: CalendarEvent; startTime: number };

  const allBaseItems: BaseItem[] = [
    ...daySessions.map((s) => ({
      kind: "session" as const,
      session: s,
      startTime: new Date(s.startTime).getTime(),
    })),
    ...(liveInDay
      ? [
          {
            kind: "live" as const,
            startTime: new Date(startTimestamp!).getTime(),
          },
        ]
      : []),
    ...dayCalendarEvents.map((e) => ({
      kind: "calendar" as const,
      event: e,
      startTime: new Date(e.startDate).getTime(),
    })),
  ].sort((a, b) => a.startTime - b.startTime);

  type AugmentedItem =
    | {
        kind: "session";
        session: Session;
        startTime: number;
        index: number;
        overlappingEvents: CalendarEvent[];
      }
    | { kind: "live"; startTime: number; index: number }
    | { kind: "gap"; durationMs: number }
    | {
        kind: "calendar";
        event: CalendarEvent;
        startTime: number;
        index: number;
      };

  const augmentedItems: AugmentedItem[] = [];
  let animationIndex = 0;
  let prevSessionEndTime: number | null = null;

  for (const item of allBaseItems) {
    if (item.kind === "session") {
      // Gap before this session (only session-to-session)
      if (prevSessionEndTime !== null) {
        const gapMs = item.startTime - prevSessionEndTime;
        if (gapMs >= 20 * 60 * 1000) {
          augmentedItems.push({ kind: "gap", durationMs: gapMs });
        }
      }

      // Compute overlapping calendar events
      const sEnd = item.startTime + item.session.duration * 1000;
      const overlappingEvents = dayCalendarEvents.filter((e) => {
        const eStart = new Date(e.startDate).getTime();
        const eEnd = new Date(e.endDate).getTime();
        return eStart < sEnd && eEnd > item.startTime;
      });

      augmentedItems.push({
        kind: "session",
        session: item.session,
        startTime: item.startTime,
        index: animationIndex++,
        overlappingEvents,
      });
      prevSessionEndTime = item.startTime + item.session.duration * 1000;
    } else if (item.kind === "live") {
      if (prevSessionEndTime !== null) {
        const gapMs = item.startTime - prevSessionEndTime;
        if (gapMs >= 20 * 60 * 1000) {
          augmentedItems.push({ kind: "gap", durationMs: gapMs });
        }
      }
      augmentedItems.push({
        kind: "live",
        startTime: item.startTime,
        index: animationIndex++,
      });
    } else if (item.kind === "calendar") {
      augmentedItems.push({
        kind: "calendar",
        event: item.event,
        startTime: item.startTime,
        index: animationIndex++,
      });
    }
  }

  //circle
  const circleX = useSharedValue(-CIRCLE_SIZE);
  const stripWidthRef = useRef(0);
  const animatedCircle = useAnimatedStyle(() => ({ left: circleX.value }));
  //week slide
  const weekTranslate = useSharedValue(0);
  const animatedWeek = useAnimatedStyle(() => ({
    transform: [{ translateX: weekTranslate.value }],
  }));

  function showCircle(date: Date, animated: boolean) {
    if (stripWidthRef.current === 0) return;
    const idx = weekDays.findIndex((d) => isSameDay(d, date));
    const x =
      idx === -1
        ? -CIRCLE_SIZE
        : circleXForIndexInWidth(idx, stripWidthRef.current);
    circleX.value = animated
      ? withTiming(x, { duration: CIRCLE_DURATION, easing: CIRCLE_EASING })
      : x;
  }

  function onStripLayout(width: number) {
    stripWidthRef.current = width;
    showCircle(selectedDate, false);
  }

  function handleSelectDate(date: Date) {
    setSelectedDate(date);
    showCircle(date, true);
  }

  function applyDate(date: Date) {
    const todayWeekStart = getWeekStart(today, 0);
    const targetWeekStart = getWeekStart(date, 0);
    const diffMs = targetWeekStart.getTime() - todayWeekStart.getTime();
    const diffWeeks = Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));
    setWeekOffset(diffWeeks);
    setSelectedDate(date);
    const newWeekDays = getWeekDays(targetWeekStart);
    const idx = newWeekDays.findIndex((d) => isSameDay(d, date));
    if (idx !== -1 && stripWidthRef.current > 0) {
      circleX.value = circleXForIndexInWidth(idx, stripWidthRef.current);
    }
  }

  function handleWeekChange(delta: number) {
    const newOffset = weekOffset + delta;
    const stripWidth = stripWidthRef.current;
    const newWeekDays = getWeekDays(getWeekStart(today, newOffset));
    const idx = newWeekDays.findIndex((d) => isSameDay(d, selectedDate));

    circleX.value =
      idx !== -1 && stripWidth > 0
        ? circleXForIndexInWidth(idx, stripWidth)
        : -CIRCLE_SIZE;

    weekTranslate.value = delta > 0 ? stripWidth : -stripWidth;
    setWeekOffset(newOffset);
    weekTranslate.value = withTiming(0, {
      duration: 260,
      easing: Easing.out(Easing.cubic),
    });
  }

  return (
    <>
      <StaticAuraBackground />
      <Stack.Toolbar placement="left" asChild>
        <Pressable onPress={() => setShowPicker(true)}>
          <DatePill date={selectedDate} />
        </Pressable>
      </Stack.Toolbar>

      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon={
            filtersActive
              ? "line.3.horizontal.decrease.circle.fill"
              : "line.3.horizontal.decrease.circle"
          }
          onPress={() => setShowFilter(true)}
        />
        <Stack.Toolbar.Button
          icon="chevron.left"
          onPress={() => handleWeekChange(-1)}
        />
        <Stack.Toolbar.Button
          icon="chevron.right"
          onPress={() => handleWeekChange(1)}
        />
      </Stack.Toolbar>

      <ScrollView className="flex-1" contentInsetAdjustmentBehavior="automatic">
        {/* Week Strip */}
        <View
          className="relative border-b border-zinc-800/60 overflow-hidden"
          onLayout={(e) => onStripLayout(e.nativeEvent.layout.width)}
        >
          <Animated.View style={animatedWeek}>
            <Animated.View
              className="absolute rounded-full bg-white"
              style={[
                { width: CIRCLE_SIZE, height: CIRCLE_SIZE, top: CIRCLE_TOP },
                animatedCircle,
              ]}
              pointerEvents="none"
            />
            <View className="flex-row">
              {weekDays.map((day, i) => {
                const isToday = isSameDay(day, today);
                const isSelected = isSameDay(day, selectedDate);
                return (
                  <Fragment key={i}>
                    {i > 0 && (
                      <View className="w-px bg-zinc-800/80 self-stretch" />
                    )}
                    <Pressable
                      className="flex-1 items-center pt-3 pb-3 gap-2"
                      onPress={() => handleSelectDate(day)}
                    >
                      <Text
                        className={`text-xs font-medium ${
                          isToday ? "text-white" : "text-zinc-600"
                        }`}
                      >
                        {DAY_ABBREVS[i]}
                      </Text>
                      <View className="w-9 h-9 items-center justify-center">
                        <Text
                          className={`text-base font-semibold ${
                            isSelected
                              ? "text-black"
                              : isToday
                                ? "text-white"
                                : "text-zinc-400"
                          }`}
                        >
                          {day.getDate()}
                        </Text>
                      </View>
                    </Pressable>
                  </Fragment>
                );
              })}
            </View>
          </Animated.View>
        </View>

        {/* Content */}
        {augmentedItems.length === 0 && dayCalendarEvents.length === 0 ? (
          <View className="items-center justify-center pt-28 px-8">
            <View className="items-center justify-center mb-7">
              <View className="absolute w-36 h-36 rounded-full bg-zinc-900/30" />
              <View className="absolute w-28 h-28 rounded-full bg-zinc-900/50" />
              <View
                className="w-20 h-20 rounded-full items-center justify-center"
                style={{ backgroundColor: theme.card }}
              >
                <Image
                  source="sf:timer"
                  style={{ width: 30, height: 30 }}
                  tintColor="#52525b"
                />
              </View>
            </View>
            <Text className="text-white text-xl font-semibold mb-2 text-center">
              No Sessions
            </Text>
            <Text className="text-zinc-500 text-sm text-center leading-5">
              Start a focus session — your completed work will show up here.
            </Text>
          </View>
        ) : augmentedItems.length > 0 ? (
          <View className="px-3 pt-4 pb-8 gap-2">
            {augmentedItems.map((item) => {
              if (item.kind === "session") {
                return (
                  <SessionRow
                    key={item.session.id}
                    session={item.session}
                    index={item.index}
                    overlappingEvents={item.overlappingEvents}
                  />
                );
              } else if (item.kind === "live") {
                return (
                  <LiveSessionRow
                    key="live"
                    startTimestamp={startTimestamp!}
                    index={item.index}
                  />
                );
              } else if (item.kind === "gap") {
                return (
                  <GapSeparator
                    key={`gap-${item.durationMs}`}
                    durationMs={item.durationMs}
                  />
                );
              } else if (item.kind === "calendar") {
                return (
                  <CalendarEventMarker
                    key={item.event.id}
                    event={item.event}
                    index={item.index}
                    expanded={expandedEventId === item.event.id}
                    onToggle={() =>
                      setExpandedEventId((prev) =>
                        prev === item.event.id ? null : item.event.id,
                      )
                    }
                  />
                );
              }
            })}
          </View>
        ) : null}
      </ScrollView>

      {/* Date Picker Modal */}
      {showPicker && (
        <Modal
          transparent
          animationType="slide"
          onRequestClose={() => setShowPicker(false)}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setShowPicker(false)}
          />
          <View
            className="absolute bottom-0 left-0 right-0 rounded-t-2xl pb-safe"
            style={{ backgroundColor: theme.modalSheet }}
          >
            <Host matchContents>
              <DatePicker
                selection={selectedDate}
                displayedComponents={["date"]}
                onDateChange={(date) => applyDate(date)}
                modifiers={[datePickerStyle("graphical")]}
              />
            </Host>
            <Pressable
              className="items-center py-4"
              onPress={() => setShowPicker(false)}
            >
              <Text className="text-white font-semibold text-base">Done</Text>
            </Pressable>
          </View>
        </Modal>
      )}

      {/* Filter Modal */}
      {showFilter && (
        <Modal
          transparent
          animationType="slide"
          onRequestClose={() => setShowFilter(false)}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setShowFilter(false)}
          />
          <View
            className="absolute bottom-0 left-0 right-0 rounded-t-2xl pb-safe"
            style={{ backgroundColor: theme.modalSheet }}
          >
            {/* Handle */}
            <View className="items-center pt-3 pb-1">
              <View
                className="w-10 h-1 rounded-full"
                style={{ backgroundColor: theme.handle }}
              />
            </View>

            {/* Header */}
            <View className="flex-row items-center justify-between px-5 pt-3 pb-2">
              <Text className="text-white text-lg font-semibold">
                Filter by Project
              </Text>
              {filtersActive && (
                <Pressable onPress={() => setSelectedProjectIds([])}>
                  <Text className="text-zinc-400 text-sm">Clear</Text>
                </Pressable>
              )}
            </View>

            {/* Project list */}
            <View className="px-5">
              {projects.map((p, i) => {
                const isSelected = selectedProjectIds.includes(p.id);
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => toggleProject(p.id)}
                    className="flex-row items-center gap-3 py-3.5"
                    style={
                      i < projects.length - 1
                        ? {
                            borderBottomWidth: 1,
                            borderBottomColor: theme.cardBorder,
                          }
                        : undefined
                    }
                  >
                    <Image
                      source={`sf:${p.icon}`}
                      style={{ width: 18, height: 18, tintColor: p.color }}
                    />
                    <Text className="text-white text-base flex-1">
                      {p.name}
                    </Text>
                    <Image
                      source={
                        isSelected ? "sf:checkmark.circle.fill" : "sf:circle"
                      }
                      style={{
                        width: 22,
                        height: 22,
                        tintColor: isSelected ? "#ffffff" : "#52525b",
                      }}
                    />
                  </Pressable>
                );
              })}
            </View>

            <View className="px-5 pt-4 pb-2">
              <Button variant="primary" onPress={() => setShowFilter(false)}>
                <Button.Label>Done</Button.Label>
              </Button>
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}
