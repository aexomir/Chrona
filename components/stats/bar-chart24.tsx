import { GlassCard } from "./glass-card";
import { AnimatedBar } from "./animated-bar";
import { Text, View } from "react-native";

const MAX_H = 72;

export function BarChart24({ buckets }: { buckets: number[] }) {
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
