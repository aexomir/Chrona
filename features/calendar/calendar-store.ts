import {
  fetchCalendarEvents,
  getCalendarPermissionStatus,
  requestCalendarPermission,
  findActiveEvents,
  eventMatchesMapping,
  type CalendarEvent,
} from "@/features/calendar/calendar";
import { mmkvStorage } from "@/storage";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CalendarMapping = {
  id: string;
  projectId: string;
  calendarName?: string; // exact match against event.calendarName
  titleKeywords?: string[]; // case-insensitive substring match against event.title
};

type ActiveEventSuggestion = {
  event: CalendarEvent;
  projectId: string;
};

type CalendarState = {
  permissionStatus: "undetermined" | "granted" | "denied";
  isEnabled: boolean;
  events: CalendarEvent[];
  eventsLastFetched: string | null;
  mappings: CalendarMapping[];

  syncPermissionStatus(): Promise<void>;
  requestPermission(): Promise<void>;
  setEnabled(enabled: boolean): void;
  fetchEvents(): Promise<void>;
  addMapping(m: Omit<CalendarMapping, "id">): void;
  updateMapping(id: string, patch: Partial<Omit<CalendarMapping, "id">>): void;
  removeMapping(id: string): void;
  getActiveEventSuggestion(): ActiveEventSuggestion | null;
};

export const useCalendarStore = create<CalendarState>()(
  persist(
    (set, get) => ({
      permissionStatus: "undetermined",
      isEnabled: false,
      events: [],
      eventsLastFetched: null,
      mappings: [],

      async syncPermissionStatus() {
        const status = await getCalendarPermissionStatus();
        set({ permissionStatus: status });
      },

      async requestPermission() {
        const status = await requestCalendarPermission();
        set({ permissionStatus: status });
      },

      setEnabled(enabled: boolean) {
        set({ isEnabled: enabled });
        if (enabled && get().permissionStatus === "granted") {
          get().fetchEvents();
        }
      },

      async fetchEvents() {
        try {
          const events = await fetchCalendarEvents();
          set({
            events,
            eventsLastFetched: new Date().toISOString(),
          });
        } catch {
          // Silent fail
        }
      },

      addMapping(m) {
        set((state) => ({
          mappings: [
            ...state.mappings,
            {
              ...m,
              id: Date.now().toString(),
            },
          ],
        }));
      },

      updateMapping(id, patch) {
        set((state) => ({
          mappings: state.mappings.map((mapping) =>
            mapping.id === id ? { ...mapping, ...patch } : mapping
          ),
        }));
      },

      removeMapping(id) {
        set((state) => ({
          mappings: state.mappings.filter((m) => m.id !== id),
        }));
      },

      getActiveEventSuggestion() {
        const activeEvents = findActiveEvents(get().events);
        if (activeEvents.length === 0) return null;

        // Find first event that matches a mapping
        for (const event of activeEvents) {
          for (const mapping of get().mappings) {
            if (eventMatchesMapping(event, mapping)) {
              return { event, projectId: mapping.projectId };
            }
          }
        }

        return null;
      },
    }),
    {
      name: "calendar",
      storage: mmkvStorage,
    }
  )
);
