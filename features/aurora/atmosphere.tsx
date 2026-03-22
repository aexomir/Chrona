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
 * Atmosphere background component using Skia RuntimeEffect shader.
 *
 * Intensity is now continuous (0.0–1.0), where 1.0 = 10 hours of focus.
 * Visual layers unlock progressively rather than snapping between 4 states.
 * State is still computed for color palette and animation speed selection.
 */
export function Atmosphere({ sessions }: AtmosphereProps) {
  const { width, height } = useWindowDimensions();
  const { auroraEnabled } = useSettingsStore();

  const metrics = detectAtmosphere(sessions);
  const colors = getAtmosphereColors(metrics.state);

  // Animate the continuous progress value (smooth 5s transition)
  const progressValue = reanimatedUseSharedValue(0);
  const time = reanimatedUseSharedValue(0);

  useAnimatedReaction(
    () => metrics.progress,
    (nextProgress) => {
      progressValue.value = withTiming(nextProgress, { duration: 5000 });
    },
  );

  useFrameCallback((info) => {
    time.value = info.timeSinceFirstFrame;
  });

  const uniforms = useDerivedValue(() => {
    // Intensity = continuous progress (0–1), scaled by scrub multiplier
    const scrubMult = interpolate(
      scrubProgress.value,
      [0, 0.3, 1],
      [0.2, 0.5, 1.0],
      "clamp",
    );
    const intensity = progressValue.value * scrubMult;

    // Speed scales with progress: slow when idle, faster as day fills up
    const speed = interpolate(
      progressValue.value,
      [0, 0.05, 0.15, 0.50, 1.0],
      [0.12, 0.20, 0.32, 0.55, 0.80],
    );

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
