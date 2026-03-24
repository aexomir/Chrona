import { TIMEFRAMES, type Timeframe } from "@/features/analytics/stats-utils";
import { GlassCard } from "./glass-card";
import { router } from "expo-router";
import { Button } from "heroui-native";
import { Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

const MAX_H = 72;

// Subtle non-uniform heights so ghost bars look organic, not mechanical
const GHOST_HEIGHTS = [
  2, 3, 2, 4, 3, 2, 3, 4, 5, 3, 4, 3, 2, 3, 4, 3, 2, 3, 4, 3, 2, 3, 2, 2,
];

export function StatsEmptyState({ timeframe }: { timeframe: Timeframe }) {
  const label =
    TIMEFRAMES.find((t) => t.value === timeframe)?.label ?? timeframe;

  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 28, paddingBottom: 40 }}>
      {/* Ghost metric cards */}
      <Animated.View
        entering={FadeInDown.duration(360)}
        style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}
      >
        <GlassCard style={{ flex: 1, opacity: 0.45 }}>
          <View style={{ padding: 16 }}>
            <Text
              style={{
                color: "rgba(255,255,255,0.22)",
                fontSize: 11,
                marginBottom: 10,
              }}
            >
              Total Tracked Time
            </Text>
            <Text
              style={{ color: "rgba(255,255,255,0.15)", fontSize: 28, fontWeight: "700" }}
            >
              —
            </Text>
          </View>
        </GlassCard>
        <GlassCard style={{ flex: 1, opacity: 0.45 }}>
          <View style={{ padding: 16 }}>
            <Text
              style={{
                color: "rgba(255,255,255,0.22)",
                fontSize: 11,
                marginBottom: 10,
              }}
            >
              Consistency
            </Text>
            <Text
              style={{ color: "rgba(255,255,255,0.15)", fontSize: 28, fontWeight: "700" }}
            >
              —
            </Text>
          </View>
        </GlassCard>
      </Animated.View>

      {/* Ghost bar chart */}
      <Animated.View
        entering={FadeInDown.delay(70).duration(360)}
        style={{ opacity: 0.45 }}
      >
        <GlassCard>
          <View
            style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 }}
          >
            <View
              style={{
                height: MAX_H,
                flexDirection: "row",
                alignItems: "flex-end",
                gap: 2,
              }}
            >
              {GHOST_HEIGHTS.map((h, i) => (
                <View
                  key={i}
                  style={{
                    flex: 1,
                    height: h,
                    borderRadius: 2,
                    backgroundColor: "rgba(255,255,255,0.08)",
                  }}
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
                  style={{
                    position: "absolute",
                    left: `${(h / 24) * 100}%` as any,
                    fontSize: 11,
                    color: "rgba(255,255,255,0.15)",
                  }}
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
        style={{ marginTop: 44 }}
      >
        <Text className="text-white text-lg font-semibold mb-2 text-center">
          Nothing to show
        </Text>
        <Text
          className="text-zinc-500 text-sm text-center leading-5"
          style={{ maxWidth: 240, marginBottom: 24 }}
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
