import { formatDuration, formatTime24 } from "@/lib/timeline-utils";
import type { CalendarEvent } from "@/lib/calendar";
import { useAuroraTheme } from "@/hooks/use-aurora-theme";
import { useProjects } from "@/stores/projects-store";
import type { Session } from "@/stores/sessions-store";
import { Image } from "expo-image";
import { Link } from "expo-router";
import { Pressable, Text, View } from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

export function SessionRow({
  session,
  index,
  overlappingEvents,
}: {
  session: Session;
  index: number;
  overlappingEvents: CalendarEvent[];
}) {
  const { projects } = useProjects();
  const theme = useAuroraTheme();
  const project = session.projectId
    ? projects.find((p) => p.id === session.projectId)
    : null;

  const appsString = session.apps
    ? session.apps
        .slice(0, 3)
        .map((a) => a.app)
        .join(" · ")
    : null;

  const pressScale = useSharedValue(1);
  const scaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  return (
    <Animated.View
      className="flex-row items-start gap-2"
      entering={FadeInDown.delay(index * 50)
        .duration(400)
        .easing(Easing.out(Easing.cubic))}
    >
      <View className="w-14 items-end pt-3.5">
        <Text className="text-zinc-500 text-xs tabular-nums">
          {formatTime24(new Date(session.startTime))}
        </Text>
      </View>
      <View className="items-center pt-[18px]">
        <View className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
      </View>
      <Link href={`/(tabs)/timeline/${session.id}`} asChild className="flex-1">
        <Link.AppleZoom>
          <Pressable
            className="flex-1"
            onPressIn={() => {
              pressScale.value = withTiming(0.96, {
                duration: 100,
                easing: Easing.out(Easing.quad),
              });
            }}
            onPressOut={() => {
              pressScale.value = withTiming(1, {
                duration: 220,
                easing: Easing.out(Easing.cubic),
              });
            }}
          >
            <Animated.View style={scaleStyle}>
              <View
                className="rounded-2xl px-4 py-3 gap-1 overflow-hidden"
                style={{ backgroundColor: theme.card }}
              >
                <View className="flex-row items-start justify-between gap-2">
                  <Text
                    className="text-white text-base font-semibold flex-1"
                    numberOfLines={1}
                  >
                    {session.title}
                  </Text>
                  <View
                    className="rounded-full px-2 py-0.5 mt-0.5"
                    style={{ backgroundColor: theme.chip }}
                  >
                    <Text className="text-zinc-300 text-xs font-medium">
                      {formatDuration(session.duration)}
                    </Text>
                  </View>
                </View>
                {project && (
                  <View className="flex-row items-center gap-1.5">
                    <Image
                      source={`sf:${project.icon}`}
                      style={{
                        width: 11,
                        height: 11,
                        tintColor: project.color,
                      }}
                    />
                    <Text className="text-zinc-500 text-xs">
                      {project.name}
                    </Text>
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
          </Pressable>
        </Link.AppleZoom>
      </Link>
    </Animated.View>
  );
}
