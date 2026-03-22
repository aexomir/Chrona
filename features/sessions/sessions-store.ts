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
  auto?: boolean; // true if auto-tracked
};

type SessionsState = {
  sessions: Session[];
  addSession: (session: Session) => void;
  removeSession: (id: string) => void;
  updateSession: (session: Session) => void;
};

export const useSessionsStore = create<SessionsState>()(
  persist(
    (set) => ({
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
    }),
    {
      name: "sessions",
      storage: mmkvStorage,
    },
  ),
);
