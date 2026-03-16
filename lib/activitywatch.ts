import type { AppUsage } from "@/stores/sessions-store";

const AW_BASE = "http://localhost:5600";

interface BucketMeta {
  id: string;
  type: string;
  client: string;
  hostname: string;
  created: string;
  last_updated: string;
}

interface AwEvent {
  id: number;
  timestamp: string;
  duration: number;
  data: {
    app?: string;
    title?: string;
    [key: string]: unknown;
  };
}

/**
 * Fetch all buckets and find the window watcher bucket
 */
export async function getWindowBucketId(): Promise<string | null> {
  try {
    const res = await fetch(`${AW_BASE}/api/0/buckets`);
    if (!res.ok) return null;

    const buckets: Record<string, BucketMeta> = await res.json();
    // Find "aw-watcher-window_*" bucket (windows/linux/mac)
    const windowBucketId = Object.keys(buckets).find((id) =>
      id.startsWith("aw-watcher-window_")
    );

    return windowBucketId ?? null;
  } catch {
    return null;
  }
}

/**
 * Fetch events from window bucket in the given time range and aggregate by app
 */
export async function getAppUsage(
  startTime: string,
  endTime: string
): Promise<AppUsage[]> {
  try {
    const bucketId = await getWindowBucketId();
    if (!bucketId) return [];

    const params = new URLSearchParams({
      start: startTime,
      end: endTime,
      limit: "10000",
    });

    const res = await fetch(
      `${AW_BASE}/api/0/buckets/${bucketId}/events?${params}`,
      { method: "GET" }
    );

    if (!res.ok) return [];

    const events: AwEvent[] = await res.json();

    // Aggregate by app name, summing durations and collecting window titles
    const appMap = new Map<
      string,
      { duration: number; titleMap: Map<string, number> }
    >();
    for (const event of events) {
      const app = event.data.app;
      if (app && typeof app === "string") {
        const entry = appMap.get(app) ?? {
          duration: 0,
          titleMap: new Map(),
        };
        entry.duration += event.duration;

        const title = event.data.title;
        if (title && typeof title === "string") {
          entry.titleMap.set(title, (entry.titleMap.get(title) ?? 0) + event.duration);
        }

        appMap.set(app, entry);
      }
    }

    // Convert to AppUsage[] and sort by duration descending
    const result: AppUsage[] = Array.from(
      appMap,
      ([app, { duration, titleMap }]) => ({
        app,
        duration,
        titles: Array.from(titleMap.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([t]) => t),
      })
    ).sort((a, b) => b.duration - a.duration);

    return result;
  } catch {
    return [];
  }
}

export type CurrentApp = {
  app: string;
  title: string | null;
};

/**
 * Fetch the currently active app from the last 60 seconds
 */
export async function getCurrentApp(): Promise<CurrentApp | null> {
  try {
    const bucketId = await getWindowBucketId();
    if (!bucketId) return null;

    const now = new Date();
    const sixtySecondsAgo = new Date(now.getTime() - 60_000);

    const params = new URLSearchParams({
      start: sixtySecondsAgo.toISOString(),
      end: now.toISOString(),
      limit: "20",
    });

    const res = await fetch(
      `${AW_BASE}/api/0/buckets/${bucketId}/events?${params}`,
      { method: "GET" }
    );

    if (!res.ok) return null;

    const events: AwEvent[] = await res.json();
    if (events.length === 0) return null;

    // Return the event with the latest timestamp
    const latestEvent = events.reduce((latest, current) => {
      const latestTime = new Date(latest.timestamp).getTime();
      const currentTime = new Date(current.timestamp).getTime();
      return currentTime > latestTime ? current : latest;
    });

    const app = latestEvent.data.app;
    const title = latestEvent.data.title ?? null;

    if (!app || typeof app !== "string") return null;

    return {
      app,
      title: typeof title === "string" ? title : null,
    };
  } catch {
    return null;
  }
}
