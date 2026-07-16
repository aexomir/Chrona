import { trackEvent } from "@/lib/sentry";
import chronaLiveActivity, {
  type ChronaLiveActivityProps,
} from "@/widgets/chrona-live-activity";
import type { LiveActivity } from "expo-widgets";

/** The activity instance this app process started, if any — held so
 * `updateActivity`/`endActivity` act on the actual running activity rather
 * than guessing at "whichever one is first". */
let activeActivity: LiveActivity<ChronaLiveActivityProps> | null = null;

export async function startActivity(props: ChronaLiveActivityProps): Promise<void> {
  if (process.env.EXPO_OS !== "ios") return;
  try {
    // End any orphaned activities from a prior crash/kill before starting a new one.
    const existing = chronaLiveActivity.getInstances();
    await Promise.all(existing.map((instance) => instance.end("immediate")));
    activeActivity = chronaLiveActivity.start(props, "chrona://(tabs)/timeline");
  } catch (error) {
    trackEvent("live_activity", "start_failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    activeActivity = null;
  }
}

export async function updateActivity(props: ChronaLiveActivityProps): Promise<void> {
  if (process.env.EXPO_OS !== "ios" || !activeActivity) return;
  await activeActivity.update(props).catch(() => {});
}

export async function endActivity(): Promise<void> {
  if (process.env.EXPO_OS !== "ios") return;
  if (activeActivity) {
    await activeActivity.end("immediate").catch(() => {});
    activeActivity = null;
    return;
  }
  // No held instance (e.g. after a JS reload) — fall back to ending
  // whatever is actually running.
  const existing = chronaLiveActivity.getInstances();
  await Promise.all(existing.map((instance) => instance.end("immediate").catch(() => {})));
}

export function isLiveActivityRunning(): boolean {
  if (process.env.EXPO_OS !== "ios") return false;
  return chronaLiveActivity.getInstances().length > 0;
}
