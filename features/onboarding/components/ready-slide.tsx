import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

const PULSE_DURATION_MS = 2800;

export function ReadySlide({ onFinish }: { onFinish: () => void }) {
  const pulse = useSharedValue(1);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1.04, { duration: PULSE_DURATION_MS }),
      -1,
      true,
    );
  }, [pulse]);

  const outerRingStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: 2 - pulse.value,
  }));

  return (
    <Pressable
      onPress={onFinish}
      className="flex-1 items-center justify-center gap-12"
    >
      <Animated.View style={outerRingStyle}>
        <View style={styles.ringOuter}>
          <View style={styles.ringMiddle}>
            <View style={styles.ringInner} />
          </View>
        </View>
      </Animated.View>

      <Animated.View entering={FadeIn.delay(400).duration(600)}>
        <Text style={styles.title}>Begin.</Text>
      </Animated.View>

      <Animated.View
        entering={FadeIn.delay(1200).duration(600)}
        className="absolute bottom-[52px]"
      >
        <Text style={styles.hint}>TAP ANYWHERE</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  ringOuter: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  ringMiddle: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  ringInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.2)",
  },
  title: {
    fontSize: 52,
    fontWeight: "200",
    color: "white",
    letterSpacing: -2,
  },
  hint: {
    color: "rgba(255,255,255,0.15)",
    fontSize: 12,
    letterSpacing: 1,
  },
});
