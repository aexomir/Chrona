import { CHART_MAX_HEIGHT, HOUR_AXIS_LABELS, TIMEFRAMES, type Timeframe } from "@/features/analytics/stats-utils";
import { GlassCard } from "./glass-card";
import { router } from "expo-router";
import { Button } from "heroui-native";
import { Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

// Subtle non-uniform heights so ghost bars look organic, not mechanical
const GHOST_HEIGHTS = [
  2, 3, 2, 4, 3, 2, 3, 4, 5, 3, 4, 3, 2, 3, 4, 3, 2, 3, 4, 3, 2, 3, 2, 2,
];

export function StatsEmptyState({ timeframe }: { timeframe: Timeframe }) {
  const label =
    TIMEFRAMES.find((t) => t.value === timeframe)?.label ?? timeframe;

  return (
    <View className="px-4 pt-7 pb-10">
      <Animated.View
        entering={FadeInDown.duration(360)}
        className="flex-row gap-3 mb-3"
      >
        <GlassCard className="flex-1 opacity-45">
          <View className="p-4">
            <Text className="text-white/[0.22] text-[11px] mb-2.5">
              Total Tracked Time
            </Text>
            <Text className="text-white/[0.15] text-[28px] font-bold">
              —
            </Text>
          </View>
        </GlassCard>
        <GlassCard className="flex-1 opacity-45">
          <View className="p-4">
            <Text className="text-white/[0.22] text-[11px] mb-2.5">
              Consistency
            </Text>
            <Text className="text-white/[0.15] text-[28px] font-bold">
              —
            </Text>
          </View>
        </GlassCard>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.delay(70).duration(360)}
        className="opacity-45"
      >
        <GlassCard>
          <View className="px-4 pt-3 pb-3">
            <View
              className="flex-row items-end gap-0.5"
              style={{ height: CHART_MAX_HEIGHT }}
            >
              {GHOST_HEIGHTS.map((h, i) => (
                <View
                  key={i}
                  className="flex-1 rounded-sm bg-white/[0.08]"
                  style={{ height: h }}
                />
              ))}
            </View>
            <View className="h-[18px] mt-1.5 relative">
              {HOUR_AXIS_LABELS.map(({ h, label }) => (
                <Text
                  key={h}
                  className="absolute text-[11px] text-white/[0.15]"
                  style={{ left: `${(h / 24) * 100}%` as any }}
                >
                  {label}
                </Text>
              ))}
            </View>
          </View>
        </GlassCard>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.delay(140).duration(360)}
        className="items-center mt-11"
      >
        <Text className="text-white text-lg font-semibold mb-2 text-center">
          Nothing to show
        </Text>
        <Text className="text-zinc-500 text-sm text-center leading-5 max-w-[240px] mb-6">
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
