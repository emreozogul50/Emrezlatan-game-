"""16 farklı köy evi üretir. Hepsi normal ev; tabela, dükkan, han yok.

Duvar malzemesi, çatı biçimi, çatı rengi, baca, sundurma, balkon, pencere ve kapı
kombinasyonlarından her biri benzersiz bir ev çıkarır. Palet Tiny Swords'ten
örneklendi ki paketin geri kalanıyla aynı dünyada dursun.
"""
from PIL import Image, ImageDraw
import os, random

OUT_DIR = 'public/assets/houses'
SCALE = 3

O = (0x16, 0x1c, 0x2e, 255)          # dış çizgi

WALLS = {
    'ahsap':  ((0xa8, 0x82, 0x50), (0x86, 0x63, 0x3c), (0x5d, 0x44, 0x26)),
    'tas':    ((0x94, 0x9c, 0xa4), (0x74, 0x7d, 0x86), (0x51, 0x5a, 0x63)),
    'siva':   ((0xef, 0xe1, 0xab), (0xcd, 0xb8, 0x84), (0x9c, 0x88, 0x5a)),
}

ROOFS = [
    ((0x62, 0x75, 0x90), (0x46, 0x56, 0x6e), (0x2e, 0x3a, 0x4c)),  # arduvaz
    ((0xb5, 0x4f, 0x45), (0x8e, 0x3a, 0x33), (0x60, 0x24, 0x20)),  # kiremit
    ((0x5c, 0x7c, 0x55), (0x44, 0x5f, 0x3f), (0x2c, 0x40, 0x29)),  # yosunlu
    ((0x84, 0x5f, 0x3a), (0x64, 0x46, 0x28), (0x42, 0x2c, 0x18)),  # ahşap
    ((0x4f, 0x56, 0x62), (0x3a, 0x40, 0x4a), (0x26, 0x2b, 0x33)),  # koyu kurşun
    ((0x6f, 0x5c, 0x7e), (0x53, 0x43, 0x60), (0x36, 0x2a, 0x3f)),  # mor arduvaz
]

GLASS = (0xff, 0xcf, 0x7a)
GLASS_HOT = (0xff, 0xec, 0xbe)
WOOD_T = (0x6b, 0x4c, 0x2a)          # kapı/kiriş ahşabı
WOOD_TL = (0x8a, 0x66, 0x3c)


def rgba(c, a=255):
    return (c[0], c[1], c[2], a)


class House:
    def __init__(self, d, spec):
        self.d = d
        self.s = spec

    # ── duvarlar ──
    def wall(self, x0, y0, x1, y1, mat):
        lt, md, dk = WALLS[mat]
        self.d.rectangle([x0, y0, x1, y1], fill=rgba(md), outline=O)

        if mat == 'ahsap':
            for x in range(x0 + 3, x1, 5):
                self.d.line([(x, y0 + 1), (x, y1 - 1)], fill=rgba(dk))
                self.d.line([(x + 1, y0 + 1), (x + 1, y1 - 1)], fill=rgba(lt))
        elif mat == 'tas':
            row = 0
            for y in range(y0 + 4, y1, 5):
                self.d.line([(x0 + 1, y), (x1 - 1, y)], fill=rgba(dk))
                off = 0 if row % 2 == 0 else 4
                for x in range(x0 + 1 + off, x1 - 1, 8):
                    self.d.line([(x, y), (x, min(y + 4, y1 - 1))], fill=rgba(dk))
                row += 1
        else:
            for _ in range(int((x1 - x0) * (y1 - y0) / 26)):
                px = random.randint(x0 + 2, x1 - 2)
                py = random.randint(y0 + 2, y1 - 2)
                self.d.point((px, py), fill=rgba(dk, 90))

        self.d.line([(x0 + 1, y0 + 1), (x0 + 1, y1 - 1)], fill=rgba(lt))

    # ── çatılar ──
    def roof(self, x0, y0, x1, y1, shape, col, over=5):
        lt, md, dk = col
        a, b = x0 - over, x1 + over
        mid = (x0 + x1) // 2

        if shape == 'beşik':
            pts = [(a, y1), (mid, y0), (b, y1)]
        elif shape == 'kırma':
            pts = [(a, y1), (x0 + (x1 - x0) * 0.28, y0), (x1 - (x1 - x0) * 0.28, y0), (b, y1)]
        elif shape == 'dik':
            pts = [(a, y1), (mid, y0 - 8), (b, y1)]
        elif shape == 'kırıkçatı':
            my = y0 + (y1 - y0) * 0.55
            pts = [(a, y1), (x0 - 1, my), (mid, y0), (x1 + 1, my), (b, y1)]
        else:  # tek eğim
            pts = [(a, y1), (a, y1 - (y1 - y0) * 0.35), (b, y0), (b, y1)]

        self.d.polygon(pts, fill=rgba(md), outline=O)

        # kiremit dokusu
        span = y1 - y0
        for i, yy in enumerate(range(int(y0) + 3, int(y1), 4)):
            t = (yy - y0) / max(span, 1)
            half = (b - a) / 2 * t
            if shape == 'tekeğim':
                self.d.line([(a + 1, yy), (b - 1, yy)], fill=rgba(dk))
            else:
                self.d.line([(mid - half + 1, yy), (mid + half - 1, yy)], fill=rgba(dk))

        # mahya ışığı
        if shape in ('beşik', 'dik'):
            self.d.line([(a, y1), (mid, y0 if shape == 'beşik' else y0 - 8)], fill=rgba(lt))
        self.d.line([(a, y1), (b, y1)], fill=rgba(dk))

    # ── detaylar ──
    def window(self, x, y, w, h, lit=True, arch=False):
        self.d.rectangle([x - 1, y - 1, x + w + 1, y + h + 1], fill=rgba(WOOD_T), outline=O)
        if arch:
            self.d.ellipse([x - 1, y - h // 2, x + w + 1, y + h // 2], fill=rgba(WOOD_T), outline=O)
        self.d.rectangle([x, y, x + w, y + h], fill=rgba(GLASS_HOT if lit else (0x2a, 0x33, 0x44)))
        if lit:
            self.d.rectangle([x + 1, y + 2, x + w - 1, y + h], fill=rgba(GLASS))
        self.d.line([(x + w // 2, y), (x + w // 2, y + h)], fill=rgba(WOOD_T))
        self.d.line([(x, y + h // 2), (x + w, y + h // 2)], fill=rgba(WOOD_T))

    def door(self, x, y, w, h, arch=True):
        """Karakterin gerçekten geçebileceği büyüklükte giriş."""
        # basamak
        self.d.rectangle([x - 3, y + h - 2, x + w + 3, y + h + 1], fill=rgba((0x8a, 0x81, 0x6c)), outline=O)
        # kasa
        self.d.rectangle([x - 2, y - 2, x + w + 2, y + h], fill=rgba((0x4a, 0x33, 0x1c)), outline=O)
        if arch:
            self.d.ellipse([x - 2, y - w // 2 - 2, x + w + 2, y + w // 2], fill=rgba((0x4a, 0x33, 0x1c)), outline=O)
            self.d.ellipse([x, y - w // 2, x + w, y + w // 2 - 2], fill=rgba(WOOD_T))
        # kanat
        self.d.rectangle([x, y, x + w, y + h - 2], fill=rgba(WOOD_T))
        for i in range(1, 4):
            self.d.line([(x + i * w // 4, y + 1), (x + i * w // 4, y + h - 3)], fill=rgba((0x4a, 0x33, 0x1c)))
        self.d.line([(x, y + h // 2), (x + w, y + h // 2)], fill=rgba(WOOD_TL))
        # kol
        self.d.ellipse([x + w - 4, y + h // 2 - 1, x + w - 1, y + h // 2 + 2], fill=rgba((0xd8, 0xc0, 0x88)))

    def chimney(self, x, y, w, h, mat='tas'):
        lt, md, dk = WALLS[mat]
        self.d.rectangle([x, y, x + w, y + h], fill=rgba(md), outline=O)
        self.d.rectangle([x - 1, y, x + w + 1, y + 2], fill=rgba(lt), outline=O)
        for yy in range(y + 4, y + h, 3):
            self.d.line([(x + 1, yy), (x + w - 1, yy)], fill=rgba(dk))

    def porch(self, x0, x1, y, depth, col):
        lt, md, dk = col
        self.d.polygon([(x0 - 3, y + depth), (x0 + 2, y), (x1 - 2, y), (x1 + 3, y + depth)],
                       fill=rgba(md), outline=O)
        self.d.line([(x0 - 3, y + depth), (x1 + 3, y + depth)], fill=rgba(dk))
        for px in (x0 - 1, x1 + 1):
            self.d.rectangle([px - 1, y + depth, px + 1, y + depth + 10], fill=rgba(WOOD_T), outline=O)

    def balcony(self, x0, x1, y):
        self.d.rectangle([x0 - 2, y, x1 + 2, y + 3], fill=rgba(WOOD_TL), outline=O)
        for px in range(x0, x1, 4):
            self.d.line([(px, y - 6), (px, y)], fill=rgba(WOOD_T))
        self.d.rectangle([x0 - 2, y - 7, x1 + 2, y - 6], fill=rgba(WOOD_TL), outline=O)

    def woodpile(self, x, y):
        for r in range(3):
            for c in range(4 - r):
                cx = x + c * 5 + r * 2
                cy = y - r * 4
                self.d.ellipse([cx, cy - 3, cx + 4, cy], fill=rgba(WOOD_TL), outline=O)
                self.d.point((cx + 2, cy - 1), fill=rgba((0x4a, 0x33, 0x1c)))

    def bush(self, x, y):
        for (dx, dy, r) in [(0, 0, 5), (4, 1, 4), (-4, 1, 4)]:
            self.d.ellipse([x + dx - r, y + dy - r, x + dx + r, y + dy + r],
                           fill=rgba((0x4c, 0x6b, 0x3c)), outline=O)
        self.d.ellipse([x - 3, y - 4, x + 1, y], fill=rgba((0x64, 0x87, 0x4c)))

    def flowerbed(self, x0, x1, y):
        self.d.rectangle([x0, y - 3, x1, y], fill=rgba((0x5d, 0x44, 0x26)), outline=O)
        for px in range(x0 + 2, x1, 4):
            self.d.line([(px, y - 3), (px, y - 7)], fill=rgba((0x55, 0x74, 0x38)))
            col = random.choice([(0xd8, 0x5a, 0x6a), (0xe8, 0xc3, 0x4a), (0x9a, 0x6f, 0xd0)])
            self.d.ellipse([px - 1, y - 9, px + 1, y - 7], fill=rgba(col))

    def barrel(self, x, y):
        self.d.ellipse([x, y - 11, x + 8, y - 8], fill=rgba(WOOD_TL), outline=O)
        self.d.polygon([(x, y - 10), (x + 8, y - 10), (x + 7, y), (x + 1, y)],
                       fill=rgba(WOOD_T), outline=O)
        self.d.line([(x, y - 7), (x + 8, y - 7)], fill=rgba((0x3c, 0x44, 0x50)))
        self.d.line([(x, y - 3), (x + 8, y - 3)], fill=rgba((0x3c, 0x44, 0x50)))

    def lantern(self, x, y):
        self.d.rectangle([x, y - 16, x + 1, y], fill=rgba((0x3c, 0x44, 0x50)), outline=None)
        self.d.rectangle([x - 2, y - 22, x + 3, y - 16], fill=rgba((0x3c, 0x44, 0x50)), outline=O)
        self.d.rectangle([x - 1, y - 21, x + 2, y - 17], fill=rgba(GLASS_HOT))


SPECS = [
    dict(w=54, wh=48, rh=22, mat='ahsap', roof=0, shape='beşik',  chim=True,  extra='odun'),
    dict(w=62, wh=54, rh=26, mat='tas',   roof=1, shape='kırma',  chim=True,  extra='fener'),
    dict(w=48, wh=44, rh=20, mat='siva',  roof=2, shape='beşik',  chim=False, extra='çiçek'),
    dict(w=70, wh=60, rh=30, mat='tas',   roof=0, shape='kırıkçatı', chim=True, extra='balkon'),
    dict(w=52, wh=46, rh=24, mat='ahsap', roof=3, shape='dik',    chim=False, extra='çalı'),
    dict(w=66, wh=56, rh=24, mat='siva',  roof=4, shape='kırma',  chim=True,  extra='sundurma'),
    dict(w=46, wh=42, rh=18, mat='ahsap', roof=1, shape='beşik',  chim=False, extra='varil'),
    dict(w=74, wh=62, rh=32, mat='tas',   roof=5, shape='dik',    chim=True,  extra='balkon'),
    dict(w=58, wh=50, rh=22, mat='karisik', roof=0, shape='kırma', chim=True, extra='odun'),
    dict(w=50, wh=44, rh=26, mat='ahsap', roof=2, shape='dik',    chim=False, extra='çiçek'),
    dict(w=68, wh=58, rh=22, mat='karisik', roof=3, shape='kırıkçatı', chim=True, extra='sundurma'),
    dict(w=44, wh=40, rh=18, mat='siva',  roof=5, shape='beşik',  chim=False, extra='çalı'),
    dict(w=64, wh=52, rh=28, mat='tas',   roof=4, shape='beşik',  chim=True,  extra='fener'),
    dict(w=56, wh=48, rh=20, mat='karisik', roof=1, shape='tekeğim', chim=True, extra='varil'),
    dict(w=72, wh=58, rh=26, mat='ahsap', roof=5, shape='kırma',  chim=True,  extra='balkon'),
    dict(w=60, wh=50, rh=30, mat='siva',  roof=3, shape='dik',    chim=False, extra='odun'),
]


def build(spec, seed, back=False, side=False):
    """Evin hangi cephesinin çizileceğini belirler.

    back=True  → arka cephe, kapı karşı tarafta (yolu yukarıdan gelen evler)
    side=True  → yan cephe, kapı SOL kenarda (yolu yandan gelen evler; sağdan
                 gelenler için sprite yatay çevrilir)
    """
    random.seed(seed)
    pad = 18
    W = spec['w'] + pad * 2
    H = spec['rh'] + spec['wh'] + 30
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    h = House(d, spec)

    base = H - 8
    x0 = pad
    x1 = pad + spec['w']
    wall_top = base - spec['wh']
    roof_bot = wall_top + 2
    roof_top = roof_bot - spec['rh']

    # zemin gölgesi
    d.ellipse([x0 - 8, base - 4, x1 + 8, base + 6], fill=(0, 0, 0, 70))

    mat = spec['mat']
    if mat == 'karisik':
        split = wall_top + spec['wh'] // 2
        h.wall(x0, split, x1, base, 'tas')
        h.wall(x0, wall_top, x1, split + 1, 'ahsap')
        # ahşap kirişler
        for bx in range(x0 + 6, x1, 12):
            d.line([(bx, wall_top + 2), (bx, split)], fill=rgba(WOOD_T))
    else:
        h.wall(x0, wall_top, x1, base, mat)

    if spec['chim'] and not side:
        cx = x0 + int(spec['w'] * 0.72)
        h.chimney(cx, roof_top - 4, 7, spec['rh'] // 2 + 8)

    if side:
        # Çatıya yandan bakıyoruz: mahya yatay, yamuk siluet.
        narrow2 = int(spec['w'] * 0.84)
        nx0b = x0 + (spec['w'] - narrow2) // 2
        h.roof(nx0b, roof_top, nx0b + narrow2, roof_bot, 'kırma', ROOFS[spec['roof']], over=6)
    else:
        h.roof(x0, roof_top, x1, roof_bot, spec['shape'], ROOFS[spec['roof']])

    # Kapı duvar yüksekliğine oranlı: karakterle aynı ölçekte olsun.
    dh = max(24, int(spec['wh'] * 0.58))
    dw = max(16, int(dh * 0.66))
    dx = x0 + spec['w'] // 2 - dw // 2
    win_y = base - spec['wh'] + 7

    door_at = None

    if side:
        # Yan profil: evin YAN duvarı. Kapı karşı taraftadır, görünmez.
        # Daha dar bir cephe ve tek pencere ile "yandan bakıyoruz" hissi verir.
        narrow = int(spec['w'] * 0.84)
        nx0 = x0 + (spec['w'] - narrow) // 2
        nx1 = nx0 + narrow
        # dar duvarı yeniden boya (geniş duvarın üstüne)
        d.rectangle([x0 - 1, wall_top - 1, x1 + 1, base + 1], fill=(0, 0, 0, 0))
        h.wall(nx0, wall_top, nx1, base, 'tas' if mat == 'karisik' else mat)
        # yan duvarda iki pencere ve alt katta küçük bir bölme
        h.window(nx0 + 7, win_y, 10, 9, lit=random.random() > 0.3)
        h.window(nx1 - 17, win_y, 10, 9, lit=random.random() > 0.3)
        if spec['wh'] > 48:
            h.window(nx0 + narrow // 2 - 5, win_y + 17, 10, 9, lit=random.random() > 0.45)
        # yan saçak
        d.rectangle([nx0 - 3, wall_top + 3, nx1 + 3, wall_top + 6],
                    fill=rgba(ROOFS[spec['roof']][2]), outline=O)
        door_at = (nx0 + narrow * 0.32, base)
    elif back:
        door_at = (x0 + spec['w'] / 2, base - spec['wh'] * 0.55)
        # Arka cephe: kapı yok, pencereler eşit dağılır.
        count = 3 if spec['w'] > 60 else 2
        gap = spec['w'] // (count + 1)
        for k in range(1, count + 1):
            h.window(x0 + gap * k - 5, win_y, 10, 9, lit=random.random() > 0.25)
        # arka duvara dayalı odun/varil
        if spec['w'] > 55:
            h.woodpile(x0 + 4, base - 2)
    else:
        h.door(dx, base - dh, dw, dh, arch=(spec['roof'] % 2 == 0))
        door_at = (dx + dw / 2, base)
        slots = [x0 + 6, x1 - 16]
        if spec['w'] > 66:
            slots = [x0 + 5, x1 - 15]
        slots = [s for s in slots if abs(s - dx) > dw + 4]
        for sx in slots:
            h.window(sx, win_y, 10, 9, lit=random.random() > 0.18, arch=(spec['shape'] == 'dik'))

    # çatı arası penceresi
    if spec['rh'] > 24:
        h.window(x0 + spec['w'] // 2 - 4, roof_top + spec['rh'] // 2, 8, 7, lit=random.random() > 0.4)

    extra = 'yok' if (back or side) and spec['extra'] in ('sundurma', 'balkon') else spec['extra']
    if extra == 'balkon':
        h.balcony(x0 + 6, x1 - 6, wall_top + spec['wh'] // 2)
    elif extra == 'sundurma':
        h.porch(dx - 8, dx + dw + 8, base - dh - 14, 8, ROOFS[spec['roof']])
    elif extra == 'odun':
        h.woodpile(x1 + 1, base - 2)
    elif extra == 'çalı':
        h.bush(x0 - 6, base - 4)
        h.bush(x1 + 6, base - 3)
    elif extra == 'çiçek':
        h.flowerbed(x0 + 4, x1 - 4, base + 1)
    elif extra == 'varil':
        h.barrel(x1 + 3, base)
    elif extra == 'fener':
        h.lantern(x0 - 6, base)

    return im.resize((W * SCALE, H * SCALE), Image.NEAREST), {
        'w': W, 'h': H, 'doorX': door_at[0], 'doorY': door_at[1],
    }


def main():
    import json
    os.makedirs(OUT_DIR, exist_ok=True)
    manifest = {'scale': SCALE, 'houses': []}

    for i, spec in enumerate(SPECS, 1):
        n = f'{i:02d}'
        front, d_front = build(spec, 100 + i)
        back, d_back = build(spec, 100 + i, back=True)
        sidev, d_side = build(spec, 100 + i, side=True)
        front.save(f'{OUT_DIR}/house_{n}.png', optimize=True)
        back.save(f'{OUT_DIR}/house_{n}_b.png', optimize=True)
        sidev.save(f'{OUT_DIR}/house_{n}_s.png', optimize=True)
        manifest['houses'].append({'front': d_front, 'back': d_back, 'side': d_side})

    json.dump(manifest, open(f'{OUT_DIR}/manifest.json', 'w'), indent=1)
    print(f'{len(SPECS)} ev üretildi (3 cephe) -> {OUT_DIR}')


if __name__ == '__main__':
    main()
