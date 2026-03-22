import { mmkvStorage } from '@/storage';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Insight } from '@/features/search/inference';

export type InferenceResult<T> = {
  data: T;
  fingerprint: string;
  timeframe: string;
  generatedAt: string;
};

type InferenceState = {
  insight: InferenceResult<Insight> | null;
  isAiEnabled: boolean;

  setInsight(r: InferenceResult<Insight>): void;
  setAiEnabled(v: boolean): void;
  clearCacheForTimeframe(timeframe: string): void;

  // Selectors
  isInsightStale(fingerprint: string, timeframe: string): boolean;
};

export const useInferenceStore = create<InferenceState>()(
  persist(
    (set, get) => ({
      insight: null,
      isAiEnabled: true,

      setInsight: (r) => set({ insight: r }),
      setAiEnabled: (v) => set({ isAiEnabled: v }),

      clearCacheForTimeframe: (timeframe) => {
        const state = get();
        if (state.insight?.timeframe === timeframe) {
          set({ insight: null });
        }
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
