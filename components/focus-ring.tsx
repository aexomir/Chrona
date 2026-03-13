import { heroProgress } from "@/lib/hero-animation";
import { useSessionsStore } from "@/stores/sessions-store";
import { useTimerStore } from "@/stores/timer-store";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  interpolate,
  useAnimatedStyle,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";

const AnimatedView = Animated.createAnimatedComponent(View);

const SVG_SIZE = 280;
const RING_RADIUS = 110;
const RING_STROKE_WIDTH = 8;
const CENTER = SVG_SIZE / 2;
const CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const DAY_SECONDS = 24 * 3600; // full 24-hour day

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 40,
  },
  svgWrapper: {
    width: SVG_SIZE,
    height: SVG_SIZE,
    position: "relative",
  },
  centerContent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  centerTitle: {
    fontSize: 48,
    fontWeight: "700",
    color: "white",
    marginBottom: 4,
  },
  centerLabel: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.6)",
    fontWeight: "500",
    letterSpacing: 0.5,
  },
  indicatorsRow: {
    flexDirection: "row",
    gap: 40,
    marginTop: 40,
  },
  indicatorBox: {
    alignItems: "center",
  },
  indicatorValue: {
    fontSize: 24,
    fontWeight: "600",
    color: "white",
    marginBottom: 2,
  },
  indicatorLabel: {
    fontSize: 11,
    color: "rgba(255, 255, 255, 0.5)",
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
});

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function secondsSinceMidnight(isoString: string): number {
  const d = new Date(isoString);
  return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
}

type SegmentProps = {
  id: string;
  dash: number;
  offset: number;
};

export function FocusRing() {
  const { sessions } = useSessionsStore();
  const { isTracking, startTimestamp } = useTimerStore();
  const [liveTotal, setLiveTotal] = useState(0);
  const [liveSegment, setLiveSegment] = useState<SegmentProps | null>(null);

  // Get today's sessions sorted by start time
  const todaySessions = useMemo(() => {
    const today = new Date().toDateString();
    return sessions
      .filter((s) => new Date(s.startTime).toDateString() === today)
      .sort(
        (a, b) =>
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
      );
  }, [sessions]);

  // Completed sessions stats (including longest and count)
  const completedStats = useMemo(() => {
    let total = 0;
    let longest = 0;
    for (const s of todaySessions) {
      total += s.duration;
      if (s.duration > longest) longest = s.duration;
    }
    return { total, longest, count: todaySessions.length };
  }, [todaySessions]);

  // Map completed sessions to SVG segment props
  const completedSegments: SegmentProps[] = useMemo(
    () =>
      todaySessions.map((s) => {
        const startFraction = secondsSinceMidnight(s.startTime) / DAY_SECONDS;
        const lengthFraction = s.duration / DAY_SECONDS;
        return {
          id: s.id,
          dash: lengthFraction * CIRCUMFERENCE,
          offset: -(startFraction * CIRCUMFERENCE),
        };
      }),
    [todaySessions],
  );

  // Real-time tick — updates center text and live segment every second
  useEffect(() => {
    if (!isTracking || !startTimestamp) {
      setLiveTotal(completedStats.total);
      setLiveSegment(null);
      return;
    }

    const tick = () => {
      const elapsed = Math.floor(
        (Date.now() - new Date(startTimestamp).getTime()) / 1000,
      );
      const total = completedStats.total + elapsed;
      setLiveTotal(total);

      // Compute live segment
      const startFraction = secondsSinceMidnight(startTimestamp) / DAY_SECONDS;
      const lengthFraction = elapsed / DAY_SECONDS;
      setLiveSegment({
        id: "live",
        dash: lengthFraction * CIRCUMFERENCE,
        offset: -(startFraction * CIRCUMFERENCE),
      });
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isTracking, startTimestamp, completedStats.total]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ring container opacity (fade in with hero animation)
  const ringContainerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(heroProgress.value, [0.3, 0.8], [0, 1]),
  }));

  return (
    <AnimatedView style={[styles.container, ringContainerStyle]}>
      {/* SVG Ring */}
      <View style={styles.svgWrapper}>
        <Svg
          width={SVG_SIZE}
          height={SVG_SIZE}
          viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
        >
          {/* Background track — full ring, very faint */}
          <Circle
            cx={CENTER}
            cy={CENTER}
            r={RING_RADIUS}
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth={RING_STROKE_WIDTH}
            fill="none"
          />

          {/* Completed session segments */}
          {completedSegments.map((seg) => (
            <Circle
              key={seg.id}
              cx={CENTER}
              cy={CENTER}
              r={RING_RADIUS}
              stroke="rgba(255, 255, 255, 0.85)"
              strokeWidth={RING_STROKE_WIDTH}
              fill="none"
              strokeDasharray={`${seg.dash} ${CIRCUMFERENCE}`}
              strokeDashoffset={seg.offset}
              strokeLinecap="butt"
              transform={`rotate(-90, ${CENTER}, ${CENTER})`}
            />
          ))}

          {/* Live session segment (updates every second) */}
          {isTracking && liveSegment && (
            <Circle
              cx={CENTER}
              cy={CENTER}
              r={RING_RADIUS}
              stroke="rgba(255, 255, 255, 0.6)"
              strokeWidth={RING_STROKE_WIDTH}
              fill="none"
              strokeDasharray={`${liveSegment.dash} ${CIRCUMFERENCE}`}
              strokeDashoffset={liveSegment.offset}
              strokeLinecap="butt"
              transform={`rotate(-90, ${CENTER}, ${CENTER})`}
            />
          )}
        </Svg>

        {/* Center content */}
        <View style={styles.centerContent}>
          <Text style={styles.centerTitle}>{formatDuration(liveTotal)}</Text>
          <Text style={styles.centerLabel}>TODAY</Text>
        </View>
      </View>

      {/* Secondary indicators */}
      <View style={styles.indicatorsRow}>
        {/* Sessions count */}
        <View style={styles.indicatorBox}>
          <Text style={styles.indicatorValue}>{completedStats.count}</Text>
          <Text style={styles.indicatorLabel}>Sessions</Text>
        </View>

        {/* Longest block */}
        <View style={styles.indicatorBox}>
          <Text style={styles.indicatorValue}>
            {formatDuration(completedStats.longest)}
          </Text>
          <Text style={styles.indicatorLabel}>Longest Block</Text>
        </View>
      </View>
    </AnimatedView>
  );
}
