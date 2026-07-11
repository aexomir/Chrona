import * as Calendar from "expo-calendar";

export type CalendarInfo = { id: string; name: string };

export type CalendarEvent = {
  id: string;
  title: string;
  calendarId: string;
  calendarName: string;
  startDate: string; // ISO
  endDate: string; // ISO
  notes?: string;
};

export type CalendarPermissionStatus = "undetermined" | "granted" | "denied";

/** Days of history/future to sync when fetching calendar events. */
const SYNC_DAYS_BACK = 7;
const SYNC_DAYS_FORWARD = 7;

/**
 * Request permission to access calendar events
 */
export async function requestCalendarPermission(): Promise<
  Exclude<CalendarPermissionStatus, "undetermined">
> {
  try {
    const result = await Calendar.requestCalendarPermissionsAsync();
    return result.status === "granted" ? "granted" : "denied";
  } catch {
    return "denied";
  }
}

/**
 * Get current permission status
 */
export async function getCalendarPermissionStatus(): Promise<CalendarPermissionStatus> {
  try {
    const result = await Calendar.getCalendarPermissionsAsync();
    if (result.status === "granted") return "granted";
    if (result.status === "denied") return "denied";
    return "undetermined";
  } catch {
    return "undetermined";
  }
}

/**
 * Get list of available calendars
 */
export async function getCalendars(): Promise<CalendarInfo[]> {
  try {
    const calendars = await Calendar.getCalendarsAsync(
      Calendar.EntityTypes.EVENT,
    );
    return calendars.map((cal) => ({
      id: cal.id,
      name: cal.title || "Untitled Calendar",
    }));
  } catch {
    return [];
  }
}

/**
 * Fetch calendar events for the given date range
 */
export async function fetchCalendarEvents(
  daysBack = SYNC_DAYS_BACK,
  daysForward = SYNC_DAYS_FORWARD,
): Promise<CalendarEvent[]> {
  try {
    const calendars = await Calendar.getCalendarsAsync(
      Calendar.EntityTypes.EVENT,
    );

    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - daysBack);
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + daysForward);

    const events: CalendarEvent[] = [];

    for (const calendar of calendars) {
      try {
        const calendarEvents = await Calendar.getEventsAsync(
          [calendar.id],
          startDate,
          endDate,
        );

        for (const event of calendarEvents) {
          // Handle both Date and string formats (iOS vs Android)
          const startISO =
            typeof event.startDate === "string"
              ? event.startDate
              : (event.startDate as Date).toISOString();
          const endISO =
            typeof event.endDate === "string"
              ? event.endDate
              : (event.endDate as Date).toISOString();

          events.push({
            id: event.id,
            title: event.title || "Untitled Event",
            calendarId: calendar.id,
            calendarName: calendar.title || "Untitled Calendar",
            startDate: startISO,
            endDate: endISO,
            notes: event.notes,
          });
        }
      } catch {
        // Skip individual calendar errors
        continue;
      }
    }

    return events;
  } catch {
    return [];
  }
}

/**
 * Status label utility for permission + enabled state
 */
export function calendarStatusLabel(
  permissionStatus: CalendarPermissionStatus,
  isEnabled: boolean,
): string {
  if (permissionStatus === "granted" && isEnabled) return "Connected";
  if (permissionStatus === "granted" && !isEnabled) return "Disconnected";
  return "Permission Required";
}

/**
 * Find active calendar events at the current time
 */
export function findActiveEvents(events: CalendarEvent[]): CalendarEvent[] {
  const now = new Date();
  return events.filter((event) => {
    const start = new Date(event.startDate);
    const end = new Date(event.endDate);
    return now >= start && now <= end;
  });
}

/**
 * Find calendar events that overlap a given time range
 */
export function findOverlappingEvents(
  events: CalendarEvent[],
  rangeStart: Date,
  rangeEnd: Date,
): CalendarEvent[] {
  return events.filter((event) => {
    const eventStart = new Date(event.startDate);
    const eventEnd = new Date(event.endDate);
    return eventStart < rangeEnd && eventEnd > rangeStart;
  });
}
