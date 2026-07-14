import { useEffect, useRef, useState } from "react";
import {
  Pressable,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { Image } from "expo-image";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text className="text-xs text-neutral-500 uppercase tracking-widest mb-3 ml-1">
      {children}
    </Text>
  );
}

export function RuleInput({ ...props }: TextInputProps) {
  return (
    <View className="h-12 rounded-xl border border-white/10 px-4 justify-center mb-8">
      <TextInput
        placeholderTextColor="#636366"
        autoCorrect={false}
        className="text-white bg-transparent"
        {...props}
      />
    </View>
  );
}

export function DeleteRow({
  label = "Remove Rule",
  onDelete,
}: {
  label?: string;
  onDelete: () => void;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bgProgress = useSharedValue(0);

  const rowStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      bgProgress.value,
      [0, 1],
      ["rgba(255,255,255,0)", "rgba(239,68,68,0.1)"],
    ),
    borderColor: interpolateColor(
      bgProgress.value,
      [0, 1],
      ["rgba(255,255,255,0.07)", "rgba(239,68,68,0.25)"],
    ),
  }));

  function handleTap() {
    if (!confirmed) {
      setConfirmed(true);
      bgProgress.value = withTiming(1, { duration: 220 });
      timerRef.current = setTimeout(reset, 3000);
    } else {
      if (timerRef.current) clearTimeout(timerRef.current);
      onDelete();
    }
  }

  function reset() {
    setConfirmed(false);
    bgProgress.value = withTiming(0, { duration: 200 });
    if (timerRef.current) clearTimeout(timerRef.current);
  }

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  return (
    <Animated.View style={[rowStyle, { borderWidth: 1, borderRadius: 12 }]}>
      <Pressable
        onPress={handleTap}
        className="flex-row items-center px-4 py-3.5"
      >
        <Image
          source="sf:trash"
          style={{ width: 15, height: 15, marginRight: 10 }}
          tintColor={confirmed ? "#ef4444" : "#52525b"}
        />
        <Text
          className="flex-1 text-sm"
          style={{ color: confirmed ? "#ef4444" : "#52525b" }}
        >
          {confirmed ? "Tap again to confirm removal" : label}
        </Text>
        {confirmed && (
          <Pressable onPress={reset} hitSlop={12}>
            <Text className="text-zinc-500 text-sm">Cancel</Text>
          </Pressable>
        )}
      </Pressable>
    </Animated.View>
  );
}
