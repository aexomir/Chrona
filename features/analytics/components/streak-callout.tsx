import { GlassCard } from "./glass-card";
import { Image } from "expo-image";
import { Text, View } from "react-native";

export function StreakCallout({
  streak,
}: {
  streak: { current: number; ongoing: boolean };
}) {
  return (
    <GlassCard style={{ marginTop: 12 }}>
      <View
        style={{
          paddingHorizontal: 16,
          paddingVertical: 14,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        }}
      >
        <Image
          source="sf:flame.fill"
          style={{ width: 22, height: 22, tintColor: "#f97316" }}
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
