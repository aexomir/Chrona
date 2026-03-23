import { EmptyState } from "@/components/empty-state";
import { StaticAuraBackground } from "@/features/aurora/static-aura-background";
import { BarChart24 } from "@/features/analytics/components/bar-chart24";
import { MetricCard } from "@/features/analytics/components/metric-card";
import { ProjectDistribution } from "@/features/analytics/components/project-distribution";
import { SectionHeader } from "@/features/analytics/components/section-header";
import { StreakCallout } from "@/features/analytics/components/streak-callout";
import { TextAlpha } from "@/constants/theme";
import { useAuroraTheme } from "@/features/aurora/use-aurora-theme";
import {
  TIMEFRAMES,
  type Timeframe,
  formatFocusTime,
} from "@/features/analytics/stats-utils";
import { useStatsData } from "@/hooks/use-stats-data";
import { useProjects } from "@/features/projects/projects-store";
import { useSessionsStore } from "@/features/sessions/sessions-store";
import { GlassView } from "expo-glass-effect";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { ScrollShadow } from "heroui-native";
import { useRef, useState } from "react";
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

// ─── Constants ────────────────────────────────────────────────────────────────

const EASE = { duration: 300, easing: Easing.out(Easing.cubic) };

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
    color: TextAlpha.primary,
    fontSize: 15,
    fontWeight: "600",
  },
  compactTitleSecondary: {
    color: TextAlpha.tertiary,
    fontWeight: "400",
  },
  pillContainer: {
    flexDirection: "row",
    position: "relative",
    borderRadius: 14,
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
  const allSessions = useSessionsStore(s => s.sessions);
  const projects = useProjects(s => s.projects);
  const theme = useAuroraTheme();

  const {
    sessions,
    totalSeconds,
    delta,
    hourBuckets,
    projectTotals,
    streak,
    consistency,
    consistencyDelta,
    isEmpty,
  } = useStatsData(allSessions, projects, timeframe);

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

  const shadowColor = theme.modalSheet;

  return (
    <View style={{ flex: 1 }}>
      <StaticAuraBackground />
      <ScrollShadow
        color={shadowColor}
        LinearGradientComponent={LinearGradient}
        visibility="top"
        size={headerHeight}
        style={{ flex: 1 }}
      >
        <ScrollView
          className="flex-1"
          contentInsetAdjustmentBehavior="never"
          contentContainerStyle={{ paddingVertical: headerHeight }}
          onScroll={scrollHandler}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
        >
          {isEmpty ? (
            <EmptyState
              icon="chart.bar"
              title="No Sessions"
              description="You haven't logged any focus sessions for this period."
              ctaLabel="Start a Focus Session"
              onCta={() => router.push("/timer")}
            />
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
                  <MetricCard
                    label="Focus Consistency"
                    value={`${consistency.percentage}%`}
                    delta={consistencyDelta}
                  />
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
      <View
        className="absolute top-0 left-0 right-0"
        style={{ paddingTop: insets.top }}
      >
        {/* Scroll shadow gradient */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              height: 1,
              pointerEvents: "none",
              opacity: interpolate(
                scrollY.value,
                [0, 40],
                [0, 1],
                Extrapolation.CLAMP,
              ),
            },
          ]}
        >
          <LinearGradient
            colors={theme.headerGradient}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={{ flex: 1, height: 20 }}
          />
        </Animated.View>

        <View style={{ height: 56, paddingHorizontal: 16 }}>
          {/* Compact title */}
          <Animated.View
            style={[styles.compactTitleContainer, compactAnimStyle]}
            pointerEvents="none"
          >
            <Text style={styles.compactTitle}>
              Stats{" "}
              <Text style={styles.compactTitleSecondary}>· {activeLabel}</Text>
            </Text>
          </Animated.View>

          {/* Expanded pill selector */}
          <Animated.View style={[pillAnimStyle, { paddingVertical: 10 }]}>
            <GlassView
              style={styles.pillContainer}
              glassEffectStyle="regular"
              colorScheme="dark"
            >
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
                          activeIndex === idx ? "#000" : TextAlpha.tertiary,
                      },
                    ]}
                  >
                    {tf.label}
                  </Text>
                </Pressable>
              ))}
            </GlassView>
          </Animated.View>
        </View>
      </View>
    </View>
  );
}
