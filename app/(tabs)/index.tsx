import { FocusRing } from "@/components/focus-ring";
import { heroProgress } from "@/lib/hero-animation";
import { useSessionsStore } from "@/stores/sessions-store";
import { Text, View } from "react-native";
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

  // Calculate today's stats
  const today = new Date().toDateString();
  const todaySessions = sessions.filter(
    (s) => new Date(s.startTime).toDateString() === today,
  );
  const totalDuration = todaySessions.reduce((acc, s) => acc + s.duration, 0);
  const hours = Math.floor(totalDuration / 3600);
  const minutes = Math.floor((totalDuration % 3600) / 60);

  return (
    <View className="flex-1 bg-black items-center justify-center">
      {/* Focus Ring */}
      <FocusRing />

      {/* Dashboard content */}
      <AnimatedView style={dashboardStyle} className="mt-8 items-center">
        <Text className="text-white text-sm font-medium text-opacity-60">
          Today's Sessions
        </Text>
        <Text className="text-white text-2xl font-bold mt-2">
          {todaySessions.length}
        </Text>
        <Text className="text-white text-sm font-medium text-opacity-60 mt-4">
          Total Time
        </Text>
        <Text className="text-white text-2xl font-bold mt-2">
          {hours}h {minutes}m
        </Text>
      </AnimatedView>
    </View>
  );
}
