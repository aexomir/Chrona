#!/usr/bin/env python3
"""
DMG background generator for ChronaHelper.
Outputs a 1320×800 px image (2x retina for a 660×400 pt Finder window).

Usage: python3 dmg-background.py <output.png>
"""

import sys, math, struct, zlib

OUTPUT = sys.argv[1] if len(sys.argv) > 1 else "dmg-background.png"

# Canvas: 2x retina — represents a 660×400 pt Finder window
W, H = 1320, 800

# Icon centers in pixel space (2× of AppleScript point positions)
APP_X,  APP_Y  = 320,  370   # 2× of (160, 185)
APPS_X, APPS_Y = 1000, 370   # 2× of (500, 185)


# ── Fallback: pure-stdlib solid PNG ──────────────────────────────────────────

def _solid_png(path, w, h, r, g, b):
    def chunk(t, d):
        c = t + d
        return struct.pack(">I", len(d)) + c + struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF)
    ihdr = struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)
    compressed = zlib.compress((b"\x00" + bytes([r, g, b] * w)) * h, 9)
    with open(path, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n"
                + chunk(b"IHDR", ihdr)
                + chunk(b"IDAT", compressed)
                + chunk(b"IEND", b""))


# ── Bezier helpers ────────────────────────────────────────────────────────────

def cubic_bezier(p0, p1, p2, p3, n=300):
    pts = []
    for i in range(n + 1):
        t = i / n; u = 1 - t
        x = u**3*p0[0] + 3*u**2*t*p1[0] + 3*u*t**2*p2[0] + t**3*p3[0]
        y = u**3*p0[1] + 3*u**2*t*p1[1] + 3*u*t**2*p2[1] + t**3*p3[1]
        pts.append((x, y))
    return pts

def tangent_at_end(p2, p3):
    dx, dy = p3[0] - p2[0], p3[1] - p2[1]
    mag = math.sqrt(dx*dx + dy*dy)
    return dx/mag, dy/mag


# ── Styled background (requires Pillow) ───────────────────────────────────────

try:
    from PIL import Image, ImageDraw, ImageFilter

    canvas = Image.new("RGBA", (W, H), (12, 12, 16, 255))

    # ── Radial center-light (dark edges, lighter middle) ──────────────────────
    center = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(center).ellipse(
        [W//2 - 500, H//2 - 340, W//2 + 500, H//2 + 340],
        fill=(28, 28, 38, 255)
    )
    center = center.filter(ImageFilter.GaussianBlur(180))
    canvas = Image.alpha_composite(canvas, center)

    # ── Ambient glow under each icon position ─────────────────────────────────
    def icon_glow(base, cx, cy, rgb, alpha=80, blur=130):
        g = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ImageDraw.Draw(g).ellipse([cx-90, cy-90, cx+90, cy+90], fill=(*rgb, alpha))
        return Image.alpha_composite(base, g.filter(ImageFilter.GaussianBlur(blur)))

    canvas = icon_glow(canvas, APP_X,  APP_Y,  (180, 185, 215), alpha=80)
    canvas = icon_glow(canvas, APPS_X, APPS_Y, (160, 175, 215), alpha=60)

    # ── Curved arrow ──────────────────────────────────────────────────────────
    HALF_ICON = 128   # half of 256px (2× icon size)
    GAP = 48

    P0 = (APP_X  + HALF_ICON + GAP,  APP_Y)
    P3 = (APPS_X - HALF_ICON - GAP,  APPS_Y)
    span = P3[0] - P0[0]
    arch = 54          # peak height above the center line

    P1 = (P0[0] + span * 0.30, P0[1] - arch)
    P2 = (P0[0] + span * 0.70, P0[1] - arch)

    pts = cubic_bezier(P0, P1, P2, P3)
    tx, ty = tangent_at_end(P2, P3)
    nx, ny = -ty, tx

    n = len(pts)

    # Ghost / motion-trail  (blurred, shifted left along x)
    trail = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    td = ImageDraw.Draw(trail)
    for shift, alpha_max in [(60, 70), (120, 38), (190, 18)]:
        ghost = [(x - shift, y) for x, y in pts]
        for i in range(n - 1):
            env = math.sin(math.pi * i / n)
            a = int(alpha_max * env)
            td.line([ghost[i], ghost[i+1]], fill=(130, 135, 165, a), width=4)
    trail = trail.filter(ImageFilter.GaussianBlur(4))
    canvas = Image.alpha_composite(canvas, trail)

    # Main curve — gradient (dim start → bright centre → dim end)
    arrow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ad = ImageDraw.Draw(arrow)
    SEGS = 30
    for s in range(SEGS):
        i0 = int(s       * n / SEGS)
        i1 = int((s + 1) * n / SEGS)
        t_mid = (s + 0.5) / SEGS
        bright = 0.35 + 0.60 * math.sin(math.pi * t_mid)
        r_v = int(80  + 110 * bright)
        g_v = int(82  + 108 * bright)
        b_v = int(100 + 110 * bright)
        ad.line(pts[i0:i1+1], fill=(r_v, g_v, b_v, 230), width=5)

    # Glow pass — blurred copy composited beneath
    canvas = Image.alpha_composite(canvas, arrow.filter(ImageFilter.GaussianBlur(7)))
    canvas = Image.alpha_composite(canvas, arrow.filter(ImageFilter.GaussianBlur(2)))
    canvas = Image.alpha_composite(canvas, arrow)   # crisp top

    draw = ImageDraw.Draw(canvas)

    # Arrowhead — follows the curve tangent
    HL, HW = 30, 17
    tip = P3
    b1  = (P3[0] - tx*HL + nx*HW, P3[1] - ty*HL + ny*HW)
    b2  = (P3[0] - tx*HL - nx*HW, P3[1] - ty*HL - ny*HW)
    draw.polygon([tip, b1, b2], fill=(190, 192, 218, 240))

    # Origin dot
    draw.ellipse([P0[0]-6, P0[1]-6, P0[0]+6, P0[1]+6], fill=(120, 122, 150, 180))

    # ── Save at 144 dpi so macOS treats it as @2x ─────────────────────────────
    canvas.convert("RGB").save(OUTPUT, "PNG", dpi=(144, 144))
    print(f"[dmg-bg] @2x background → {OUTPUT}")

except ImportError:
    _solid_png(OUTPUT, W, H, 11, 11, 14)
    print(f"[dmg-bg] Fallback background (install Pillow for styled) → {OUTPUT}")
