// Oyun sahnesini Phaser ile çizer. Oyun durumunu dışarıdan alır, mantık içermez.
// Eski DOM sahnesi duruyor; ayarlardan geçiş yapılabiliyor.

// Kadraj Town of Salem düzenine göre: kamera yakın, evler meydanın dibinde.
const WORLD = { w: 2000, h: 1125 };
const CENTER = { x: WORLD.w / 2, y: WORLD.h / 2 + 40 };
const PLAZA_W = 560;
const PLAZA_RX = PLAZA_W / 2;
const PLAZA_RY = PLAZA_RX * 0.62;
const HOUSE_COUNT = 16;
const SEATS = 16;

// Karakterler tools/make_characters.py ile üretildi: 8 kız, 8 erkek.
const CHAR_IDS = ["k1", "k2", "k3", "k4", "k5", "k6", "k7", "k8", "e1", "e2", "e3", "e4", "e5", "e6", "e7", "e9", "e8"];
const CHAR_FRAME = { w: 128, h: 176, idle: 4, walk: 6 };

const charKey = (id) => (CHAR_IDS.includes(id) ? id : CHAR_IDS[0]);

const rnd = (a, b) => a + Math.random() * (b - a);

const escapeText = (t) =>
  String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const pickOne = (arr) => arr[Math.floor(Math.random() * arr.length)];

/** Nokta herhangi bir yolun ya da kapı sahanlığının üstüne düşüyor mu? */
function onAnyPath(x, y, pad = 70) {
  for (let i = 0; i < SEATS; i++) {
    const g = seatGeometry(i);
    const pts = [g.door, ...g.path];
    for (let k = 0; k < pts.length - 1; k++) {
      const a = pts[k];
      const b = pts[k + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len2 = dx * dx + dy * dy || 1;
      let t = ((x - a.x) * dx + (y - a.y) * dy) / len2;
      t = Math.max(0, Math.min(1, t));
      if (Math.hypot(x - (a.x + dx * t), y - (a.y + dy * t)) < pad) return true;
    }
  }
  return false;
}

function insidePlaza(x, y, margin = 1.12) {
  const dx = (x - CENTER.x) / (PLAZA_RX * margin);
  const dy = (y - CENTER.y) / (PLAZA_RY * margin);
  return dx * dx + dy * dy < 1;
}

/** Elips yayında eşit aralıklı noktalar (eşit açı eşit mesafe değildir). */
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

// ── koltuk geometrisi ────────────────────────────────────
//
// Evler önden çizili; kapıları hep AŞAĞI bakıyor. Bu yüzden her evin önünde
// Ev MERKEZİNDEN değil KAPISINDAN konumlanır; yol her zaman kapıya oturur.

const WALK_LEN = 378;      // meydandan eve giden yol — meydan küçüldü, yol uzadı
const RIM_PAD = 8;
const ROAD_W = 62;         // yol genişliği — aralarında eşit boşluk kalsın

const HOUSE_RX = PLAZA_W / 2 + WALK_LEN;
const HOUSE_RY = (PLAZA_W / 2) * 0.62 + WALK_LEN * 0.78;


// Evler ve yol uçları ayrı ayrı EŞİT ARALIKLI diziliyor.
// Böylece yollar hem evde hem meydanda aynı boşlukla duruyor.
let houseRing = null;
let rimRing = null;

function houseSpots() {
  if (houseRing) return houseRing;
  houseRing = arcPoints(SEATS, HOUSE_RX, HOUSE_RY, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2).map((p) => ({
    x: CENTER.x + p.x,
    y: CENTER.y + p.y * (p.y > 0 ? 1.3 : 1.0),   // alttakiler kadrajın altına yakın
  }));
  return houseRing;
}

function rimSpots() {
  if (rimRing) return rimRing;
  rimRing = arcPoints(
    SEATS, PLAZA_RX + RIM_PAD, PLAZA_RY + RIM_PAD, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2
  ).map((p) => ({ x: CENTER.x + p.x, y: CENTER.y + p.y }));
  return rimRing;
}

const HOUSE_SCALE = 0.72;
const ART_SCALE = 3;          // ev sprite'ları 3x üretildi

// tools/make_houses.py her cephenin kapı koordinatını manifest'e yazar.
let houseMeta = null;
function setHouseMeta(m) { houseMeta = m; }

const seatAngle = (i) => -Math.PI / 2 + (i / SEATS) * Math.PI * 2;


/**
 * Sprite içindeki kaynak pikseli dünya koordinatına çevirir.
 * Sprite origin (0.5, 1): alt-orta nokta evin konumudur.
 */
function spritePoint(house, info, flip) {
  const k = ART_SCALE * HOUSE_SCALE;
  const dx = (info.doorX - info.w / 2) * k * (flip ? -1 : 1);
  const dy = (info.h - info.doorY) * k;
  return { x: house.x + dx, y: house.y - dy };
}

/**
 * Yol: evin kapısından meydanın kenarına TEK DÜZ HAT.
 * Kapı yolun geldiği yöne bakar; ev cephesi buna göre seçilir:
 *   yol aşağıdan  → ön cephe
 *   yol yukarıdan → arka cephe (kapı görünmez)
 *   yol yandan    → yan cephe (kapı kenarda; sağdan gelirse sprite çevrilir)
 */
/**
 * Ev, MERKEZİNDEN değil KAPISINDAN konumlandırılır.
 * Halka üzerindeki nokta kapının duracağı yerdir; sprite ona göre kaydırılır.
 * Böylece yol her zaman kapıya oturur, evin gövdesi kadrajdan taşsa bile.
 */
function seatGeometry(i) {
  const idx = i % SEATS;
  const anchor = houseSpots()[idx];      // kapının duracağı nokta
  const rim = rimSpots()[idx];

  const dirX = rim.x - anchor.x;
  const dirY = rim.y - anchor.y;

  let facing;
  let flip = false;
  if (Math.abs(dirX) > Math.abs(dirY) * 1.15) {
    facing = 'side';
    flip = dirX > 0;                     // yol sağdan geliyorsa kapı sağda
  } else {
    facing = dirY > 0 ? 'front' : 'back';
  }

  const info = houseMeta?.houses?.[idx]?.[facing];
  let house = anchor;

  if (info) {
    const k = ART_SCALE * HOUSE_SCALE;
    const offX = (info.doorX - info.w / 2) * k * (flip ? -1 : 1);
    const offY = (info.h - info.doorY) * k;
    house = { x: anchor.x - offX, y: anchor.y + offY };
  }

  return { house, rim, door: anchor, facing, flip, back: facing === 'back', apron: rim, path: [rim] };
}

/**
 * Oyuncu kendi yolunun üstünde, bordürün hemen dışında durur.
 * Böylece herkes kendi evine giden yolun başında bekliyor olur.
 */
function standPoint(seat) {
  // Yolun meydanla birleştiği nokta.
  const rim = rimSpots()[seat % SEATS];
  return { x: rim.x, y: rim.y };
}

const CENTER_SPOT = { x: CENTER.x, y: CENTER.y + 14 };   // taş çemberin tam ortası

class GameVillage extends Phaser.Scene {
  constructor(host) {
    super('village');
    this.host = host;
    this.actors = new Map();
  }

  preload() {
    const A = '/assets';
    this.load.image('ground', `${A}/ground.png`);
    this.load.image('plaza', `${A}/plaza.png`);
    this.load.image('vignette', `${A}/vignette.png`);
    this.load.image('walkway', `${A}/props/walkway.png`);

    for (let i = 1; i <= HOUSE_COUNT; i++) {
      const n = String(i).padStart(2, '0');
      this.load.image(`house${i}`, `${A}/houses/house_${n}.png`);
      this.load.image(`house${i}_b`, `${A}/houses/house_${n}_b.png`);
      this.load.image(`house${i}_s`, `${A}/houses/house_${n}_s.png`);
    }
    this.load.json('houseMeta', `${A}/houses/manifest.json`);
    for (const p of ['barrel', 'crate', 'fence', 'flower1', 'flower2', 'flower3', 'grass']) {
      this.load.image(p, `${A}/props/${p}.png`);
    }
    for (let i = 1; i <= 4; i++) this.load.image(`rock${i}`, `${A}/rock${i}.png`);

    this.load.spritesheet('fireball', `${A}/fireball.png`, { frameWidth: 96, frameHeight: 96 });
    this.load.spritesheet('burst', `${A}/burst.png`, { frameWidth: 160, frameHeight: 160 });
    this.load.spritesheet('puff', `${A}/puff.png`, { frameWidth: 112, frameHeight: 112 });
    this.load.spritesheet('ghost', `${A}/ghost.png`, { frameWidth: 80, frameHeight: 88 });
    this.load.spritesheet('tree', `${A}/tree.png`, { frameWidth: 192, frameHeight: 256 });
    this.load.spritesheet('bush', `${A}/bush.png`, { frameWidth: 128, frameHeight: 128 });

    for (const id of CHAR_IDS) {
      this.load.spritesheet(`${id}_idle`, `${A}/chars/${id}_idle.png`,
        { frameWidth: CHAR_FRAME.w, frameHeight: CHAR_FRAME.h });
      this.load.spritesheet(`${id}_walk`, `${A}/chars/${id}_walk.png`,
        { frameWidth: CHAR_FRAME.w, frameHeight: CHAR_FRAME.h });
    }
  }

  create() {
    setHouseMeta(this.cache.json.get('houseMeta'));
    this.makeAnims();
    this.buildWorld();
    this.buildLighting();
    this.setupCamera();
    this.host.onReady(this);
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
    this.anims.create({
      key: 'puff',
      frames: this.anims.generateFrameNumbers('puff', { start: 0, end: 3 }),
      frameRate: 9,
      repeat: 1,
    });
    add('ghost', 'ghost', 3, 6);
    add('fireball', 'fireball', 5, 14);
    this.anims.create({
      key: 'burst',
      frames: this.anims.generateFrameNumbers('burst', { start: 0, end: 4 }),
      frameRate: 14,
      repeat: 0,
    });
    for (const id of CHAR_IDS) {
      if (this.anims.exists(`${id}_idle`)) continue;
      add(`${id}_idle`, `${id}_idle`, CHAR_FRAME.idle - 1, 5);
      add(`${id}_walk`, `${id}_walk`, CHAR_FRAME.walk - 1, 9);
    }
  }

  buildWorld() {
    this.add.tileSprite(0, 0, WORLD.w, WORLD.h, 'ground').setOrigin(0).setTint(0xb2ae9c).setDepth(-1000);
    for (let i = 0; i < 90; i++) {
      this.add
        .ellipse(rnd(0, WORLD.w), rnd(0, WORLD.h), rnd(60, 220), rnd(30, 110), 0x6b6349, rnd(0.08, 0.2))
        .setDepth(-990);
    }

    const plaza = this.add.image(CENTER.x, CENTER.y, 'plaza').setDepth(-910);
    plaza.setDisplaySize(PLAZA_W, PLAZA_W * (plaza.height / plaza.width));

    // Meydanın sınırı: taş bordür. Normal oyuncular bunun dışında durur.
    const KERB = 40;
    for (let i = 0; i < KERB; i++) {
      const a = (i / KERB) * Math.PI * 2;
      const x = CENTER.x + Math.cos(a) * (PLAZA_RX + 6);
      const y = CENTER.y + Math.sin(a) * (PLAZA_RY + 4);
      this.add.ellipse(x, y + 3, 26, 15, 0x3f3526, 0.55).setDepth(-902);
      this.add.ellipse(x, y, 24, 13, 0x9d927c).setDepth(-900);
      this.add.ellipse(x, y - 2, 19, 7, 0xb8ac92).setDepth(-899);
    }

    // Meydan boş: idam tahtası, kuyu ve fener yok.

    // Patikalar evlerden ÖNCE çizilir ki evlerin altından geçsinler.
    this.drawPaths();

    // Her koltuğun kendi evi. 16 tasarım, 16 koltuk: hiçbiri tekrar etmiyor.
    this.houseSlots = [];
    for (let i = 0; i < SEATS; i++) {
      const g = seatGeometry(i);
      const house = this.placeHouse(g.house.x, g.house.y, HOUSE_SCALE, i + 1, g.facing, g.flip);
      this.houseSlots.push({ geo: g, house });
    }
    // Arka plan evi yok: oyuncunun hareket alanı önceliklidir.

    this.buildGreens();
    this.buildForeground();
  }

  placeHouse(x, y, scale, idx, facing = 'front', flip = false) {
    const suffix = facing === 'back' ? '_b' : facing === 'side' ? '_s' : '';
    const h = this.add.image(x, y, `house${idx}${suffix}`).setOrigin(0.5, 1).setScale(scale).setDepth(y);
    if (flip) h.setFlipX(true);
    h.setTint(0xd8d6cc);
    h.slotIndex = idx;
    if (Math.random() < 0.5) {
      const side = Math.random() < 0.5 ? -1 : 1;
      this.add
        .image(x + side * h.displayWidth * rnd(0.42, 0.62), y + rnd(-6, 10),
          pickOne(['barrel', 'crate', 'grass', 'flower1', 'flower2', 'flower3']))
        .setOrigin(0.5, 1)
        .setScale(scale * 0.9)
        .setDepth(y + 2);
    }
    return h;
  }

  /** Evin kapısından meydana tek düz yol. */
  drawPaths() {
    for (let i = 0; i < SEATS; i++) {
      const g = seatGeometry(i);
      const dist = Math.hypot(g.rim.x - g.door.x, g.rim.y - g.door.y);
      if (dist < 6) continue;

      const road = this.add.tileSprite(g.door.x, g.door.y, dist, ROAD_W, 'walkway');
      road.setOrigin(0, 0.5);
      road.setRotation(Math.atan2(g.rim.y - g.door.y, g.rim.x - g.door.x));
      road.setDepth(-950);
    }
  }

  buildGreens() {
    const treeAt = (x, y, s) => {
      const t = this.add.sprite(x, y, 'tree').setOrigin(0.5, 1).setScale(s).setDepth(y);
      t.play({ key: 'tree', startFrame: Math.floor(Math.random() * 8) });
    };
    // Ağaçlar sadece ev halkalarının dışında ve boşluklarda.
    let placed = 0;
    for (let g = 0; g < 600 && placed < 16; g++) {
      const x = rnd(40, WORLD.w - 40);
      const y = rnd(80, WORLD.h - 40);
      if (insidePlaza(x, y, 1.45) || onAnyPath(x, y, 80)) continue;
      const r = Math.hypot((x - CENTER.x) / HOUSE_RX, (y - CENTER.y) / HOUSE_RY);
      if (r < 1.34) continue;          // ev halkasının ve önünün üstüne düşmesin
      treeAt(x, y, rnd(0.7, 1.05));
      placed++;
    }

    const scatter = (key, n, animated = false) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const t = rnd(1.12, 1.85);
        const x = CENTER.x + Math.cos(a) * PLAZA_RX * t + rnd(-60, 60);
        const y = CENTER.y + Math.sin(a) * PLAZA_RY * t + rnd(-50, 50);
        if (x < 30 || x > WORLD.w - 30 || y < 60 || y > WORLD.h - 20) continue;
        if (insidePlaza(x, y, 1.1) || onAnyPath(x, y, 95)) continue;
        if (animated) {
          const s = this.add.sprite(x, y, key).setOrigin(0.5, 1).setScale(rnd(0.8, 1.1)).setDepth(y);
          s.play({ key, startFrame: Math.floor(Math.random() * 8) });
        } else {
          this.add.image(x, y, key).setOrigin(0.5, 1).setScale(rnd(0.8, 1.15)).setDepth(y);
        }
      }
    };
    scatter('bush', 18, true);
    scatter('rock1', 4);
    scatter('rock3', 4);
    scatter('flower1', 24);
    scatter('flower2', 24);
    scatter('flower3', 20);
    scatter('grass', 55);
    scatter('barrel', 9);
    scatter('crate', 8);

    // Evler arasındaki boşluklara kısa çit parçaları
    for (let i = 0; i < SEATS; i++) {
      const a = seatAngle(i + 0.5);
      const x = CENTER.x + Math.cos(a) * (HOUSE_RX - 40);
      const y = CENTER.y + Math.sin(a) * (HOUSE_RY - 30);
      if (onAnyPath(x, y, 130)) continue;
      this.add.image(x, y, 'fence').setOrigin(0.5, 1).setScale(0.95).setDepth(y);
    }
  }

  buildForeground() {
    const D = 5000;
    const big = (x, y, s) => {
      const t = this.add.sprite(x, y, 'tree').setOrigin(0.5, 1).setScale(s).setDepth(D);
      t.play({ key: 'tree', startFrame: Math.floor(Math.random() * 8) });
    };
    big(70, WORLD.h + 70, 1.7);
    big(300, WORLD.h + 120, 1.9);
    big(WORLD.w - 80, WORLD.h + 80, 1.8);
    big(WORLD.w - 320, WORLD.h + 130, 2.0);
  }

  buildLighting() {
    // Işık kaynağı yok. Sadece hafif gece tonu ve kenar karartması.
    this.nightTint = this.add
      .rectangle(0, 0, WORLD.w, WORLD.h, 0x2b3c66, 0.14)
      .setOrigin(0)
      .setDepth(8900)
      .setBlendMode(Phaser.BlendModes.MULTIPLY);

    const vig = this.add.image(CENTER.x, WORLD.h / 2, 'vignette').setDepth(9100).setAlpha(0.55);
    vig.setDisplaySize(WORLD.w * 1.15, WORLD.h * 1.35);
  }

  setupCamera() {
    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD.w, WORLD.h);
    cam.setBackgroundColor('#14110c');
    this.fit();
    this.scale.on('resize', () => this.fit());
  }

  fit() {
    const cam = this.cameras.main;
    const { width, height } = this.scale.gameSize;
    cam.setZoom(Math.max(width / WORLD.w, height / WORLD.h));
    cam.centerOn(WORLD.w / 2, WORLD.h / 2);
  }

  /**
   * Karakteri verilen nokta dizisi boyunca yürütür.
   * Her adım ayrı bir tween; bittiğinde bir sonrakine geçer.
   */
  walkPath(actor, points, onDone) {
    const s = actor.sprite;
    let i = 0;

    const step = () => {
      if (i >= points.length) {
        s.play(`${actor.look}_idle`, true);
        onDone?.();
        return;
      }
      const p = points[i++];
      const dist = Math.hypot(p.x - s.x, p.y - s.y);
      if (dist < 3) return step();

      s.setFlipX(p.x < s.x);
      s.play(`${actor.look}_walk`, true);

      actor.tween = this.tweens.add({
        targets: s,
        x: p.x,
        y: p.y,
        duration: Math.max(220, dist * 3.4),
        ease: 'Linear',
        onUpdate: () => { if (!actor.lockDepth) s.setDepth(s.y); },
        onComplete: () => {
          actor.tween = null;
          step();
        },
      });
    };

    step();
  }

  /** Kapıda kısa giriş: küçülerek kaybolur. */
  enterHouse(actor, onDone) {
    const s = actor.sprite;
    s.play(`${actor.look}_idle`, true);
    this.tweens.add({
      targets: s,
      scaleX: 0.34,
      scaleY: 0.34,
      alpha: 0,
      duration: 420,
      delay: 160,
      ease: 'Sine.easeIn',
      onComplete: () => {
        s.setVisible(false);
        s.setScale(0.52);
        onDone?.();
      },
    });
  }

  /** Kapıdan çıkış: belirerek büyür. */
  exitHouse(actor, at, onDone) {
    const s = actor.sprite;
    s.setPosition(at.x, at.y);
    s.setDepth(at.y);
    s.setScale(0.34);
    s.setAlpha(0);
    s.setVisible(true);
    s.play(`${actor.look}_idle`, true);
    this.tweens.add({
      targets: s,
      scaleX: 0.52,
      scaleY: 0.52,
      alpha: 1,
      duration: 380,
      ease: 'Sine.easeOut',
      onComplete: onDone,
    });
  }

  /** Toz bulutu — ölüm anında. */
  puffAt(x, y, scale = 1) {
    const s = this.add.sprite(x, y - 40, 'puff').setDepth(y + 300).setScale(scale);
    s.play('puff');
    s.once('animationcomplete', () => s.destroy());
  }

  /** Süzülüp kaybolan hayalet. */
  ghostAt(x, y) {
    const g = this.add.sprite(x, y - 50, 'ghost').setDepth(y + 320).setAlpha(0).setScale(0.9);
    g.play('ghost');
    this.tweens.add({ targets: g, alpha: 0.95, duration: 300 });
    this.tweens.add({
      targets: g,
      y: y - 300,
      alpha: 0,
      duration: 3200,
      delay: 350,
      ease: 'Sine.easeOut',
      onComplete: () => g.destroy(),
    });
  }

  /** Gece ölümü: kısa bir sarsıntı, toz, hayalet; sonra soluk yatan sprite. */
  playDeath(actor) {
    const s = actor.sprite;
    const { x, y } = s;
    s.setDepth(8000);
    actor.lockDepth = true;
    this.tweens.add({
      targets: s,
      angle: { from: 0, to: -70 },
      duration: 520,
      ease: 'Sine.easeIn',
      onComplete: () => {
        this.puffAt(x, y, 1.1);
        this.ghostAt(x, y);
        s.setAngle(-70);
        actor.lockDepth = false;
      },
    });
  }

  /**
   * Oylamayla öldürülen oyuncu: kafasına ateş topu düşer, patlar,
   * ruhu yükselip kaybolur, karakter haritadan silinir.
   */
  playFireball(actor, onDone) {
    const s = actor.sprite;
    const tx = s.x;
    const ty = s.y - s.displayHeight * 0.7;

    s.setDepth(8000);
    actor.lockDepth = true;

    const fb = this.add.sprite(tx - 520, ty - 460, 'fireball').setDepth(9200).setScale(1.5);
    fb.play('fireball');
    fb.setRotation(Math.atan2(460, 520));

    this.tweens.add({
      targets: fb,
      x: tx,
      y: ty,
      duration: 620,
      ease: 'Quad.easeIn',
      onComplete: () => {
        fb.destroy();

        const burst = this.add.sprite(tx, ty, 'burst').setDepth(9210).setScale(1.3);
        burst.play('burst');
        burst.once('animationcomplete', () => burst.destroy());
        this.cameras.main.shake(180, 0.004);

        this.tweens.add({
          targets: s,
          alpha: 0,
          scaleX: s.scaleX * 0.7,
          scaleY: s.scaleY * 0.7,
          duration: 420,
          onComplete: () => {
            this.ghostAt(s.x, s.y);
            actor.lockDepth = false;
            onDone?.();
          },
        });
      },
    });
  }

  /** İdam: ipe çekilir, sallanır, toz kalkar, hayalet süzülür. */
  playHanging(actor, onDone) {
    const s = actor.sprite;
    const { x, y } = s;
    s.play(`${actor.look}_idle`, true);
    // Darağacının önünde kalsın, arkasına düşmesin.
    s.setDepth(8000);
    actor.lockDepth = true;

    this.tweens.chain({
      targets: s,
      tweens: [
        { y: y - 70, angle: -8, duration: 500, ease: 'Sine.easeOut' },
        { angle: 7, duration: 420, yoyo: true, repeat: 1, ease: 'Sine.easeInOut' },
        {
          alpha: 0,
          scaleX: 0.8,
          scaleY: 0.8,
          duration: 420,
          onComplete: () => {
            this.puffAt(x, y - 60, 1.3);
            this.ghostAt(x, y - 60);
            s.setVisible(false);
            s.setAngle(0);
            actor.lockDepth = false;
            onDone?.();
          },
        },
      ],
    });
  }

  update() {
    this.host.positionLabels(this.cameras.main);
  }
}

export class VillageStage {
  /**
   * @param {{parent: HTMLElement, labelLayer: HTMLElement, onPick: (id:string)=>void}} opts
   */
  constructor({ parent, labelLayer, onPick }) {
    this.parent = parent;
    this.labelLayer = labelLayer;
    this.onPick = onPick;
    this.scene = null;
    this.actors = new Map();   // playerId -> {sprite, label, seat}
    this.removed = new Set();  // efekti bitip haritadan kalkanlar
    this.pending = null;

    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent,
      backgroundColor: '#14110c',
      pixelArt: true,
      roundPixels: true,
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.NO_CENTER,
        width: parent.clientWidth || 800,
        height: parent.clientHeight || 600,
      },
      scene: [new GameVillage(this)],
    });

    window.__stageGame = this.game;   // donma teşhisi için

    // Panel gizlenince kap 0 boyuta düşüyor; o anda çizim yapılırsa
    // WebGL karesi bozuluyor ve oyun donuyordu. Küçükken uyut, büyüyünce uyandır.
    const MIN = 120;
    let sleeping = false;

    const refresh = () => {
      const w = parent.clientWidth;
      const h = parent.clientHeight;

      if (w < MIN || h < MIN) {
        if (!sleeping) {
          this.game.loop.sleep();
          sleeping = true;
        }
        return;
      }

      this.game.scale.resize(w, h);
      if (sleeping) {
        this.game.loop.wake();
        sleeping = false;
      }
    };

    let pending = null;
    const schedule = () => {
      clearTimeout(pending);
      pending = setTimeout(refresh, 90);
    };

    this.ro = new ResizeObserver(schedule);
    this.ro.observe(parent);
    requestAnimationFrame(refresh);
    setTimeout(refresh, 250);

    // Telefonu çevirince boyut birkaç kez değişiyor; birkaç kez tazele.
    this.onOrient = () => {
      [60, 150, 300, 600, 1000].forEach((ms) => setTimeout(refresh, ms));
    };
    window.addEventListener('orientationchange', this.onOrient);
    window.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('resize', schedule);

    /*
     * Bekçi: ekran döndükten sonra bazen boyut olayı gelmiyor ve sahne
     * uyur halde kalıyordu — telefonda uzun süre boş ekran demek.
     * Saniyede bir kontrol edip gerekirse uyandırır.
     */
    this.watchdog = setInterval(() => {
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      if (w < MIN || h < MIN) return;

      const cv = this.game.canvas;
      const boyutFarkli = cv && (Math.abs(cv.clientWidth - w) > 2 || Math.abs(cv.clientHeight - h) > 2);
      if (sleeping || boyutFarkli) refresh();
    }, 1000);

    // WebGL bağlamı kaybolursa oyun donmasın.
    const canvasReady = () => {
      const cv = this.game.canvas;
      if (!cv) return setTimeout(canvasReady, 100);
      cv.addEventListener('webglcontextlost', (e) => {
        e.preventDefault();
        this.game.loop.sleep();
        sleeping = true;
      });
      cv.addEventListener('webglcontextrestored', () => {
        this.game.loop.wake();
        sleeping = false;
        refresh();
      });
    };
    canvasReady();
  }

  /** Karakteri ve etiketini haritadan kaldırır. */
  removeActor(playerId) {
    const actor = this.actors.get(playerId);
    if (!actor) return;
    actor.sprite.destroy();
    actor.mark?.destroy();
    actor.label.remove();
    this.actors.delete(playerId);
    this.removed.add(playerId);
  }

  onReady(scene) {
    this.scene = scene;
    if (this.pending) {
      this.sync(...this.pending);
      this.pending = null;
    }
  }

  destroy() {
    this.ro?.disconnect();
    clearInterval(this.watchdog);
    if (this.onOrient) window.removeEventListener('orientationchange', this.onOrient);
    this.game?.destroy(true);
    this.labelLayer.innerHTML = '';
    this.actors.clear();
  }

  /**
   * @param {object} state sunucudan gelen oyun durumu
   * @param {{speaking:Set, roleColorOf:Function, selectable:Function, chosen:Function}} helpers
   */
  sync(state, helpers) {
    if (!this.scene) {
      this.pending = [state, helpers];
      return;
    }
    const sc = this.scene;
    const isNight = state.phase === 'night' || state.phase === 'night_result';
    const onTrial = ['trial', 'judgement'].includes(state.phase) ? state.accusedId : null;
    const executedId =
      state.phase === 'vote_result' && state.voteResult?.kind === 'lynch'
        ? state.voteResult.playerId
        : null;

    sc.nightTint.setFillStyle(0x2b3c66, isNight ? 0.38 : 0.12);

    const players = state.players;
    const seen = new Set();

    players.forEach((p, i) => {
      seen.add(p.id);
      if (this.removed.has(p.id)) return;   // efekti bitti, haritadan kalktı
      const seat = ((p.seat ?? i + 1) - 1) % SEATS;
      const geo = seatGeometry(seat);
      let actor = this.actors.get(p.id);

      if (!actor) {
        const look = charKey(p.charId);
        const sprite = sc.add.sprite(CENTER.x, CENTER.y, `${look}_idle`).setOrigin(0.5, 0.96);
        sprite.setScale(0.52);
        sprite.play(`${look}_idle`);
        sprite.on('pointerdown', () => this.onPick(p.id));

        const label = document.createElement('div');
        label.className = 'ph-name';
        this.labelLayer.appendChild(label);

        // Seçildiğini net göstermek için ayağının altına parlak halka.
        const mark = sc.add.ellipse(CENTER.x, CENTER.y, 96, 46, 0xffffff, 0.9);
        mark.setStrokeStyle(5, 0xfff2c4, 1);
        mark.setVisible(false);

        actor = { sprite, label, look, seat, geo, mark, mode: null, busy: false };
        this.actors.set(p.id, actor);

        // Evini kendi forma rengiyle işaretle: kimin evi olduğu anlaşılsın.
      }

      actor.seat = seat;
      actor.geo = geo;

      const wantLook = charKey(p.charId);
      if (actor.look !== wantLook) {
        actor.look = wantLook;
        actor.sprite.play(`${wantLook}_${actor.busy ? 'walk' : 'idle'}`, true);
      }

      // Meydanın dışındaki bekleme noktası. Merkez alan yalnızca sanığa açık.
      actor.plazaSpot = standPoint(seat);

      const wanted =
        onTrial === p.id || executedId === p.id ? 'trial' : isNight ? 'home' : 'plaza';
      if (p.alive) this.moveTo(sc, actor, wanted);

      const s = actor.sprite;

      // Yeni ölenler için efekt oynat.
      if (actor.wasAlive === undefined) actor.wasAlive = p.alive;
      if (actor.wasAlive && !p.alive) {
        actor.wasAlive = false;
        actor.busy = true;
        const finish = () => {
          actor.busy = false;
          this.removeActor(p.id);     // efekt bitince haritadan silinir
        };
        if (executedId === p.id) sc.playFireball(actor, finish);
        else {
          sc.playDeath(actor);
          sc.time.delayedCall(2600, finish);
        }
      } else if (!actor.wasAlive && p.alive) {
        // canlandırıldı
        actor.wasAlive = true;
        s.setAngle(0);
        s.setAlpha(1);
        s.setVisible(true);
      }

      if (actor.mode === 'plaza' && !actor.busy) s.setFlipX(s.x > CENTER.x);
      if (!actor.lockDepth) s.setDepth(s.y);

      const selectable = helpers.selectable(p);
      if (selectable) s.setInteractive({ useHandCursor: true });
      else s.disableInteractive();

      const chosen = helpers.chosen(p);
      actor.mark.setVisible(chosen && p.alive);
      if (chosen && p.alive) {
        actor.mark.setPosition(s.x, s.y + 6);
        actor.mark.setDepth(s.y - 1);
      }

      if (!p.alive) s.setTint(0x66707f);
      else if (chosen) s.setTint(0xffffff);
      else if (helpers.speaking.has(p.id)) s.setTint(0xcaffc0);
      else s.clearTint();
      if (p.alive) s.setAlpha(actor.busy ? s.alpha : 1);
      else s.setAlpha(0.45);

      const roleColor = helpers.roleColorOf(p.roleId);
      const el = actor.label;
      const no = p.cosmetic?.number ?? i + 1;
      el.innerHTML =
        `<b>${no}</b>${p.president ? ' ♛' : ''} ${escapeText(p.name)}` + (p.alive ? '' : ' †');
      el.style.setProperty('--tag', p.cosmetic?.color ?? '#efe1ab');
      el.classList.toggle('is-dead', !p.alive);
      el.classList.toggle('is-selectable', !!selectable);
      el.classList.toggle('is-chosen', !!chosen && p.alive);
      if (roleColor) el.style.setProperty('--tag', roleColor);
      el.style.opacity = s.visible ? '1' : '0';
      el.dataset.lift = String(Math.round(s.displayHeight * 0.9));
    });

    if (state.phase === 'lobby' && this.removed.size) this.removed.clear();

    for (const [id, actor] of this.actors) {
      if (seen.has(id)) continue;
      actor.sprite.destroy();
      actor.mark?.destroy();
      actor.label.remove();
      this.actors.delete(id);
    }
  }

  /**
   * Karakteri istenen konuma yürütür. Teleport yok; meydandan çıkış,
   * kendi patikası, kapı ve giriş animasyonu sırayla oynatılır.
   */
  moveTo(sc, actor, wanted) {
    if (actor.mode === wanted || actor.busy) return;
    const s = actor.sprite;
    const g = actor.geo;

    // İlk yerleşim: animasyonsuz otur.
    if (actor.mode === null) {
      actor.mode = wanted;
      if (wanted === 'home') {
        s.setVisible(false);
        s.setPosition(g.door.x, g.door.y);
      } else if (wanted === 'trial') {
        s.setPosition(CENTER_SPOT.x, CENTER_SPOT.y);
      } else {
        s.setPosition(actor.plazaSpot.x, actor.plazaSpot.y);
      }
      s.setDepth(s.y);
      return;
    }

    actor.busy = true;
    const done = () => {
      actor.busy = false;
      actor.mode = wanted;
    };

    if (wanted === 'home') {
      // meydandan kenara, kendi patikasına, kapıya, sonra içeri
      const route = [g.rim, ...g.path, g.door];
      sc.walkPath(actor, route, () => sc.enterHouse(actor, done));
      return;
    }

    if (actor.mode === 'home') {
      // kapıdan çık, patikayı ters yönde kullan, meydandaki yerine geç
      sc.exitHouse(actor, g.door, () => {
        const route = [...g.path].reverse();
        route.push(g.rim);
        route.push(wanted === 'trial' ? CENTER_SPOT : actor.plazaSpot);
        sc.walkPath(actor, route, done);
      });
      return;
    }

    const dest = wanted === 'trial' ? CENTER_SPOT : actor.plazaSpot;
    sc.walkPath(actor, [dest], done);
  }

  /**
   * Etiketleri yerleştirir ve üst üste binenleri yukarı iterek ayırır.
   * Karakterin üstünü kapatmasın diye hep baş hizasının üzerinde durur.
   */
  positionLabels(cam) {
    const placed = [];

    // Alttakiler önce: üsttekiler gerekirse daha yukarı itilir.
    const list = [...this.actors.values()].sort((a, b) => b.sprite.y - a.sprite.y);

    for (const actor of list) {
      const el = actor.label;
      if (!el.isConnected) continue;

      const lift = Number(el.dataset.lift || 120);
      let x = (actor.sprite.x - cam.worldView.x) * cam.zoom;
      let y = (actor.sprite.y - lift - cam.worldView.y) * cam.zoom;

      const w = el.offsetWidth || 60;
      const h = el.offsetHeight || 16;

      // Önce hafifçe yana kaydır, olmazsa azıcık yukarı al.
      // Sınırsız yukarı itmek etiketleri karakterlerden koparıyordu.
      const hits = (px, py) =>
        placed.find((r) => Math.abs(r.x - px) < (r.w + w) / 2 + 3 && Math.abs(r.y - py) < h + 2);

      const yanaKay = w / 2 + 6;
      if (hits(x, y)) {
        if (!hits(x - yanaKay, y)) x -= yanaKay;
        else if (!hits(x + yanaKay, y)) x += yanaKay;
      }

      for (let k = 0; k < 3 && hits(x, y); k++) y -= h + 3;

      placed.push({ x, y, w, h });
      el.style.transform = `translate(-50%, -100%) translate(${x}px, ${y}px)`;
    }
  }
}
