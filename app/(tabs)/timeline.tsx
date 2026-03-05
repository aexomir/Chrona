import { Image } from "expo-image";
import { Stack } from "expo-router";
import { Fragment, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
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

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
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

const DAY_ABBREVS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Strip layout constants (must match className values below)
const CIRCLE_SIZE = 36; // w-9
const STRIP_PT = 12;    // pt-3
const ABBREV_H = 16;    // text-xs line height
const GAP = 8;          // gap-2
const CIRCLE_TOP = STRIP_PT + ABBREV_H + GAP;

// ─── Sub-components ───────────────────────────────────────────────────────────

function DatePill({ date }: { date: Date }) {
  return (
    <View className="bg-zinc-900 rounded-full px-4 py-1.5">
      <Text className="text-white text-sm font-medium">{formatDate(date)}</Text>
    </View>
  );
}

function HeaderIconButton({ sf, onPress }: { sf: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="bg-zinc-900 rounded-full w-8 h-8 items-center justify-center"
    >
      <Image source={`sf:${sf}`} style={{ width: 14, height: 14 }} tintColor="#fff" />
    </Pressable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function TimelineScreen() {
  const today = new Date();
  const [selectedDate, setSelectedDate] = useState(today);
  const [weekOffset, setWeekOffset] = useState(0);

  const weekStart = getWeekStart(today, weekOffset);
  const weekDays = getWeekDays(weekStart);

  // Reanimated circle
  const circleX = useSharedValue(-CIRCLE_SIZE);
  const stripWidthRef = useRef(0);

  function colWidth() {
    // 6 separators × 1px each
    return (stripWidthRef.current - 6) / 7;
  }

  function circleXForIndex(idx: number) {
    const cw = colWidth();
    // Each column occupies cw + 1px (separator), except last
    return idx * (cw + 1) + (cw - CIRCLE_SIZE) / 2;
  }

  function showCircle(date: Date, animated: boolean) {
    if (stripWidthRef.current === 0) return;
    const idx = weekDays.findIndex((d) => isSameDay(d, date));
    const x = idx === -1 ? -CIRCLE_SIZE : circleXForIndex(idx);
    circleX.value = animated ? withSpring(x, { damping: 18, stiffness: 200 }) : x;
  }

  function onStripLayout(width: number) {
    stripWidthRef.current = width;
    showCircle(selectedDate, false);
  }

  function handleSelectDate(date: Date) {
    setSelectedDate(date);
    showCircle(date, true);
  }

  function handleWeekChange(delta: number) {
    const newOffset = weekOffset + delta;
    const newWeekDays = getWeekDays(getWeekStart(today, newOffset));
    const idx = newWeekDays.findIndex((d) => isSameDay(d, selectedDate));
    const x =
      idx !== -1 && stripWidthRef.current > 0
        ? (() => {
            const cw = (stripWidthRef.current - 6) / 7;
            return idx * (cw + 1) + (cw - CIRCLE_SIZE) / 2;
          })()
        : -CIRCLE_SIZE;
    circleX.value = x; // instant jump on week change
    setWeekOffset(newOffset);
  }

  const animatedCircle = useAnimatedStyle(() => ({ left: circleX.value }));

  return (
    <>
      <Stack.Screen
        options={{
          headerLeft: () => <DatePill date={selectedDate} />,
          headerRight: () => (
            <View className="flex-row items-center gap-2">
              <HeaderIconButton sf="tag" onPress={() => {}} />
              <HeaderIconButton sf="chevron.left" onPress={() => handleWeekChange(-1)} />
              <HeaderIconButton sf="chevron.right" onPress={() => handleWeekChange(1)} />
            </View>
          ),
        }}
      />

      <ScrollView className="flex-1 bg-black" contentInsetAdjustmentBehavior="automatic">
        {/* Week Strip */}
        <View
          className="relative border-b border-zinc-800/60"
          onLayout={(e) => onStripLayout(e.nativeEvent.layout.width)}
        >
          {/* Sliding highlight circle — rendered first so it sits behind text */}
          <Animated.View
            className="absolute rounded-full bg-white"
            style={[{ width: CIRCLE_SIZE, height: CIRCLE_SIZE, top: CIRCLE_TOP }, animatedCircle]}
            pointerEvents="none"
          />

          <View className="flex-row">
            {weekDays.map((day, i) => {
              const isToday = isSameDay(day, today);
              const isSelected = isSameDay(day, selectedDate);
              return (
                <Fragment key={i}>
                  {i > 0 && <View className="w-px bg-zinc-800/80 self-stretch" />}
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
                          isSelected ? "text-black" : isToday ? "text-white" : "text-zinc-400"
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
        </View>

        {/* Empty State */}
        <View className="items-center justify-center pt-28 px-8">
          {/* Glow rings */}
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
      </ScrollView>
    </>
  );
}
