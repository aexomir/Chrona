// Auto-mock for react-native-mmkv (native module — not available in Jest environment)
// Jest picks this up automatically for any import of 'react-native-mmkv'.
import { jest } from "@jest/globals";

const store = new Map<string, string>();

export const createMMKV = jest.fn(() => ({
  getString: (key: string) => store.get(key),
  set: (key: string, value: string) => store.set(key, value),
  remove: (key: string) => store.delete(key),
  clearAll: () => store.clear(),
  _store: store, // exposed for test resets
}));
