import { Atmosphere } from "@/components/atmosphere";
import { FocusRing } from "@/components/focus-ring";
import { SessionConstellation } from "@/components/session-constellation";
import { heroProgress } from "@/lib/hero-animation";
import { scrubProgress } from "@/lib/playback";
import { useSessionsStore } from "@/stores/sessions-store";
import { useSettingsStore } from "@/stores/settings-store";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const AnimatedView = Animated.createAnimatedComponent(View);

const styles = StyleSheet.create({
  liquidGlassButton: {
    width: 44,
    height: 44,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  gearIcon: {
    width: 20,
    height: 20,
  },
});

export default function DashboardScreen() {
  const { sessions } = useSessionsStore();
  const { constellationEnabled } = useSettingsStore();
  const insets = useSafeAreaInsets();
  const router = useRouter();
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
      {/* Toolbar Header with Settings Button */}
      <Animated.View
        style={[
          dashboardStyle,
          {
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            paddingTop: insets.top,
            paddingHorizontal: 16,
            paddingBottom: 12,
            zIndex: 10,
          },
        ]}
      >
        <View style={{ justifyContent: "flex-end", alignItems: "flex-end" }}>
          <Pressable
            onPress={() => router.push("/settings")}
            hitSlop={8}
            style={styles.liquidGlassButton}
          >
            <Image
              source="sf:gearshape.fill"
              style={styles.gearIcon}
              tintColor="rgba(255, 255, 255, 0.6)"
            />
          </Pressable>
        </View>
      </Animated.View>
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
