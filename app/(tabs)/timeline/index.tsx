import { type Session, useSessionsStore } from "@/stores/sessions-store";
import { useProjects } from "@/stores/projects-store";
import { useTimerStore } from "@/stores/timer-store";
import { DatePicker, Host } from "@expo/ui/swift-ui";
import { datePickerStyle } from "@expo/ui/swift-ui/modifiers";
import { Image } from "expo-image";
import { router, Stack } from "expo-router";
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
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
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
    <View className="bg-zinc-900 rounded-full px-4 py-1.5">
      <Text className="text-white text-sm font-medium">{formatDate(date)}</Text>
    </View>
  );
}

function SessionRow({ session }: { session: Session }) {
  const { projects } = useProjects();
  const project = session.projectId
    ? projects.find((p) => p.id === session.projectId)
    : null;

  return (
    <View className="flex-row items-start gap-2">
      <View className="w-14 items-end pt-3.5">
        <Text className="text-zinc-500 text-xs tabular-nums">
          {formatTime24(new Date(session.startTime))}
        </Text>
      </View>
      <View className="items-center pt-[18px]">
        <View className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
      </View>
      <View className="flex-1 bg-zinc-900 rounded-2xl px-4 py-3 gap-1">
        <View className="flex-row items-start justify-between gap-2">
          <Text
            className="text-white text-base font-semibold flex-1"
            numberOfLines={1}
          >
            {session.title}
          </Text>
          <View className="bg-zinc-800 rounded-full px-2 py-0.5 mt-0.5">
            <Text className="text-zinc-300 text-xs font-medium">
              {formatDuration(session.duration)}
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
    </View>
  );
}

function LiveSessionRow({ startTimestamp }: { startTimestamp: string }) {
  const { title, projectId } = useTimerStore();
  const { projects } = useProjects();
  const project = projectId ? projects.find((p) => p.id === projectId) : null;
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const tick = () =>
      setElapsed(
        Math.floor((Date.now() - new Date(startTimestamp).getTime()) / 1000)
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startTimestamp]);

  return (
    <Pressable onPress={() => router.push("/timer")}>
      <View className="flex-row items-start gap-2">
        <View className="w-14 items-end pt-3.5">
          <Text className="text-zinc-500 text-xs tabular-nums">
            {formatTime24(new Date(startTimestamp))}
          </Text>
        </View>
        <View className="items-center pt-[18px]">
          <View className="w-1.5 h-1.5 rounded-full bg-red-500" />
        </View>
        <View className="flex-1 bg-zinc-900 rounded-2xl px-4 py-3 gap-1 border border-red-500/30">
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
      </View>
    </Pressable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function TimelineScreen() {
  const today = new Date();
  const [selectedDate, setSelectedDate] = useState(today);
  const [weekOffset, setWeekOffset] = useState(0);
  const [showPicker, setShowPicker] = useState(false);

  const { isTracking, startTimestamp } = useTimerStore();
  const { sessions } = useSessionsStore();

  const weekStart = getWeekStart(today, weekOffset);
  const weekDays = getWeekDays(weekStart);

  // Filter to selected day, sort ascending
  const daySessions = sessions
    .filter((s) => isSameDay(new Date(s.startTime), selectedDate))
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  const liveInDay =
    isTracking &&
    startTimestamp &&
    isSameDay(new Date(startTimestamp), selectedDate);

  // Merge live timer into sorted list by startTimestamp
  type Item =
    | { kind: "session"; session: Session; startTime: number }
    | { kind: "live"; startTime: number };

  const items: Item[] = [
    ...daySessions.map((s) => ({
      kind: "session" as const,
      session: s,
      startTime: new Date(s.startTime).getTime(),
    })),
    ...(liveInDay
      ? [{ kind: "live" as const, startTime: new Date(startTimestamp!).getTime() }]
      : []),
  ].sort((a, b) => a.startTime - b.startTime);

  // Reanimated — circle
  const circleX = useSharedValue(-CIRCLE_SIZE);
  const stripWidthRef = useRef(0);
  const animatedCircle = useAnimatedStyle(() => ({ left: circleX.value }));

  // Reanimated — week slide
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
      <Stack.Toolbar placement="left" asChild>
        <Pressable onPress={() => setShowPicker(true)}>
          <DatePill date={selectedDate} />
        </Pressable>
      </Stack.Toolbar>

      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon="chevron.left"
          onPress={() => handleWeekChange(-1)}
        />
        <Stack.Toolbar.Button
          icon="chevron.right"
          onPress={() => handleWeekChange(1)}
        />
      </Stack.Toolbar>

      <ScrollView
        className="flex-1 bg-black"
        contentInsetAdjustmentBehavior="automatic"
      >
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
        {items.length === 0 ? (
          <View className="items-center justify-center pt-28 px-8">
            <View className="items-center justify-center mb-7">
              <View className="absolute w-36 h-36 rounded-full bg-zinc-900/30" />
              <View className="absolute w-28 h-28 rounded-full bg-zinc-900/50" />
              <View className="w-20 h-20 rounded-full bg-zinc-900 items-center justify-center">
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
        ) : (
          <View className="px-3 pt-4 pb-8 gap-2">
            {items.map((item, i) =>
              item.kind === "session" ? (
                <SessionRow key={item.session.id} session={item.session} />
              ) : (
                <LiveSessionRow key="live" startTimestamp={startTimestamp!} />
              )
            )}
          </View>
        )}
      </ScrollView>

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
          <View className="absolute bottom-0 left-0 right-0 bg-zinc-900 rounded-t-2xl pb-safe">
            <Host>
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
    </>
  );
}
