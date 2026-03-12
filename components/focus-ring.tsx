import { heroProgress } from '@/lib/hero-animation';
import { useTimerStore } from '@/stores/timer-store';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedView = Animated.createAnimatedComponent(View);

const SVG_SIZE = 220;
const RING_RADIUS = 100;
const RING_STROKE_WIDTH = 10;
const CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function FocusRing() {
  const { isTracking, startTimestamp } = useTimerStore();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const rotationAngle = useSharedValue(0);
  const isTrackingShared = useSharedValue(isTracking ? 1 : 0);

  // Update elapsed time and rotation on mount and when tracking changes
  useEffect(() => {
    isTrackingShared.value = isTracking ? 1 : 0;

    if (!isTracking || !startTimestamp) {
      setElapsedSeconds(0);
      rotationAngle.value = 0;
      return;
    }

    // Start rotation animation
    rotationAngle.value = withRepeat(
      withTiming(360, {
        duration: 4000,
        easing: Easing.linear,
      }),
      -1
    );

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const startTime = new Date(startTimestamp).getTime();
      const elapsed = Math.floor((now - startTime) / 1000);
      setElapsedSeconds(elapsed);
    }, 100);

    return () => clearInterval(interval);
  }, [isTracking, startTimestamp]);

  // Ring arc animated props
  const arcAnimatedProps = useAnimatedProps(() => {
    const offset = interpolate(
      isTrackingShared.value,
      [0, 1],
      [CIRCUMFERENCE * 0.75, 0]
    );
    return {
      strokeDashoffset: offset,
    };
  });

  // Ring container opacity
  const ringContainerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(heroProgress.value, [0.3, 0.8], [0, 1]),
  }));

  // SVG wrapper rotation
  const svgWrapperStyle = useAnimatedStyle(() => ({
    width: SVG_SIZE,
    height: SVG_SIZE,
    transform: [{ rotate: `${rotationAngle.value}deg` }],
  }));

  // Center text opacity
  const centerTextStyle = useAnimatedStyle(() => ({
    opacity: interpolate(heroProgress.value, [0.7, 1], [0, 1]),
  }));

  const centerText = isTracking ? formatTime(elapsedSeconds) : '——';

  return (
    <AnimatedView style={[ringContainerStyle, { alignItems: 'center', justifyContent: 'center' }]}>
      <AnimatedView style={svgWrapperStyle}>
        <Svg width={SVG_SIZE} height={SVG_SIZE} viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}>
          {/* Track circle (always visible, low opacity) */}
          <Circle
            cx={SVG_SIZE / 2}
            cy={SVG_SIZE / 2}
            r={RING_RADIUS}
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth={RING_STROKE_WIDTH}
            fill="none"
          />

          {/* Active arc (dash offset animates) */}
          <AnimatedCircle
            cx={SVG_SIZE / 2}
            cy={SVG_SIZE / 2}
            r={RING_RADIUS}
            stroke="rgba(255, 255, 255, 0.85)"
            strokeWidth={RING_STROKE_WIDTH}
            fill="none"
            strokeDasharray={CIRCUMFERENCE}
            strokeLinecap="round"
            animatedProps={arcAnimatedProps}
          />
        </Svg>
      </AnimatedView>

      {/* Center text (below ring) */}
      <AnimatedView
        style={[
          {
            position: 'absolute',
            alignItems: 'center',
            justifyContent: 'center',
          },
          centerTextStyle,
        ]}
      >
        <Text
          style={{
            fontSize: 24,
            fontWeight: '600',
            color: 'white',
            fontFamily: 'Courier New',
          }}
        >
          {centerText}
        </Text>
      </AnimatedView>
    </AnimatedView>
  );
}
