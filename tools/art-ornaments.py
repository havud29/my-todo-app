"""Vector wallpapers for the Art Nouveau and Art Deco themes.

Writes public/art/nouveau(-portrait).svg and public/art/deco(-portrait).svg.
Everything is drawn from code, so there's no third-party artwork.
"""
import math
import random
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / 'public' / 'art'
OUT.mkdir(parents=True, exist_ok=True)


def f(v):
    return f'{v:.1f}'


# ---------------------------------------------------------------- Art Nouveau
def bez(p0, p1, p2, p3, t):
    u = 1 - t
    return tuple(u ** 3 * a + 3 * u * u * t * b + 3 * u * t * t * c + t ** 3 * d for a, b, c, d in zip(p0, p1, p2, p3))


def leaf(x, y, ang, L, w):
    """Pointed willow-like leaf with a midrib, as two quadratic curves."""
    ca, sa = math.cos(ang), math.sin(ang)
    tip = (x + ca * L, y + sa * L)
    nx, ny = -sa, ca
    m = (x + ca * L * 0.5, y + sa * L * 0.5)
    c1 = (m[0] + nx * w, m[1] + ny * w)
    c2 = (m[0] - nx * w * 0.6, m[1] - ny * w * 0.6)
    return (f'<path class="leaf" d="M{f(x)} {f(y)} Q{f(c1[0])} {f(c1[1])} {f(tip[0])} {f(tip[1])} '
            f'Q{f(c2[0])} {f(c2[1])} {f(x)} {f(y)}Z"/>'
            f'<path class="rib" d="M{f(x)} {f(y)} Q{f(m[0] + nx * w * 0.2)} {f(m[1] + ny * w * 0.2)} {f(tip[0])} {f(tip[1])}"/>')


def lily(x, y, s, ang):
    """Lily seen from the side: six recurved petals around stamens."""
    out = [f'<g transform="translate({f(x)} {f(y)}) rotate({f(math.degrees(ang) + 90)}) scale({s:.2f})">']
    for a in (-62, -34, -10, 10, 34, 62):
        out.append(f'<path class="petal" transform="rotate({a})" d="M0 0 C-14 -20 -16 -52 -4 -78 C2 -88 10 -84 12 -76 '
                   f'C16 -60 14 -26 0 0Z"/>')
        out.append(f'<path class="vein" transform="rotate({a})" d="M0 -4 C-4 -30 -4 -56 2 -76"/>')
    for a in (-20, -8, 4, 16):
        out.append(f'<path class="stamen" transform="rotate({a})" d="M0 0 C-2 -30 2 -60 0 -92"/>'
                   f'<ellipse class="anther" transform="rotate({a})" cx="0" cy="-94" rx="3.2" ry="6"/>')
    out.append('</g>')
    return ''.join(out)


def whiplash(rng, x0, y0, dirx, height, sway, leaves=7):
    """A stem rising from (x0, y0) with the S-shaped whiplash curve, leaves and a lily."""
    p0 = (x0, y0)
    p1 = (x0 + dirx * sway * 1.4, y0 - height * 0.35)
    p2 = (x0 - dirx * sway * 0.9, y0 - height * 0.7)
    p3 = (x0 + dirx * sway * 0.6, y0 - height)
    out = [f'<path class="stem" d="M{f(p0[0])} {f(p0[1])} C{f(p1[0])} {f(p1[1])} {f(p2[0])} {f(p2[1])} {f(p3[0])} {f(p3[1])}"/>']
    for i in range(leaves):
        t = 0.12 + 0.62 * i / max(1, leaves - 1)
        x, y = bez(p0, p1, p2, p3, t)
        x2, y2 = bez(p0, p1, p2, p3, t + 0.01)
        tang = math.atan2(y2 - y, x2 - x)
        side = 1 if i % 2 else -1
        out.append(leaf(x, y, tang + side * rng.uniform(0.5, 0.9), rng.uniform(70, 120), rng.uniform(16, 24)))
    x, y = p3
    x2, y2 = bez(p0, p1, p2, p3, 0.98)
    out.append(lily(x, y, rng.uniform(0.85, 1.15), math.atan2(y - y2, x - x2)))
    # A bud part-way up
    bx, by = bez(p0, p1, p2, p3, 0.82)
    out.append(f'<ellipse class="bud" cx="{f(bx + dirx * 26)}" cy="{f(by - 10)}" rx="9" ry="22" '
               f'transform="rotate({f(dirx * 25)} {f(bx + dirx * 26)} {f(by - 10)})"/>'
               f'<path class="stem thin" d="M{f(bx)} {f(by)} Q{f(bx + dirx * 14)} {f(by - 2)} {f(bx + dirx * 24)} {f(by + 10)}"/>')
    return ''.join(out)


def halo(cx, cy, r, rng):
    out = [f'<circle cx="{f(cx)}" cy="{f(cy)}" r="{f(r)}" fill="url(#haloFill)"/>',
           f'<circle cx="{f(cx)}" cy="{f(cy)}" r="{f(r)}" class="ring"/>',
           f'<circle cx="{f(cx)}" cy="{f(cy)}" r="{f(r * 0.86)}" class="ring thin"/>',
           f'<circle cx="{f(cx)}" cy="{f(cy)}" r="{f(r * 0.58)}" class="ring thin"/>',
           f'<circle cx="{f(cx)}" cy="{f(cy)}" r="{f(r * 0.55)}" class="ring"/>']
    # Mosaic band between the outer rings, like Mucha's Byzantine haloes
    n = 64
    for i in range(n):
        a = 2 * math.pi * i / n
        rr = r * 0.93
        out.append(f'<circle cx="{f(cx + math.cos(a) * rr)}" cy="{f(cy + math.sin(a) * rr)}" r="{f(r * 0.035)}" class="tess{i % 3}"/>')
    # Fine radiating lines in the inner disc
    for i in range(72):
        a = 2 * math.pi * i / 72
        out.append(f'<line x1="{f(cx + math.cos(a) * r * 0.6)}" y1="{f(cy + math.sin(a) * r * 0.6)}" '
                   f'x2="{f(cx + math.cos(a) * r * 0.84)}" y2="{f(cy + math.sin(a) * r * 0.84)}" class="spoke"/>')
    # Zodiac-like dots in the middle band
    for i in range(12):
        a = 2 * math.pi * i / 12 + 0.26
        out.append(f'<circle cx="{f(cx + math.cos(a) * r * 0.72)}" cy="{f(cy + math.sin(a) * r * 0.72)}" r="{f(r * 0.022)}" class="tess0"/>')
    return ''.join(out)


def nouveau(W, H, name, seed=3):
    rng = random.Random(seed)
    portrait = H > W
    hx, hy, hr = (W * 0.5, H * 0.3, W * 0.42) if portrait else (W * 0.66, H * 0.42, H * 0.36)
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMid slice">',
             '''<defs>
<linearGradient id="paper" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6eedb"/><stop offset="1" stop-color="#eadbb8"/></linearGradient>
<radialGradient id="haloFill"><stop offset="0" stop-color="#f7e3b0"/><stop offset=".6" stop-color="#ecd29a"/><stop offset="1" stop-color="#e2be7e"/></radialGradient>
<radialGradient id="vign" cx=".5" cy=".5" r=".75"><stop offset=".6" stop-color="#6b4a2a" stop-opacity="0"/><stop offset="1" stop-color="#6b4a2a" stop-opacity=".22"/></radialGradient>
<filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="4"/>
<feColorMatrix values="0 0 0 0 .45  0 0 0 0 .35  0 0 0 0 .2  0 0 0 .09 0"/></filter>
<pattern id="dots" width="26" height="26" patternUnits="userSpaceOnUse"><circle cx="13" cy="13" r="1.6" fill="#c9a86a" opacity=".35"/></pattern>
</defs>
<style>
.stem{fill:none;stroke:#5e6b3c;stroke-width:5;stroke-linecap:round}
.stem.thin{stroke-width:3}
.leaf{fill:#93a066;stroke:#4f5b31;stroke-width:2.2}
.rib{fill:none;stroke:#4f5b31;stroke-width:1.2;opacity:.7}
.petal{fill:#f3dcc8;stroke:#9a6a4a;stroke-width:2}
.vein{fill:none;stroke:#d6a58a;stroke-width:1.2}
.stamen{fill:none;stroke:#8a6a3a;stroke-width:1.4}
.anther{fill:#c9862f}
.bud{fill:#e9c3a8;stroke:#9a6a4a;stroke-width:2}
.ring{fill:none;stroke:#a7803f;stroke-width:4}
.ring.thin{stroke-width:1.6}
.spoke{stroke:#c39a52;stroke-width:1.4;opacity:.7}
.tess0{fill:#b98f45;stroke:#7d5a2a;stroke-width:1.2}
.tess1{fill:#cfa36a;stroke:#7d5a2a;stroke-width:1.2}
.tess2{fill:#9aa36d;stroke:#5a6236;stroke-width:1.2}
.frame{fill:none;stroke:#8a6a3a;stroke-width:3}
.frame.thin{stroke-width:1.3}
.wave{fill:none;stroke:#b48a52;stroke-width:2;opacity:.55}
</style>''',
             f'<rect width="{W}" height="{H}" fill="url(#paper)"/>',
             f'<rect width="{W}" height="{H}" fill="url(#dots)"/>']
    # Flowing hair-like ribbons sweeping across, Mucha's signature whiplash
    for i in range(9):
        y = H * (0.15 + i * 0.09)
        d = f'M{-50} {f(y)} ' + ' '.join(
            f'C{f(W * (k + 0.33) / 3)} {f(y + (-1) ** k * H * 0.12 + i * 6)} {f(W * (k + 0.66) / 3)} {f(y - (-1) ** k * H * 0.08)} {f(W * (k + 1) / 3 + 20)} {f(y + i * 3)}'
            for k in range(3))
        parts.append(f'<path class="wave" d="{d}"/>')
    parts.append(halo(hx, hy, hr, rng))
    # Stems rising from both bottom corners, mirrored
    count = 4 if portrait else 5
    for i in range(count):
        parts.append(whiplash(rng, W * (0.02 + i * 0.07), H + 10, 1, H * rng.uniform(0.5, 0.78), W * 0.05 + i * 8))
        parts.append(whiplash(rng, W * (0.98 - i * 0.07), H + 10, -1, H * rng.uniform(0.45, 0.72), W * 0.05 + i * 8))
    # Arched frame with a keystone, as on Mucha's posters
    m = 22
    top = H * 0.1 if not portrait else W * 0.16
    arch = (f'M{m} {H - m} L{m} {f(top + m)} Q{m} {m} {f(W * 0.18)} {m} L{f(W * 0.38)} {m} '
            f'Q{f(W / 2)} {f(m - 6)} {f(W * 0.62)} {m} L{f(W * 0.82)} {m} Q{W - m} {m} {W - m} {f(top + m)} L{W - m} {H - m}Z')
    parts.append(f'<path class="frame" d="{arch}"/>')
    parts.append(f'<path class="frame thin" d="{arch}" transform="translate({W * 0.006} {H * 0.009}) scale({1 - 0.012} {1 - 0.018})"/>')
    parts.append(f'<rect width="{W}" height="{H}" fill="url(#vign)"/>')
    parts.append(f'<rect width="{W}" height="{H}" filter="url(#grain)"/>')
    parts.append('</svg>')
    (OUT / name).write_text('\n'.join(parts))
    print('wrote', name)


# ---------------------------------------------------------------- Art Deco
def deco(W, H, name):
    portrait = H > W
    cx, cy = W / 2, H * (0.78 if not portrait else 0.7)
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMid slice">',
             '''<defs>
<linearGradient id="night" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#070a12"/><stop offset=".55" stop-color="#0f1a2e"/><stop offset="1" stop-color="#16223a"/></linearGradient>
<linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6e3a1"/><stop offset=".45" stop-color="#d4af37"/><stop offset=".7" stop-color="#a87b1e"/><stop offset="1" stop-color="#f0d27a"/></linearGradient>
<linearGradient id="goldV" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6e3a1"/><stop offset="1" stop-color="#9c7020"/></linearGradient>
<radialGradient id="glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#f3d27a" stop-opacity=".55"/><stop offset="1" stop-color="#f3d27a" stop-opacity="0"/></radialGradient>
<pattern id="fans" width="80" height="40" patternUnits="userSpaceOnUse">
<path d="M0 40 A40 40 0 0 1 80 40" fill="none" stroke="#d4af37" stroke-width="1.2"/>
<path d="M12 40 A28 28 0 0 1 68 40" fill="none" stroke="#d4af37" stroke-width="1"/>
<path d="M24 40 A16 16 0 0 1 56 40" fill="none" stroke="#d4af37" stroke-width=".8"/>
<path d="M-40 20 A40 40 0 0 1 40 20 M40 20 A40 40 0 0 1 120 20" fill="none" stroke="#d4af37" stroke-width="1.2" transform="translate(0 0)"/>
</pattern>
</defs>''',
             f'<rect width="{W}" height="{H}" fill="url(#night)"/>',
             f'<rect width="{W}" height="{H * 0.42}" fill="url(#fans)" opacity=".12"/>']
    # Sunburst: alternating wedges radiating from behind the skyline
    n = 36
    R = max(W, H) * 1.4
    for i in range(n):
        if i % 2:
            continue
        a0 = math.pi + math.pi * i / n
        a1 = math.pi + math.pi * (i + 1) / n
        parts.append(f'<path d="M{f(cx)} {f(cy)} L{f(cx + math.cos(a0) * R)} {f(cy + math.sin(a0) * R)} '
                     f'L{f(cx + math.cos(a1) * R)} {f(cy + math.sin(a1) * R)}Z" fill="url(#goldV)" opacity=".09"/>')
    for i in range(0, n + 1):
        a = math.pi + math.pi * i / n
        parts.append(f'<line x1="{f(cx)}" y1="{f(cy)}" x2="{f(cx + math.cos(a) * R)}" y2="{f(cy + math.sin(a) * R)}" '
                     f'stroke="#d4af37" stroke-width="1" opacity=".22"/>')
    parts.append(f'<circle cx="{f(cx)}" cy="{f(cy)}" r="{f(H * 0.5)}" fill="url(#glow)"/>')
    # Concentric stepped arcs around the sun
    for k, r in enumerate([0.16, 0.2, 0.235, 0.33, 0.36, 0.5]):
        rr = H * r
        parts.append(f'<path d="M{f(cx - rr)} {f(cy)} A{f(rr)} {f(rr)} 0 0 1 {f(cx + rr)} {f(cy)}" fill="none" '
                     f'stroke="url(#gold)" stroke-width="{2.5 if k in (0, 3) else 1.2}" opacity=".8"/>')
    parts.append(f'<path d="M{f(cx - H * 0.15)} {f(cy)} A{f(H * 0.15)} {f(H * 0.15)} 0 0 1 {f(cx + H * 0.15)} {f(cy)}Z" fill="url(#gold)" opacity=".9"/>')
    # Skyline of stepped ziggurat towers, symmetric about the centre
    rng = random.Random(7)
    base = H
    towers = []
    span = W * 0.5
    x = 0
    while x < span:
        w = rng.uniform(0.05, 0.09) * W
        h = rng.uniform(0.18, 0.42) * H * (1.25 - x / span * 0.6)
        towers.append((x, w, h))
        x += w * rng.uniform(0.75, 1.0)
    # Central spire
    parts_sky = []

    def tower(x, w, h, front):
        steps = 3
        pts = [(x, base)]
        y = base - h
        sx, sw = x, w
        for s in range(steps):
            pts += [(sx, y + s * h * 0.06)]
            inset = sw * 0.14
            pts += [(sx + inset, y + s * h * 0.06)]
            sx += inset
            sw -= 2 * inset
        y_top = y - h * 0.1
        pts += [(sx, y_top), (sx + sw / 2, y_top - h * 0.12), (sx + sw, y_top)]
        rev = [(2 * x + w - px, py) for px, py in reversed(pts)]
        poly = pts + rev[1:]
        d = 'M' + ' L'.join(f'{f(px)} {f(py)}' for px, py in poly) + 'Z'
        fill = '#0a0e18' if front else '#121b2c'
        out = [f'<path d="{d}" fill="{fill}" stroke="url(#gold)" stroke-width="{1.6 if front else 1}" stroke-opacity="{0.9 if front else 0.45}"/>']
        # Vertical window stripes
        for j in range(1, 4):
            lx = x + w * j / 4
            out.append(f'<line x1="{f(lx)}" y1="{f(base - h * 0.85)}" x2="{f(lx)}" y2="{f(base)}" stroke="#d4af37" '
                       f'stroke-width="{1.2 if front else 0.8}" opacity="{0.45 if front else 0.2}" stroke-dasharray="6 5"/>')
        return ''.join(out)

    for (x, w, h) in towers:
        parts_sky.append(tower(cx - span + x - w * 0.2, w, h * 0.8, False))
        parts_sky.append(tower(cx + span - x - w * 0.8, w, h * 0.8, False))
    for (x, w, h) in towers[::2]:
        parts_sky.append(tower(cx - span + x, w * 0.9, h * 0.55, True))
        parts_sky.append(tower(cx + span - x - w * 0.9, w * 0.9, h * 0.55, True))
    sw = W * 0.06 if not portrait else W * 0.12
    parts_sky.append(tower(cx - sw / 2, sw, H * 0.5, True))
    parts += parts_sky
    # Chevron band along the base
    band = []
    step = 36
    for i in range(int(W / step) + 2):
        x0 = i * step
        band.append(f'M{x0} {H - 8} L{x0 + step / 2} {H - 26} L{x0 + step} {H - 8}')
    parts.append(f'<rect y="{H - 34}" width="{W}" height="34" fill="#07090f"/>')
    parts.append(f'<path d="{" ".join(band)}" fill="none" stroke="url(#gold)" stroke-width="2"/>')
    parts.append(f'<line x1="0" y1="{H - 34}" x2="{W}" y2="{H - 34}" stroke="url(#gold)" stroke-width="3"/>')
    # Double frame with stepped corners
    for m, sw_ in ((16, 2.5), (26, 1)):
        c = 30
        d = (f'M{m + c} {m} L{W - m - c} {m} L{W - m - c} {m + c / 2} L{W - m - c / 2} {m + c / 2} L{W - m - c / 2} {m + c} L{W - m} {m + c} '
             f'L{W - m} {H - m - c} L{W - m - c / 2} {H - m - c} L{W - m - c / 2} {H - m - c / 2} L{W - m - c} {H - m - c / 2} L{W - m - c} {H - m} '
             f'L{m + c} {H - m} L{m + c} {H - m - c / 2} L{m + c / 2} {H - m - c / 2} L{m + c / 2} {H - m - c} L{m} {H - m - c} '
             f'L{m} {m + c} L{m + c / 2} {m + c} L{m + c / 2} {m + c / 2} L{m + c} {m + c / 2}Z')
        parts.append(f'<path d="{d}" fill="none" stroke="url(#gold)" stroke-width="{sw_}"/>')
    parts.append('</svg>')
    (OUT / name).write_text('\n'.join(parts))
    print('wrote', name)


if __name__ == '__main__':
    nouveau(1600, 1000, 'nouveau.svg')
    nouveau(900, 1600, 'nouveau-portrait.svg')
    deco(1600, 1000, 'deco.svg')
    deco(900, 1600, 'deco-portrait.svg')
