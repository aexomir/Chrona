import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { useEffect } from 'react';
import Animated, {
  withRepeat,
  withSequence,
  withTiming,
  useAnimatedStyle,
  useSharedValue,
  Easing,
} from 'react-native-reanimated';
import { GlassCard } from './glass-card';
import type { RnExecutorchError } from 'react-native-executorch';
import type { InferenceResult } from '@/features/search/inference-store';
import type { Insight } from '@/features/search/inference';

interface AiInsightCardProps {
  insight: InferenceResult<Insight> | null;
  isGenerating: boolean;
  isReady: boolean;
  downloadProgress: number;
  error: RnExecutorchError | null;
  onRefresh(): void;
}

const styles = StyleSheet.create({
  trackBackground: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#818cf8',
  },
  shimmerId: {
    width: '100%',
    height: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  shimmerBody: {
    width: '85%',
    height: 12,
    borderRadius: 6,
    marginBottom: 6,
  },
  cardContainer: {
    marginTop: 12,
  },
  cardContent: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  insightHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: 10,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginBottom: 8,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  refreshButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
});

function ShimmerRow({ width, height, style }: { width: string | number; height: number; style?: object }) {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.3, { duration: 800, easing: Easing.inOut(Easing.ease) })
      ),
      -1
    );
  }, [opacity]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          borderRadius: 8,
          marginBottom: 8,
        },
        style,
        animStyle,
      ]}
    />
  );
}

export function AiInsightCard({
  insight,
  isGenerating,
  isReady,
  downloadProgress,
  error,
  onRefresh,
}: AiInsightCardProps) {
  // Show nothing if nothing is ready
  if (!isReady && !insight && !isGenerating) {
    return null;
  }

  return (
    <GlassCard style={styles.cardContainer}>
      <View style={styles.cardContent}>
        {/* State A: Downloading */}
        {!isReady && !insight && isGenerating && (
          <View>
            <Text className="text-zinc-500 text-xs mb-2">Preparing AI model…</Text>
            <View style={styles.trackBackground}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.round(downloadProgress * 100)}%` },
                ]}
              />
            </View>
          </View>
        )}

        {/* State B: Generating / no cache */}
        {isReady && isGenerating && !insight && (
          <View>
            <ShimmerRow width="100%" height={16} />
            <ShimmerRow width="95%" height={12} />
            <ShimmerRow width="90%" height={12} />
            <Text className="text-zinc-400 text-xs mt-2">Analyzing your sessions…</Text>
          </View>
        )}

        {/* State C: Data ready */}
        {insight && !isGenerating && (
          <View>
            <View style={styles.insightHeaderRow}>
              <Image
                source="sf:sparkles"
                style={{ width: 16, height: 16, tintColor: '#818cf8', marginTop: 2 }}
              />
              <Text className="text-white font-semibold flex-1">{insight.data.headline}</Text>
            </View>

            <Text className="text-zinc-400 text-sm mb-2">{insight.data.body}</Text>

            {insight.data.tip && (
              <View style={styles.tipRow}>
                <Image
                  source="sf:lightbulb.fill"
                  style={{ width: 14, height: 14, tintColor: '#fbbf24', marginTop: 1 }}
                />
                <Text className="text-zinc-500 text-xs flex-1">{insight.data.tip}</Text>
              </View>
            )}

            <View style={styles.divider} />

            <View style={styles.footerRow}>
              <Text className="text-zinc-600 text-xs">
                {new Date(insight.generatedAt).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
              <Pressable
                onPress={onRefresh}
                style={styles.refreshButton}
              >
                <Text className="text-white text-xs font-medium">Refresh</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </GlassCard>
  );
}
