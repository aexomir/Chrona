import { heroIconOpacity, heroProgress } from '@/lib/hero-animation';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

const AnimatedView = Animated.createAnimatedComponent(View);
const AnimatedImage = Animated.createAnimatedComponent(Image);

export function HeroOverlay() {
  const [isDone, setIsDone] = useState(false);

  // Trigger icon fade when heroProgress reaches 1
  useAnimatedReaction(
    () => heroProgress.value,
    (progress) => {
      if (progress >= 0.99) {
        heroIconOpacity.value = withSpring(0, {
          mass: 1,
          damping: 10,
          stiffness: 100,
        });
      }
    }
  );

  // Track when overlay should be hidden
  useAnimatedReaction(
    () => heroIconOpacity.value,
    (opacity) => {
      if (opacity < 0.1) {
        runOnJS(setIsDone)(true);
      }
    }
  );

  // Background opacity
  const bgStyle = useAnimatedStyle(() => ({
    opacity: interpolate(heroProgress.value, [0, 0.7], [1, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }),
  }));

  // Icon scale and opacity
  const iconStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: interpolate(heroProgress.value, [0, 1], [1.0, 0.24], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        }),
      },
    ],
    opacity: heroIconOpacity.value,
  }));

  if (isDone) return null;

  return (
    <AnimatedView
      style={[
        { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100 },
        bgStyle,
      ]}
      pointerEvents={isDone ? 'none' : 'auto'}
    >
      {/* Black background */}
      <View style={{ flex: 1, backgroundColor: '#000' }} />

      {/* Hero icon centered */}
      <AnimatedView
        style={[
          {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: 'center',
            justifyContent: 'center',
          },
          iconStyle,
        ]}
        pointerEvents="none"
      >
        <AnimatedImage
          source={require('@/assets/images/splash-icon.png')}
          style={{ width: 200, height: 200 }}
        />
      </AnimatedView>
    </AnimatedView>
  );
}
