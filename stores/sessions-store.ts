import { mmkvStorage } from "@/storage";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Session = {
  id: string;
  title: string;
  projectId: string | null;
  startTime: string; // ISO
  endTime: string; // ISO
  duration: number; // seconds
};

type SessionsState = {
  sessions: Session[];
  addSession: (session: Session) => void;
  removeSession: (id: string) => void;
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
    }),
    {
      name: "sessions",
      storage: mmkvStorage,
    }
  )
);
