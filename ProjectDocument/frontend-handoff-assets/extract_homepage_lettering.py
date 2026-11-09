"""Extract the selected concept's original lettering without redrawing its pixels.

Requires Pillow. Run from any directory; the original reference stays unchanged.
"""

from collections import deque
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


if __name__ == "__main__":
    original = Image.open(SOURCE).convert("RGB")
    title_box = (154, 251, 616, 395)
    button_box = (175, 475, 600, 590)
    assets = (
        ("home-title-source-v1.png", title_box, lettering),
        ("start-button-source-v1.png", button_box, button),
    )
    DESTINATION.mkdir(parents=True, exist_ok=True)
    for name, box, extract in assets:
        crop = original.crop(box)
        result = extract(crop)
        # Only alpha changes: every RGB pixel is copied directly from the source.
        assert result.convert("RGB").tobytes() == crop.tobytes()
        result.save(DESTINATION / name, optimize=True)
        print(f"{name}: {result.width} x {result.height}; source crop {box}")
