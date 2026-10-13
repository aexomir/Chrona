import { apple } from "@react-native-ai/apple";

type Generate = (options: { prompt: { role: string; content: unknown }[] }) => Promise<unknown>;

/** A model reply in the shape the AI SDK expects from a provider. */
export function reply(object: object) {
  return {
    content: [{ type: "text", text: JSON.stringify(object) }],
    finishReason: { unified: "stop", raw: "stop" },
    usage: { inputTokens: { total: 0 }, outputTokens: { total: 0 } },
    warnings: [],
  };
}

/**
 * Makes the auto-mocked Apple provider report itself available and answer
 * with whatever the returned `doGenerate` mock is told to.
 */
export function useFakeModel() {
  const doGenerate = jest.fn<ReturnType<Generate>, Parameters<Generate>>();
  const model = {
    specificationVersion: "v3",
    provider: "apple",
    modelId: "fake",
    supportedUrls: {},
    doGenerate,
    doStream: jest.fn(),
  };

  beforeEach(() => {
    doGenerate.mockReset();
    jest.mocked(apple.isAvailable).mockReturnValue(true);
    jest.mocked(apple).mockReturnValue(model as unknown as ReturnType<typeof apple>);
  });

  return doGenerate;
}

/** The user message the model was sent on its nth call. */
export function promptOf(doGenerate: jest.Mock, call = 0): string {
  const messages = doGenerate.mock.calls[call][0].prompt;
  return messages.find((m: { role: string }) => m.role === "user").content[0].text;
}
