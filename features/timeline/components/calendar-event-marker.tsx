import { formatTime24 } from "@/features/timeline/timeline-utils";
import type { CalendarEvent } from "@/features/calendar/calendar";
import { useProjects } from "@/features/projects/projects-store";
import { useCalendarStore } from "@/features/calendar/calendar-store";
import { Image } from "expo-image";
import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

export function CalendarEventMarker({
  event,
  index,
  expanded,
  onToggle,
}: {
  event: CalendarEvent;
  index: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { projects } = useProjects();
  const { mappings } = useCalendarStore();

  // Find the project color for this event
  const mapping = mappings.find((m) => {
    if (m.calendarName && m.calendarName === event.calendarName) return true;
    if (
      m.titleKeywords?.some((kw) =>
        event.title.toLowerCase().includes(kw.toLowerCase()),
      )
    ) {
      return true;
    }
    return false;
  });

  const project = mapping
    ? projects.find((p) => p.id === mapping.projectId)
    : null;
  const eventColor = project?.color ?? "#3b82f6"; // Fallback to blue

  const collapsedHeight = 20; // height of single line
  const expandedHeight = 100; // height of card with padding

  const containerHeight = useSharedValue(collapsedHeight);
  const collapsedOpacity = useSharedValue(1);
  const expandedOpacity = useSharedValue(0);

  useEffect(() => {
    containerHeight.value = withTiming(
      expanded ? expandedHeight : collapsedHeight,
      {
        duration: 280,
        easing: Easing.out(Easing.cubic),
      },
    );
    collapsedOpacity.value = withTiming(expanded ? 0 : 1, {
      duration: 200,
      easing: Easing.out(Easing.cubic),
    });
    expandedOpacity.value = withTiming(expanded ? 1 : 0, {
      duration: 200,
      easing: Easing.out(Easing.cubic),
    });
  }, [expanded, containerHeight, collapsedOpacity, expandedOpacity]);

  const containerStyle = useAnimatedStyle(() => ({
    height: containerHeight.value,
    overflow: "hidden",
  }));

  const collapsedStyle = useAnimatedStyle(() => ({
    opacity: collapsedOpacity.value,
  }));

  const expandedStyle = useAnimatedStyle(() => ({
    opacity: expandedOpacity.value,
  }));

  return (
    <Animated.View entering={FadeIn.delay(index * 30).duration(350)}>
      <Pressable onPress={onToggle}>
        <View className="flex-row items-start gap-2">
          {/* Time column */}
          <View className="w-14 items-end pt-2">
            <Text className="text-zinc-700 text-xs tabular-nums">
              {formatTime24(new Date(event.startDate))}
            </Text>
          </View>

          {/* Connector: thin vertical line + small dot */}
          <View className="w-4 items-center pt-[10px] gap-px">
            <View
              className="w-px flex-1"
              style={{ minHeight: 16, backgroundColor: `${eventColor}33` }}
            />
            <View
              className="w-1 h-1 rounded-full"
              style={{ backgroundColor: `${eventColor}80` }}
            />
          </View>

          {/* Event marker content - animated container */}
          <Animated.View className="flex-1" style={containerStyle}>
            {/* Collapsed state */}
            <Animated.View
              className="flex-row items-center gap-1.5"
              style={collapsedStyle}
              pointerEvents={expanded ? "none" : "auto"}
            >
              <Image
                source="sf:calendar"
                style={{ width: 10, height: 10, tintColor: `${eventColor}99` }}
              />
              <Text
                className="text-xs flex-1"
                numberOfLines={1}
                style={{ color: `${eventColor}99` }}
              >
                {event.title}
              </Text>
              <Text className="text-zinc-700 text-xs tabular-nums">
                {formatTime24(new Date(event.startDate))}–
                {formatTime24(new Date(event.endDate))}
              </Text>
            </Animated.View>

            {/* Expanded state */}
            <Animated.View
              className="rounded-xl px-3 py-2.5 border mt-1"
              style={[
                expandedStyle,
                {
                  backgroundColor: `${eventColor}14`,
                  borderColor: `${eventColor}33`,
                },
              ]}
              pointerEvents={expanded ? "auto" : "none"}
            >
              <Text
                className="text-sm font-medium"
                numberOfLines={2}
                style={{ color: eventColor }}
              >
                {event.title}
              </Text>
              <Text className="text-zinc-500 text-xs mt-0.5">
                {event.calendarName}
              </Text>
              <Text className="text-zinc-600 text-xs mt-1">
                {formatTime24(new Date(event.startDate))} –{" "}
                {formatTime24(new Date(event.endDate))}
              </Text>
            </Animated.View>
          </Animated.View>
        </View>
      </Pressable>
    </Animated.View>
  );
}
