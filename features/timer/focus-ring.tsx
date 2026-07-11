import { useProjects } from "@/features/projects/projects-store";
import { useSessionsStore } from "@/features/sessions/sessions-store";
import { useTimerStore } from "@/features/timer/timer-store";
import { heroProgress } from "@/lib/hero-animation";
import { scrubActive, scrubProgress } from "@/lib/scrub-playback";
import * as Haptics from "expo-haptics";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedView = Animated.createAnimatedComponent(View);
const AnimatedText = Animated.createAnimatedComponent(Text);

const SVG_SIZE = 280;
const RING_RADIUS = 110;
const RING_STROKE_WIDTH = 8;
const CENTER = SVG_SIZE / 2;
const CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const DAY_SECONDS = 24 * 3600;

type InfoMode = "total" | "sessions" | "longest";
const INFO_MODES: InfoMode[] = ["total", "sessions", "longest"];

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 40,
  },
  svgWrapper: { width: SVG_SIZE, height: SVG_SIZE, position: "relative" },
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
  return h === 0 ? `${m}m` : `${h}h ${m}m`;
}

function secondsSinceMidnight(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  return `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

type SegmentData = {
  id: string;
  dash: number;
  offset: number;
  sessionStartSec: number;
  startFraction: number;
  endFraction: number;
};

const SPLASH_ENTRANCE_DELAY = 1500;

function SegmentCircle({
  seg,
  isSelected,
  index,
}: {
  seg: SegmentData;
  isSelected: boolean;
  index: number;
}) {
  const selectProgress = useSharedValue(0);
  const entranceOpacity = useSharedValue(0);

  useEffect(() => {
    const base = heroProgress.value < 1 ? SPLASH_ENTRANCE_DELAY : 0;
    entranceOpacity.value = withDelay(
      base + index * 60,
      withTiming(1, { duration: 400 }),
    );
  }, []);

  useEffect(() => {
    selectProgress.value = withTiming(isSelected ? 1 : 0, { duration: 200 });
  }, [isSelected, selectProgress]);

  const animatedProps = useAnimatedProps(() => ({
    opacity:
      entranceOpacity.value *
      ((scrubProgress.value * DAY_SECONDS >= seg.sessionStartSec ? 0.92 : 0) +
        selectProgress.value * 0.08),
    strokeWidth: RING_STROKE_WIDTH + selectProgress.value * 3,
  }));

  return (
    <AnimatedCircle
      cx={CENTER}
      cy={CENTER}
      r={RING_RADIUS}
      stroke="rgba(255, 255, 255, 0.9)"
      fill="none"
      strokeDasharray={`${seg.dash} ${CIRCUMFERENCE}`}
      strokeDashoffset={seg.offset}
      strokeLinecap="round"
      transform={`rotate(-90, ${CENTER}, ${CENTER})`}
      animatedProps={animatedProps}
    />
  );
}

type CardPosition = { x: number; y: number; above: boolean };

function SessionCard({
  session,
  project,
  position,
  onDismiss,
}: {
  session: {
    title: string;
    duration: number;
    startTime: string;
    endTime: string;
  };
  project: { name: string; color: string } | null;
  position: CardPosition;
  onDismiss: () => void;
}) {
  const CARD_WIDTH = 200;
  const { width: screenWidth } = Dimensions.get("window");
  const left = Math.max(
    12,
    Math.min(position.x - CARD_WIDTH / 2, screenWidth - CARD_WIDTH - 12),
  );
  const top = position.above ? position.y - 110 : position.y + 16;

  return (
    <Modal transparent animationType="none" onRequestClose={onDismiss}>
      <Pressable style={{ flex: 1 }} onPress={onDismiss}>
        <View
          style={{
            position: "absolute",
            left,
            top,
            width: CARD_WIDTH,
            backgroundColor: "#1c1c1e",
            borderRadius: 16,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.1)",
            padding: 16,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.6,
            shadowRadius: 16,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              marginBottom: 8,
            }}
          >
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: project?.color ?? "rgba(255,255,255,0.4)",
              }}
            />
            <Text
              style={{
                fontSize: 10,
                color: "rgba(255,255,255,0.4)",
                fontWeight: "600",
                letterSpacing: 1.5,
                textTransform: "uppercase",
              }}
            >
              {project?.name ?? "No Project"}
            </Text>
          </View>
          <Text
            style={{
              fontSize: 15,
              fontWeight: "600",
              color: "white",
              letterSpacing: -0.3,
              marginBottom: 4,
            }}
            numberOfLines={2}
          >
            {session.title}
          </Text>
          <Text
            style={{
              fontSize: 13,
              color: "rgba(255,255,255,0.5)",
              fontWeight: "500",
            }}
          >
            {formatDuration(session.duration)}
          </Text>
          <Text
            style={{
              fontSize: 11,
              color: "rgba(255,255,255,0.3)",
              marginTop: 2,
            }}
          >
            {formatTime(session.startTime)} – {formatTime(session.endTime)}
          </Text>
        </View>
      </Pressable>
    </Modal>
  );
}

export function FocusRing() {
  const { sessions } = useSessionsStore();
  const { isTracking, startTimestamp } = useTimerStore();
  const { projects } = useProjects();

  const [liveTotal, setLiveTotal] = useState(0);
  const liveDash = useSharedValue(0);
  const liveOffset = useSharedValue(0);
  const liveSegmentOpacity = useSharedValue(0.7);

  const [infoMode, setInfoMode] = useState<InfoMode>("total");
  const [fadeKey, setFadeKey] = useState(0);
  const [scrubTimeLabel, setScrubTimeLabel] = useState("");

  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(
    null,
  );
  const [cardPosition, setCardPosition] = useState<CardPosition | null>(null);

  const svgRef = useRef<View>(null);
  const scrubStartX = useSharedValue(0);
  const scrubStartY = useSharedValue(0);

  const todaySessions = useMemo(() => {
    const today = new Date().toDateString();
    return sessions
      .filter((s) => new Date(s.startTime).toDateString() === today)
      .sort(
        (a, b) =>
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
      );
  }, [sessions]);

  const completedStats = useMemo(() => {
    let total = 0,
      longest = 0;
    for (const s of todaySessions) {
      total += s.duration;
      if (s.duration > longest) longest = s.duration;
    }
    return { total, longest, count: todaySessions.length };
  }, [todaySessions]);

  const segments: SegmentData[] = useMemo(
    () =>
      todaySessions.map((s) => {
        const startFraction = secondsSinceMidnight(s.startTime) / DAY_SECONDS;
        const lengthFraction = s.duration / DAY_SECONDS;
        return {
          id: s.id,
          dash: lengthFraction * CIRCUMFERENCE,
          offset: -(startFraction * CIRCUMFERENCE),
          sessionStartSec: secondsSinceMidnight(s.startTime),
          startFraction,
          endFraction: startFraction + lengthFraction,
        };
      }),
    [todaySessions],
  );

  const selectedSession =
    todaySessions.find((s) => s.id === selectedSegmentId) ?? null;
  const project = selectedSession
    ? (projects.find((p) => p.id === selectedSession.projectId) ?? null)
    : null;

  const dismiss = () => {
    setSelectedSegmentId(null);
    setCardPosition(null);
  };

  const updateLabel = (fraction: number) => {
    const h = Math.floor(fraction * 24);
    const m = Math.floor((fraction * 24 * 60) % 60);
    setScrubTimeLabel(
      `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`,
    );
  };

  const triggerHaptic = () =>
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

  function handleTap(x: number, y: number) {
    if (cardPosition) {
      dismiss();
      return;
    }

    const dx = x - CENTER;
    const dy = y - CENTER;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist >= RING_RADIUS - 20 && dist <= RING_RADIUS + 20) {
      let angle = Math.atan2(dy, dx) + Math.PI / 2;
      if (angle < 0) angle += 2 * Math.PI;
      const fraction = angle / (2 * Math.PI);

      const hit = segments.find((seg) =>
        seg.endFraction > 1
          ? fraction >= seg.startFraction || fraction < seg.endFraction - 1
          : fraction >= seg.startFraction && fraction < seg.endFraction,
      );

      if (hit) {
        const midAngle =
          ((hit.startFraction + hit.endFraction) / 2) * 2 * Math.PI -
          Math.PI / 2;
        const localX = CENTER + RING_RADIUS * Math.cos(midAngle);
        const localY = CENTER + RING_RADIUS * Math.sin(midAngle);
        svgRef.current?.measure((_fx, _fy, _w, _h, px, py) => {
          const { height: screenHeight } = Dimensions.get("window");
          setSelectedSegmentId(hit.id);
          setCardPosition({
            x: px + localX,
            y: py + localY,
            above: py + localY > screenHeight / 2,
          });
        });
        return;
      }
    }

    setInfoMode(
      INFO_MODES[(INFO_MODES.indexOf(infoMode) + 1) % INFO_MODES.length],
    );
    setFadeKey((k) => k + 1);
  }

  const panGesture = Gesture.Pan()
    .activateAfterLongPress(400)
    .onStart((e) => {
      scrubStartX.value = e.x;
      scrubStartY.value = e.y;
      scrubActive.value = withTiming(1, { duration: 200 });
      runOnJS(triggerHaptic)();
    })
    .onUpdate((e) => {
      const dx = scrubStartX.value + e.translationX - CENTER;
      const dy = scrubStartY.value + e.translationY - CENTER;
      let angle = Math.atan2(dy, dx) + Math.PI / 2;
      if (angle < 0) angle += 2 * Math.PI;
      scrubProgress.value = angle / (2 * Math.PI);
      runOnJS(updateLabel)(angle / (2 * Math.PI));
    })
    .onEnd(() => {
      scrubActive.value = withTiming(0, { duration: 400 });
      scrubProgress.value = withTiming(1, { duration: 400 });
    });

  const tapGesture = Gesture.Tap().onStart((e) => {
    runOnJS(handleTap)(e.x, e.y);
  });

  const composed = Gesture.Exclusive(panGesture, tapGesture);

  useEffect(() => {
    if (!isTracking || !startTimestamp) {
      setLiveTotal(completedStats.total);
      liveSegmentOpacity.value = 0.7;
      return;
    }

    liveOffset.value =
      -(secondsSinceMidnight(startTimestamp) / DAY_SECONDS) * CIRCUMFERENCE;
    liveSegmentOpacity.value = withRepeat(
      withTiming(1.0, { duration: 1400 }),
      -1,
      true,
    );

    const tick = () => {
      const elapsed = Math.floor(
        (Date.now() - new Date(startTimestamp).getTime()) / 1000,
      );
      setLiveTotal(completedStats.total + elapsed);
      liveDash.value = (elapsed / DAY_SECONDS) * CIRCUMFERENCE;
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [
    isTracking,
    startTimestamp,
    completedStats.total,
    liveSegmentOpacity,
    liveDash,
    liveOffset,
  ]);

  const ringContainerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(heroProgress.value, [0.3, 0.8], [0, 1]),
  }));

  const fadeOpacity = useSharedValue(1);
  useEffect(() => {
    fadeOpacity.value = 0;
    fadeOpacity.value = withTiming(1, { duration: 300 });
  }, [fadeKey, fadeOpacity]);

  const textFadeStyle = useAnimatedStyle(() => ({
    opacity: fadeOpacity.value,
  }));
  const centerFadeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrubActive.value, [0, 1], [1, 0.2]),
  }));
  const timeLabelStyle = useAnimatedStyle(() => ({
    opacity: withTiming(scrubActive.value, { duration: 200 }),
  }));

  const liveSegmentProps = useAnimatedProps(() => ({
    opacity: scrubActive.value > 0 ? 0 : liveSegmentOpacity.value,
    strokeDasharray: `${liveDash.value} ${CIRCUMFERENCE}`,
    strokeDashoffset: liveOffset.value,
  }));

  const liveGlowProps = useAnimatedProps(() => ({
    opacity: scrubActive.value > 0 ? 0 : 0.15,
    strokeDasharray: `${liveDash.value} ${CIRCUMFERENCE}`,
    strokeDashoffset: liveOffset.value,
  }));

  const displayText = {
    total: { title: formatDuration(liveTotal), label: "TODAY" },
    sessions: { title: String(completedStats.count), label: "SESSIONS" },
    longest: {
      title: formatDuration(completedStats.longest),
      label: "LONGEST SESSION",
    },
  }[infoMode];

  return (
    <AnimatedView style={[styles.container, ringContainerStyle]}>
      <GestureDetector gesture={composed}>
        <View ref={svgRef} style={styles.svgWrapper}>
          <Svg
            width={SVG_SIZE}
            height={SVG_SIZE}
            viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
          >
            <Circle
              cx={CENTER}
              cy={CENTER}
              r={RING_RADIUS}
              stroke="rgba(255, 255, 255, 0.11)"
              strokeWidth={RING_STROKE_WIDTH}
              fill="none"
            />
            {segments.map((seg, i) => (
              <SegmentCircle
                key={seg.id}
                seg={seg}
                isSelected={seg.id === selectedSegmentId}
                index={i}
              />
            ))}
            {isTracking && (
              <>
                <AnimatedCircle
                  cx={CENTER}
                  cy={CENTER}
                  r={RING_RADIUS}
                  stroke="rgba(255, 255, 255, 1.0)"
                  strokeWidth={18}
                  fill="none"
                  strokeLinecap="round"
                  transform={`rotate(-90, ${CENTER}, ${CENTER})`}
                  animatedProps={liveGlowProps}
                />
                <AnimatedCircle
                  cx={CENTER}
                  cy={CENTER}
                  r={RING_RADIUS}
                  stroke="rgba(255, 255, 255, 1.0)"
                  strokeWidth={RING_STROKE_WIDTH}
                  fill="none"
                  strokeLinecap="round"
                  transform={`rotate(-90, ${CENTER}, ${CENTER})`}
                  animatedProps={liveSegmentProps}
                />
              </>
            )}
          </Svg>

          <Animated.View style={[styles.timeLabelContainer, timeLabelStyle]}>
            <Text style={styles.timeLabelText}>{scrubTimeLabel}</Text>
          </Animated.View>

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
      </GestureDetector>

      {cardPosition && selectedSession && (
        <SessionCard
          session={selectedSession}
          project={project}
          position={cardPosition}
          onDismiss={dismiss}
        />
      )}
    </AnimatedView>
  );
}
