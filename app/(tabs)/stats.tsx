import { StatsEmptyState } from "@/features/analytics/components/stats-empty-state";
import { TextAlpha } from "@/constants/theme";
import { BarChart24 } from "@/features/analytics/components/bar-chart24";
import { MetricCard } from "@/features/analytics/components/metric-card";
import { ProjectDistribution } from "@/features/analytics/components/project-distribution";
import { SectionHeader } from "@/features/analytics/components/section-header";
import { StreakCallout } from "@/features/analytics/components/streak-callout";
import {
  TIMEFRAMES,
  type Timeframe,
  formatFocusTime,
} from "@/features/analytics/stats-utils";
import { StaticAuraBackground } from "@/features/aurora/static-aura-background";
import { useAuroraTheme } from "@/features/aurora/use-aurora-theme";
import { useProjects } from "@/features/projects/projects-store";
import { useSessionsStore } from "@/features/sessions/sessions-store";
import { useStatsData } from "@/hooks/use-stats-data";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { ScrollShadow, Tabs } from "heroui-native";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, {
  Extrapolation,
  FadeInDown,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function StatsScreen() {
  const [timeframe, setTimeframe] = useState<Timeframe>("week");
  const allSessions = useSessionsStore((s) => s.sessions);
  const projects = useProjects((s) => s.projects);
  const theme = useAuroraTheme();

  const {
    totalSeconds,
    delta,
    hourBuckets,
    projectTotals,
    streak,
    consistency,
    consistencyDelta,
    isEmpty,
  } = useStatsData(allSessions, projects, timeframe);

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
    <View style={{ flex: 1 }}>
      <StaticAuraBackground />
      <ScrollShadow
        className="flex-1"
        color={theme.modalSheet}
        LinearGradientComponent={LinearGradient}
        visibility="top"
        size={headerHeight}
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
            <StatsEmptyState timeframe={timeframe} />
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

      {/* Fixed header */}
      <View
        className="absolute top-0 left-0 right-0"
        style={{ paddingTop: insets.top }}
      >
        {/* Separator line */}
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              height: 1,
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

        <View
          style={{
            height: 56,
            paddingHorizontal: 16,
            justifyContent: "center",
          }}
        >
          {/* Compact title */}
          <Animated.View
            style={[styles.compactTitleContainer, compactAnimStyle]}
            pointerEvents="none"
          >
            <Text style={styles.compactTitle}>
              Stats
              <Text style={styles.compactTitleSecondary}> · {activeLabel}</Text>
            </Text>
          </Animated.View>

          {/* Timeframe pill selector */}
          <Animated.View style={pillAnimStyle}>
            <Tabs
              value={timeframe}
              onValueChange={(v) => {
                setTimeframe(v as Timeframe);
                if (process.env.EXPO_OS === "ios") {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
              }}
            >
              <Tabs.List
                style={{
                  backgroundColor: "rgba(255,255,255,0.1)",
                  borderRadius: 20,
                  paddingVertical: 3,
                }}
              >
                <Tabs.Indicator className="bg-white/90 rounded-[20px]" />
                {TIMEFRAMES.map((tf) => (
                  <Tabs.Trigger
                    key={tf.value}
                    value={tf.value}
                    style={{ flex: 1, paddingVertical: 9 }}
                  >
                    {({ isSelected }) => (
                      <Tabs.Label
                        style={{
                          fontSize: 13,
                          fontWeight: "500",
                          color: isSelected ? "#000" : TextAlpha.tertiary,
                        }}
                      >
                        {tf.label}
                      </Tabs.Label>
                    )}
                  </Tabs.Trigger>
                ))}
              </Tabs.List>
            </Tabs>
          </Animated.View>
        </View>
      </View>
    </View>
  );
}
