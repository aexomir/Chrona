## Commands

```bash
bun run ios        # Start in iOS simulator (custom dev build required — see below)
bun run android    # Start on Android
bun run web        # Start in browser
bun run lint       # Run ESLint via expo lint
```

> **NativeTabs requires a custom dev build.** `expo-router/unstable-native-tabs` uses native APIs not available in Expo Go. Run `npx expo run:ios` to build locally, or use EAS Build.

## Architecture

**Expo SDK 57 / React Native 0.86 / React 19.2** with file-based routing via `expo-router`.

### Navigation

The app uses `NativeTabs` from `expo-router/unstable-native-tabs` (not the JS `Tabs` component). Root layout is a single `Stack` with `(tabs)` as the only screen. The tab bar has 4 triggers: Dashboard, Timeline, Stats, and Search (icon-only, `role="search"`). A `BottomAccessory` on the tab bar renders `TimerBar` persistently across tabs. Settings is not a tab — it's pushed via `/settings` from a gear icon on the Dashboard.

```
app/
  _layout.tsx          Root Stack + DarkTheme provider
  settings.tsx         Settings (pushed, not a tab)
  (tabs)/
    _layout.tsx        NativeTabs with minimizeBehavior="onScrollDown"
    index/index.tsx    Dashboard
    timeline/index.tsx Timeline
    stats.tsx          Stats
    search.tsx         Search
```

### Path Aliases

`@/` maps to the project root. Use `@/components/...`, `@/constants/...`, `@/hooks/...` etc.

### Key Utilities

- `components/ui/icon-symbol.tsx` + `.ios.tsx` — SF Symbols (iOS) / Material Icons (Android) abstraction
- `components/haptic-tab.tsx` — haptic feedback wrapper for tab presses
- `hooks/use-color-scheme.ts` — color scheme detection (has `.web.ts` platform variant)
- `constants/theme.ts` — Design token system: `Colors` (nav theme), `Semantic` (status colors: warning/success/danger/info), `TextAlpha` (text hierarchy on dark surfaces), `Neutral` (zinc scale for icon tints and fallbacks)
