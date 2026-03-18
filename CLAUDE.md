# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun run ios        # Start in iOS simulator (custom dev build required — see below)
bun run android    # Start on Android
bun run web        # Start in browser
bun run lint       # Run ESLint via expo lint
```

> **NativeTabs requires a custom dev build.** `expo-router/unstable-native-tabs` uses native APIs not available in Expo Go. Run `npx expo run:ios` to build locally, or use EAS Build.

## Architecture

**Expo SDK 55 / React Native 0.83.2 / React 19.2.0** with file-based routing via `expo-router`.

### Navigation

The app uses `NativeTabs` from `expo-router/unstable-native-tabs` (not the JS `Tabs` component). Root layout is a single `Stack` with `(tabs)` as the only screen. The tab bar has 5 triggers: Dashboard, Timeline, Stats, Settings, and Search (icon-only, `role="search"`).

```
app/
  _layout.tsx          Root Stack + DarkTheme provider
  (tabs)/
    _layout.tsx        NativeTabs with minimizeBehavior="onScrollDown"
    index.tsx          Dashboard
    timeline.tsx       Timeline
    stats.tsx          Stats
    settings.tsx       Settings
    search.tsx         Search
```

### Path Aliases

`@/` maps to the project root. Use `@/components/...`, `@/constants/...`, `@/hooks/...` etc.

### Key Utilities

- `components/ui/icon-symbol.tsx` + `.ios.tsx` — SF Symbols (iOS) / Material Icons (Android) abstraction
- `components/haptic-tab.tsx` — haptic feedback wrapper for tab presses
- `hooks/use-color-scheme.ts` — color scheme detection (has `.web.ts` platform variant)
- `constants/theme.ts` — Design token system: `Colors` (nav theme), `Semantic` (status colors: warning/success/danger/info), `TextAlpha` (text hierarchy on dark surfaces), `Neutral` (zinc scale for icon tints and fallbacks)

### Conventions

- `expo-image` with `source="sf:name"` for SF Symbols, not `expo-symbols` or vector icons
- `process.env.EXPO_OS` instead of `Platform.OS`
- `React.use` instead of `React.useContext`
- `ScrollView` with `contentInsetAdjustmentBehavior="automatic"` instead of `SafeAreaView`
- `react-native-reanimated` (v4) and `react-native-gesture-handler` are available

### Components & Styling

**heroui-native is the default component library** — always use it before building custom components.

**`uniwind` (Tailwind via `className`) is the primary styling approach** — do not use `StyleSheet.create`.

heroui-native styling rules:
- `className` is the go-to for all styling on heroui-native components
- `style` prop takes precedence over `className` when both are provided (use for overrides)
- Some properties are animated by reanimated and override `className` — hover over `className` in the IDE to see which props are occupied
- To override animated styles: use the `animation` prop on components that support it
- To fully disable animated styles and apply your own: use `isAnimatedStyleActive={false}`

### Dependency Notes

`react-native-worklets` is pinned to `0.7.2` in both `dependencies` and `resolutions`. Do not change this — heroui-native ships `0.5.1` internally and the `resolutions` field forces `0.7.2` everywhere to match the compiled native binary.

### React Compiler

`reactCompiler: true` is enabled in `app.json`. Avoid manual `useMemo`/`useCallback` — the compiler handles memoization automatically.

## Design Context

### Users
People who want to be more intentional about how they spend their time across all areas of life — work, study, health, creativity, rest. They open Focus during transitions: before starting a session to commit, during idle moments to check in, and at day's end to reflect. They're self-aware, care about quality over quantity, and want the app to help them enter (and stay in) a flow state — not gamify or nag them.

### Brand Personality
**Calm · Precise · Minimal**

Like a high-end watch or a well-edited notebook. Nothing superfluous. Every element earns its place. The app should feel like it was designed by someone who thinks deeply about craft. References: Linear's dark precision, Craft/Notion's editorial clarity.

### Aesthetic Direction
- **Dark-first** — deep near-blacks (#18181b, #1a1a1c) with the aurora atmosphere as the expressive layer
- **Restrained vibrancy** — project colors are vivid but used sparingly, against dark surfaces so they land with weight
- **Atmospheric, not flashy** — the shader background shifts subtly; animations are purposeful and quiet, not decorative
- **Typography does the work** — generous negative tracking on large numbers, tight hierarchies, nothing oversized
- **Anti-references**: no playful/bubbly productivity apps (Todoist confetti energy), no aggressive gamification UI, no heavy gradients on text

### Design Principles

1. **Get out of the way.** The app's job is to help users enter flow — not to demand attention. Every screen should feel like opening a clean desk.

2. **Restraint is the feature.** When in doubt, remove. Whitespace, silence, and negative space are as intentional as any element you add.

3. **Precision over personality.** Exact spacing, exact alignment, exact timing on animations. Craft is felt even when it's not seen.

4. **The atmosphere reflects the user.** Dynamic elements (aurora background, streak indicators, recovery hints) respond to the user's state — they're ambient feedback, not notifications.

5. **Dark surfaces, light interactions.** Deep backgrounds make focused foreground elements feel elevated. Color should feel like light emerging from darkness, not painted on top.
