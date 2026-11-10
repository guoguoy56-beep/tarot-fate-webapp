"""Extract the user-selected astrolabe artwork; preserve the original RGB pixels.

Requires Pillow. Run from any directory. Only the alpha channel is generated;
the source's lettering, engraving, jewels and button texture are never redrawn.
"""

from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter

from extract_homepage_lettering import button


ROOT = Path(__file__).resolve().parents[2]
SOURCE = Path(__file__).with_name("homepage-astrolabe-selected-2026-11-10.png")
DESTINATION = ROOT / "public/assets/cosmic"


def ornament(source, jewels=()):
    seed = Image.new("L", source.size)
    seed.putdata([
        255 if red - blue > 10 and green - blue > 3 else 0
        for red, green, blue in source.get_flattened_data()
    ])
    nearby = seed.filter(ImageFilter.MaxFilter(7))
    alpha = Image.new("L", source.size)
    alpha.putdata([
        255 if supported and red > 185 and green > 155 else
        min(255, max(0, (red - blue - 2) * 24), max(0, (red - 10) * 8))
        if green > blue else 0
        for (red, green, blue), supported in zip(
            source.get_flattened_data(), nearby.get_flattened_data())
    ])
    # Small violet inlays are enclosed by gold; the chroma key must retain them.
    inlays = Image.new("L", source.size)
    draw = ImageDraw.Draw(inlays)
    for polygon in jewels:
        draw.polygon(polygon, fill=255)
    alpha = ImageChops.lighter(alpha, inlays)
    result = source.convert("RGBA")
    result.putalpha(alpha)
    return result


if __name__ == "__main__":
    original = Image.open(SOURCE).convert("RGB")
    assets = (
        ("home-astrolabe-title-v3.webp", (0, 0, 1254, 730),
         lambda crop: ornament(crop, (
             ((454, 186), (466, 199), (454, 214), (443, 199)),
             ((800, 186), (812, 199), (800, 214), (789, 199)),
         ))),
        ("home-astrolabe-start-v3.webp", (185, 852, 1070, 1080), button),
        ("home-astrolabe-pendant-v3.webp", (450, 1090, 804, 1210),
         lambda crop: ornament(crop, (
             ((177, 24), (187, 40), (177, 53), (167, 40)),
         ))),
    )
    DESTINATION.mkdir(parents=True, exist_ok=True)
    for name, bounds, extract in assets:
        source = original.crop(bounds)
        result = extract(source)
        assert result.convert("RGB").tobytes() == source.tobytes()
        destination = DESTINATION / name
        result.save(destination, lossless=True, method=6, exact=True)
        saved = Image.open(destination)
        assert saved.convert("RGB").tobytes() == source.tobytes()
        assert saved.getchannel("A").getextrema() == (0, 255)
        print(f"{name}: {result.size}, {destination.stat().st_size} bytes, RGB exact")
