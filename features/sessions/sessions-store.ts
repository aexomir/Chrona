import { mmkvStorage } from "@/storage";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AppUsage = {
  app: string;
  duration: number;
  titles?: string[];
};

export type Session = {
  id: string;
  title: string;
  projectId: string | null;
  startTime: string; // ISO
  endTime: string; // ISO
  duration: number; // seconds
  apps?: AppUsage[]; // optional, attached after AW query
  notes?: string;
};

type SessionsState = {
  sessions: Session[];
  addSession: (session: Session) => void;
  removeSession: (id: string) => void;
  updateSession: (session: Session) => void;
  mergeSessions: (survivorId: string, sourceId: string) => void;
};

export const useSessionsStore = create<SessionsState>()(
  persist(
    (set, get) => ({
      sessions: [],
      addSession: (session) =>
        set((state) => ({ sessions: [session, ...state.sessions] })),
      removeSession: (id) =>
        set((state) => ({
          sessions: state.sessions.filter((s) => s.id !== id),
        })),
      updateSession: (session) =>
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === session.id ? session : s,
          ),
        })),
      mergeSessions: (survivorId, sourceId) => {
        if (survivorId === sourceId) return;
        const { sessions } = get();
        const survivor = sessions.find((s) => s.id === survivorId);
        const source = sessions.find((s) => s.id === sourceId);
        if (!survivor || !source) return;

        const appMap = new Map<string, { duration: number; titles: string[] }>();
        for (const a of [...(survivor.apps ?? []), ...(source.apps ?? [])]) {
          const existing = appMap.get(a.app);
          if (existing) {
            existing.duration += a.duration;
            existing.titles = [
              ...new Set([...existing.titles, ...(a.titles ?? [])]),
            ];
          } else {
            appMap.set(a.app, {
              duration: a.duration,
              titles: [...(a.titles ?? [])],
            });
          }
        }
        const mergedApps: AppUsage[] = [...appMap.entries()]
          .map(([app, v]) => ({
            app,
            duration: v.duration,
            ...(v.titles.length > 0 ? { titles: v.titles } : {}),
          }))
          .sort((a, b) => b.duration - a.duration);

        const merged: Session = {
          ...survivor,
          startTime: new Date(
            Math.min(
              new Date(survivor.startTime).getTime(),
              new Date(source.startTime).getTime(),
            ),
          ).toISOString(),
          endTime: new Date(
            Math.max(
              new Date(survivor.endTime).getTime(),
              new Date(source.endTime).getTime(),
            ),
          ).toISOString(),
          duration: survivor.duration + source.duration,
          ...(mergedApps.length > 0
            ? { apps: mergedApps }
            : { apps: undefined }),
        };

        set((state) => ({
          sessions: state.sessions
            .map((s) => (s.id === survivorId ? merged : s))
            .filter((s) => s.id !== sourceId),
        }));
      },
    }),
    {
      name: "sessions",
      storage: mmkvStorage,
    },
  ),
);
