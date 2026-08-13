## What changed

<!-- One or two sentences. What does this do, and why? -->

## How it was verified

<!--
Say what you actually ran, not what you intended to run. For example:
- Built with `npx expo run:ios` and started a timer end to end
- Paired with the Mac helper and confirmed the app breakdown appeared
- Added a case to features/auto-track/__tests__/matcher.test.ts
-->

## Screenshots

<!-- Required for anything that changes the UI. Before and after if you're modifying something. -->

## Checklist

- [ ] `bunx tsc --noEmit` passes
- [ ] `bun run lint` introduces no new warnings
- [ ] `bun test` passes
- [ ] Styling uses `className`, not `StyleSheet.create`
- [ ] No hand-written `useMemo` / `useCallback` (React Compiler handles it)
- [ ] Docs updated if behaviour changed — README, `ChronaHelper/README.md`, or the wiki
- [ ] `react-native-worklets` is untouched, or the heroui-native pin was checked first
