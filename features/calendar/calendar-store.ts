import {
  fetchCalendarEvents,
  findActiveEvents,
  getCalendarPermissionStatus,
  requestCalendarPermission,
  type CalendarEvent,
  type CalendarPermissionStatus,
} from "@/features/calendar/calendar";
import { mmkvStorage } from "@/storage";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export const CALENDAR_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

export type CalendarMapping = {
  calendarId: string;
  calendarName: string;
  projectId: string;
};

type ActiveEventSuggestion = {
  event: CalendarEvent;
  projectId: string;
};

type CalendarState = {
  permissionStatus: CalendarPermissionStatus;
  isEnabled: boolean;
  events: CalendarEvent[];
  eventsLastFetched: string | null;
  mappings: CalendarMapping[];

  syncPermissionStatus(): Promise<void>;
  requestPermission(): Promise<
    Exclude<CalendarPermissionStatus, "undetermined">
  >;
  setEnabled(enabled: boolean): void;
  fetchEvents(): Promise<boolean>;
  setCalendarProject(
    calendarId: string,
    calendarName: string,
    projectId: string | null,
  ): void;
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
        return status;
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
          return true;
        } catch {
          return false;
        }
      },

      setCalendarProject(calendarId, calendarName, projectId) {
        set((state) => {
          const rest = state.mappings.filter(
            (m) => m.calendarId !== calendarId,
          );
          return {
            mappings: projectId
              ? [...rest, { calendarId, calendarName, projectId }]
              : rest,
          };
        });
      },

      getActiveEventSuggestion() {
        const activeEvents = findActiveEvents(get().events);
        for (const event of activeEvents) {
          const mapping = get().mappings.find(
            (m) => m.calendarId === event.calendarId,
          );
          if (mapping) return { event, projectId: mapping.projectId };
        }
        return null;
      },
    }),
    {
      name: "calendar",
      storage: mmkvStorage,
    },
  ),
);
