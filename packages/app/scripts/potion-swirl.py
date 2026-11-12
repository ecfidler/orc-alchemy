"""Make public/potion-swirl.png, the twelve swirl frames of the potion logo (ORC-208).

Each frame puts a faint light arm on the liquid pixels of
public/potion-16.png. The arm is a spiral that turns once in twelve frames.
The glass, the highlights and the cork do not change.

Run from packages/app with Pillow installed: python3 scripts/potion-swirl.py
"""
import math

from PIL import Image

FRAMES = 12
OUTLINE = (227, 255, 255, 255)
CORK = (156, 90, 60, 255)
CENTER_X, CENTER_Y = 6.0, 9.0
LIQUID_RADIUS = 4.3
# The most that the arm adds to or takes from the green channel, of 255.
STRENGTH = 10
# Red and blue change less than green, so the liquid keeps its hue.
CHANNEL_SHARE = (0.45, 1.0, 0.55)
# How much the arm bends for each pixel of distance from the centre, in radians.
TWIST = 0.9
# Inside this distance the arm fades out, so the centre stays calm.
CALM_RADIUS = 1.2

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
    for x, y in liquid:
        dx, dy = x - CENTER_X, y - CENTER_Y
        distance = math.hypot(dx, dy)
        light = math.cos(math.atan2(dy, dx) + TWIST * distance - 2 * math.pi * frame / FRAMES)
        light *= STRENGTH * min(1, distance / CALM_RADIUS)
        red, green, blue, alpha = art.getpixel((x, y))
        shifted = [max(0, min(255, round(value + light * share))) for value, share in zip((red, green, blue), CHANNEL_SHARE)]
        image.putpixel((x, y), (*shifted, alpha))
    sheet.paste(image, (16 * frame, 0))
sheet.save("public/potion-swirl.png", optimize=True)
