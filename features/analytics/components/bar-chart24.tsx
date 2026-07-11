import { GlassCard } from "./glass-card";
import { AnimatedBar } from "./animated-bar";
import { CHART_MAX_HEIGHT, HOUR_AXIS_LABELS, formatHourLabel } from "@/features/analytics/stats-utils";
import { Text, View } from "react-native";

export function BarChart24({ buckets }: { buckets: number[] }) {
  const maxBucket = Math.max(...buckets, 1);
  const peakHour = buckets.indexOf(maxBucket);
  const peakLabel = formatHourLabel(peakHour);

  return (
    <GlassCard>
      <View className="px-4 pt-3 pb-3">
        {maxBucket > 0 && (
          <Text className="text-zinc-400 text-xs mb-2">Peak: {peakLabel}</Text>
        )}
        <View
          className="flex-row items-end gap-0.5"
          style={{ height: CHART_MAX_HEIGHT }}
        >
          {buckets.map((val, i) => (
            <AnimatedBar
              key={i}
              targetHeight={(val / maxBucket) * CHART_MAX_HEIGHT}
              color={
                val > 0 && val === maxBucket
                  ? "#ffffff"
                  : "rgba(255,255,255,0.12)"
              }
            />
          ))}
        </View>
        <View className="h-[18px] mt-1.5 relative">
          {HOUR_AXIS_LABELS.map(({ h, label }) => (
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
