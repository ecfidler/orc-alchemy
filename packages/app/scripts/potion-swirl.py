"""Make public/potion-swirl.png, the twelve swirl frames of the potion logo (ORC-208).

Each frame turns the liquid pixels of public/potion-16.png around the middle
of the flask. The glass, the highlights and the cork do not change.

Run from packages/app with Pillow installed: python3 scripts/potion-swirl.py
"""
import math

from PIL import Image

FRAMES = 12
OUTLINE = (227, 255, 255, 255)
CORK = (156, 90, 60, 255)
CENTER_X, CENTER_Y = 6.0, 9.0
LIQUID_RADIUS = 4.3

art = Image.open("public/potion-16.png").convert("RGBA")


def is_liquid(x, y):
    pixel = art.getpixel((x, y))
    if pixel[3] == 0 or pixel in (OUTLINE, CORK):
        return False
    return math.hypot(x - CENTER_X, y - CENTER_Y) <= LIQUID_RADIUS


liquid = [(x, y) for y in range(16) for x in range(16) if is_liquid(x, y)]
sheet = Image.new("RGBA", (16 * FRAMES, 16), (0, 0, 0, 0))
for frame in range(FRAMES):
    image = art.copy()
    angle = 2 * math.pi * frame / FRAMES
    for x, y in liquid:
        dx, dy = x - CENTER_X, y - CENTER_Y
        source_x = CENTER_X + dx * math.cos(angle) + dy * math.sin(angle)
        source_y = CENTER_Y - dx * math.sin(angle) + dy * math.cos(angle)
        nearest = min(liquid, key=lambda p: (p[0] - source_x) ** 2 + (p[1] - source_y) ** 2)
        image.putpixel((x, y), art.getpixel(nearest))
    sheet.paste(image, (16 * frame, 0))
sheet.save("public/potion-swirl.png", optimize=True)
