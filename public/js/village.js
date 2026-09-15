// Köy meydanı — Tiny Swords varlıklarıyla.
// Her oyuncunun kendi villası var; gündüz meydanda toplanır,
// gece patikadan evine yürür.

const A = '/assets';

/** Sprite sayfası stili. Kare sayısı .f6 / .f8 sınıfıyla eşleşmeli. */
function sheet(file, frames) {
  return `background-image:url(${A}/${file});background-size:${frames * 100}% 100%;`;
}

// ── yerleşim ─────────────────────────────────────────────

export const VILLA_COUNT = 16; // köyde her zaman 16 ev var

const CX = 50;
const CY = 55;
const PLAZA = { rx: 19, ry: 12.5 };  // ortadaki boş meydan — patikalar buraya girmez
const RING = { rx: 31, ry: 20.5 };   // gündüz: oyuncular çemberin dışında dizilir
const HOME = { rx: 43, ry: 30 };     // gece: villanın önü
const VILLA = { rx: 48, ry: 35.5 };    // villanın kendisi

const angleOf = (i, n) => -Math.PI / 2 + (i / Math.max(n, 1)) * Math.PI * 2;

function place(angle, r) {
  return { left: CX + Math.cos(angle) * r.rx, top: CY + Math.sin(angle) * r.ry };
}

/** Derinlik: aşağıdakiler büyük ve önde görünür. */
function depthOf(top) {
  const d = Math.min(1, Math.max(0, (top - 20) / 70));
  return { scale: 0.78 + d * 0.36, z: Math.round(top * 10) };
}

/** Gündüz konumu — meydan çemberinin kenarı. */
export function seatPosition(index, total) {
  const p = place(angleOf(index, total), RING);
  return { ...p, ...depthOf(p.top) };
}

/** Gece konumu — kendi villasının önü. */
export function homePosition(index, total) {
  const p = place(angleOf(index, total), HOME);
  return { ...p, ...depthOf(p.top) };
}

/** Suçlanan oyuncu idam tahtasına çıkar. */
export function gallowsPosition() {
  return { left: CX, top: CY + 4, scale: 1.15, z: 900 };
}

// ── sahne ────────────────────────────────────────────────

const TREES = [
  { x: 3, y: 28, w: 8 }, { x: 97, y: 30, w: 8 },
  { x: 6, y: 97, w: 8 }, { x: 94, y: 99, w: 8 },
];
const ROCKS = [
  { img: 'rock1.png', x: 14, y: 72, w: 3.2 },
  { img: 'rock3.png', x: 86, y: 76, w: 3.2 },
];

/**
 * Villaları, patikaları, meydanı ve idam tahtasını çizer.
 * Villa sayısı sabit 16; oyuncu sayısından bağımsız.
 */
export function renderScenery(el) {
  const n = VILLA_COUNT;
  const parts = [];
  const z = (y) => Math.round(y * 10);

  // Ortadaki taş meydan.
  parts.push(`<img class="ts-plaza" alt="" src="${A}/plaza.png">`);

  // Meydanın kenarında meşaleler.
  for (let t = 0; t < 8; t++) {
    const a = angleOf(t, 8) + Math.PI / 8;
    const pos = place(a, { rx: PLAZA.rx + 3.5, ry: PLAZA.ry + 2.5 });
    parts.push(
      `<img class="ts-prop ts-torch" alt="" src="${A}/torch.png"` +
        ` style="left:${pos.left}%;top:${pos.top}%;width:2.6%;z-index:${z(pos.top)}">`,
      `<div class="ts-flame ts-anim f8" style="left:${pos.left}%;top:${pos.top - 8.6}%;` +
        `${sheet('fire.png', 8)}z-index:${z(pos.top) + 1}"></div>`,
      `<div class="ts-torch-glow" style="left:${pos.left}%;top:${pos.top - 7.5}%"></div>`
    );
  }

  for (let i = 0; i < n; i++) {
    const angle = angleOf(i, n);
    const villa = place(angle, VILLA);
    const home = place(angle, HOME);
    const edge = place(angle, PLAZA); // patika meydanın kenarında durur

    // Patika: villanın önünden meydanın kenarına. Meydanın içine girmez.
    const STONES = 6;
    for (let s = 0; s < STONES; s++) {
      const t = (s + 0.5) / STONES;
      const x = home.left + (edge.left - home.left) * t;
      const y = home.top + (edge.top - home.top) * t;
      parts.push(`<span class="ts-path" style="left:${x}%;top:${y}%;z-index:${z(y) - 5}"></span>`);
    }

    const img = i % 2 === 0 ? 'villa_a.png' : 'villa_b.png';
    const w = i % 2 === 0 ? 7.5 : 9;
    parts.push(
      `<img class="ts-prop ts-villa" alt="" src="${A}/${img}"` +
        ` style="left:${villa.left}%;top:${villa.top}%;width:${w}%;z-index:${z(villa.top)}">`
    );
  }

  for (const t of TREES) {
    parts.push(
      `<div class="ts-prop ts-anim f8" style="left:${t.x}%;top:${t.y}%;width:${t.w}%;` +
        `aspect-ratio:192/256;${sheet('tree.png', 8)}z-index:${z(t.y)}"></div>`
    );
  }
  for (const r of ROCKS) {
    parts.push(
      `<img class="ts-prop" alt="" src="${A}/${r.img}"` +
        ` style="left:${r.x}%;top:${r.y}%;width:${r.w}%;z-index:${z(r.y)}">`
    );
  }

  parts.push(`<img class="ts-gallows" alt="" src="${A}/gallows.png">`);
  parts.push(
    `<div class="ts-fire ts-anim f8" style="${sheet('fire.png', 8)}"></div>`,
    '<div class="ts-fire-glow"></div>'
  );

  el.innerHTML = parts.join('');
}

// ── karakterler ──────────────────────────────────────────

const UNIT_COLORS = ['red', 'blue', 'purple', 'yellow', 'black'];
const UNIT_KINDS = ['pawn', 'warrior'];

/** Koltuk numarasından sabit görünüm: 5 renk x 2 tip = 10 çeşit. */
export function unitSprite(seat, running = false) {
  const i = Math.max(0, (seat ?? 1) - 1);
  const kind = UNIT_KINDS[Math.floor(i / UNIT_COLORS.length) % UNIT_KINDS.length];
  const color = UNIT_COLORS[i % UNIT_COLORS.length];
  return running ? `${kind}_${color}_run.png` : `${kind}_${color}.png`;
}

/**
 * Meydandaki oyuncu.
 * Halka rengi: rolü biliniyorsa takım rengi, bilinmiyorsa oyuncunun kendi rengi.
 */
export function characterHTML({ seat, cosmetic, dead, ringColor, running }) {
  const frames = running ? 6 : 8;
  const cls = running ? 'f6' : 'f8';
  const color = ringColor ?? cosmetic?.color ?? '#b8342f';
  return `
    <span class="ts-ring" style="--ring:${color}"></span>
    <span class="ts-unit${dead ? ' is-dead' : ` ts-anim ${cls}`}"
          style="${sheet(unitSprite(seat, running && !dead), frames)}"></span>
    <span class="ts-num" style="background:${color}">${cosmetic?.number ?? seat}</span>`;
}

// ── rol ikonları (panel için) ────────────────────────────

const GLYPHS = {
  drop: (c) => `<path d="M11 2 C11 2 4 9.6 4 13.6 a7 7 0 0 0 14 0 C18 9.6 11 2 11 2 Z" fill="${c}"/>`,
  fangs: (c) => `<path d="M2 3 L11 8 L20 3 L17.5 12 L11 20 L4.5 12 Z" fill="${c}"/>`,
  cross: (c) => `<path d="M8.4 2 h5.2 v6.4 H20 v5.2 h-6.4 V20 H8.4 v-6.4 H2 V8.4 h6.4 Z" fill="${c}"/>`,
  shield: (c) => `<path d="M11 2 L19 5 v6 c0 5-3.4 8-8 10-4.6-2-8-5-8-10 V5 Z" fill="${c}"/>`,
  eye: (c) => `<path d="M11 4 C16.5 4 20 11 20 11 s-3.5 7-9 7-9-7-9-7 3.5-7 9-7 Z" fill="${c}" opacity=".35"/>
               <circle cx="11" cy="11" r="3.6" fill="${c}"/>`,
  jester: (c) => `<path d="M11 3 a3 3 0 0 1 3 3 v2 h3.5 l-2 4 h-9 l-2-4 H8 V6 a3 3 0 0 1 3-3 Z" fill="${c}"/>
                  <circle cx="5.5" cy="6" r="2" fill="${c}"/><circle cx="16.5" cy="6" r="2" fill="${c}"/>`,
  lock: (c) => `<rect x="4" y="9" width="14" height="11" rx="2" fill="${c}"/>
                <path d="M7 9 V6.5 a4 4 0 0 1 8 0 V9" fill="none" stroke="${c}" stroke-width="2"/>`,
  block: (c) => `<circle cx="11" cy="11" r="8" fill="none" stroke="${c}" stroke-width="3"/>
                 <path d="M5.5 5.5 L16.5 16.5" stroke="${c}" stroke-width="3"/>`,
  crown: (c) => `<path d="M3 16 L4.5 6 L8 11 L11 4.5 L14 11 L17.5 6 L19 16 Z" fill="${c}"/>`,
  revive: (c) => `<path d="M11 19 C6 15 3 12 3 8.8 A4.3 4.3 0 0 1 11 6.6 A4.3 4.3 0 0 1 19 8.8 C19 12 16 15 11 19 Z" fill="${c}"/>`,
  gun: (c) => `<path d="M3 8 h11 v4 h-3 l-2 4 H6 l1-4 H3 Z" fill="${c}"/><rect x="14" y="8" width="5" height="2" fill="${c}"/>`,
  quill: (c) => `<path d="M4 18 C8 8 13 4 19 3 C18 9 14 14 6 17 Z" fill="${c}"/><path d="M4 18 L8 14" stroke="${c}" stroke-width="2"/>`,
  knife: (c) => `<path d="M15 2 L18 5 L8 16 L5 13 Z" fill="${c}"/><rect x="3" y="15" width="5" height="2.6" rx="1" fill="${c}" transform="rotate(-45 5 16)"/>`,
  vest: (c) => `<path d="M6 4 L11 7 L16 4 L18 8 V19 H4 V8 Z" fill="${c}"/>`,
};

export function roleGlyph(name, color) {
  const draw = GLYPHS[name] ?? GLYPHS.drop;
  return `<svg class="glyph" viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${draw(color)}</svg>`;
}
