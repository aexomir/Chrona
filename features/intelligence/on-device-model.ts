/**
 * Apple Foundation Models, on device, through the AI SDK.
 *
 * Every feature built on this is an enhancement over a rule-based path that
 * already works, so nothing here throws: an unavailable model, a slow answer,
 * an answer that doesn't fit the schema and a guardrail refusal all come back
 * as `null`, and the caller carries on as if the model didn't exist.
 *
 * The on-device context window is about 4K tokens. Send aggregates, never raw
 * session arrays.
 */

import { captureError } from "@/lib/sentry";
import { apple } from "@react-native-ai/apple";
import { generateObject, NoObjectGeneratedError } from "ai";
import type { z } from "zod";

const TIMEOUT_MS = 8000;
/**
 * A native generation can't be cancelled, so a timed-out call keeps the model
 * busy. Past this the queue stops waiting for it rather than stalling forever.
 */
const RELEASE_MS = 30_000;

let queue: Promise<unknown> = Promise.resolve();

export function isModelAvailable(): boolean {
  if (process.env.EXPO_OS !== "ios") return false;
  try {
    return apple.isAvailable();
  } catch (error) {
    captureError(error, "on_device_model");
    return false;
  }
}

/**
 * Foundation Models reports refusals, context overflows and decoding failures
 * as `LanguageModelSession.GenerationError`. Those are the model declining or
 * failing to answer, not defects in Chrona.
 */
function isExpectedFailure(error: unknown): boolean {
  if (NoObjectGeneratedError.isInstance(error)) return true;
  const { code, domain, message } = (error ?? {}) as {
    code?: string;
    domain?: string;
    message?: string;
  };
  if (code === "MODEL_UNAVAILABLE") return true;
  if (domain?.includes("GenerationError")) return true;
  return /guardrail|unsafe|refus|GenerationError/i.test(message ?? "");
}

function settleWithin<T>(promise: Promise<T>, ms: number, onTimeout: () => T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(onTimeout()), ms);
    void promise.then((value) => {
      clearTimeout(timer);
      resolve(value);
    });
  });
}

async function attempt<T>(
  schema: z.ZodType<T>,
  prompt: string,
  system: string,
): Promise<T | null> {
  try {
    const { object } = await generateObject({ model: apple(), schema, prompt, system });
    return object as T;
  } catch (error) {
    if (!isExpectedFailure(error)) {
      captureError(error, "on_device_model", { promptLength: prompt.length });
    }
    return null;
  }
}

/**
 * Never throws. Generations run one at a time — the system model serves a
 * single request at once — and the timeout includes time spent queued.
 */
export async function generate<T>(
  schema: z.ZodType<T>,
  prompt: string,
  system: string,
): Promise<T | null> {
  if (!isModelAvailable()) return null;

  let abandoned = false;
  const run = queue.then(() => (abandoned ? null : attempt(schema, prompt, system)));
  queue = settleWithin<unknown>(run, RELEASE_MS, () => null);

  return settleWithin<T | null>(run, TIMEOUT_MS, () => {
    abandoned = true;
    return null;
  });
}
