import { Semantic } from "@/constants/theme";
import { GlassCard } from "./glass-card";
import { Image } from "expo-image";
import { Text, View } from "react-native";

export function StreakCallout({
  streak,
}: {
  streak: { current: number; ongoing: boolean };
}) {
  return (
    <GlassCard className="mt-3">
      <View className="px-4 py-3.5 flex-row items-center gap-3">
        <Image
          source="sf:flame.fill"
          style={{ width: 22, height: 22, tintColor: Semantic.streak }}
        />
        <View>
          <Text className="text-white font-semibold">
            {streak.current} day streak
          </Text>
          <Text className="text-zinc-500 text-xs mt-0.5">
            {streak.ongoing ? "ongoing" : "keep it up!"}
          </Text>
        </View>
      </View>
    </GlassCard>
  );
}
