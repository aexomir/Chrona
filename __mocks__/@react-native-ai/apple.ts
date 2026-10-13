// Auto-mock for @react-native-ai/apple (Foundation Models native module — not
// available in Jest). Reports the model as unavailable so every on-device
// feature takes its rule-based fallback path.
import { jest } from "@jest/globals";

export const apple = Object.assign(
  jest.fn(() => {
    throw new Error("Apple Foundation Models are not available in tests");
  }),
  { isAvailable: jest.fn(() => false) },
);
