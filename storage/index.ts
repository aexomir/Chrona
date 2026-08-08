import { createMMKV } from "react-native-mmkv";
import type { PersistStorage } from "zustand/middleware";
import * as SecureStore from "expo-secure-store";
import { getRandomBytes } from "expo-crypto";

const ENCRYPTION_KEY_STORAGE_KEY = "chrona.mmkv.encryptionKey";

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// AES-256 keys are capped at 32 bytes by MMKV; a 32-char hex string is
// exactly 32 ASCII bytes, so 16 random bytes hex-encoded fits precisely
// without risking silent truncation from a non-ASCII/UTF-8 key string.
function getOrCreateEncryptionKey(): string | undefined {
  if (process.env.EXPO_OS === "web") return undefined;
  const existing = SecureStore.getItem(ENCRYPTION_KEY_STORAGE_KEY);
  if (existing) return existing;
  const key = bytesToHex(getRandomBytes(16));
  SecureStore.setItem(ENCRYPTION_KEY_STORAGE_KEY, key);
  return key;
}

export const storage = createMMKV({
  id: "mmkv.default",
  encryptionKey: getOrCreateEncryptionKey(),
  encryptionType: "AES-256",
});

export const mmkvStorage: PersistStorage<unknown> = {
  getItem: (name) => {
    const value = storage.getString(name);
    return value ? JSON.parse(value) : null;
  },
  setItem: (name, value) => {
    storage.set(name, JSON.stringify(value));
  },
  removeItem: (name) => {
    storage.remove(name);
  },
};
