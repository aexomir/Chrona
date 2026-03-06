import type { Project } from "@/constants/projects";
import { useProjects } from "@/stores/projects-store";
import { type Session, useSessionsStore } from "@/stores/sessions-store";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Button, Label, ScrollShadow } from "heroui-native";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  Extrapolation,
  FadeInDown,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ─── Types ────────────────────────────────────────────────────────────────────

type Timeframe = "day" | "week" | "month" | "year" | "all";

const TIMEFRAMES: { label: string; value: Timeframe }[] = [
  { label: "Day", value: "day" },
  { label: "Week", value: "week" },
  { label: "Month", value: "month" },
  { label: "Year", value: "year" },
  { label: "All", value: "all" },
];

const EASE = { duration: 300, easing: Easing.out(Easing.cubic) };
const MAX_H = 72;

// ─── Data helpers ─────────────────────────────────────────────────────────────

function getRange(tf: Timeframe, now: Date): { start: Date; end: Date } {
  const start = new Date(now);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  switch (tf) {
    case "day":
      start.setHours(0, 0, 0, 0);
      break;
    case "week": {
      const day = start.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      start.setDate(start.getDate() + diff);
      start.setHours(0, 0, 0, 0);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      break;
    }
    case "month":
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(end.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case "year":
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(11, 31);
      end.setHours(23, 59, 59, 999);
      break;
    case "all":
      start.setFullYear(2000, 0, 1);
      start.setHours(0, 0, 0, 0);
      end.setFullYear(2100, 11, 31);
      break;
  }
  return { start, end };
}

function getPrevRange(tf: Timeframe, now: Date): { start: Date; end: Date } {
  if (tf === "all") return { start: new Date(0), end: new Date(0) };
  const prev = new Date(now);
  switch (tf) {
    case "day":
      prev.setDate(prev.getDate() - 1);
      break;
    case "week":
      prev.setDate(prev.getDate() - 7);
      break;
    case "month":
      prev.setMonth(prev.getMonth() - 1);
      break;
    case "year":
      prev.setFullYear(prev.getFullYear() - 1);
      break;
  }
  return getRange(tf, prev);
}

function filterSessions(
  sessions: Session[],
  start: Date,
  end: Date,
): Session[] {
  return sessions.filter((s) => {
    const t = new Date(s.startTime).getTime();
    return t >= start.getTime() && t <= end.getTime();
  });
}

function getTotalSeconds(sessions: Session[]): number {
  return sessions.reduce((acc, s) => acc + s.duration, 0);
}

function formatFocusTime(seconds: number): string {
  if (seconds === 0) return "0m";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function getDelta(
  current: number,
  prev: number,
): { dir: "up" | "down" | "same"; pct: number } {
  if (prev === 0) return { dir: "same", pct: 0 };
  const pct = Math.round(((current - prev) / prev) * 100);
  return {
    dir: pct > 0 ? "up" : pct < 0 ? "down" : "same",
    pct: Math.abs(pct),
  };
}

function getHourBuckets(sessions: Session[]): number[] {
  const buckets = new Array(24).fill(0);
  for (const s of sessions) {
    buckets[new Date(s.startTime).getHours()] += s.duration / 60;
  }
  return buckets;
}

function getProjectTotals(sessions: Session[], projects: Project[]) {
  const map = new Map<string, number>();
  for (const s of sessions) {
    if (s.projectId)
      map.set(s.projectId, (map.get(s.projectId) ?? 0) + s.duration);
  }
  return projects
    .filter((p) => map.has(p.id))
    .map((p) => ({ project: p, seconds: map.get(p.id)! }))
    .sort((a, b) => b.seconds - a.seconds);
}

function computeStreak(sessions: Session[]) {
  if (sessions.length === 0) return { current: 0, ongoing: false };

  const days = new Set(
    sessions.map((s) => {
      const d = new Date(s.startTime);
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    }),
  );

  const today = new Date();
  const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = `${yesterday.getFullYear()}-${yesterday.getMonth()}-${yesterday.getDate()}`;

  const hasToday = days.has(todayKey);
  if (!hasToday && !days.has(yesterdayKey))
    return { current: 0, ongoing: false };

  let current = 0;
  const checkDate = hasToday ? new Date(today) : new Date(yesterday);
  while (true) {
    const key = `${checkDate.getFullYear()}-${checkDate.getMonth()}-${checkDate.getDate()}`;
    if (!days.has(key)) break;
    current++;
    checkDate.setDate(checkDate.getDate() - 1);
  }
  return { current, ongoing: hasToday };
}

// ─── UI primitives ────────────────────────────────────────────────────────────

function GlassCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: object;
}) {
  return (
    <View
      style={[
        {
          overflow: "hidden",
          borderRadius: 20,
          borderWidth: 0.5,
          borderColor: "rgba(255,255,255,0.10)",
        },
        style,
      ]}
    >
      <BlurView
        intensity={55}
        tint="systemUltraThinMaterialDark"
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
}

function SectionHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <View className="mb-3 ml-1">
      <Label className="text-xs text-neutral-500 uppercase tracking-widest">
        {title}
      </Label>
      <Text className="text-xs text-zinc-600 mt-0.5">{description}</Text>
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function AnimatedBar({
  targetHeight,
  color,
}: {
  targetHeight: number;
  color: string;
}) {
  const height = useSharedValue(0);

  useEffect(() => {
    height.value = withTiming(targetHeight, EASE);
  }, [targetHeight]);

  const animStyle = useAnimatedStyle(() => ({ height: height.value }));

  return (
    <Animated.View
      style={[
        animStyle,
        {
          backgroundColor: color,
          flex: 1,
          borderRadius: 2,
          alignSelf: "flex-end",
        },
      ]}
    />
  );
}

function BarChart24({ buckets }: { buckets: number[] }) {
  const maxBucket = Math.max(...buckets, 1);
  const peakHour = buckets.indexOf(maxBucket);
  const peakLabel =
    peakHour === 0
      ? "12 AM"
      : peakHour < 12
        ? `${peakHour} AM`
        : peakHour === 12
          ? "12 PM"
          : `${peakHour - 12} PM`;

  return (
    <GlassCard>
      <View
        style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 }}
      >
        {maxBucket > 0 && (
          <Text className="text-zinc-400 text-xs mb-2">Peak: {peakLabel}</Text>
        )}
        <View
          style={{
            height: MAX_H,
            flexDirection: "row",
            alignItems: "flex-end",
            gap: 2,
          }}
        >
          {buckets.map((val, i) => (
            <AnimatedBar
              key={i}
              targetHeight={(val / maxBucket) * MAX_H}
              color={
                val > 0 && val === maxBucket
                  ? "#ffffff"
                  : "rgba(255,255,255,0.12)"
              }
            />
          ))}
        </View>
        <View style={{ height: 18, marginTop: 6, position: "relative" }}>
          {(
            [
              { h: 0, label: "12am" },
              { h: 6, label: "6am" },
              { h: 12, label: "12pm" },
              { h: 18, label: "6pm" },
            ] as const
          ).map(({ h, label }) => (
            <Text
              key={h}
              className="text-zinc-600 text-xs absolute"
              style={{ left: `${(h / 24) * 100}%` as any }}
            >
              {label}
            </Text>
          ))}
        </View>
      </View>
    </GlassCard>
  );
}

function MetricCard({
  label,
  value,
  delta,
  noData,
}: {
  label: string;
  value?: string;
  delta?: { dir: "up" | "down" | "same"; pct: number };
  noData?: boolean;
}) {
  return (
    <GlassCard style={{ flex: 1 }}>
      <View style={{ padding: 16 }}>
        <Text className="text-zinc-400 text-xs mb-2">{label}</Text>
        {noData ? (
          <View style={{ paddingVertical: 16, alignItems: "center" }}>
            <Text className="text-zinc-600 text-sm">No data yet</Text>
          </View>
        ) : (
          <>
            <Text className="text-white text-3xl font-bold">{value}</Text>
            {delta && delta.dir !== "same" && (
              <View className="bg-white/10 rounded-full px-2 py-0.5 flex-row items-center gap-1 mt-2 self-start">
                <Image
                  source={delta.dir === "up" ? "sf:arrow.up" : "sf:arrow.down"}
                  style={{
                    width: 10,
                    height: 10,
                    tintColor: delta.dir === "up" ? "#4ade80" : "#ef4444",
                  }}
                />
                <Text
                  className={
                    delta.dir === "up"
                      ? "text-green-400 text-xs"
                      : "text-red-400 text-xs"
                  }
                >
                  {delta.pct}%
                </Text>
              </View>
            )}
          </>
        )}
      </View>
    </GlassCard>
  );
}

function ProjectDistribution({
  totals,
}: {
  totals: { project: Project; seconds: number }[];
}) {
  const maxSeconds = totals[0]?.seconds ?? 1;

  return (
    <GlassCard>
      <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
        {totals.map(({ project, seconds }) => (
          <View key={project.id} className="flex-row items-center gap-2 py-2">
            <Image
              source={`sf:${project.icon}`}
              style={{ width: 14, height: 14, tintColor: project.color }}
            />
            <Text
              className="text-zinc-400 text-xs"
              style={{ width: 64 }}
              numberOfLines={1}
            >
              {project.name}
            </Text>
            <View
              className="flex-1 rounded-full"
              style={{ height: 5, backgroundColor: "rgba(255,255,255,0.08)" }}
            >
              <View
                className="rounded-full"
                style={{
                  width: `${(seconds / maxSeconds) * 100}%` as any,
                  height: 5,
                  backgroundColor: project.color,
                }}
              />
            </View>
            <Text
              className="text-zinc-500 text-xs tabular-nums"
              style={{ width: 48, textAlign: "right" }}
            >
              {formatFocusTime(seconds)}
            </Text>
          </View>
        ))}
      </View>
    </GlassCard>
  );
}

function StreakCallout({
  streak,
}: {
  streak: { current: number; ongoing: boolean };
}) {
  return (
    <GlassCard style={{ marginTop: 12 }}>
      <View
        style={{
          paddingHorizontal: 16,
          paddingVertical: 14,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        }}
      >
        <Image
          source="sf:flame.fill"
          style={{ width: 22, height: 22, tintColor: "#f97316" }}
        />
        <View>
          <Text className="text-white font-semibold">
            {streak.current} day streak
          </Text>
          <Text className="text-zinc-500 text-xs mt-0.5">
            {streak.ongoing ? "ongoing" : "keep it up!"}
          </Text>
        </View>
      </View>
    </GlassCard>
  );
}

function EmptyState() {
  return (
    <View className="items-center justify-center pt-28 px-8">
      <View className="items-center justify-center mb-7">
        <View className="absolute w-36 h-36 rounded-full bg-zinc-900/30" />
        <View className="absolute w-28 h-28 rounded-full bg-zinc-900/50" />
        <View className="w-20 h-20 rounded-full bg-zinc-900 items-center justify-center">
          <Image
            source="sf:chart.bar"
            style={{ width: 30, height: 30 }}
            tintColor="#52525b"
          />
        </View>
      </View>
      <Text className="text-white text-xl font-semibold mb-2 text-center">
        No Sessions
      </Text>
      <Text className="text-zinc-500 text-sm text-center leading-5 mb-6">
        You haven't logged any focus sessions for this period.
      </Text>
      <Button variant="primary" onPress={() => router.push("/timer")}>
        <Button.Label>Start a Focus Session</Button.Label>
      </Button>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  compactTitleContainer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  compactTitle: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 15,
    fontWeight: "600",
  },
  compactTitleSecondary: {
    color: "rgba(255,255,255,0.45)",
    fontWeight: "400",
  },
  pillContainer: {
    flexDirection: "row",
    position: "relative",
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.14)",
  },
  pillIndicator: {
    position: "absolute",
    top: 3,
    bottom: 3,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 10,
  },
  pillButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 9,
  },
  pillButtonText: {
    fontSize: 13,
    fontWeight: "500",
  },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function StatsScreen() {
  const [timeframe, setTimeframe] = useState<Timeframe>("week");
  const { sessions: allSessions } = useSessionsStore();
  const { projects } = useProjects();

  const now = new Date();
  const { start, end } = getRange(timeframe, now);
  const { start: prevStart, end: prevEnd } = getPrevRange(timeframe, now);

  const sessions = filterSessions(allSessions, start, end);
  const prevSessions = filterSessions(allSessions, prevStart, prevEnd);

  const totalSeconds = getTotalSeconds(sessions);
  const delta = getDelta(totalSeconds, getTotalSeconds(prevSessions));
  const hourBuckets = getHourBuckets(sessions);
  const projectTotals = getProjectTotals(sessions, projects);
  const streak = computeStreak(allSessions);
  const isEmpty = sessions.length === 0;

  // Pill indicator
  const pillLayouts = useRef<{ x: number; width: number }[]>([]);
  const indicatorX = useSharedValue(-100);
  const indicatorW = useSharedValue(0);
  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
    width: indicatorW.value,
  }));
  const activeIndex = TIMEFRAMES.findIndex((t) => t.value === timeframe);

  function moveTo(idx: number, animated: boolean) {
    const layout = pillLayouts.current[idx];
    if (!layout) return;
    if (animated) {
      indicatorX.value = withTiming(layout.x, EASE);
      indicatorW.value = withTiming(layout.width, EASE);
    } else {
      indicatorX.value = layout.x;
      indicatorW.value = layout.width;
    }
  }

  // Scroll-driven header collapse
  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.value = e.contentOffset.y;
    },
  });

  const pillAnimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 30], [1, 0], Extrapolation.CLAMP),
  }));
  const compactAnimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [15, 45], [0, 1], Extrapolation.CLAMP),
  }));

  const activeLabel =
    TIMEFRAMES.find((t) => t.value === timeframe)?.label ?? "";
  const insets = useSafeAreaInsets();

  const headerHeight = insets.top + 56;

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <ScrollShadow
        color="#000000"
        LinearGradientComponent={LinearGradient}
        visibility="top"
        size={headerHeight}
        style={{ flex: 1 }}
      >
        <ScrollView
          className="flex-1 bg-black"
          contentInsetAdjustmentBehavior="never"
          contentContainerStyle={{ paddingVertical: headerHeight }}
          onScroll={scrollHandler}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
        >
          {isEmpty ? (
            <EmptyState />
          ) : (
            <View style={{ paddingHorizontal: 16, paddingBottom: 40 }}>
              <Animated.View
                key={`metrics-${timeframe}`}
                entering={FadeInDown.duration(380)}
                style={{ marginTop: 28 }}
              >
                <SectionHeader
                  title="Trends vs Last Period"
                  description="Compare your focus time against the previous period"
                />
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <MetricCard
                    label="Total Focus Time"
                    value={formatFocusTime(totalSeconds)}
                    delta={delta}
                  />
                  <MetricCard label="Productivity Score" noData />
                </View>
              </Animated.View>

              <Animated.View
                key={`chart-${timeframe}`}
                entering={FadeInDown.delay(70).duration(380)}
                style={{ marginTop: 24 }}
              >
                <SectionHeader
                  title="Most Active Hours"
                  description="When you focus most throughout the day"
                />
                <BarChart24 buckets={hourBuckets} />
              </Animated.View>

              {projectTotals.length > 0 && (
                <Animated.View
                  key={`projects-${timeframe}`}
                  entering={FadeInDown.delay(140).duration(380)}
                  style={{ marginTop: 24 }}
                >
                  <SectionHeader
                    title="Project Distribution"
                    description="How your focus time is split across projects"
                  />
                  <ProjectDistribution totals={projectTotals} />
                </Animated.View>
              )}

              {streak.current > 0 && (
                <Animated.View
                  key={`streak-${timeframe}`}
                  entering={FadeInDown.delay(210).duration(380)}
                >
                  <StreakCallout streak={streak} />
                </Animated.View>
              )}
            </View>
          )}
        </ScrollView>
      </ScrollShadow>

      {/* Fixed header — rendered above ScrollShadow */}
      <View className="absolute top-0 left-0 right-0 bg-black" style={{ paddingTop: insets.top }}>
        {/* Scroll shadow gradient */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              height: 1,
              pointerEvents: "none",
              opacity: interpolate(scrollY.value, [0, 40], [0, 1], Extrapolation.CLAMP),
            },
          ]}
        >
          <LinearGradient
            colors={["rgba(0,0,0,0.8)", "rgba(0,0,0,0.4)", "rgba(0,0,0,0)"]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={{ flex: 1, height: 20 }}
          />
        </Animated.View>

        <View style={{ height: 56, paddingHorizontal: 16 }}>
          {/* Compact title */}
          <Animated.View
            style={[
              styles.compactTitleContainer,
              compactAnimStyle,
            ]}
            pointerEvents="none"
          >
            <Text style={styles.compactTitle}>
              Stats{" "}
              <Text style={styles.compactTitleSecondary}>
                · {activeLabel}
              </Text>
            </Text>
          </Animated.View>

          {/* Expanded pill selector (fades out when scrolled) */}
          <Animated.View style={[pillAnimStyle, { paddingVertical: 10 }]}>
            <View style={styles.pillContainer}>
              <Animated.View
                style={[styles.pillIndicator, indicatorStyle]}
                pointerEvents="none"
              />
              {TIMEFRAMES.map((tf, idx) => (
                <Pressable
                  key={tf.value}
                  style={styles.pillButton}
                  onLayout={(e) => {
                    pillLayouts.current[idx] = {
                      x: e.nativeEvent.layout.x,
                      width: e.nativeEvent.layout.width,
                    };
                    if (tf.value === timeframe) moveTo(idx, false);
                  }}
                  onPress={() => {
                    setTimeframe(tf.value);
                    moveTo(idx, true);
                    if (process.env.EXPO_OS === "ios") {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }
                  }}
                >
                  <Text
                    style={[
                      styles.pillButtonText,
                      {
                        color:
                          activeIndex === idx ? "#000" : "rgba(255,255,255,0.45)",
                      },
                    ]}
                  >
                    {tf.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Animated.View>
        </View>
      </View>
    </View>
  );
}
