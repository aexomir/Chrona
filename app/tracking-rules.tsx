import { useTrackingRulesStore } from "@/features/auto-track/tracking-rules-store";
import { useProjects } from "@/features/projects/projects-store";
import { useAuroraTheme } from "@/features/aurora/use-aurora-theme";
import { useAppToast } from "@/hooks/use-app-toast";
import { Image } from "expo-image";
import { Stack, useRouter } from "expo-router";
import { ListGroup, PortalHost, Select, Separator } from "heroui-native";
import { useState } from "react";
import {
  Alert,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { StaticAuraBackground } from "@/features/aurora/static-aura-background";
import { AnimatedHeaderScrollView } from "@/components/animated-header-scroll-view";

type SelectOption = { value: string; label: string };

function SectionLabel({ children }: { children: string }) {
  return (
    <Text className="text-xs text-neutral-500 uppercase tracking-widest mb-2 ml-1">
      {children}
    </Text>
  );
}

export default function TrackingRulesScreen() {
  const router = useRouter();
  const theme = useAuroraTheme();
  const toast = useAppToast();
  const { projects } = useProjects();
  const { rules, addRule, removeRule } = useTrackingRulesStore();

  const [modalVisible, setModalVisible] = useState(false);
  const [ruleName, setRuleName] = useState("");
  const [appName, setAppName] = useState("");
  const [titleKeywords, setTitleKeywords] = useState("");
  const [selectedProject, setSelectedProject] = useState<SelectOption | undefined>();

  function openAddModal() {
    setRuleName("");
    setAppName("");
    setTitleKeywords("");
    setSelectedProject(undefined);
    setModalVisible(true);
  }

  function saveRule() {
    if (!selectedProject || !appName.trim()) return;

    const keywords = titleKeywords
      .split(",")
      .map((k) => k.trim())
      .filter((k) => k.length > 0);

    addRule({
      appName: appName.trim(),
      titleKeywords: keywords,
      projectId: selectedProject.value,
      defaultTitle: ruleName.trim() || undefined,
    });

    setModalVisible(false);
    toast.show({ label: "Rule added", variant: "success" });
  }

  function confirmDelete(id: string) {
    Alert.alert("Delete Rule", "This action cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          removeRule(id);
          toast.show({ label: "Rule removed" });
        },
      },
    ]);
  }

  const canSave = !!selectedProject && appName.trim().length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <StaticAuraBackground />
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button
          icon="chevron.left"
          onPress={() => router.back()}
        />
      </Stack.Toolbar>
      <AnimatedHeaderScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
      >
        <Text className="text-neutral-500 text-sm mb-8 leading-relaxed">
          Auto-tracking rules start a timer automatically when a matched app is active. Rules with title keywords are more specific and take priority.
        </Text>

        {rules.length > 0 && (
          <>
            <SectionLabel>Rules</SectionLabel>
            <ListGroup className={`mb-6 ${theme.listGroupClassName}`}>
              {rules.map((rule, index) => {
                const project = projects.find((p) => p.id === rule.projectId);
                if (!project) return null;
                const isInactive = rule.active === false;

                return (
                  <View key={rule.id}>
                    {index > 0 && <Separator className="mx-4" />}
                    <ListGroup.Item style={isInactive ? { opacity: 0.5 } : undefined}>
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
                                <Text className="text-white/50 text-xs">{kw}</Text>
                              </View>
                            ))}
                          </View>
                        )}
                        {isInactive && (
                          <Text className="text-neutral-600 text-xs mt-1">
                            Inactive
                          </Text>
                        )}
                      </ListGroup.ItemContent>
                      <ListGroup.ItemSuffix>
                        <TouchableOpacity
                          onPress={() => confirmDelete(rule.id)}
                          className="p-2"
                        >
                          <Image
                            source="sf:trash"
                            style={{ width: 16, height: 16 }}
                            tintColor="#ef4444"
                          />
                        </TouchableOpacity>
                      </ListGroup.ItemSuffix>
                    </ListGroup.Item>
                  </View>
                );
              })}
            </ListGroup>
          </>
        )}

        {rules.length === 0 && (
          <Text className="text-neutral-500 text-center text-sm mb-6">
            No rules yet. Add one to start auto-tracking apps.
          </Text>
        )}

        <ListGroup className={theme.listGroupClassName}>
          <ListGroup.Item onPress={openAddModal}>
            <ListGroup.ItemPrefix>
              <Image
                source="sf:plus.circle.fill"
                style={{ width: 20, height: 20 }}
                tintColor="#3b82f6"
              />
            </ListGroup.ItemPrefix>
            <ListGroup.ItemContent>
              <ListGroup.ItemTitle className="text-blue-500">
                Add Rule
              </ListGroup.ItemTitle>
            </ListGroup.ItemContent>
          </ListGroup.Item>
        </ListGroup>
      </AnimatedHeaderScrollView>

      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <View className="flex-1 px-5 pt-6" style={{ backgroundColor: theme.modalSheet }}>
          <View className="flex-row items-center justify-between mb-8">
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text className="text-neutral-400 text-base">Cancel</Text>
            </TouchableOpacity>
            <Text className="text-white text-base font-semibold">Add Rule</Text>
            <TouchableOpacity onPress={saveRule} disabled={!canSave}>
              <Text className={`text-base font-semibold ${canSave ? "text-blue-500" : "text-neutral-600"}`}>
                Save
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled">
            <Text className="text-xs text-neutral-500 uppercase tracking-widest mb-3 ml-1">
              App Name
            </Text>
            <TextInput
              value={appName}
              onChangeText={setAppName}
              placeholder="e.g., Xcode, Safari, Figma"
              placeholderTextColor="#636366"
              className="text-white px-4 py-3 rounded-xl text-base mb-8 border border-white/10"
              style={{ backgroundColor: "transparent" }}
              autoCapitalize="words"
              autoCorrect={false}
            />

            <Text className="text-xs text-neutral-500 uppercase tracking-widest mb-3 ml-1">
              Title Keywords
              <Text className="text-neutral-600 normal-case tracking-normal"> (optional, comma-separated)</Text>
            </Text>
            <TextInput
              value={titleKeywords}
              onChangeText={setTitleKeywords}
              placeholder="e.g., .swift, pull request, design"
              placeholderTextColor="#636366"
              className="text-white px-4 py-3 rounded-xl text-base mb-8 border border-white/10"
              style={{ backgroundColor: "transparent" }}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text className="text-xs text-neutral-500 uppercase tracking-widest mb-3 ml-1">
              Session Name
              <Text className="text-neutral-600 normal-case tracking-normal"> (optional)</Text>
            </Text>
            <TextInput
              value={ruleName}
              onChangeText={setRuleName}
              placeholder="Defaults to app name"
              placeholderTextColor="#636366"
              className="text-white px-4 py-3 rounded-xl text-base mb-8 border border-white/10"
              style={{ backgroundColor: "transparent" }}
              autoCapitalize="words"
            />

            <Text className="text-xs text-neutral-500 uppercase tracking-widest mb-3 ml-1">
              Project
            </Text>
            <View className="mb-6">
              <Select
                value={selectedProject}
                onValueChange={(v) =>
                  setSelectedProject(v as SelectOption | undefined)
                }
              >
                <Select.Trigger className="bg-transparent shadow-none border border-white/10">
                  <Text className="text-white flex-1">
                    {selectedProject
                      ? projects.find((p) => p.id === selectedProject.value)?.name
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
                        onValueChange={(v) =>
                          setSelectedProject({
                            value: v,
                            label: projects.find((proj) => proj.id === v)?.name || "",
                          })
                        }
                      >
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
          </ScrollView>

          <PortalHost name="tracking-rules" />
        </View>
      </Modal>
    </View>
  );
}
