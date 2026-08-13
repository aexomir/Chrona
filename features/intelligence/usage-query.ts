/**
 * App-usage lookup — asks the Mac which apps were used in a window.
 *
 * This replaces the old on-device accumulator, which tried to derive durations
 * from a live event stream. That could only ever be as complete as the stream,
 * and the stream dies the moment iOS suspends the app — so a session where the
 * phone spent most of its time in the background recorded almost nothing.
 *
 * The Mac keeps a durable ledger and answers for any past window, so the phone
 * being offline during a session no longer costs anything. When the Mac is
 * genuinely unreachable, callers get `status: "unreachable"` and should queue
 * the window for backfill (see pending-usage-store) rather than treat the empty
 * result as "no apps were used".
 */

import type { AppUsage } from "@/features/sessions/sessions-store";
import { captureError } from "@/lib/sentry";
import type { UsageCoverage } from "@/modules/chrona-stream";
import { native } from "@/modules/chrona-stream";

/** Below this, a result is noise from passing through an app, not usage. */
const MIN_DWELL_SECONDS = 5;

/** Blocks the interactive stop button, so it has to stay short. */
export const INTERACTIVE_TIMEOUT_MS = 3000;
/** Runs unattended on reconnect, so it can afford to wait. */
export const BACKFILL_TIMEOUT_MS = 8000;

const SYSTEM_BUNDLE_PREFIXES = [
  "com.apple.loginwindow",
  "com.apple.dock",
  "com.apple.finder",
  "com.apple.systemuiserver",
  "com.apple.notificationcenterui",
  "com.apple.ScreenSaverEngine",
  "com.apple.screensaver.",
  "com.apple.UserNotificationCenter",
  "com.apple.SecurityAgent",
  "com.apple.controlcenter",
  "com.apple.Spotlight",
  "com.apple.springboard",
  "com.apple.PIPAgent",
  "com.apple.WindowManager",
] as const;

const SYSTEM_APP_NAMES = new Set([
  "Finder",
  "Dock",
  "loginwindow",
  "SystemUIServer",
  "NotificationCenter",
  "Notification Center",
  "ScreenSaverEngine",
  "Control Center",
  "Spotlight",
  "UserNotificationCenter",
  "SecurityAgent",
  "WindowManager",
  "PIPAgent",
]);

export function isSystemProcess(bundleId: string, displayName: string): boolean {
  if (SYSTEM_APP_NAMES.has(displayName)) return true;
  return SYSTEM_BUNDLE_PREFIXES.some((p) => bundleId === p || bundleId.startsWith(p));
}

export type UsageLookup = {
  status: "ok" | "unreachable";
  apps: AppUsage[];
  coverage?: UsageCoverage;
};

const UNREACHABLE: UsageLookup = { status: "unreachable", apps: [] };

/**
 * Never throws — an unreachable Mac is an expected state, not an error, and
 * every caller is on a session-save path that must not be blocked by it.
 */
export async function getAppsForWindow(
  startMs: number,
  endMs: number,
  timeoutMs: number = INTERACTIVE_TIMEOUT_MS,
): Promise<UsageLookup> {
  if (process.env.EXPO_OS !== "ios") return UNREACHABLE;
  if (!(endMs > startMs)) return { status: "ok", apps: [] };

  try {
    const result = await native.queryUsage(startMs, endMs, timeoutMs);
    const apps = result.apps
      .filter(
        (a) => a.seconds >= MIN_DWELL_SECONDS && !isSystemProcess(a.bundleId, a.appName),
      )
      .map((a) => ({
        app: a.appName || a.bundleId,
        duration: a.seconds,
        ...(a.titles.length > 0 ? { titles: a.titles } : {}),
      }));
    return { status: "ok", apps, coverage: result.coverage };
  } catch (error) {
    const code = (error as { code?: string })?.code;
    // "unreachable" is the module's own signal and carries no information
    // worth reporting; anything else is a real defect.
    if (code !== "unreachable") {
      captureError(error, "usage_query");
    }
    return UNREACHABLE;
  }
}
