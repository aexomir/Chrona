import type { Session } from '@/features/sessions/sessions-store';

// Returns the most-used projectId in the ±3-hour bucket around `hour`, or null.
// Buckets: 0–2, 3–5, 6–8, 9–11, 12–14, 15–17, 18–20, 21–23
export function suggestProjectByTime(sessions: Session[], hour: number): string | null {
  const bucketStart = Math.floor(hour / 3) * 3;
  const bucketEnd = bucketStart + 2;

  const counts = new Map<string, number>();
  for (const s of sessions) {
    if (!s.projectId) continue;
    const h = new Date(s.startTime).getHours();
    if (h >= bucketStart && h <= bucketEnd) {
      counts.set(s.projectId, (counts.get(s.projectId) ?? 0) + 1);
    }
  }

  if (counts.size === 0) return null;

  let best: string | null = null;
  let bestCount = 0;
  for (const [id, count] of counts) {
    if (count > bestCount) {
      bestCount = count;
      best = id;
    }
  }
  return best;
}
