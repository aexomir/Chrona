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

`react-native-worklets` is pinned to a fixed version in both `dependencies` and `resolutions` to match the version heroui-native was compiled against. Do not bump this independently of heroui-native's internal worklets version — check `package.json` for the current pinned version before changing it.

### React Compiler

`reactCompiler: true` is enabled in `app.json`. Avoid manual `useMemo`/`useCallback` — the compiler handles memoization automatically.
