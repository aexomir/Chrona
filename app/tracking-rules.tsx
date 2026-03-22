import { Image } from "expo-image";
import { useTrackingRulesStore } from "@/features/tracking-rules/tracking-rules-store";
import { useProjects } from "@/features/projects/projects-store";
import { useSettingsStore } from "@/features/settings/settings-store";
import { useAutoTrackingStore } from "@/features/activity-watch/auto-tracking-store";
import { useAuroraTheme } from "@/features/aurora/use-aurora-theme";
import { ListGroup, Separator, Switch } from "heroui-native";
import { useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function TrackingRulesScreen() {
  const theme = useAuroraTheme();
  const { rules, removeRule } = useTrackingRulesStore();
  const { projects } = useProjects();
  const { autoTrackingEnabled, setAutoTrackingEnabled } = useSettingsStore();
  const { detectedApp, matchedRuleId } = useAutoTrackingStore();
  const [liveRule, setLiveRule] = useState<{
    rule: typeof rules[0];
    project: typeof projects[0];
  } | null>(null);

  // Update live rule status
  useEffect(() => {
    if (!detectedApp || !matchedRuleId || !autoTrackingEnabled) {
      setLiveRule(null);
      return;
    }
    const rule = rules.find((r) => r.id === matchedRuleId);
    if (!rule) {
      setLiveRule(null);
      return;
    }
    const project = projects.find((p) => p.id === rule.projectId);
    if (!project) {
      setLiveRule(null);
      return;
    }
    setLiveRule({ rule, project });
  }, [detectedApp, matchedRuleId, autoTrackingEnabled, rules, projects]);

  const handleDelete = (id: string) => {
    Alert.alert("Delete Rule", "This action cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => removeRule(id) },
    ]);
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      className="flex-1"
      style={{ backgroundColor: theme.modalSheet }}
      contentContainerClassName="px-5 pb-10"
    >
      <View className="mt-8 mb-8">
        <Text className="text-white text-4xl font-bold">Tracking Rules</Text>
      </View>

      {/* Live Status Card */}
      <View
        className="mb-6 rounded-3xl p-5 border overflow-hidden"
        style={{ backgroundColor: theme.card, borderColor: theme.cardBorder }}
      >
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row items-center gap-2 flex-1">
            <View
              className={`w-2 h-2 rounded-full ${
                autoTrackingEnabled ? "bg-green-500" : "bg-zinc-600"
              }`}
            />
            <Text className="text-white text-base font-semibold">
              Auto Tracking
            </Text>
          </View>
          <Switch
            isSelected={autoTrackingEnabled}
            onSelectedChange={setAutoTrackingEnabled}
          />
        </View>

        {autoTrackingEnabled && liveRule ? (
          <View className="pt-3 border-t" style={{ borderTopColor: theme.cardBorder }}>
            <View className="flex-row items-center gap-2">
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 6,
                  backgroundColor: liveRule.project.color,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Image
                  source={`sf:${liveRule.project.icon}`}
                  style={{ width: 12, height: 12 }}
                  tintColor="#fff"
                />
              </View>
              <View className="flex-1">
                <Text className="text-zinc-500 text-xs">Active now</Text>
                <Text className="text-white text-sm font-medium">
                  {detectedApp}
                </Text>
                <Text className="text-zinc-400 text-xs mt-0.5">
                  → {liveRule.project.name}
                </Text>
              </View>
              <View className="w-2 h-2 rounded-full bg-green-500" />
            </View>
          </View>
        ) : !autoTrackingEnabled ? (
          <Text className="text-zinc-500 text-sm">
            Enable auto tracking to automatically log sessions
          </Text>
        ) : (
          <Text className="text-zinc-500 text-sm">
            No rules matching current app
          </Text>
        )}
      </View>

      {rules.length === 0 ? (
        <View className="items-center justify-center py-8">
          <Text className="text-neutral-500 text-center mb-3">
            No tracking rules yet
          </Text>
          <Text className="text-neutral-600 text-sm text-center max-w-xs">
            When the timer bar detects an untracked app, tap the hint to create a rule
          </Text>
        </View>
      ) : (
        <ListGroup className={theme.listGroupClassName}>
          {rules.map((rule, index) => {
            const project = projects.find((p) => p.id === rule.projectId);
            if (!project) return null;

            return (
              <View key={rule.id}>
                {index > 0 && <Separator className="mx-4" />}
                <ListGroup.Item>
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
                    <ListGroup.ItemTitle>{project.name}</ListGroup.ItemTitle>
                    <View className="flex-row items-center gap-2 mt-1">
                      <Text className="text-zinc-400 text-sm">{rule.appName}</Text>
                      {rule.windowTitleContains && (
                        <View className="bg-zinc-800 rounded-full px-2 py-0.5">
                          <Text className="text-zinc-300 text-xs">
                            title: {rule.windowTitleContains}
                          </Text>
                        </View>
                      )}
                    </View>
                  </ListGroup.ItemContent>
                  <ListGroup.ItemSuffix>
                    <TouchableOpacity
                      onPress={() => handleDelete(rule.id)}
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
      )}
    </ScrollView>
  );
}
