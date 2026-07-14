import { useProjects } from "@/features/projects/projects-store";
import { Session, useSessionsStore } from "@/features/sessions/sessions-store";
import { heroProgress } from "@/lib/hero-animation";
import { scrubProgress } from "@/lib/scrub-playback";
import React, { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
} from "react-native-reanimated";

const DAY_SECONDS = 24 * 3600;

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

function secondsSinceMidnight(isoString: string): number {
  const d = new Date(isoString);
  return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
}

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

interface ConstellationPointProps {
  layout: PointLayout;
  color: string;
  index: number;
  sessionStartFraction: number;
}

function ConstellationPoint({
  layout,
  color,
  index,
  sessionStartFraction,
}: ConstellationPointProps) {
  const scale = useSharedValue(0);
  const amp = layout.radius * 0.3;
  const offsetX = useSharedValue(-amp * layout.driftPhaseX);
  const offsetY = useSharedValue(-amp * layout.driftPhaseY);
  const opacityValue = useSharedValue(0);

  useEffect(() => {
    scale.value = withDelay(
      index * 80,
      withSpring(1, { damping: 14, stiffness: 120 }),
    );
  }, [scale, index]);

  useEffect(() => {
    const delay = index * 80 + 650;
    offsetX.value = withDelay(
      delay,
      withRepeat(
        withTiming(amp * layout.driftPhaseX, {
          duration: layout.driftDurX,
          easing: Easing.inOut(Easing.sin),
        }),
        -1,
        true,
      ),
    );
    offsetY.value = withDelay(
      delay,
      withRepeat(
        withTiming(amp * layout.driftPhaseY, {
          duration: layout.driftDurY,
          easing: Easing.inOut(Easing.sin),
        }),
        -1,
        true,
      ),
    );
  }, []);

  useAnimatedReaction(
    () => {
      const scrubSec = scrubProgress.value * DAY_SECONDS;
      return scrubSec >= sessionStartFraction * DAY_SECONDS
        ? layout.opacity
        : 0;
    },
    (next, prev) => {
      if (next !== prev)
        opacityValue.value = withTiming(next, { duration: 150 });
    },
  );

  const dotStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: layout.x + offsetX.value },
      { translateY: layout.y + offsetY.value },
      { scale: scale.value },
    ],
    opacity: opacityValue.value,
  }));

  return (
    <AnimatedView
      style={[{ position: "absolute", top: 0, left: 0 }, dotStyle]}
      pointerEvents="box-none"
    >
      <View
        style={{
          width: layout.radius * 2 * 3,
          height: layout.radius * 2 * 3,
          borderRadius: layout.radius * 3,
          backgroundColor: color,
          opacity: 0.1,
          position: "absolute",
          top: -layout.radius * 2,
          left: -layout.radius * 2,
        }}
        pointerEvents="none"
      />

      <View
        style={{
          width: layout.radius * 2,
          height: layout.radius * 2,
          borderRadius: layout.radius,
          backgroundColor: color,
          opacity: layout.opacity,
        }}
      />
    </AnimatedView>
  );
}

export const SessionConstellation = React.memo(function SessionConstellation() {
  const sessions = useSessionsStore((s) => s.sessions);
  const projects = useProjects((s) => s.projects);
  const [containerSize, setContainerSize] = useState<{
    width: number;
    height: number;
  } | null>(null);

  const todaySessions = useMemo(() => {
    const today = new Date().toDateString();
    return sessions.filter((s) => new Date(s.startTime).toDateString() === today);
  }, [sessions]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(heroProgress.value, [0.55, 1], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  }));

  const layouts = useMemo(() => {
    if (!containerSize || todaySessions.length === 0) return [];
    return computeConstellationLayout(
      todaySessions,
      containerSize.width,
      containerSize.height,
    );
  }, [todaySessions, containerSize]);

  const projectMap = useMemo(
    () => new Map(projects.map((p) => [p.id, p])),
    [projects],
  );

  if (todaySessions.length === 0) return null;

  return (
    <AnimatedView
      style={[
        {
          width: "100%",
          height: 100,
          position: "relative",
          marginTop: 12,
          marginBottom: 20,
        },
        containerStyle,
      ]}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setContainerSize({ width, height });
      }}
    >
      {layouts.map((layout, index) => {
        const session = todaySessions.find((s) => s.id === layout.sessionId)!;
        const project = session.projectId
          ? projectMap.get(session.projectId)
          : undefined;
        const sessionStartFraction =
          secondsSinceMidnight(session.startTime) / DAY_SECONDS;
        return (
          <ConstellationPoint
            key={session.id}
            layout={layout}
            color={project?.color ?? "#ffffff"}
            index={index}
            sessionStartFraction={sessionStartFraction}
          />
        );
      })}
    </AnimatedView>
  );
});
