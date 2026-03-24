# Focus

A minimal, dark-first time tracking app for people who want to be intentional about how they spend their time. Built with Expo 55 / React Native 0.83 / React 19.

**Design ethos:** Calm · Precise · Minimal. Like a high-end watch — nothing superfluous, every element earns its place.

---

## Features

- **Focus Timer** — Start sessions tied to projects, with live tracking and iOS Live Activities support
- **ActivityWatch Integration** — Automatically captures app usage during sessions and learns which apps belong to which projects
- **Smart Suggestions** — Learns from past sessions to suggest the right project when you switch context; integrates with active calendar events
- **Missed Time Recovery** — Detects gaps >= 15 minutes in tracked time (up to 8h back) and prompts you to log them
- **Calendar Integration** — Map calendar events to projects; get prompted to start a session when a mapped event is active
- **Streak System** — Daily streak tracking with loss-aversion mechanics: badge, at-risk warning at 5pm, flash reward on save
- **Timeline** — Chronological view of sessions interleaved with calendar event markers
- **Stats & AI Search** — On-device AI inference via ExecutorTorch for trend analysis, insights, and natural-language search
- **Apple Watch** — Glanceable watch app showing active timer and focus ring
- **Widgets** — iOS home screen widgets showing focus ring and timeline
- **macOS Helper** — Native macOS companion app (`MacOS/FocusHelper`) for ActivityWatch stream bridging

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Expo SDK 55, React 19.2, React Native 0.83.2 |
| Routing | `expo-router` with `NativeTabs` (unstable-native-tabs) |
| UI Components | `heroui-native` (default component library) |
| Styling | `uniwind` (Tailwind v4 via `className`) |
| State | Zustand 5 + MMKV (via `react-native-mmkv`) |
| Animations | Reanimated v4 (60fps), Gesture Handler |
| Canvas | `@shopify/react-native-skia` (aurora shader background) |
| On-device AI | `react-native-executorch` |
| Calendar | `expo-calendar` |

---

## Project Structure

```
app/
├── _layout.tsx              # Root Stack + DarkTheme provider
├── timer.tsx                # Timer modal (start/review/save flow)
├── recover.tsx              # Missed-time recovery modal
├── projects.tsx             # Project management
├── calendar-settings.tsx    # Calendar integration settings
├── settings.tsx             # App settings screen
├── tracking-rules.tsx       # Tracking rules
├── untracked.tsx            # Untracked session review
└── (tabs)/
    ├── _layout.tsx          # NativeTabs (5 tabs, minimizeBehavior="onScrollDown")
    ├── index/index.tsx      # Dashboard (FocusRing, streak badge, recent sessions)
    ├── timeline/index.tsx   # Timeline (sessions + calendar events)
    ├── timeline/[id].tsx    # Session detail
    ├── stats.tsx            # Statistics + AI insights
    ├── settings.tsx         # Settings (integrations, data, preferences)
    └── search.tsx           # AI-powered natural language search

features/                    # Feature-colocated modules (stores, utils, components)
├── activity-watch/          # AW API client, suggestions store, streaming transport
├── analytics/               # Stats utils, trending insights, session constellation
├── aurora/                  # Shader background, atmosphere detection, theme hook
├── calendar/                # Calendar store, utilities, missed event detection
├── projects/                # Projects store
├── recovery/                # Missed time detection + recovery store
├── search/                  # AI inference engine, component renderer, search generation
├── sessions/                # Sessions store
├── settings/                # Settings store
├── timeline/                # Timeline utilities + components
├── timer/                   # Focus ring, timer bar, timer store
├── tracking-rules/          # Tracking rules store
└── watch/                   # Watch sync hooks

components/
├── timer-bar.tsx            # Persistent bottom bar (suggestions, recovery hint, streak)
├── animated-header-scroll-view.tsx
├── empty-state.tsx
└── hero-overlay.tsx

targets/
├── watch/                   # Apple Watch target (SwiftUI)
└── widget/                  # iOS widget + Live Activity target (SwiftUI)

MacOS/
└── FocusHelper/             # Native macOS companion (Swift, ActivityWatch bridge)

storage/
└── index.ts                 # MMKV adapter for Zustand persist

constants/
└── theme.ts                 # Design tokens: Colors, Semantic, TextAlpha, Neutral
```

---

## Development

> **Custom dev build required.** `expo-router/unstable-native-tabs`, `expo-calendar`, and native targets (Watch, Widget) all require a native build — they are not available in Expo Go.

```bash
# Install dependencies
bun install

# Build and run (first time or after native changes)
npx expo run:ios
npx expo run:android

# Start dev server (after native build exists)
bun run ios
bun run android
bun run web

# Lint
bun run lint
```

---

## Key Conventions

- **Path alias**: `@/` maps to the project root — use `@/components/...`, `@/features/...`, etc.
- **Icons**: `expo-image` with `source="sf:name"` for SF Symbols (not `expo-symbols` or vector icons)
- **Platform detection**: `process.env.EXPO_OS` instead of `Platform.OS`
- **Context**: `React.use()` instead of `React.useContext()`
- **Safe area**: `ScrollView` with `contentInsetAdjustmentBehavior="automatic"` instead of `SafeAreaView`
- **Styling**: `className` (Tailwind via uniwind) — no `StyleSheet.create`
- **Memoization**: Don't use `useMemo`/`useCallback` — React Compiler (`reactCompiler: true`) handles it
- **heroui-native**: `className` for styling; `style` overrides `className`; some props are animated by Reanimated and override `className` (check IDE hover)

### Critical dependency note

`react-native-worklets` is pinned to `0.7.2` in both `dependencies` and `resolutions`. **Do not change this.** heroui-native ships `0.5.1` internally; the `resolutions` field forces `0.7.2` everywhere to match the compiled native binary.

---

## Architecture Notes

### Storage
All persistent state uses Zustand with MMKV via the adapter in `storage/index.ts`. Recovery and streak-flash stores are ephemeral (no persist) — they reset on app restart by design.

### Feature Colocation
Logic, stores, and components are colocated under `features/<domain>/` rather than split across a flat `stores/` directory. Each feature owns its state, utilities, and domain-specific components.

### ActivityWatch Integration
`features/activity-watch/activitywatch.ts` — `getAppUsage(startTime, endTime)` returns aggregated app usage with top 3 window titles per app. Used in the timer review screen and for missed-time detection. The macOS FocusHelper bridges the ActivityWatch WebSocket stream to the iOS app.

### Missed Time Detection
`features/recovery/detectMissedTime.ts` — Looks back 8 hours, finds gaps >= 15 minutes, skips gaps with < 10 minutes of AW data, applies a 5-minute end buffer. Returns the best gap with a project suggestion, or null.

### TimerBar
`features/timer/timer-bar.tsx` — Persistent element rendered as `BottomAccessory` in NativeTabs. Priority order of what it displays (highest to lowest):
1. Streak flash reward (2s after saving a session)
2. Streak at-risk warning (5pm+ with no session today)
3. Missed time recovery hint (amber)
4. Calendar event suggestion
5. App-pattern suggestion (from learning store)
6. Default "Tap to start" prompt

### Navigation
Root is a single `Stack`. `(tabs)` is the only stack screen. Five tab triggers: Dashboard, Timeline, Stats, Settings, Search (icon-only, `role="search"`).

### Aurora Background
`features/aurora/atmosphere.tsx` — Skia shader that shifts subtly based on the user's state (idle, active, streak at risk). Colors and transition logic live in `atmosphereColors.ts` and `atmosphereDetector.ts`.

### On-device AI
`features/search/inference.ts` — Runs ExecutorTorch models on-device for natural-language search and trend insights. No data leaves the device.
