# AGENTS.md

Instructions for AI coding agents working in this repository. Human contributors should read
[`CONTRIBUTING.md`](CONTRIBUTING.md), which covers the same ground more discursively.

## What this project is

Chrona is two programs:

- **The iOS app** — Expo SDK 57 / React Native 0.86 / React 19.2, file-based routing via
  `expo-router`. Lives in `app/`, `features/`, `components/`, `modules/`, `widgets/`.
- **Chrona Helper** — a Swift macOS menu bar app in `ChronaHelper/`. Watches the frontmost
  app and window title, keeps a seven-day ledger on disk, streams to the phone.

They talk over Bonjour (`_chrona._tcp`) and newline-delimited JSON via
`modules/chrona-stream`. The protocol is versioned; both sides must agree. Spec is in
[`ChronaHelper/README.md`](ChronaHelper/README.md).

There is no backend. Everything is local.

## Commands

```bash
bun install
npx expo run:ios          # native build — required after any native change
bun start                 # dev server, once a native build exists
bun run lint
bun test
bunx tsc --noEmit
bun run screenshots:ios   # Maestro capture + fastlane frameit
```

**Expo Go does not work.** Native tabs, `expo-calendar`, `expo-widgets` and `chrona-stream`
all require a custom dev build.

Before declaring work done, `bunx tsc --noEmit`, `bun run lint` and `bun test` must all pass.
Lint has five pre-existing warnings — don't add more.

## Code style

These are firm. Violating them is the most common reason a change gets rejected.

- **Style with `className`** (Tailwind via `uniwind`). Never `StyleSheet.create`, never inline
  `style` props. Narrow exceptions: `expo-image`, and genuinely dynamic computed values.
- **No hand-written `useMemo` / `useCallback`.** `reactCompiler: true` is set in `app.json`;
  manual memoization fights the compiler.
- **`process.env.EXPO_OS`**, not `Platform.OS`.
- **`React.use()`**, not `React.useContext()`.
- **`ScrollView` with `contentInsetAdjustmentBehavior="automatic"`**, not `SafeAreaView`.
- **SF Symbols through `expo-image`** with `source="sf:name"`. Not `expo-symbols`, not a
  vector icon library.
- **`heroui-native` is the default component library.** Reach for it before writing a custom
  component. `style` overrides `className` on its components; some props are animated by
  Reanimated and override `className` — use the `animation` prop, or
  `isAnimatedStyleActive={false}` to take over entirely.
- **Animate with `withTiming`, not `withSpring`.**
- **Comments are rare.** Write code that doesn't need them.
- **`@/` maps to the project root** — `@/features/...`, `@/constants/...`.

## Structure

```
app/                    expo-router routes; (tabs)/ holds the four tabs
features/<domain>/      store + logic + components, colocated
modules/chrona-stream/  native Expo module — Bonjour, TCP, NDJSON, auth
widgets/                widgets and Live Activity, authored in TypeScript
ChronaHelper/           the macOS app (Swift)
lib/                    cross-feature Reanimated shared values
storage/index.ts        encrypted MMKV adapter for Zustand persist
constants/theme.ts      Colors, Semantic, TextAlpha, Neutral
```

Navigation: a single root `Stack` with `(tabs)` as its only screen. Four tab triggers —
Dashboard, Timeline, Stats, Search (icon-only, `role="search"`). `TimerBar` renders as
`NativeTabs.BottomAccessory` so it survives tab changes. Settings is **not** a tab; it's
pushed via `/settings` from the Dashboard's gear.

**A `features/<x>/` folder only holds what the `<x>` screen actually consumes.** If a
different tab uses it, move it to that tab's folder. Check consumers with grep before
assuming something belongs where it sits.

## Traps

- **Persisted stores write synchronously to disk.** `useTimerStore`, `useSessionsStore` and
  `useProjects` are `persist`-backed by MMKV, and every `set()` is a `JSON.stringify` plus a
  blocking write. Never wire `onChangeText` to one of their setters — that's a disk write per
  keystroke. Keep local state for the live value, write on blur or submit. Read with
  per-field selectors (`useTimerStore(s => s.title)`), never whole-object destructuring.
- **`react-native-worklets` is pinned** in both `dependencies` and `resolutions` to match
  what heroui-native was compiled against. Do not bump it independently. Dependabot ignores
  it deliberately.
- **Expo packages move as a set.** `bunx expo install --fix`, never one at a time.
- **App usage durations come from the Mac, not the phone.** `features/intelligence/usage-query.ts`
  queries the helper's on-disk ledger asynchronously. There is no on-device accumulator — the
  old `journal-store.ts` was deleted. Sessions carry an optional `apps?: AppUsage[]`, rendered
  in three places (`SessionRow`, `timeline/[id].tsx`, `DragOverlay`) that must stay in sync.
- **Screenshots need a Release build.** Debug builds render expo-dev-client's floating menu
  button, which lands in every capture. Timeline session rows expose no accessibility text,
  so Maestro must select them by position. The splash runs ~1.5s and the Dashboard fades in
  behind it, so flows wait on `TODAY` (the FocusRing label), not on the timer-bar text.

## Design

Calm, precise, minimal — like a high-end watch or a well-edited notebook. Dark-first, deep
near-blacks (`#18181b`, `#1a1a1c`) with the aurora shader as the expressive layer. Project
colors are vivid but used sparingly. Typography does the work: generous negative tracking on
large numbers, tight hierarchies.

Restraint is the feature. When in doubt, remove.

**Anti-references:** no playful/bubbly productivity energy, no gamification, no badges or
reward animations, no heavy gradients on text, no nagging notifications. Dynamic elements
(the aurora, the streak, timer-bar suggestions) are ambient feedback, not alerts.

Full context in [`.claude/conventions/design.md`](.claude/conventions/design.md).

## Don't

- Don't add tests during cleanup passes unless asked.
- Don't run `bun run web` — it hits a known unrelated crash.
- Don't reference Flipper; use React Native DevTools for profiling.
- Don't `git push`. A repo hook blocks it, and pushes are the maintainer's call.
