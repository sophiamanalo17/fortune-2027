"""Bake the blue duotone treatment from the Figma design into the photos.

Figma's asset export returns the original photos without the image effects,
so this recreates them:  python3 tools/duotone.py
Reads ./source-images, writes ./public/assets.
"""
import math, os
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC, OUT = os.path.join(ROOT, 'source-images'), os.path.join(ROOT, 'public', 'assets')
CYAN, WHITE = (4, 182, 255), (255, 255, 255)

def lerp(a, b, t): return tuple(round(x + (y - x) * t) for x, y in zip(a, b))
def clamp(t): return max(0.0, min(1.0, t))
def smooth(lo, hi, v):
    t = clamp((v - lo) / (hi - lo)); return t * t * (3 - 2 * t)
def lum(p): return 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2]
def sat(p): return (max(p[:3]) - min(p[:3])) / 255

# animals: shadows -> cyan, highlights -> white, cut-out alpha kept
ANIMALS = {'fish': (75, 235, 520), 'squid': (-20, 105, 640), 'krill': (30, 175, 640), 'seastar': (55, 200, 560)}
for name, (lo, hi, width) in ANIMALS.items():
    im = Image.open(os.path.join(SRC, name + '.png')).convert('RGBA')
    im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    im.putdata([lerp(CYAN, WHITE, clamp((lum(p) - lo) / (hi - lo))) + (p[3],) for p in im.getdata()])
    im.save(os.path.join(OUT, name + '.png'), optimize=True)

# flower: dark background goes white, leaves go blue, petals go pale, with a halftone screen
im = Image.open(os.path.join(SRC, 'flower.png')).convert('RGB')
w, h = im.size
px, out, period = im.load(), [], 5.0
for y in range(h):
    for x in range(w):
        p = px[x, y]; l = lum(p)
        u, v = (x + y) / period * math.pi, (x - y) / period * math.pi
        dot = 0.5 + 0.5 * math.cos(u) * math.cos(v)
        color = lerp((138, 198, 255), (214, 236, 255), smooth(120, 235, l))
        alpha = smooth(22, 60, l) * (0.62 + 0.38 * dot)
        out.append(lerp(WHITE, color, alpha))
res = Image.new('RGB', (w, h)); res.putdata(out)
res.save(os.path.join(OUT, 'flower.png'), optimize=True)

# clouds: colourful streaks -> soft blue, everything else -> white
im = Image.open(os.path.join(SRC, 'clouds.jpg')).convert('RGB')
im.thumbnail((700, 700)); im = im.filter(ImageFilter.GaussianBlur(4))
im.putdata([lerp(WHITE, (170, 214, 255), smooth(0.12, 0.6, sat(p) * (0.4 + lum(p) / 160))) for p in im.getdata()])
im.save(os.path.join(OUT, 'clouds.jpg'), quality=86)
print('done')
