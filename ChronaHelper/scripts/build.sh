#!/usr/bin/env bash
set -euo pipefail

SCHEME="ChronaHelper"
PROJECT="ChronaHelper.xcodeproj"
CONFIGURATION="Release"
BUILD_DIR="$(pwd)/build"
DMG_PATH="$BUILD_DIR/$SCHEME.dmg"

cd "$(dirname "$0")/.."

mkdir -p "$BUILD_DIR"

PRETTY=""
if command -v xcpretty &>/dev/null; then
  PRETTY="xcpretty"
fi

run_xcode() {
  if [[ -n "$PRETTY" ]]; then
    "$@" | $PRETTY
  else
    "$@"
  fi
}

echo "→ Cleaning..."
run_xcode xcodebuild clean \
  -project "$PROJECT" \
  -scheme "$SCHEME" \
  -configuration "$CONFIGURATION"

echo "→ Building..."
run_xcode xcodebuild build \
  -project "$PROJECT" \
  -scheme "$SCHEME" \
  -configuration "$CONFIGURATION" \
  -derivedDataPath "$BUILD_DIR/DerivedData" \
  CODE_SIGN_IDENTITY="-" \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGNING_ALLOWED=NO

APP_PATH=$(find "$BUILD_DIR/DerivedData" -name "$SCHEME.app" -maxdepth 6 | head -1)
if [[ -z "$APP_PATH" ]]; then
  echo "✗ No .app found after build" >&2
  exit 1
fi

echo "→ Creating DMG..."
if [[ -f "$DMG_PATH" ]]; then
  rm "$DMG_PATH"
fi

hdiutil create \
  -volname "$SCHEME" \
  -srcfolder "$APP_PATH" \
  -ov \
  -format UDZO \
  "$DMG_PATH"

echo "✓ Done: $DMG_PATH"
