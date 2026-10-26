#!/usr/bin/env python3
# Renders the painted backgrounds for the art themes into public/art:
#   python3 tools/art-backgrounds.py
# impressionist*.jpg: a water-lily pond built from thousands of short brush dabs.
# epic*.jpg: a fantasy matte painting with layered peaks, floating islands, a
# castle, god rays and embers. Needs numpy and Pillow; no source images.
import math
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'art')


def col(h):
    return np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], np.float32) / 255


def blur(a, r):
    if a.ndim == 2:
        im = Image.fromarray(np.clip(a * 255, 0, 255).astype(np.uint8))
        return np.asarray(im.filter(ImageFilter.GaussianBlur(r)), np.float32) / 255
    return np.stack([blur(a[..., i], r) for i in range(a.shape[2])], -1)


def value_noise(w, h, scale, octaves, seed):
    r = np.random.default_rng(seed)
    acc = np.zeros((h, w), np.float32)
    amp, tot = 1.0, 0.0
    for o in range(octaves):
        s = max(2, int(scale * 2 ** o))
        g = r.random((max(2, s * h // w) + 2, s + 2)).astype(np.float32)
        im = Image.fromarray((g * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)
        acc += amp * np.asarray(im, np.float32) / 255
        tot += amp
        amp *= 0.5
    return acc / tot


def ridge(w, scale, octaves, seed):
    r = np.random.default_rng(seed)
    x = np.linspace(0, 1, w)
    y = np.zeros(w)
    amp = 1.0
    for o in range(octaves):
        f = scale * 2 ** o
        ph = r.uniform(0, 2 * np.pi, 3)
        y += amp * (np.sin(2 * np.pi * f * x + ph[0]) * 0.6 + np.sin(2 * np.pi * f * 1.7 * x + ph[1]) * 0.4)
        amp *= 0.5
    return y


def save(img, name):
    Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8)).save(
        os.path.join(OUT, name), quality=86, optimize=True, progressive=True)
    print('wrote', name)


# ---------------- Impressionist: water lilies ----------------
def impressionist(W, H, name, seed=3):
    rng = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    u, v = xx / W, yy / H
    # Base water colour: lilac sky reflection far away, deep blue-green near
    base = (col('#c9c3e6')[None, None] * (1 - v[..., None]) ** 1.6
            + col('#3f7f8f')[None, None] * (1 - (1 - v[..., None]) ** 1.6))
    # Willow reflections: dark green vertical bands
    for cx, wd in [(0.12, 0.09), (0.47, 0.06), (0.86, 0.11)]:
        band = np.exp(-((u - cx) / wd) ** 2) * np.clip(1.2 - v, 0, 1)
        base = base * (1 - 0.55 * band[..., None]) + col('#2f5d3a') * 0.55 * band[..., None]
    # Light shimmering patches
    n = value_noise(W, H, 4, 4, seed)
    base = base + (np.clip(n - 0.55, 0, 1) * 1.4)[..., None] * col('#f2e9c9') * 0.6

    canvas = Image.fromarray((np.clip(base, 0, 1) * 255).astype(np.uint8)).convert('RGBA')
    k = W / 1920

    def dab_layer(count, length, width, jitter, angle_sd, alpha, horiz=True, sampler=None):
        layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(layer)
        xs = rng.uniform(0, W, count)
        ys = rng.uniform(0, H, count)
        for x, y in zip(xs, ys):
            c = sampler(x, y) if sampler else base[int(y), int(x)]
            c = np.clip(c + rng.normal(0, jitter, 3), 0, 1)
            ang = rng.normal(0 if horiz else math.pi / 2, angle_sd)
            L = rng.uniform(*length) * k * (0.6 + 0.6 * y / H)
            dx, dy = math.cos(ang) * L / 2, math.sin(ang) * L / 2
            wdt = max(1, int(rng.uniform(*width) * k * (0.6 + 0.6 * y / H)))
            d.line([(x - dx, y - dy), (x + dx, y + dy)], fill=tuple(int(t * 255) for t in c) + (alpha,), width=wdt)
        return layer

    canvas = Image.alpha_composite(canvas, dab_layer(int(22000 * k * k), (14, 34), (8, 16), 0.07, 0.1, 220))
    canvas = Image.alpha_composite(canvas, dab_layer(int(26000 * k * k), (8, 18), (5, 9), 0.1, 0.18, 210))
    # Vertical willow strokes
    def willow(x, y):
        return base[int(y), int(x)] * 0.8 + col('#3d6b3f') * 0.2
    canvas = Image.alpha_composite(canvas, dab_layer(int(2500 * k * k), (24, 60), (4, 8), 0.06, 0.1, 90, False, willow))

    # Lily pads in loose horizontal drifts, smaller toward the top
    pads = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(pads)
    greens = [col(c) for c in ('#5e8f3a', '#7aa64a', '#9cbf5a', '#476f35', '#6f9a7a', '#b5c76a')]
    flowers = []
    for drift_y in np.linspace(0.42, 1.0, 7):
        for _ in range(int(rng.uniform(3, 7))):
            cx = rng.uniform(-0.05, 1.05) * W
            cy = (drift_y + rng.normal(0, 0.025)) * H
            s = (0.35 + 0.9 * cy / H) * k
            rx, ry = rng.uniform(60, 150) * s, rng.uniform(16, 40) * s
            for _ in range(int(160 * s + 40)):
                a = rng.uniform(0, 2 * np.pi)
                rr = math.sqrt(rng.uniform(0, 1))
                px, py = cx + math.cos(a) * rx * rr, cy + math.sin(a) * ry * rr
                g = np.clip(greens[rng.integers(len(greens))] + rng.normal(0, 0.05, 3), 0, 1)
                L = rng.uniform(8, 20) * s
                ang = rng.normal(0, 0.35)
                d.line([(px - L, py - L * math.sin(ang) * 0.3), (px + L, py + L * math.sin(ang) * 0.3)],
                       fill=tuple(int(t * 255) for t in g) + (230,), width=max(3, int(rng.uniform(5, 9) * s)))
            if rng.random() < 0.45:
                flowers.append((cx + rng.normal(0, rx * 0.3), cy - ry * 0.3, s))
    canvas = Image.alpha_composite(canvas, pads)

    fl = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(fl)
    for fx, fy, s in flowers:
        petal = [col('#f6c6d6'), col('#f29bb8'), col('#fff4f0'), col('#e98aa8')][rng.integers(4)]
        for _ in range(22):
            a = rng.uniform(np.pi, 2 * np.pi)
            L = rng.uniform(9, 22) * s
            c = np.clip(petal + rng.normal(0, 0.04, 3), 0, 1)
            d.line([(fx, fy), (fx + math.cos(a) * L, fy + math.sin(a) * L * 0.8)],
                   fill=tuple(int(t * 255) for t in c) + (240,), width=max(3, int(6 * s)))
        d.ellipse([fx - 5 * s, fy - 5 * s, fx + 5 * s, fy + 3 * s], fill=(250, 214, 92, 255))
    canvas = Image.alpha_composite(canvas, fl)

    # Monet's arched footbridge across the top, painted in dabs
    br = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(br)
    y_base, rise = 0.3 * H, 0.09 * H
    for i in range(int(900 * k)):
        t = rng.uniform(-0.05, 1.05)
        x = t * W
        y = y_base - rise * math.sin(math.pi * np.clip(t, 0, 1))
        for off, cc in [(0, '#4f8a4a'), (-0.035 * H, '#6fa35f'), (-0.07 * H, '#5d9452')]:
            c = np.clip(col(cc) + rng.normal(0, 0.06, 3), 0, 1)
            L = rng.uniform(8, 18) * k
            d.line([(x - L, y + off + rng.normal(0, 2)), (x + L, y + off + rng.normal(0, 2))],
                   fill=tuple(int(q * 255) for q in c) + (220,), width=int(rng.uniform(5, 9) * k))
    for t in np.linspace(0.02, 0.98, 26):
        x = t * W
        y = y_base - rise * math.sin(math.pi * t)
        c = np.clip(col('#5a9050') + rng.normal(0, 0.05, 3), 0, 1)
        d.line([(x, y - 0.07 * H), (x + rng.normal(0, 2), y)], fill=tuple(int(q * 255) for q in c) + (200,), width=int(6 * k))
    # Its reflection, broken up below
    refl = br.transpose(Image.FLIP_TOP_BOTTOM).filter(ImageFilter.GaussianBlur(3 * k))
    refl = refl.transform((W, H), Image.AFFINE, (1, 0, 0, 0, 1, H - 2 * y_base - 0.02 * H))
    ra = np.asarray(refl).copy()
    ra[..., 3] = (ra[..., 3] * 0.35).astype(np.uint8)
    canvas = Image.alpha_composite(canvas, Image.fromarray(ra))
    canvas = Image.alpha_composite(canvas, br)
    # Foliage above the bridge
    fol = dab_layer(int(26000 * k * k), (14, 30), (8, 14), 0.05, 0.6, 235,
                    sampler=lambda x, y: col(['#6f9468', '#86a676', '#7a9a80', '#9db487', '#a3a8c4'][int((math.sin(x / 90) + math.cos(y / 70) + 2) * 1.25) % 5]))
    fa = np.asarray(fol).copy()
    mask = (np.arange(H)[:, None] < (y_base - rise * np.sin(np.pi * np.clip(np.arange(W) / W, 0, 1)) - 0.07 * H + 30 * k * np.sin(np.arange(W) / (40 * k)))[None, :])
    fa[..., 3] = (fa[..., 3] * mask).astype(np.uint8)
    canvas = Image.alpha_composite(canvas, Image.fromarray(fa))

    img = np.asarray(canvas.convert('RGB'), np.float32) / 255
    # Canvas weave and a soft, airy finish
    weave = (np.sin(xx * 1.9) * np.sin(yy * 1.9)) * 0.02 + (value_noise(W, H, 200, 1, 9) - 0.5) * 0.05
    img = img + weave[..., None]
    img = img * 0.92 + 0.08
    save(img, name)


# ---------------- Epic fantasy matte painting ----------------
def epic(W, H, name, seed=11):
    rng = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    u, v = xx / W, yy / H
    k = W / 1920
    hz = 0.64  # horizon

    sky = np.zeros((H, W, 3), np.float32)
    stops = [(0.0, '#070b22'), (0.25, '#13284d'), (0.45, '#1f5a73'), (0.57, '#c46a4a'), (0.64, '#ffb066'), (1.0, '#ffd9a0')]
    for (a, ca), (b, cb) in zip(stops, stops[1:]):
        t = np.clip((v - a) / (b - a), 0, 1)[..., None]
        m = ((v >= a) & (v <= b))[..., None]
        sky = np.where(m, col(ca) * (1 - t) + col(cb) * t, sky)
    img = sky

    # Stars in the upper sky
    st = np.zeros((H, W), np.float32)
    for _ in range(int(500 * k * k)):
        x, y = int(rng.uniform(0, W)), int(rng.uniform(0, H * 0.4))
        st[y, x] = rng.uniform(0.4, 1) * (1 - y / (H * 0.4))
    img = img + blur(st, 0.6)[..., None] * 1.5

    # Sun low behind the mountains and a huge pale moon with a smaller twin
    sx, sy = 0.62 * W, hz * H - 10 * k
    d = np.hypot(xx - sx, yy - sy) / W
    img = img + (np.exp(-(d / 0.05) ** 2) * 0.9 + np.exp(-(d / 0.22) ** 2) * 0.35)[..., None] * col('#ffd29a')
    for mx, my, mr, a in [(0.22, 0.2, 0.11, 0.9), (0.36, 0.11, 0.035, 0.7)]:
        dm = np.hypot(xx - mx * W, yy - my * H) / W
        disc = np.clip((mr - dm) * W / 2, 0, 1)
        shade = value_noise(W, H, 12, 3, 5) * 0.25
        mc = (col('#dfe6f0') if mr > 0.05 else col('#f0b9a0')) * (0.8 + shade[..., None])
        img = img * (1 - disc[..., None] * a) + mc * disc[..., None] * a
        img = img + (np.exp(-((dm - mr) / 0.06) ** 2) * 0.12 * (dm > mr))[..., None] * col('#9fc7ff')

    # Clouds lit from below
    cn = value_noise(W, H, 3, 6, 21)
    cl = np.clip((cn - 0.5) * 3, 0, 1) * np.exp(-((v - 0.42) / 0.12) ** 2)
    lit = np.clip((v - 0.35) / 0.15, 0, 1)
    ccol = col('#2a3a62')[None, None] * (1 - lit[..., None]) + col('#ff9a62')[None, None] * lit[..., None]
    img = img * (1 - cl[..., None] * 0.85) + ccol * cl[..., None] * 0.85

    # God rays from the sun
    ang = np.arctan2(yy - sy, xx - sx)
    rays = (value_noise(W, 1, 40, 2, 8)[0][((ang + np.pi) / (2 * np.pi) * (W - 1)).astype(int)])
    rays = np.clip(rays - 0.45, 0, 1) * 2 * np.exp(-d / 0.5) * (yy < sy)
    img = img + blur(rays.astype(np.float32), 3)[..., None] * col('#ffcf8a') * 0.35

    # Floating islands, far (hazy) to near (dark)
    def island(img, cx, cy, wdt, hgt, haze, seed_):
        r = np.random.default_rng(seed_)
        x0, x1 = cx - wdt / 2, cx + wdt / 2
        top = cy + ridge(W, 6, 3, seed_) * hgt * 0.06
        within = (xx >= x0) & (xx <= x1)
        t = np.clip((np.arange(W) - x0) / wdt, 0, 1)
        depth = hgt * (np.sin(np.pi * t) ** 0.7) * (0.75 + 0.25 * value_noise(W, H, 30, 2, seed_)[int(cy) % H])
        mask = within & (yy >= top[None, :].repeat(H, 0)) & (yy <= (cy + depth)[None, :].repeat(H, 0))
        rock = col('#3a2f3a') * (1 - haze) + col('#7f6f8a') * haze
        img = np.where(mask[..., None], rock * (0.8 + 0.3 * value_noise(W, H, 50, 2, seed_ + 1)[..., None]), img)
        grass = mask & (yy <= (top + hgt * 0.05)[None, :].repeat(H, 0))
        gcol = col('#2f6b3a') * (1 - haze) + col('#7f9a8a') * haze
        img = np.where(grass[..., None], gcol, img)
        rim = mask & (np.abs(xx - x1 + wdt * 0.25) < wdt * 0.25)
        img = img + (rim * 0.12 * (1 - haze))[..., None] * col('#ffb070')
        # Waterfall off one edge with mist
        wx = x0 + wdt * r.uniform(0.25, 0.7)
        fall = (np.abs(xx - wx) < 1.5 * k + 2 * k * (yy - cy) / H * 30) & (yy > cy) & (yy < cy + depth.max() * 1.6)
        img = img + (fall * 0.55 * (1 - haze * 0.5))[..., None] * col('#e8f4ff')
        return img
    for (cx, cy, wd, hg, hz_, sd) in [(0.82, 0.33, 0.12, 0.12, 0.65, 31), (0.42, 0.27, 0.08, 0.08, 0.75, 32), (0.1, 0.42, 0.16, 0.14, 0.45, 33)]:
        img = island(img, cx * W, cy * H, wd * W, hg * H, hz_, sd)

    # Mountain ranges with atmospheric perspective
    xs = np.arange(W)
    for i, (base_y, amp, scale, c_near) in enumerate([
        (0.60, 0.09, 1.2, '#8c6f8f'), (0.67, 0.10, 1.6, '#5a4a72'), (0.75, 0.10, 2.0, '#33304f'),
        (0.84, 0.09, 2.4, '#1b1b30'), (0.94, 0.07, 2.8, '#0c0c18')]):
        line = (base_y - amp * (0.55 * np.abs(ridge(W, scale, 5, 40 + i)) + 0.45 * (ridge(W, scale * 0.5, 2, 60 + i) * 0.5 + 0.5))) * H
        mask = yy >= line[None, :]
        haze = np.clip((yy - line[None, :]) / (0.25 * H), 0, 1)
        mc = col(c_near)[None, None] * (0.85 + 0.15 * haze[..., None])
        rimlight = np.exp(-((yy - line[None, :]) / (3 * k)) ** 2) * np.exp(-((xx - sx) / (0.35 * W)) ** 2) * (0.6 - i * 0.1)
        img = np.where(mask[..., None], mc + rimlight[..., None] * col('#ffb070'), img)
        # Mist between ranges
        mist = np.exp(-((yy - (base_y + 0.02) * H) / (0.025 * H)) ** 2) * 0.35 * (1 - i * 0.15)
        img = img * (1 - mist[..., None]) + col('#e7a07a') * mist[..., None]

    # Castle on the right-hand cliff
    cl_x, cl_y = 0.8 * W, 0.66 * H
    castle = Image.new('L', (W, H), 0)
    dc = ImageDraw.Draw(castle)
    dc.polygon([(0.66 * W, H), (0.72 * W, 0.72 * H), (0.76 * W, 0.68 * H), (0.9 * W, 0.67 * H), (0.95 * W, 0.75 * H), (W, H)], fill=255)
    for (tx, tw, th) in [(0.765, 0.012, 0.13), (0.79, 0.02, 0.18), (0.815, 0.014, 0.1), (0.84, 0.024, 0.22), (0.87, 0.012, 0.12), (0.885, 0.016, 0.08)]:
        x0, x1 = tx * W, (tx + tw) * W
        top = cl_y - th * H
        dc.rectangle([x0, top, x1, cl_y + 0.06 * H], fill=255)
        dc.polygon([(x0 - 3 * k, top), ((x0 + x1) / 2, top - (x1 - x0) * 1.8), (x1 + 3 * k, top)], fill=255)
    dc.rectangle([0.77 * W, cl_y - 0.05 * H, 0.89 * W, cl_y + 0.06 * H], fill=255)
    cm = np.asarray(castle, np.float32) / 255
    img = img * (1 - cm[..., None]) + col('#0a0a14') * cm[..., None]
    win = np.zeros((H, W), np.float32)
    for _ in range(26):
        x = int(rng.uniform(0.77, 0.89) * W)
        y = int(rng.uniform(cl_y - 0.17 * H, cl_y - 0.01 * H))
        if cm[y, x] > 0.5:
            win[y:y + int(4 * k) + 1, x:x + int(2 * k) + 1] = 1
    img = img + blur(win, 2)[..., None] * col('#ffb347') * 1.6 + win[..., None] * col('#ffd27a')

    # Birds
    bl = Image.new('L', (W, H), 0)
    db = ImageDraw.Draw(bl)
    for _ in range(9):
        bx, by, s = rng.uniform(0.45, 0.7) * W, rng.uniform(0.33, 0.45) * H, rng.uniform(4, 9) * k
        db.line([(bx - s, by - s * 0.4), (bx, by), (bx + s, by - s * 0.4)], fill=255, width=max(1, int(1.5 * k)))
    bm = np.asarray(bl, np.float32) / 255
    img = img * (1 - bm[..., None] * 0.8)

    # Embers and fireflies
    em = np.zeros((H, W), np.float32)
    for _ in range(int(260 * k * k)):
        x, y = int(rng.uniform(0, W)), int(rng.uniform(0.45, 1) * H)
        em[min(H - 1, y), min(W - 1, x)] = rng.uniform(0.6, 1.0)
    em = blur(em, 1.2) * 6 + blur(em, 5) * 10
    img = img + np.clip(em, 0, 1)[..., None] * col('#ffb35c')

    # Bloom, teal-and-orange grade, vignette
    bright = np.clip(img.max(-1) - 0.7, 0, 1)[..., None] * img
    img = img + blur(np.clip(bright * 2, 0, 1), 20) * 0.5
    lum = img.mean(-1, keepdims=True)
    img = img + (col('#0b3a4a') - 0.5) * 0.12 * (1 - lum) + (col('#ff9a4a') - 0.5) * 0.1 * lum
    vig = 1 - 0.45 * (np.hypot(u - 0.5, v - 0.5) / 0.75) ** 2.2
    save(np.clip(img * vig[..., None], 0, 1), name)


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    if not os.environ.get('ONLY_EPIC'):
        impressionist(1920, 1200, 'impressionist.jpg')
        impressionist(1080, 1920, 'impressionist-portrait.jpg')
    if not os.environ.get('ONLY_IMPRESSIONIST'):
        epic(1920, 1200, 'epic.jpg')
        epic(1080, 1920, 'epic-portrait.jpg')
