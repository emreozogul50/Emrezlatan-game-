"""16 köylü karakteri üretir: 8 kız, 8 erkek.

Her karakter parça parça çizilir (ten, saç, göz, gözlük, kıyafet, aksesuar),
böylece hepsi birbirinden ayırt edilebilir. Her biri için idle (4 kare) ve
yürüme (6 kare) sayfası çıkar. Önden görünüş; yürürken yön çevrilir.
"""
from PIL import Image, ImageDraw
import os, json

OUT = 'public/assets/chars'
SCALE = 4
FW, FH = 32, 44          # kare boyutu (piksel)

O = (0x16, 0x1c, 0x2e, 255)          # dış çizgi

SKIN = {
    'acik':  ((0xf2, 0xcf, 0xa8), (0xd6, 0xab, 0x81)),
    'orta':  ((0xdd, 0xac, 0x7e), (0xbb, 0x87, 0x5c)),
    'bugday':((0xc2, 0x8b, 0x5e), (0x9d, 0x6a, 0x42)),
    'koyu':  ((0x8a, 0x5a, 0x3a), (0x6a, 0x42, 0x28)),
}

HAIR = {
    'sari':   ((0xf0, 0xd07, 0x6a)[0:2] + (0x6a,), (0xc9, 0xa4, 0x3f)),
    'kumral': ((0xa9, 0x7a, 0x4a), (0x82, 0x5a, 0x33)),
    'siyah':  ((0x2f, 0x2a, 0x33), (0x1c, 0x18, 0x20)),
    'kizil':  ((0xb5, 0x52, 0x2c), (0x8c, 0x3a, 0x1c)),
    'kahve':  ((0x6d, 0x4a, 0x2c), (0x4e, 0x33, 0x1c)),
    'gri':    ((0xa8, 0xa8, 0xb0), (0x80, 0x80, 0x8a)),
}
HAIR['sari'] = ((0xf0, 0xd0, 0x6a), (0xc9, 0xa4, 0x3f))

CLOTH = {
    'kirmizi': ((0xc0, 0x43, 0x48), (0x93, 0x2e, 0x33)),
    'mavi':    ((0x3f, 0x6f, 0xb5), (0x2c, 0x51, 0x8a)),
    'yesil':   ((0x4b, 0x8a, 0x55), (0x35, 0x66, 0x3d)),
    'mor':     ((0x83, 0x5a, 0xb5), (0x61, 0x40, 0x8a)),
    'sari':    ((0xd8, 0xae, 0x45), (0xa8, 0x84, 0x2e)),
    'turkuaz': ((0x37, 0x9b, 0x96), (0x25, 0x74, 0x70)),
    'bordo':   ((0x8c, 0x33, 0x4a), (0x67, 0x22, 0x34)),
    'gri':     ((0x6d, 0x74, 0x80), (0x4e, 0x54, 0x5e)),
    'siyah':   ((0x3a, 0x35, 0x42), (0x26, 0x22, 0x2c)),
    'krem':    ((0xe0, 0xd2, 0xa8), (0xb5, 0xa5, 0x7c)),
}


def A(c, a=255):
    return (c[0], c[1], c[2], a)


class Painter:
    def __init__(self, d, spec):
        self.d = d
        self.s = spec

    # ── temel gövde ──
    def legs(self, ox, oy, swing):
        d = self.d
        pants = CLOTH[self.s['pants']]
        # swing: -1, 0, 1
        la = 0 if swing == 0 else (-1 if swing > 0 else 1)
        ra = -la
        d.rectangle([ox + 11, oy + 33, ox + 14, oy + 40 + la], fill=A(pants[1]), outline=O)
        d.rectangle([ox + 17, oy + 33, ox + 20, oy + 40 + ra], fill=A(pants[0]), outline=O)
        # ayakkabı
        d.rectangle([ox + 10, oy + 40 + la, ox + 15, oy + 42 + la], fill=A((0x3a, 0x2c, 0x1e)), outline=O)
        d.rectangle([ox + 16, oy + 40 + ra, ox + 21, oy + 42 + ra], fill=A((0x3a, 0x2c, 0x1e)), outline=O)

    def skirt(self, ox, oy):
        d = self.d
        c = CLOTH[self.s['cloth']]
        d.polygon([(ox + 9, oy + 40), (ox + 11, oy + 26), (ox + 20, oy + 26), (ox + 22, oy + 40)],
                  fill=A(c[0]), outline=O)
        d.polygon([(ox + 9, oy + 40), (ox + 11, oy + 26), (ox + 15, oy + 26), (ox + 14, oy + 40)],
                  fill=A(c[1]))
        d.rectangle([ox + 11, oy + 40, ox + 14, oy + 42], fill=A(SKIN[self.s['skin']][1]), outline=O)
        d.rectangle([ox + 17, oy + 40, ox + 20, oy + 42], fill=A(SKIN[self.s['skin']][1]), outline=O)

    def torso(self, ox, oy, arm):
        d = self.d
        c = CLOTH[self.s['cloth']]
        sk = SKIN[self.s['skin']]
        # gövde
        d.rectangle([ox + 9, oy + 19, ox + 22, oy + 34], fill=A(c[0]), outline=O)
        d.rectangle([ox + 9, oy + 19, ox + 15, oy + 34], fill=A(c[1]))
        # yaka
        d.rectangle([ox + 13, oy + 19, ox + 18, oy + 21], fill=A(c[1]))
        # kollar
        d.rectangle([ox + 6, oy + 20 + arm, ox + 9, oy + 30 + arm], fill=A(c[1]), outline=O)
        d.rectangle([ox + 22, oy + 20 - arm, ox + 25, oy + 30 - arm], fill=A(c[0]), outline=O)
        # eller
        d.rectangle([ox + 6, oy + 30 + arm, ox + 9, oy + 32 + arm], fill=A(sk[0]), outline=O)
        d.rectangle([ox + 22, oy + 30 - arm, ox + 25, oy + 32 - arm], fill=A(sk[0]), outline=O)
        # Gömlek üstüne yelek
        if self.s.get('yelek'):
            v = CLOTH[self.s['yelek']]
            d.polygon([(ox + 10, oy + 20), (ox + 14, oy + 20), (ox + 15, oy + 26),
                       (ox + 13, oy + 33), (ox + 10, oy + 33)], fill=A(v[1]), outline=O)
            d.polygon([(ox + 21, oy + 20), (ox + 17, oy + 20), (ox + 16, oy + 26),
                       (ox + 18, oy + 33), (ox + 21, oy + 33)], fill=A(v[0]), outline=O)
            for by in (oy + 26, oy + 30):
                d.point((ox + 13, by), fill=A((0xd8, 0xc0, 0x88)))

        # Papyon
        if self.s.get('papyon'):
            pc = CLOTH[self.s.get('papyonRenk', 'kirmizi')]
            d.polygon([(ox + 12, oy + 20), (ox + 15, oy + 22), (ox + 12, oy + 24)],
                      fill=A(pc[0]), outline=O)
            d.polygon([(ox + 19, oy + 20), (ox + 16, oy + 22), (ox + 19, oy + 24)],
                      fill=A(pc[0]), outline=O)
            d.rectangle([ox + 15, oy + 21, ox + 16, oy + 23], fill=A(pc[1]), outline=O)

        if self.s.get('belt'):
            d.rectangle([ox + 9, oy + 29, ox + 22, oy + 31], fill=A((0x4a, 0x33, 0x1c)), outline=O)
            d.rectangle([ox + 14, oy + 29, ox + 17, oy + 31], fill=A((0xd8, 0xc0, 0x88)))

    def head(self, ox, oy, blink):
        d = self.d
        sk = SKIN[self.s['skin']]
        # boyun
        d.rectangle([ox + 14, oy + 17, ox + 17, oy + 20], fill=A(sk[1]))
        # yüz
        d.rectangle([ox + 10, oy + 6, ox + 21, oy + 18], fill=A(sk[0]), outline=O)
        d.rectangle([ox + 10, oy + 6, ox + 13, oy + 18], fill=A(sk[1]))
        # gözler
        if blink:
            d.line([(ox + 13, oy + 12), (ox + 14, oy + 12)], fill=O)
            d.line([(ox + 18, oy + 12), (ox + 19, oy + 12)], fill=O)
        else:
            d.rectangle([ox + 13, oy + 11, ox + 14, oy + 13], fill=O)
            d.rectangle([ox + 18, oy + 11, ox + 19, oy + 13], fill=O)
            d.point((ox + 13, oy + 11), fill=(255, 255, 255, 255))
            d.point((ox + 18, oy + 11), fill=(255, 255, 255, 255))
        # ağız
        d.line([(ox + 15, oy + 15), (ox + 17, oy + 15)], fill=A(sk[1]))

        if self.s.get('sakal'):
            hc = HAIR[self.s['hair']]
            d.rectangle([ox + 12, oy + 15, ox + 20, oy + 18], fill=A(hc[1]))
            d.rectangle([ox + 14, oy + 14, ox + 18, oy + 16], fill=A(hc[1]))

    # ── saç biçimleri ──
    def hair(self, ox, oy):
        d = self.d
        st = self.s['sac']
        if st == 'kel':
            return
        c = HAIR[self.s['hair']]

        if st == 'uzun':
            d.rectangle([ox + 8, oy + 4, ox + 23, oy + 12], fill=A(c[0]), outline=O)
            d.rectangle([ox + 8, oy + 8, ox + 10, oy + 26], fill=A(c[1]), outline=O)
            d.rectangle([ox + 21, oy + 8, ox + 23, oy + 26], fill=A(c[0]), outline=O)
            d.rectangle([ox + 11, oy + 5, ox + 20, oy + 9], fill=A(c[0]))
        elif st == 'kisa':
            d.rectangle([ox + 9, oy + 4, ox + 22, oy + 10], fill=A(c[0]), outline=O)
            d.rectangle([ox + 9, oy + 7, ox + 12, oy + 13], fill=A(c[1]))
            d.rectangle([ox + 19, oy + 7, ox + 22, oy + 13], fill=A(c[0]))
        elif st == 'bob':
            d.rectangle([ox + 8, oy + 4, ox + 23, oy + 11], fill=A(c[0]), outline=O)
            d.rectangle([ox + 8, oy + 9, ox + 11, oy + 18], fill=A(c[1]), outline=O)
            d.rectangle([ox + 20, oy + 9, ox + 23, oy + 18], fill=A(c[0]), outline=O)
        elif st == 'at':   # at kuyruğu
            d.rectangle([ox + 9, oy + 4, ox + 22, oy + 10], fill=A(c[0]), outline=O)
            d.rectangle([ox + 21, oy + 8, ox + 25, oy + 24], fill=A(c[1]), outline=O)
            d.ellipse([ox + 20, oy + 6, ox + 25, oy + 11], fill=A(c[0]), outline=O)
        elif st == 'topuz':
            d.rectangle([ox + 9, oy + 5, ox + 22, oy + 11], fill=A(c[0]), outline=O)
            d.ellipse([ox + 12, oy - 1, ox + 19, oy + 6], fill=A(c[0]), outline=O)
            d.ellipse([ox + 14, oy + 0, ox + 17, oy + 3], fill=A(c[1]))
        elif st == 'ayrik':   # ortadan ayrık
            d.polygon([(ox + 9, oy + 11), (ox + 9, oy + 5), (ox + 15, oy + 3), (ox + 15, oy + 9)],
                      fill=A(c[1]), outline=O)
            d.polygon([(ox + 22, oy + 11), (ox + 22, oy + 5), (ox + 16, oy + 3), (ox + 16, oy + 9)],
                      fill=A(c[0]), outline=O)
            d.rectangle([ox + 9, oy + 9, ox + 11, oy + 14], fill=A(c[1]))
            d.rectangle([ox + 20, oy + 9, ox + 22, oy + 14], fill=A(c[0]))
        elif st == 'dalgali':
            d.rectangle([ox + 8, oy + 4, ox + 23, oy + 11], fill=A(c[0]), outline=O)
            for i, yy in enumerate(range(oy + 10, oy + 26, 4)):
                off = 1 if i % 2 == 0 else -1
                d.ellipse([ox + 5 + off, yy, ox + 10 + off, yy + 5], fill=A(c[1]), outline=O)
                d.ellipse([ox + 21 - off, yy, ox + 26 - off, yy + 5], fill=A(c[0]), outline=O)

    # ── aksesuarlar ──
    def accessory(self, ox, oy):
        d = self.d
        acc = self.s.get('aksesuar')
        if acc == 'gozluk':
            d.rectangle([ox + 11, oy + 10, ox + 15, oy + 14], outline=A((0x2a, 0x2a, 0x32)), width=1)
            d.rectangle([ox + 17, oy + 10, ox + 21, oy + 14], outline=A((0x2a, 0x2a, 0x32)), width=1)
            d.line([(ox + 15, oy + 12), (ox + 17, oy + 12)], fill=A((0x2a, 0x2a, 0x32)))
            d.rectangle([ox + 12, oy + 11, ox + 14, oy + 13], fill=(0xbf, 0xe4, 0xf5, 110))
            d.rectangle([ox + 18, oy + 11, ox + 20, oy + 13], fill=(0xbf, 0xe4, 0xf5, 110))
        elif acc == 'cadi':
            hc = (0x2e, 0x28, 0x3c)
            d.polygon([(ox + 5, oy + 2), (ox + 26, oy + 2), (ox + 16, oy - 14)], fill=A(hc), outline=O)
            d.rectangle([ox + 3, oy + 1, ox + 28, oy + 4], fill=A((0x22, 0x1d, 0x2e)), outline=O)
            d.rectangle([ox + 10, oy - 3, ox + 21, oy + 0], fill=A((0x8b, 0x5f, 0xc0)))
            d.ellipse([ox + 14, oy - 3, ox + 17, oy + 0], fill=A((0xe8, 0xc3, 0x4a)))
        elif acc == 'basortu':
            c = CLOTH[self.s['cloth']]
            # alın bandı
            d.rectangle([ox + 9, oy + 3, ox + 22, oy + 8], fill=A(c[0]), outline=O)
            # yanlardan omuza inen kumaş — yüzü açıkta bırakır
            d.polygon([(ox + 9, oy + 5), (ox + 12, oy + 5), (ox + 11, oy + 24), (ox + 7, oy + 22)],
                      fill=A(c[1]), outline=O)
            d.polygon([(ox + 22, oy + 5), (ox + 19, oy + 5), (ox + 20, oy + 24), (ox + 24, oy + 22)],
                      fill=A(c[0]), outline=O)
        elif acc == 'kasket':
            c = CLOTH[self.s['pants']]
            d.rectangle([ox + 9, oy + 2, ox + 22, oy + 7], fill=A(c[0]), outline=O)
            d.rectangle([ox + 19, oy + 6, ox + 26, oy + 8], fill=A(c[1]), outline=O)
        elif acc == 'sapka':
            d.rectangle([ox + 6, oy + 5, ox + 25, oy + 7], fill=A((0x5d, 0x44, 0x26)), outline=O)
            d.rectangle([ox + 10, oy + 0, ox + 21, oy + 6], fill=A((0x7a, 0x5a, 0x36)), outline=O)
            d.rectangle([ox + 10, oy + 4, ox + 21, oy + 6], fill=A((0x4a, 0x33, 0x1c)))


def draw_frame(spec, pose):
    """pose: (bob, arm, swing, blink)"""
    bob, arm, swing, blink = pose
    im = Image.new('RGBA', (FW, FH), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    p = Painter(d, spec)
    ox, oy = 0, bob

    # gölge
    d.ellipse([8, FH - 5, 24, FH - 1], fill=(0, 0, 0, 70))

    if spec['etek']:
        p.skirt(ox, oy)
    else:
        p.legs(ox, oy, swing)
    p.torso(ox, oy, arm)
    p.head(ox, oy, blink)
    if spec.get('aksesuar') != 'basortu':
        p.hair(ox, oy)
    p.accessory(ox, oy)
    return im


def sheet(spec, poses):
    im = Image.new('RGBA', (FW * len(poses), FH), (0, 0, 0, 0))
    for i, pose in enumerate(poses):
        im.alpha_composite(draw_frame(spec, pose), (i * FW, 0))
    return im.resize((im.width * SCALE, im.height * SCALE), Image.NEAREST)


IDLE = [(0, 0, 0, False), (1, 0, 0, False), (0, 0, 0, False), (1, 0, 0, True)]
WALK = [(0, 1, 1, False), (1, 1, 1, False), (0, 0, 0, False),
        (0, -1, -1, False), (1, -1, -1, False), (0, 0, 0, False)]


CHARACTERS = [
    # ── kızlar ──
    dict(id='k1', ad='Sarışın', cins='kiz', skin='acik',  hair='sari',   sac='uzun',    cloth='mor',     pants='mor',     etek=True,  aksesuar=None),
    dict(id='k2', ad='Esmer',   cins='kiz', skin='koyu',  hair='siyah',  sac='dalgali', cloth='turkuaz', pants='turkuaz', etek=True,  aksesuar=None),
    dict(id='k3', ad='Gözlüklü',cins='kiz', skin='acik',  hair='kahve',  sac='bob',     cloth='yesil',   pants='yesil',   etek=True,  aksesuar='gozluk'),
    dict(id='k4', ad='Kumral',  cins='kiz', skin='orta',  hair='kumral', sac='at',      cloth='kirmizi', pants='kirmizi', etek=True,  aksesuar=None),
    dict(id='k5', ad='Kızıl',   cins='kiz', skin='acik',  hair='kizil',  sac='uzun',    cloth='mavi',    pants='mavi',    etek=True,  aksesuar=None),
    dict(id='k6', ad='Cadı',    cins='kiz', skin='acik',  hair='siyah',  sac='uzun',    cloth='siyah',   pants='siyah',   etek=True,  aksesuar='cadi'),
    dict(id='k7', ad='Başörtülü',cins='kiz',skin='bugday',hair='siyah',  sac='kisa',    cloth='bordo',   pants='bordo',   etek=True,  aksesuar='basortu'),
    dict(id='k8', ad='Topuzlu', cins='kiz', skin='orta',  hair='kahve',  sac='topuz',   cloth='sari',    pants='sari',    etek=True,  aksesuar=None),

    # ── erkekler ──
    dict(id='e1', ad='Esmer',   cins='erkek', skin='koyu',  hair='siyah',  sac='kisa',  cloth='yesil',   pants='siyah', etek=False, aksesuar=None, belt=True),
    dict(id='e2', ad='Gözlüklü',cins='erkek', skin='acik',  hair='kahve',  sac='kisa',  cloth='mavi',    pants='gri',   etek=False, aksesuar='gozluk', belt=True),
    dict(id='e3', ad='Kumral',  cins='erkek', skin='orta',  hair='kumral', sac='kisa',  cloth='bordo',   pants='siyah', etek=False, aksesuar=None, belt=True),
    dict(id='e4', ad='Ayrık saç',cins='erkek',skin='acik',  hair='siyah',  sac='ayrik', cloth='krem',    pants='mavi',  etek=False, aksesuar=None, belt=True),
    dict(id='e5', ad='Kel',     cins='erkek', skin='bugday',hair='siyah',  sac='kel',   cloth='turkuaz', pants='gri',   etek=False, aksesuar=None, belt=True),
    dict(id='e6', ad='Sakallı', cins='erkek', skin='orta',  hair='kizil',  sac='kisa',  cloth='gri',     pants='siyah', etek=False, aksesuar=None, belt=True, sakal=True),
    dict(id='e7', ad='Kasketli',cins='erkek', skin='acik',  hair='kumral', sac='kisa',  cloth='kirmizi', pants='siyah', etek=False, aksesuar='kasket', belt=True),
    dict(id='e9', ad='Papyonlu', cins='erkek', skin='koyu', hair='siyah', sac='kel',
         cloth='krem', pants='siyah', etek=False, aksesuar=None, belt=False,
         yelek='siyah', papyon=True, papyonRenk='bordo'),

    dict(id='e8', ad='Şapkalı', cins='erkek', skin='orta',  hair='gri',    sac='kisa',  cloth='mor',     pants='gri',   etek=False, aksesuar='sapka', belt=True),
]


def main():
    os.makedirs(OUT, exist_ok=True)
    manifest = []
    for c in CHARACTERS:
        sheet(c, IDLE).save(f'{OUT}/{c["id"]}_idle.png', optimize=True)
        sheet(c, WALK).save(f'{OUT}/{c["id"]}_walk.png', optimize=True)
        draw_frame(c, (0, 0, 0, False)).resize((FW * 3, FH * 3), Image.NEAREST).save(
            f'{OUT}/{c["id"]}_port.png', optimize=True
        )
        manifest.append({'id': c['id'], 'ad': c['ad'], 'cins': c['cins']})

    json.dump(
        {'frameWidth': FW * SCALE, 'frameHeight': FH * SCALE, 'idle': len(IDLE), 'walk': len(WALK),
         'chars': manifest},
        open(f'{OUT}/manifest.json', 'w'), ensure_ascii=False, indent=1
    )
    print(f'{len(CHARACTERS)} karakter üretildi -> {OUT}')


if __name__ == '__main__':
    main()
