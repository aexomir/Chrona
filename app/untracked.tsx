import { useTrackingRulesStore } from "@/stores/tracking-rules-store";
import { useProjects } from "@/stores/projects-store";
import { StaticAuraBackground } from "@/components/static-aura-background";
import { useAuroraTheme } from "@/hooks/use-aurora-theme";
import { Image } from "expo-image";
import { useLocalSearchParams, router } from "expo-router";
import { Button, Input, PortalHost, Select, Switch } from "heroui-native";
import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type SelectOption = { value: string; label: string };

export default function UntrackedScreen() {
  const insets = useSafeAreaInsets();
  const theme = useAuroraTheme();
  const { projects } = useProjects();
  const { addRule } = useTrackingRulesStore();
  const { app, title } = useLocalSearchParams<{
    app?: string;
    title?: string;
  }>();

  const [selectedProject, setSelectedProject] = useState<SelectOption | undefined>();
  const [matchTitle, setMatchTitle] = useState(false);
  const [windowTitleFilter, setWindowTitleFilter] = useState("");
  const [defaultTitle, setDefaultTitle] = useState("");

  // Guard: redirect if app param missing
  useEffect(() => {
    if (!app) {
      router.back();
    }
  }, [app]);

  if (!app) {
    return null;
  }

  const selectedProj = projects.find((p) => p.id === selectedProject?.value);

  const handleCreateRule = () => {
    if (!selectedProject) return;

    addRule(
      app,
      selectedProject.value,
      matchTitle && windowTitleFilter.trim() ? windowTitleFilter : undefined,
      defaultTitle.trim() || undefined
    );

    router.back();
  };

  const handleDismiss = () => {
    router.back();
  };

  return (
    <KeyboardAvoidingView
      behavior="padding"
      className="flex-1"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <StaticAuraBackground />
      {/* Nav bar */}
      <View className="flex-row items-center justify-between px-5 pt-2 pb-4">
        <Pressable onPress={handleDismiss} hitSlop={12}>
          <Text className="text-neutral-400 text-base">Cancel</Text>
        </Pressable>
        <Text className="text-white text-base font-semibold">Create Rule</Text>
        <View className="w-14" />
      </View>

      <ScrollView contentInsetAdjustmentBehavior="automatic" className="flex-1 px-6">
        {/* Header card: untracked app */}
        <View
          className="mb-6 rounded-3xl p-5 border"
          style={{ backgroundColor: theme.card, borderColor: theme.cardBorder }}
        >
          <View className="flex-row items-center gap-2 mb-3">
            <Image
              source="sf:app.badge.questionmark"
              style={{ width: 20, height: 20, tintColor: "#9ca3af" }}
            />
            <Text className="text-gray-400 text-sm font-semibold">Untracked App</Text>
          </View>
          <Text className="text-white text-lg font-semibold mb-1">{app}</Text>
          {title && (
            <Text className="text-zinc-400 text-sm" numberOfLines={2}>
              {title}
            </Text>
          )}
        </View>

        {/* Project selector */}
        <View className="mb-6">
          <Text className="text-white text-sm font-medium mb-2">Project *</Text>
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
                <Select.Value placeholder="Select a project" />
              </View>
              <Select.TriggerIndicator />
            </Select.Trigger>
            <Select.Portal hostName="untracked-modal">
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

        {/* Match window title toggle */}
        <View className="mb-4 flex-row items-center justify-between">
          <Text className="text-white text-sm font-medium">Match window title</Text>
          <Switch value={matchTitle} onValueChange={setMatchTitle} />
        </View>

        {/* Window title filter input */}
        {matchTitle && (
          <View className="mb-6">
            <Input
              placeholder="Contains (case-insensitive)"
              value={windowTitleFilter}
              onChangeText={setWindowTitleFilter}
              description="Rule only applies to windows with title containing this text"
            />
          </View>
        )}

        {/* Default title input */}
        <View className="mb-6">
          <Input
            placeholder="Default session title (optional)"
            value={defaultTitle}
            onChangeText={setDefaultTitle}
            description="If empty, uses app name"
          />
        </View>
      </ScrollView>

      {/* Action buttons */}
      <View className="px-6 gap-2 py-4">
        <Button
          variant="primary"
          onPress={handleCreateRule}
          isDisabled={!selectedProject}
        >
          <Button.Label>Create Rule</Button.Label>
        </Button>
        <Button variant="ghost" onPress={handleDismiss}>
          <Button.Label>Dismiss</Button.Label>
        </Button>
      </View>

      <PortalHost name="untracked-modal" />
    </KeyboardAvoidingView>
  );
}
