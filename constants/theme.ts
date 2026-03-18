/** Structural colors consumed by expo-router (light/dark nav theme) */
export const Colors = {
  light: {
    background: "#f9f9f9",
    text: "#11181C",
    tint: "#0a7ea4",
  },
  dark: {
    background: "#18181b",
    text: "#ECEDEE",
    tint: "#ffffff",
  },
} as const;

/**
 * Status / semantic colors — aurora-independent.
 * These map to a fixed intent regardless of theme state.
 *
 * Naming: base = saturated (icons, backgrounds), bright = lighter (text on dark)
 */
export const Semantic = {
  warning: "#f59e0b", // amber-500  · at-risk, recovery headers
  warningBright: "#fbbf24", // amber-400  · dots, indicator text

  success: "#10b981", // emerald-500 · confirmations
  successBright: "#4ade80", // green-400   · positive delta text

  danger: "#ef4444", // red-500     · errors, negative delta
  dangerBright: "#f87171", // red-400     · negative delta text

  info: "#3b82f6", // blue-500    · suggestions, rule creation
  infoBright: "#60a5fa", // blue-400    · suggestion dots, hint text
} as const;

/**
 * Text opacity scale — always used on near-black (dark) surfaces.
 * Prefer Tailwind classes in JSX (text-white, text-white/70, etc.);
 * use these for StyleSheet.create() or inline style props where
 * className is not available.
 */
export const TextAlpha = {
  primary: "rgba(255,255,255,0.92)", // headings, active values, prominent labels
  secondary: "rgba(255,255,255,0.70)", // body text, session titles
  tertiary: "rgba(255,255,255,0.45)", // captions, inactive labels, hints
  disabled: "rgba(255,255,255,0.28)", // disabled states
} as const;

/**
 * Zinc neutral scale — for icon tints, dividers, and fallback surfaces.
 * Prefer Tailwind classes (text-zinc-500 etc.) in JSX;
 * use these for inline style props (tintColor, backgroundColor) where
 * className is not available.
 */
export const Neutral = {
  z400: "#a1a1aa", // zinc-400
  z500: "#71717a", // zinc-500
  z600: "#52525b", // zinc-600
  z700: "#3f3f46", // zinc-700
  z800: "#27272a", // zinc-800
  z900: "#18181b", // zinc-900
} as const;
