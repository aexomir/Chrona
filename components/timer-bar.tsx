import { TimerModal } from "@/components/timer-modal";
import { TimerContext } from "@/contexts/timer-context";
import { useProjects } from "@/stores/projects-store";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function TimerBar() {
  const { isTracking, title, projectId, elapsedSeconds } = React.use(TimerContext)!;
  const { projects } = useProjects();
  const project = projects.find((p) => p.id === projectId) ?? null;
  const [isModalVisible, setIsModalVisible] = useState(false);

  return (
    <>
      <Pressable onPress={() => setIsModalVisible(true)}>
        <BlurView intensity={60} tint="dark" style={styles.blur}>
          {isTracking ? (
            <View className="flex-row items-center justify-center gap-2">
              {project ? (
                <Image
                  source={`sf:${project.icon}`}
                  style={[styles.icon, { tintColor: project.color }]}
                />
              ) : (
                <View className="w-2 h-2 rounded-full bg-red-500" />
              )}
              <Text className="text-white text-sm shrink" numberOfLines={1}>
                {title}
              </Text>
              {project && (
                <Text className="text-neutral-500 text-sm shrink-0" numberOfLines={1}>
                  {project.name}
                </Text>
              )}
              <Text className="text-white text-sm font-mono font-semibold shrink-0">
                {formatTime(elapsedSeconds)}
              </Text>
            </View>
          ) : (
            <Text className="text-white/50 text-sm text-center">
              Tap to start a timer
            </Text>
          )}
        </BlurView>
      </Pressable>

      <TimerModal
        isVisible={isModalVisible}
        onClose={() => setIsModalVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  blur: {
    borderTopWidth: 0.5,
    borderTopColor: "rgba(255,255,255,0.12)",
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "rgba(18,18,20,0.55)",
  },
  icon: {
    width: 13,
    height: 13,
  },
});
