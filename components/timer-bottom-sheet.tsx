import React, { useState } from "react";
import { KeyboardAvoidingView, Text, View } from "react-native";
import { BottomSheet, Button, Input } from "heroui-native";
import { TimerContext } from "@/contexts/timer-context";

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

type TimerBottomSheetProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
};

export function TimerBottomSheet({ isOpen, onOpenChange }: TimerBottomSheetProps) {
  const { isTracking, title, elapsedSeconds, startTimer, stopTimer } =
    React.use(TimerContext)!;

  const [taskTitle, setTaskTitle] = useState("");

  const handleStart = () => {
    if (taskTitle.trim()) {
      startTimer(taskTitle.trim());
      setTaskTitle("");
      onOpenChange(false);
    }
  };

  const handleStop = () => {
    stopTimer();
    onOpenChange(false);
  };

  return (
    <BottomSheet isOpen={isOpen} onOpenChange={onOpenChange}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content snapPoints={["100%"]}>
          <KeyboardAvoidingView behavior="padding" className="flex-1">
            <View className="flex-1 px-6 pt-4 pb-8 gap-6">
              <BottomSheet.Close />
              {isTracking ? (
                <View className="flex-1 justify-center gap-6">
                  <BottomSheet.Title className="text-center">
                    Tracking Time
                  </BottomSheet.Title>
                  <Text className="text-white text-center text-6xl font-mono font-bold">
                    {formatTime(elapsedSeconds)}
                  </Text>
                  <Text
                    className="text-neutral-400 text-center text-base"
                    numberOfLines={2}
                  >
                    {title}
                  </Text>
                  <Button variant="danger" onPress={handleStop}>
                    <Button.Label>Stop Timer</Button.Label>
                  </Button>
                </View>
              ) : (
                <View className="flex-1 justify-center gap-6">
                  <BottomSheet.Title className="text-center">
                    Start Timer
                  </BottomSheet.Title>
                  <Input
                    placeholder="What are you working on?"
                    value={taskTitle}
                    onChangeText={setTaskTitle}
                    onSubmitEditing={handleStart}
                    returnKeyType="go"
                    autoFocus
                  />
                  <Button
                    variant="primary"
                    onPress={handleStart}
                    isDisabled={!taskTitle.trim()}
                  >
                    <Button.Label>Start Timer</Button.Label>
                  </Button>
                </View>
              )}
            </View>
          </KeyboardAvoidingView>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}
