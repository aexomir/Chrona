#!/bin/bash
#
# ChronaHelper — DMG Export Script
#
# Produces a styled installer DMG:
#   • Generates correct macOS app icons from assets/images/icon.png
#   • Dark @2x background with curved animated-style arrow
#   • App icon left  →  Applications folder right
#
# Usage: ./export-dmg.sh

set -e

echo "🔨 ChronaHelper DMG Export"
echo "=========================="

# ── Config ────────────────────────────────────────────────────────────────────
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$PROJECT_DIR/../.." && pwd)"
PROJECT_FILE="ChronaHelper.xcodeproj"
SCHEME="ChronaHelper"
CONFIG="Release"
APP_NAME="ChronaHelper"
OUTPUT_DMG="$REPO_ROOT/MacOS/$APP_NAME.dmg"
SOURCE_ICON="$REPO_ROOT/assets/images/icon.png"
ICONSET_DIR="$PROJECT_DIR/Sources/Assets.xcassets/AppIcon.appiconset"
DERIVED_DATA="$HOME/Library/Developer/Xcode/DerivedData"

echo "  Project : $PROJECT_DIR"
echo "  Output  : $OUTPUT_DMG"
echo ""

# ── 1. Generate app icons from source icon ────────────────────────────────────
echo "▸ Generating app icons..."

python3 - "$SOURCE_ICON" "$ICONSET_DIR" <<'PYEOF'
import sys, os, json
from PIL import Image

src_path, dest_dir = sys.argv[1], sys.argv[2]
os.makedirs(dest_dir, exist_ok=True)

# Source is 1536×1024 (landscape) — center-crop to square
src = Image.open(src_path).convert("RGBA")
size = min(src.width, src.height)
left = (src.width  - size) // 2
top  = (src.height - size) // 2
square = src.crop((left, top, left + size, top + size))

# Generate each required size
SIZES = [16, 32, 64, 128, 256, 512, 1024]
for s in SIZES:
    square.resize((s, s), Image.LANCZOS).save(os.path.join(dest_dir, f"{s}.png"))
    print(f"  icon {s}×{s}")

# Write Contents.json (required by Xcode to use the icons)
contents = {
    "images": [
        {"filename": "16.png",   "idiom": "mac", "scale": "1x", "size": "16x16"},
        {"filename": "32.png",   "idiom": "mac", "scale": "2x", "size": "16x16"},
        {"filename": "32.png",   "idiom": "mac", "scale": "1x", "size": "32x32"},
        {"filename": "64.png",   "idiom": "mac", "scale": "2x", "size": "32x32"},
        {"filename": "128.png",  "idiom": "mac", "scale": "1x", "size": "128x128"},
        {"filename": "256.png",  "idiom": "mac", "scale": "2x", "size": "128x128"},
        {"filename": "256.png",  "idiom": "mac", "scale": "1x", "size": "256x256"},
        {"filename": "512.png",  "idiom": "mac", "scale": "2x", "size": "256x256"},
        {"filename": "512.png",  "idiom": "mac", "scale": "1x", "size": "512x512"},
        {"filename": "1024.png", "idiom": "mac", "scale": "2x", "size": "512x512"},
    ],
    "info": {"author": "xcode", "version": 1},
}
json.dump(contents, open(os.path.join(dest_dir, "Contents.json"), "w"), indent=2)
print("  Contents.json written")
PYEOF

echo "  ✓ Icons ready"

# ── 2. Clean ──────────────────────────────────────────────────────────────────
echo ""
echo "▸ Cleaning build..."
xcodebuild clean -project "$PROJECT_FILE" -scheme "$SCHEME" -configuration "$CONFIG" > /dev/null 2>&1
echo "  ✓ Cleaned"

# ── 3. Build ──────────────────────────────────────────────────────────────────
echo ""
echo "▸ Building ($CONFIG)..."
xcodebuild build -project "$PROJECT_FILE" -scheme "$SCHEME" -configuration "$CONFIG"
echo "  ✓ Build succeeded"

# ── 4. Locate built app ───────────────────────────────────────────────────────
echo ""
echo "▸ Locating built app..."
HARDCODED="$DERIVED_DATA/ChronaHelper-eiydwhqjiufnsnccwwtigghdltlz/Build/Products/$CONFIG/$APP_NAME.app"
if [ -d "$HARDCODED" ]; then
  BUILD_APP="$HARDCODED"
else
  BUILD_APP=$(find "$DERIVED_DATA" -name "$APP_NAME.app" -path "*/$CONFIG/*" 2>/dev/null | head -1)
fi
[ -z "$BUILD_APP" ] && echo "  ✗ App not found in DerivedData" && exit 1
echo "  ✓ $BUILD_APP"

# ── 5. Remove old DMG ─────────────────────────────────────────────────────────
echo ""
echo "▸ Removing old DMG..."
[ -f "$OUTPUT_DMG" ] && rm -f "$OUTPUT_DMG" && echo "  ✓ Removed" || echo "  — None found"

# ── 6. Stage DMG contents ─────────────────────────────────────────────────────
echo ""
echo "▸ Staging..."
STAGING="$(mktemp -d /tmp/ChronaHelper_stage_XXXXXX)"
trap "rm -rf '$STAGING'" EXIT

cp -r "$BUILD_APP" "$STAGING/"
ln -s /Applications "$STAGING/Applications"
mkdir -p "$STAGING/.background"

python3 "$PROJECT_DIR/dmg-background.py" "$STAGING/.background/background.png"
echo "  ✓ Staged"

# ── 7. Create writable DMG ────────────────────────────────────────────────────
echo ""
echo "▸ Creating writable DMG..."
TEMP_DMG="$(mktemp /tmp/ChronaHelper_rw_XXXXXX).dmg"
hdiutil create \
  -srcfolder "$STAGING" \
  -volname   "$APP_NAME" \
  -fs HFS+ -fsargs "-c c=64,a=16,b=16" \
  -format UDRW \
  "$TEMP_DMG" > /dev/null
echo "  ✓ Created"

# ── 8. Mount ──────────────────────────────────────────────────────────────────
echo ""
echo "▸ Mounting..."
hdiutil detach "/Volumes/$APP_NAME" 2>/dev/null || true
MOUNT_OUT=$(hdiutil attach "$TEMP_DMG" -readwrite -noverify -noautoopen)
DEVICE=$(echo "$MOUNT_OUT" | awk 'END{print $1}')
echo "  ✓ /Volumes/$APP_NAME  ($DEVICE)"
sleep 3

# ── 9. Configure Finder window via AppleScript ───────────────────────────────
echo ""
echo "▸ Configuring installer window..."
osascript <<APPLESCRIPT
tell application "Finder"
  tell disk "$APP_NAME"
    open
    set current view of container window to icon view
    set toolbar visible of container window to false
    set statusbar visible of container window to false
    set the bounds of container window to {400, 100, 1060, 500}
    set viewOptions to the icon view options of container window
    set arrangement of viewOptions to not arranged
    set icon size of viewOptions to 128
    set background picture of viewOptions to file ".background:background.png"
    set position of item "$APP_NAME.app" of container window to {160, 185}
    set position of item "Applications" of container window to {500, 185}
    close
    open
    update without registering applications
    delay 2
    close
  end tell
end tell
APPLESCRIPT
echo "  ✓ Window configured"

chflags hidden "/Volumes/$APP_NAME/.background" 2>/dev/null || true
sync && sleep 1

# ── 10. Unmount + convert ─────────────────────────────────────────────────────
echo ""
echo "▸ Unmounting..."
hdiutil detach "$DEVICE" > /dev/null
echo "  ✓ Unmounted"

echo ""
echo "▸ Converting to compressed DMG..."
hdiutil convert "$TEMP_DMG" -format UDZO -imagekey zlib-level=9 -o "$OUTPUT_DMG" > /dev/null
rm -f "$TEMP_DMG"
echo "  ✓ Done"

echo ""
echo "✅ Export complete!"
echo ""
ls -lh "$OUTPUT_DMG"
echo ""
echo "  📦 $OUTPUT_DMG"
echo ""
