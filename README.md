# Chrona

A minimal, dark-first time tracking app for people who want to be intentional about how they spend their time. Built with Expo SDK 57 / React Native 0.86 / React 19.

**Design ethos:** Calm · Precise · Minimal. Like a high-end watch — nothing superfluous, every element earns its place.

---

## Features

- **Chrona Timer** — Start sessions tied to projects, with live tracking and iOS Live Activities support
- **Auto-Tracking** — User-defined rules (app name + window-title keywords) match live app-usage events from the macOS Chrona Helper and auto-start/stop timers; unmatched app usage surfaces as an "untracked app" hint in the timer bar
- **Calendar Integration** — Map calendar events to projects; get a one-tap suggestion in the timer bar when a mapped event is active
- **Streak Tracking** — Simple consecutive-day streak count shown on the Stats tab, no warnings or reward animations
- **Timeline** — Chronological view of sessions interleaved with calendar event markers, with drag-to-merge
- **Stats** — Timeframe-tabbed metrics: trend deltas, hourly bar chart, project distribution, streak, focus consistency
- **Search** — Heuristic, keyword-based search over your own session data (streak/project/stats intent matching); no ML or on-device model inference
- **Widgets** — iOS home screen widgets (`ChronaTimeWidget`, `TimelineWidget`) and a Live Activity for the active timer
- **Chrona Helper** — Native macOS companion app (`ChronaHelper/`) that observes the frontmost app and window title and streams them to the iOS app over the local network (Bonjour, `_chrona._tcp`)

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Expo SDK 57, React 19.2, React Native 0.86 |
| Routing | `expo-router` with `NativeTabs` (unstable-native-tabs) |
| UI Components | `heroui-native` (default component library) |
| Styling | `uniwind` (Tailwind v4 via `className`) |
| State | Zustand 5 + MMKV (via `react-native-mmkv`) |
| Animations | Reanimated v4, Gesture Handler |
| Canvas | `@shopify/react-native-skia` (aurora shader background) |
| Calendar | `expo-calendar` |
| Widgets | `expo-widgets` |
| Local streaming | Custom native module `modules/chrona-stream` (Bonjour/NWListener bridge to Chrona Helper) |

---

## Project Structure

```
app/
├── _layout.tsx              # Root Stack + DarkTheme provider
├── timer.tsx                # Timer modal (start/review/save flow)
├── projects.tsx             # Project management
├── calendar-settings.tsx    # Calendar integration settings
├── settings.tsx             # App settings screen
├── tracking-rules.tsx       # Auto-tracking rules (app → project mapping)
├── onboarding.tsx           # 4-slide onboarding (Welcome, Projects, Calendar, Ready)
└── (tabs)/
    ├── _layout.tsx          # NativeTabs (4 tabs + BottomAccessory TimerBar, minimizeBehavior="onScrollDown")
    ├── index/index.tsx      # Dashboard (FocusRing, aurora background, optional constellation)
    ├── timeline/index.tsx   # Timeline (sessions + calendar events)
    ├── timeline/[id].tsx    # Session detail
    ├── stats.tsx            # Statistics (trends, chart, project distribution, streak)
    ├── settings.tsx         # Settings (integrations, data, preferences)
    └── search.tsx           # Keyword-based search over session data

features/                    # Feature-colocated modules (stores, utils, components)
├── analytics/                # Stats utils (streak, consistency, hour buckets), stats components
├── auto-track/               # Tracking rules store, matcher, auto-tracker, untracked-app hints
├── aurora/                   # Shader background, atmosphere detection, theme hook
├── calendar/                 # Calendar store, utilities, active-event suggestion
├── idle/                     # Idle-state detection
├── intelligence/             # Per-app dwell-time journal (feeds session "Apps" breakdown)
├── onboarding/                # Onboarding slide components
├── projects/                 # Projects store
├── search/                   # Keyword/heuristic search: intent parsing, result specs, components
├── sessions/                  # Sessions store
├── settings/                  # Settings store
├── stream/                    # chrona-stream connection store (Chrona Helper link)
├── timeline/                  # Timeline utilities + components
├── timer/                     # Focus ring, timer bar, timer store
└── widgets/                   # Live Activity + iOS widget data sync

modules/
└── chrona-stream/            # Native Expo module: Bonjour client for the Chrona Helper stream

targets/widget (ios/ExpoWidgetsTarget/)
└── ChronaTimeWidget, TimelineWidget (SwiftUI)

ChronaHelper/
└── ChronaHelper/             # Native macOS companion (Swift): AppObserver + BonjourServer

storage/
└── index.ts                  # MMKV adapter for Zustand persist

constants/
└── theme.ts                  # Design tokens: Colors, Semantic, TextAlpha, Neutral
```

---

## Development

> **Custom dev build required.** `expo-router/unstable-native-tabs`, `expo-calendar`, `expo-widgets`, and the `chrona-stream` native module all require a native build — they are not available in Expo Go.

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

`react-native-worklets` is pinned in both `dependencies` and `resolutions` to match the version heroui-native was compiled against. Do not change this independently of heroui-native's internal pin.

---

## Architecture Notes

### Storage
All persistent state uses Zustand with MMKV via the adapter in `storage/index.ts`.

### Feature Colocation
Logic, stores, and components are colocated under `features/<domain>/` rather than split across a flat `stores/` directory. Each feature owns its state, utilities, and domain-specific components.

### Auto-Tracking
`features/auto-track/matcher.ts` matches incoming app/window-title events (from `features/stream/`) against user-defined `TrackingRule`s (`app/tracking-rules.tsx`): rules match on exact app name, optionally requiring all `titleKeywords` to appear in the window title, with more-specific rules (more keywords) taking priority. `features/auto-track/auto-tracker.ts` drives auto-start/stop of timers from matches, with idle-timeout and app-switch grace-period handling. Unmatched app usage surfaces as an "untracked app" hint in the timer bar rather than being tracked automatically.

### TimerBar
`features/timer/timer-bar.tsx` — Persistent element rendered as `BottomAccessory` in NativeTabs. Priority order of what it displays (highest to lowest):
1. Active auto-tracked session
2. Active manual session
3. Resumable interrupted session (30-minute TTL)
4. Calendar event suggestion
5. Untracked-app hint
6. Default "Tap to start" prompt

### Navigation
Root is a single `Stack`. `(tabs)` is the only stack screen. Four tab triggers: Dashboard, Timeline, Stats, Search (icon-only, `role="search"`). Settings is not a tab — it's pushed via `/settings` from a gear icon on the Dashboard.

### Aurora Background
`features/aurora/atmosphere.tsx` — Skia shader background that shifts subtly based on session state. Colors and transition logic live alongside it in `features/aurora/`.

### Search
`features/search/` is a heuristic, keyword-based search — not an ML or on-device inference feature. `query-intent.ts` matches substrings in the query (streak/project/stats intent), `use-search-query.ts` turns that into boolean display flags, and `search-generation.ts` formats a response from real session stats (`computeStreak`, `getHourBuckets`, etc.) using those flags. Everything runs synchronously on-device with plain string/array logic — there is no model inference or network call involved.

### Chrona Helper
`ChronaHelper/ChronaHelper/AppObserver.swift` watches for frontmost-app changes on macOS (via `NSWorkspace` notifications + a 1s poll) and reads window titles via the Accessibility API. `BonjourServer.swift` advertises an `NWListener` under the `_chrona._tcp` service type and streams `ChronaEvent`s to the iOS app over the local network. The iOS side connects via the `modules/chrona-stream` native module and `features/stream/stream-store.ts`.

### Widgets & Live Activity
`features/widgets/widget-sync.ts` syncs today's focus time and current session to `ChronaTimeWidget`, and today's session list to `TimelineWidget`. `features/widgets/live-activity.ts` starts/updates/ends an iOS Live Activity showing the active timer.
