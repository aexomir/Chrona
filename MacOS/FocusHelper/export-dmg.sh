#!/bin/bash

# ChronaHelper Export to DMG Script
# This script performs a clean build and exports the app as a DMG file
# Usage: ./export-dmg.sh

set -e

echo "🔨 ChronaHelper DMG Export Script"
echo "=================================="

# Configuration
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_FILE="ChronaHelper.xcodeproj"
SCHEME="ChronaHelper"
CONFIG="Release"
APP_NAME="ChronaHelper"
OUTPUT_DIR="/Users/aexomir/Desktop/Focus/MacOS"
OUTPUT_DMG="$OUTPUT_DIR/$APP_NAME.dmg"

# Derived data location (update if your path differs)
DERIVED_DATA_PATH="$HOME/Library/Developer/Xcode/DerivedData"
BUILD_PRODUCT_PATH="$DERIVED_DATA_PATH/ChronaHelper-eiydwhqjiufnsnccwwtigghdltlz/Build/Products/$CONFIG/$APP_NAME.app"

echo ""
echo "📁 Project directory: $PROJECT_DIR"
echo "🎯 Output: $OUTPUT_DMG"
echo ""

# Step 1: Remove previous DMG
echo "🗑️  Removing previous DMG..."
if [ -f "$OUTPUT_DMG" ]; then
  rm -f "$OUTPUT_DMG"
  echo "   ✓ Removed old DMG"
else
  echo "   ℹ️  No previous DMG found"
fi

# Step 2: Clean Xcode build
echo ""
echo "🧹 Cleaning previous build..."
xcodebuild clean \
  -project "$PROJECT_FILE" \
  -scheme "$SCHEME" \
  -configuration "$CONFIG" > /dev/null 2>&1
echo "   ✓ Build cleaned"

# Step 3: Build the app
echo ""
echo "🏗️  Building app (Release)..."
xcodebuild build \
  -project "$PROJECT_FILE" \
  -scheme "$SCHEME" \
  -configuration "$CONFIG"

if [ $? -ne 0 ]; then
  echo ""
  echo "❌ Build failed!"
  exit 1
fi
echo "   ✓ Build succeeded"

# Step 4: Verify app exists
echo ""
echo "🔍 Locating built app..."
if [ ! -d "$BUILD_PRODUCT_PATH" ]; then
  echo "❌ Error: App not found at $BUILD_PRODUCT_PATH"
  exit 1
fi
echo "   ✓ App found"

# Step 5: Create DMG
echo ""
echo "📦 Creating DMG..."
TEMP_DMG_DIR="/tmp/ChronaHelper_DMG_$$"
mkdir -p "$TEMP_DMG_DIR"

# Copy app to temp directory
cp -r "$BUILD_PRODUCT_PATH" "$TEMP_DMG_DIR/"

# Create compressed DMG
hdiutil create \
  -volname "$APP_NAME" \
  -srcfolder "$TEMP_DMG_DIR" \
  -ov \
  -format UDZO \
  "$OUTPUT_DMG" > /dev/null 2>&1

# Cleanup temp directory
rm -rf "$TEMP_DMG_DIR"

echo "   ✓ DMG created"

# Step 6: Verify DMG
echo ""
echo "✅ Export complete!"
ls -lh "$OUTPUT_DMG"
echo ""
echo "📍 DMG location: $OUTPUT_DMG"
echo ""
