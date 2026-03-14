import { useState } from 'react';
import { useLLM, SMOLLM2_1_360M_QUANTIZED, getStructuredOutputPrompt, fixAndValidateStructuredOutput } from 'react-native-executorch';
import type { RnExecutorchError, Message } from 'react-native-executorch';
import type { Session } from '@/stores/sessions-store';
import type { Project } from '@/constants/projects';
import {
  ProductivityScoreSchema,
  InsightSchema,
  buildProductivitySystemPrompt,
  buildInsightSystemPrompt,
  buildProductivityUserMessage,
  buildInsightUserMessage,
  computeFingerprint,
} from '@/lib/inference';
import { useInferenceStore, type InferenceResult } from '@/stores/inference-store';
import type { ProductivityScore, Insight } from '@/lib/inference';

export interface UseInferenceReturn {
  isReady: boolean;
  isGenerating: boolean;
  downloadProgress: number;
  error: RnExecutorchError | null;
  productivityScore: InferenceResult<ProductivityScore> | null;
  insight: InferenceResult<Insight> | null;
  isAiEnabled: boolean;
  generateInsights(
    sessions: Session[],
    projects: Project[],
    timeframe: string
  ): Promise<void>;
  interrupt(): void;
}

export function useInference(): UseInferenceReturn {
  const llm = useLLM({ model: SMOLLM2_1_360M_QUANTIZED, preventLoad: true });
  const store = useInferenceStore();
  const [isGenerating, setIsGenerating] = useState(false);

  const generateInsights = async (
    sessions: Session[],
    projects: Project[],
    timeframe: string
  ) => {
    if (!llm.isReady || isGenerating) return;
    if (!store.isAiEnabled) return;

    const fingerprint = computeFingerprint(sessions.map((s) => s.id));
    const now = new Date().toISOString();

    // Check if score is stale
    const scoreIsStale = store.isScoreStale(fingerprint, timeframe);
    const insightIsStale = store.isInsightStale(fingerprint, timeframe);

    if (!scoreIsStale && !insightIsStale) {
      // Both cached and fresh
      return;
    }

    setIsGenerating(true);

    try {
      // Generate productivity score
      if (scoreIsStale) {
        const scoreSystemPrompt = buildProductivitySystemPrompt();
        const scoreUserMessage = buildProductivityUserMessage(
          sessions,
          projects,
          timeframe
        );

        llm.configure({
          chatConfig: {
            systemPrompt: scoreSystemPrompt,
            contextWindowLength: 1,
            initialMessageHistory: [],
          },
        });

        const scoreMessages: Message[] = [
          { role: 'user', content: scoreUserMessage + '\n\n' + getStructuredOutputPrompt(ProductivityScoreSchema) },
        ];

        try {
          const scoreResponse = await llm.generate(scoreMessages);
          const parsedScore = fixAndValidateStructuredOutput(
            scoreResponse,
            ProductivityScoreSchema
          ) as ProductivityScore;

          store.setProductivityScore({
            data: parsedScore,
            fingerprint,
            timeframe,
            generatedAt: now,
          });
        } catch {
          // Silent fail on score generation
        }
      }

      // Generate insight
      if (insightIsStale) {
        const insightSystemPrompt = buildInsightSystemPrompt();
        const insightUserMessage = buildInsightUserMessage(
          sessions,
          projects,
          timeframe
        );

        llm.configure({
          chatConfig: {
            systemPrompt: insightSystemPrompt,
            contextWindowLength: 1,
            initialMessageHistory: [],
          },
        });

        const insightMessages: Message[] = [
          { role: 'user', content: insightUserMessage + '\n\n' + getStructuredOutputPrompt(InsightSchema) },
        ];

        try {
          const insightResponse = await llm.generate(insightMessages);
          const parsedInsight = fixAndValidateStructuredOutput(
            insightResponse,
            InsightSchema
          ) as Insight;

          store.setInsight({
            data: parsedInsight,
            fingerprint,
            timeframe,
            generatedAt: now,
          });
        } catch {
          // Silent fail on insight generation
        }
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return {
    isReady: llm.isReady,
    isGenerating,
    downloadProgress: llm.downloadProgress,
    error: llm.error,
    productivityScore: store.productivityScore,
    insight: store.insight,
    isAiEnabled: store.isAiEnabled,
    generateInsights,
    interrupt: () => llm.interrupt(),
  };
}
