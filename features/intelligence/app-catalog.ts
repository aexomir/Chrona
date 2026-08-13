/**
 * Display-name index for Mac apps, keyed by bundle ID.
 *
 * All this does is remember that `com.apple.dt.Xcode` is called "Xcode", so
 * rule authoring can offer real names for apps the user has actually used.
 * Durations are not tracked here — those live in the Mac's ledger and are
 * fetched on demand (see usage-query.ts).
 *
 * This file is what remains of the old activity journal, which also tried to
 * accumulate per-app dwell time on device. That accumulation was the source of
 * the "1 app, 13 seconds" bug and has been removed entirely.
 */

import { captureError } from "@/lib/sentry";
import type { ActivityEvent } from "@/modules/chrona-stream";
import { emitter } from "@/modules/chrona-stream";
import { mmkvStorage, storage } from "@/storage";
import { create } from "zustand";
import { persist } from "zustand/middleware";

const STORAGE_KEY = "app-catalog";
const LEGACY_STORAGE_KEY = "activity-journal";

type AppCatalogState = {
  /** bundleId → display name */
  nameIndex: Record<string, string>;
  _recordName: (bundleId: string, appName: string) => void;
  /** Debug only: seed a display name without waiting for real events. */
  debugSeedName: (bundleId: string, appName: string) => void;
};

/**
 * The old journal persisted `{ sessions, nameIndex }` and kept up to 500
 * sessions. The sessions are dead weight now; lift the names out and drop the
 * rest rather than leaving a multi-megabyte blob behind forever.
 */
function migrateLegacyNames(): Record<string, string> {
  try {
    const raw = storage.getString(LEGACY_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as { state?: { nameIndex?: Record<string, string> } };
    const names = parsed?.state?.nameIndex ?? {};
    storage.remove(LEGACY_STORAGE_KEY);
    return names;
  } catch {
    storage.remove(LEGACY_STORAGE_KEY);
    return {};
  }
}

export const useAppCatalogStore = create<AppCatalogState>()(
  persist(
    (set) => ({
      nameIndex: {},

      _recordName: (bundleId, appName) =>
        set((state) => {
          if (state.nameIndex[bundleId] === appName) return state;
          return { nameIndex: { ...state.nameIndex, [bundleId]: appName } };
        }),

      debugSeedName: (bundleId, appName) =>
        set((state) => ({
          nameIndex: { ...state.nameIndex, [bundleId]: appName },
        })),
    }),
    {
      name: STORAGE_KEY,
      storage: mmkvStorage,
      partialize: (state) => ({ nameIndex: state.nameIndex }),
    },
  ),
);

// Runs after the (synchronous, MMKV-backed) hydration above. Deliberately not
// inside persist's `merge`, which zustand skips entirely when there is no
// persisted state — which is precisely the upgrade case this has to cover.
// Anything already hydrated wins over the legacy copy.
const legacyNames = migrateLegacyNames();
if (Object.keys(legacyNames).length > 0) {
  useAppCatalogStore.setState((state) => ({
    nameIndex: { ...legacyNames, ...state.nameIndex },
  }));
}

type Sub = ReturnType<typeof emitter.addListener>;
let catalogSub: Sub | null = null;

function handleEvent(event: ActivityEvent) {
  if (!event.bundleId || !event.appName) return;
  useAppCatalogStore.getState()._recordName(event.bundleId, event.appName);
}

export function startAppCatalog() {
  if (process.env.EXPO_OS !== "ios") return;
  catalogSub?.remove();
  catalogSub = emitter.addListener("onEvent", (event: ActivityEvent) => {
    try {
      handleEvent(event);
    } catch (error) {
      captureError(error, "app_catalog", { eventType: event.type });
    }
  });
}

export function stopAppCatalog() {
  if (process.env.EXPO_OS !== "ios") return;
  catalogSub?.remove();
  catalogSub = null;
}
