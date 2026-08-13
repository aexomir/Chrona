
---

## Downloads

**`ChronaHelper-<version>.dmg`** — the macOS menu bar companion.

This build is unsigned, so macOS will refuse to open it the first time. Right-click the app
→ **Open** → **Open**. You only have to do this once. On first launch it will ask for
Accessibility (to read window titles) and Local Network (so your phone can find it).

**`Chrona-Simulator-<version>.app.zip`** — the iOS app, for the Simulator only.

```bash
unzip Chrona-Simulator-<version>.app.zip
xcrun simctl boot "iPhone 17 Pro"
xcrun simctl install booted Chrona.app
xcrun simctl launch booted com.aexomir.Chrona
```

This **cannot** be installed on a physical iPhone. Apple requires an app to be signed with a
provisioning profile tied to your own Apple ID and your device's UDID, which no downloadable
build can provide. To run Chrona on your actual phone, build it yourself — it takes about
twenty minutes and the steps are in the
[README](https://github.com/aexomir/Chrona#getting-started).

Full setup, including pairing the two halves, is in the
[wiki](https://github.com/aexomir/Chrona/wiki).
