import { heroProgress } from "@/lib/hero-animation";
import { useProjects } from "@/stores/projects-store";
import { Session, useSessionsStore } from "@/stores/sessions-store";
import { BlurView } from "expo-blur";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

const AnimatedView = Animated.createAnimatedComponent(View);

const MIN_RADIUS = 2.5;
const MAX_RADIUS = 5.5;
const MIN_OPACITY = 0.5;
const MAX_OPACITY = 1;
const MIN_DISTANCE = 28;
const EDGE_BUFFER = 12;
const MAX_ATTEMPTS = 20;
const DRIFT_MIN_MS = 3000;
const DRIFT_MAX_MS = 6000;

function hashSessionId(id: string): number {
  let h = 5381;
  for (let i = 0; i < id.length; i++) {
    h = (((h << 5) + h) ^ id.charCodeAt(i)) >>> 0;
  }
  return h;
}

function seededPRNG(seed: number): () => number {
  let s = seed;
  return () => {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type PointLayout = {
  sessionId: string;
  x: number;
  y: number;
  radius: number;
  opacity: number;
  driftDurX: number;
  driftDurY: number;
  driftPhaseX: number;
  driftPhaseY: number;
};

function computeConstellationLayout(
  sessions: Session[],
  containerWidth: number,
  containerHeight: number,
): PointLayout[] {
  const sorted = [...sessions].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
  );

  const durations = sorted.map((s) => s.duration);
  const minDur = Math.min(...durations);
  const maxDur = Math.max(...durations);
  const durationRange = maxDur - minDur;

  const layouts: PointLayout[] = [];
  const placedPoints: { x: number; y: number }[] = [];

  for (const session of sorted) {
    const prng = seededPRNG(hashSessionId(session.id));

    const normalizedDuration =
      durationRange === 0 ? 1 : (session.duration - minDur) / durationRange;
    const radius = MIN_RADIUS + normalizedDuration * (MAX_RADIUS - MIN_RADIUS);
    const opacity =
      MIN_OPACITY + normalizedDuration * (MAX_OPACITY - MIN_OPACITY);

    const driftDurX = DRIFT_MIN_MS + prng() * (DRIFT_MAX_MS - DRIFT_MIN_MS);
    const driftDurY = DRIFT_MIN_MS + prng() * (DRIFT_MAX_MS - DRIFT_MIN_MS);
    const driftPhaseX = prng() > 0.5 ? 1 : -1;
    const driftPhaseY = prng() > 0.5 ? 1 : -1;

    let accepted: { x: number; y: number } | null = null;
    let maxMinDist = 0;
    let fallbackCandidate: { x: number; y: number } = {
      x: containerWidth / 2,
      y: containerHeight / 2,
    };

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const x = EDGE_BUFFER + prng() * (containerWidth - 2 * EDGE_BUFFER);
      const y = EDGE_BUFFER + prng() * (containerHeight - 2 * EDGE_BUFFER);
      const candidate = { x, y };

      let minDist = Infinity;
      for (const point of placedPoints) {
        const dist = Math.hypot(candidate.x - point.x, candidate.y - point.y);
        minDist = Math.min(minDist, dist);
      }

      if (minDist > maxMinDist) {
        maxMinDist = minDist;
        fallbackCandidate = candidate;
      }

      if (minDist >= MIN_DISTANCE) {
        accepted = candidate;
        break;
      }
    }

    const position = accepted || fallbackCandidate;
    placedPoints.push(position);

    layouts.push({
      sessionId: session.id,
      x: position.x,
      y: position.y,
      radius,
      opacity,
      driftDurX,
      driftDurY,
      driftPhaseX,
      driftPhaseY,
    });
  }

  return layouts;
}

function truncateTitle(title: string, maxLen: number): string {
  if (title.length <= maxLen) return title;
  return title.substring(0, maxLen - 1) + "…";
}

function formatTooltipDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

const styles = StyleSheet.create({
  tooltipBlur: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.12)",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  tooltipTitle: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 12,
    fontWeight: "500",
    flex: 1,
  },
  tooltipDuration: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 11,
  },
});

interface ConstellationPointProps {
  layout: PointLayout;
  session: Session;
  color: string;
  containerWidth: number;
  index: number;
}

function ConstellationPoint({
  layout,
  session,
  color,
  containerWidth,
  index,
}: ConstellationPointProps) {
  const scale = useSharedValue(0);
  const driftX = useSharedValue(0);
  const driftY = useSharedValue(0);
  const tooltipOpacity = useSharedValue(0);
  const tooltipScale = useSharedValue(0.9);

  useEffect(() => {
    scale.value = withDelay(
      index * 80,
      withSpring(1, { damping: 14, stiffness: 120 }),
    );
  }, [scale, index]);

  useEffect(() => {
    const startDrift = () => {
      const amp = layout.radius * 0.6;

      driftX.value = withRepeat(
        withSequence(
          withTiming(amp * layout.driftPhaseX, {
            duration: layout.driftDurX,
            easing: Easing.inOut(Easing.sin),
          }),
          withTiming(-amp * layout.driftPhaseX, {
            duration: layout.driftDurX,
            easing: Easing.inOut(Easing.sin),
          }),
        ),
        -1,
        false,
      );

      driftY.value = withRepeat(
        withSequence(
          withTiming(amp * layout.driftPhaseY, {
            duration: layout.driftDurY,
            easing: Easing.inOut(Easing.sin),
          }),
          withTiming(-amp * layout.driftPhaseY, {
            duration: layout.driftDurY,
            easing: Easing.inOut(Easing.sin),
          }),
        ),
        -1,
        false,
      );
    };

    const timer = setTimeout(startDrift, index * 80 + 650);
    return () => clearTimeout(timer);
  }, [driftX, driftY, layout, index]);

  const dotStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: layout.x + driftX.value },
      { translateY: layout.y + driftY.value },
      { scale: scale.value },
    ],
  }));

  const TOOLTIP_W = 148;
  const tooltipStyle = useAnimatedStyle(() => {
    const rawLeft = layout.x + driftX.value - TOOLTIP_W / 2;
    const clampedLeft = Math.max(
      8,
      Math.min(rawLeft, containerWidth - TOOLTIP_W - 8),
    );
    return {
      opacity: tooltipOpacity.value,
      transform: [
        { translateX: clampedLeft },
        { translateY: layout.y + driftY.value - layout.radius - 44 },
        { scale: tooltipScale.value },
      ],
    };
  });

  const handlePress = () => {
    tooltipOpacity.value = withTiming(1, { duration: 200 });
    tooltipScale.value = withTiming(1, { duration: 200 });
    tooltipOpacity.value = withDelay(2000, withTiming(0, { duration: 400 }));
    tooltipScale.value = withDelay(2000, withTiming(0.9, { duration: 400 }));
  };

  return (
    <>
      <AnimatedView
        style={[{ position: "absolute", top: 0, left: 0 }, dotStyle]}
        pointerEvents="box-none"
      >
        <View
          style={{
            position: "absolute",
            width: layout.radius * 2 * 3,
            height: layout.radius * 2 * 3,
            borderRadius: layout.radius * 3,
            backgroundColor: color,
            opacity: 0.18,
            top: -layout.radius * 2,
            left: -layout.radius * 2,
          }}
          pointerEvents="none"
        />

        <Pressable
          onPress={handlePress}
          hitSlop={{ top: 12, left: 12, right: 12, bottom: 12 }}
          style={{
            width: layout.radius * 2,
            height: layout.radius * 2,
            borderRadius: layout.radius,
            backgroundColor: color,
            opacity: layout.opacity,
          }}
        />
      </AnimatedView>

      <AnimatedView
        style={[
          { position: "absolute", top: 0, left: 0, width: TOOLTIP_W },
          tooltipStyle,
        ]}
        pointerEvents="none"
      >
        <BlurView intensity={55} tint="dark" style={styles.tooltipBlur}>
          <Text style={styles.tooltipTitle} numberOfLines={1}>
            {truncateTitle(session.title, 20)}
          </Text>
          <Text style={styles.tooltipDuration}>
            {formatTooltipDuration(session.duration)}
          </Text>
        </BlurView>
      </AnimatedView>
    </>
  );
}

export function SessionConstellation() {
  const { sessions } = useSessionsStore();
  const { projects } = useProjects();
  const [containerSize, setContainerSize] = useState<{
    width: number;
    height: number;
  } | null>(null);

  const todaySessions = sessions.filter(
    (s) => new Date(s.startTime).toDateString() === new Date().toDateString(),
  );

  const containerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(heroProgress.value, [0.55, 1], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  }));

  if (todaySessions.length === 0) return null;

  const layouts = containerSize
    ? computeConstellationLayout(
        todaySessions,
        containerSize.width,
        containerSize.height,
      )
    : [];

  return (
    <AnimatedView
      style={[
        { width: "100%", height: 160, position: "relative" },
        containerStyle,
      ]}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setContainerSize({ width, height });
      }}
    >
      {layouts.map((layout, index) => {
        const session = todaySessions.find((s) => s.id === layout.sessionId)!;
        const project = projects.find((p) => p.id === session.projectId);
        return (
          <ConstellationPoint
            key={session.id}
            layout={layout}
            session={session}
            color={project?.color ?? "#ffffff"}
            containerWidth={containerSize!.width}
            index={index}
          />
        );
      })}
    </AnimatedView>
  );
}
