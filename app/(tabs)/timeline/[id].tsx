import { TabBarContext } from "@/context/TabBarContext";
import { useProjects } from "@/stores/projects-store";
import { useSessionsStore } from "@/stores/sessions-store";
import {
  getSmartDefaultApps,
  useSuggestionsStore,
} from "@/stores/suggestions-store";
import { useAuroraTheme } from "@/hooks/use-aurora-theme";
import { DatePicker, Host } from "@expo/ui/swift-ui";
import { datePickerStyle } from "@expo/ui/swift-ui/modifiers";
import { Image } from "expo-image";
import {
  Link,
  router,
  useFocusEffect,
  useLocalSearchParams,
  useNavigation,
} from "expo-router";
import { Button, Input, PortalHost, Select } from "heroui-native";
import { use, useCallback, useEffect, useLayoutEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
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

function formatDateTime(date: Date): string {
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
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

function SectionLabel({ label }: { label: string }) {
  return (
    <Text className="text-zinc-500 text-xs uppercase tracking-wider font-medium px-4 pt-4 pb-2">
      {label}
    </Text>
  );
}

export default function SessionDetailScreen() {
  const theme = useAuroraTheme()
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { sessions, updateSession, removeSession } = useSessionsStore();
  const { projects } = useProjects();
  const { associations } = useSuggestionsStore();

  const session = sessions.find((s) => s.id === id);

  const [draftTitle, setDraftTitle] = useState(session?.title ?? "");
  const [draftProjectId, setDraftProjectId] = useState<
    SelectOption | undefined
  >(() => {
    if (!session?.projectId) return undefined;
    const proj = projects.find((p) => p.id === session.projectId);
    return proj ? { value: proj.id, label: proj.name } : undefined;
  });
  const [draftStartTime, setDraftStartTime] = useState(
    new Date(session?.startTime ?? new Date().toISOString()),
  );
  const [draftEndTime, setDraftEndTime] = useState(
    new Date(session?.endTime ?? new Date().toISOString()),
  );
  const [draftNotes, setDraftNotes] = useState(session?.notes ?? "");
  const [draftApps, setDraftApps] = useState<Set<string>>(() => {
    if (!session?.apps) return new Set();
    const defaults = getSmartDefaultApps(
      session.apps,
      session.projectId,
      associations,
    );
    return defaults;
  });

  const [showTimePicker, setShowTimePicker] = useState(false);
  const [editingField, setEditingField] = useState<"start" | "end" | null>(
    null,
  );

  const { setIsTabBarHidden } = use(TabBarContext);

  useFocusEffect(() => {
    setIsTabBarHidden(true);
    return () => setIsTabBarHidden(false);
  });

  useEffect(() => {
    if (!session) {
      router.back();
    }
  }, [session]);

  if (!session) {
    return null;
  }

  const computedDuration = Math.max(
    0,
    Math.floor((draftEndTime.getTime() - draftStartTime.getTime()) / 1000),
  );

  const hasChanges =
    draftTitle !== session.title ||
    draftProjectId?.value !== session.projectId ||
    draftStartTime.toISOString() !== session.startTime ||
    draftEndTime.toISOString() !== session.endTime ||
    draftNotes !== (session.notes ?? "") ||
    (session.apps && session.apps.some((a) => !draftApps.has(a.app)));

  const selectedProj = projects.find((p) => p.id === draftProjectId?.value);

  const handleToggleApp = (app: string) => {
    const newSelected = new Set(draftApps);
    if (newSelected.has(app)) {
      newSelected.delete(app);
    } else {
      newSelected.add(app);
    }
    setDraftApps(newSelected);
  };

  const handleSave = () => {
    if (!draftTitle.trim()) {
      Alert.alert("Error", "Title is required");
      return;
    }

    const updated = {
      ...session,
      title: draftTitle.trim(),
      projectId: draftProjectId?.value ?? null,
      startTime: draftStartTime.toISOString(),
      endTime: draftEndTime.toISOString(),
      duration: computedDuration,
      notes: draftNotes.trim() || undefined,
      apps: session.apps?.filter((a) => draftApps.has(a.app)),
    };

    updateSession(updated);
    router.back();
  };

  const handleDelete = useCallback(() => {
    Alert.alert("Delete Session", "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          removeSession(session.id);
          router.back();
        },
      },
    ]);
  }, [session.id, removeSession]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={handleDelete} hitSlop={12}>
          <Text style={{ color: "#f87171", fontSize: 16, fontWeight: "500" }}>
            Delete
          </Text>
        </Pressable>
      ),
    });
  }, [navigation, handleDelete]);

  const handleTimeChange = (date: Date) => {
    if (editingField === "start") {
      // Ensure start is before end
      if (date < draftEndTime) {
        setDraftStartTime(date);
      }
    } else if (editingField === "end") {
      // Ensure end is after start
      if (date > draftStartTime) {
        setDraftEndTime(date);
      }
    }
    setShowTimePicker(false);
  };

  return (
    <KeyboardAvoidingView
      behavior="padding"
      className="flex-1"
      style={{ paddingBottom: insets.bottom, backgroundColor: theme.modalSheet }}
    >
      <Link.AppleZoomTarget>
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          className="flex-1 px-6"
        >
          {/* Header summary card */}
          <View className="mb-6 rounded-3xl p-5 border" style={{ backgroundColor: theme.card, borderColor: theme.cardBorder }}>
            <Text className="text-white text-4xl font-bold mb-2">
              {formatDuration(computedDuration)}
            </Text>
            <Text className="text-zinc-500 text-sm mb-4">
              {formatTimeRange(
                draftStartTime.toISOString(),
                draftEndTime.toISOString(),
              )}
            </Text>
            {selectedProj && (
              <View className="flex-row items-center gap-2">
                <Image
                  source={`sf:${selectedProj.icon}`}
                  style={{
                    width: 14,
                    height: 14,
                    tintColor: selectedProj.color,
                  }}
                />
                <Text className="text-white text-sm font-medium">
                  {selectedProj.name}
                </Text>
              </View>
            )}
          </View>

          {/* Details section */}
          <View className="mb-4">
            <SectionLabel label="Details" />
            <View className="rounded-2xl border overflow-hidden" style={{ backgroundColor: theme.card, borderColor: theme.cardBorder }}>
              <View className="px-4 py-3" style={{ borderBottomWidth: 1, borderBottomColor: theme.cardBorder }}>
                <Input
                  placeholder="Session title"
                  value={draftTitle}
                  onChangeText={setDraftTitle}
                />
              </View>
              <View className="px-4 py-3">
                <Select
                  value={draftProjectId}
                  onValueChange={(v) =>
                    setDraftProjectId(v as SelectOption | undefined)
                  }
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
                      <Select.Value placeholder="Project" />
                    </View>
                    <Select.TriggerIndicator />
                  </Select.Trigger>
                  <Select.Portal hostName="session-detail">
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
            </View>
          </View>

          {/* Time section */}
          <View className="mb-4">
            <SectionLabel label="Time" />
            <View className="rounded-2xl border overflow-hidden" style={{ backgroundColor: theme.card, borderColor: theme.cardBorder }}>
              <Pressable
                onPress={() => {
                  setEditingField("start");
                  setShowTimePicker(true);
                }}
                className="flex-row items-center justify-between px-4 py-3"
                style={{ borderBottomWidth: 1, borderBottomColor: theme.cardBorder }}
              >
                <Text className="text-zinc-400 text-sm">Start</Text>
                <Text className="text-white text-sm font-medium">
                  {formatDateTime(draftStartTime)}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setEditingField("end");
                  setShowTimePicker(true);
                }}
                className="flex-row items-center justify-between px-4 py-3"
                style={{ borderBottomWidth: 1, borderBottomColor: theme.cardBorder }}
              >
                <Text className="text-zinc-400 text-sm">End</Text>
                <Text className="text-white text-sm font-medium">
                  {formatDateTime(draftEndTime)}
                </Text>
              </Pressable>
              <View className="flex-row items-center justify-between px-4 py-3">
                <Text className="text-zinc-400 text-sm">Duration</Text>
                <Text className="text-white text-sm font-medium">
                  {formatDuration(computedDuration)}
                </Text>
              </View>
            </View>
          </View>

          {/* Notes section */}
          <View className="mb-4">
            <SectionLabel label="Notes" />
            <View className="rounded-2xl border px-4 py-3" style={{ backgroundColor: theme.card, borderColor: theme.cardBorder }}>
              <Input
                placeholder="Add notes..."
                value={draftNotes}
                onChangeText={setDraftNotes}
                multiline
              />
            </View>
          </View>

          {/* Apps section */}
          {session.apps && session.apps.length > 0 && (
            <View className="mb-6">
              <SectionLabel label="Apps" />
              <View className="rounded-2xl border overflow-hidden" style={{ backgroundColor: theme.card, borderColor: theme.cardBorder }}>
                {session.apps.map((app, i) => {
                  const isSelected = draftApps.has(app.app);
                  const titles = app.titles ?? [];
                  return (
                    <Pressable
                      key={app.app}
                      onPress={() => handleToggleApp(app.app)}
                      className="flex-row items-start gap-3 px-4 py-3"
                      style={i < session.apps!.length - 1 ? { borderBottomWidth: 1, borderBottomColor: theme.cardBorder } : undefined}
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
                            <Text className="text-white text-xs font-bold">
                              ✓
                            </Text>
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
            </View>
          )}
        </ScrollView>
      </Link.AppleZoomTarget>

      {/* Action buttons */}
      <View className="px-6 gap-2 py-4">
        <Button
          variant="primary"
          onPress={handleSave}
          isDisabled={!draftTitle.trim() || !hasChanges}
        >
          <Button.Label>Save Changes</Button.Label>
        </Button>
      </View>

      {/* Time picker modal */}
      {showTimePicker && editingField && (
        <Modal
          transparent
          animationType="slide"
          onRequestClose={() => setShowTimePicker(false)}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setShowTimePicker(false)}
          />
          <View className="absolute bottom-0 left-0 right-0 rounded-t-2xl pb-safe" style={{ backgroundColor: theme.modalSheet }}>
            <Host matchContents>
              <DatePicker
                selection={
                  editingField === "start" ? draftStartTime : draftEndTime
                }
                displayedComponents={["date", "hourAndMinute"]}
                onDateChange={handleTimeChange}
                modifiers={[datePickerStyle("graphical")]}
              />
            </Host>
            <Pressable
              className="items-center py-4"
              onPress={() => setShowTimePicker(false)}
            >
              <Text className="text-white font-semibold text-base">Done</Text>
            </Pressable>
          </View>
        </Modal>
      )}

      <PortalHost name="session-detail" />
    </KeyboardAvoidingView>
  );
}
