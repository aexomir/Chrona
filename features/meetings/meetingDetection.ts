import type { AppUsage } from "@/features/sessions/sessions-store";

export type MeetingAppId = "zoom" | "teams" | "meet";

export type MeetingAppDef = {
  id: MeetingAppId;
  displayName: string;
  icon: string; // SF Symbol name
  appPatterns: string[]; // case-insensitive substrings to match AppUsage.app
  titlePatterns?: string[]; // optional: match AppUsage.titles[] (for browser-based apps)
};

export type ActiveMeeting = {
  appId: MeetingAppId;
  appDef: MeetingAppDef;
  usage: AppUsage; // the AW entry that matched
};

const MIN_DURATION_S = 60; // ignore <1 min of usage (open but idle)

export const MEETING_APPS: MeetingAppDef[] = [
  {
    id: "zoom",
    displayName: "Zoom",
    icon: "video.fill",
    appPatterns: ["zoom.us", "zoom"],
  },
  {
    id: "teams",
    displayName: "Microsoft Teams",
    icon: "person.3.fill",
    appPatterns: ["microsoft teams", "teams"],
  },
  {
    id: "meet",
    displayName: "Google Meet",
    icon: "video.badge.plus",
    appPatterns: [], // browser-based; detected via title
    titlePatterns: ["meet.google.com", "google meet"],
  },
];

/**
 * Detect if an active meeting is currently happening based on app usage
 */
export function detectActiveMeeting(
  apps: AppUsage[],
  enabledIds: MeetingAppId[]
): ActiveMeeting | null {
  for (const appId of enabledIds) {
    const appDef = MEETING_APPS.find((a) => a.id === appId);
    if (!appDef) continue;

    // Check for native app matches
    if (appDef.appPatterns.length > 0) {
      const usage = apps.find((app) => {
        if (app.duration < MIN_DURATION_S) return false;
        const appLower = app.app.toLowerCase();
        return appDef.appPatterns.some((pattern) =>
          appLower.includes(pattern.toLowerCase())
        );
      });
      if (usage) return { appId, appDef, usage };
    }

    // Check for browser/title-based matches
    if (appDef.titlePatterns && appDef.titlePatterns.length > 0) {
      const usage = apps.find((app) => {
        if (app.duration < MIN_DURATION_S) return false;
        return app.titles?.some((title) =>
          appDef.titlePatterns!.some((pattern) =>
            title.toLowerCase().includes(pattern.toLowerCase())
          )
        );
      });
      if (usage) return { appId, appDef, usage };
    }
  }

  return null;
}

/**
 * Generate a status label for the given meeting state
 */
export function meetingStatusLabel(
  isEnabled: boolean,
  selectedIds: MeetingAppId[]
): string {
  if (!isEnabled) return "Off";
  if (selectedIds.length === 0) return "Off";
  if (selectedIds.length === 1) {
    const app = MEETING_APPS.find((a) => a.id === selectedIds[0]);
    return app?.displayName || "Off";
  }
  if (selectedIds.length === 2) {
    const names = selectedIds
      .map((id) => MEETING_APPS.find((a) => a.id === id)?.displayName)
      .filter(Boolean);
    return names.join(", ");
  }
  return `${selectedIds.length} apps`;
}
