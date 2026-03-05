import { PROJECTS } from "@/constants/projects";
import { TimerContext } from "@/contexts/timer-context";
import { Image } from "expo-image";
import { Button, Input, PortalHost, Select } from "heroui-native";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Pressable,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type SelectOption = { value: string; label: string };

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

type TimerModalProps = {
  isVisible: boolean;
  onClose: () => void;
};

export function TimerModal({ isVisible, onClose }: TimerModalProps) {
  const { isTracking, title, project, elapsedSeconds, startTimer, stopTimer } =
    React.use(TimerContext)!;

  const [taskTitle, setTaskTitle] = useState("");
  const [selectedProject, setSelectedProject] = useState<
    SelectOption | undefined
  >();
  const insets = useSafeAreaInsets();

  const handleStart = () => {
    if (!taskTitle.trim()) return;
    const proj = PROJECTS.find((p) => p.id === selectedProject?.value);
    startTimer(taskTitle.trim(), proj);
    setTaskTitle("");
    setSelectedProject(undefined);
    onClose();
  };

  const handleStop = () => {
    stopTimer();
    onClose();
  };

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior="padding"
        style={{
          flex: 1,
          backgroundColor: "#111113",
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        }}
      >
        {/* Nav bar */}
        <View className="flex-row items-center justify-between px-5 pt-2 pb-4">
          <Pressable onPress={onClose} hitSlop={12}>
            <Text className="text-neutral-400 text-base">Cancel</Text>
          </Pressable>
          <Text className="text-white text-base font-semibold">
            {isTracking ? "Tracking" : "New Timer"}
          </Text>
          <View className="w-14" />
        </View>

        {isTracking ? (
          <View className="flex-1 justify-center px-6 gap-8">
            {/* Timer display — neumorphic card */}
            <View
              className="items-center justify-center rounded-3xl py-10 gap-3"
              style={{
                backgroundColor: "#1a1a1c",
                shadowColor: "#000",
                shadowOffset: { width: 6, height: 6 },
                shadowOpacity: 0.6,
                shadowRadius: 12,
              }}
            >
              <Text className="text-neutral-500 text-sm uppercase tracking-widest">
                elapsed
              </Text>
              <Text className="text-white text-7xl font-mono font-bold">
                {formatTime(elapsedSeconds)}
              </Text>
              <Text
                className="text-neutral-400 text-base text-center"
                numberOfLines={2}
              >
                {title}
              </Text>
              {project && (
                <View className="flex-row items-center gap-2 mt-1">
                  <Image
                    source={`sf:${project.icon}`}
                    style={{ width: 14, height: 14, tintColor: project.color }}
                  />
                  <Text style={{ color: project.color }} className="text-sm font-medium">
                    {project.name}
                  </Text>
                </View>
              )}
            </View>

            <Button variant="danger" onPress={handleStop}>
              <Button.Label>Stop Timer</Button.Label>
            </Button>
          </View>
        ) : (
          <View className="flex-1 justify-center px-6 gap-5">
            <Input
              placeholder="What are you working on?"
              value={taskTitle}
              onChangeText={setTaskTitle}
              onSubmitEditing={handleStart}
              returnKeyType="go"
              autoFocus
            />

            {(() => {
              const selProj = PROJECTS.find((p) => p.id === selectedProject?.value);
              return (
                <Select
                  value={selectedProject}
                  onValueChange={(v) => setSelectedProject(v as SelectOption)}
                >
                  <Select.Trigger>
                    <View className="flex-row items-center gap-2 flex-1">
                      {selProj && (
                        <Image
                          source={`sf:${selProj.icon}`}
                          style={{ width: 16, height: 16, tintColor: selProj.color }}
                        />
                      )}
                      <Select.Value placeholder="Project (optional)" />
                    </View>
                    <Select.TriggerIndicator />
                  </Select.Trigger>
                  <Select.Portal hostName="timer-modal">
                    <Select.Overlay />
                    <Select.Content presentation="popover" width="trigger">
                      <Select.ListLabel>Select a project</Select.ListLabel>
                      {PROJECTS.map((p) => (
                        <Select.Item key={p.id} value={p.id} label={p.name}>
                          <View className="flex-row items-center gap-3 flex-1">
                            <Image
                              source={`sf:${p.icon}`}
                              style={{ width: 18, height: 18, tintColor: p.color }}
                            />
                            <Select.ItemLabel />
                          </View>
                          <Select.ItemIndicator />
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Portal>
                </Select>
              );
            })()}

            <Button
              variant="primary"
              onPress={handleStart}
              isDisabled={!taskTitle.trim()}
            >
              <Button.Label>Start Timer</Button.Label>
            </Button>
          </View>
        )}
      </KeyboardAvoidingView>
      <PortalHost name="timer-modal" />
    </Modal>
  );
}
