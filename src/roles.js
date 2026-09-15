// Rol tanımları. Tek kaynak burası; sunucu ve istemci aynı listeyi kullanır.

/** Rol kategorileri: slot tabanlı kurulum bunları kullanır. */
export const CATEGORIES = {
  koy_ozel:       { label: 'Gardiyan',            team: 'koy' },
  koy_arastirma:  { label: 'Köy Araştırmacısı',   team: 'koy' },
  koy_koruma:     { label: 'Köy Koruyucusu',      team: 'koy' },
  koy_oldurme:    { label: 'Köy Savaşçısı',       team: 'koy' },
  koy_destek:     { label: 'Köy Destekçisi',      team: 'koy' },
  vampir_ozel:    { label: 'Edward',              team: 'vampir' },
  vampir_yardim:  { label: 'Vampir',              team: 'vampir' },
  neutral:        { label: 'Bağımsız',            team: 'solo' },
};

export const TEAM = {
  VILLAGE: 'koy',
  VAMPIRE: 'vampir',
  SOLO: 'solo',
};

export const TEAM_LABEL = {
  koy: 'Köy',
  vampir: 'Vampir',
  solo: 'Tek başına',
};

export const ROLES = {
  // ─────────── KÖY ───────────
  koylu: {
    id: 'koylu', name: 'Köylü', category: 'yok', team: TEAM.VILLAGE, color: '#4ea8ff', glyph: 'drop',
    tagline: 'Köyü kurtarmaya çalış.',
    task: 'Gece yeteneğin yok. Gündüz konuş, dinle, doğru kişiye oy ver.',
    fillsRemaining: true,
  },
  doktor: {
    id: 'doktor', name: 'Doktor', category: 'koy_koruma', team: TEAM.VILLAGE, color: '#3ddc84', glyph: 'cross',
    tagline: 'Her gece birini koru.',
    task: 'Her gece bir kişiyi seç. O kişi saldırıdan kurtulur. Hapistekini koruyamazsın.',
    night: { prompt: 'Bu gece kimi koruyacaksın?', self: true, noRepeat: true },
    min: 0, max: 2, default: 1,
  },
  bekci: {
    id: 'bekci', name: 'Araştırmacı', category: 'koy_arastirma', team: TEAM.VILLAGE, color: '#f0a53a', glyph: 'shield',
    tagline: 'Bir oyuncuyu gözle.',
    task: 'Her gece bir kişiyi gözle. Evine gelenlerin adlarını öğrenirsin.',
    night: { prompt: 'Bu gece kimi gözleyeceksin?', watcher: true },
    min: 0, max: 2, default: 1,
  },
  kahin: {
    id: 'kahin', name: 'Kâhin', category: 'koy_arastirma', team: TEAM.VILLAGE, color: '#a26bf0', glyph: 'eye',
    tagline: 'Bir oyuncunun rolünü öğren.',
    task: 'Her gece bir kişiyi seç. Gerçek rolünü görürsün.',
    night: { prompt: 'Kimin rolünü öğrenmek istiyorsun?' },
    min: 0, max: 2, default: 1,
  },
  jailor: {
    id: 'jailor', name: 'Gardiyan', category: 'koy_ozel', team: TEAM.VILLAGE, color: '#c9b037', glyph: 'lock',
    tagline: 'Gündüz birini seç, gece hapset.',
    task: 'Gündüz hapsedeceğin kişiyi seç. O gece rolünü kullanamaz, kimse ona ulaşamaz. Sadece seninle özel yazışır ve seni "Gardiyan" olarak görür. Bir kere idam hakkın var; doktor korusa bile işler.',
    day: { prompt: 'Bu gece kimi hapsedeceksin?' },
    night: { prompt: 'Hapistekini idam edeyim mi?', jailorExecute: true, uses: 3 },
    min: 0, max: 1, default: 0,
  },
  escort: {
    id: 'escort', name: 'Escort', category: 'koy_destek', team: TEAM.VILLAGE, color: '#ff85c0', glyph: 'block',
    tagline: 'Bir kişinin dikkatini dağıt.',
    task: 'Her gece bir kişiyi engelle. İyi ya da kötü, o gece rolünü kullanamaz. Gardiyanı engelleyemezsin.',
    night: { prompt: 'Bu gece kimin dikkatini dağıtacaksın?', roleblock: true },
    min: 0, max: 2, default: 0,
  },
  veteran: {
    id: 'veteran', name: 'Veteran', category: 'koy_oldurme', team: TEAM.VILLAGE, color: '#c9803a', glyph: 'shield',
    tagline: 'Tetikte bekle, gelen ölür.',
    task:
      'Üç kez tetikte bekleyebilirsin. Tetikteyken evine gelen herkes ölür — ' +
      'vampir, seri katil, hatta seni korumaya gelen doktor bile. O gece sana ' +
      'gelen saldırılar işlemez. Dikkatli kullan, masum da vurabilirsin.',
    night: { prompt: 'Bu gece tetikte bekle', uses: 3, alert: true },
    min: 0, max: 1, default: 0,
  },

  serif: {
    id: 'serif', name: 'Şerif', category: 'koy_arastirma', team: TEAM.VILLAGE, color: '#f0c33a', glyph: 'eye',
    tagline: 'Suçlu mu, değil mi?',
    task:
      'Her gece birini ziyaret et, suçlu olup olmadığını öğren. ' +
      'Edward kendini temize çektiği için sana suçsuz görünür.',
    night: { prompt: 'Bu gece kimi sorgulayacaksın?', sheriff: true },
    min: 0, max: 2, default: 0,
  },

  medium: {
    id: 'medium', name: 'Medyum', category: 'koy_destek', team: TEAM.VILLAGE, color: '#8fd6c8', glyph: 'eye',
    tagline: 'Ölülerle konuş.',
    task:
      'Her gece ölülerle konuşabilirsin; onlar da sana yazar. ' +
      'Oyundan tamamen ayrılmış biriyle seans yapamazsın.',
    min: 0, max: 1, default: 0,
  },

  takipci: {
    id: 'takipci', name: 'Takipçi', category: 'koy_arastirma', team: TEAM.VILLAGE, color: '#7ad4a0', glyph: 'eye',
    tagline: 'İzini sür.',
    task: 'Her gece birinin izini sür, o gece kimin evine gittiğini gör.',
    night: { prompt: 'Bu gece kimi takip edeceksin?', tracker: true },
    min: 0, max: 2, default: 0,
  },

  arabaci: {
    id: 'arabaci', name: 'Yer Değiştiren', category: 'koy_destek', team: TEAM.VILLAGE, color: '#d88f4a', glyph: 'shield',
    tagline: 'İki evi yer değiştir.',
    task:
      'Her gece iki kişinin evini değiştirirsin; kendini de seçebilirsin. ' +
      'O gece A evine gidenler B evinde, B evine gidenler A evinde bulur kendini. ' +
      'Bunu uzaktan yaparsın: o evlere gitmezsin, tuzağa ya da pusuya yakalanmazsın. ' +
      'Hapistekiler taşınamaz.',
    night: { prompt: 'Evlerini değiştireceğin iki kişiyi seç', transport: true, pickTwo: true },
    min: 0, max: 1, default: 0,
  },

  korumaci: {
    id: 'korumaci', name: 'Koruma', category: 'koy_koruma', team: TEAM.VILLAGE, color: '#4ec8a8', glyph: 'shield',
    tagline: 'Canınla koru.',
    task:
      'Her gece birini korursun. Hedefine doğrudan saldırı gelirse saldırganla ' +
      'birbirinizi öldürürsünüz, hedefin sağ kalır. Tek bir saldırıyı durdurabilirsin; ' +
      'iki saldırı gelirse birini rastgele karşılarsın.',
    night: { prompt: 'Bu gece kimi koruyacaksın?', guard: true },
    min: 0, max: 2, default: 0,
  },

  kapanci: {
    id: 'kapanci', name: 'Kapancı', category: 'koy_koruma', team: TEAM.VILLAGE, color: '#b0894a', glyph: 'shield',
    tagline: 'Tuzak kur.',
    task:
      'Bir kişinin evine tuzak kurarsın; o eve giren herkes ölür. İki tuzak hakkın var. ' +
      'Kurduğun tuzakları kaldırmak için bir gece kendine tuzak kur.',
    night: { prompt: 'Bu gece kimin evine tuzak kuracaksın?', trapper: true, uses: 2 },
    min: 0, max: 1, default: 0,
  },

  rolhirsizi: {
    id: 'rolhirsizi', name: 'Rol Hırsızı', category: 'koy_destek', team: TEAM.VILLAGE, color: '#c88fd6', glyph: 'eye',
    tagline: 'Ölünün rolünü al.',
    task:
      'Bir kereliğine ölmüş birinin rolünü alırsın. Rol değişince bütün köy haberdar olur. ' +
      'Rolü çalınan biri canlandırılırsa köylü olarak döner.',
    night: { prompt: 'Rolünü alacağın ölüyü seç', thief: true, uses: 1, deadTargets: true },
    min: 0, max: 1, default: 0,
  },

  baskan: {
    id: 'baskan', name: 'Başkan', category: 'koy_destek', team: TEAM.VILLAGE, color: '#e8c96a', glyph: 'crown',
    tagline: 'Kendini ilan et, 3 oy hakkı kazan.',
    task:
      'Gündüz başkanlığını ilan edebilirsin. Tüm köye duyurulur ve oyun sonuna kadar oyun ' +
      '3 sayılır. Ama artık herkes seni tanır ve doktor seni iyileştiremez.',
    day: { reveal: true },
    min: 0, max: 1, default: 0,
  },
  canlandirici: {
    id: 'canlandirici', name: 'Canlandırıcı', category: 'koy_destek', team: TEAM.VILLAGE, color: '#7fd1c4', glyph: 'revive',
    tagline: 'Bir ölüyü geri getir.',
    task: 'Oyun boyunca bir kere, ölü bir oyuncuyu hayata döndürebilirsin. Dönen kişi rolüyle döner ama gece yeteneğini bir daha kullanamaz.',
    night: { prompt: 'Kimi canlandıracaksın?', revive: true, uses: 1, targetsDead: true },
    min: 0, max: 1, default: 0,
  },
  kanunsuz: {
    id: 'kanunsuz', name: 'Kanunsuz', category: 'koy_oldurme', team: TEAM.VILLAGE, color: '#d97b3a', glyph: 'gun',
    tagline: 'Adaleti kendi eline al.',
    task:
      'Bir kere, bir gece şüphelendiğin kişiyi vurabilirsin. Köy tarafından birini ' +
      'vurursan ertesi gece suçluluktan kendini öldürürsün.',
    night: { prompt: 'Kimi vuracaksın?', attack: true, uses: 1 },
    min: 0, max: 1, default: 0,
  },

  // ─────────── VAMPİR ───────────
  edward: {
    id: 'edward', name: 'Edward', category: 'vampir_ozel', team: TEAM.VAMPIRE, color: '#e2405b', glyph: 'fangs',
    tagline: 'Vampirlerin başı. Emri sen verirsin.',
    task: 'Her gece hedefi sen belirlersin. Saldırıyı normal vampir yapar, o yüzden engellenmen kili durdurmaz. Vampir kalmazsa saldırıyı sen yaparsın.',
    night: { prompt: 'Bu gece kime saldıralım?', vampireOrder: true },
    min: 1, max: 1, default: 1,
    unique: true,
    nightImmune: true,
  },
  vampir: {
    id: 'vampir', name: 'Vampir', category: 'vampir_yardim', team: TEAM.VAMPIRE, color: '#b5202e', glyph: 'fangs',
    tagline: 'Edward\'ın emrini uygula.',
    task: 'Saldırıyı sen yaparsın. Hedefi Edward seçer, sohbette tartışabilirsiniz ama emir onundur. Engellenirsen o gece kil çıkmaz. Edward ölürse yerine sen geçersin.',
    min: 0, max: 4, default: 1,
  },
  casus: {
    id: 'casus', name: 'Casus', category: 'koy_arastirma', team: TEAM.VILLAGE, color: '#8c3b6b', glyph: 'eye',
    tagline: 'Gölgeden izle.',
    task: 'Köy tarafındasın. Vampir sohbetini okursun ama konuşanların gerçek adını göremezsin, sadece "Vampir 1", "Vampir 2" görürsün. Vampirlerin o gece kime gittiğini de görürsün. Konuşamazsın, gece yeteneğin yok.',
    night: { spy: true },
    min: 0, max: 1, default: 0,
  },
  sahtekar: {
    id: 'sahtekar', name: 'Sahtekâr', category: 'vampir_yardim', team: TEAM.VAMPIRE,
    color: '#c26bb0', glyph: 'eye',
    tagline: 'Masumu suçlu göster.',
    task:
      'Her gece birini damgalarsın. O gece Şerif ona bakarsa suçlu görür; ' +
      'Kâhin ve Vampir Araştırmacı da yanlış rol okur.',
    night: { prompt: 'Bu gece kimi damgalayacaksın?', framer: true },
    min: 0, max: 1, default: 0,
  },

  jigolo: {
    id: 'jigolo', name: 'Jigolo', category: 'vampir_yardim', team: TEAM.VAMPIRE, color: '#e0559a', glyph: 'block',
    tagline: 'Köylüyü oyala.',
    task: 'Her gece bir köylüyü meşgul edersin, o gece rolünü kullanamaz.',
    night: { prompt: 'Bu gece kimi oyalayacaksın?', blocker: true },
    min: 0, max: 1, default: 0,
  },

  susturucu: {
    id: 'susturucu', name: 'Susturucu', category: 'vampir_yardim', team: TEAM.VAMPIRE, color: '#b05590', glyph: 'block',
    tagline: 'Ertesi gün sustur.',
    task:
      'Her gece birini seçersin, ertesi gün konuşamaz. ' +
      'Öldürmekle görevli vampir kalmazsa yerine geçersin.',
    night: { prompt: 'Bu gece kimi susturacaksın?', silencer: true },
    min: 0, max: 1, default: 0,
  },

  tacizci: {
    id: 'tacizci', name: 'Vampir Araştırmacı', category: 'vampir_yardim', team: TEAM.VAMPIRE, color: '#9a5fd0', glyph: 'eye',
    tagline: 'Rolü daralt.',
    task:
      'Her gece birine gidip rolünün üç rolden biri olduğunu öğrenirsin. ' +
      'Öldürmekle görevli vampir kalmazsa yerine geçersin.',
    night: { prompt: 'Bu gece kimi araştıracaksın?', consig: true },
    min: 0, max: 1, default: 0,
  },

  kamuflaj: {
    id: 'kamuflaj', name: 'Kamuflaj', category: 'vampir_yardim', team: TEAM.VAMPIRE, color: '#7a4a3a', glyph: 'block',
    tagline: 'Pusu kur.',
    task:
      'Bir kişinin evine pusu kurarsın; o gece oraya gelenlerden BİRİNİ öldürürsün. ' +
      'Kendine ve vampir takımına pusu kuramazsın. O eve gelen herkes adını öğrenir. ' +
      'Pusun sessizdir: koruma ve tuzaklar sana işlemez.',
    night: { prompt: 'Bu gece kimin evine pusu kuracaksın?', ambush: true },
    min: 0, max: 1, default: 0,
  },

  dolandirici: {
    id: 'dolandirici', name: 'Dolandırıcı', category: 'vampir_yardim', team: TEAM.VAMPIRE, color: '#9b6b2f', glyph: 'quill',
    tagline: 'Vasiyetleri yeniden yaz.',
    task: 'Her gece bir oyuncunun vasiyetini değiştirebilirsin. O kişi ölünce senin yazdığın metin çıkar. Vampirler biterse Edward sen olursun.',
    night: { prompt: 'Kimin vasiyetini değiştireceksin?', forgeWill: true },
    min: 0, max: 1, default: 0,
  },

  // ─────────── TEK BAŞINA ───────────
  joker: {
    id: 'joker', name: 'Joker', category: 'neutral', team: TEAM.SOLO, color: '#ff7a3d', glyph: 'jester',
    tagline: 'Kendi yolunu çiz.',
    task:
      'Köy seni asarsa tek başına kazanırsın. Ertesi gece, asılmana evet diyenlerden ' +
      'birini musallat olup öldürürsün. Gece ölürsen kaybedersin.',
    min: 0, max: 2, default: 0,
  },
  iftiraci: {
    id: 'iftiraci', name: 'İftiracı', category: 'neutral', team: TEAM.SOLO, color: '#d0703a', glyph: 'jester',
    tagline: 'Hedefini astır.',
    task:
      'Oyun başında sana bir hedef verilir. O kişi köy tarafından asılırsa kazanırsın. ' +
      'Hedefin başka türlü ölürse Joker’a dönüşürsün.',
    min: 0, max: 1, default: 0,
  },

  serikatil: {
    id: 'serikatil', name: 'Seri Katil', category: 'neutral', team: TEAM.SOLO, color: '#8f2f2f', glyph: 'knife',
    tagline: 'Herkese karşı, tek başına.',
    task:
      'Her gece bir kişiyi öldürürsün. Seni engellemeye gelen kişiyi de öldürürsün. ' +
      'Son kalan sen olursan kazanırsın.',
    night: { prompt: 'Bu gece kimi öldüreceksin?', attack: true },
    min: 0, max: 1, default: 0,
    unique: true,
  },
  survivor: {
    id: 'survivor', name: 'Survivor', category: 'neutral', team: TEAM.SOLO, color: '#6f8fa8', glyph: 'vest',
    tagline: 'Sadece hayatta kal.',
    task: '2 kurşun geçirmez yeleğin var. Kim kazanırsa kazansın, sen hayattaysan sen de kazanırsın.',
    night: { prompt: 'Bu gece yelek giyeyim mi?', vest: true, uses: 4, selfOnly: true },
    min: 0, max: 2, default: 0,
  },
};

export const CONFIGURABLE_ROLES = Object.values(ROLES).filter((r) => !r.fillsRemaining);

export const roleName = (id) => ROLES[id]?.name ?? 'Bilinmiyor';
export const roleTeam = (id) => ROLES[id]?.team ?? null;
export const isVampire = (id) => roleTeam(id) === TEAM.VAMPIRE;
export const isSolo = (id) => roleTeam(id) === TEAM.SOLO;
export const hasNightAction = (id) => Boolean(ROLES[id]?.night?.prompt);

export function defaultRoleCounts() {
  const counts = {};
  for (const role of CONFIGURABLE_ROLES) counts[role.id] = role.default ?? 0;
  return counts;
}

/**
 * Rol dağılımını oyuncu sayısına göre doğrular.
 * Vampir tarafı = Edward + vampir + casus + dolandırıcı.
 */
export function validateRoleCounts(counts, playerCount) {
  let special = 0;

  for (const role of CONFIGURABLE_ROLES) {
    const n = counts[role.id];
    if (!Number.isInteger(n) || n < role.min || n > role.max) {
      return { ok: false, error: `${role.name} sayısı ${role.min}-${role.max} arasında olmalı.` };
    }
    special += n;
  }

  const vampSide = ['edward', 'vampir', 'dolandirici'].reduce((a, id) => a + (counts[id] ?? 0), 0);

  if ((counts.edward ?? 0) < 1) {
    return { ok: false, error: 'Vampir tarafının başında Edward olmalı. Edward sayısı 1 olmalı.' };
  }
  if (vampSide === 0) {
    return { ok: false, error: 'En az bir vampir olmalı.' };
  }
  if (vampSide * 2 >= playerCount) {
    return {
      ok: false,
      error: `${playerCount} oyuncuda vampir tarafı en fazla ${Math.ceil(playerCount / 2) - 1} kişi olabilir.`,
    };
  }
  if (special > playerCount) {
    return { ok: false, error: `Seçilen roller ${special} kişilik ama oyunda ${playerCount} kişi var.` };
  }
  if (special === playerCount) {
    return { ok: false, error: 'En az 1 köylü kalmalı. Bir rolden azalt.' };
  }

  return { ok: true, villagers: playerCount - special };
}

/**
 * Oyuncu sayısına göre dengeli bir dağılım önerir.
 * Öncelik sırasına göre rol ekler, en az 2 köylü kalacak şekilde durur.
 */
export function suggestRoleCounts(playerCount) {
  const counts = defaultRoleCounts();
  for (const id of Object.keys(counts)) counts[id] = 0;
  counts.edward = 1;

  const VAMP_IDS = ['edward', 'vampir', 'dolandirici'];
  const KEEP_VILLAGERS = 2;

  const total = () => Object.values(counts).reduce((a, b) => a + b, 0);
  const vampTotal = () => VAMP_IDS.reduce((a, id) => a + counts[id], 0);

  const plan = [
    'doktor', 'kahin', 'serif', 'vampir', 'bekci', 'jailor', 'jigolo',
    'takipci', 'veteran', 'escort', 'vampir', 'medium', 'susturucu',
    'baskan', 'arabaci', 'casus', 'serikatil', 'kapanci', 'tacizci',
    'survivor', 'dolandirici', 'kamuflaj', 'canlandirici', 'iftiraci',
    'kanunsuz', 'rolhirsizi', 'vampir', 'joker',
  ];

  for (const id of plan) {
    if (total() + 1 > playerCount - KEEP_VILLAGERS) continue;
    if (counts[id] + 1 > (ROLES[id].max ?? 0)) continue;
    if (VAMP_IDS.includes(id) && (vampTotal() + 1) * 2 >= playerCount) continue;
    counts[id] += 1;
  }

  return counts;
}

// ---------- slot tabanlı kurulum ----------

/**
 * Slot tipleri. `rol:<id>` sabit rol verir, `kat:<kategori>` o kategoriden
 * rastgele seçer, `kat:koy` / `kat:vampir` bütün takımdan seçer.
 */
export const SLOT_TYPES = [
  { id: 'rol:jailor', label: 'Gardiyan', team: 'koy', fixed: true },
  { id: 'kat:koy_arastirma', label: 'Köy Araştırmacısı', team: 'koy' },
  { id: 'kat:koy_koruma', label: 'Köy Koruyucusu', team: 'koy' },
  { id: 'kat:koy_oldurme', label: 'Köy Savaşçısı', team: 'koy' },
  { id: 'kat:koy_destek', label: 'Köy Destekçisi', team: 'koy' },
  { id: 'kat:koy', label: 'Rastgele Köylü', team: 'koy' },
  { id: 'rol:edward', label: 'Edward', team: 'vampir', fixed: true },
  { id: 'rol:vampir', label: 'Vampir', team: 'vampir', fixed: true },
  { id: 'kat:vampir', label: 'Rastgele Vampir', team: 'vampir' },
  { id: 'rol:serikatil', label: 'Seri Katil', team: 'solo', fixed: true },
  { id: 'kat:neutral', label: 'Rastgele Bağımsız', team: 'solo' },
];

const SLOT_PRESET = Object.fromEntries(SLOT_TYPES.map((s) => [s.id, s]));

/** Her geçerli slot kimliği için bilgi döner (listede olmayan `rol:` de dahil). */
export function slotInfo(slotId) {
  if (SLOT_PRESET[slotId]) return SLOT_PRESET[slotId];

  if (typeof slotId === 'string' && slotId.startsWith('rol:')) {
    const r = ROLES[slotId.slice(4)];
    if (r) return { id: slotId, label: r.name, team: r.team, fixed: true };
  }
  if (typeof slotId === 'string' && slotId.startsWith('kat:')) {
    const kat = slotId.slice(4);
    if (kat === 'koy') return { id: slotId, label: 'Rastgele Köylü', team: 'koy' };
    if (kat === 'vampir') return { id: slotId, label: 'Rastgele Vampir', team: 'vampir' };
    if (CATEGORIES[kat]) return { id: slotId, label: CATEGORIES[kat].label, team: CATEGORIES[kat].team };
  }
  return null;
}

export const SLOT_BY_ID = new Proxy({}, {
  get: (_t, k) => slotInfo(String(k)),
  has: (_t, k) => slotInfo(String(k)) !== null,
});

const KOY_KATEGORILER = ['koy_arastirma', 'koy_koruma', 'koy_oldurme', 'koy_destek'];

/** Bir slotun seçebileceği roller. */
export function rolesForSlot(slotId) {
  if (slotId.startsWith('rol:')) return [slotId.slice(4)];

  const kat = slotId.slice(4);
  const all = Object.values(ROLES).filter((r) => r.category !== 'yok');

  if (kat === 'koy') return all.filter((r) => KOY_KATEGORILER.includes(r.category)).map((r) => r.id);
  if (kat === 'vampir') return all.filter((r) => r.category === 'vampir_yardim').map((r) => r.id);
  return all.filter((r) => r.category === kat).map((r) => r.id);
}

/** Oyuncu sayısına göre dengeli bir slot listesi önerir. */
export function suggestSlots(playerCount) {
  const n = Math.max(4, playerCount);
  const slots = ['rol:jailor', 'rol:edward', 'rol:vampir'];

  const ekle = (id, adet) => {
    for (let i = 0; i < adet && slots.length < n; i++) slots.push(id);
  };

  ekle('kat:koy_arastirma', 2);
  ekle('kat:koy_koruma', 1);
  if (n >= 9) ekle('rol:serikatil', 1);
  if (n >= 10) ekle('kat:neutral', 1);
  if (n >= 11) ekle('kat:vampir', 1);
  if (n >= 13) ekle('kat:vampir', 1);
  if (n >= 15) ekle('kat:koy_oldurme', 1);

  // Kalanı rastgele köylülerle doldur.
  while (slots.length < n) slots.push('kat:koy');
  return slots.slice(0, n);
}

/**
 * Slotları gerçek rollere çevirir. Aynı rol iki kez gelmez;
 * sadece sabit slotlar (rol:) tekrar edebilir.
 */
export function resolveSlots(slots, rnd = Math.random) {
  const karistir = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const kullanilan = new Set();
  const sonuc = [];

  // Sabit slotlar önce: rastgeleler onların dışından seçsin.
  const sira = [...slots].sort((a, b) => Number(b.startsWith('rol:')) - Number(a.startsWith('rol:')));

  for (const slot of sira) {
    if (slot.startsWith('rol:')) {
      const id = slot.slice(4);
      sonuc.push({ slot, roleId: id });
      kullanilan.add(id);
      continue;
    }
    const havuz = karistir(rolesForSlot(slot)).filter((id) => !kullanilan.has(id));
    const secim = havuz[0] ?? rolesForSlot(slot)[0];
    kullanilan.add(secim);
    sonuc.push({ slot, roleId: secim });
  }

  return sonuc;
}

/** Slot listesi oyuncu sayısına ve denge kurallarına uyuyor mu? */
export function validateSlots(slots, playerCount) {
  if (!Array.isArray(slots) || slots.some((s) => !slotInfo(s))) {
    return { ok: false, error: 'Geçersiz slot listesi.' };
  }
  if (slots.length !== playerCount) {
    return { ok: false, error: `${playerCount} oyuncu için ${playerCount} slot gerekli, şu an ${slots.length}.` };
  }
  if (!slots.includes('rol:edward')) {
    return { ok: false, error: 'Edward olmadan oyun başlamaz.' };
  }

  const vampirSayisi = slots.filter((s) => slotInfo(s).team === 'vampir').length;
  if (vampirSayisi * 2 >= playerCount) {
    return { ok: false, error: 'Vampir tarafı köyün yarısına ulaşamaz.' };
  }

  const koySayisi = slots.filter((s) => slotInfo(s).team === 'koy').length;
  if (koySayisi < 2) return { ok: false, error: 'En az 2 köy slotu olmalı.' };

  // Kategori havuzu yetiyor mu?
  const sayac = {};
  for (const s of slots) if (!slotInfo(s).fixed) sayac[s] = (sayac[s] ?? 0) + 1;
  for (const [slot, adet] of Object.entries(sayac)) {
    if (rolesForSlot(slot).length < adet) {
      return { ok: false, error: `${slotInfo(slot).label} için yeterli rol yok.` };
    }
  }

  return { ok: true, vampirSayisi, koySayisi };
}
