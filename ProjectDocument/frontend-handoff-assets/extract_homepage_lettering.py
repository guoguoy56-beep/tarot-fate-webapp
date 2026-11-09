"""Extract the selected concept's original lettering without redrawing its pixels.

Requires Pillow. Run from any directory; the original reference stays unchanged.
"""

from collections import deque
from math import hypot
from pathlib import Path

from PIL import Image, ImageChops, ImageFilter


ROOT = Path(__file__).resolve().parents[2]
SOURCE = Path(__file__).with_name("homepage-option-02-nebula-voyage.png")
DESTINATION = ROOT / "public/assets/cosmic"


def gold(pixel, threshold=100):
    red, green, blue = pixel
    return red > threshold and red - blue > 22 and green - blue > 10


def large_components(mask, minimum):
    width, height = mask.size
    pending = {index for index, value in enumerate(mask.get_flattened_data()) if value}
    kept = Image.new("L", mask.size)
    pixels = kept.load()
    while pending:
        first = pending.pop()
        queue = deque([first])
        component = [first]
        while queue:
            point = queue.popleft()
            x, y = point % width, point // width
            for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                neighbour = ny * width + nx
                if 0 <= nx < width and 0 <= ny < height and neighbour in pending:
                    pending.remove(neighbour)
                    queue.append(neighbour)
                    component.append(neighbour)
        if len(component) >= minimum:
            for point in component:
                pixels[point % width, point // width] = 255
    return kept


def lettering(source):
    seed = Image.new("L", source.size)
    seed.putdata([255 if gold(pixel, 110) else 0 for pixel in source.get_flattened_data()])
    seed = large_components(seed, 90)
    support = seed.filter(ImageFilter.MaxFilter(5))
    alpha = Image.new("L", source.size)
    alpha.putdata([
        min(255, max(0, round((pixel[0] - 55) * 255 / 55)))
        if nearby and gold(pixel, 55) else 0
        for pixel, nearby in zip(source.get_flattened_data(), support.get_flattened_data())
    ])
    result = source.convert("RGBA")
    result.putalpha(alpha)
    return result


def button(source):
    rim = Image.new("L", source.size)
    rim.putdata([255 if gold(pixel, 90) else 0 for pixel in source.get_flattened_data()])
    closed = rim.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))
    width, height = source.size
    exterior = Image.new("L", source.size)
    exterior_pixels = exterior.load()
    barriers = closed.load()
    queue = deque([(0, 0)])
    exterior_pixels[0, 0] = 255
    while queue:
        x, y = queue.popleft()
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < width and 0 <= ny < height and not barriers[nx, ny] and not exterior_pixels[nx, ny]:
                exterior_pixels[nx, ny] = 255
                queue.append((nx, ny))
    body = ImageChops.invert(exterior)
    nearby = body.filter(ImageFilter.MaxFilter(9))
    alpha = Image.new("L", source.size)
    alpha.putdata([
        255 if inside else min(160, max(0, round((pixel[0] - 25) * 2)))
        if adjacent and gold(pixel, 30) else 0
        for pixel, inside, adjacent in zip(source.get_flattened_data(), body.get_flattened_data(), nearby.get_flattened_data())
    ])
    result = source.convert("RGBA")
    result.putalpha(alpha)
    return result


def title_emblem(source):
    alpha = Image.new("L", source.size)
    values = []
    for y in range(source.height):
        for x in range(source.width):
            gx, gy = x + 154, y + 118
            radius = hypot(gx - 387, gy - 315)
            ornament = (
                88 <= radius <= 143
                or (abs(gx - 387) <= 18 and gy < 275)
                or (abs(gx - 387) <= 2 and 180 <= gy <= 439)
                or (abs(gx - 387) <= 15 and gy >= 425)
            )
            red, green, blue = source.getpixel((x, y))
            values.append(min(255, max(0, (red - blue - 6) * 32))
                          if ornament and green - blue > 3 else 0)
    alpha.putdata(values)
    # Remove the old English subtitle, leaving its visible surrounding rings.
    english_box = (86, 282, 384, 310)
    english = source.crop(english_box)
    letters = Image.new("L", english.size)
    letters.putdata([255 if gold(pixel, 80) else 0
                    for pixel in english.get_flattened_data()])
    letters = letters.filter(ImageFilter.MaxFilter(7))
    alpha.paste(ImageChops.subtract(alpha.crop(english_box), letters), english_box)
    title_box = (0, 133, 462, 277)
    title_alpha = lettering(source.crop(title_box)).getchannel("A")
    alpha.paste(ImageChops.lighter(alpha.crop(title_box), title_alpha), title_box)
    result = source.convert("RGBA")
    result.putalpha(alpha)
    return result


def sharp_button(source):
    # Premultiplied resizing keeps the transparent rim free of dark colour bleed.
    enlarged = source.convert("RGBa").resize(
        (source.width * 4, source.height * 4), Image.Resampling.LANCZOS
    ).convert("RGBA")
    rgb = enlarged.convert("RGB").filter(
        ImageFilter.UnsharpMask(radius=2.8, percent=140, threshold=2)
    )
    result = rgb.convert("RGBA")
    result.putalpha(enlarged.getchannel("A"))
    return result


if __name__ == "__main__":
    original = Image.open(SOURCE).convert("RGB")
    title_box = (154, 251, 616, 395)
    button_box = (175, 475, 600, 590)
    assets = (
        ("home-title-source-v1.png", title_box, lettering),
        ("start-button-source-v1.png", button_box, button),
        ("home-title-emblem-source-v2.png", (154, 118, 616, 451), title_emblem),
    )
    DESTINATION.mkdir(parents=True, exist_ok=True)
    for name, box, extract in assets:
        crop = original.crop(box)
        result = extract(crop)
        # Only alpha changes: every RGB pixel is copied directly from the source.
        assert result.convert("RGB").tobytes() == crop.tobytes()
        result.save(DESTINATION / name, optimize=True)
        print(f"{name}: {result.width} x {result.height}; source crop {box}")
    sharp = sharp_button(button(original.crop(button_box)))
    sharp.save(DESTINATION / "start-button-source-sharp-v2.webp",
               lossless=True, method=6, exact=True)
    print(f"start-button-source-sharp-v2.webp: {sharp.width} x {sharp.height}")
