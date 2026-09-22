"""Generate the app icon set in assets/images from one vector-ish description.

The mark is a health-screening form (phiếu sơ tuyển) with a heartbeat line: the
clipboard says "phiếu", the pulse says "khám sức khỏe". Colours come from the app
theme (src/theme/index.ts): primary #2D5F3A on a darker green field.

Deliberately no red cross (protected emblem), no state emblem and no military
insignia — the app is not an official publication of any authority.

Usage:  python scripts/gen-app-icon.py      (needs Pillow: pip install pillow)
"""

from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "assets" / "images"

GREEN = (45, 95, 58, 255)  # #2D5F3A  theme primary
GREEN_TOP = (54, 112, 70, 255)  # gradient top
GREEN_BOTTOM = (27, 63, 37, 255)  # gradient bottom
WHITE = (255, 255, 255, 255)
PAPER_LINE = (176, 203, 183, 255)  # pale green "form field" bars

SS = 4  # supersampling factor


def gradient(size: int) -> Image.Image:
    """Vertical green field used behind the mark."""
    img = Image.new("RGBA", (1, size))
    px = img.load()
    for y in range(size):
        t = y / max(size - 1, 1)
        px[0, y] = tuple(round(a + (b - a) * t) for a, b in zip(GREEN_TOP, GREEN_BOTTOM))
    return img.resize((size, size), Image.Resampling.BICUBIC)


def pulse_points(cx: float, cy: float, w: float) -> list[tuple[float, float]]:
    """ECG polyline across the card, given the card centre and usable width."""
    u = w / 2
    return [
        (cx - u, cy),
        (cx - 0.44 * u, cy),
        (cx - 0.26 * u, cy - 0.40 * u),
        (cx - 0.05 * u, cy + 0.44 * u),
        (cx + 0.18 * u, cy - 0.24 * u),
        (cx + 0.38 * u, cy),
        (cx + u, cy),
    ]


def draw_mark(draw: ImageDraw.ImageDraw, size: int, card_w: float, *, outline_only: bool, ink=WHITE) -> None:
    """Draw the clipboard + pulse mark centred on a canvas of `size` pixels."""
    card_h = card_w * 1.24
    cx = size / 2
    cy = size / 2 + card_w * 0.045  # nudge down: the clip adds weight on top
    left, right = cx - card_w / 2, cx + card_w / 2
    top, bottom = cy - card_h / 2, cy + card_h / 2
    radius = card_w * 0.13
    stroke = card_w * 0.085

    clip_w, clip_h = card_w * 0.44, card_w * 0.20
    clip_box = (cx - clip_w / 2, top - clip_h * 0.52, cx + clip_w / 2, top + clip_h * 0.48)

    if outline_only:
        draw.rounded_rectangle((left, top, right, bottom), radius=radius, outline=ink, width=round(stroke))
        draw.rounded_rectangle(clip_box, radius=clip_h * 0.42, fill=(0, 0, 0, 0), outline=ink, width=round(stroke))
        pulse_ink = ink
    else:
        draw.rounded_rectangle((left, top, right, bottom), radius=radius, fill=ink)
        draw.rounded_rectangle(clip_box, radius=clip_h * 0.42, fill=ink)
        draw.rounded_rectangle(
            (cx - clip_w * 0.22, top - clip_h * 0.08, cx + clip_w * 0.22, top + clip_h * 0.16),
            radius=clip_h * 0.16,
            fill=GREEN,
        )
        # Two form-field bars above the pulse, so the card reads as a printed form.
        bar_h = card_w * 0.052
        bar_y = top + card_h * 0.26
        for x0, x1 in ((left + card_w * 0.16, cx + card_w * 0.02), (cx + card_w * 0.10, right - card_w * 0.16)):
            draw.rounded_rectangle((x0, bar_y, x1, bar_y + bar_h), radius=bar_h / 2, fill=PAPER_LINE)
        pulse_ink = GREEN

    pts = pulse_points(cx, cy + card_h * 0.12, card_w * 0.76)
    draw.line(pts, fill=pulse_ink, width=round(stroke), joint="curve")
    for x, y in (pts[0], pts[-1]):  # round the flat ends
        draw.ellipse((x - stroke / 2, y - stroke / 2, x + stroke / 2, y + stroke / 2), fill=pulse_ink)


def render(size: int, card_w_frac: float, *, background: str, outline_only: bool = False) -> Image.Image:
    big = size * SS
    if background == "gradient":
        img = gradient(big)
    elif background == "flat":
        img = Image.new("RGBA", (big, big), GREEN)
    else:
        img = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    if card_w_frac:
        draw_mark(draw, big, big * card_w_frac, outline_only=outline_only)
    return img.resize((size, size), Image.Resampling.LANCZOS)


def save(img: Image.Image, name: str) -> None:
    path = OUT / name
    img.save(path)
    print(f"{path.relative_to(OUT.parent.parent)}  {img.size[0]}x{img.size[1]}")


if __name__ == "__main__":
    # iOS / legacy launcher icon: full-bleed green field, mark inside.
    save(render(1024, 0.46, background="gradient"), "icon.png")
    # Android adaptive icon: background layer + foreground inside the 66% safe circle.
    save(render(512, 0.0, background="gradient"), "android-icon-background.png")
    save(render(512, 0.37, background="transparent"), "android-icon-foreground.png")
    # Themed (monochrome) icon: single-colour glyph, tinted by the system.
    save(render(432, 0.37, background="transparent", outline_only=True), "android-icon-monochrome.png")
    # Splash: white glyph on the dark green splash background (app.json imageWidth).
    save(render(512, 0.62, background="transparent"), "splash-icon.png")
    # Web favicon.
    save(render(48, 0.54, background="gradient"), "favicon.png")
