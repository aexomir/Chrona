import type { Project } from "@/constants/projects";
import type { Session } from "@/features/sessions/sessions-store";

// ─── Types ────────────────────────────────────────────────────────────────────

export type Timeframe = "day" | "week" | "month" | "year" | "all";

export const TIMEFRAMES: { label: string; value: Timeframe }[] = [
  { label: "Day", value: "day" },
  { label: "Week", value: "week" },
  { label: "Month", value: "month" },
  { label: "Year", value: "year" },
  { label: "All", value: "all" },
];

// ─── Data helpers ─────────────────────────────────────────────────────────────

export function getRange(tf: Timeframe, now: Date): { start: Date; end: Date } {
  const start = new Date(now);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  switch (tf) {
    case "day":
      start.setHours(0, 0, 0, 0);
      break;
    case "week": {
      const day = start.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      start.setDate(start.getDate() + diff);
      start.setHours(0, 0, 0, 0);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      break;
    }
    case "month":
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(end.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case "year":
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(11, 31);
      end.setHours(23, 59, 59, 999);
      break;
    case "all":
      start.setFullYear(2000, 0, 1);
      start.setHours(0, 0, 0, 0);
      end.setFullYear(2100, 11, 31);
      break;
  }
  return { start, end };
}

export function getPrevRange(
  tf: Timeframe,
  now: Date,
): { start: Date; end: Date } {
  if (tf === "all") return { start: new Date(0), end: new Date(0) };
  const prev = new Date(now);
  switch (tf) {
    case "day":
      prev.setDate(prev.getDate() - 1);
      break;
    case "week":
      prev.setDate(prev.getDate() - 7);
      break;
    case "month":
      prev.setMonth(prev.getMonth() - 1);
      break;
    case "year":
      prev.setFullYear(prev.getFullYear() - 1);
      break;
  }
  return getRange(tf, prev);
}

export function filterSessions(
  sessions: Session[],
  start: Date,
  end: Date,
): Session[] {
  return sessions.filter((s) => {
    const t = new Date(s.startTime).getTime();
    return t >= start.getTime() && t <= end.getTime();
  });
}

export function getTotalSeconds(sessions: Session[]): number {
  return sessions.reduce((acc, s) => acc + s.duration, 0);
}

export function formatFocusTime(seconds: number): string {
  if (seconds === 0) return "0m";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function getDelta(
  current: number,
  prev: number,
): { dir: "up" | "down" | "same"; pct: number } {
  if (prev === 0) return { dir: "same", pct: 0 };
  const pct = Math.round(((current - prev) / prev) * 100);
  return {
    dir: pct > 0 ? "up" : pct < 0 ? "down" : "same",
    pct: Math.abs(pct),
  };
}

export function getHourBuckets(sessions: Session[]): number[] {
  const buckets = new Array(24).fill(0);
  for (const s of sessions) {
    buckets[new Date(s.startTime).getHours()] += s.duration / 60;
  }
  return buckets;
}

export function getProjectTotals(
  sessions: Session[],
  projects: Project[],
): { project: Project; seconds: number }[] {
  const map = new Map<string, number>();
  for (const s of sessions) {
    if (s.projectId)
      map.set(s.projectId, (map.get(s.projectId) ?? 0) + s.duration);
  }
  return projects
    .filter((p) => map.has(p.id))
    .map((p) => ({ project: p, seconds: map.get(p.id)! }))
    .sort((a, b) => b.seconds - a.seconds);
}

export function computeStreak(sessions: Session[]) {
  if (sessions.length === 0) return { current: 0, ongoing: false };

  const days = new Set(
    sessions.map((s) => {
      const d = new Date(s.startTime);
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    }),
  );

  const today = new Date();
  const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = `${yesterday.getFullYear()}-${yesterday.getMonth()}-${yesterday.getDate()}`;

  const hasToday = days.has(todayKey);
  if (!hasToday && !days.has(yesterdayKey))
    return { current: 0, ongoing: false };

  let current = 0;
  const checkDate = hasToday ? new Date(today) : new Date(yesterday);
  while (true) {
    const key = `${checkDate.getFullYear()}-${checkDate.getMonth()}-${checkDate.getDate()}`;
    if (!days.has(key)) break;
    current++;
    checkDate.setDate(checkDate.getDate() - 1);
  }
  return { current, ongoing: hasToday };
}

export function computeFocusConsistency(
  sessions: Session[],
  start: Date,
  end: Date,
): { percentage: number; daysWithSessions: number; totalDays: number } {
  if (sessions.length === 0)
    return { percentage: 0, daysWithSessions: 0, totalDays: 0 };

  const sessionDays = new Set(
    sessions.map((s) => {
      const d = new Date(s.startTime);
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    }),
  );

  // Count total days in range
  const totalMs = end.getTime() - start.getTime();
  const totalDays = Math.ceil(totalMs / (1000 * 60 * 60 * 24)) + 1;

  const daysWithSessions = sessionDays.size;
  const percentage =
    totalDays > 0 ? Math.round((daysWithSessions / totalDays) * 100) : 0;

  return { percentage, daysWithSessions, totalDays };
}
