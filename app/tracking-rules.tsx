import { AnimatedHeaderScrollView } from "@/components/animated-header-scroll-view";
import { DeleteRow, FieldLabel, RuleInput } from "@/components/rule-form";
import { StaticAuraBackground } from "@/features/aurora/static-aura-background";
import { useAuroraTheme } from "@/features/aurora/use-aurora-theme";
import {
  useTrackingRulesStore,
  type TrackingRule,
} from "@/features/auto-track/tracking-rules-store";
import { useAppCatalogStore } from "@/features/intelligence/app-catalog";
import { useProjects } from "@/features/projects/projects-store";
import { useStreamStore } from "@/features/stream/stream-store";
import { useAppToast } from "@/hooks/use-app-toast";
import { Image } from "expo-image";
import { Stack, useRouter } from "expo-router";
import { ListGroup, PortalHost, Select, Separator } from "heroui-native";
import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

type SelectOption = { value: string; label: string };

function EmptyState({
  currentAppName,
  onQuickAdd,
}: {
  currentAppName?: string;
  onQuickAdd: () => void;
}) {
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.7, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <View className="items-center justify-center pt-20 px-8">
      <Animated.View style={animStyle} className="mb-4">
        <Image
          source="sf:sparkle"
          style={{ width: 28, height: 28 }}
          tintColor="#52525b"
        />
      </Animated.View>
      <Text className="text-zinc-400 text-sm font-medium mb-2">
        No rules yet
      </Text>
      <Text className="text-zinc-600 text-xs text-center leading-relaxed mb-6">
        Rules start a timer automatically when a matched app becomes active.
      </Text>
      {currentAppName && (
        <Pressable
          onPress={onQuickAdd}
          className="flex-row items-center gap-1.5 px-3 py-2 rounded-full bg-white/8"
        >
          <Image
            source="sf:plus"
            style={{ width: 11, height: 11 }}
            tintColor="#a1a1aa"
          />
          <Text className="text-zinc-300 text-xs font-medium">
            Add rule for {currentAppName}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

function CompanionSection({
  ruleId,
  primaryBundleId,
  companions,
  nameIndex,
  onAdd,
  onRemove,
  onDelete,
}: {
  ruleId: string;
  primaryBundleId?: string;
  companions: string[];
  nameIndex: Record<string, string>;
  onAdd: (bundleId: string) => void;
  onRemove: (bundleId: string) => void;
  onDelete: () => void;
}) {
  const candidates = Object.entries(nameIndex).filter(
    ([bundleId]) =>
      bundleId !== primaryBundleId && !companions.includes(bundleId),
  );

  return (
    <>
      <FieldLabel>Companion Apps</FieldLabel>
      <Text className="text-zinc-600 text-xs mb-4 leading-relaxed">
        The session keeps running when you switch to these apps.
      </Text>

      {companions.length > 0 && (
        <View className="mb-3 gap-1">
          {companions.map((bundleId) => (
            <View
              key={bundleId}
              className="flex-row items-center px-4 py-3 rounded-xl border border-white/8"
            >
              <Text className="flex-1 text-white text-sm">
                {nameIndex[bundleId] ?? bundleId}
              </Text>
              <Pressable onPress={() => onRemove(bundleId)} hitSlop={10}>
                <Image
                  source="sf:xmark"
                  style={{ width: 12, height: 12 }}
                  tintColor="#52525b"
                />
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {candidates.length > 0 && (
        <View className="mb-8">
          <Select
            value={undefined}
            onValueChange={(v) => {
              if (v) onAdd((v as SelectOption).value);
            }}
          >
            <Select.Trigger className="bg-transparent shadow-none border border-white/10">
              <Text className="text-zinc-500 flex-1">Add companion app…</Text>
              <Select.TriggerIndicator />
            </Select.Trigger>
            <Select.Portal hostName="tracking-rules">
              <Select.Overlay />
              <Select.Content
                presentation="popover"
                width="trigger"
                className="border border-white/10 shadow-none"
                style={{ backgroundColor: "#18181b" }}
              >
                <Select.ListLabel>Known apps</Select.ListLabel>
                {candidates.map(([bundleId, appName]) => (
                  <Select.Item key={bundleId} value={bundleId} label={appName}>
                    <Select.ItemLabel />
                    <Select.ItemIndicator />
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Portal>
          </Select>
        </View>
      )}

      <Separator className="mb-6 opacity-20" />
      <DeleteRow onDelete={onDelete} />
      <View className="h-8" />
    </>
  );
}

export default function TrackingRulesScreen() {
  const router = useRouter();
  const theme = useAuroraTheme();
  const toast = useAppToast();
  const { projects } = useProjects();
  const { rules, addRule, updateRule, removeRule } = useTrackingRulesStore();
  const nameIndex = useAppCatalogStore((s) => s.nameIndex);
  const currentEvent = useStreamStore((s) => s.currentEvent);

  const [sheetMode, setSheetMode] = useState<"hidden" | "add" | "edit">(
    "hidden",
  );
  const [editingRuleId, setEditingRuleId] = useState<string | undefined>();
  const [ruleName, setRuleName] = useState("");
  const [appName, setAppName] = useState("");
  const [titleKeywords, setTitleKeywords] = useState("");
  const [selectedProject, setSelectedProject] = useState<
    SelectOption | undefined
  >();
  const [editingCompanions, setEditingCompanions] = useState<string[]>([]);
  const [quickAddBundleId, setQuickAddBundleId] = useState<
    string | undefined
  >();

  function openAddSheet() {
    setRuleName("");
    setAppName("");
    setTitleKeywords("");
    setSelectedProject(undefined);
    setEditingRuleId(undefined);
    setQuickAddBundleId(undefined);
    setSheetMode("add");
  }

  function openAddSheetForCurrentApp() {
    if (!currentEvent) return;
    openAddSheet();
    setAppName(currentEvent.appName);
    setQuickAddBundleId(currentEvent.bundleId);
  }

  function openEditSheet(rule: TrackingRule) {
    const project = projects.find((p) => p.id === rule.projectId);
    setRuleName(rule.defaultTitle ?? "");
    setAppName(rule.appName);
    setTitleKeywords(rule.titleKeywords.join(", "));
    setSelectedProject(
      project ? { value: project.id, label: project.name } : undefined,
    );
    setEditingCompanions(rule.companionBundleIds ?? []);
    setEditingRuleId(rule.id);
    setSheetMode("edit");
  }

  function closeSheet() {
    setSheetMode("hidden");
  }

  function saveRule() {
    if (!selectedProject || !appName.trim()) return;

    const keywords = titleKeywords
      .split(",")
      .map((k) => k.trim())
      .filter((k) => k.length > 0);

    if (sheetMode === "add") {
      addRule({
        appName: appName.trim(),
        titleKeywords: keywords,
        projectId: selectedProject.value,
        defaultTitle: ruleName.trim() || undefined,
        primaryBundleId: quickAddBundleId,
      });
      toast.show({ label: "Rule added", variant: "success" });
    } else if (sheetMode === "edit" && editingRuleId) {
      updateRule(editingRuleId, {
        appName: appName.trim(),
        titleKeywords: keywords,
        projectId: selectedProject.value,
        defaultTitle: ruleName.trim() || undefined,
        companionBundleIds: editingCompanions,
      });
      toast.show({ label: "Rule updated", variant: "success" });
    }

    closeSheet();
  }

  function handleDelete() {
    if (!editingRuleId) return;
    removeRule(editingRuleId);
    closeSheet();
    toast.show({ label: "Rule removed" });
  }

  const canSave = !!selectedProject && appName.trim().length > 0;
  const editingRule = rules.find((r) => r.id === editingRuleId);

  return (
    <View style={{ flex: 1, backgroundColor: theme.modalSheet }}>
      <StaticAuraBackground />
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button
          icon="chevron.left"
          onPress={() => router.back()}
        />
      </Stack.Toolbar>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button icon="plus" onPress={openAddSheet} />
      </Stack.Toolbar>
      <AnimatedHeaderScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
      >
        <Text className="text-neutral-500 text-sm mb-8 leading-relaxed">
          Auto-tracking rules start a timer automatically when a matched app is
          active. Rules with title keywords are more specific and take priority.
        </Text>

        {rules.length === 0 ? (
          <EmptyState
            currentAppName={currentEvent?.appName}
            onQuickAdd={openAddSheetForCurrentApp}
          />
        ) : (
          <>
            <View className="flex-row items-center justify-between mb-2 ml-1 mr-1">
              <Text className="text-xs text-neutral-500 uppercase tracking-widest">
                Rules
              </Text>
              {currentEvent && (
                <Pressable
                  onPress={openAddSheetForCurrentApp}
                  hitSlop={8}
                  className="flex-row items-center gap-1"
                >
                  <Image
                    source="sf:plus"
                    style={{ width: 10, height: 10 }}
                    tintColor="#71717a"
                  />
                  <Text className="text-zinc-500 text-xs font-medium">
                    Add for {currentEvent.appName}
                  </Text>
                </Pressable>
              )}
            </View>
            <ListGroup className={`mb-6 ${theme.listGroupClassName}`}>
              {rules.map((rule, index) => {
                const project = projects.find((p) => p.id === rule.projectId);
                if (!project) return null;
                const isInactive = rule.active === false;

                return (
                  <Animated.View
                    key={rule.id}
                    entering={FadeInDown.delay(index * 60)
                      .duration(400)
                      .easing(Easing.out(Easing.cubic))}
                  >
                    {index > 0 && <Separator className="mx-4" />}
                    <ListGroup.Item
                      onPress={() => openEditSheet(rule)}
                      style={isInactive ? { opacity: 0.45 } : undefined}
                    >
                      <ListGroup.ItemPrefix>
                        <View
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 8,
                            backgroundColor: project.color,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Image
                            source={`sf:${project.icon}`}
                            style={{ width: 16, height: 16 }}
                            tintColor="#fff"
                          />
                        </View>
                      </ListGroup.ItemPrefix>
                      <ListGroup.ItemContent>
                        <ListGroup.ItemTitle>
                          {rule.defaultTitle ?? rule.appName}
                        </ListGroup.ItemTitle>
                        {rule.defaultTitle && (
                          <Text className="text-zinc-500 text-xs mt-0.5">
                            {rule.appName}
                          </Text>
                        )}
                        {rule.titleKeywords.length > 0 && (
                          <View className="flex-row flex-wrap gap-1 mt-1.5">
                            {rule.titleKeywords.map((kw) => (
                              <View
                                key={kw}
                                className="rounded-full px-2 py-0.5 bg-white/8"
                              >
                                <Text className="text-white/50 text-xs">
                                  {kw}
                                </Text>
                              </View>
                            ))}
                          </View>
                        )}
                        {isInactive && (
                          <Text className="text-neutral-600 text-xs mt-1">
                            Inactive
                          </Text>
                        )}
                        {(rule.companionBundleIds?.length ?? 0) > 0 && (
                          <View className="flex-row items-center gap-1 mt-1.5">
                            <Image
                              source="sf:link"
                              style={{ width: 10, height: 10 }}
                              tintColor="#3f3f46"
                            />
                            <Text className="text-zinc-600 text-xs">
                              {rule.companionBundleIds!.length} companion
                              {rule.companionBundleIds!.length > 1 ? "s" : ""}
                            </Text>
                          </View>
                        )}
                      </ListGroup.ItemContent>
                      <ListGroup.ItemSuffix>
                        <Image
                          source="sf:chevron.right"
                          style={{ width: 12, height: 12 }}
                          tintColor="rgba(255,255,255,0.2)"
                        />
                      </ListGroup.ItemSuffix>
                    </ListGroup.Item>
                  </Animated.View>
                );
              })}
            </ListGroup>
          </>
        )}
      </AnimatedHeaderScrollView>

      <Modal
        visible={sheetMode !== "hidden"}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeSheet}
      >
        <KeyboardAvoidingView
          behavior="padding"
          className="flex-1 px-5 pt-6"
          style={{ backgroundColor: theme.modalSheet }}
        >
          <View className="flex-row items-center justify-between mb-8">
            <Pressable onPress={closeSheet} hitSlop={10}>
              <Text className="text-neutral-400 text-base">Cancel</Text>
            </Pressable>
            <Text className="text-white text-base font-semibold">
              {sheetMode === "add" ? "Add Rule" : "Edit Rule"}
            </Text>
            <Pressable onPress={saveRule} disabled={!canSave} hitSlop={10}>
              <Text
                className={`text-base font-semibold ${canSave ? "text-blue-500" : "text-neutral-600"}`}
              >
                Save
              </Text>
            </Pressable>
          </View>

          <ScrollView
            contentInsetAdjustmentBehavior="automatic"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <FieldLabel>App Name</FieldLabel>
            <RuleInput
              value={appName}
              onChangeText={setAppName}
              autoCapitalize="words"
            />

            <FieldLabel>
              Title Keywords{" "}
              <Text className="text-neutral-600 normal-case tracking-normal">
                (optional, comma-separated)
              </Text>
            </FieldLabel>
            <RuleInput
              value={titleKeywords}
              onChangeText={setTitleKeywords}
              autoCapitalize="none"
            />

            <FieldLabel>
              Session Name{" "}
              <Text className="text-neutral-600 normal-case tracking-normal">
                (optional)
              </Text>
            </FieldLabel>
            <RuleInput
              value={ruleName}
              onChangeText={setRuleName}
              autoCapitalize="words"
            />

            <FieldLabel>Project</FieldLabel>
            <View className="mb-8">
              <Select
                value={selectedProject}
                onValueChange={(v) =>
                  setSelectedProject(v as SelectOption | undefined)
                }
              >
                <Select.Trigger className="bg-transparent shadow-none border border-white/10">
                  <Text className="text-white flex-1">
                    {selectedProject
                      ? projects.find((p) => p.id === selectedProject.value)
                          ?.name
                      : "Select a project"}
                  </Text>
                  <Select.TriggerIndicator />
                </Select.Trigger>
                <Select.Portal hostName="tracking-rules">
                  <Select.Overlay />
                  <Select.Content
                    presentation="popover"
                    width="trigger"
                    className="border border-white/10 shadow-none"
                    style={{ backgroundColor: "#18181b" }}
                  >
                    <Select.ListLabel>Select a project</Select.ListLabel>
                    {projects.map((p) => (
                      <Select.Item
                        key={p.id}
                        value={p.id}
                        label={p.name}
                      >
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

            {sheetMode === "edit" && (
              <CompanionSection
                ruleId={editingRuleId!}
                primaryBundleId={editingRule?.primaryBundleId}
                companions={editingCompanions}
                nameIndex={nameIndex}
                onAdd={(bundleId) =>
                  setEditingCompanions((prev) => [...prev, bundleId])
                }
                onRemove={(bundleId) =>
                  setEditingCompanions((prev) =>
                    prev.filter((id) => id !== bundleId),
                  )
                }
                onDelete={handleDelete}
              />
            )}
          </ScrollView>

          <PortalHost name="tracking-rules" />
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
