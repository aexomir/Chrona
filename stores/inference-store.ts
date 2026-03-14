import { mmkvStorage } from '@/storage';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ProductivityScore, Insight } from '@/lib/inference';

export type InferenceResult<T> = {
  data: T;
  fingerprint: string;
  timeframe: string;
  generatedAt: string;
};

type InferenceState = {
  productivityScore: InferenceResult<ProductivityScore> | null;
  insight: InferenceResult<Insight> | null;
  isAiEnabled: boolean;

  setProductivityScore(r: InferenceResult<ProductivityScore>): void;
  setInsight(r: InferenceResult<Insight>): void;
  setAiEnabled(v: boolean): void;
  clearCacheForTimeframe(timeframe: string): void;

  // Selectors
  isScoreStale(fingerprint: string, timeframe: string): boolean;
  isInsightStale(fingerprint: string, timeframe: string): boolean;
};

export const useInferenceStore = create<InferenceState>()(
  persist(
    (set, get) => ({
      productivityScore: null,
      insight: null,
      isAiEnabled: true,

      setProductivityScore: (r) => set({ productivityScore: r }),
      setInsight: (r) => set({ insight: r }),
      setAiEnabled: (v) => set({ isAiEnabled: v }),

      clearCacheForTimeframe: (timeframe) => {
        const state = get();
        if (state.productivityScore?.timeframe === timeframe) {
          set({ productivityScore: null });
        }
        if (state.insight?.timeframe === timeframe) {
          set({ insight: null });
        }
      },

      isScoreStale: (fingerprint, timeframe) => {
        const score = get().productivityScore;
        return !score || score.fingerprint !== fingerprint || score.timeframe !== timeframe;
      },

      isInsightStale: (fingerprint, timeframe) => {
        const insight = get().insight;
        return !insight || insight.fingerprint !== fingerprint || insight.timeframe !== timeframe;
      },
    }),
    {
      name: 'inference-cache',
      storage: mmkvStorage,
    }
  )
);
