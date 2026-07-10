#!/usr/bin/env bash
set -euo pipefail

APP_PATH="$1"
SCHEME="ChronaHelper"
BUILD_DIR="$(pwd)/build"
DMG_PATH="$BUILD_DIR/$SCHEME.dmg"
STAGING_DMG="$BUILD_DIR/staging.dmg"
VOLUME_NAME="$SCHEME"
VOLUME_PATH="/Volumes/$VOLUME_NAME"

cd "$(dirname "$0")/.."

# --- Background ---
echo "→ Generating background..."
python3 scripts/create_background.py

# --- Icon ---
ICON_SRC="assets/AppIcon.png"
ICON_OUT="$BUILD_DIR/AppIcon.icns"
if [[ -f "$ICON_SRC" ]]; then
  echo "→ Converting icon..."
  bash scripts/convert_icon.sh "$ICON_SRC" "$ICON_OUT"
  mkdir -p "$APP_PATH/Contents/Resources"
  cp "$ICON_OUT" "$APP_PATH/Contents/Resources/AppIcon.icns"
  if ! /usr/libexec/PlistBuddy -c "Print :CFBundleIconFile" "$APP_PATH/Contents/Info.plist" &>/dev/null; then
    /usr/libexec/PlistBuddy -c "Add :CFBundleIconFile string AppIcon" "$APP_PATH/Contents/Info.plist"
  fi
  touch "$APP_PATH"
else
  echo "⚠  assets/AppIcon.png not found — using default icon"
fi

# --- Staging DMG ---
[[ -f "$STAGING_DMG" ]] && rm "$STAGING_DMG"
[[ -f "$DMG_PATH" ]] && rm "$DMG_PATH"

if [[ -d "$VOLUME_PATH" ]]; then
  hdiutil detach "$VOLUME_PATH" -quiet -force 2>/dev/null || true
fi

APP_SIZE_MB=$(du -sm "$APP_PATH" | awk '{print $1}')
DMG_SIZE_MB=$((APP_SIZE_MB + 50))

echo "→ Creating staging DMG (${DMG_SIZE_MB}MB)..."
hdiutil create \
  -megabytes "$DMG_SIZE_MB" \
  -volname "$VOLUME_NAME" \
  -fs "HFS+" \
  "$STAGING_DMG"

VOLUME_PATH="$(hdiutil attach "$STAGING_DMG" \
  -noautoopen \
  -nobrowse \
  -noverify \
  | grep "Apple_HFS" | awk '{print $NF}')"

echo "→ Mounted at $VOLUME_PATH"

sleep 1

# --- Populate volume ---
cp -R "$APP_PATH" "$VOLUME_PATH/"
ln -sf /Applications "$VOLUME_PATH/Applications"
mkdir -p "$VOLUME_PATH/.background"
cp "build/dmg_background.gif" "$VOLUME_PATH/.background/bg.gif"

# --- Configure Finder window ---
echo "→ Configuring Finder window..."
osascript <<APPLESCRIPT
tell application "Finder"
  tell disk "$VOLUME_NAME"
    open
    set current view of container window to icon view
    set toolbar visible of container window to false
    set statusbar visible of container window to false
    set the bounds of container window to {200, 100, 1000, 600}
    set theViewOptions to the icon view options of container window
    set arrangement of theViewOptions to not arranged
    set icon size of theViewOptions to 128
    set background picture of theViewOptions to POSIX file "$VOLUME_PATH/.background/bg.gif"
    delay 1
    set position of item "$SCHEME.app" of container window to {200, 190}
    set position of item "Applications" of container window to {600, 190}
    update without registering applications
    delay 3
    close
  end tell
end tell
APPLESCRIPT

sleep 1
chmod -Rf go-w "$VOLUME_PATH" 2>/dev/null || true
sync

hdiutil detach "$VOLUME_PATH" -quiet

# --- Final compressed DMG ---
echo "→ Compressing DMG..."
hdiutil convert "$STAGING_DMG" \
  -format UDZO \
  -imagekey zlib-level=9 \
  -o "$DMG_PATH"

rm "$STAGING_DMG"
echo "✓ Done: $DMG_PATH"
