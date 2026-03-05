import { TimerModal } from "@/components/timer-modal";
import { TimerContext } from "@/contexts/timer-context";
import { Image } from "expo-image";
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";

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
  const { isTracking, title, project, elapsedSeconds } = React.use(TimerContext)!;
  const [isModalVisible, setIsModalVisible] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => setIsModalVisible(true)}
        className="bg-black/80 px-4 py-3"
      >
        {isTracking ? (
          <View className="flex-row items-center justify-center gap-2">
            {project ? (
              <Image
                source={`sf:${project.icon}`}
                style={{ width: 13, height: 13, tintColor: project.color }}
              />
            ) : (
              <View className="w-2 h-2 rounded-full bg-red-500" />
            )}
            <Text className="text-white text-sm flex-shrink" numberOfLines={1}>
              {title}
            </Text>
            {project && (
              <Text className="text-neutral-500 text-sm flex-shrink-0" numberOfLines={1}>
                {project.name}
              </Text>
            )}
            <Text className="text-white text-sm font-mono font-semibold flex-shrink-0">
              {formatTime(elapsedSeconds)}
            </Text>
          </View>
        ) : (
          <Text className="text-white text-sm text-center">
            Tap to start a timer
          </Text>
        )}
      </Pressable>

      <TimerModal
        isVisible={isModalVisible}
        onClose={() => setIsModalVisible(false)}
      />
    </>
  );
}
