import { formatDuration, formatTime24 } from "@/features/timeline/timeline-utils";
import { useAuroraTheme } from "@/features/aurora/use-aurora-theme";
import { useProjects } from "@/features/projects/projects-store";
import { useTimerStore } from "@/features/timer/timer-store";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

export function LiveSessionRow({
  startTimestamp,
  index,
}: {
  startTimestamp: string;
  index: number;
}) {
  const { title, projectId } = useTimerStore();
  const { projects } = useProjects();
  const theme = useAuroraTheme();
  const project = projectId ? projects.find((p) => p.id === projectId) : null;
  const [elapsed, setElapsed] = useState(0);

  const pressScale = useSharedValue(1);
  const scaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  useEffect(() => {
    const tick = () =>
      setElapsed(
        Math.floor((Date.now() - new Date(startTimestamp).getTime()) / 1000),
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startTimestamp]);

  const accentColor = project?.color ?? "#ef4444";

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 50)
        .duration(400)
        .easing(Easing.out(Easing.cubic))}
    >
      <Pressable
        onPress={() => router.push("/timer")}
        onPressIn={() => {
          pressScale.value = withTiming(0.96, {
            duration: 100,
            easing: Easing.out(Easing.quad),
          });
        }}
        onPressOut={() => {
          pressScale.value = withTiming(1, {
            duration: 220,
            easing: Easing.out(Easing.cubic),
          });
        }}
      >
        <View className="flex-row items-start gap-2">
          <View className="w-14 items-end pt-3.5">
            <Text className="text-zinc-500 text-xs tabular-nums">
              {formatTime24(new Date(startTimestamp))}
            </Text>
          </View>
          <View className="items-center pt-[18px]">
            <View
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: accentColor }}
            />
          </View>
          <Animated.View style={scaleStyle} className="flex-1">
            <View
              className="flex-1 rounded-2xl px-4 py-3 gap-1"
              style={{
                backgroundColor: theme.card,
                borderWidth: 1,
                borderColor: `${accentColor}4D`,
              }}
            >
              <View className="flex-row items-start justify-between gap-2">
                <Text
                  className="text-white text-base font-semibold flex-1"
                  numberOfLines={1}
                >
                  {title || "Untitled"}
                </Text>
                <View className="flex-row items-center gap-1.5 mt-0.5">
                  <View
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: accentColor }}
                  />
                  <Text className="text-xs font-mono" style={{ color: accentColor }}>
                    {formatDuration(elapsed)}
                  </Text>
                </View>
              </View>
              {project && (
                <View className="flex-row items-center gap-1.5">
                  <Image
                    source={`sf:${project.icon}`}
                    style={{ width: 11, height: 11, tintColor: project.color }}
                  />
                  <Text className="text-zinc-500 text-xs">{project.name}</Text>
                </View>
              )}
            </View>
          </Animated.View>
        </View>
      </Pressable>
    </Animated.View>
  );
}
