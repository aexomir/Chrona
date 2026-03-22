import { useEffect } from "react";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

const EASE = { duration: 300, easing: Easing.out(Easing.cubic) };

export function AnimatedBar({
  targetHeight,
  color,
}: {
  targetHeight: number;
  color: string;
}) {
  const height = useSharedValue(0);

  useEffect(() => {
    height.value = withTiming(targetHeight, EASE);
  }, [targetHeight, height]);

  const animStyle = useAnimatedStyle(() => ({ height: height.value }));

  return (
    <Animated.View
      style={[
        animStyle,
        {
          backgroundColor: color,
          flex: 1,
          borderRadius: 2,
          alignSelf: "flex-end",
        },
      ]}
    />
  );
}
