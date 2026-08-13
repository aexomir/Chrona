# Contributing to Chrona

Thanks for looking. Chrona is a personal project, so pull requests get read but not always
quickly — opening an issue before writing a large change will save you time.

## Before you start

Chrona is two programs that talk to each other:

- **The iOS app** — Expo SDK 57 / React Native 0.86 / React 19, in `app/`, `features/`,
  `components/`
- **Chrona Helper** — a Swift menu bar app in `ChronaHelper/`

They're joined by `modules/chrona-stream`, a native Expo module speaking newline-delimited
JSON over TCP. If your change crosses that boundary, read
[`ChronaHelper/README.md`](ChronaHelper/README.md) first — the protocol is versioned and
both sides have to agree.

## Setting up

```bash
git clone https://github.com/aexomir/Chrona.git
cd Chrona
bun install
cp .env.example .env
npx expo run:ios
```

**Expo Go will not work.** Native tabs, calendar access, widgets and `chrona-stream` all need
a custom dev build. The first `expo run:ios` runs `pod install` and compiles the whole native
project, so give it twenty minutes. After that `bun start` is enough, until you touch native
code.

For the Mac helper: open `ChronaHelper/ChronaHelper.xcodeproj`, set your Team under Signing &
Capabilities, ⌘R. It needs Accessibility permission to read window titles.

Full detail, including common build failures, is on the
[Building from Source](https://github.com/aexomir/Chrona/wiki/Building-from-Source) wiki page.

## Before you open a PR

```bash
bunx tsc --noEmit
bun run lint
bun test
```

CI runs all three. Lint currently has five pre-existing warnings — don't add more.

For anything touching the timer, timeline or auto-tracking, run the end-to-end flows too:

```bash
maestro test .maestro/timer_new_session_flow.yaml
maestro test .maestro/timer_stop_flow.yaml
```

## Conventions

These are the things that actually get changes sent back. They're enforced by convention,
not by lint, so please read them.

- **Styling is `className`** (Tailwind via uniwind). No `StyleSheet.create`, no inline
  `style` props — the narrow exceptions are `expo-image` and genuinely dynamic values.
- **No hand-written `useMemo` / `useCallback`.** React Compiler is on; adding them by hand
  fights it.
- **`process.env.EXPO_OS`**, not `Platform.OS`.
- **`React.use()`**, not `React.useContext()`.
- **`ScrollView` with `contentInsetAdjustmentBehavior="automatic"`**, not `SafeAreaView`.
- **SF Symbols via `expo-image`** with `source="sf:name"` — not `expo-symbols` or a vector
  icon library.
- **heroui-native first.** Check whether the component library already has it before building
  a custom component.
- **Comments are rare.** Write code that doesn't need them; save comments for the genuinely
  non-obvious.
- **A `features/<x>/` folder only holds what the `<x>` screen uses.** If a different tab
  consumes it, it belongs in that tab's folder.
- **Persisted stores are synchronous MMKV writes.** Never wire `onChangeText` directly to a
  setter on `useTimerStore` / `useSessionsStore` / `useProjects` — that's a disk write per
  keystroke. Keep local state for the live value and write on blur. Read with per-field
  selectors, not whole-object destructuring.

The full set lives in [`AGENTS.md`](AGENTS.md), which is also what AI coding tools read.

### One dependency needs care

`react-native-worklets` is pinned in both `dependencies` and `resolutions` to match the
version heroui-native was compiled against. Bumping it on its own breaks the build.
Dependabot is configured to leave it alone; please do the same unless you're deliberately
upgrading heroui-native at the same time.

Expo packages move as a set — use `bunx expo install --fix`, never one at a time.

## Design

Chrona is deliberately calm, precise and minimal. It is not a gamified productivity app.
Proposals adding badges, reward animations, nagging notifications, or social features are
unlikely to land. The reasoning is in [`.claude/conventions/design.md`](.claude/conventions/design.md).

## Commits and PRs

Conventional-ish prefixes (`feat:`, `fix:`, `chore:`, `docs:`) — the changelog is assembled
by hand, so exact format matters less than a readable subject line.

The PR template asks how you verified the change. Please answer it with what you actually
ran, not what you meant to run. Screenshots are required for UI changes.

## Reporting bugs

Use the [issue forms](https://github.com/aexomir/Chrona/issues/new/choose). If the Mac helper
won't connect, use the dedicated form — it asks for the readings from the app's debug panel
(Settings → tap "Chrona" at the bottom five times), which is what makes it diagnosable.

Security vulnerabilities go through
[private reporting](https://github.com/aexomir/Chrona/security/advisories/new), not public
issues. See [`SECURITY.md`](SECURITY.md).
