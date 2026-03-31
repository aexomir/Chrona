#!/usr/bin/env python3
from PIL import Image, ImageDraw, ImageFilter, ImageFont
import os

W, H = 800, 500
BG = (24, 24, 27)

FONT_PATHS = [
    "/System/Library/Fonts/SFNS.ttf",
    "/System/Library/Fonts/SFNSRounded.ttf",
    "/System/Library/Fonts/HelveticaNeue.ttc",
    "/System/Library/Fonts/Helvetica.ttc",
]

DOT_Y = 192
DOT_XS = [340, 400, 460]
DOT_DIM = (63, 63, 70)
DOT_BRIGHT = (228, 228, 231)
DOT_R = 4

PATTERNS = [
    (1.0, 0.15, 0.15),
    (0.5, 0.75, 0.15),
    (0.15, 1.0, 0.15),
    (0.15, 0.5, 0.75),
    (0.15, 0.15, 1.0),
    (0.15, 0.15, 0.4),
    (0.15, 0.15, 0.15),
    (0.15, 0.15, 0.15),
    (0.4, 0.15, 0.15),
]


def load_font(size):
    for p in FONT_PATHS:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                continue
    return ImageFont.load_default()


def lerp_color(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def make_base():
    img = Image.new("RGBA", (W, H), (*BG, 255))

    bloom = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(bloom).ellipse([200, 80, 600, 420], fill=(55, 45, 85, 45))
    img = Image.alpha_composite(img, bloom.filter(ImageFilter.GaussianBlur(95)))

    for cx in (200, 600):
        halo = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ImageDraw.Draw(halo).ellipse([cx - 80, 120, cx + 80, 270], fill=(46, 45, 52, 50))
        img = Image.alpha_composite(img, halo.filter(ImageFilter.GaussianBlur(32)))

    return img


def make_frame(base, pattern, font_label, font_tag):
    img = base.copy()

    for x, brightness in zip(DOT_XS, pattern):
        color = lerp_color(DOT_DIM, DOT_BRIGHT, brightness)
        if brightness > 0.25:
            glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
            r = int(DOT_R * 4.5)
            ImageDraw.Draw(glow).ellipse(
                [x - r, DOT_Y - r, x + r, DOT_Y + r],
                fill=(*color, int(35 * brightness)),
            )
            img = Image.alpha_composite(img, glow.filter(ImageFilter.GaussianBlur(9)))

        draw = ImageDraw.Draw(img)
        draw.ellipse([x - DOT_R, DOT_Y - DOT_R, x + DOT_R, DOT_Y + DOT_R], fill=(*color, 255))

    draw = ImageDraw.Draw(img)

    chev_x, chev_y = 487, DOT_Y
    chev_color = (63, 63, 70, 255)
    draw.polygon(
        [(chev_x - 4, chev_y - 5), (chev_x + 2, chev_y), (chev_x - 4, chev_y + 5)],
        fill=chev_color,
    )

    draw.text((W // 2, 418), "Drag Chrona to Applications", fill=(113, 113, 122), font=font_label, anchor="mm")
    draw.text((W // 2, 445), "Track time intentionally.", fill=(82, 82, 91), font=font_tag, anchor="mm")

    return img.convert("RGB")


def main():
    os.makedirs("build", exist_ok=True)

    font_label = load_font(14)
    font_tag = load_font(12)
    base = make_base()
    frames = [make_frame(base, p, font_label, font_tag) for p in PATTERNS]

    out = "build/dmg_background.gif"
    frames[0].save(
        out,
        save_all=True,
        append_images=frames[1:],
        loop=0,
        duration=150,
        optimize=False,
        disposal=2,
    )
    print(f"✓ Background: {out}")


if __name__ == "__main__":
    main()
