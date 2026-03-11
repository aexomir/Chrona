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

/**
 * Request permission to access calendar events
 */
export async function requestCalendarPermission(): Promise<
  "granted" | "denied"
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
export async function getCalendarPermissionStatus(): Promise<
  "undetermined" | "granted" | "denied"
> {
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
      Calendar.EntityTypes.EVENT
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
  daysBack = 7,
  daysForward = 7
): Promise<CalendarEvent[]> {
  try {
    const calendars = await Calendar.getCalendarsAsync(
      Calendar.EntityTypes.EVENT
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
          endDate
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
  permissionStatus: "undetermined" | "granted" | "denied",
  isEnabled: boolean
): string {
  if (permissionStatus === "granted" && isEnabled) return "Connected";
  if (permissionStatus === "granted" && !isEnabled) return "Disconnected";
  return "Permission Required";
}
