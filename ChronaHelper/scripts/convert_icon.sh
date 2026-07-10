#!/usr/bin/env bash
set -euo pipefail

ICON_SRC="$1"
ICON_OUT="$2"

WORK_DIR="$(mktemp -d)"
ICONSET_DIR="$WORK_DIR/AppIcon.iconset"
mkdir "$ICONSET_DIR"

sips -z 16   16   "$ICON_SRC" --out "$ICONSET_DIR/icon_16x16.png"      2>/dev/null
sips -z 32   32   "$ICON_SRC" --out "$ICONSET_DIR/icon_16x16@2x.png"  2>/dev/null
sips -z 32   32   "$ICON_SRC" --out "$ICONSET_DIR/icon_32x32.png"      2>/dev/null
sips -z 64   64   "$ICON_SRC" --out "$ICONSET_DIR/icon_32x32@2x.png"  2>/dev/null
sips -z 128  128  "$ICON_SRC" --out "$ICONSET_DIR/icon_128x128.png"    2>/dev/null
sips -z 256  256  "$ICON_SRC" --out "$ICONSET_DIR/icon_128x128@2x.png" 2>/dev/null
sips -z 256  256  "$ICON_SRC" --out "$ICONSET_DIR/icon_256x256.png"    2>/dev/null
sips -z 512  512  "$ICON_SRC" --out "$ICONSET_DIR/icon_256x256@2x.png" 2>/dev/null
sips -z 512  512  "$ICON_SRC" --out "$ICONSET_DIR/icon_512x512.png"    2>/dev/null
cp "$ICON_SRC"        "$ICONSET_DIR/icon_512x512@2x.png"

iconutil -c icns "$ICONSET_DIR" -o "$ICON_OUT"
rm -rf "$WORK_DIR"

echo "✓ Icon: $ICON_OUT"
