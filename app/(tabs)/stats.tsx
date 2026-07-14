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
    <View className="flex-1">
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
            <View className="px-4 pb-10">
              <Animated.View
                key={`metrics-${timeframe}`}
                entering={FadeInDown.duration(380)}
                className="mt-7"
              >
                <SectionHeader
                  title="Trends vs Last Period"
                  description="Compare your tracked time against the previous period"
                />
                <View className="flex-row gap-3">
                  <MetricCard
                    label="Total Tracked Time"
                    value={formatFocusTime(totalSeconds)}
                    delta={delta}
                  />
                  <MetricCard
                    label="Consistency"
                    value={`${consistency.percentage}%`}
                    delta={consistencyDelta}
                  />
                </View>
              </Animated.View>

              <Animated.View
                key={`chart-${timeframe}`}
                entering={FadeInDown.delay(70).duration(380)}
                className="mt-6"
              >
                <SectionHeader
                  title="Most Active Hours"
                  description="When you track most throughout the day"
                />
                <BarChart24 buckets={hourBuckets} />
              </Animated.View>

              {projectTotals.length > 0 && (
                <Animated.View
                  key={`projects-${timeframe}`}
                  entering={FadeInDown.delay(140).duration(380)}
                  className="mt-6"
                >
                  <SectionHeader
                    title="Project Distribution"
                    description="How your tracked time is split across projects"
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

      <View className="absolute top-0 left-0 right-0" style={{ paddingTop: insets.top }}>
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

        <View className="h-14 px-4 justify-center">
          <Animated.View
            className="absolute inset-0 justify-center items-center"
            style={compactAnimStyle}
            pointerEvents="none"
          >
            <Text
              className="text-[15px] font-semibold"
              style={{ color: TextAlpha.primary }}
            >
              Stats
              <Text
                className="font-normal"
                style={{ color: TextAlpha.tertiary }}
              >
                {" "}
                · {activeLabel}
              </Text>
            </Text>
          </Animated.View>

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
              <Tabs.List className="bg-white/10 rounded-[20px] py-[3px]">
                <Tabs.Indicator className="bg-white/90 rounded-[20px]" />
                {TIMEFRAMES.map((tf) => (
                  <Tabs.Trigger
                    key={tf.value}
                    value={tf.value}
                    className="flex-1 py-[9px]"
                  >
                    {({ isSelected }) => (
                      <Tabs.Label
                        className="text-[13px] font-medium"
                        style={{
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
