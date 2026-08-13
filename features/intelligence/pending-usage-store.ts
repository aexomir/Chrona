/**
 * Backfill queue for sessions saved while the Mac was unreachable.
 *
 * Stopping a timer must never block on the network, and the Mac is routinely
 * asleep or off-network when it happens. So the session is saved immediately
 * without an app breakdown and the window is queued here; the next time the
 * helper connects, the queue is drained and the sessions are patched.
 *
 * This is only viable because the Mac's ledger is durable — the data is still
 * there hours later, which was not true of the old on-device accumulator.
 */

import { useSessionsStore } from "@/features/sessions/sessions-store";
import { useStreamStore } from "@/features/stream/stream-store";
import { BACKFILL_TIMEOUT_MS, getAppsForWindow } from "@/features/intelligence/usage-query";
import { captureError } from "@/lib/sentry";
import { mmkvStorage } from "@/storage";
import { create } from "zustand";
import { persist } from "zustand/middleware";

const MAX_ATTEMPTS = 5;
/** Matches the helper's ledger retention — past this the data is gone. */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export type PendingUsage = {
  sessionId: string;
  fromMs: number;
  toMs: number;
  attempts: number;
  queuedAt: number;
};

type PendingUsageState = {
  queue: PendingUsage[];
  enqueue: (sessionId: string, fromMs: number, toMs: number) => void;
  _remove: (sessionId: string) => void;
  _bumpAttempts: (sessionId: string) => void;
};

export const usePendingUsageStore = create<PendingUsageState>()(
  persist(
    (set) => ({
      queue: [],

      enqueue: (sessionId, fromMs, toMs) =>
        set((state) => ({
          queue: [
            ...state.queue.filter((e) => e.sessionId !== sessionId),
            { sessionId, fromMs, toMs, attempts: 0, queuedAt: Date.now() },
          ],
        })),

      _remove: (sessionId) =>
        set((state) => ({ queue: state.queue.filter((e) => e.sessionId !== sessionId) })),

      _bumpAttempts: (sessionId) =>
        set((state) => ({
          queue: state.queue.map((e) =>
            e.sessionId === sessionId ? { ...e, attempts: e.attempts + 1 } : e,
          ),
        })),
    }),
    {
      name: "pending-usage",
      storage: mmkvStorage,
      partialize: (state) => ({ queue: state.queue }),
    },
  ),
);

let draining = false;

/**
 * Patches queued sessions with their app breakdown. Safe to call at any time —
 * it no-ops when the queue is empty or the Mac isn't connected, and never runs
 * concurrently with itself. Bailing on a disconnected helper matters: without
 * it, an opportunistic call would burn every entry's retry budget on queries
 * that never had a chance of succeeding.
 */
export async function drainPendingUsage() {
  if (process.env.EXPO_OS !== "ios") return;
  if (draining) return;
  if (useStreamStore.getState().status !== "connected") return;
  draining = true;

  try {
    const { queue } = usePendingUsageStore.getState();
    const now = Date.now();

    for (const entry of queue) {
      const { _remove, _bumpAttempts } = usePendingUsageStore.getState();

      if (now - entry.queuedAt > MAX_AGE_MS || entry.attempts >= MAX_ATTEMPTS) {
        _remove(entry.sessionId);
        continue;
      }

      const session = useSessionsStore
        .getState()
        .sessions.find((s) => s.id === entry.sessionId);
      if (!session) {
        _remove(entry.sessionId);
        continue;
      }

      const { status, apps } = await getAppsForWindow(
        entry.fromMs,
        entry.toMs,
        BACKFILL_TIMEOUT_MS,
      );

      if (status === "unreachable") {
        _bumpAttempts(entry.sessionId);
        // The helper went away mid-drain; the rest of the queue will fail the
        // same way, so stop rather than burning everyone's attempt budget.
        break;
      }

      if (apps.length > 0) {
        useSessionsStore.getState().updateSession({ ...session, apps });
      }
      _remove(entry.sessionId);
    }
  } catch (error) {
    captureError(error, "pending_usage_drain");
  } finally {
    draining = false;
  }
}
