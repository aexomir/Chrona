import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";

export function SuggestedFollowUps({
  queries,
  onSelectQuery,
}: {
  queries: { text: string; icon: string }[];
  onSelectQuery: (query: string) => void;
}) {
  return (
    <View className="mt-6 gap-2">
      <Text className="text-white/60 text-xs font-semibold mb-1 uppercase tracking-wide">
        Next Steps
      </Text>

      {queries.map((q, idx) => (
        <Pressable
          key={idx}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onSelectQuery(q.text);
          }}
          className="px-[14px] py-3 flex-row items-center gap-[10px] rounded-xl border border-white/[0.15] bg-white/10"
        >
          <Image source={q.icon} className="w-4 h-4" tintColor="rgba(255, 255, 255, 0.5)" />
          <Text className="flex-1 text-white text-sm font-medium">{q.text}</Text>
        </Pressable>
      ))}
    </View>
  );
}
