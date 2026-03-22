import { heroProgress } from "@/lib/hero-animation";
import { scrubProgress, scrubActive } from "@/features/timeline/playback";
import { useSessionsStore } from "@/features/sessions/sessions-store";
import { useTimerStore } from "@/features/timer/timer-store";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  interpolate,
  useAnimatedStyle,
  withTiming,
  useAnimatedProps,
  useSharedValue,
  withSpring,
  runOnJS,
  withRepeat,
} from "react-native-reanimated";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import Svg, { Circle } from "react-native-svg";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const AnimatedView = Animated.createAnimatedComponent(View);
const AnimatedText = Animated.createAnimatedComponent(Text);

const SVG_SIZE = 280;
const RING_RADIUS = 110;
const RING_STROKE_WIDTH = 8;
const CENTER = SVG_SIZE / 2;
const CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const DAY_SECONDS = 24 * 3600; // full 24-hour day

type InfoMode = "total" | "sessions" | "longest";
const INFO_MODES: InfoMode[] = ["total", "sessions", "longest"];

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
    letterSpacing: -1.5,
  },
  centerLabel: {
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.6)",
    fontWeight: "500",
    letterSpacing: 1.5,
  },
  ringGestureContainer: {
    alignItems: "center",
  },
  timeLabelContainer: {
    position: "absolute",
    top: 12,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  timeLabelText: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.7)",
    fontWeight: "600",
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
  sessionStartSec: number;
};

interface SegmentCircleProps {
  seg: SegmentProps;
}

function SegmentCircle({ seg }: SegmentCircleProps) {
  const animatedProps = useAnimatedProps(() => {
    const scrubSec = scrubProgress.value * DAY_SECONDS;
    return {
      opacity: scrubSec >= seg.sessionStartSec ? 0.92 : 0,
    };
  });

  return (
    <AnimatedCircle
      cx={CENTER}
      cy={CENTER}
      r={RING_RADIUS}
      stroke="rgba(255, 255, 255, 0.9)"
      strokeWidth={RING_STROKE_WIDTH}
      fill="none"
      strokeDasharray={`${seg.dash} ${CIRCUMFERENCE}`}
      strokeDashoffset={seg.offset}
      strokeLinecap="round"
      transform={`rotate(-90, ${CENTER}, ${CENTER})`}
      animatedProps={animatedProps}
    />
  );
}

export function FocusRing() {
  const { sessions } = useSessionsStore();
  const { isTracking, startTimestamp } = useTimerStore();
  const [liveTotal, setLiveTotal] = useState(0);
  const [liveSegment, setLiveSegment] = useState<SegmentProps | null>(null);
  const [infoMode, setInfoMode] = useState<InfoMode>("total");
  const [fadeKey, setFadeKey] = useState(0);
  const [scrubTimeLabel, setScrubTimeLabel] = useState("");

  const scrubStartX = useSharedValue(0);
  const scrubStartY = useSharedValue(0);
  const liveSegmentOpacity = useSharedValue(0.7);

  // Helper to update scrub time label
  const updateLabel = (fraction: number) => {
    const sec = fraction * DAY_SECONDS;
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const period = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    setScrubTimeLabel(`${h12}:${String(m).padStart(2, "0")} ${period}`);
  };

  // Helper to trigger haptic feedback
  const triggerHaptic = () =>
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

  // Handle tap to cycle info modes
  function handleTap() {
    const currentIndex = INFO_MODES.indexOf(infoMode);
    const nextIndex = (currentIndex + 1) % INFO_MODES.length;
    setInfoMode(INFO_MODES[nextIndex]);
    setFadeKey((k) => k + 1);
  }

  // Gesture handlers
  const panGesture = Gesture.Pan()
    .activateAfterLongPress(400)
    .onStart((e) => {
      scrubStartX.value = e.x;
      scrubStartY.value = e.y;
      scrubActive.value = withTiming(1, { duration: 200 });
      runOnJS(triggerHaptic)();
    })
    .onUpdate((e) => {
      const cx = scrubStartX.value + e.translationX;
      const cy = scrubStartY.value + e.translationY;
      const dx = cx - CENTER;
      const dy = cy - CENTER;
      // Map angle (0 = top/midnight, clockwise) to day fraction
      let angle = Math.atan2(dy, dx) + Math.PI / 2;
      if (angle < 0) angle += 2 * Math.PI;
      const fraction = angle / (2 * Math.PI);
      scrubProgress.value = fraction;
      runOnJS(updateLabel)(fraction);
    })
    .onEnd(() => {
      scrubActive.value = withTiming(0, { duration: 400 });
      scrubProgress.value = withSpring(1, { damping: 20, stiffness: 80 });
    });

  const tapGesture = Gesture.Tap().onStart(() => {
    runOnJS(handleTap)();
  });

  // Pan (long-press) takes priority over tap
  const composed = Gesture.Exclusive(panGesture, tapGesture);

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
        const sessionStartSec = secondsSinceMidnight(s.startTime);
        return {
          id: s.id,
          dash: lengthFraction * CIRCUMFERENCE,
          offset: -(startFraction * CIRCUMFERENCE),
          sessionStartSec,
        };
      }),
    [todaySessions],
  );


  // Get display text for current mode
  function getDisplayText() {
    switch (infoMode) {
      case "total":
        return { title: formatDuration(liveTotal), label: "TODAY" };
      case "sessions":
        return { title: String(completedStats.count), label: "SESSIONS" };
      case "longest":
        return {
          title: formatDuration(completedStats.longest),
          label: "LONGEST SESSION",
        };
    }
  }

  // Real-time tick — updates center text and live segment every second
  useEffect(() => {
    if (!isTracking || !startTimestamp) {
      setLiveTotal(completedStats.total);
      setLiveSegment(null);
      liveSegmentOpacity.value = 0.7;
      return;
    }

    // Start pulse animation when tracking
    liveSegmentOpacity.value = withRepeat(
      withTiming(1.0, { duration: 1400 }),
      -1,
      true,
    );

    const tick = () => {
      const elapsed = Math.floor(
        (Date.now() - new Date(startTimestamp).getTime()) / 1000,
      );
      const total = completedStats.total + elapsed;
      setLiveTotal(total);

      // Compute live segment
      const startFraction = secondsSinceMidnight(startTimestamp) / DAY_SECONDS;
      const lengthFraction = elapsed / DAY_SECONDS;
      const sessionStartSec = secondsSinceMidnight(startTimestamp);
      setLiveSegment({
        id: "live",
        dash: lengthFraction * CIRCUMFERENCE,
        offset: -(startFraction * CIRCUMFERENCE),
        sessionStartSec,
      });
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isTracking, startTimestamp, completedStats.total, liveSegmentOpacity]);

  // Ring container opacity (fade in with hero animation)
  const ringContainerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(heroProgress.value, [0.3, 0.8], [0, 1]),
  }));

  // Text fade transition — fade out then back in on mode change
  const fadeOpacity = useSharedValue(1);

  useEffect(() => {
    fadeOpacity.value = 0;
    fadeOpacity.value = withTiming(1, { duration: 300 });
  }, [fadeKey, fadeOpacity]);

  const textFadeStyle = useAnimatedStyle(() => ({
    opacity: fadeOpacity.value,
  }));

  // Center text suppression during scrub
  const centerFadeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrubActive.value, [0, 1], [1, 0.2]),
  }));

  // Time label visibility during scrub
  const timeLabelStyle = useAnimatedStyle(() => ({
    opacity: withTiming(scrubActive.value, { duration: 200 }),
  }));

  // Live segment pulse animation
  const liveSegmentAnimatedProps = useAnimatedProps(() => ({
    opacity: liveSegmentOpacity.value,
  }));

  const displayText = getDisplayText();

  return (
    <AnimatedView style={[styles.container, ringContainerStyle]}>
      {/* Ring (GestureDetector) */}
      <GestureDetector gesture={composed}>
        <View style={styles.ringGestureContainer}>
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
                stroke="rgba(255, 255, 255, 0.11)"
                strokeWidth={RING_STROKE_WIDTH}
                fill="none"
              />

              {/* Completed session segments */}
              {completedSegments.map((seg) => (
                <SegmentCircle key={seg.id} seg={seg} />
              ))}

              {/* Live session segment (updates every second, suppressed during scrub) */}
              {isTracking && liveSegment && scrubActive.value === 0 && (
                <>
                  {/* Glow halo */}
                  <Circle
                    cx={CENTER}
                    cy={CENTER}
                    r={RING_RADIUS}
                    stroke="rgba(255, 255, 255, 0.15)"
                    strokeWidth={18}
                    fill="none"
                    strokeDasharray={`${liveSegment.dash} ${CIRCUMFERENCE}`}
                    strokeDashoffset={liveSegment.offset}
                    strokeLinecap="round"
                    transform={`rotate(-90, ${CENTER}, ${CENTER})`}
                  />
                  {/* Live segment with pulse */}
                  <AnimatedCircle
                    cx={CENTER}
                    cy={CENTER}
                    r={RING_RADIUS}
                    stroke="rgba(255, 255, 255, 1.0)"
                    strokeWidth={RING_STROKE_WIDTH}
                    fill="none"
                    strokeDasharray={`${liveSegment.dash} ${CIRCUMFERENCE}`}
                    strokeDashoffset={liveSegment.offset}
                    strokeLinecap="round"
                    transform={`rotate(-90, ${CENTER}, ${CENTER})`}
                    animatedProps={liveSegmentAnimatedProps}
                  />
                </>
              )}
            </Svg>

            {/* Time label — visible during scrub */}
            <Animated.View style={[styles.timeLabelContainer, timeLabelStyle]}>
              <Text style={styles.timeLabelText}>{scrubTimeLabel}</Text>
            </Animated.View>

            {/* Center content — tap to cycle through info modes */}
            <Animated.View style={[styles.centerContent, centerFadeStyle]}>
              <AnimatedText
                key={`title-${fadeKey}`}
                style={[styles.centerTitle, textFadeStyle]}
              >
                {displayText.title}
              </AnimatedText>
              <AnimatedText
                key={`label-${fadeKey}`}
                style={[styles.centerLabel, textFadeStyle]}
              >
                {displayText.label}
              </AnimatedText>
            </Animated.View>
          </View>
        </View>
      </GestureDetector>
    </AnimatedView>
  );
}
