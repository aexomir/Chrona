import { formatFocusTime } from "@/lib/stats-utils";
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
      <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
        {totals.map(({ project, seconds }) => (
          <View key={project.id} className="flex-row items-center gap-2 py-2">
            <Image
              source={`sf:${project.icon}`}
              style={{ width: 14, height: 14, tintColor: project.color }}
            />
            <Text
              className="text-zinc-400 text-xs"
              style={{ width: 64 }}
              numberOfLines={1}
            >
              {project.name}
            </Text>
            <View
              className="flex-1 rounded-full"
              style={{ height: 5, backgroundColor: "rgba(255,255,255,0.08)" }}
            >
              <View
                className="rounded-full"
                style={{
                  width: `${(seconds / maxSeconds) * 100}%` as any,
                  height: 5,
                  backgroundColor: project.color,
                }}
              />
            </View>
            <Text
              className="text-zinc-500 text-xs tabular-nums"
              style={{ width: 48, textAlign: "right" }}
            >
              {formatFocusTime(seconds)}
            </Text>
          </View>
        ))}
      </View>
    </GlassCard>
  );
}
