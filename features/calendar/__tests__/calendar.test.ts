import {
  fetchCalendarEvents,
  getCalendarPermissionStatus,
  getCalendars,
  requestCalendarPermission,
} from "../calendar";

import * as Calendar from "expo-calendar";

jest.mock("expo-calendar", () => ({
  requestCalendarPermissions: jest.fn(),
  getCalendarPermissions: jest.fn(),
  getCalendars: jest.fn(),
  EntityTypes: { EVENT: "event" },
}));

jest.mock("@/lib/sentry", () => ({ captureError: jest.fn() }));

describe("requestCalendarPermission", () => {
  it("calls the current expo-calendar permissions API, not the deprecated legacy one", async () => {
    (Calendar.requestCalendarPermissions as jest.Mock).mockResolvedValue({
      status: "granted",
    });

    const status = await requestCalendarPermission();

    expect(Calendar.requestCalendarPermissions).toHaveBeenCalledTimes(1);
    expect(status).toBe("granted");
  });

  it("returns denied when the user declines", async () => {
    (Calendar.requestCalendarPermissions as jest.Mock).mockResolvedValue({
      status: "denied",
    });

    expect(await requestCalendarPermission()).toBe("denied");
  });

  it("returns denied instead of throwing when the native call fails", async () => {
    (Calendar.requestCalendarPermissions as jest.Mock).mockRejectedValue(
      new Error("native module unavailable"),
    );

    expect(await requestCalendarPermission()).toBe("denied");
  });
});

describe("getCalendarPermissionStatus", () => {
  it("calls the current expo-calendar permissions API, not the deprecated legacy one", async () => {
    (Calendar.getCalendarPermissions as jest.Mock).mockResolvedValue({
      status: "undetermined",
    });

    const status = await getCalendarPermissionStatus();

    expect(Calendar.getCalendarPermissions).toHaveBeenCalledTimes(1);
    expect(status).toBe("undetermined");
  });

  it("returns undetermined instead of throwing when the native call fails", async () => {
    (Calendar.getCalendarPermissions as jest.Mock).mockRejectedValue(
      new Error("native module unavailable"),
    );

    expect(await getCalendarPermissionStatus()).toBe("undetermined");
  });
});

describe("getCalendars", () => {
  it("calls the current expo-calendar API and maps calendar names", async () => {
    (Calendar.getCalendars as jest.Mock).mockResolvedValue([
      { id: "cal-1", title: "Work" },
      { id: "cal-2", title: "" },
    ]);

    const calendars = await getCalendars();

    expect(Calendar.getCalendars).toHaveBeenCalledWith("event");
    expect(calendars).toEqual([
      { id: "cal-1", name: "Work" },
      { id: "cal-2", name: "Untitled Calendar" },
    ]);
  });

  it("returns an empty list instead of throwing when the native call fails", async () => {
    (Calendar.getCalendars as jest.Mock).mockRejectedValue(
      new Error("native module unavailable"),
    );

    expect(await getCalendars()).toEqual([]);
  });
});

describe("fetchCalendarEvents", () => {
  it("lists events per calendar via the calendar object's own listEvents method", async () => {
    const listEvents = jest.fn().mockResolvedValue([
      {
        id: "evt-1",
        title: "Standup",
        startDate: "2026-01-01T09:00:00.000Z",
        endDate: "2026-01-01T09:15:00.000Z",
        notes: "daily sync",
      },
    ]);
    (Calendar.getCalendars as jest.Mock).mockResolvedValue([
      { id: "cal-1", title: "Work", listEvents },
    ]);

    const events = await fetchCalendarEvents();

    expect(listEvents).toHaveBeenCalledTimes(1);
    expect(events).toEqual([
      {
        id: "evt-1",
        title: "Standup",
        calendarId: "cal-1",
        calendarName: "Work",
        startDate: "2026-01-01T09:00:00.000Z",
        endDate: "2026-01-01T09:15:00.000Z",
        notes: "daily sync",
      },
    ]);
  });

  it("skips a calendar whose listEvents call fails and still returns the rest", async () => {
    const failingListEvents = jest
      .fn()
      .mockRejectedValue(new Error("boom"));
    const okListEvents = jest.fn().mockResolvedValue([
      {
        id: "evt-2",
        title: "Review",
        startDate: "2026-01-02T10:00:00.000Z",
        endDate: "2026-01-02T10:30:00.000Z",
      },
    ]);
    (Calendar.getCalendars as jest.Mock).mockResolvedValue([
      { id: "cal-1", title: "Broken", listEvents: failingListEvents },
      { id: "cal-2", title: "Fine", listEvents: okListEvents },
    ]);

    const events = await fetchCalendarEvents();

    expect(events).toHaveLength(1);
    expect(events[0].calendarId).toBe("cal-2");
  });

  it("returns an empty list instead of throwing when getCalendars fails", async () => {
    (Calendar.getCalendars as jest.Mock).mockRejectedValue(
      new Error("native module unavailable"),
    );

    expect(await fetchCalendarEvents()).toEqual([]);
  });
});
