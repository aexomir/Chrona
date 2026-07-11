import { Text, View } from "react-native";
import { Image } from "expo-image";
import { GlassView } from "expo-glass-effect";
import { Semantic } from "@/constants/theme";
import type { Insight, GeneratedResult } from "@/features/search/search-result";

const INSIGHT_ACCENT = "#818cf8";

export function InsightCard({
  insight,
}: {
  insight: GeneratedResult<Insight>;
}) {
  return (
    <GlassView glassEffectStyle="regular" colorScheme="dark" className="rounded-xl overflow-hidden">
      <View className="px-4 py-[14px]">
        <View className="flex-row items-start gap-2 mb-2">
          <Image
            source="sf:sparkles"
            className="w-4 h-4 mt-0.5"
            tintColor={INSIGHT_ACCENT}
          />
          <Text className="text-white font-semibold flex-1">{insight.data.headline}</Text>
        </View>

        <Text className="text-zinc-400 text-sm mb-2">{insight.data.body}</Text>

        {insight.data.tip && (
          <View className="flex-row items-start gap-1.5 mb-[10px]">
            <Image
              source="sf:lightbulb.fill"
              className="w-3.5 h-3.5 mt-px"
              tintColor={Semantic.warningBright}
            />
            <Text className="text-zinc-500 text-xs flex-1">{insight.data.tip}</Text>
          </View>
        )}

        <View className="h-px bg-white/5 mb-2" />

        <Text className="text-zinc-600 text-xs">
          {new Date(insight.generatedAt).toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      </View>
    </GlassView>
  );
}
