import { TimerContext } from "@/contexts/timer-context";
import { useProjects } from "@/stores/projects-store";
import { Image } from "expo-image";
import { Button, Input, PortalHost, Select } from "heroui-native";
import React, { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Pressable,
  StyleSheet,
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
  const { projects } = useProjects();
  const {
    isTracking,
    title,
    projectId,
    elapsedSeconds,
    startTimer,
    stopTimer,
    updateTitle,
    updateProjectId,
  } = React.use(TimerContext)!;

  const [taskTitle, setTaskTitle] = useState("");
  const [selectedProject, setSelectedProject] = useState<SelectOption | undefined>();
  const insets = useSafeAreaInsets();

  // When opening while tracking, pre-fill fields from current session
  useEffect(() => {
    if (isVisible && isTracking) {
      setTaskTitle(title);
      const proj = projects.find((p) => p.id === projectId);
      setSelectedProject(proj ? { value: proj.id, label: proj.name } : undefined);
    }
  }, [isVisible, isTracking]);

  const handleStart = () => {
    if (!taskTitle.trim()) return;
    startTimer(taskTitle.trim(), selectedProject?.value);
    setTaskTitle("");
    setSelectedProject(undefined);
    onClose();
  };

  const handleStop = () => {
    stopTimer();
    onClose();
  };

  const handleProjectChange = (v: SelectOption | undefined) => {
    setSelectedProject(v);
    updateProjectId(v?.value ?? null);
  };

  const selProj = projects.find((p) => p.id === selectedProject?.value);

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior="padding"
        className="flex-1 bg-[#111113]"
        style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
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
          <View className="flex-1 justify-center px-6 gap-5">
            {/* Timer display */}
            <View
              className="items-center justify-center rounded-3xl py-8 bg-[#1a1a1c]"
              style={styles.card}
            >
              <Text className="text-neutral-500 text-xs uppercase tracking-widest mb-2">
                elapsed
              </Text>
              <Text className="text-white text-7xl font-mono font-bold">
                {formatTime(elapsedSeconds)}
              </Text>
            </View>

            {/* Editable fields */}
            <Input
              placeholder="What are you working on?"
              value={taskTitle}
              onChangeText={setTaskTitle}
              onBlur={() => { if (taskTitle.trim()) updateTitle(taskTitle.trim()); }}
              onSubmitEditing={() => { if (taskTitle.trim()) updateTitle(taskTitle.trim()); }}
              returnKeyType="done"
            />

            <Select
              value={selectedProject}
              onValueChange={(v) => handleProjectChange(v as SelectOption | undefined)}
            >
              <Select.Trigger>
                <View className="flex-row items-center gap-2 flex-1">
                  {selProj && (
                    <Image
                      source={`sf:${selProj.icon}`}
                      style={[styles.icon16, { tintColor: selProj.color }]}
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
                  {projects.map((p) => (
                    <Select.Item key={p.id} value={p.id} label={p.name}>
                      <View className="flex-row items-center gap-3 flex-1">
                        <Image
                          source={`sf:${p.icon}`}
                          style={[styles.icon18, { tintColor: p.color }]}
                        />
                        <Select.ItemLabel />
                      </View>
                      <Select.ItemIndicator />
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Portal>
            </Select>

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

            <Select
              value={selectedProject}
              onValueChange={(v) => setSelectedProject(v as SelectOption)}
            >
              <Select.Trigger>
                <View className="flex-row items-center gap-2 flex-1">
                  {selProj && (
                    <Image
                      source={`sf:${selProj.icon}`}
                      style={[styles.icon16, { tintColor: selProj.color }]}
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
                  {projects.map((p) => (
                    <Select.Item key={p.id} value={p.id} label={p.name}>
                      <View className="flex-row items-center gap-3 flex-1">
                        <Image
                          source={`sf:${p.icon}`}
                          style={[styles.icon18, { tintColor: p.color }]}
                        />
                        <Select.ItemLabel />
                      </View>
                      <Select.ItemIndicator />
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Portal>
            </Select>

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

const styles = StyleSheet.create({
  card: {
    shadowColor: "#000",
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
  },
  icon16: {
    width: 16,
    height: 16,
  },
  icon18: {
    width: 18,
    height: 18,
  },
});
