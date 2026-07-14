import { createMMKV } from "react-native-mmkv";
import type { PersistStorage } from "zustand/middleware";

export const storage = createMMKV();

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
