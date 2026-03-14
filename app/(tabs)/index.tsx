import { Atmosphere } from "@/components/atmosphere";
import { FocusRing } from "@/components/focus-ring";
import { SessionConstellation } from "@/components/session-constellation";
import { heroProgress } from "@/lib/hero-animation";
import { scrubProgress } from "@/lib/playback";
import { useSessionsStore } from "@/stores/sessions-store";
import { useSettingsStore } from "@/stores/settings-store";
import { ScrollView, View } from "react-native";
import Animated, {
  interpolate,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useEffect, useRef } from "react";

const AnimatedView = Animated.createAnimatedComponent(View);

export default function DashboardScreen() {
  const { sessions } = useSessionsStore();
  const { constellationEnabled } = useSettingsStore();
  const hasPlayedRef = useRef(false);

  // Auto-playback on first mount only
  useEffect(() => {
    if (hasPlayedRef.current) return;
    hasPlayedRef.current = true;

    // Reset to start-of-day, then animate to "now" in 1 second
    scrubProgress.value = 0;
    scrubProgress.value = withTiming(1, {
      duration: 1000,
      easing: Easing.out(Easing.cubic),
    });
  }, []);

  const dashboardStyle = useAnimatedStyle(() => ({
    opacity: interpolate(heroProgress.value, [0.4, 1], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  }));

  return (
    <View style={{ flex: 1 }}>
      <Atmosphere sessions={sessions} />
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        contentInsetAdjustmentBehavior="automatic"
        scrollEnabled={false}
      >
        <AnimatedView
          style={dashboardStyle}
          className="flex-1 items-center justify-center"
        >
          {/* Focus Ring with integrated stats */}
          <FocusRing />
          {constellationEnabled && <SessionConstellation />}
        </AnimatedView>
      </ScrollView>
    </View>
  );
}
