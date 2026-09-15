// EZ Vampir Köylü — köy sahnesi (Phaser 3).
// Bu aşamada oyun mekaniği yok: harita, evler, dekor, karakterler, kamera.

const WORLD = { w: 2560, h: 1440 };            // 16:9
const CENTER = { x: WORLD.w / 2, y: WORLD.h / 2 + 70 };

const PLAZA_W = 1180;
const PLAZA_RX = PLAZA_W / 2;
const PLAZA_RY = PLAZA_RX * 0.62;

const HOUSE_COUNT = 16;

const UNIT_TYPES = {
  pawn: { idle: 8, run: 6 },
  warrior: { idle: 8, run: 6 },
  archer: { idle: 6, run: 4 },
  monk: { idle: 6, run: 4 },
};
const UNIT_COLORS = ['red', 'blue', 'purple', 'yellow', 'black'];

/** 16 ayrı görünüm: tip ve renk birlikte değişir, ikisi de aynı olan iki karakter yok. */
function lineup(count = 16) {
  const types = Object.keys(UNIT_TYPES);
  const out = [];
  for (let i = 0; i < count; i++) {
    out.push({
      key: `${types[i % types.length]}_${UNIT_COLORS[Math.floor(i / types.length) % UNIT_COLORS.length]}`,
      type: types[i % types.length],
    });
  }
  return out;
}

const DEMO_NAMES = [
  'EMREZL', 'MERT', 'SELİN', 'ARDA', 'ZEYNEP', 'ALPER', 'DENİZ', 'MELİSA',
  'CAN', 'AYŞE', 'BURAK', 'YUSUF', 'ECE', 'KEREM', 'NAZLI', 'TOLGA',
];

const rnd = (a, b) => a + Math.random() * (b - a);

/** Meydanın üstüne dekor düşmesin. margin>1 meydanın etrafında da boşluk bırakır. */
/**
 * Elips yayı üzerinde EŞİT ARALIKLI noktalar.
 * Eşit açı eşit mesafe demek olmadığı için uçlarda oyuncular sıkışıyordu.
 */
function arcPoints(count, rx, ry, a0, a1, samples = 600) {
  const pts = [];
  let len = 0;
  let prev = null;
  for (let i = 0; i <= samples; i++) {
    const a = a0 + ((a1 - a0) * i) / samples;
    const p = { x: Math.cos(a) * rx, y: Math.sin(a) * ry };
    if (prev) len += Math.hypot(p.x - prev.x, p.y - prev.y);
    pts.push({ ...p, len });
    prev = p;
  }

  const out = [];
  for (let k = 0; k < count; k++) {
    const target = (len * (k + 0.5)) / count;
    let j = 0;
    while (j < pts.length - 1 && pts[j].len < target) j++;
    out.push(pts[j]);
  }
  return out;
}

function insidePlaza(x, y, margin = 1.12) {
  const dx = (x - CENTER.x) / (PLAZA_RX * margin);
  const dy = (y - CENTER.y) / (PLAZA_RY * margin);
  return dx * dx + dy * dy < 1;
}
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

class VillageScene extends Phaser.Scene {
  constructor() {
    super('village');
    this.labels = [];
  }

  preload() {
    const A = '/assets';
    this.load.image('ground', `${A}/ground.png`);
    this.load.image('plaza', `${A}/plaza.png`);
    this.load.image('glow', `${A}/glow.png`);
    this.load.image('vignette', `${A}/vignette.png`);

    for (let i = 1; i <= HOUSE_COUNT; i++) {
      this.load.image(`house${i}`, `${A}/houses/house_${String(i).padStart(2, '0')}.png`);
    }
    for (const p of ['well', 'barrel', 'crate', 'fence', 'lantern', 'flower1', 'flower2', 'flower3', 'grass']) {
      this.load.image(p, `${A}/props/${p}.png`);
    }
    for (let i = 1; i <= 4; i++) this.load.image(`rock${i}`, `${A}/rock${i}.png`);

    this.load.spritesheet('tree', `${A}/tree.png`, { frameWidth: 192, frameHeight: 256 });
    this.load.spritesheet('bush', `${A}/bush.png`, { frameWidth: 128, frameHeight: 128 });
    this.load.spritesheet('fire', `${A}/fire.png`, { frameWidth: 64, frameHeight: 64 });

    for (const { key } of lineup(20)) {
      this.load.spritesheet(`${key}_idle`, `${A}/units/${key}_idle.png`, { frameWidth: 192, frameHeight: 192 });
      this.load.spritesheet(`${key}_run`, `${A}/units/${key}_run.png`, { frameWidth: 192, frameHeight: 192 });
    }
  }

  create() {
    this.makeAnims();
    this.buildGround();
    this.buildPlaza();
    this.buildVillage();
    this.buildForeground();
    this.buildCharacters();
    this.buildLighting();
    this.setupCamera();
  }

  makeAnims() {
    const add = (key, sheet, end, rate) =>
      this.anims.create({
        key,
        frames: this.anims.generateFrameNumbers(sheet, { start: 0, end }),
        frameRate: rate,
        repeat: -1,
      });

    add('tree', 'tree', 7, 7);
    add('bush', 'bush', 7, 6);
    add('fire', 'fire', 7, 10);

    for (const { key, type } of lineup(20)) {
      if (this.anims.exists(`${key}_idle`)) continue;
      add(`${key}_idle`, `${key}_idle`, UNIT_TYPES[type].idle - 1, 8);
      add(`${key}_run`, `${key}_run`, UNIT_TYPES[type].run - 1, 10);
    }
  }

  // ── zemin ──
  buildGround() {
    this.add
      .tileSprite(0, 0, WORLD.w, WORLD.h, 'ground')
      .setOrigin(0)
      .setTint(0xb2ae9c)
      .setDepth(-1000);

    // Dağınık toprak lekeleri, zemin tekdüze görünmesin
    for (let i = 0; i < 90; i++) {
      this.add
        .ellipse(rnd(0, WORLD.w), rnd(0, WORLD.h), rnd(60, 220), rnd(30, 110), 0x6b6349, rnd(0.08, 0.2))
        .setDepth(-990);
    }
  }

  // ── meydan ──
  buildPlaza() {
    const plaza = this.add.image(CENTER.x, CENTER.y, 'plaza').setDepth(-900);
    plaza.setDisplaySize(PLAZA_W, PLAZA_W * (plaza.height / plaza.width));

    // Merkezde dekoratif kuyu
    const well = this.add.image(CENTER.x, CENTER.y + 40, 'well').setOrigin(0.5, 1).setScale(1.5);
    well.setDepth(well.y);

    // Meydan çevresinde fenerler
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i / 10) * Math.PI * 2 + Math.PI / 10;
      const x = CENTER.x + Math.cos(a) * (PLAZA_RX + 70);
      const y = CENTER.y + Math.sin(a) * (PLAZA_RY + 55);
      const lamp = this.add.image(x, y, 'lantern').setOrigin(0.5, 1).setScale(0.95).setDepth(y);
      this.add.pointlight(x, y - lamp.displayHeight * 0.84, 0xffb862, 190, 0.6, 0.055).setDepth(y + 1);
    }
  }

  /** Bir evi ve çevresindeki küçük dekorları yerleştirir. */
  placeHouse(x, y, scale, houseIndex) {
    const h = this.add
      .image(x, y, `house${houseIndex}`)
      .setOrigin(0.5, 1)
      .setScale(scale)
      .setDepth(y);
    h.setTint(0xd8d6cc);

    // Evin yanına rastgele küçük dekor
    if (Math.random() < 0.55) {
      const side = Math.random() < 0.5 ? -1 : 1;
      const px = x + side * h.displayWidth * rnd(0.42, 0.62);
      const prop = pick(['barrel', 'crate', 'grass', 'flower1', 'flower2', 'flower3']);
      this.add.image(px, y + rnd(-6, 10), prop).setOrigin(0.5, 1).setScale(scale * 0.9).setDepth(y + 2);
    }
    return h;
  }

  // ── köy: iç halka, dış halka, köşe kümeleri ──
  buildVillage() {
    const ringHouses = (count, rx, ry, scale, phase = 0) => {
      for (let i = 0; i < count; i++) {
        const a = -Math.PI / 2 + phase + (i / count) * Math.PI * 2;
        const x = CENTER.x + Math.cos(a) * rx + rnd(-30, 30);
        const y = CENTER.y + Math.sin(a) * ry + rnd(-24, 24);
        this.placeHouse(x, y, scale * rnd(0.92, 1.08), 1 + ((i * 5 + count) % HOUSE_COUNT));
      }
    };

    // Meydanı saran ilk sıra
    ringHouses(14, PLAZA_RX + 470, PLAZA_RY + 330, 1.15);
    // Arkadaki ikinci sıra — daha küçük, derinlik hissi
    ringHouses(18, PLAZA_RX + 830, PLAZA_RY + 545, 0.95, Math.PI / 18);

    // Köşeleri de doldur
    const corners = [
      [230, 250], [520, 170], [2040, 190], [2330, 270],
      [180, 1130], [2380, 1120], [430, 1330], [2120, 1340],
    ];
    corners.forEach(([x, y], i) => {
      this.placeHouse(x + rnd(-40, 40), y + rnd(-30, 30), rnd(0.85, 1.1), 1 + ((i * 3 + 2) % HOUSE_COUNT));
    });

    this.buildFencesAndGreens();
  }

  buildFencesAndGreens() {
    // Evlerin arasını bağlayan çit hatları
    for (let i = 0; i < 28; i++) {
      const a = -Math.PI / 2 + (i / 28) * Math.PI * 2;
      const rx = PLAZA_RX + 300;
      const ry = PLAZA_RY + 215;
      const x = CENTER.x + Math.cos(a) * rx;
      const y = CENTER.y + Math.sin(a) * ry;
      if (insidePlaza(x, y, 1.18)) continue;
      this.add.image(x, y, 'fence').setOrigin(0.5, 1).setScale(1.05).setDepth(y);
    }

    // Ağaçlar: iki halka + serpme
    const treeAt = (x, y, s) => {
      const t = this.add.sprite(x, y, 'tree').setOrigin(0.5, 1).setScale(s);
      t.setDepth(y);
      t.play({ key: 'tree', startFrame: Math.floor(Math.random() * 8) });
      return t;
    };
    for (let i = 0; i < 22; i++) {
      const a = -Math.PI / 2 + (i / 22) * Math.PI * 2 + 0.1;
      const x = CENTER.x + Math.cos(a) * (PLAZA_RX + 640) + rnd(-70, 70);
      const y = CENTER.y + Math.sin(a) * (PLAZA_RY + 430) + rnd(-50, 50);
      if (!insidePlaza(x, y, 1.34)) treeAt(x, y, rnd(0.85, 1.15));
    }
    let placed = 0;
    for (let guard = 0; guard < 400 && placed < 26; guard++) {
      const x = rnd(60, WORLD.w - 60);
      const y = rnd(120, WORLD.h - 80);
      if (insidePlaza(x, y, 1.38)) continue;
      treeAt(x, y, rnd(0.75, 1.25));
      placed++;
    }

    // Çalı, taş, çiçek, ot serpiştirmesi
    const scatter = (key, n, animated = false) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const t = rnd(1.18, 2.1);
        const x = CENTER.x + Math.cos(a) * PLAZA_RX * t + rnd(-90, 90);
        const y = CENTER.y + Math.sin(a) * PLAZA_RY * t + rnd(-70, 70);
        if (x < 30 || x > WORLD.w - 30 || y < 60 || y > WORLD.h - 20) continue;
        if (insidePlaza(x, y, 1.16)) continue;
        if (animated) {
          const s = this.add.sprite(x, y, key).setOrigin(0.5, 1).setScale(rnd(0.8, 1.1));
          s.setDepth(y);
          s.play({ key, startFrame: Math.floor(Math.random() * 8) });
        } else {
          this.add.image(x, y, key).setOrigin(0.5, 1).setScale(rnd(0.8, 1.15)).setDepth(y);
        }
      }
    };
    scatter('bush', 20, true);
    scatter('rock1', 8);
    scatter('rock3', 8);
    scatter('flower1', 26);
    scatter('flower2', 26);
    scatter('flower3', 22);
    scatter('grass', 60);
    scatter('barrel', 10);
    scatter('crate', 9);
  }

  // ── ön plan: kameraya en yakın katman ──
  buildForeground() {
    const D = 5000;
    const bigTree = (x, y, s) => {
      const t = this.add.sprite(x, y, 'tree').setOrigin(0.5, 1).setScale(s).setDepth(D);
      t.play({ key: 'tree', startFrame: Math.floor(Math.random() * 8) });
    };
    bigTree(120, WORLD.h + 90, 2.0);
    bigTree(360, WORLD.h + 140, 2.3);
    bigTree(WORLD.w - 140, WORLD.h + 100, 2.1);
    bigTree(WORLD.w - 400, WORLD.h + 150, 2.35);

    for (let x = 60; x < WORLD.w; x += 150) {
      this.add
        .image(x, WORLD.h + 10, 'fence')
        .setOrigin(0.5, 1)
        .setScale(1.7)
        .setDepth(D - 10);
    }
    for (let i = 0; i < 14; i++) {
      this.add
        .image(rnd(0, WORLD.w), WORLD.h + rnd(-10, 40), pick(['grass', 'flower1', 'flower2', 'flower3']))
        .setOrigin(0.5, 1)
        .setScale(rnd(1.4, 2.0))
        .setDepth(D + 10);
    }
  }

  // ── karakterler: meydanda yarım daire ──
  buildCharacters() {
    this.characters = [];
    const looks = lineup(16);

    const arc = arcPoints(looks.length, PLAZA_RX * 0.94, PLAZA_RY * 0.94, Math.PI * 1.03, Math.PI * 1.97);

    looks.forEach((look, i) => {
      const x = CENTER.x + arc[i].x;
      const y = CENTER.y + arc[i].y + PLAZA_RY * 0.1;

      const sprite = this.add.sprite(x, y, `${look.key}_idle`).setOrigin(0.5, 0.78);
      sprite.setScale(1.7);
      sprite.setDepth(y);
      sprite.play(`${look.key}_idle`);
      sprite.setFlipX(x > CENTER.x);

      this.characters.push({ sprite, name: DEMO_NAMES[i] ?? `OYUNCU ${i + 1}`, lift: 132 + (i % 2) * 36 });
    });

    this.createLabels();
  }

  // ── ışık ──
  buildLighting() {
    const glow = this.add
      .image(CENTER.x, CENTER.y, 'glow')
      .setDepth(9000)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.6);
    glow.setDisplaySize(PLAZA_W * 2.1, PLAZA_W * 1.35);
    this.tweens.add({
      targets: glow,
      alpha: { from: 0.54, to: 0.68 },
      duration: 2800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.add
      .rectangle(0, 0, WORLD.w, WORLD.h, 0x1b2440, 0.36)
      .setOrigin(0)
      .setDepth(8900)
      .setBlendMode(Phaser.BlendModes.MULTIPLY);

    const vig = this.add.image(CENTER.x, WORLD.h / 2, 'vignette').setDepth(9100).setAlpha(0.85);
    vig.setDisplaySize(WORLD.w * 1.15, WORLD.h * 1.35);
  }

  // ── kamera ──
  setupCamera() {
    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD.w, WORLD.h);
    cam.setBackgroundColor('#14110c');
    this.fit();
    this.scale.on('resize', () => this.fit());

    this.input.on('wheel', (_p, _o, _dx, dy) => {
      const base = this.fitZoom();
      cam.setZoom(Phaser.Math.Clamp(cam.zoom - dy * 0.0009, base, base * 2.4));
    });
  }

  fitZoom() {
    const { width, height } = this.scale.gameSize;
    return Math.max(width / WORLD.w, height / WORLD.h);
  }

  fit() {
    const cam = this.cameras.main;
    cam.setZoom(this.fitZoom());
    cam.centerOn(WORLD.w / 2, WORLD.h / 2);
  }

  // ── isim etiketleri (ayrı HTML katmanı) ──
  createLabels() {
    const layer = document.getElementById('nameLayer');
    layer.innerHTML = '';
    this.labels = this.characters.map((c) => {
      const el = document.createElement('div');
      el.className = 'name-tag';
      el.textContent = c.name;
      layer.appendChild(el);
      return el;
    });
  }

  update() {
    const cam = this.cameras.main;
    this.characters.forEach((c, i) => {
      const el = this.labels[i];
      if (!el) return;
      const x = (c.sprite.x - cam.worldView.x) * cam.zoom;
      const y = (c.sprite.y - c.lift - cam.worldView.y) * cam.zoom;
      el.style.transform = `translate(-50%, -100%) translate(${x}px, ${y}px)`;
    });
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#14110c',
  pixelArt: true,
  roundPixels: true,
  scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [VillageScene],
});
