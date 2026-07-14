/**
 * Queue of auto-tracked sessions awaiting an app-breakdown review.
 *
 * Auto-stops fire from a background event listener (auto-tracker.ts), not from
 * a screen component, and the system-idle stop in particular can happen while
 * the user is away from the phone entirely. Rather than trying to show a live
 * popover at stop time, sessions with more than one app touched are queued
 * here (persisted via MMKV) and drained by AppReviewSheet whenever the app is
 * next foregrounded — regardless of which auto-stop path queued them or how
 * long ago.
 */

import { useSessionsStore, type AppUsage } from "@/features/sessions/sessions-store";
import { mmkvStorage } from "@/storage";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type PendingReviewSession = {
  id: string;
  startTime: string;
  endTime: string;
  duration: number;
  title: string;
  projectId: string | null;
  apps: AppUsage[];
};

type PendingReviewState = {
  queue: PendingReviewSession[];
  offer: (session: Omit<PendingReviewSession, "id">) => void;
  confirm: (selectedApps: AppUsage[]) => void;
  skip: () => void;
};

export const usePendingReviewStore = create<PendingReviewState>()(
  persist(
    (set, get) => ({
      queue: [],

      offer: (session) =>
        set((state) => ({
          queue: [...state.queue, { ...session, id: Date.now().toString() }],
        })),

      confirm: (selectedApps) => {
        const head = get().queue[0];
        if (!head) return;
        useSessionsStore.getState().addSession({
          id: head.id,
          title: head.title,
          projectId: head.projectId,
          startTime: head.startTime,
          endTime: head.endTime,
          duration: head.duration,
          auto: true,
          ...(selectedApps.length > 0 ? { apps: selectedApps } : {}),
        });
        set((state) => ({ queue: state.queue.slice(1) }));
      },

      skip: () => {
        const head = get().queue[0];
        if (!head) return;
        useSessionsStore.getState().addSession({
          id: head.id,
          title: head.title,
          projectId: head.projectId,
          startTime: head.startTime,
          endTime: head.endTime,
          duration: head.duration,
          auto: true,
        });
        set((state) => ({ queue: state.queue.slice(1) }));
      },
    }),
    {
      name: "pending-review",
      storage: mmkvStorage,
    },
  ),
);
