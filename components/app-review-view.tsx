import { useProjects } from "@/features/projects/projects-store";
import type { AppUsage } from "@/features/sessions/sessions-store";
import { Button, Checkbox } from "heroui-native";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

type AppReviewViewProps = {
  apps: AppUsage[];
  sessionTitle: string;
  sessionProjectId: string | null;
  onConfirm: (selectedApps: AppUsage[]) => void;
  onSkip: () => void;
};

export function AppReviewView({
  apps,
  sessionTitle,
  sessionProjectId,
  onConfirm,
  onSkip,
}: AppReviewViewProps) {
  const [checked, setChecked] = useState<Set<string>>(
    () => new Set(apps.map((a) => a.app))
  );
  const projects = useProjects((s) => s.projects);

  const selProj = sessionProjectId
    ? projects.find((p) => p.id === sessionProjectId)
    : null;

  const trackedSeconds = apps
    .filter((a) => checked.has(a.app))
    .reduce((sum, a) => sum + a.duration, 0);

  const handleToggle = (appName: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(appName) ? next.delete(appName) : next.add(appName);
      return next;
    });
  };

  return (
    <View className="flex-1 px-6">
      <View className="pt-4 pb-8 gap-2">
        {selProj && (
          <View className="flex-row items-center gap-2">
            <View
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: selProj.color }}
            />
            <Text className="text-zinc-400 text-sm">{selProj.name}</Text>
          </View>
        )}
        <Text
          className="text-white text-2xl font-semibold tracking-tight"
          numberOfLines={2}
        >
          {sessionTitle}
        </Text>
      </View>

      <Text className="text-zinc-600 text-xs uppercase tracking-widest mb-4">
        apps used
      </Text>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        {apps.map((app, i) => (
          <AppRow
            key={app.app}
            app={app}
            checked={checked.has(app.app)}
            onToggle={() => handleToggle(app.app)}
            index={i}
          />
        ))}
      </ScrollView>

      <View className="gap-3 pb-4">
        <Text className="text-zinc-500 text-sm text-center">
          {trackedSeconds > 0
            ? `${formatDuration(trackedSeconds)} tracked`
            : "no apps selected"}
        </Text>
        <Button
          variant="primary"
          onPress={() => onConfirm(apps.filter((a) => checked.has(a.app)))}
        >
          <Button.Label>Confirm</Button.Label>
        </Button>
        <Pressable onPress={onSkip} className="items-center py-2">
          <Text className="text-zinc-600 text-sm">Skip</Text>
        </Pressable>
      </View>
    </View>
  );
}

type AppRowProps = {
  app: AppUsage;
  checked: boolean;
  onToggle: () => void;
  index: number;
};

function AppRow({ app, checked, onToggle, index }: AppRowProps) {
  const opacity = useSharedValue(checked ? 1 : 0.28);

  useEffect(() => {
    opacity.value = withTiming(checked ? 1 : 0.28, { duration: 200 });
  }, [checked]);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 40).duration(250)}
      style={animStyle}
    >
      <Pressable
        onPress={onToggle}
        className="flex-row items-center gap-4 py-3.5 border-b border-white/[0.06]"
      >
        <Checkbox isSelected={checked} onSelectedChange={onToggle} />
        <View className="flex-1">
          <Text
            className={
              checked
                ? "text-white text-base"
                : "text-white/[0.28] text-base line-through"
            }
          >
            {app.app}
          </Text>
        </View>
        <Text
          className={
            checked
              ? "text-zinc-600 text-sm tabular-nums"
              : "text-zinc-600 text-sm tabular-nums line-through"
          }
        >
          {formatDuration(app.duration)}
        </Text>
      </Pressable>
    </Animated.View>
  );
}
