import { TIMEFRAMES, type Timeframe } from "@/features/analytics/stats-utils";
import { GlassCard } from "./glass-card";
import { router } from "expo-router";
import { Button } from "heroui-native";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

const MAX_H = 72;

// Subtle non-uniform heights so ghost bars look organic, not mechanical
const GHOST_HEIGHTS = [
  2, 3, 2, 4, 3, 2, 3, 4, 5, 3, 4, 3, 2, 3, 4, 3, 2, 3, 4, 3, 2, 3, 2, 2,
];

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 28,
    paddingBottom: 40,
  },
  metricsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  metricCardInner: {
    padding: 16,
  },
  metricLabel: {
    color: "rgba(255,255,255,0.22)",
    fontSize: 11,
    marginBottom: 10,
  },
  metricValue: {
    color: "rgba(255,255,255,0.15)",
    fontSize: 28,
    fontWeight: "700",
  },
  chartContainer: {
    opacity: 0.45,
  },
  chartInner: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  barChart: {
    height: MAX_H,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 2,
  },
  bar: {
    flex: 1,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  xAxisLabels: {
    height: 18,
    marginTop: 6,
    position: "relative",
  },
  xAxisLabel: {
    position: "absolute",
    fontSize: 11,
    color: "rgba(255,255,255,0.15)",
  },
  ctaContainer: {
    marginTop: 44,
  },
  ctaText: {
    maxWidth: 240,
    marginBottom: 24,
  },
});

export function StatsEmptyState({ timeframe }: { timeframe: Timeframe }) {
  const label =
    TIMEFRAMES.find((t) => t.value === timeframe)?.label ?? timeframe;

  return (
    <View style={styles.container}>
      {/* Ghost metric cards */}
      <Animated.View
        entering={FadeInDown.duration(360)}
        style={styles.metricsRow}
      >
        <GlassCard style={{ flex: 1, opacity: 0.45 }}>
          <View style={styles.metricCardInner}>
            <Text style={styles.metricLabel}>
              Total Tracked Time
            </Text>
            <Text style={styles.metricValue}>
              —
            </Text>
          </View>
        </GlassCard>
        <GlassCard style={{ flex: 1, opacity: 0.45 }}>
          <View style={styles.metricCardInner}>
            <Text style={styles.metricLabel}>
              Consistency
            </Text>
            <Text style={styles.metricValue}>
              —
            </Text>
          </View>
        </GlassCard>
      </Animated.View>

      {/* Ghost bar chart */}
      <Animated.View
        entering={FadeInDown.delay(70).duration(360)}
        style={styles.chartContainer}
      >
        <GlassCard>
          <View style={styles.chartInner}>
            <View style={styles.barChart}>
              {GHOST_HEIGHTS.map((h, i) => (
                <View
                  key={i}
                  style={[styles.bar, { height: h }]}
                />
              ))}
            </View>
            <View style={styles.xAxisLabels}>
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
                  style={[
                    styles.xAxisLabel,
                    { left: `${(h / 24) * 100}%` as any },
                  ]}
                >
                  {label}
                </Text>
              ))}
            </View>
          </View>
        </GlassCard>
      </Animated.View>

      {/* Copy + CTA */}
      <Animated.View
        entering={FadeInDown.delay(140).duration(360)}
        className="items-center"
        style={styles.ctaContainer}
      >
        <Text className="text-white text-lg font-semibold mb-2 text-center">
          Nothing to show
        </Text>
        <Text
          className="text-zinc-500 text-sm text-center leading-5"
          style={styles.ctaText}
        >
          Log a session to start seeing your patterns across this{" "}
          {label.toLowerCase()}.
        </Text>
        <Button variant="primary" onPress={() => router.push("/timer")}>
          <Button.Label>Start a Session</Button.Label>
        </Button>
      </Animated.View>
    </View>
  );
}
