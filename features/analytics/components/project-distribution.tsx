import { formatFocusTime } from "@/features/analytics/stats-utils";
import type { Project } from "@/constants/projects";
import { GlassCard } from "./glass-card";
import { Image } from "expo-image";
import { Text, View } from "react-native";

export function ProjectDistribution({
  totals,
}: {
  totals: { project: Project; seconds: number }[];
}) {
  const maxSeconds = totals[0]?.seconds ?? 1;

  return (
    <GlassCard>
      <View className="px-4 py-3">
        {totals.map(({ project, seconds }) => (
          <View key={project.id} className="flex-row items-center gap-2 py-2">
            <Image
              source={`sf:${project.icon}`}
              style={{ width: 14, height: 14, tintColor: project.color }}
            />
            <Text
              className="text-zinc-400 text-xs w-16"
              numberOfLines={1}
            >
              {project.name}
            </Text>
            <View className="flex-1 h-[5px] rounded-full bg-white/[0.08]">
              <View
                className="h-[5px] rounded-full"
                style={{
                  width: `${(seconds / maxSeconds) * 100}%` as any,
                  backgroundColor: project.color,
                }}
              />
            </View>
            <Text className="text-zinc-500 text-xs tabular-nums w-12 text-right">
              {formatFocusTime(seconds)}
            </Text>
          </View>
        ))}
      </View>
    </GlassCard>
  );
}
