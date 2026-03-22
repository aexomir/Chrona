import { Text, View } from "react-native";

export function SoonBadge() {
  return (
    <View className="px-2 py-1 rounded-full bg-amber-500/20 border border-amber-500/50">
      <Text className="text-amber-400 text-xs font-semibold">Soon</Text>
    </View>
  );
}

export function DevBadge() {
  return (
    <View className="px-2 py-1 rounded-full bg-violet-500/20 border border-violet-500/50">
      <Text className="text-violet-400 text-xs font-semibold">Dev</Text>
    </View>
  );
}
