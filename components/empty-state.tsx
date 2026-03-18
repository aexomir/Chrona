import { useAuroraTheme } from "@/hooks/use-aurora-theme";
import { Neutral } from "@/constants/theme";
import { Image } from "expo-image";
import { Button } from "heroui-native";
import { Text, View } from "react-native";

interface EmptyStateProps {
  icon: string;
  title: string;
  description: string;
  ctaLabel?: string;
  onCta?: () => void;
}

export function EmptyState({
  icon,
  title,
  description,
  ctaLabel,
  onCta,
}: EmptyStateProps) {
  const theme = useAuroraTheme();

  return (
    <View className="items-center justify-center pt-28 px-8">
      <View className="items-center justify-center mb-7">
        <View className="absolute w-36 h-36 rounded-full bg-zinc-900/30" />
        <View className="absolute w-28 h-28 rounded-full bg-zinc-900/50" />
        <View
          className="w-20 h-20 rounded-full items-center justify-center"
          style={{ backgroundColor: theme.card }}
        >
          <Image
            source={`sf:${icon}`}
            style={{ width: 30, height: 30 }}
            tintColor={Neutral.z600}
          />
        </View>
      </View>
      <Text className="text-white text-xl font-semibold mb-2 text-center">
        {title}
      </Text>
      <Text className="text-zinc-500 text-sm text-center leading-5 mb-6">
        {description}
      </Text>
      {ctaLabel && onCta && (
        <Button variant="primary" onPress={onCta}>
          <Button.Label>{ctaLabel}</Button.Label>
        </Button>
      )}
    </View>
  );
}
