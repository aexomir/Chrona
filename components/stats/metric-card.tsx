import { GlassCard } from "./glass-card";
import { Semantic } from "@/constants/theme";
import { Image } from "expo-image";
import { Text, View } from "react-native";

export function MetricCard({
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
                    tintColor: delta.dir === "up" ? Semantic.successBright : Semantic.danger,
                  }}
                />
                <Text
                  style={{ color: delta.dir === "up" ? Semantic.successBright : Semantic.danger }}
                  className="text-xs"
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
