import { SessionConstellation } from "@/features/analytics/session-constellation";
import { Atmosphere } from "@/features/aurora/atmosphere";
import { useSessionsStore } from "@/features/sessions/sessions-store";
import { useSettingsStore } from "@/features/settings/settings-store";
import { FocusRing } from "@/features/timer/focus-ring";
import { heroProgress } from "@/lib/hero-animation";
import { scrubProgress } from "@/lib/scrub-playback";
import { Stack, useRouter } from "expo-router";
import { ScrollView, View } from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

const AnimatedView = Animated.createAnimatedComponent(View);

export default function DashboardScreen() {
  const router = useRouter();
  const { sessions } = useSessionsStore();
  const { constellationEnabled } = useSettingsStore();
  const hasPlayed = useSharedValue(false);

  useAnimatedReaction(
    () => heroProgress.value,
    (p) => {
      if (!hasPlayed.value && p > 0) {
        hasPlayed.value = true;
        scrubProgress.value = 0;
        scrubProgress.value = withTiming(1, {
          duration: 1000,
          easing: Easing.out(Easing.cubic),
        });
      }
    },
  );

  const dashboardStyle = useAnimatedStyle(() => ({
    opacity: interpolate(heroProgress.value, [0.4, 1], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  }));

  return (
    <View style={{ flex: 1 }}>
      <Atmosphere sessions={sessions} />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon="gearshape.fill"
          onPress={() => router.push("/settings")}
        />
      </Stack.Toolbar>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        contentInsetAdjustmentBehavior="automatic"
        scrollEnabled={false}
      >
        <AnimatedView
          style={dashboardStyle}
          className="flex-1 items-center justify-center"
        >
          <FocusRing />
          {constellationEnabled && <SessionConstellation />}
        </AnimatedView>
      </ScrollView>
    </View>
  );
}
