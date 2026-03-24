import { heroProgress } from "@/lib/hero-animation";
import { useEffect, useState } from "react";
import {
  Dimensions,
  LayoutChangeEvent,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedProps,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import Svg, {
  ClipPath,
  Defs,
  Line,
  Rect,
  Text as SvgText,
} from "react-native-svg";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ─── Layout ──────────────────────────────────────────────────────────────────
const FONT_SIZE = 52;
const FONT_FAMILY = "Pacifico_400Regular";
const SVG_HEIGHT = FONT_SIZE * 2.4;
const TEXT_BASELINE_Y = FONT_SIZE * 1.35;
const UNDERLINE_GAP = 16;
const UNDERLINE_Y = TEXT_BASELINE_Y + UNDERLINE_GAP;

// ─── Colors ──────────────────────────────────────────────────────────────────
const BG_COLOR = "#FE192F";
const TEXT_COLOR = "#FFFFFF";
const LINE_COLOR = "#FFFFFF";

// ─── Clip ────────────────────────────────────────────────────────────────────
const CLIP_ID = "chronaSplashWordmarkClip";

const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedLine = Animated.createAnimatedComponent(Line);

// ─── Timing (ms) ─────────────────────────────────────────────────────────────
//  0       Wordmark reveals left-to-right     (650ms, cubic-out)
//  650     Underline draws left-to-right      (320ms, linear)
//  1020    Brief settle pause
//  1050    BURST EXIT begins                  (420ms, cubic-in)
//  1470    Done — component unmounts

export function ChronaSplash() {
  const [isDone, setIsDone] = useState(false);

  const [lineWidth, setLineWidth] = useState(0);
  const lineWidthSV = useSharedValue(0);

  const wordmarkProgress = useSharedValue(0);
  const underlineProgress = useSharedValue(0);
  const exitProgress = useSharedValue(0);

  useEffect(() => {
    wordmarkProgress.value = withTiming(1, {
      duration: 650,
      easing: Easing.out(Easing.cubic),
    });
    underlineProgress.value = withDelay(
      650,
      withTiming(1, { duration: 320, easing: Easing.linear }),
    );

    exitProgress.value = withDelay(
      1050,
      withTiming(1, { duration: 420, easing: Easing.in(Easing.cubic) }),
    );
    heroProgress.value = withDelay(
      1050,
      withTiming(1, { duration: 420, easing: Easing.in(Easing.cubic) }),
    );
  }, []);

  useAnimatedReaction(
    () => exitProgress.value,
    (p) => {
      if (p >= 0.97) runOnJS(setIsDone)(true);
    },
  );

  const handleTextLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    setLineWidth(w);
    lineWidthSV.value = w;
  };

  // ─── Animated props ────────────────────────────────────────────────────────

  const rectAnimatedProps = useAnimatedProps(() => ({
    width: interpolate(
      wordmarkProgress.value,
      [0, 1],
      [0, SCREEN_WIDTH],
      Extrapolation.CLAMP,
    ),
  }));

  const lineAnimatedProps = useAnimatedProps(() => ({
    strokeDashoffset: interpolate(
      underlineProgress.value,
      [0, 1],
      [lineWidthSV.value, 0],
      Extrapolation.CLAMP,
    ),
  }));

  const burstStyle = useAnimatedStyle(() => {
    const p = exitProgress.value;
    return {
      transform: [
        { scale: interpolate(p, [0, 1], [1, 6], Extrapolation.CLAMP) },
      ],
      opacity: interpolate(p, [0.25, 1], [1, 0], Extrapolation.CLAMP),
    };
  });

  if (isDone) return null;

  const lineX1 = SCREEN_WIDTH / 2 - lineWidth / 2;
  const lineX2 = SCREEN_WIDTH / 2 + lineWidth / 2;

  return (
    <View style={styles.overlay} pointerEvents="none">
      {/* Single Animated.View — everything bursts together as one unit */}
      <Animated.View style={[StyleSheet.absoluteFillObject, burstStyle]}>
        {/* Solid red background — visually identical to native launch screen */}
        <View style={styles.bg} />

        {/* Hidden native Text */}
        <Text
          style={styles.measureText}
          onLayout={handleTextLayout}
          accessibilityElementsHidden
        >
          Chrona
        </Text>

        {/* Centered wordmark composition */}
        <View style={styles.center}>
          <Svg width={SCREEN_WIDTH} height={SVG_HEIGHT} style={styles.svg}>
            <Defs>
              <ClipPath id={CLIP_ID}>
                <AnimatedRect
                  x={0}
                  y={0}
                  height={SVG_HEIGHT}
                  animatedProps={rectAnimatedProps}
                />
              </ClipPath>
            </Defs>

            {/* Pacifico wordmark  */}
            <SvgText
              x={SCREEN_WIDTH / 2}
              y={TEXT_BASELINE_Y}
              textAnchor="middle"
              fontFamily={FONT_FAMILY}
              fontSize={FONT_SIZE}
              fill={TEXT_COLOR}
              clipPath={`url(#${CLIP_ID})`}
            >
              Chrona
            </SvgText>

            {/* Underline */}
            {lineWidth > 0 && (
              <AnimatedLine
                x1={lineX1}
                y1={UNDERLINE_Y}
                x2={lineX2}
                y2={UNDERLINE_Y}
                stroke={LINE_COLOR}
                strokeWidth={3}
                strokeLinecap="round"
                strokeDasharray={lineWidth}
                animatedProps={lineAnimatedProps}
              />
            )}
          </Svg>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
  },
  bg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BG_COLOR,
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  svg: {
    overflow: "visible",
  },
  measureText: {
    position: "absolute",
    fontFamily: FONT_FAMILY,
    fontSize: FONT_SIZE,
    opacity: 0,
  },
});
