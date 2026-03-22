import { Easing } from "react-native-reanimated";

// ─── Constants ────────────────────────────────────────────────────────────────

export const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export const DAY_ABBREVS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const CIRCLE_SIZE = 36;
export const STRIP_PT = 12;
export const ABBREV_H = 16;
export const GAP = 8;
export const CIRCLE_TOP = STRIP_PT + ABBREV_H + GAP;
export const CIRCLE_EASING = Easing.out(Easing.cubic);
export const CIRCLE_DURATION = 240;

// ─── Functions ────────────────────────────────────────────────────────────────

export function getWeekStart(base: Date, offsetWeeks: number): Date {
  const d = new Date(base);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff + offsetWeeks * 7);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });
}

export function formatDate(d: Date) {
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function formatTime24(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function formatDuration(seconds: number): string {
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function formatGapDuration(ms: number): string {
  const totalMinutes = Math.floor(ms / 60000);
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function circleXForIndexInWidth(idx: number, width: number): number {
  const cw = (width - 6) / 7;
  return idx * (cw + 1) + (cw - CIRCLE_SIZE) / 2;
}
