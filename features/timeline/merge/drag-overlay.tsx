import { useAuroraTheme } from "@/features/aurora/use-aurora-theme";
import { useProjects } from "@/features/projects/projects-store";
import { useSessionsStore, type Session } from "@/features/sessions/sessions-store";
import {
  formatDuration,
} from "@/features/timeline/timeline-utils";
import { useMergeContext } from "@/features/timeline/merge/merge-context";
import { Image } from "expo-image";
import { Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";

export function DragOverlay() {
  const { draggingId, ghostY, ghostOpacity, ghostScale, ghostMergeProgress } = useMergeContext();
  const sessions = useSessionsStore((s) => s.sessions);
  const session = draggingId
    ? (sessions.find((s) => s.id === draggingId) ?? null)
    : null;

  if (!session) return null;

  return (
    <View
      className="absolute top-0 left-0 right-0 bottom-0"
      pointerEvents="none"
    >
      <GhostCard session={session} ghostY={ghostY} ghostOpacity={ghostOpacity} ghostScale={ghostScale} ghostMergeProgress={ghostMergeProgress} />
    </View>
  );
}

function GhostCard({
  session,
  ghostY,
  ghostOpacity,
  ghostScale,
  ghostMergeProgress,
}: {
  session: Session;
  ghostY: SharedValue<number>;
  ghostOpacity: SharedValue<number>;
  ghostScale: SharedValue<number>;
  ghostMergeProgress: SharedValue<number>;
}) {
  const theme = useAuroraTheme();
  const project = useProjects((s) =>
    session.projectId
      ? (s.projects.find((p) => p.id === session.projectId) ?? null)
      : null,
  );

  const appsString = session.apps
    ? session.apps
        .slice(0, 3)
        .map((a) => a.app)
        .join(" · ")
    : null;

  const ghostStyle = useAnimatedStyle(() => {
    const p = ghostMergeProgress.value;
    return {
      transform: [
        { translateY: ghostY.value + p * 10 },
        { scale: ghostScale.value - p * 0.07 },
      ],
      opacity: ghostOpacity.value - p * 0.2,
    };
  });

  return (
    <Animated.View
      className="absolute"
      style={[
        ghostStyle,
        // left offset: 12 container padding + 56 time label + 8 gap + 6 dot + 8 gap = 90
        { left: 90, right: 12 },
      ]}
    >
      <View
        className="rounded-2xl px-4 py-3 gap-1 overflow-hidden"
        style={{
          backgroundColor: theme.card,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.4,
          shadowRadius: 16,
          elevation: 12,
        }}
      >
        <View className="flex-row items-start justify-between gap-2">
          <Text
            className="text-white text-base font-semibold flex-1"
            numberOfLines={1}
          >
            {session.title}
          </Text>
          <View className="flex-row items-center gap-1.5">
            <View
              className="rounded-full px-2 py-0.5 mt-0.5"
              style={{ backgroundColor: theme.chip }}
            >
              <Text className="text-zinc-300 text-xs font-medium">
                {formatDuration(session.duration)}
              </Text>
            </View>
          </View>
        </View>
        {project && (
          <View className="flex-row items-center gap-1.5">
            <Image
              source={`sf:${project.icon}`}
              style={{ width: 11, height: 11, tintColor: project.color }}
            />
            <Text className="text-zinc-500 text-xs">{project.name}</Text>
          </View>
        )}
        {appsString && (
          <Text
            className="text-zinc-600 text-xs mt-1 leading-4"
            numberOfLines={1}
          >
            {appsString}
          </Text>
        )}
      </View>
    </Animated.View>
  );
}
