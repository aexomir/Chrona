import { mmkvStorage } from "@/storage";
import type { MeetingAppId } from "@/lib/meetingDetection";
import { create } from "zustand";
import { persist } from "zustand/middleware";

type MeetingState = {
  isEnabled: boolean;
  selectedAppIds: MeetingAppId[];

  setEnabled: (enabled: boolean) => void;
  toggleApp: (id: MeetingAppId) => void;
};

export const useMeetingStore = create<MeetingState>()(
  persist(
    (set, get) => ({
      isEnabled: false,
      selectedAppIds: ["zoom", "teams", "meet"], // all on by default

      setEnabled: (enabled) => set({ isEnabled: enabled }),

      toggleApp: (id) => {
        const current = get().selectedAppIds;
        const next = current.includes(id)
          ? current.filter((a) => a !== id)
          : [...current, id];
        set({ selectedAppIds: next });
      },
    }),
    { name: "meetings", storage: mmkvStorage }
  )
);
