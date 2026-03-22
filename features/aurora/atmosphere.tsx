import { getAtmosphereColors } from "@/features/aurora/atmosphereColors";
import { detectAtmosphere } from "@/features/aurora/atmosphereDetector";
import { AURORA_SKSL, toFloat3 } from "@/features/aurora/atmosphereShader";
import { scrubProgress } from "@/features/timeline/playback";
import { Session } from "@/features/sessions/sessions-store";
import { useSettingsStore } from "@/features/settings/settings-store";
import { Canvas, Fill, Shader, Skia } from "@shopify/react-native-skia";
import { useWindowDimensions, View } from "react-native";
import {
  interpolate,
  useSharedValue as reanimatedUseSharedValue,
  useAnimatedReaction,
  useDerivedValue,
  useFrameCallback,
  withTiming,
} from "react-native-reanimated";

// Compile shader once at module scope
const effect = Skia.RuntimeEffect.Make(AURORA_SKSL)!;

interface AtmosphereProps {
  sessions: Session[];
}

/**
 * Atmosphere background component using Skia RuntimeEffect shader
 * Renders a living aurora sky that reacts to user's productivity
 * States: calm → gentle → aurora → strong-aurora
 * Can be toggled off in settings for a plain background
 */
export function Atmosphere({ sessions }: AtmosphereProps) {
  const { width, height } = useWindowDimensions();
  const { auroraEnabled } = useSettingsStore();

  // Detect atmosphere state from sessions
  const metrics = detectAtmosphere(sessions);

  // Compute colors (JS-side, updates when state changes)
  const colors = getAtmosphereColors(metrics.state);

  // Track state transitions with reanimated (always call hooks)
  const stateValue = reanimatedUseSharedValue(0);
  const time = reanimatedUseSharedValue(0);

  // Map state to numeric value for interpolation
  const stateMap = {
    calm: 0,
    gentle: 1,
    aurora: 2,
    "strong-aurora": 3,
  };

  // Update state with smooth transition (5s)
  useAnimatedReaction(
    () => stateMap[metrics.state],
    (nextState) => {
      stateValue.value = withTiming(nextState, { duration: 5000 });
    },
  );

  // Animation loop: update time every frame
  useFrameCallback((info) => {
    time.value = info.timeSinceFirstFrame;
  });

  // Build uniforms as derived value (Skia-side, no React re-renders per frame)
  const uniforms = useDerivedValue(() => {
    const baseIntensity = interpolate(
      stateValue.value,
      [0, 1, 2, 3],
      [0.0, 0.15, 0.5, 1.0],
    );
    // When scrubProgress < 1 (auto-play or manual scrub), scale intensity proportionally
    // floor at 0.2 so the atmosphere never goes completely dark
    const scrubMult = interpolate(
      scrubProgress.value,
      [0, 0.3, 1],
      [0.2, 0.5, 1.0],
      "clamp",
    );
    const intensity = baseIntensity * scrubMult;
    const speed = interpolate(
      stateValue.value,
      [0, 1, 2, 3],
      [0.15, 0.25, 0.45, 0.7],
    );

    // Lighten skyBottom slightly for gradient depth
    const skyBottomAdjusted: [number, number, number] = [
      (colors.background[0] + 8) / 255,
      (colors.background[1] + 5) / 255,
      (colors.background[2] + 10) / 255,
    ];

    return {
      uResolution: [width, height],
      uTime: time.value,
      uSpeed: speed,
      uIntensity: intensity,
      uSkyTop: toFloat3(colors.background),
      uSkyBottom: skyBottomAdjusted,
      uColor1: toFloat3(colors.auroraLow),
      uColor2: toFloat3(colors.auroraMid),
      uColor3: toFloat3(colors.auroraHigh),
    };
  });

  if (!auroraEnabled) {
    return (
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width,
          height,
          backgroundColor: "#000000",
        }}
        pointerEvents="none"
      />
    );
  }

  return (
    <Canvas
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width,
        height,
      }}
      pointerEvents="none"
    >
      <Fill>
        <Shader source={effect} uniforms={uniforms} />
      </Fill>
    </Canvas>
  );
}
