import { StaticAuraBackground } from "@/features/aurora/static-aura-background";
import { useAuroraTheme } from "@/features/aurora/use-aurora-theme";
import type { CalendarEvent } from "@/features/calendar/calendar";
import { useCalendarStore } from "@/features/calendar/calendar-store";
import { useProjects } from "@/features/projects/projects-store";
import {
  type Session,
  useSessionsStore,
} from "@/features/sessions/sessions-store";
import { CalendarEventMarker } from "@/features/timeline/components/calendar-event-marker";
import { DatePill } from "@/features/timeline/components/date-pill";
import { GapSeparator } from "@/features/timeline/components/gap-separator";
import { LiveSessionRow } from "@/features/timeline/components/live-session-row";
import { SessionRow } from "@/features/timeline/components/session-row";
import { TimelineEmptyState } from "@/features/timeline/components/timeline-empty-state";
import { DragOverlay } from "@/features/timeline/merge/drag-overlay";
import { MergeProvider, useMergeContext } from "@/features/timeline/merge/merge-context";
import {
  CIRCLE_DURATION,
  CIRCLE_EASING,
  CIRCLE_SIZE,
  CIRCLE_TOP,
  circleXForIndexInWidth,
  DAY_ABBREVS,
  getWeekDays,
  getWeekStart,
  isSameDay,
} from "@/features/timeline/timeline-utils";
import { useTimerStore } from "@/features/timer/timer-store";
import { DatePicker, Host } from "@expo/ui/swift-ui";
import { datePickerStyle } from "@expo/ui/swift-ui/modifiers";
import { FlashList } from "@shopify/flash-list";
import { Image } from "expo-image";
import { Stack } from "expo-router";
import { Button } from "heroui-native";
import { Fragment, useMemo, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

export default function TimelineScreen() {
  return (
    <MergeProvider>
      <TimelineContent />
    </MergeProvider>
  );
}

function TimelineContent() {
  const today = new Date();
  const [selectedDate, setSelectedDate] = useState(today);
  const [weekOffset, setWeekOffset] = useState(0);
  const [showPicker, setShowPicker] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const theme = useAuroraTheme();
  const { isDragging, updateScrollY } = useMergeContext();

  const isTracking = useTimerStore((s) => s.isTracking);
  const startTimestamp = useTimerStore((s) => s.startTimestamp);
  const timerProjectId = useTimerStore((s) => s.projectId);
  const sessions = useSessionsStore((s) => s.sessions);
  const projects = useProjects((s) => s.projects);
  const calendarEvents = useCalendarStore((s) => s.events);
  const calendarEnabled = useCalendarStore((s) => s.isEnabled);
  const permissionStatus = useCalendarStore((s) => s.permissionStatus);

  const weekStart = getWeekStart(today, weekOffset);
  const weekDays = getWeekDays(weekStart);

  const filtersActive = selectedProjectIds.length > 0;

  function toggleProject(id: string) {
    setSelectedProjectIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  const daySessions = useMemo(
    () =>
      sessions
        .filter((s) => {
          if (!isSameDay(new Date(s.startTime), selectedDate)) return false;
          if (filtersActive)
            return selectedProjectIds.includes(s.projectId ?? "");
          return true;
        })
        .sort(
          (a, b) =>
            new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
        ),
    [sessions, selectedDate, filtersActive, selectedProjectIds],
  );

  const dayCalendarEvents = useMemo(
    () =>
      calendarEnabled && permissionStatus === "granted"
        ? calendarEvents.filter((e) =>
            isSameDay(new Date(e.startDate), selectedDate),
          )
        : [],
    [calendarEnabled, permissionStatus, calendarEvents, selectedDate],
  );

  const liveInDay =
    isTracking &&
    startTimestamp &&
    isSameDay(new Date(startTimestamp), selectedDate) &&
    (!filtersActive || selectedProjectIds.includes(timerProjectId ?? ""));

  type BaseItem =
    | { kind: "session"; session: Session; startTime: number }
    | { kind: "live"; startTime: number }
    | { kind: "calendar"; event: CalendarEvent; startTime: number };

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

  const augmentedItems = useMemo(() => {
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

    const items: AugmentedItem[] = [];
    let animationIndex = 0;
    let prevSessionEndTime: number | null = null;

    for (const item of allBaseItems) {
      if (item.kind === "session") {
        if (prevSessionEndTime !== null) {
          const gapMs = item.startTime - prevSessionEndTime;
          if (gapMs >= 20 * 60 * 1000) {
            items.push({ kind: "gap", durationMs: gapMs });
          }
        }
        const sEnd = item.startTime + item.session.duration * 1000;
        const overlappingEvents = dayCalendarEvents.filter((e) => {
          const eStart = new Date(e.startDate).getTime();
          const eEnd = new Date(e.endDate).getTime();
          return eStart < sEnd && eEnd > item.startTime;
        });
        items.push({
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
            items.push({ kind: "gap", durationMs: gapMs });
          }
        }
        items.push({
          kind: "live",
          startTime: item.startTime,
          index: animationIndex++,
        });
      } else if (item.kind === "calendar") {
        items.push({
          kind: "calendar",
          event: item.event,
          startTime: item.startTime,
          index: animationIndex++,
        });
      }
    }
    return items;
  }, [daySessions, dayCalendarEvents, liveInDay, startTimestamp]);

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

      <FlashList
        scrollEnabled={!isDragging}
        onScroll={(e) => updateScrollY(e.nativeEvent.contentOffset.y)}
        scrollEventThrottle={16}
        data={augmentedItems}
        keyExtractor={(item, index) => {
          if (item.kind === "session") return `session-${item.session.id}`;
          if (item.kind === "live") return "live";
          if (item.kind === "calendar") return `calendar-${item.event.id}`;
          return `gap-${index}`;
        }}
        renderItem={({ item }) => {
          if (item.kind === "session") {
            return (
              <View style={{ paddingHorizontal: 12 }}>
                <SessionRow
                  session={item.session}
                  index={item.index}
                  overlappingEvents={item.overlappingEvents}
                />
              </View>
            );
          }
          if (item.kind === "live") {
            return (
              <View style={{ paddingHorizontal: 12 }}>
                <LiveSessionRow
                  startTimestamp={startTimestamp!}
                  index={item.index}
                />
              </View>
            );
          }
          if (item.kind === "gap") {
            return (
              <View style={{ paddingHorizontal: 12 }}>
                <GapSeparator durationMs={item.durationMs} />
              </View>
            );
          }
          if (item.kind === "calendar") {
            return (
              <View style={{ paddingHorizontal: 12 }}>
                <CalendarEventMarker
                  event={item.event}
                  index={item.index}
                  expanded={expandedEventId === item.event.id}
                  onToggle={() =>
                    setExpandedEventId((prev) =>
                      prev === item.event.id ? null : item.event.id,
                    )
                  }
                />
              </View>
            );
          }
          return null;
        }}
        ListHeaderComponent={
          <View
            className="relative border-b border-zinc-800/60 overflow-hidden mb-3"
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
        }
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 32 }}
        contentInsetAdjustmentBehavior="automatic"
        ListEmptyComponent={<TimelineEmptyState selectedDate={selectedDate} />}
      />

      <DragOverlay />

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
