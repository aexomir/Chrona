import { Semantic } from "@/constants/theme";
import { useAuroraTheme } from "@/features/aurora/use-aurora-theme";
import { useProjects } from "@/features/projects/projects-store";
import { useSessionsStore } from "@/features/sessions/sessions-store";
import {
  formatDateTime,
  formatDuration,
  formatTimeRange,
} from "@/features/timeline/timeline-utils";
import { DatePicker, Host } from "@expo/ui/swift-ui";
import { datePickerStyle } from "@expo/ui/swift-ui/modifiers";
import { Image } from "expo-image";
import { Link, router, Stack, useLocalSearchParams } from "expo-router";
import { BottomSheet, Input, PortalHost, Select } from "heroui-native";
import { useEffect, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type SelectOption = { value: string; label: string };

function SectionLabel({ label }: { label: string }) {
  return (
    <Text className="text-zinc-500 text-xs uppercase tracking-wider font-medium px-1 pt-4 pb-2">
      {label}
    </Text>
  );
}

export default function SessionDetailScreen() {
  const theme = useAuroraTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { sessions, updateSession, removeSession } = useSessionsStore();
  const { projects } = useProjects();

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

  const [showTimePicker, setShowTimePicker] = useState(false);
  const [editingField, setEditingField] = useState<"start" | "end" | null>(
    null,
  );

  useEffect(() => {
    if (!session) router.back();
  }, [session]);

  if (!session) return null;

  const computedDuration = Math.max(
    0,
    Math.floor((draftEndTime.getTime() - draftStartTime.getTime()) / 1000),
  );

  const selectedProj = projects.find((p) => p.id === draftProjectId?.value);

  const handleSave = () => {
    if (!draftTitle.trim()) {
      Alert.alert("Error", "Title is required");
      return;
    }
    updateSession({
      ...session,
      title: draftTitle.trim(),
      projectId: draftProjectId?.value ?? null,
      startTime: draftStartTime.toISOString(),
      endTime: draftEndTime.toISOString(),
      duration: computedDuration,
      notes: draftNotes.trim() || undefined,
    });
    router.back();
  };

  const handleDelete = () => {
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
  };

  const handleTimeChange = (date: Date) => {
    if (editingField === "start" && date < draftEndTime) {
      setDraftStartTime(date);
    } else if (editingField === "end" && date > draftStartTime) {
      setDraftEndTime(date);
    }
    setShowTimePicker(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.modalSheet }}>
      <Stack.Screen options={{ title: draftTitle || "Session" }} />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon="checkmark"
          tintColor={Semantic.info}
          variant="prominent"
          onPress={handleSave}
        />
        <Stack.Toolbar.Button
          icon="trash.fill"
          tintColor={Semantic.danger}
          variant="prominent"
          onPress={handleDelete}
        />
      </Stack.Toolbar>

      <Link.AppleZoomTarget>
        <KeyboardAwareScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 24 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View
            className="mb-6 rounded-3xl p-5 border"
            style={{
              backgroundColor: theme.card,
              borderColor: theme.cardBorder,
            }}
          >
            <Text
              className="text-white font-bold mb-1"
              style={{ fontSize: 40, letterSpacing: -1.5 }}
            >
              {formatDuration(computedDuration)}
            </Text>
            <View className="flex-row items-center gap-1.5 mb-4">
              <Text className="text-zinc-500 text-sm">
                {formatTimeRange(
                  draftStartTime.toISOString(),
                  draftEndTime.toISOString(),
                )}
              </Text>
              {session.auto && (
                <Image
                  source="sf:bolt.fill"
                  style={{ width: 9, height: 9 }}
                  tintColor="#71717a"
                />
              )}
            </View>
            {selectedProj && (
              <View className="flex-row items-center gap-2">
                <Image
                  source={`sf:${selectedProj.icon}`}
                  style={{ width: 13, height: 13, tintColor: selectedProj.color }}
                />
                <Text
                  className="text-sm font-medium"
                  style={{ color: selectedProj.color }}
                >
                  {selectedProj.name}
                </Text>
              </View>
            )}
          </View>

          <View className="mb-4">
            <SectionLabel label="Details" />
            <View
              className="rounded-2xl border overflow-hidden"
              style={{
                backgroundColor: theme.card,
                borderColor: theme.cardBorder,
              }}
            >
              <View
                className="px-4 py-3"
                style={{ borderBottomWidth: 1, borderBottomColor: theme.cardBorder }}
              >
                <Input
                  placeholder="Session title"
                  value={draftTitle}
                  onChangeText={setDraftTitle}
                  className="text-white bg-transparent border-white/10"
                />
              </View>
              <View className="px-4 py-3">
                <Select
                  value={draftProjectId}
                  onValueChange={(v) =>
                    setDraftProjectId(v as SelectOption | undefined)
                  }
                >
                  <Select.Trigger className="bg-transparent shadow-none border border-white/10">
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
                    <Select.Content
                      presentation="popover"
                      width="trigger"
                      className="border border-white/10 shadow-none"
                      style={{ backgroundColor: "#18181b" }}
                    >
                      <Select.ListLabel>Select a project</Select.ListLabel>
                      {projects.map((p) => (
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
              </View>
            </View>
          </View>

          <View className="mb-4">
            <SectionLabel label="Time" />
            <View
              className="rounded-2xl border overflow-hidden"
              style={{
                backgroundColor: theme.card,
                borderColor: theme.cardBorder,
              }}
            >
              <Pressable
                onPress={() => { setEditingField("start"); setShowTimePicker(true); }}
                className="flex-row items-center justify-between px-4 py-3"
                style={{ borderBottomWidth: 1, borderBottomColor: theme.cardBorder }}
              >
                <Text className="text-zinc-400 text-sm">Start</Text>
                <Text className="text-white text-sm font-medium">
                  {formatDateTime(draftStartTime)}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => { setEditingField("end"); setShowTimePicker(true); }}
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

          <View className="mb-4">
            <SectionLabel label="Notes" />
            <View
              className="rounded-2xl border px-4 py-3"
              style={{
                backgroundColor: theme.card,
                borderColor: theme.cardBorder,
              }}
            >
              <Input
                placeholder="Add notes..."
                value={draftNotes}
                onChangeText={setDraftNotes}
                multiline
                className="text-white bg-transparent border-transparent"
              />
            </View>
          </View>

          {session.apps && session.apps.length > 0 && (
            <View className="mb-2">
              <SectionLabel label="Apps" />
              <View
                className="rounded-2xl border overflow-hidden"
                style={{
                  backgroundColor: theme.card,
                  borderColor: theme.cardBorder,
                }}
              >
                {session.apps.map((app, i) => (
                  <View
                    key={app.app}
                    className="flex-row items-center justify-between px-4 py-3"
                    style={
                      i < session.apps!.length - 1
                        ? { borderBottomWidth: 1, borderBottomColor: theme.cardBorder }
                        : undefined
                    }
                  >
                    <Text className="text-white text-sm font-medium flex-1" numberOfLines={1}>
                      {app.app}
                    </Text>
                    <Text className="text-zinc-500 text-sm">
                      {formatDuration(app.duration)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </KeyboardAwareScrollView>
      </Link.AppleZoomTarget>

      <BottomSheet isOpen={showTimePicker} onOpenChange={setShowTimePicker}>
        <BottomSheet.Portal>
          <BottomSheet.Overlay />
          <BottomSheet.Content
            backgroundStyle={{ backgroundColor: theme.modalSheet }}
          >
            <Host matchContents>
              <DatePicker
                selection={editingField === "start" ? draftStartTime : draftEndTime}
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
          </BottomSheet.Content>
        </BottomSheet.Portal>
      </BottomSheet>

      <PortalHost name="session-detail" />
    </View>
  );
}
