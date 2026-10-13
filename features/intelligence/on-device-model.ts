/**
 * Apple Foundation Models, on device, through the AI SDK.
 *
 * Every feature built on this improves a rule-based path that already works,
 * so nothing here throws. No model, a slow answer, an answer that doesn't fit
 * the schema or a refusal all return `null`, and the caller carries on as if
 * the model didn't exist.
 *
 * The context window is about 4K tokens: send aggregates, never raw sessions.
 */

import { captureError } from "@/lib/sentry";
import { apple } from "@react-native-ai/apple";
import { generateObject, NoObjectGeneratedError } from "ai";
import type { z } from "zod";

const TIMEOUT_MS = 8000;

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

/** The model declining or failing to answer, as opposed to a bug in Chrona. */
function isExpectedFailure(error: unknown): boolean {
  if (NoObjectGeneratedError.isInstance(error)) return true;
  const { code, domain, message } = (error ?? {}) as {
    code?: string;
    domain?: string;
    message?: string;
  };
  return (
    code === "MODEL_UNAVAILABLE" ||
    !!domain?.includes("GenerationError") ||
    /guardrail|unsafe|refus|GenerationError/i.test(message ?? "")
  );
}

async function ask<T>(schema: z.ZodType<T>, prompt: string, system: string): Promise<T | null> {
  try {
    const { object } = await generateObject({ model: apple(), schema, prompt, system });
    return object as T;
  } catch (error) {
    if (!isExpectedFailure(error)) captureError(error, "on_device_model");
    return null;
  }
}

/**
 * Requests run one at a time, because the system model serves one at a time.
 * The timeout counts time spent waiting in line, and a request that times out
 * before its turn is dropped rather than run.
 */
export async function generate<T>(
  schema: z.ZodType<T>,
  prompt: string,
  system: string,
): Promise<T | null> {
  if (!isModelAvailable()) return null;

  let timedOut = false;
  const run = queue.then(() => (timedOut ? null : ask(schema, prompt, system)));
  queue = run;

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      timedOut = true;
      resolve(null);
    }, TIMEOUT_MS);
    void run.then((result) => {
      clearTimeout(timer);
      resolve(result);
    });
  });
}
