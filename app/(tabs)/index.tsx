import { FocusRing } from "@/components/focus-ring";
import { heroProgress } from "@/lib/hero-animation";
import { ScrollView, View } from "react-native";
import Animated, {
  interpolate,
  useAnimatedStyle,
} from "react-native-reanimated";

const AnimatedView = Animated.createAnimatedComponent(View);

export default function DashboardScreen() {
  // Dashboard content fades in as hero animation progresses
  const dashboardStyle = useAnimatedStyle(() => ({
    opacity: interpolate(heroProgress.value, [0.4, 1], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  }));

  return (
    <ScrollView
      contentContainerStyle={{ flexGrow: 1 }}
      className="bg-black"
      contentInsetAdjustmentBehavior="automatic"
      scrollEnabled={false}
    >
      <AnimatedView style={dashboardStyle} className="flex-1 items-center justify-center">
        {/* Focus Ring with integrated stats */}
        <FocusRing />
      </AnimatedView>
    </ScrollView>
  );
}
