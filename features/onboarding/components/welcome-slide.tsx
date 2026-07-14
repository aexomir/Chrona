import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

function formatClock(s: number) {
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export function WelcomeSlide({ onDismiss }: { onDismiss: () => void }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <Pressable
      onPress={onDismiss}
      className="flex-1 items-center justify-center"
    >
      <Text style={styles.clock}>{formatClock(elapsed)}</Text>

      <Animated.View
        entering={FadeIn.delay(2000).duration(800)}
        className="mt-[18px]"
      >
        <Text style={styles.subtitle}>Your time is already passing.</Text>
      </Animated.View>

      <Animated.View
        entering={FadeIn.delay(4000).duration(600)}
        className="absolute bottom-[52px]"
      >
        <Text style={styles.hint}>TAP ANYWHERE</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  clock: {
    fontVariant: ["tabular-nums"],
    fontSize: 54,
    fontWeight: "200",
    color: "white",
    letterSpacing: -2,
  },
  subtitle: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 17,
    letterSpacing: -0.3,
  },
  hint: {
    color: "rgba(255,255,255,0.18)",
    fontSize: 12,
    letterSpacing: 1,
  },
});
