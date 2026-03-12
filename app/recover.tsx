import { useSessionsStore } from "@/stores/sessions-store";
import { useProjects } from "@/stores/projects-store";
import { useRecoveryStore } from "@/stores/recovery-store";
import {
  useSuggestionsStore,
  getSmartDefaultApps,
} from "@/stores/suggestions-store";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Button, Input, PortalHost, Select } from "heroui-native";
import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type SelectOption = { value: string; label: string };

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatTimeRange(startISO: string, endISO: string): string {
  const start = new Date(startISO);
  const end = new Date(endISO);
  const startStr = start.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  const endStr = end.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${startStr} – ${endStr}`;
}

export default function RecoverScreen() {
  const insets = useSafeAreaInsets();
  const { projects } = useProjects();
  const { pending, clear } = useRecoveryStore();
  const { addSession } = useSessionsStore();
  const { learnFromSession, associations } = useSuggestionsStore();

  const [title, setTitle] = useState(() => {
    if (pending?.source === "calendar" && pending?.eventTitle) {
      return pending.eventTitle;
    }
    return "";
  });
  const [selectedProject, setSelectedProject] = useState<SelectOption | undefined>(() => {
    if (!pending?.suggestion.projectId) return undefined;
    const proj = projects.find((p) => p.id === pending.suggestion.projectId);
    return proj ? { value: proj.id, label: proj.name } : undefined;
  });
  const [selectedApps, setSelectedApps] = useState<Set<string>>(new Set());
  const hasInitializedApps = useRef(false);

  // Redirect back if no pending recovery
  useEffect(() => {
    if (!pending) {
      router.back();
    }
  }, [pending]);

  // Initialize smart-selected apps on mount
  useEffect(() => {
    if (!pending || hasInitializedApps.current) return;
    hasInitializedApps.current = true;
    const defaults = getSmartDefaultApps(
      pending.apps,
      pending.suggestion.projectId,
      associations
    );
    setSelectedApps(defaults);
  }, [pending, associations]);

  if (!pending) {
    return null;
  }

  const selectedProj = projects.find((p) => p.id === selectedProject?.value);
  const selected = pending.apps.filter((a) => selectedApps.has(a.app));
  const durationSeconds = Math.floor(
    selected.reduce((sum, a) => sum + a.duration, 0)
  );

  const handleToggleApp = (app: string) => {
    const newSelected = new Set(selectedApps);
    if (newSelected.has(app)) {
      newSelected.delete(app);
    } else {
      newSelected.add(app);
    }
    setSelectedApps(newSelected);
  };

  const handleLog = () => {
    if (!title.trim() || !selectedProject) return;

    // Adjust endTime to match selected apps' duration
    const startDate = new Date(pending.startTime);
    const adjustedEndTime = new Date(startDate.getTime() + durationSeconds * 1000).toISOString();

    addSession({
      id: Date.now().toString(),
      title: title.trim(),
      projectId: selectedProject.value,
      startTime: pending.startTime,
      endTime: adjustedEndTime,
      duration: durationSeconds,
      apps: selected.length > 0 ? selected : undefined,
    });

    // Learn from session if we have app data
    if (selected.length > 0) {
      learnFromSession(selected, selectedProject.value);
    }

    clear();
    router.back();
  };

  const handleDismiss = () => {
    clear();
    router.back();
  };

  return (
    <KeyboardAvoidingView
      behavior="padding"
      className="flex-1 bg-[#111113]"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      {/* Nav bar */}
      <View className="flex-row items-center justify-between px-5 pt-2 pb-4">
        <Pressable onPress={handleDismiss} hitSlop={12}>
          <Text className="text-neutral-400 text-base">Cancel</Text>
        </Pressable>
        <Text className="text-white text-base font-semibold">Recover</Text>
        <View className="w-14" />
      </View>

      <ScrollView contentInsetAdjustmentBehavior="automatic" className="flex-1 px-6">
        {/* Header card: calendar-specific or AW-based */}
        {pending.source === "calendar" ? (
          <View className="mb-6 rounded-3xl p-5 bg-[#1a1a1c] border border-zinc-800">
            <View className="flex-row items-center gap-2 mb-3">
              <Image
                source="sf:calendar.badge.exclamationmark"
                style={{ width: 20, height: 20, tintColor: "#f59e0b" }}
              />
              <Text className="text-amber-400 text-sm font-semibold">
                Calendar event not logged
              </Text>
            </View>
            <Text className="text-white text-lg font-semibold mb-1">
              {pending.eventTitle}
            </Text>
            <Text className="text-zinc-400 text-sm mb-2">
              {formatTimeRange(pending.startTime, pending.endTime)}
            </Text>
            <Text className="text-zinc-500 text-sm">
              {formatDuration(durationSeconds)}
            </Text>
          </View>
        ) : (
          <View className="mb-6 rounded-3xl p-5 bg-[#1a1a1c] border border-zinc-800">
            <View className="flex-row items-center gap-2 mb-3">
              <Image
                source="sf:clock.badge.exclamationmark"
                style={{ width: 20, height: 20, tintColor: "#f59e0b" }}
              />
              <Text className="text-amber-400 text-sm font-semibold">
                Activity not tracked
              </Text>
            </View>
            <Text className="text-white text-lg font-semibold mb-2">
              {formatTimeRange(pending.startTime, pending.endTime)}
            </Text>
            <Text className="text-zinc-400 text-sm">
              {formatDuration(durationSeconds)}
            </Text>
          </View>
        )}

        {/* Title input */}
        <View className="mb-4">
          <Input
            placeholder="What was this session?"
            value={title}
            onChangeText={setTitle}
            autoFocus
          />
        </View>

        {/* Project selector */}
        <View className="mb-6">
          <Select
            value={selectedProject}
            onValueChange={(v) => setSelectedProject(v as SelectOption | undefined)}
          >
            <Select.Trigger>
              <View className="flex-row items-center gap-2 flex-1">
                {selectedProj && (
                  <Image
                    source={`sf:${selectedProj.icon}`}
                    style={{
                      width: 16,
                      height: 16,
                      tintColor: selectedProj.color,
                    }}
                  />
                )}
                <Select.Value placeholder="Project (optional)" />
              </View>
              <Select.TriggerIndicator />
            </Select.Trigger>
            <Select.Portal hostName="recover-modal">
              <Select.Overlay />
              <Select.Content presentation="popover" width="trigger">
                <Select.ListLabel>Select a project</Select.ListLabel>
                {projects.map((p) => (
                  <Select.Item key={p.id} value={p.id} label={p.name}>
                    <View className="flex-row items-center gap-3 flex-1">
                      <Image
                        source={`sf:${p.icon}`}
                        style={{
                          width: 18,
                          height: 18,
                          tintColor: p.color,
                        }}
                      />
                      <Select.ItemLabel />
                    </View>
                    <Select.ItemIndicator />
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Portal>
          </Select>
        </View>

        {/* Apps section */}
        <View className="mb-6">
          <Text className="text-white text-base font-semibold mb-3">Apps Detected</Text>
          {pending.apps.length === 0 ? (
            <View className="items-center justify-center py-8 rounded-2xl bg-[#1a1a1c] border border-zinc-800">
              <Text className="text-zinc-400 text-base">No activity detected</Text>
            </View>
          ) : (
            <View className="rounded-2xl bg-[#1a1a1c] border border-zinc-800 overflow-hidden">
              {pending.apps.map((app, i) => {
                const isSelected = selectedApps.has(app.app);
                const titles = app.titles ?? [];
                return (
                  <Pressable
                    key={app.app}
                    onPress={() => handleToggleApp(app.app)}
                    className={`flex-row items-start gap-3 px-4 py-3 ${
                      i < pending.apps.length - 1 ? "border-b border-zinc-800" : ""
                    }`}
                  >
                    <View className="pt-1">
                      <View
                        className={`w-5 h-5 rounded border-2 items-center justify-center ${
                          isSelected
                            ? "border-blue-500 bg-blue-500"
                            : "border-zinc-600"
                        }`}
                      >
                        {isSelected && (
                          <Text className="text-white text-xs font-bold">✓</Text>
                        )}
                      </View>
                    </View>
                    <View className="flex-1">
                      <View className="flex-row items-baseline gap-2 mb-1">
                        <Text className="text-white text-base font-medium">
                          {app.app}
                        </Text>
                        <Text className="text-zinc-500 text-sm">
                          {formatDuration(app.duration)}
                        </Text>
                      </View>
                      {titles.length > 0 && (
                        <View className="gap-0.5">
                          {titles.slice(0, 2).map((t, idx) => (
                            <Text
                              key={idx}
                              className="text-zinc-400 text-xs"
                              numberOfLines={1}
                            >
                              · {t}
                            </Text>
                          ))}
                        </View>
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Action buttons */}
      <View className="px-6 gap-2 py-4">
        <Button
          variant="primary"
          onPress={handleLog}
          isDisabled={!title.trim() || !selectedProject}
        >
          <Button.Label>Log This Session</Button.Label>
        </Button>
        <Button variant="ghost" onPress={handleDismiss}>
          <Button.Label>Dismiss</Button.Label>
        </Button>
      </View>

      <PortalHost name="recover-modal" />
    </KeyboardAvoidingView>
  );
}
