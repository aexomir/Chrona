import type { AppUsage } from "@/stores/sessions-store";
import { Button } from "heroui-native";
import { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

type Props = {
  visible: boolean;
  apps: AppUsage[];
  loading: boolean;
  onSave: (selectedApps: AppUsage[]) => void;
  onSkip: () => void;
};

export function AwAppsModal({
  visible,
  apps,
  loading,
  onSave,
  onSkip,
}: Props) {
  const [selectedApps, setSelectedApps] = useState<Set<string>>(
    new Set(apps.map((a) => a.app))
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

  const handleSave = () => {
    const selected = apps.filter((a) => selectedApps.has(a.app));
    onSave(selected);
  };

  const isEmpty = apps.length === 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onSkip}
    >
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onSkip}
      />
      <View className="absolute bottom-0 left-0 right-0 bg-zinc-900 rounded-t-3xl pb-safe">
        {/* Handle */}
        <View className="items-center pt-3 pb-3">
          <View className="w-12 h-1.5 rounded-full bg-zinc-700" />
        </View>

        {/* Header */}
        <View className="px-5 pb-4 border-b border-zinc-800">
          <Text className="text-white text-lg font-semibold mb-1">
            Activity Detected
          </Text>
          <Text className="text-zinc-400 text-sm">
            Select what to include
          </Text>
        </View>

        {/* Content */}
        {loading ? (
          <View className="items-center justify-center py-12">
            <ActivityIndicator size="large" color="#ffffff" />
          </View>
        ) : isEmpty ? (
          <View className="items-center justify-center py-12">
            <Text className="text-zinc-400 text-base">
              No activity detected
            </Text>
          </View>
        ) : (
          <ScrollView className="max-h-80 px-5 py-3">
            {apps.map((app, i) => {
              const isSelected = selectedApps.has(app.app);
              const titles = app.titles ?? [];
              return (
                <Pressable
                  key={app.app}
                  onPress={() => handleToggleApp(app.app)}
                  className={`flex-row items-start gap-3 py-3 ${
                    i < apps.length - 1 ? "border-b border-zinc-800" : ""
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
                        {titles.slice(0, 2).map((title, idx) => (
                          <Text
                            key={idx}
                            className="text-zinc-400 text-xs"
                            numberOfLines={1}
                          >
                            · {title}
                          </Text>
                        ))}
                      </View>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {/* Buttons */}
        <View className="px-5 pt-4 pb-4 gap-2 border-t border-zinc-800">
          <Button
            variant="primary"
            onPress={handleSave}
            isDisabled={loading || isEmpty}
          >
            <Button.Label>
              {isEmpty ? "No Activity" : "Save Session"}
            </Button.Label>
          </Button>
          <Button variant="ghost" onPress={onSkip}>
            <Button.Label>Skip</Button.Label>
          </Button>
        </View>
      </View>
    </Modal>
  );
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
