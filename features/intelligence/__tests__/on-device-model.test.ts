import { generate, isModelAvailable } from "@/features/intelligence/on-device-model";
import { captureError } from "@/lib/sentry";
import { apple } from "@react-native-ai/apple";
import { z } from "zod";

import { reply, useFakeModel } from "./fake-model";

jest.mock("@/lib/sentry", () => ({ captureError: jest.fn() }));

const schema = z.object({ answer: z.string() });
const doGenerate = useFakeModel();

beforeEach(() => jest.mocked(captureError).mockClear());

describe("isModelAvailable", () => {
  it("reports what the provider says", () => {
    expect(isModelAvailable()).toBe(true);
    jest.mocked(apple.isAvailable).mockReturnValue(false);
    expect(isModelAvailable()).toBe(false);
  });
});

describe("generate", () => {
  it("returns the parsed object and asks for JSON", async () => {
    doGenerate.mockResolvedValue(reply({ answer: "yes" }));

    await expect(generate(schema, "prompt", "system")).resolves.toEqual({ answer: "yes" });
    expect(doGenerate.mock.calls[0][0]).toMatchObject({ responseFormat: { type: "json" } });
  });

  it("returns null without calling the model when it is unavailable", async () => {
    jest.mocked(apple.isAvailable).mockReturnValue(false);

    await expect(generate(schema, "prompt", "system")).resolves.toBeNull();
    expect(doGenerate).not.toHaveBeenCalled();
  });

  it("returns null quietly when the answer doesn't fit the schema", async () => {
    doGenerate.mockResolvedValue(reply({ something: "else" }));

    await expect(generate(schema, "prompt", "system")).resolves.toBeNull();
    expect(captureError).not.toHaveBeenCalled();
  });

  it("returns null quietly on a guardrail refusal", async () => {
    doGenerate.mockRejectedValue(
      Object.assign(new Error("unsafe content"), {
        domain: "FoundationModels.LanguageModelSession.GenerationError",
      }),
    );

    await expect(generate(schema, "prompt", "system")).resolves.toBeNull();
    expect(captureError).not.toHaveBeenCalled();
  });

  it("reports unexpected errors and still returns null", async () => {
    doGenerate.mockRejectedValue(new Error("Invalid schema"));

    await expect(generate(schema, "prompt", "system")).resolves.toBeNull();
    expect(captureError).toHaveBeenCalledTimes(1);
  });

  it("runs one request at a time", async () => {
    let running = 0;
    let maxRunning = 0;
    doGenerate.mockImplementation(async () => {
      maxRunning = Math.max(maxRunning, ++running);
      await new Promise((resolve) => setTimeout(resolve, 5));
      running--;
      return reply({ answer: "ok" });
    });

    const results = await Promise.all([
      generate(schema, "1", "system"),
      generate(schema, "2", "system"),
      generate(schema, "3", "system"),
    ]);

    expect(results).toEqual([{ answer: "ok" }, { answer: "ok" }, { answer: "ok" }]);
    expect(maxRunning).toBe(1);
  });

  it("gives up after 8 seconds and drops requests still waiting", async () => {
    jest.useFakeTimers();
    let finishSlow = () => {};
    doGenerate.mockImplementationOnce(
      () => new Promise((resolve) => (finishSlow = () => resolve(reply({ answer: "late" })))),
    );

    const slow = generate(schema, "slow", "system");
    const waiting = generate(schema, "waiting", "system");
    await jest.advanceTimersByTimeAsync(8000);

    await expect(slow).resolves.toBeNull();
    await expect(waiting).resolves.toBeNull();

    finishSlow();
    await jest.runAllTimersAsync();
    expect(doGenerate).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });
});
