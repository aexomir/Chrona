import { TimerBottomSheet } from "@/components/timer-bottom-sheet";
import { TimerContext } from "@/contexts/timer-context";
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
  const { isTracking, title, elapsedSeconds } = React.use(TimerContext)!;
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => setIsDialogOpen(true)}
        className="bg-black/80 px-4 py-3"
      >
        {isTracking ? (
          <View className="flex-row items-center justify-center gap-2">
            <View className="w-2 h-2 rounded-full bg-red-500" />
            <Text className="text-white text-sm" numberOfLines={1}>
              {title}
            </Text>
            <Text className="text-white text-sm font-mono font-semibold">
              {formatTime(elapsedSeconds)}
            </Text>
          </View>
        ) : (
          <Text className="text-white text-sm text-center">
            Tap to start a timer
          </Text>
        )}
      </Pressable>

      <TimerBottomSheet isOpen={isDialogOpen} onOpenChange={setIsDialogOpen} />
    </>
  );
}
