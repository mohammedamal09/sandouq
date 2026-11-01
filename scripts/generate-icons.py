from PIL import Image, ImageDraw
from pathlib import Path

out = Path(__file__).resolve().parents[1] / "public"
for size in (192, 512):
    scale = size / 512
    image = Image.new("RGB", (size, size), "#059669")
    draw = ImageDraw.Draw(image)
    box = tuple(round(v * scale) for v in (102, 156, 410, 374))
    draw.rounded_rectangle(box, radius=round(32 * scale), outline="white", width=round(28 * scale))
    draw.line(tuple(round(v * scale) for v in (116, 220, 396, 220)), fill="white", width=round(28 * scale))
    x, y, r = 334 * scale, 294 * scale, 20 * scale
    draw.ellipse((round(x-r), round(y-r), round(x+r), round(y+r)), fill="white")
    image.save(out / f"icon-{size}.png", optimize=True)
