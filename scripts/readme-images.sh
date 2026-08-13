#!/usr/bin/env bash
#
# Turns the raw fastlane/Maestro screenshot output into the images the README
# uses: six optimised inline captures and one composed hero.
#
# Run `bun run screenshots:ios` first. Output goes to docs/screenshots/.
#
# Requires ImageMagick 7 (`brew install imagemagick`).

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$ROOT/fastlane/screenshots/ios/screenshots"
OUT="$ROOT/docs/screenshots"

INLINE_WIDTH=540
CANVAS_W=2400
CANVAS_H=1200
BG="#18181b"
GLOW="#4c3a8f"

SHOTS=(dashboard timer timeline session-detail stats search)

for name in "${SHOTS[@]}"; do
  if [[ ! -f "$SRC/$name.png" ]]; then
    echo "missing: $SRC/$name.png" >&2
    echo "run 'bun run screenshots:ios' first" >&2
    exit 1
  fi
done

mkdir -p "$OUT"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "→ inline captures"
for name in "${SHOTS[@]}"; do
  magick "$SRC/$name.png" \
    -resize "${INLINE_WIDTH}x" \
    -strip -quality 82 -define webp:method=6 \
    "$OUT/$name.webp"
  printf '  %-16s %s\n' "$name.webp" "$(magick identify -format '%wx%h %b' "$OUT/$name.webp")"
done

echo "→ hero"
LEFT="$SRC/timeline_framed.png"
CENTER="$SRC/dashboard_framed.png"
RIGHT="$SRC/stats_framed.png"

for f in "$LEFT" "$CENTER" "$RIGHT"; do
  if [[ ! -f "$f" ]]; then
    echo "missing framed image: $f" >&2
    echo "frameit did not run — check the fastlane output" >&2
    exit 1
  fi
done

magick -size "${CANVAS_W}x${CANVAS_H}" "xc:$BG" \
  \( -size "${CANVAS_W}x${CANVAS_H}" xc:none \
     -fill "$GLOW" -draw "ellipse 1200,1250 900,520 0,360" \
     -blur 0x120 \) \
  -compose over -composite \
  "$TMP/bg.png"

phone() {
  magick "$1" -resize "x$2" \
    \( +clone -background black -shadow 55x30+0+18 \) \
    +swap -background none -layers merge +repage \
    "$3"
}

phone "$LEFT" 860 "$TMP/left.png"
phone "$RIGHT" 860 "$TMP/right.png"
phone "$CENTER" 1010 "$TMP/center.png"

magick "$TMP/bg.png" \
  "$TMP/left.png" -geometry +540+250 -compose over -composite \
  "$TMP/right.png" -geometry +1400+250 -compose over -composite \
  "$TMP/center.png" -geometry +945+120 -compose over -composite \
  -strip -quality 88 -define webp:method=6 \
  "$OUT/hero.webp"

printf '  %-16s %s\n' "hero.webp" "$(magick identify -format '%wx%h %b' "$OUT/hero.webp")"
