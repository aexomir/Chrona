import type { Project } from "@/constants/projects";
import { Image } from "expo-image";
import { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}

export function ProjectTile({
  project,
  selected,
  onToggle,
  flex,
  delay,
}: {
  project: Project;
  selected: boolean;
  onToggle: (id: string) => void;
  flex: number;
  delay: number;
}) {
  const rgb = hexToRgb(project.color);
  const progress = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(selected ? 1 : 0, { duration: 220 });
  }, [selected, progress]);

  const tileStyle = useAnimatedStyle(() => ({
    backgroundColor: `rgba(${rgb}, ${0.04 + progress.value * 0.28})`,
  }));

  const iconStyle = useAnimatedStyle(() => ({
    opacity: 0.18 + progress.value * 0.82,
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: 0.25 + progress.value * 0.75,
  }));

  return (
    <Animated.View
      entering={FadeIn.delay(delay).duration(350)}
      style={{ flex }}
    >
      <Pressable onPress={() => onToggle(project.id)} className="flex-1">
        <Animated.View style={[styles.tile, tileStyle]}>
          <Animated.View style={iconStyle}>
            <Image
              source={`sf:${project.icon}`}
              style={styles.icon}
              tintColor={project.color}
            />
          </Animated.View>

          <View className="flex-1 justify-end">
            <Animated.Text style={[styles.label, labelStyle]}>
              {project.name}
            </Animated.Text>
          </View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    borderRadius: 6,
    padding: 12,
  },
  icon: {
    width: 22,
    height: 22,
  },
  label: {
    fontSize: 13,
    fontWeight: "500",
    letterSpacing: -0.2,
    color: "white",
  },
});
