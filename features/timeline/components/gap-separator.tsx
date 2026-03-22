import { formatGapDuration } from "@/features/timeline/timeline-utils";
import { Text, View } from "react-native";

export function GapSeparator({ durationMs }: { durationMs: number }) {
  return (
    <View className="flex-row items-center gap-2" style={{ opacity: 0.35 }}>
      <View className="w-14" />
      <View className="w-4" />
      <View className="flex-1 flex-row items-center gap-2">
        <View className="flex-1 h-px bg-zinc-600" />
        <Text className="text-zinc-500 text-xs">
          {formatGapDuration(durationMs)}
        </Text>
        <View className="flex-1 h-px bg-zinc-600" />
      </View>
    </View>
  );
}
