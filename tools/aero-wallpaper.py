#!/usr/bin/env python3
# Renders public/aero/wallpaper.jpg (1920x1200) and wallpaper-portrait.jpg (1080x1920):
#   python3 tools/aero-wallpaper.py public/aero/wallpaper.jpg 1920 1200
#   python3 tools/aero-wallpaper.py public/aero/wallpaper-portrait.jpg 1080 1920
# Needs numpy and Pillow.
# Procedural Frutiger Aero wallpaper: sky, clouds, sun flare, light swooshes,
# rolling grass hills, bokeh and soap bubbles. Pure numpy + PIL, no source photos.
import sys
import numpy as np
from PIL import Image, ImageFilter

W, H = int(sys.argv[2]), int(sys.argv[3])
out = sys.argv[1]
rng = np.random.default_rng(7)
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
u, v = xx / W, yy / H

def blur(a, r):
    if a.ndim == 2:
        im = Image.fromarray(np.clip(a * 255, 0, 255).astype(np.uint8))
        return np.asarray(im.filter(ImageFilter.GaussianBlur(r)), dtype=np.float32) / 255
    return np.stack([blur(a[..., i], r) for i in range(a.shape[2])], -1)

def noise(scale, octaves=5, seed=0):
    r = np.random.default_rng(seed)
    acc = np.zeros((H, W), np.float32); amp = 1.0; tot = 0
    for o in range(octaves):
        s = max(2, int(scale * 2 ** o))
        g = r.random((s * H // W + 2, s + 2)).astype(np.float32)
        im = Image.fromarray((g * 255).astype(np.uint8)).resize((W, H), Image.BICUBIC)
        acc += amp * np.asarray(im, np.float32) / 255; tot += amp; amp *= 0.5
    return acc / tot

def lerp(a, b, t): return a + (b - a) * t[..., None]
def col(h): return np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], np.float32) / 255

# Sky
t = np.clip(v / 0.72, 0, 1) ** 0.9
sky = lerp(np.broadcast_to(col('#0a4fbf'), (H, W, 3)), np.broadcast_to(col('#45a8f5'), (H, W, 3)), np.clip(t * 1.6, 0, 1))
sky = lerp(sky, np.broadcast_to(col('#d6f1ff'), (H, W, 3)), np.clip((t - 0.55) / 0.45, 0, 1) ** 1.5)
img = sky.copy()

# Clouds
n = noise(3, 6, 1)
c = np.clip((n - 0.52) * 3.2, 0, 1) * np.clip(1 - np.abs(v - 0.3) / 0.28, 0, 1)
c = blur(c, 6)
img = img + (1 - img) * (c[..., None] * 0.9)

# Sun glow and starburst
sx, sy = 0.8 * W, 0.16 * H
d = np.hypot(xx - sx, yy - sy) / W
ang = np.arctan2(yy - sy, xx - sx)
glow = np.exp(-(d / 0.035) ** 2) + 0.55 * np.exp(-(d / 0.16) ** 2) + 0.2 * np.exp(-(d / 0.4) ** 2)
rays = (np.abs(np.cos(ang * 6)) ** 40 + 0.6 * np.abs(np.cos(ang * 6 + 0.26)) ** 60) * np.exp(-d / 0.18)
img = img + (1 - img) * np.clip(glow + rays * 0.3, 0, 1)[..., None] * col('#fffbe8')

# Vista-style light swooshes
sw = np.zeros((H, W, 3), np.float32)
for (a, f, ph, y0, width, cc, k) in [
    (0.07, 1.3, 0.0, 0.52, 0.010, '#c8fbff', 1.0),
    (0.09, 1.1, 1.2, 0.56, 0.022, '#7ef0ff', 0.7),
    (0.06, 1.6, 2.4, 0.49, 0.006, '#ffffff', 1.0),
    (0.10, 0.9, 0.5, 0.60, 0.040, '#9cff7a', 0.35),
]:
    curve = y0 + a * np.sin(2 * np.pi * f * u + ph) + 0.03 * np.sin(2 * np.pi * 3 * u + ph * 2)
    dist = np.abs(v - curve)
    fade = np.clip(np.sin(np.pi * np.clip(u * 1.05, 0, 1)), 0, 1) ** 0.7
    sw += (np.exp(-(dist / width) ** 2) * fade * k)[..., None] * col(cc)
img = img + (1 - img) * np.clip(sw, 0, 1)

# Hills with grass
def hill(y0, amp, freq, ph):
    return y0 + amp * np.sin(2 * np.pi * freq * u + ph) + amp * 0.35 * np.sin(2 * np.pi * freq * 2.3 * u + ph * 1.7)
grass_n = noise(60, 3, 3)
streak = Image.fromarray((grass_n * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6))
streak = np.asarray(streak.resize((W, H // 3)).resize((W, H), Image.BICUBIC), np.float32) / 255
for (y0, amp, f, ph, top, bot) in [(0.72, 0.07, 0.55, 1.1, '#a9f05a', '#2f9a12'), (0.83, 0.08, 0.4, 4.0, '#8be23f', '#1f7d0c')]:
    crest = hill(y0, amp, f, ph)
    m = np.clip((v - crest) * H / 2.0, 0, 1)
    depth = np.clip((v - crest) / 0.25, 0, 1)
    g = lerp(np.broadcast_to(col(top), (H, W, 3)), np.broadcast_to(col(bot), (H, W, 3)), depth ** 0.7)
    g = g * (0.82 + 0.3 * streak[..., None])
    rim = np.exp(-((v - crest) / 0.012) ** 2) * np.clip(1.2 - np.abs(u - 0.8), 0, 1)
    g = g + (1 - g) * (rim[..., None] * 0.55)
    img = lerp(img, g, m)

# Bokeh
bok = np.zeros((H, W), np.float32)
for _ in range(70):
    bx, by = rng.uniform(0, W), rng.uniform(0.35 * H, H)
    r = rng.uniform(6, 34) * W / 1920
    dd = np.hypot(xx - bx, yy - by)
    bok += np.clip((r - dd) / 2.5, 0, 1) * rng.uniform(0.08, 0.3) * (1 + 0.6 * np.clip((dd - r * 0.75) / (r * 0.25), 0, 1))
img = img + (1 - img) * np.clip(blur(np.clip(bok, 0, 1), 1.2), 0, 1)[..., None] * col('#f4ffe0')

# Lens flare ghosts from the sun toward the centre
cx, cy = W * 0.5, H * 0.55
for k, (tpos, r, cc, al) in enumerate([(0.35, 40, '#9bf3ff', 0.18), (0.6, 18, '#ffffff', 0.25), (0.9, 70, '#7dffb2', 0.10), (1.25, 28, '#b9d8ff', 0.18), (1.5, 110, '#8fe8ff', 0.07)]):
    gx, gy = sx + (cx - sx) * tpos, sy + (cy - sy) * tpos
    rr = r * W / 1920
    dd = np.hypot(xx - gx, yy - gy)
    ring = np.clip((rr - dd) / 3, 0, 1) * (0.6 + 0.4 * (dd / rr))
    img = img + (1 - img) * (ring * al)[..., None] * col(cc)

# Bubbles
def bubble(img, bx, by, r):
    dd = np.hypot(xx - bx, yy - by) / r
    inside = np.clip((1 - dd) * r / 1.5, 0, 1)
    rim = np.clip(dd, 0, 1) ** 6
    hl = np.exp(-(np.hypot(xx - (bx - 0.4 * r), yy - (by - 0.45 * r)) / (0.16 * r)) ** 2)
    hl2 = np.exp(-(np.hypot(xx - (bx + 0.35 * r), yy - (by + 0.4 * r)) / (0.25 * r)) ** 2) * 0.35
    tint = np.stack([0.75 + 0.25 * np.sin(6 * dd + 0), 0.85 + 0.15 * np.sin(6 * dd + 2), np.ones_like(dd)], -1)
    a = (inside * (rim * 0.65 + 0.06 + hl + hl2))[..., None]
    return img * (1 - a * 0.6) + tint * a * 0.9 + a * 0.1
for (bx, by, r) in [(0.12, 0.42, 70), (0.2, 0.62, 34), (0.67, 0.38, 46), (0.9, 0.55, 88), (0.42, 0.24, 22), (0.55, 0.7, 26), (0.05, 0.8, 50)]:
    img = bubble(img, bx * W, by * H, r * W / 1920)

# Bloom and a punchy, saturated finish
bright = np.clip(img.max(-1) - 0.78, 0, 1)[..., None] * img
img = img + blur(np.clip(bright * 2.5, 0, 1), 18) * 0.45
grey = img.mean(-1, keepdims=True)
img = grey + (img - grey) * 1.18
vig = 1 - 0.18 * (np.hypot(u - 0.5, v - 0.45) / 0.75) ** 2
img = np.clip(img * vig[..., None], 0, 1)
Image.fromarray((img * 255).astype(np.uint8)).save(out, quality=86, optimize=True, progressive=True)
print(out)
