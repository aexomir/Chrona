#!/usr/bin/env bash
set -euo pipefail

SCHEME="ChronaHelper"
PROJECT="ChronaHelper.xcodeproj"
CONFIGURATION="Release"

cd "$(dirname "$0")/.."
BUILD_DIR="$(pwd)/build"

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

bash "$(dirname "$0")/make_dmg.sh" "$APP_PATH"
