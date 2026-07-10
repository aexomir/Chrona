import type { DimensionValue } from "react-native";

export const TOTAL_SLIDES = 4;

// Alternating wide/narrow: [wide, narrow], [narrow, wide], [wide, narrow]
export const MOSAIC_ROWS: [string, string][] = [
  ["work", "study"],
  ["exercise", "creative"],
  ["personal", "rest"],
];

export const MOSAIC_RATIOS: [number, number][] = [
  [1.55, 1],
  [1, 1.55],
  [1.55, 1],
];

export const CALENDAR_BLOCKS: {
  left: DimensionValue;
  width: DimensionValue;
  color: string;
  label: string;
}[] = [
  { left: "4%", width: "22%", color: "#3b82f6", label: "9am" },
  { left: "30%", width: "14%", color: "#22c55e", label: "12pm" },
  { left: "48%", width: "28%", color: "#a855f7", label: "1pm" },
  { left: "80%", width: "14%", color: "#f97316", label: "4pm" },
];
