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
- `constants/theme.ts` — `Colors` object with `light` and `dark` keys (`background`, `text`, `tint`)

### Conventions

- `expo-image` with `source="sf:name"` for SF Symbols, not `expo-symbols` or vector icons
- `process.env.EXPO_OS` instead of `Platform.OS`
- `React.use` instead of `React.useContext`
- Inline styles over `StyleSheet.create` unless styles are reused
- `ScrollView` with `contentInsetAdjustmentBehavior="automatic"` instead of `SafeAreaView`
- `react-native-reanimated` (v4) and `react-native-gesture-handler` are available

### React Compiler

`reactCompiler: true` is enabled in `app.json`. Avoid manual `useMemo`/`useCallback` — the compiler handles memoization automatically.
