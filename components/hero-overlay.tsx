import { heroProgress } from "@/lib/hero-animation";
import { Image } from "expo-image";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
} from "react-native-reanimated";

const AnimatedView = Animated.createAnimatedComponent(View);
const AnimatedImage = Animated.createAnimatedComponent(Image);

const LOGO_SIZE = 110;
const LOGO_SCALE_TARGET = 2;

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
  },
  bg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  glow: {
    position: "absolute",
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: LOGO_SIZE / 2,
  },
  logo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: LOGO_SIZE / 2,
  },
});

export function HeroOverlay() {
  const [isDone, setIsDone] = useState(false);

  useAnimatedReaction(
    () => heroProgress.value,
    (p) => {
      if (p >= 0.92) runOnJS(setIsDone)(true);
    },
  );

  const bgStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      heroProgress.value,
      [0.55, 0.88],
      [1, 0],
      Extrapolation.CLAMP,
    ),
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      heroProgress.value,
      [0.18, 0.32, 0.52],
      [0, 1, 0],
      Extrapolation.CLAMP,
    ),
  }));

  const logoStyle = useAnimatedStyle(() => {
    const glowPulse = interpolate(
      heroProgress.value,
      [0.22, 0.34, 0.5],
      [0, 0.06, 0],
      Extrapolation.CLAMP,
    );
    const scale =
      interpolate(
        heroProgress.value,
        [0.38, 0.88],
        [1, LOGO_SCALE_TARGET],
        Extrapolation.CLAMP,
      ) + glowPulse;

    const opacity = interpolate(
      heroProgress.value,
      [0.52, 0.82],
      [1, 0],
      Extrapolation.CLAMP,
    );

    return { transform: [{ scale }], opacity };
  });

  if (isDone) return null;

  return (
    <View style={styles.overlay} pointerEvents="none">
      {/* Dark background */}
      <AnimatedView style={[styles.bg, bgStyle]} />

      <View style={styles.center}>
        {/* Outer glow corona */}
        <AnimatedView
          style={[
            styles.glow,
            {
              transform: [{ scale: 1.5 }],
              backgroundColor: "rgba(100,180,255,0.07)",
            },
            glowStyle,
          ]}
        />
        {/* Inner glow halo */}
        <AnimatedView
          style={[
            styles.glow,
            {
              transform: [{ scale: 1.2 }],
              backgroundColor: "rgba(120,160,255,0.13)",
            },
            glowStyle,
          ]}
        />

        {/* Aurora logo */}
        <AnimatedImage
          source={require("@/assets/images/focus-logo.png")}
          style={[styles.logo, logoStyle]}
        />
      </View>
    </View>
  );
}
