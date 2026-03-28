import { formatDuration, formatTime24 } from "@/features/timeline/timeline-utils";
import type { CalendarEvent } from "@/features/calendar/calendar";
import { useAuroraTheme } from "@/features/aurora/use-aurora-theme";
import { useProjects } from "@/features/projects/projects-store";
import type { Session } from "@/features/sessions/sessions-store";
import { useMergeContext } from "@/features/timeline/merge/merge-context";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { Link } from "expo-router";
import React, { useEffect, useRef } from "react";
import { Pressable, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  FadeInDown,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";

export const SessionRow = React.memo(function SessionRow({
  session,
  index,
  overlappingEvents,
}: {
  session: Session;
  index: number;
  overlappingEvents: CalendarEvent[];
}) {
  const project = useProjects(s => session.projectId ? s.projects.find(p => p.id === session.projectId) ?? null : null);
  const theme = useAuroraTheme();

  const {
    registerLayout,
    unregisterLayout,
    startDrag,
    moveDrag,
    endDrag,
    cancelDrag,
    draggingId,
    dropTargetId,
  } = useMergeContext();

  const isDraggingThis = draggingId === session.id;
  const isDropTarget = dropTargetId === session.id;

  const appsString = session.apps
    ? session.apps
        .slice(0, 3)
        .map((a) => a.app)
        .join(" · ")
    : null;

  const pressScale = useSharedValue(1);
  const cardOpacity = useSharedValue(1);
  const dropPulse = useSharedValue(1);
  const dropHalo = useSharedValue(0);
  const cardPageYShared = useSharedValue(0);
  const cardRef = useRef<View>(null);
  const wasDropTarget = useRef(false);

  useEffect(() => {
    return () => {
      unregisterLayout(session.id);
    };
  }, [session.id]);

  useEffect(() => {
    cardOpacity.value = withTiming(isDraggingThis ? 0.3 : 1, {
      duration: 150,
      easing: Easing.out(Easing.quad),
    });
  }, [isDraggingThis]);

  useEffect(() => {
    dropHalo.value = withTiming(isDropTarget ? 1 : 0, {
      duration: 180,
      easing: Easing.out(Easing.cubic),
    });
    if (!isDropTarget && wasDropTarget.current) {
      dropPulse.value = withSequence(
        withTiming(1.04, { duration: 100, easing: Easing.out(Easing.quad) }),
        withTiming(1.0, { duration: 220, easing: Easing.out(Easing.cubic) }),
      );
    }
    wasDropTarget.current = isDropTarget;
  }, [isDropTarget]);

  const scaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value * dropPulse.value }],
    opacity: cardOpacity.value,
  }));

  const dropHaloStyle = useAnimatedStyle(() => ({
    opacity: dropHalo.value,
  }));

  function handleLayout() {
    cardRef.current?.measureInWindow((_x, pageY, _w, height) => {
      cardPageYShared.value = pageY;
      registerLayout(session.id, { pageY, height });
    });
  }

  function triggerDragStart(absoluteY: number) {
    cardRef.current?.measureInWindow((_x, pageY, _w, height) => {
      cardPageYShared.value = pageY;
      registerLayout(session.id, { pageY, height });
      startDrag(session.id, absoluteY, absoluteY - pageY);
    });
  }

  function triggerHaptic() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }

  const panGesture = Gesture.Pan()
    .activateAfterLongPress(450)
    .onStart((e) => {
      runOnJS(triggerHaptic)();
      runOnJS(triggerDragStart)(e.absoluteY);
    })
    .onUpdate((e) => {
      runOnJS(moveDrag)(e.absoluteY);
    })
    .onEnd(() => {
      runOnJS(endDrag)();
    })
    .onFinalize((_e, success) => {
      if (!success) runOnJS(cancelDrag)();
    });

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
            <GestureDetector gesture={panGesture}>
              <Animated.View
                ref={cardRef}
                style={scaleStyle}
                onLayout={handleLayout}
              >
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
                    <View className="flex-row items-center gap-1.5">
                      {session.auto && (
                        <View
                          className="rounded-full px-1.5 py-0.5 mt-0.5"
                          style={{ backgroundColor: theme.chip }}
                        >
                          <Text className="text-zinc-500 text-xs font-medium">
                            Auto
                          </Text>
                        </View>
                      )}
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
                  <Animated.View
                    className="absolute inset-0 rounded-2xl border border-white/25 bg-white/[0.05]"
                    style={[
                      dropHaloStyle,
                      {
                        shadowColor: "#ffffff",
                        shadowOpacity: 0.15,
                        shadowRadius: 10,
                        shadowOffset: { width: 0, height: 0 },
                      },
                    ]}
                    pointerEvents="none"
                  />
                </View>
              </Animated.View>
            </GestureDetector>
          </Pressable>
        </Link.AppleZoom>
      </Link>
    </Animated.View>
  );
});
