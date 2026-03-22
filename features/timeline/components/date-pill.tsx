import { formatDate } from "@/features/timeline/timeline-utils";
import { Text, View } from "react-native";

export function DatePill({ date }: { date: Date }) {
  return (
    <View className="rounded-full px-4 py-1.5">
      <Text className="text-white text-sm font-medium">{formatDate(date)}</Text>
    </View>
  );
}
