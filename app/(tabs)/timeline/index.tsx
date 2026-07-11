import { StaticAuraBackground } from "@/features/aurora/static-aura-background";
import { useAuroraTheme } from "@/features/aurora/use-aurora-theme";
import { findOverlappingEvents } from "@/features/calendar/calendar";
import { useCalendarStore } from "@/features/calendar/calendar-store";
import { useProjects } from "@/features/projects/projects-store";
import { useSessionsStore } from "@/features/sessions/sessions-store";
import { CalendarEventMarker } from "@/features/timeline/components/calendar-event-marker";
import { DatePill } from "@/features/timeline/components/date-pill";
import { GapSeparator } from "@/features/timeline/components/gap-separator";
import { LiveSessionRow } from "@/features/timeline/components/live-session-row";
import { SessionRow } from "@/features/timeline/components/session-row";
import { TimelineEmptyState } from "@/features/timeline/components/timeline-empty-state";
import { DragOverlay } from "@/features/timeline/merge/drag-overlay";
import { MergeProvider, useMergeContext } from "@/features/timeline/merge/merge-context";
import {
  type AugmentedItem,
  type BaseItem,
  CIRCLE_DURATION,
  CIRCLE_EASING,
  CIRCLE_SIZE,
  CIRCLE_TOP,
  circleXForIndexInWidth,
  DAY_ABBREVS,
  GAP_THRESHOLD_MS,
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
import { BottomSheet, Button, Checkbox } from "heroui-native";
import { Fragment, useMemo, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
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
          if (gapMs >= GAP_THRESHOLD_MS) {
            items.push({ kind: "gap", durationMs: gapMs });
          }
        }
        const sEnd = item.startTime + item.session.duration * 1000;
        const overlappingEvents = findOverlappingEvents(
          dayCalendarEvents,
          new Date(item.startTime),
          new Date(sEnd),
        );
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
          if (gapMs >= GAP_THRESHOLD_MS) {
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

  const circleX = useSharedValue(-CIRCLE_SIZE);
  const stripWidthRef = useRef(0);
  const animatedCircle = useAnimatedStyle(() => ({ left: circleX.value }));
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
              <View className="px-3">
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
              <View className="px-3">
                <LiveSessionRow
                  startTimestamp={startTimestamp!}
                  index={item.index}
                />
              </View>
            );
          }
          if (item.kind === "gap") {
            return (
              <View className="px-3">
                <GapSeparator durationMs={item.durationMs} />
              </View>
            );
          }
          if (item.kind === "calendar") {
            return (
              <View className="px-3">
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
        ItemSeparatorComponent={() => <View className="h-2" />}
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 32 }}
        contentInsetAdjustmentBehavior="automatic"
        ListEmptyComponent={<TimelineEmptyState selectedDate={selectedDate} />}
      />

      <DragOverlay />

      <BottomSheet isOpen={showPicker} onOpenChange={setShowPicker}>
        <BottomSheet.Portal>
          <BottomSheet.Overlay />
          <BottomSheet.Content
            backgroundStyle={{ backgroundColor: theme.modalSheet }}
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
          </BottomSheet.Content>
        </BottomSheet.Portal>
      </BottomSheet>

      <BottomSheet isOpen={showFilter} onOpenChange={setShowFilter}>
        <BottomSheet.Portal>
          <BottomSheet.Overlay />
          <BottomSheet.Content
            backgroundStyle={{ backgroundColor: theme.modalSheet }}
          >
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

            <View className="px-5">
              {projects.map((p, i) => {
                const isSelected = selectedProjectIds.includes(p.id);
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => toggleProject(p.id)}
                    className={`flex-row items-center gap-3 py-3.5 ${
                      i < projects.length - 1 ? "border-b" : ""
                    }`}
                    style={
                      i < projects.length - 1
                        ? { borderBottomColor: theme.cardBorder }
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
                    <Checkbox
                      isSelected={isSelected}
                      onSelectedChange={() => toggleProject(p.id)}
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
          </BottomSheet.Content>
        </BottomSheet.Portal>
      </BottomSheet>
    </>
  );
}
