import { Label } from "heroui-native";
import { Text, View } from "react-native";

export function SectionHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <View className="mb-3 ml-1">
      <Label className="text-xs text-neutral-500 uppercase tracking-widest">
        {title}
      </Label>
      <Text className="text-xs text-zinc-600 mt-0.5">{description}</Text>
    </View>
  );
}
