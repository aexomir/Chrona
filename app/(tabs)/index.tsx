import { FocusRing } from "@/components/focus-ring";
import { SessionConstellation } from "@/components/session-constellation";
import { Atmosphere } from "@/components/atmosphere";
import { heroProgress } from "@/lib/hero-animation";
import { useSessionsStore } from "@/stores/sessions-store";
import { ScrollView, View } from "react-native";
import Animated, {
  interpolate,
  useAnimatedStyle,
} from "react-native-reanimated";

const AnimatedView = Animated.createAnimatedComponent(View);

export default function DashboardScreen() {
  const { sessions } = useSessionsStore();

  // Dashboard content fades in as hero animation progresses
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
        <AnimatedView style={dashboardStyle} className="flex-1 items-center justify-center">
          {/* Focus Ring with integrated stats */}
          <FocusRing />
          <SessionConstellation />
        </AnimatedView>
      </ScrollView>
    </View>
  );
}
