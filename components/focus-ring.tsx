import { heroProgress } from '@/lib/hero-animation';
import { useSessionsStore } from '@/stores/sessions-store';
import { useTimerStore } from '@/stores/timer-store';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedView = Animated.createAnimatedComponent(View);

const SVG_SIZE = 280;
const RING_RADIUS = 110;
const RING_STROKE_WIDTH = 8;
const CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const DAILY_GOAL_SECONDS = 8 * 3600; // 8 hours goal

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 40,
  },
  svgWrapper: {
    width: SVG_SIZE,
    height: SVG_SIZE,
    position: 'relative',
  },
  centerContent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerTitle: {
    fontSize: 48,
    fontWeight: '700',
    color: 'white',
    marginBottom: 4,
  },
  centerLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  indicatorsRow: {
    flexDirection: 'row',
    gap: 40,
    marginTop: 40,
  },
  indicatorBox: {
    alignItems: 'center',
  },
  indicatorValue: {
    fontSize: 24,
    fontWeight: '600',
    color: 'white',
    marginBottom: 2,
  },
  indicatorLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.5)',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
});

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

export function FocusRing() {
  const { sessions } = useSessionsStore();
  const { isTracking, startTimestamp } = useTimerStore();
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [longestBlockSeconds, setLongestBlockSeconds] = useState(0);
  const [sessionCount, setSessionCount] = useState(0);
  const progressShared = useSharedValue(0);

  // Calculate today's stats
  const todayStats = useMemo(() => {
    const today = new Date().toDateString();
    const todaySessions = sessions.filter(
      (s) => new Date(s.startTime).toDateString() === today
    );

    // Sort by startTime to calculate longest block
    const sortedSessions = [...todaySessions].sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );

    let totalDuration = 0;
    let longestBlock = 0;

    // Calculate total and longest single session
    for (let i = 0; i < sortedSessions.length; i++) {
      const session = sortedSessions[i];
      totalDuration += session.duration;

      if (session.duration > longestBlock) {
        longestBlock = session.duration;
      }
    }

    // If currently tracking, add elapsed time to total
    let currentElapsed = 0;
    if (isTracking && startTimestamp) {
      const now = new Date().getTime();
      const startTime = new Date(startTimestamp).getTime();
      currentElapsed = Math.floor((now - startTime) / 1000);
    }

    const totalWithCurrent = totalDuration + currentElapsed;

    return {
      total: totalWithCurrent,
      longest: longestBlock,
      count: todaySessions.length,
      progress: Math.min(totalWithCurrent / DAILY_GOAL_SECONDS, 1),
    };
  }, [sessions, isTracking, startTimestamp]);

  // Update states and animate progress
  useEffect(() => {
    setTotalSeconds(todayStats.total);
    setLongestBlockSeconds(todayStats.longest);
    setSessionCount(todayStats.count);

    // Animate progress smoothly
    progressShared.value = withTiming(todayStats.progress, {
      duration: 500,
    });
  }, [todayStats.progress, todayStats.total, todayStats.longest, todayStats.count]);

  // Progress arc animated props
  const arcAnimatedProps = useAnimatedProps(() => {
    const offset = CIRCUMFERENCE * (1 - progressShared.value);
    return {
      strokeDashoffset: offset,
    };
  });

  // Ring container opacity (fade in with hero animation)
  const ringContainerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(heroProgress.value, [0.3, 0.8], [0, 1]),
  }));

  return (
    <AnimatedView style={[styles.container, ringContainerStyle]}>
      {/* SVG Ring */}
      <View style={styles.svgWrapper}>
        <Svg width={SVG_SIZE} height={SVG_SIZE} viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}>
          {/* Background track */}
          <Circle
            cx={SVG_SIZE / 2}
            cy={SVG_SIZE / 2}
            r={RING_RADIUS}
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth={RING_STROKE_WIDTH}
            fill="none"
          />

          {/* Progress arc */}
          <AnimatedCircle
            cx={SVG_SIZE / 2}
            cy={SVG_SIZE / 2}
            r={RING_RADIUS}
            stroke="rgba(255, 255, 255, 0.9)"
            strokeWidth={RING_STROKE_WIDTH}
            fill="none"
            strokeDasharray={CIRCUMFERENCE}
            strokeLinecap="round"
            animatedProps={arcAnimatedProps}
            strokeDashoffset={0}
          />
        </Svg>

        {/* Center content */}
        <View style={styles.centerContent}>
          <Text style={styles.centerTitle}>{formatDuration(totalSeconds)}</Text>
          <Text style={styles.centerLabel}>TODAY</Text>
        </View>
      </View>

      {/* Secondary indicators */}
      <View style={styles.indicatorsRow}>
        {/* Sessions count */}
        <View style={styles.indicatorBox}>
          <Text style={styles.indicatorValue}>{sessionCount}</Text>
          <Text style={styles.indicatorLabel}>Sessions</Text>
        </View>

        {/* Longest block */}
        <View style={styles.indicatorBox}>
          <Text style={styles.indicatorValue}>{formatDuration(longestBlockSeconds)}</Text>
          <Text style={styles.indicatorLabel}>Longest Block</Text>
        </View>
      </View>
    </AnimatedView>
  );
}
