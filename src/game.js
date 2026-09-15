import { randomInt, randomUUID } from 'node:crypto';
import {
  ROLES,
  TEAM_LABEL,
  roleTeam,
  hasNightAction,
  TEAM,
  CONFIGURABLE_ROLES,
  isVampire,
  roleName,
  validateRoleCounts,
  suggestRoleCounts,
  validateSlots,
  suggestSlots,
  resolveSlots,
  slotInfo,
  defaultRoleCounts,
} from './roles.js';
import { TASKS, TASK_BY_ID, VERIFY } from './tasks.js';
import { CHARACTERS, CHARACTER_IDS } from './characters.js';

export const PHASE = {
  LOBBY: 'lobby',
  REVEAL: 'reveal',
  NIGHT: 'night',
  NIGHT_RESULT: 'night_result',
  DAY: 'day',
  VOTE: 'vote',
  TRIAL: 'trial',
  JUDGEMENT: 'judgement',
  VOTE_RESULT: 'vote_result',
  END: 'end',
};

const PHASE_LABEL = {
  lobby: 'Oyuncular bekleniyor',
  reveal: 'Roller dağıtıldı',
  night: 'Gece',
  night_result: 'Sabah oldu',
  day: 'Tartışma zamanı',
  vote: 'Oylama',
  trial: 'Savunma',
  judgement: 'Karar',
  vote_result: 'Karar verildi',
  end: 'Oyun bitti',
};

export const COLORS = [
  '#b8342f', '#2f6fb8', '#3f9b5c', '#8a4fb5', '#c9861f',
  '#20867f', '#b5457e', '#5b6bb5', '#7a5230', '#4a4f57',
  '#a03d8f', '#357a9c', '#8d9b2f', '#c05a2b', '#6d3f9b', '#2f7a4d',
];

export const HATS = ['fedora', 'kapusonlu', 'silindir', 'basortu', 'kasket', 'yok'];

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const pick = (arr) => arr[randomInt(0, arr.length)];

const now = () => Date.now();

const RECONNECT_GRACE = 20_000;   // lobide/oyun sonunda yerin korunma süresi
const REJOIN_WINDOW = 60_000;     // oyun sürerken otomatik geri dönüş penceresi

const DEATH_LINES = {
  vampir: [
    'dün gece haince öldürüldü',
    'dün gece pusuya düşürüldü',
    'dün gece arkadan bıçaklandı',
    'dün gece boğazına sarılmış halde bulundu',
    'için dün gece son geceydi',
    'dün gece evinden çıkamadı',
  ],
  serikatil: [
    'dün gece bir seri katilin eline düştü',
    'dün gece kanlar içinde bulundu',
    'dün gece tanımadığı biri tarafından öldürüldü',
  ],
  kanunsuz: [
    'dün gece sokak ortasında vuruldu',
    'dün gece tek kurşunla düşürüldü',
  ],
  idam: [
    'gardiyanın hücresinden sağ çıkamadı',
    'şafak sökmeden idam edildi',
  ],
  oylama: ['meydanda asıldı'],
  joker: [
    'asılan jokerin peşini bırakmadığı gece can verdi',
    'geceleyin kâbusa tutulup bir daha uyanmadı',
  ],
  suclu: [
    'suçluluğa dayanamayıp kendi canına kıydı',
    'vicdanı kaldırmadı, sabaha çıkamadı',
  ],
  korumaci: [
    'bir korumayla girdiği boğuşmada öldü',
    'korumanın önüne çıkınca canından oldu',
  ],
  // Tuzak ve pusu sebebi ele vermesin: sıradan ölüm cümleleri kullanılır.
  tuzak: [
    'dün gece haince öldürüldü',
    'dün gece pusuya düşürüldü',
    'dün gece arkadan bıçaklandı',
    'için dün gece son geceydi',
  ],
  pusu: [
    'karanlıkta pusuya düşürüldü',
    'bir evin önünde beklenirken vuruldu',
  ],
  veteran: [
    'yanlış kapıyı çaldı',
    'tetikteki bir veteranın evine girdi',
    'gece yanlış eve daldı',
  ],
};

const deathLine = (cause) => pick(DEATH_LINES[cause] ?? ['öldürüldü']);

export function defaultSettings() {
  return {
    minPlayers: 8,
    maxPlayers: 16,
    roles: defaultRoleCounts(),
    timers: { reveal: 10, night: 45, nightResult: 5, day: 60, firstDay: 15, vote: 45, trial: 20, judgement: 20, voteResult: 8 },
    doctorSelfHeal: true,
    doctorRepeat: false,
    jesterEndsGame: true,
    revealRoleOnDeath: false,
    slots: suggestSlots(8),
    firstDayTalk: true,
    autoAdvance: true,
    requireReady: true,
    readyCountdown: 5,
    tasksEnabled: true,
    voiceEnabled: true,
    taskCount: 3,        // oyun başına kaç kişi gizli görev alır
    luckBonusPct: 50,    // görevi başaranın rol şansı yüzde kaç artar
    luckResetOnSpecial: true, // özel rol alınca bonus harcanır
  };
}

export class Room {
  constructor(code, io, { hostName }) {
    this.code = code;
    this.io = io;
    this.hostName = hostName;
    this.createdAt = now();

    this.players = new Map(); // id -> player
    this.spectators = new Map(); // socketId -> {name}
    this.settings = defaultSettings();

    this.phase = PHASE.LOBBY;
    this.dayNo = 0;
    this.phaseEndsAt = null;
    this.chat = [];
    this.chatSeq = 0;
    this.log = [];
    this.result = null;

    this.night = this.freshNight();
    this.nightResolved = false;
    this.votes = new Map(); // voterId -> targetId | 'pas'
    this.taskVotes = new Map(); // subjectId -> Map(voterId -> bool)
    this.jailedId = null;
    this.hauntIds = [];      // asılan jokerin musallat olacağı oyuncular
    this.trialsToday = 0;    // o gün yapılan oylama turu sayısı
    this.traps = new Set();  // kapancının kurduğu tuzaklar
    this.accusedId = null;
    this.judgement = new Map(); // voterId -> true(evet)/false(hayır)
    this.lastVoteResult = null;
    this.lastNightSummary = [];

    this.botTimers = [];
    this.timer = setInterval(() => this.tick(), 1000);
  }

  destroy() {
    clearInterval(this.timer);
    this.clearBotTimers();
  }

  clearBotTimers() {
    for (const t of this.botTimers) clearTimeout(t);
    this.botTimers = [];
  }

  freshNight() {
    return { actions: new Map(), results: new Map(), visits: new Map() };
  }

  // ---------- oyuncular ----------

  alivePlayers() {
    return [...this.players.values()].filter((p) => p.alive);
  }

  seatedPlayers() {
    return [...this.players.values()].sort((a, b) => a.seat - b.seat);
  }

  host() {
    return [...this.players.values()].find((p) => p.isHost) ?? null;
  }

  /**
   * Bir isim/karakter yalnızca o an odada tutulurken kilitlidir.
   * Oyun sürerken kopan oyuncu geri dönebileceği için yeri korunur;
   * lobide ve oyun bitiminde ise kısa bir bekleme sonrası serbest kalır.
   */
  holdsSlot(p) {
    if (p.connected || p.isBot) return true;
    const settled = this.phase === PHASE.LOBBY || this.phase === PHASE.END;
    if (!settled) return true;                       // oyun sürüyor: yeri dursun
    return now() - (p.disconnectedAt ?? 0) < RECONNECT_GRACE;
  }

  isNameTaken(name) {
    const key = name.trim().toLocaleLowerCase('tr');
    return [...this.players.values()].some(
      (p) => this.holdsSlot(p) && p.name.toLocaleLowerCase('tr') === key
    );
  }

  /** Yeri düşmüş kopuk oyuncuları odadan çıkarır. */
  sweepDisconnected() {
    let changed = false;
    for (const p of [...this.players.values()]) {
      if (this.holdsSlot(p)) continue;
      this.players.delete(p.id);
      this.system(`${p.name} odadan düştü.`);
      if (p.isHost) this.promoteNewHost();
      changed = true;
    }
    if (changed) {
      this.refreshLobbyCountdown();
      this.broadcast();
    }
    return changed;
  }

  nextSeat() {
    const used = new Set([...this.players.values()].map((p) => p.seat));
    for (let i = 1; i <= this.settings.maxPlayers; i++) if (!used.has(i)) return i;
    return null;
  }

  isCharacterTaken(charId, exceptId = null) {
    return [...this.players.values()].some(
      (p) => p.id !== exceptId && this.holdsSlot(p) && p.charId === charId
    );
  }

  /** Boşta kalan ilk karakteri verir; hepsi doluysa sıradan birini. */
  freeCharacter() {
    const free = CHARACTERS.find((c) => !this.isCharacterTaken(c.id));
    return (free ?? CHARACTERS[this.players.size % CHARACTERS.length]).id;
  }

  /** Lobide karakter değiştirme. Aynı karakteri iki kişi alamaz. */
  setCharacter(playerId, charId) {
    const player = this.players.get(playerId);
    if (!player) return { error: 'Oyuncu yok.' };
    if (this.phase !== PHASE.LOBBY) return { error: 'Oyun başladıktan sonra karakter değişmez.' };
    if (!CHARACTER_IDS.has(charId)) return { error: 'Geçersiz karakter.' };
    if (this.isCharacterTaken(charId, player.id)) return { error: 'Bu karakteri başkası seçti.' };

    player.charId = charId;
    this.broadcast();
    return { ok: true };
  }

  freeCosmetics() {
    const usedColors = new Set([...this.players.values()].map((p) => p.cosmetic.color));
    const color = COLORS.find((c) => !usedColors.has(c)) ?? pick(COLORS);
    return { color, hat: pick(HATS) };
  }

  /**
   * Yeniden bağlanma. Sadece oyun sürerken ve kopalı bir dakikadan az olmuşsa
   * eski koltuğa oturtur. Diğer hallerde isim ekranı gösterilsin diye null döner.
   */
  reattach(token, socketId) {
    if (!token) return null;
    const player = [...this.players.values()].find((p) => p.token === token);
    if (!player) return null;

    const inGame = this.phase !== PHASE.LOBBY && this.phase !== PHASE.END;
    const away = player.connected ? 0 : now() - (player.disconnectedAt ?? 0);

    if (!inGame || away > REJOIN_WINDOW) return null;

    player.socketId = socketId;
    player.connected = true;
    player.disconnectedAt = null;
    return player;
  }

  addPlayer({ name, socketId, kickUser = null, charId = null }) {
    const clean = String(name ?? '').trim().slice(0, 16);
    if (clean.length < 2) return { error: 'İsim en az 2 karakter olmalı.' };
    if (!/^[\p{L}\p{N}_ .-]+$/u.test(clean)) return { error: 'İsimde sadece harf, rakam ve . _ - kullan.' };
    if (this.isNameTaken(clean)) return { error: 'Bu isim alınmış, başka bir isim seç.' };
    if (this.phase !== PHASE.LOBBY) return { error: 'Oyun başladı. İzleyici olarak katılabilirsin.', spectator: true };
    if (this.players.size >= this.settings.maxPlayers) return { error: 'Köy dolu.', spectator: true };

    const seat = this.nextSeat();
    const isHost = this.players.size === 0;
    const player = {
      id: randomUUID(),
      token: randomUUID(),
      name: clean,
      kickUser,
      socketId,
      connected: true,
      disconnectedAt: null,
      seat,
      isHost,
      alive: true,
      roleId: null,
      cosmetic: { ...this.freeCosmetics(), number: seat },
      charId: this.freeCharacter(),
      deathInfo: null,
      lastProtected: null,
      ready: false,
      isBot: false,
      roleLuck: 1,
      roleUses: {},
      will: '',
      willLocked: false,
      forgedWill: null,
      silencedDay: 0,         // susturucu: bu gün konuşamaz
      roleStolen: false,      // rolü çalındıysa canlandırılınca köylü olur
      execTargetId: null,     // iftiracının hedefi
      vigilanteGuilt: false,  // masum vuran kanunsuz ertesi gece ölür
      vigilanteShotAt: null,
      jailing: null,          // gardiyanın gündüz seçtiği kişi
      presidentRevealed: false,
      abilityDisabled: false, // canlandırılan oyuncu yeteneğini kaybeder
      task: null,
      taskDone: false,
      taskRerolled: false,
      voiceOn: false,
    };

    if (charId && CHARACTER_IDS.has(charId) && !this.isCharacterTaken(charId)) player.charId = charId;

    this.players.set(player.id, player);
    this.system(`${clean} köye geldi.`);
    this.refreshLobbyCountdown();
    return { player };
  }

  removePlayer(playerId) {
    const player = this.players.get(playerId);
    if (!player) return;

    if (this.phase === PHASE.LOBBY) {
      this.players.delete(playerId);
      this.system(`${player.name} köyden ayrıldı.`);
      if (player.isHost) this.promoteNewHost();
      this.refreshLobbyCountdown();
    } else {
      player.connected = false;
      player.disconnectedAt = now();
    }
  }

  /** Moderatörlük hep gerçek bir oyuncuya geçer; botlar moderatör olamaz. */
  /** Moderatörlük hep gerçek bir oyuncuya geçer; botlar moderatör olamaz. */
  promoteNewHost() {
    for (const p of this.players.values()) p.isHost = false;
    const next = this.seatedPlayers().find((p) => !p.isBot && p.connected)
      ?? this.seatedPlayers().find((p) => !p.isBot);
    if (next) {
      next.isHost = true;
      this.system(`${next.name} artık moderatör.`);
    }
  }


  /** Lobide hazır işareti. Herkes hazır olunca oyun kendi başlar. */
  toggleReady(playerId, ready) {
    const player = this.players.get(playerId);
    if (!player) return { error: 'Oyuncu yok.' };
    if (this.phase !== PHASE.LOBBY) return { error: 'Oyun zaten başladı.' };

    player.ready = ready === undefined ? !player.ready : !!ready;
    this.refreshLobbyCountdown();
    this.broadcast();
    return { ok: true, ready: player.ready };
  }

  allReady() {
    const players = this.seatedPlayers();
    return players.length > 0 && players.every((p) => p.ready);
  }

  canBegin() {
    if (this.players.size < this.settings.minPlayers) return false;
    return this.roleCheck().ok;
  }

  /** Herkes hazırsa geri sayım başlatır, biri vazgeçerse iptal eder. */
  refreshLobbyCountdown() {
    if (this.phase !== PHASE.LOBBY) return;

    if (this.allReady() && this.canBegin()) {
      if (!this.phaseEndsAt) {
        this.setTimer(this.settings.readyCountdown);
        this.system(`Herkes hazır. Oyun ${this.settings.readyCountdown} saniye içinde başlıyor.`);
      }
    } else if (this.phaseEndsAt) {
      this.phaseEndsAt = null;
      this.system('Geri sayım durdu.');
    }
  }

  // ---------- botlar ----------

  freeBotName() {
    const pool = [
      'Kemal', 'Sibel', 'Onur', 'Derya', 'Serkan', 'Pelin', 'Emir', 'Nehir',
      'Volkan', 'Buse', 'Cenk', 'Gizem', 'Tarık', 'Esra', 'Murat', 'Aslı',
    ];
    const taken = new Set([...this.players.values()].map((p) => p.name));
    return pool.find((n) => !taken.has(n)) ?? `Bot${this.players.size + 1}`;
  }

  /** count kadar bot ekler. 'fill' verilirse köyü doldurur. */
  addBot(hostId, count = 1) {
    const host = this.players.get(hostId);
    if (!host?.isHost) return { error: 'Sadece moderatör bot ekleyebilir.' };
    if (this.phase !== PHASE.LOBBY) return { error: 'Oyun sırasında bot eklenemez.' };

    const room = this.settings.maxPlayers - this.players.size;
    if (room <= 0) return { error: 'Köy dolu.' };

    const want = count === 'fill' ? room : Math.min(Math.max(1, Number(count) || 1), room);
    let added = 0;

    for (let i = 0; i < want; i++) {
      const res = this.addPlayer({ name: this.freeBotName(), socketId: null });
      if (res.error) break;
        res.player.isBot = true;
      res.player.ready = true;
      res.player.will = pick([
        'Fazla bir şey göremedim, dikkatli olun.',
        'Kimseden emin değilim ama sessiz duranlara bakın.',
        'Gece bir şey duymadım. Oylamada acele etmeyin.',
        'Bana güvenebilirdiniz. Kalanlara bol şans.',
        'Şüphelendiğim biri vardı ama emin olamadım.',
      ]);
      added++;
    }

    if (!added) return { error: 'Bot eklenemedi.' };
    this.refreshLobbyCountdown();
    this.broadcast();
    return { ok: true, added };
  }

  removeBot(hostId, count = 1) {
    const host = this.players.get(hostId);
    if (!host?.isHost) return { error: 'Sadece moderatör bot çıkarabilir.' };
    if (this.phase !== PHASE.LOBBY) return { error: 'Oyun sırasında bot çıkarılamaz.' };

    const bots = this.seatedPlayers().filter((p) => p.isBot);
    if (!bots.length) return { error: 'Oyunda bot yok.' };

    const want = count === 'all' ? bots.length : Math.min(Math.max(1, Number(count) || 1), bots.length);
    for (const bot of bots.slice(-want)) {
      this.players.delete(bot.id);
      this.system(`${bot.name} köyden ayrıldı.`);
    }

    this.refreshLobbyCountdown();
    this.broadcast();
    return { ok: true };
  }

  /** Faz değişince botlara rastgele gecikmeyle sıra gelir. */
  scheduleBots() {
    this.clearBotTimers();
    if (![PHASE.NIGHT, PHASE.VOTE, PHASE.JUDGEMENT, PHASE.DAY].includes(this.phase)) return;

    for (const p of this.players.values()) {
      if (!p.isBot || !p.alive) continue;
      this.botTimers.push(setTimeout(() => this.botAct(p.id), 1800 + Math.random() * 5000));
    }
  }

  botAct(playerId) {
    const p = this.players.get(playerId);
    if (!p?.isBot || !p.alive) return;
    const others = this.alivePlayers().filter((x) => x.id !== p.id);
    if (!others.length) return;

    if (this.phase === PHASE.NIGHT) {
      const cfg = ROLES[p.roleId]?.night;
      if (!cfg?.prompt) return;
      if (cfg.vest) {
        if (Math.random() < 0.5) this.submitNightAction(p.id, {});
      } else if (cfg.jailorExecute) {
        if (Math.random() < 0.35) this.submitNightAction(p.id, {});
      } else {
        const targets = this.targetsFor(p);
        if (targets.length) {
          this.submitNightAction(p.id, {
            targetId: pick(targets),
            text: 'Rolümü söylemedim, kimseye güvenmeyin.',
          });
        }
      }
      return;
    }

    if (this.phase === PHASE.VOTE) {
      if (Math.random() < 0.75) this.submitVote(p.id, pick(others).id);
      else this.submitVote(p.id, 'pas');
      return;
    }

    if (this.phase === PHASE.JUDGEMENT) {
      if (p.id !== this.accusedId) this.submitJudgement(p.id, Math.random() > 0.45);
      return;
    }

    if (this.phase === PHASE.DAY) {
      if (p.roleId === 'jailor') this.setJail(p.id, pick(others).id);
      if (Math.random() < 0.35) {
        this.sendChat(p.id, pick([
          'Bence dikkatli olalım.',
          'Kim ne düşünüyor?',
          'Dün gece sessizdi.',
          'Bana göre şüpheli biri var.',
          'Acele etmeyelim.',
        ]));
      }
    }
  }

  transferHost(fromId, toId) {
    const from = this.players.get(fromId);
    const to = this.players.get(toId);
    if (to?.isBot) return { error: 'Botlar moderatör olamaz.' };
    if (!from?.isHost || !to) return { error: 'Bunu yapamazsın.' };
    from.isHost = false;
    to.isHost = true;
    this.system(`Moderatörlük ${to.name} oyuncusuna geçti.`);
    return { ok: true };
  }

  /** Moderatör oyuncuyu odadan atar. Oyun sırasında da çalışır. */
  kickPlayer(hostId, targetId) {
    const host = this.players.get(hostId);
    const target = this.players.get(targetId);
    if (!host?.isHost) return { error: 'Sadece moderatör atabilir.' };
    if (!target || target.id === host.id) return { error: 'Bu oyuncu atılamaz.' };

    const inGame = this.phase !== PHASE.LOBBY && this.phase !== PHASE.END;
    this.players.delete(targetId);
    this.system(`${target.name} odadan çıkarıldı.`);
    if (target.socketId) {
      this.io.to(target.socketId).emit('kicked', { reason: 'Moderatör seni odadan çıkardı.' });
    }

    if (inGame) {
      // Vampirlerin başı gittiyse yerine geçilsin, sonra kazanma durumuna bak.
      this.promoteEdward();
      this.finishIfOver();
    } else {
      this.refreshLobbyCountdown();
    }

    this.broadcast();
    return { ok: true };
  }

  setCosmetic(playerId, patch) {
    const player = this.players.get(playerId);
    if (!player) return { error: 'Oyuncu yok.' };
    if (patch.color && COLORS.includes(patch.color)) player.cosmetic.color = patch.color;
    if (patch.hat && HATS.includes(patch.hat)) player.cosmetic.hat = patch.hat;
    if (Number.isInteger(patch.number) && patch.number >= 1 && patch.number <= 99) {
      player.cosmetic.number = patch.number;
    }
    return { ok: true };
  }

  // ---------- ayarlar ----------

  /**
   * Ayarları önce tamamen doğrular, sonra tek seferde uygular.
   * Yarım uygulanmış ayar bırakmaz: bir alan hatalıysa hiçbiri değişmez.
   */
  updateSettings(hostId, patch) {
    const host = this.players.get(hostId);
    if (!host?.isHost) return { error: 'Sadece moderatör ayarları değiştirebilir.' };
    if (this.phase !== PHASE.LOBBY) return { error: 'Oyun başladıktan sonra ayar değişmez.' };

    const next = {
      ...this.settings,
      roles: { ...this.settings.roles },
      timers: { ...this.settings.timers },
    };

    if (patch.roles) {
      for (const role of CONFIGURABLE_ROLES) {
        if (patch.roles[role.id] === undefined) continue;
        const n = Number(patch.roles[role.id]);
        if (!Number.isInteger(n) || n < role.min || n > role.max) {
          return { error: `${role.name} sayısı ${role.min}-${role.max} arasında olmalı.` };
        }
        next.roles[role.id] = n;
      }
      // Rol sayıları verildiyse slot listesini de ona göre kur.
      next.slots = this.slotsFromCounts(next.roles, Math.max(this.players.size, this.settings.minPlayers));
    }

    if (patch.slots) {
      if (!Array.isArray(patch.slots) || patch.slots.some((x) => !slotInfo(x))) {
        return { error: 'Geçersiz slot listesi.' };
      }
      if (patch.slots.length > this.settings.maxPlayers) return { error: 'Çok fazla slot.' };
      next.slots = [...patch.slots];
    }

    if (patch.timers) {
      const limits = {
        reveal: [5, 30], night: [15, 180], nightResult: [3, 30], firstDay: [5, 120],
        day: [30, 600], vote: [15, 180], voteResult: [3, 30],
      };
      for (const [key, [min, max]] of Object.entries(limits)) {
        if (patch.timers[key] === undefined) continue;
        const n = Number(patch.timers[key]);
        if (!Number.isInteger(n) || n < min || n > max) {
          return { error: `${key} süresi ${min}-${max} saniye arasında olmalı.` };
        }
        next.timers[key] = n;
      }
    }

    const flags = [
      'doctorSelfHeal', 'doctorRepeat', 'jesterEndsGame', 'revealRoleOnDeath',
      'firstDayTalk', 'autoAdvance', 'tasksEnabled', 'voiceEnabled', 'luckResetOnSpecial',
      'requireReady',
    ];
    for (const key of flags) {
      if (typeof patch[key] === 'boolean') next[key] = patch[key];
    }

    if (patch.readyCountdown !== undefined) {
      const n = Number(patch.readyCountdown);
      if (!Number.isInteger(n) || n < 3 || n > 30) return { error: 'Geri sayım 3-30 saniye olmalı.' };
      next.readyCountdown = n;
    }
    if (patch.taskCount !== undefined) {
      const n = Number(patch.taskCount);
      if (!Number.isInteger(n) || n < 0 || n > 16) return { error: 'Görev alan kişi sayısı 0-16 arasında olmalı.' };
      next.taskCount = n;
    }
    if (patch.luckBonusPct !== undefined) {
      const n = Number(patch.luckBonusPct);
      if (!Number.isInteger(n) || n < 0 || n > 200) return { error: 'Şans bonusu 0-200 arasında olmalı.' };
      next.luckBonusPct = n;
    }

    if (patch.minPlayers !== undefined) {
      const n = Number(patch.minPlayers);
      if (!Number.isInteger(n) || n < 4 || n > 16) return { error: 'En az oyuncu 4-16 arasında olmalı.' };
      next.minPlayers = n;
    }
    if (patch.maxPlayers !== undefined) {
      const n = Number(patch.maxPlayers);
      if (!Number.isInteger(n) || n < 4 || n > 16) return { error: 'En fazla oyuncu 4-16 arasında olmalı.' };
      if (n < this.players.size) return { error: `Şu an ${this.players.size} oyuncu var, altına inemezsin.` };
      next.maxPlayers = n;
    }
    if (next.minPlayers > next.maxPlayers) next.minPlayers = next.maxPlayers;

    this.settings = next;
    return { ok: true };
  }

  autoBalance(hostId) {
    const host = this.players.get(hostId);
    if (!host?.isHost) return { error: 'Sadece moderatör yapabilir.' };
    this.settings.roles = suggestRoleCounts(Math.max(this.players.size, this.settings.minPlayers));
    this.settings.slots = suggestSlots(Math.max(this.players.size, this.settings.minPlayers));
    this.broadcast();
    return { ok: true };
  }

  roleCheck() {
    return validateSlots(this.settings.slots, this.players.size);
  }

  /** Rol sayılarından slot listesi üretir (klasik kurulum köprüsü). */
  slotsFromCounts(counts, playerCount) {
    const slots = [];
    for (const role of CONFIGURABLE_ROLES) {
      for (let i = 0; i < (counts[role.id] ?? 0); i++) slots.push(`rol:${role.id}`);
    }
    // Klasik kurulumda boş kalan yerler köylüyle dolar; slot kurulumunda köylü yok.
    while (slots.length < playerCount) slots.push('rol:koylu');
    return slots.slice(0, Math.max(playerCount, slots.length));
  }

  /** Moderatör slot listesini değiştirir. */
  setSlots(hostId, slots) {
    const host = this.players.get(hostId);
    if (!host?.isHost) return { error: 'Sadece moderatör değiştirebilir.' };
    if (this.phase !== PHASE.LOBBY) return { error: 'Oyun başladıktan sonra değişmez.' };
    if (!Array.isArray(slots)) return { error: 'Geçersiz liste.' };
    if (slots.length > this.settings.maxPlayers) return { error: 'Çok fazla slot.' };
    if (slots.some((x) => !slotInfo(x))) return { error: 'Bilinmeyen slot.' };

    this.settings.slots = slots;
    this.broadcast();
    return { ok: true };
  }

  // ---------- oyun akışı ----------

  start(hostId) {
    const host = this.players.get(hostId);
    if (!host?.isHost) return { error: 'Sadece moderatör başlatabilir.' };
    if (this.phase !== PHASE.LOBBY) return { error: 'Oyun zaten başladı.' };
    if (this.players.size < this.settings.minPlayers) {
      return { error: `En az ${this.settings.minPlayers} oyuncu gerekli. Şu an ${this.players.size} kişi var.` };
    }
    const check = this.roleCheck();
    if (!check.ok) return { error: check.error };

    const notReady = this.seatedPlayers().filter((p) => !p.ready);
    if (notReady.length && this.settings.requireReady) {
      return { error: `Hazır olmayanlar var: ${notReady.map((p) => p.name).join(', ')}` };
    }

    this.beginGame();
    return { ok: true };
  }

  /** Asıl başlatma. Hem hazır sayacı hem moderatör düğmesi buraya düşer. */
  beginGame() {
    this.resetPlayersForGame();
    this.assignRoles();
    this.assignExecutionerTargets();
    if (this.settings.tasksEnabled) this.assignTasks();
    this.taskVotes = new Map();
    this._spyAliases = null;
    this.log = [];
    this.chat = this.chat.filter((m) => m.channel === 'kick').slice(-40);
    this.system('Roller dağıtıldı. Kimseye rolünü söyleme.');
    this.gotoPhase(PHASE.REVEAL);
  }

  /**
   * Rolleri dağıtır. Özel roller önce dağıtılır ve oyuncular rol şanslarına
   * göre ağırlıklı sıralanır — görevini başaranın özel rol alma ihtimali artar.
   */
  /**
   * Roller slot listesinden dağıtılır. Her slot bir oyuncuya karşılık gelir;
   * kategori slotları o kategoriden rastgele ve tekrarsız seçer.
   */
  assignRoles() {
    const cozum = resolveSlots(this.settings.slots ?? []);

    // Şans bonusu: belirlenmiş slotlar (Gardiyan, Edward, Araştırmacı…) önce
    // dağıtılır, "Rastgele Köylü" slotları sona kalır. Şanslı oyuncu listenin
    // başında olduğu için özel slota düşme ihtimali artar.
    const ozel = shuffle(cozum.filter((c) => c.slot !== 'kat:koy').map((c) => c.roleId));
    const genel = shuffle(cozum.filter((c) => c.slot === 'kat:koy').map((c) => c.roleId));
    const pool = [...ozel, ...genel];

    // Slot eksikse (eski kayıt) kalanı köylüyle tamamla.
    while (pool.length < this.seatedPlayers().length) pool.push('koylu');

    const ordered = this.luckyOrder(this.seatedPlayers());

    ordered.forEach((p, i) => {
      p.roleId = pool[i];
      p.alive = true;
      p.deathInfo = null;
      p.lastProtected = null;
      if (this.settings.luckResetOnSpecial) p.roleLuck = 1;
    });
  }

  /**
   * Ağırlıklı sıralama (Efraimidis-Spirakis). roleLuck ne kadar yüksekse
   * oyuncunun listenin başında olma ihtimali o kadar artar.
   */
  luckyOrder(players) {
    return players
      .map((p) => ({ p, key: Math.pow(Math.random(), 1 / Math.max(p.roleLuck ?? 1, 0.01)) }))
      .sort((a, b) => b.key - a.key)
      .map((x) => x.p);
  }

  // ---------- gizli görevler ----------

  /** Yeni oyun için oyuncu durumlarını sıfırlar. */
  resetPlayersForGame() {
    for (const p of this.players.values()) {
      p.task = null;
      p.taskDone = false;
      p.taskRerolled = false;
      p.roleUses = {};
      p.will = '';
      p.willLocked = false;
      p.forgedWill = null;
      p.silencedDay = 0;
      p.roleStolen = false;
      p.execTargetId = null;
      p.vigilanteGuilt = false;
      p.vigilanteShotAt = null;
      p.jailing = null;
      p.presidentRevealed = false;
      p.abilityDisabled = false;
      p.ready = false;

      // Botlara her oyunda yeni bir vasiyet: sıfırlama sonrası verilir.
      if (p.isBot) {
        p.will = pick([
          'Fazla bir şey göremedim, dikkatli olun.',
          'Kimseden emin değilim ama sessiz duranlara bakın.',
          'Gece bir şey duymadım. Oylamada acele etmeyin.',
          'Bana güvenebilirdiniz. Kalanlara bol şans.',
          'Şüphelendiğim biri vardı ama emin olamadım.',
        ]);
      }
    }
    this.jailedId = null;
    this.accusedId = null;
    this.judgement.clear();
    this.announce = null;
    this._spyAliases = null;
    this.traps.clear();
  }

  assignTasks() {
    // 10 kişiye kadar 2, 11 ve üstünde 3 kişiye görev verilir.
    const oto = this.seatedPlayers().length >= 11 ? 3 : 2;
    const count = Math.min(this.settings.taskCount ?? oto, this.players.size);
    if (count <= 0) return;

    const pool = shuffle(TASKS);
    const chosen = shuffle(this.seatedPlayers()).slice(0, count);

    chosen.forEach((p, i) => {
      p.task = this.buildTask(pool[i % pool.length], p);
    });
  }

  buildTask(def, player) {
    let text = def.text;
    let targetId = null;

    if (def.needsTarget) {
      const others = this.seatedPlayers().filter((p) => p.id !== player.id);
      const target = others.length ? pick(others) : null;
      targetId = target?.id ?? null;
      text = text.replace('{hedef}', target?.name ?? 'bir oyuncu');
    }

    return { id: def.id, text, verify: def.verify, points: def.points, targetId, optional: !!def.optional };
  }

  /** Görevini beğenmeyen bir kere değiştirebilir. */
  rerollTask(playerId) {
    const player = this.players.get(playerId);
    if (!player?.task) return { error: 'Görevin yok.' };
    if (player.taskRerolled) return { error: 'Görevini bir kere değiştirdin.' };
    if (!this.canReroll()) return { error: 'Görev değiştirme süresi doldu.' };

    const used = new Set([...this.players.values()].map((p) => p.task?.id).filter(Boolean));
    const options = TASKS.filter((t) => t.id !== player.task.id && !used.has(t.id));
    const def = options.length ? pick(options) : pick(TASKS.filter((t) => t.id !== player.task.id));

    player.task = this.buildTask(def, player);
    player.taskRerolled = true;
    this.broadcast();
    return { ok: true };
  }

  canReroll() {
    return this.phase === PHASE.REVEAL || (this.phase === PHASE.DAY && this.dayNo === 1);
  }

  checkLynchTasks(lynchedId) {
    for (const p of this.players.values()) {
      if (p.task?.verify !== VERIFY.AUTO) continue;
      const def = TASK_BY_ID.get(p.task.id);
      if (def?.auto === 'lynchTarget' && p.task.targetId === lynchedId && p.alive) {
        p.taskDone = true;
      }
    }
  }

  checkSurvivalTasks() {
    for (const p of this.players.values()) {
      if (p.task?.verify !== VERIFY.AUTO) continue;
      const def = TASK_BY_ID.get(p.task.id);
      if (def?.auto === 'surviveDay3' && this.dayNo >= 3 && p.alive) {
        p.taskDone = true;
      }
    }
  }

  submitTaskVote(voterId, subjectId, ok) {
    if (this.phase !== PHASE.END) return { error: 'Görev onayı sadece oyun sonunda.' };
    const voter = this.players.get(voterId);
    const subject = this.players.get(subjectId);
    if (!voter || !subject?.task) return { error: 'Geçersiz oy.' };
    if (subject.task.verify === VERIFY.AUTO) return { error: 'Bu görevi oyun takip ediyor.' };
    if (subject.task.verify === VERIFY.HOST && !voter.isHost) {
      return { error: 'Bu görevi sadece oyun sahibi onaylar.' };
    }

    if (!this.taskVotes.has(subjectId)) this.taskVotes.set(subjectId, new Map());
    this.taskVotes.get(subjectId).set(voterId, !!ok);
    this.broadcast();
    return { ok: true };
  }

  taskOutcome(player) {
    if (!player.task) return { status: 'yok', yes: 0, no: 0 };

    if (player.task.verify === VERIFY.AUTO) {
      return { status: player.taskDone ? 'basarili' : 'basarisiz', yes: 0, no: 0 };
    }

    const votes = this.taskVotes.get(player.id);
    if (!votes || votes.size === 0) return { status: 'bekliyor', yes: 0, no: 0 };

    const yes = [...votes.values()].filter(Boolean).length;
    const no = votes.size - yes;
    return { status: yes > no ? 'basarili' : 'basarisiz', yes, no };
  }

  /**
   * Oyun sonunda görevini başaranların rol şansını artırır.
   * Oylar kesinleştikten sonra, yeni oyuna geçerken çağrılır.
   */
  applyTaskRewards() {
    const bonus = 1 + this.settings.luckBonusPct / 100;
    const CAP = 5;
    const rewarded = [];

    for (const p of this.players.values()) {
      if (!p.task) continue;
      if (this.taskOutcome(p).status !== 'basarili') continue;

      p.roleLuck = Math.min((p.roleLuck ?? 1) * bonus, CAP);
      rewarded.push({ name: p.name, luck: p.roleLuck });
    }

    if (rewarded.length) {
      const list = rewarded.map((r) => `${r.name} (x${r.luck.toFixed(2)})`).join(', ');
      this.system(`Görevini başaranların rol şansı arttı: ${list}`);
    }
    return rewarded;
  }

  taskSummary() {
    return this.seatedPlayers()
      .filter((p) => p.task)
      .map((p) => {
        const outcome = this.taskOutcome(p);
        return {
          playerId: p.id,
          name: p.name,
          cosmetic: p.cosmetic,
          task: p.task,
          outcome: outcome.status,
          yes: outcome.yes,
          no: outcome.no,
          points: outcome.status === 'basarili' ? p.task.points : 0,
        };
      })
      .sort((a, b) => b.points - a.points);
  }

  // ---------- sesli sohbet ----------

  /**
   * Oyuncunun hangi ses odasında olduğunu döndürür.
   * Sunucu karar verir; istemci sadece aynı odadaki kişilerle bağlantı kurar,
   * böylece gece köylüye vampir sesi hiç gönderilmez.
   */
  /**
   * Ses sadece gündüz açık ve herkes tek odada.
   * Gece hiç kimse konuşmaz — bağlantı kurulmaz, kapatılmaz.
   */
  voiceRoomFor(player) {
    if (!player || !this.settings.voiceEnabled) return null;
    if (this.phase === PHASE.NIGHT || this.phase === PHASE.NIGHT_RESULT) return null;
    // Ölüler de köy odasında: dinlerler ama mikrofonları kapalıdır.
    return 'koy';
  }

  /** Ölüler sadece dinler. */
  voiceCanSpeak(player) {
    return Boolean(player?.alive);
  }

  voicePeers(player) {
    const room = this.voiceRoomFor(player);
    if (!room) return [];
    return [...this.players.values()]
      .filter((p) => p.id !== player.id && p.connected && p.voiceOn && this.voiceRoomFor(p) === room)
      .map((p) => p.id);
  }

  setVoice(playerId, on) {
    const player = this.players.get(playerId);
    if (!player) return { error: 'Oyuncu yok.' };
    player.voiceOn = !!on;
    this.broadcast();
    return { ok: true };
  }

  gotoPhase(phase) {
    this.phase = phase;
    const t = this.settings.timers;

    switch (phase) {
      case PHASE.REVEAL:
        this.dayNo = 0;
        this.setTimer(t.reveal);
        break;

      case PHASE.NIGHT: {
        this.nightResolved = false;
        const jailor = this.alivePlayers().find((p) => p.roleId === 'jailor');
        this.jailedId = jailor?.jailing ?? null;
        if (this.jailedId) {
          const jailed = this.players.get(this.jailedId);
          this.pushChat({
            channel: 'hapis', from: 'sistem', name: 'Sistem', kind: 'system',
            text: `${jailed.name} bu gece hapiste. Sadece Gardiyan ile konuşabilir.`,
          });
        }
        this.night = this.freshNight();
        this.system(`Gece ${this.nightNo()} başladı. Köy uyuyor.`);
        this.setTimer(t.night);
        break;
      }

      case PHASE.NIGHT_RESULT:
        // Gecenin son saniyesinde çözülmediyse burada çözülür.
        if (!this.nightResolved) {
          this.resolveNight();
          this.nightResolved = true;
        }
        // Ölümler tek tek gösterilecek: her ölü için ekstra süre.
        const oluSayisi = (this.lastNightSummary ?? []).filter((x) => x.kind === 'death').length;
        this.setTimer(t.nightResult + oluSayisi * 6);
        break;

      case PHASE.DAY:
        this.dayNo += 1;
        this.checkSurvivalTasks();
        this.votes.clear();
        this.system(
          this.voteEnabled()
            ? `Gün ${this.dayNo}. Tartışın, sonra oylama var.`
            : `Gün ${this.dayNo}. Tanışma günü, bugün oylama yok.`
        );
        this.trialsToday = 0;
        // İlk gün sadece tanışma; kısa tutulur.
        this.setTimer(this.voteEnabled() ? t.day : t.firstDay);
        break;

      case PHASE.VOTE:
        this.trialsToday += 1;
        this.judgement.clear();
        this.accusedId = null;
        this.system('Oylama başladı. Kimin savunma yapmasını istiyorsun?');
        this.setTimer(t.vote);
        break;

      case PHASE.TRIAL: {
        const accused = this.players.get(this.accusedId);
        this.judgement.clear();
        this.system(`${accused?.name ?? 'Sanık'} meydanın ortasına çıktı. Savunma süresi başladı.`);
        this.setTimer(t.trial);
        break;
      }

      case PHASE.JUDGEMENT:
        this.system('Karar zamanı. Asılsın mı, asılmasın mı?');
        this.setTimer(t.judgement);
        break;

      case PHASE.VOTE_RESULT:
        this.resolveVote();
        this.setTimer(t.voteResult);
        break;

      case PHASE.END:
        this.phaseEndsAt = null;
        break;

      default:
        this.phaseEndsAt = null;
    }

    this.scheduleBots();
    this.broadcast();
  }

  nightNo() {
    return Math.max(1, this.dayNo === 0 ? 1 : this.dayNo);
  }

  voteEnabled() {
    return !(this.settings.firstDayTalk && this.dayNo === 1);
  }

  setTimer(seconds) {
    this.phaseEndsAt = now() + seconds * 1000;
  }

  tick() {
    this.sweepDisconnected();
    if (!this.phaseEndsAt) return;

    // Ölümü gece bitmeden bir saniye önce göster: efekt haritada oynasın.
    if (this.phase === PHASE.NIGHT && !this.nightResolved && this.phaseEndsAt - now() <= 1000) {
      this.resolveNight();
      this.nightResolved = true;
      this.broadcast();
    }

    if (this.settings.autoAdvance) this.maybeSkipAhead();

    if (now() >= this.phaseEndsAt) {
      this.advance();
      return;
    }
    this.broadcast();
  }

  /**
   * Herkes işini bitirdiyse fazı erken kapat.
   * GECE hariç: gardiyan, doktor, kâhin gibi roller için gece hep tam sürer.
   */
  maybeSkipAhead() {
    const remaining = this.phaseEndsAt - now();
    if (remaining <= 3000) return;

    // Oylama erken kapanmaz: herkes oy verse bile fikir değiştirilebilmeli.
    if (this.phase === PHASE.JUDGEMENT) {
      const jury = this.alivePlayers().filter((p) => p.id !== this.accusedId);
      if (jury.length && jury.every((p) => this.judgement.has(p.id))) this.phaseEndsAt = now() + 5000;
    }
  }

  advance() {
    switch (this.phase) {
      case PHASE.LOBBY: {
        this.phaseEndsAt = null;
        if (this.allReady() && this.canBegin()) this.beginGame();
        break;
      }
      case PHASE.REVEAL:
        this.gotoPhase(this.settings.firstDayTalk ? PHASE.DAY : PHASE.NIGHT);
        break;
      case PHASE.NIGHT:
        this.gotoPhase(PHASE.NIGHT_RESULT);
        break;
      case PHASE.NIGHT_RESULT:
        if (!this.finishIfOver()) this.gotoPhase(PHASE.DAY);
        break;
      case PHASE.DAY:
        this.gotoPhase(this.voteEnabled() ? PHASE.VOTE : PHASE.NIGHT);
        break;
      case PHASE.VOTE: {
        const accusedId = this.tallyNomination();
        if (accusedId) {
          this.accusedId = accusedId;
          this.gotoPhase(PHASE.TRIAL);
        } else {
          this.lastVoteResult = { kind: 'none', text: 'Kimse yeterli oy almadı. Bugün kimse asılmadı.' };
          this.system(this.lastVoteResult.text);
          this.gotoPhase(PHASE.VOTE_RESULT);
        }
        break;
      }
      case PHASE.TRIAL:
        this.gotoPhase(PHASE.JUDGEMENT);
        break;
      case PHASE.JUDGEMENT:
        this.gotoPhase(PHASE.VOTE_RESULT);
        break;
      case PHASE.VOTE_RESULT: {
        if (this.finishIfOver()) break;

        // Günde iki duruşma hakkı var; biri asılırsa gün biter.
        const asildi = this.voteResult?.kind === 'lynch';
        if (!asildi && this.trialsToday < 2 && this.alivePlayers().length > 2) {
          this.system('Kimse asılmadı. İkinci oylama başlıyor.');
          this.gotoPhase(PHASE.VOTE);
          break;
        }
        this.gotoPhase(PHASE.NIGHT);
        break;
      }
      default:
        break;
    }
  }

  skipPhase(hostId) {
    const host = this.players.get(hostId);
    if (!host?.isHost) return { error: 'Sadece moderatör geçebilir.' };
    if (this.phase === PHASE.LOBBY || this.phase === PHASE.END) return { error: 'Şu an geçilecek faz yok.' };
    this.phaseEndsAt = now();
    return { ok: true };
  }

  // ---------- gece ----------

  submitNightAction(playerId, payload = {}) {
    if (this.phase !== PHASE.NIGHT) return { error: 'Şu an gece değil.' };
    const player = this.players.get(playerId);
    if (!player?.alive) return { error: 'Ölüler oynayamaz.' };
    if (player.abilityDisabled) return { error: 'Canlandıktan sonra yeteneğini kullanamıyorsun.' };
    if (player.id === this.jailedId) return { error: 'Bu gece hapistesin, rolünü kullanamazsın.' };

    const cfg = ROLES[player.roleId]?.night;
    if (!cfg?.prompt) return { error: 'Gece yeteneğin yok.' };

    const left = this.usesLeft(player);
    if (left !== null && left <= 0) return { error: 'Hakkın kalmadı.' };

    // Veteran tetikte bekler: hedef seçmez, tekrar basınca vazgeçer.
    if (cfg.alert) {
      if (this.night.actions.has(player.id)) {
        this.night.actions.delete(player.id);
        this.privateLine(player, 'Tetikte beklemekten vazgeçtin.');
      } else {
        this.night.actions.set(player.id, { alert: true });
        this.privateLine(player, 'Tetiktesin. Bu gece evine gelen ölür.');
      }
      this.broadcast();
      return { ok: true };
    }

    // Survivor sadece kendine yelek giyer. Tekrar basınca vazgeçer.
    if (cfg.vest) {
      if (this.night.actions.has(player.id)) {
        this.night.actions.delete(player.id);
        this.privateLine(player, 'Yeleği çıkardın.');
      } else {
        this.night.actions.set(player.id, { use: true });
        this.privateLine(player, 'Yeleği giydin. Bu gece sana saldırı işlemez.');
      }
      this.broadcast();
      return { ok: true };
    }

    // Gardiyan idam kararı. Tekrar basınca vazgeçer.
    if (cfg.jailorExecute) {
      if (!this.jailedId) return { error: 'Hapiste kimse yok.' };
      if (this.night.actions.has(player.id)) {
        this.night.actions.delete(player.id);
        this.privateLine(player, 'İdam kararından vazgeçtin.');
      } else {
        this.night.actions.set(player.id, { execute: true, targetId: this.jailedId });
        this.privateLine(player, 'İdam kararı verdin.');
      }
      this.broadcast();
      return { ok: true };
    }

    const targetId = payload?.targetId ?? payload;

    // Arabacı iki kişi seçer.
    if (cfg.transport) {
      const a = this.players.get(payload?.targetId);
      const b = this.players.get(payload?.targetId2);
      if (!a?.alive || !b?.alive || a.id === b.id) return { error: 'İki farklı hayatta oyuncu seç.' };
      this.night.actions.set(player.id, { targetId: a.id, targetId2: b.id });
      this.privateLine(player, `${a.name} ile ${b.name} yer değiştirecek.`);
      this.broadcast();
      return { ok: true };
    }

    // Rol hırsızı ölü seçer.
    if (cfg.deadTargets) {
      const t = this.players.get(payload?.targetId);
      if (!t || t.alive) return { error: 'Sadece ölmüş birinin rolünü alabilirsin.' };
      this.night.actions.set(player.id, { targetId: t.id });
      this.broadcast();
      return { ok: true };
    }

    // Aynı hedefe tekrar basmak seçimi geri alır.
    // keep=true ise sadece metin güncelleniyordur (dolandırıcı yazarken).
    if (!payload?.keep && this.night.actions.get(player.id)?.targetId === targetId) {
      this.night.actions.delete(player.id);
      this.privateLine(player, 'Seçimini geri aldın.');
      this.broadcast();
      return { ok: true };
    }

    const target = this.players.get(targetId);
    if (!target) return { error: 'Geçersiz hedef.' };

    if (cfg.targetsDead) {
      if (target.alive) return { error: 'Sadece ölü bir oyuncuyu canlandırabilirsin.' };
    } else if (!target.alive) {
      return { error: 'Geçersiz hedef.' };
    }

    if (target.id === player.id && !this.selfTargetAllowed(player)) {
      return { error: 'Kendini seçemezsin.' };
    }
    if (player.roleId === 'doktor' && !this.settings.doctorRepeat && player.lastProtected === target.id) {
      return { error: 'Aynı kişiyi üst üste koruyamazsın.' };
    }
    if (isVampire(player.roleId) && isVampire(target.roleId)) {
      return { error: 'Kendi tarafına saldıramazsın.' };
    }

    const action = { targetId: target.id };
    if (cfg.forgeWill) action.text = String(payload?.text ?? '').slice(0, 500);
    this.night.actions.set(player.id, action);

    if (cfg.vampireOrder) {
      this.pushChat({
        channel: 'vampir', from: 'sistem', name: 'Sistem', kind: 'system',
        text: `Edward emri verdi: bu gece ${target.name}.`,
      });
    }

    this.broadcast();
    return { ok: true, targetId: target.id };
  }

  // ---------- gündüz eylemleri ----------

  /** Gardiyan gündüz hapsedeceği kişiyi seçer. */
  setJail(playerId, targetId) {
    const player = this.players.get(playerId);
    if (player?.roleId !== 'jailor' || !player.alive) return { error: 'Gardiyan değilsin.' };
    if (![PHASE.DAY, PHASE.VOTE, PHASE.TRIAL, PHASE.JUDGEMENT].includes(this.phase)) {
      return { error: 'Hapis seçimi sadece gündüz yapılır.' };
    }
    const target = this.players.get(targetId);
    if (!target?.alive) return { error: 'Geçersiz hedef.' };
    if (target.id === player.id) return { error: 'Kendini hapsedemezsin.' };

    player.jailing = target.id;
    this.broadcast();
    return { ok: true };
  }

  /** Başkan kendini ilan eder: oyu 3 sayılır, tüm köye duyurulur. */
  revealPresident(playerId) {
    const player = this.players.get(playerId);
    if (player?.roleId !== 'baskan' || !player.alive) return { error: 'Başkan değilsin.' };
    if (player.presidentRevealed) return { error: 'Zaten ilan ettin.' };
    if (![PHASE.DAY, PHASE.VOTE].includes(this.phase)) return { error: 'Sadece gündüz ilan edebilirsin.' };

    player.presidentRevealed = true;
    this.system(`${player.name} başkan olduğunu açıkladı. Oyu 3 sayılacak.`);
    this.announce = { kind: 'president', name: player.name, at: now() };
    this.broadcast();
    return { ok: true };
  }

  /** Vasiyet. Ölünce kilitlenir, bir daha değişmez. */
  setWill(playerId, text) {
    const player = this.players.get(playerId);
    if (!player) return { error: 'Oyuncu yok.' };
    if (player.willLocked) return { error: 'Öldükten sonra vasiyetini değiştiremezsin.' };
    player.will = String(text ?? '').slice(0, 500);
    return { ok: true };
  }

  voteWeight(player) {
    return player.presidentRevealed && player.roleId === 'baskan' ? 3 : 1;
  }

  selfTargetAllowed(player) {
    if (player.roleId === 'doktor') return this.settings.doctorSelfHeal;
    return ROLES[player.roleId]?.night?.self === true;
  }

  /**
   * Gecenin çözümü. Sıra önemli:
   *  1) Hapis        — hapisteki hiçbir şey yapamaz, dışarıdan kimse ona ulaşamaz
   *  2) Engelleme    — escort; gardiyanı engelleyemez
   *  3) Bilgi        — kâhin, bekçi, casus
   *  4) Saldırılar   — vampir (Edward emri), seri katil, kanunsuz
   *  5) Korumalar    — doktor, survivor yeleği
   *  6) Ölümler      — gardiyan idamı korumaları deler
   *  7) Vasiyet sahtekârlığı, Edward'ın yerine geçme, canlandırma
   */
  resolveNight() {
    const alive = () => this.alivePlayers();
    const act = (id) => this.night.actions.get(id) ?? null;
    const summary = [];

    const visits = new Map();
    const visit = (targetId, visitorId) => {
      if (!targetId) return;
      if (!visits.has(targetId)) visits.set(targetId, new Set());
      visits.get(targetId).add(visitorId);
    };

    // ── 1) hapis ──
    const jailor = alive().find((p) => p.roleId === 'jailor');
    const jailedId = this.jailedId ?? null;
    const jailed = jailedId ? this.players.get(jailedId) : null;

    // ── 1b) arabacı: iki evi değiştir. Diğer bütün hedefler buna göre kayar. ──
    const swap = new Map();
    for (const tr of alive().filter((p) => p.roleId === 'arabaci' && act(p.id))) {
      if (this.jailedId === tr.id || tr.abilityDisabled) continue;
      const a = act(tr.id);
      const x = this.players.get(a.targetId);
      const y = this.players.get(a.targetId2);
      if (!x?.alive || !y?.alive || x.id === y.id) continue;

      // Hapistekiler taşınamaz.
      if (x.id === jailedId || y.id === jailedId) {
        this.night.results.set(tr.id, {
          kind: 'arabaci',
          text: 'Seçtiklerinden biri hapisteydi, taşıma olmadı.',
        });
        continue;
      }

      swap.set(x.id, y.id);
      swap.set(y.id, x.id);
      // Taşıma uzaktan yapılır: o evlere gidilmez, tuzağa/pusuya yakalanılmaz.

      this.night.results.set(tr.id, {
        kind: 'arabaci',
        text: `${x.name} ile ${y.name} yer değiştirdi.`,
      });
      this.privateLine(x, 'Bu gece evin başka bir yere taşındı.');
      this.privateLine(y, 'Bu gece evin başka bir yere taşındı.');
    }

    // Taşınma sonrası hedefleri yeniden yönlendir (arabacının kendi eylemi hariç).
    if (swap.size) {
      for (const [id, a] of this.night.actions) {
        const p = this.players.get(id);
        if (!p || p.roleId === 'arabaci') continue;
        // Kendine yönelen eylemler (yelek, kendini koruma) taşınmadan etkilenmez.
        if (a.targetId === id) continue;
        if (a.targetId && swap.has(a.targetId)) a.targetId = swap.get(a.targetId);
      }
    }

    // ── 2) engelleme ──
    const blocked = new Set();
    if (jailedId) blocked.add(jailedId);

    const escorts = alive().filter(
      (p) => ['escort', 'jigolo'].includes(p.roleId) && !blocked.has(p.id) && act(p.id)
    );
    const rawBlocks = [];
    for (const e of escorts) {
      const targetId = act(e.id).targetId;
      const target = this.players.get(targetId);
      if (!target) continue;

      if (target.roleId === 'jailor') {
        this.night.results.set(e.id, { kind: 'escort', text: 'Gardiyanı engelleyemedin. Gecen boşa gitti.' });
        continue;
      }
      rawBlocks.push({ by: e.id, target: targetId });
      visit(targetId, e.id);
    }
    // Kendisi engellenen escort'un engellemesi iptal olur.
    for (const b of rawBlocks) if (!blocked.has(b.by)) blocked.add(b.target);
    for (const b of rawBlocks) {
      if (!blocked.has(b.by)) continue;
      const stillBlockedBy = rawBlocks.some((o) => o.target === b.target && !blocked.has(o.by));
      if (!stillBlockedBy) blocked.delete(b.target);
    }

    const canAct = (p) => p && p.alive && !blocked.has(p.id) && !p.abilityDisabled;

    // ── 3) bilgi rolleri ──

    // Sahtekâr: damgalanan kişi o gece araştırmalarda yanlış görünür.
    const damgali = new Set();
    for (const fr of alive().filter((p) => p.roleId === 'sahtekar' && act(p.id))) {
      if (!canAct(fr)) continue;
      const t = this.players.get(act(fr.id).targetId);
      if (!t) continue;
      visit(t.id, fr.id);
      damgali.add(t.id);
      this.night.results.set(fr.id, { kind: 'sahtekar', text: `${t.name} bu gece suçlu görünecek.` });
    }

    for (const k of alive().filter((p) => p.roleId === 'kahin' && act(p.id))) {
      if (!canAct(k)) continue;
      const t = this.players.get(act(k.id).targetId);
      if (!t) continue;
      visit(t.id, k.id);

      const text = `${t.name} şu üçünden biri: ${this.seerOptions(t, damgali.has(t.id)).join(' · ')}`;
      this.night.results.set(k.id, { kind: 'kahin', text });
      // Sadece kâhinin göreceği özel sohbet satırı.
      this.pushChat({
        channel: 'kahin', from: k.id, name: 'Kâhin görüşü', text, kind: 'system',
      });
    }

    // Şerif: suçlu mu? Edward kendini temize çeker.
    for (const sf of alive().filter((p) => p.roleId === 'serif' && act(p.id))) {
      if (!canAct(sf)) continue;
      const t = this.players.get(act(sf.id).targetId);
      if (!t) continue;
      visit(t.id, sf.id);

      // Vampir takımı suçlu görünür; Edward kendini temize çeker.
      // Seri katil ve Joker de suçsuz görünür.
      const suclu =
        damgali.has(t.id) ||
        (isVampire(t.roleId) && t.roleId !== 'edward' && t.roleId !== 'casus');
      const text = suclu ? `${t.name} suçlu görünüyor.` : `${t.name} suçsuz görünüyor.`;
      this.night.results.set(sf.id, { kind: 'serif', text });
      this.pushChat({ channel: 'ozel', from: sf.id, name: 'Şerif raporu', text, kind: 'system' });
    }

    // Takipçi: hedefin o gece kime gittiğini gör.
    for (const tk of alive().filter((p) => p.roleId === 'takipci' && act(p.id))) {
      if (!canAct(tk)) continue;
      const t = this.players.get(act(tk.id).targetId);
      if (!t) continue;
      visit(t.id, tk.id);

      const gitti = act(t.id)?.targetId;
      const yer = gitti ? this.players.get(gitti) : null;
      const text = yer && yer.id !== t.id
        ? `${t.name} gece ${yer.name} adlı oyuncuya gitti.`
        : `${t.name} gece evinden çıkmadı.`;
      this.night.results.set(tk.id, { kind: 'takipci', text });
      this.pushChat({ channel: 'ozel', from: tk.id, name: 'Takip raporu', text, kind: 'system' });
    }

    // Tacizci: rolü üç seçeneğe daraltır (kâhin ile aynı mantık).
    for (const tc of alive().filter((p) => p.roleId === 'tacizci' && act(p.id))) {
      if (!canAct(tc)) continue;
      const t = this.players.get(act(tc.id).targetId);
      if (!t) continue;
      visit(t.id, tc.id);

      const text = `${t.name} şu üçünden biri: ${this.seerOptions(t, damgali.has(t.id)).join(' · ')}`;
      this.night.results.set(tc.id, { kind: 'tacizci', text });
      this.pushChat({ channel: 'ozel', from: tc.id, name: 'Araştırma', text, kind: 'system' });
    }

    // Susturucu: ertesi gün konuşamaz.
    for (const sz of alive().filter((p) => p.roleId === 'susturucu' && act(p.id))) {
      if (!canAct(sz)) continue;
      const t = this.players.get(act(sz.id).targetId);
      if (!t) continue;
      visit(t.id, sz.id);
      t.silencedDay = this.dayNo + 1;
      this.night.results.set(sz.id, { kind: 'susturucu', text: `${t.name} yarın konuşamayacak.` });
    }

    // Kapancı: tuzak kur ya da kendine kurup hepsini kaldır.
    const trapper = alive().find((p) => p.roleId === 'kapanci' && act(p.id));
    if (trapper && canAct(trapper)) {
      const t = this.players.get(act(trapper.id).targetId);
      if (t && t.id === trapper.id) {
        this.traps.clear();
        this.night.results.set(trapper.id, { kind: 'kapanci', text: 'Bütün tuzakları kaldırdın.' });
      } else if (t) {
        if (this.spendUse(trapper)) {
          this.traps.add(t.id);
          this.night.results.set(trapper.id, {
            kind: 'kapanci',
            text: `${t.name} evine tuzak kuruldu. Kalan tuzak: ${this.usesLeft(trapper)}`,
          });
        } else {
          this.night.results.set(trapper.id, { kind: 'kapanci', text: 'Tuzak hakkın kalmadı.' });
        }
      }
    }

    // Kamuflaj: pusu kurulan eve gelenler ölür.
    const ambushes = new Map();   // ev sahibi -> pusucu
    for (const am of alive().filter((p) => p.roleId === 'kamuflaj' && act(p.id))) {
      if (!canAct(am)) continue;
      const t = this.players.get(act(am.id).targetId);
      if (!t || t.id === am.id || isVampire(t.roleId)) continue;
      // Pusu sessizdir: ziyaret olarak sayılmaz, koruma ve tuzaklar işlemez.
      ambushes.set(t.id, am.id);
    }

    // Rol hırsızı: ölmüş birinin rolünü al.
    for (const th of alive().filter((p) => p.roleId === 'rolhirsizi' && act(p.id))) {
      if (!canAct(th)) continue;
      const t = this.players.get(act(th.id).targetId);
      if (!t || t.alive) continue;
      if (!this.spendUse(th)) continue;

      const yeni = t.roleId;
      t.roleStolen = true;
      th.roleId = yeni;
      th.roleLuck = 1;
      this.system(`Rol hırsızı bir ölünün rolünü aldı: artık ${roleName(yeni)}.`);
      this.night.results.set(th.id, { kind: 'rolhirsizi', text: `Artık ${roleName(yeni)} oldun.` });
    }

    // ── 4) saldırılar ──
    const attacks = []; // { attackerId, targetId, kind, pierces }

    // Vampirler: hedefi Edward seçer, saldırıyı normal vampir yapar.
    const edward = alive().find((p) => p.roleId === 'edward');
    const order = edward && act(edward.id) ? act(edward.id).targetId : null;

    if (order) {
      const grunts = alive().filter((p) => p.roleId === 'vampir');
      let killer = null;

      if (grunts.length > 0) {
        // Edward engellense bile saldırıyı vampir yapar; sadece vampirlerin
        // hepsi engellendiyse kil çıkmaz.
        killer = grunts.find((g) => !blocked.has(g.id) && !g.abilityDisabled) ?? null;
        if (!killer) {
          summary.push({ kind: 'blocked', text: 'Vampirler bu gece harekete geçemedi.' });
        }
      } else if (canAct(edward)) {
        killer = edward; // vampir kalmadıysa Edward kendi gider
      }

      if (killer) {
        attacks.push({ attackerId: killer.id, targetId: order, kind: 'vampir' });
        visit(order, killer.id);
      }

      // Casus vampirlerin nereye gittiğini görür.
      const target = this.players.get(order);
      for (const spy of alive().filter((p) => p.roleId === 'casus')) {
        this.night.results.set(spy.id, {
          kind: 'casus',
          text: target ? `Vampirler bu gece ${target.name} evine gitti.` : 'Vampirler bu gece kimseye gitmedi.',
        });
      }
    }

    // Seri katili engellemeye gelen kişi ölür ve engel işlemez.
    for (const sk of alive().filter((p) => p.roleId === 'serikatil')) {
      for (const b of rawBlocks) {
        if (b.target !== sk.id) continue;
        const engelleyen = this.players.get(b.by);
        if (!engelleyen?.alive) continue;
        attacks.push({ attackerId: sk.id, targetId: engelleyen.id, kind: 'serikatil' });
        blocked.delete(sk.id);
        this.night.results.set(sk.id, {
          kind: 'serikatil',
          text: `${engelleyen.name} seni engellemeye geldi, onu öldürdün.`,
        });
      }
    }

    for (const sk of alive().filter((p) => p.roleId === 'serikatil' && act(p.id))) {
      if (!canAct(sk)) continue;
      const t = act(sk.id).targetId;
      attacks.push({ attackerId: sk.id, targetId: t, kind: 'serikatil' });
      visit(t, sk.id);
    }

    for (const k of alive().filter((p) => p.roleId === 'kanunsuz' && act(p.id))) {
      if (!canAct(k)) continue;
      if (!this.spendUse(k)) continue;
      const t = act(k.id).targetId;
      attacks.push({ attackerId: k.id, targetId: t, kind: 'kanunsuz' });
      k.vigilanteShotAt = t;
      visit(t, k.id);
    }

    // Veteran tetikteyken gelenlerin eylemi yine de işler; sadece ziyaret ölümcüldür.
    // ── veteran tetikte bekler ──
    const alerted = new Set();
    for (const v of alive().filter((p) => p.roleId === 'veteran' && act(p.id)?.alert)) {
      if (!canAct(v)) continue;
      if (!this.spendUse(v)) {
        this.night.results.set(v.id, { kind: 'veteran', text: 'Tetikte bekleme hakkın kalmadı.' });
        continue;
      }
      alerted.add(v.id);
    }

    // ── 5) korumalar ──
    const protectedIds = new Set();
    for (const id of alerted) protectedIds.add(id);   // tetikteyken saldırı işlemez

    for (const d of alive().filter((p) => p.roleId === 'doktor' && act(p.id))) {
      if (!canAct(d)) continue;
      const t = act(d.id).targetId;
      if (t === jailedId) {
        this.night.results.set(d.id, { kind: 'doktor', text: 'Hapistekine ulaşamadın.' });
        continue;
      }
      const hedef = this.players.get(t);
      if (hedef?.presidentRevealed) {
        this.night.results.set(d.id, {
          kind: 'doktor',
          text: 'Başkanlığını ilan etmiş birini iyileştiremezsin.',
        });
        visit(t, d.id);
        continue;
      }
      protectedIds.add(t);
      d.lastProtected = t;
      visit(t, d.id);
    }

    for (const sv of alive().filter((p) => p.roleId === 'survivor' && act(p.id))) {
      if (!canAct(sv)) continue;
      if (!act(sv.id).use) continue;
      if (!this.spendUse(sv)) {
        this.night.results.set(sv.id, { kind: 'survivor', text: 'Yeleğin kalmadı.' });
        continue;
      }
      protectedIds.add(sv.id);
      this.night.results.set(sv.id, {
        kind: 'survivor',
        text: `Yelek giydin. Kalan: ${this.usesLeft(sv)}`,
      });
    }

    // ── 6) vasiyet sahtekârlığı (ölümlerden ÖNCE, o gece ölen için de geçerli olsun) ──
    for (const f of alive().filter((p) => p.roleId === 'dolandirici' && act(p.id))) {
      if (!canAct(f)) continue;
      const a = act(f.id);
      const t = this.players.get(a.targetId);
      if (!t || t.willLocked) continue;
      t.forgedWill = String(a.text ?? '').slice(0, 500);
      visit(t.id, f.id);
      this.night.results.set(f.id, { kind: 'dolandirici', text: `${t.name} vasiyeti değiştirildi.` });
    }

    // ── 7) ölümler ──
    const deaths = new Map(); // playerId -> sebep

    // Koruma: hedefine gelen saldırıyı canıyla durdurur.
    for (const bg of alive().filter((p) => p.roleId === 'korumaci' && act(p.id))) {
      if (!canAct(bg)) continue;
      const t = this.players.get(act(bg.id).targetId);
      if (!t) continue;
      visit(t.id, bg.id);

      const gelenSaldirilar = attacks.filter((a) => a.targetId === t.id && a.attackerId !== bg.id);
      if (!gelenSaldirilar.length) continue;

      const karsilanan = pick(gelenSaldirilar);
      const saldirgan = this.players.get(karsilanan.attackerId);

      // Karşılanan saldırı boşa düşer; koruma ve saldırgan birbirini öldürür.
      const idx = attacks.indexOf(karsilanan);
      if (idx >= 0) attacks.splice(idx, 1);

      if (saldirgan?.alive) deaths.set(saldirgan.id, 'korumaci');
      deaths.set(bg.id, 'korumaci');
      protectedIds.add(t.id);

      this.night.results.set(bg.id, {
        kind: 'korumaci',
        text: `${t.name} adlı oyuncuya saldırı geldi. Saldırganla birlikte öldünüz.`,
      });
      this.privateLine(t, 'Biri sana saldırdı ama koruman araya girdi.');
    }

    for (const a of attacks) {
      const target = this.players.get(a.targetId);
      if (!target?.alive) continue;

      // Hapisteki kişiye dışarıdan ulaşılamaz.
      if (target.id === jailedId) {
        this.night.results.set(a.attackerId, {
          kind: 'engel',
          text: `${target.name} bu gece hapisteydi, ulaşamadın.`,
        });
        continue;
      }
      // Koruma ve gece bağışıklığı aynı mesajı verir: sebep sızmasın.
      if (protectedIds.has(target.id) || ROLES[target.roleId]?.nightImmune) {
        this.night.results.set(a.attackerId, {
          kind: 'engel',
          text: `${target.name} bu gece korunuyordu, savunması çok güçlüydü.`,
        });
        continue;
      }
      deaths.set(target.id, a.kind);
    }

    // Masum vuran kanunsuz suçluluktan ölür.
    for (const k of alive().filter((p) => p.vigilanteGuilt)) {
      deaths.set(k.id, 'suclu');
      k.vigilanteGuilt = false;
    }

    // Asılan jokerin musallatı: evet diyenlerden biri ölür.
    if (this.hauntIds?.length) {
      const uygun = this.hauntIds.filter((id) => this.players.get(id)?.alive);
      if (uygun.length) {
        const kurban = this.players.get(pick(uygun));
        deaths.set(kurban.id, 'joker');
      }
      this.hauntIds = [];
    }

    // Tuzak: eve gireni öldürür VE ev sahibini korur.
    for (const evId of this.traps) {
      const gelenler = [...(visits.get(evId) ?? new Set())].filter((id) => id !== evId);
      let patladi = false;

      for (const visitorId of gelenler) {
        const v = this.players.get(visitorId);
        if (!v?.alive) continue;
        deaths.set(visitorId, 'tuzak');
        patladi = true;
      }

      if (patladi) {
        protectedIds.add(evId);
        deaths.delete(evId);
        this.privateLine(this.players.get(evId), 'Evindeki tuzak patladı, biri sana ulaşamadı.');
        this.traps.delete(evId);   // tuzak kullanıldı
      }
    }

    // Pusu: gelenlerden BİRİ ölür, hepsi pusucunun adını öğrenir.
    for (const [evId, pusucuId] of ambushes) {
      const pusucu = this.players.get(pusucuId);
      const gelenler = [...(visits.get(evId) ?? new Set())]
        .filter((id) => id !== evId && id !== pusucuId)
        .map((id) => this.players.get(id))
        .filter((v) => v?.alive);

      for (const v of gelenler) {
        this.privateLine(
          v,
          `Hedefini ziyaret ettiğin sırada ${pusucu.name} adlı oyuncunun pusu kurduğunu gördün.`
        );
      }

      const kurbanlar = gelenler.filter((v) => !isVampire(v.roleId));
      if (kurbanlar.length) {
        const kurban = pick(kurbanlar);
        deaths.set(kurban.id, 'pusu');
        this.night.results.set(pusucuId, {
          kind: 'kamuflaj',
          text: `Pusuna ${gelenler.length} kişi geldi, ${kurban.name} öldü.`,
        });
      } else {
        this.night.results.set(pusucuId, { kind: 'kamuflaj', text: 'Pusuna kimse düşmedi.' });
      }
    }

    // Tetikteki veteranın evine gelen herkes ölür.
    for (const vetId of alerted) {
      const vet = this.players.get(vetId);
      const gelenler = [...(visits.get(vetId) ?? new Set())].filter((id) => id !== vetId);
      for (const visitorId of gelenler) {
        const visitor = this.players.get(visitorId);
        if (!visitor?.alive) continue;
        deaths.set(visitorId, 'veteran');
      }
      this.night.results.set(vetId, {
        kind: 'veteran',
        text: gelenler.length
          ? `Tetikteydin. Evine ${gelenler.length} kişi geldi, hepsi öldü.`
          : `Tetikteydin. Kimse gelmedi. Kalan hak: ${this.usesLeft(vet)}`,
      });
    }

    // Gardiyan idamı: her korumayı deler.
    if (jailor && jailed?.alive && act(jailor.id)?.execute) {
      if (this.spendUse(jailor)) {
        deaths.set(jailed.id, 'idam');

        // Köy tarafından birini idam ettiysen kalan haklarını kaybedersin.
        if ((ROLES[jailed.roleId]?.team ?? 'koy') === 'koy') {
          jailor.roleUses = { ...(jailor.roleUses ?? {}), [jailor.roleId]: this.maxUses(jailor) };
          this.privateLine(jailor, 'Masum birini idam ettin. Kalan idam hakların gitti.');
        }
      } else {
        this.night.results.set(jailor.id, { kind: 'jailor', text: 'İdam hakkın kalmadı.' });
      }
    }

    for (const [id, cause] of deaths) {
      const victim = this.players.get(id);
      victim.alive = false;
      victim.willLocked = true;
      victim.deathInfo = { cause, night: this.nightNo() };
      summary.push({
        kind: 'death',
        playerId: victim.id,
        cause,
        text: `${victim.name} ${deathLine(cause)}.`,
        roleText: this.settings.revealRoleOnDeath ? `Rolü: ${roleName(victim.roleId)}` : null,
        will: this.willOf(victim),
      });
      this.pushChat({ channel: 'olu', from: 'sistem', name: 'Sistem', text: `${victim.name} aramıza katıldı.`, kind: 'system' });
    }

    if (deaths.size === 0) {
      summary.push({ kind: 'quiet', text: 'Sakin bir geceydi. Kimse ölmedi.' });
    }

    // ── Edward'ın yerine geçme ──
    // Kanunsuz köy tarafından birini vurduysa ertesi gece pişmanlıktan ölür.
    for (const k of this.seatedPlayers().filter((p) => p.roleId === 'kanunsuz' && p.vigilanteShotAt)) {
      const vurulan = this.players.get(k.vigilanteShotAt);
      k.vigilanteShotAt = null;
      if (!vurulan || vurulan.alive || !k.alive) continue;
      if ((ROLES[vurulan.roleId]?.team ?? 'koy') !== 'koy') continue;
      k.vigilanteGuilt = true;
      this.privateLine(k, 'Masum birini vurdun. Bu suçlulukla yaşayamazsın.');
    }

    this.promoteEdward(summary);
    this.checkExecutioners();

    // ── canlandırma (en son) ──
    for (const c of alive().filter((p) => p.roleId === 'canlandirici' && act(p.id))) {
      if (!canAct(c)) continue;
      const t = this.players.get(act(c.id).targetId);
      if (!t || t.alive) continue;
      if (!this.spendUse(c)) continue;

      t.alive = true;
      t.willLocked = false;
      t.deathInfo = null;
      t.abilityDisabled = true;
      // Rolü çalınmışsa geri dönen kişi köylü olur.
      if (t.roleStolen) {
        t.roleId = 'koylu';
        t.roleStolen = false;
        this.privateLine(t, 'Rolün çalınmıştı; köylü olarak döndün.');
      }
      deaths.delete(t.id);
      summary.push({ kind: 'revive', playerId: t.id, text: `${t.name} mezardan geri döndü. Artık gece yeteneğini kullanamıyor.` });
    }

    // ── bekçi sonuçları (tüm ziyaretler hesaplandıktan sonra) ──
    for (const b of alive().filter((p) => p.roleId === 'bekci' && act(p.id))) {
      if (!canAct(b)) continue;
      const t = this.players.get(act(b.id).targetId);
      if (!t) continue;
      const seen = [...(visits.get(t.id) ?? new Set())]
        .filter((id) => id !== b.id)
        .map((id) => this.players.get(id)?.name)
        .filter(Boolean);
      this.night.results.set(b.id, {
        kind: 'bekci',
        text: seen.length ? `${t.name} evine gelenler: ${seen.join(', ')}` : `${t.name} evine kimse gelmedi.`,
      });
    }

    for (const p of this.players.values()) if (blocked.has(p.id) && p.roleId !== 'jailor' && p.id !== jailedId) {
      if (!this.night.results.has(p.id)) {
        this.night.results.set(p.id, { kind: 'engel', text: 'Birisi dikkatini dağıttı. Bu gece bir şey yapamadın.' });
      }
    }
    if (jailedId && !this.night.results.has(jailedId)) {
      this.night.results.set(jailedId, { kind: 'hapis', text: 'Bu gece hapisteydin. Rolünü kullanamadın.' });
    }

    this.lastNightSummary = summary;
    for (const line of summary) this.system(line.text);
    this.night.visits = visits;
    this.jailedId = null;
    for (const p of this.players.values()) p.jailing = null;
  }

  /** Edward ölmüşse yerine sırayla vampir, sonra casus/dolandırıcı geçer. */
  promoteEdward(summary = []) {
    const alive = this.alivePlayers();
    if (alive.some((p) => p.roleId === 'edward')) return null;

    const successor =
      alive.find((p) => p.roleId === 'vampir') ??
      alive.find((p) => p.roleId === 'kamuflaj') ??
      alive.find((p) => p.roleId === 'susturucu') ??
      alive.find((p) => p.roleId === 'tacizci') ??
      alive.find((p) => p.roleId === 'jigolo') ??
      alive.find((p) => p.roleId === 'dolandirici');

    if (!successor) return null;

    const oldRole = roleName(successor.roleId);
    successor.roleId = 'edward';
    successor.abilityDisabled = false;

    this.pushChat({
      channel: 'vampir',
      from: 'sistem',
      name: 'Sistem',
      text: `Edward öldü. Artık emri ${successor.name} veriyor (eski rolü: ${oldRole}).`,
      kind: 'system',
    });
    summary.push({ kind: 'promote', text: 'Vampirlerin başına yeni biri geçti.' });
    return successor;
  }

  // ---------- yetenek kullanım hakları ----------

  maxUses(player) {
    return ROLES[player.roleId]?.night?.uses ?? null;
  }

  usesLeft(player) {
    const max = this.maxUses(player);
    if (max == null) return null;
    return max - (player.roleUses[player.roleId] ?? 0);
  }

  spendUse(player) {
    const max = this.maxUses(player);
    if (max == null) return true;
    const used = player.roleUses[player.roleId] ?? 0;
    if (used >= max) return false;
    player.roleUses[player.roleId] = used + 1;
    return true;
  }

  /**
   * Kâhin sonucu: gerçek rol + 2 sahte, karışık sırada.
   * Sahteler mümkünse oyunda bulunan rollerden seçilir, olmazsa havuzdan.
   */
  /**
   * Kâhin sonucu: gerçek rol + 2 sahte, karışık sırada.
   * Üçlü genelde 2 köy + 1 kötü olur; %20 ihtimalle 2 kötü çıkar.
   * Kâhin kendisi asla seçeneklerde görünmez.
   */
  seerOptions(target, damgali = false) {
    // Damgalanan kişi gerçek rolü yerine bir vampir rolü olarak okunur.
    const real = damgali
      ? pick(CONFIGURABLE_ROLES.filter((r) => r.team === 'vampir' && r.id !== 'edward').map((r) => r.id))
      : target.roleId;
    const usable = CONFIGURABLE_ROLES.filter((r) => r.id !== real && r.id !== 'kahin');

    const inGame = (id) => (this.settings.roles[id] ?? 0) > 0;
    const byGame = (ids) => [...shuffle(ids.filter(inGame)), ...shuffle(ids.filter((i) => !inGame(i)))];

    const townPool = byGame([...usable.filter((r) => r.team === 'koy').map((r) => r.id), 'koylu']);
    const evilPool = byGame(usable.filter((r) => r.team !== 'koy').map((r) => r.id));

    const realIsEvil = (ROLES[real]?.team ?? 'koy') !== 'koy';
    const wantEvil = (Math.random() < 0.2 ? 2 : 1) - (realIsEvil ? 1 : 0);

    const fakes = [];
    for (let i = 0; i < Math.max(0, wantEvil) && evilPool.length; i++) fakes.push(evilPool.shift());
    while (fakes.length < 2 && townPool.length) fakes.push(townPool.shift());
    while (fakes.length < 2 && evilPool.length) fakes.push(evilPool.shift());

    return shuffle([real, ...fakes]).map(roleName);
  }

  /** İftiracıya oyun başında köy tarafından bir hedef verilir. */
  assignExecutionerTargets() {
    const hedefler = this.seatedPlayers().filter(
      (p) => (ROLES[p.roleId]?.team ?? 'koy') === 'koy' && p.roleId !== 'iftiraci'
    );
    for (const ex of this.seatedPlayers().filter((p) => p.roleId === 'iftiraci')) {
      const secilebilir = hedefler.filter((p) => p.id !== ex.id);
      if (!secilebilir.length) continue;
      ex.execTargetId = pick(secilebilir).id;
    }
  }

  /** Hedefi asılmadan ölen iftiracı Joker'a döner. */
  checkExecutioners() {
    for (const ex of this.alivePlayers().filter((p) => p.roleId === 'iftiraci')) {
      const hedef = ex.execTargetId ? this.players.get(ex.execTargetId) : null;
      if (hedef && !hedef.alive && hedef.deathInfo?.cause !== 'oylama') {
        ex.roleId = 'joker';
        ex.execTargetId = null;
        this.privateLine(ex, 'Hedefin asılmadan öldü. Artık Joker’sın: asıl ve kazan.');
      }
    }
  }

  /** Sadece o oyuncunun göreceği kısa bilgi satırı. */
  privateLine(player, text) {
    this.pushChat({ channel: 'ozel', from: player.id, name: 'Bilgi', text, kind: 'system' });
  }

  /** Hapistekine gardiyan "Gardiyan" olarak görünür. */
  shownRole(player) {
    return roleName(player.roleId);
  }

  willOf(player) {
    if (player.forgedWill != null) return { text: player.forgedWill, forged: true };
    return { text: player.will ?? '', forged: false };
  }

  // ---------- oylama ----------

  submitVote(playerId, targetId) {
    if (this.phase !== PHASE.VOTE) return { error: 'Şu an oylama yok.' };
    const player = this.players.get(playerId);
    if (!player?.alive) return { error: 'Ölüler oy veremez.' };

    if (targetId === 'pas') {
      this.votes.set(playerId, 'pas');
      this.broadcast();
      return { ok: true };
    }

    const target = this.players.get(targetId);
    if (!target?.alive) return { error: 'Geçersiz hedef.' };
    // Joker asılmak ister; kendine oy verebilir.
    if (target.id === player.id && player.roleId !== 'joker') {
      return { error: 'Kendine oy veremezsin.' };
    }

    this.votes.set(playerId, target.id);
    this.broadcast();
    return { ok: true };
  }

  /** Oylamada en çok oyu alan (ağırlıklı) sanık. Beraberlikte kimse çıkmaz. */
  tallyNomination() {
    const tally = new Map();
    for (const [voterId, targetId] of this.votes) {
      if (targetId === 'pas') continue;
      const voter = this.players.get(voterId);
      if (!voter?.alive) continue;
      tally.set(targetId, (tally.get(targetId) ?? 0) + this.voteWeight(voter));
    }
    if (tally.size === 0) return null;

    const top = Math.max(...tally.values());
    const tied = [...tally.entries()].filter(([, n]) => n === top).map(([id]) => id);
    return tied.length === 1 ? tied[0] : null;
  }

  submitJudgement(playerId, verdict) {
    if (this.phase !== PHASE.JUDGEMENT) return { error: 'Şu an karar zamanı değil.' };
    const player = this.players.get(playerId);
    if (!player?.alive) return { error: 'Ölüler oy veremez.' };
    if (player.id === this.accusedId) return { error: 'Kendi hakkında oy veremezsin.' };

    if (verdict === null) this.judgement.delete(playerId);
    else this.judgement.set(playerId, !!verdict);

    this.broadcast();
    return { ok: true };
  }

  resolveVote() {
    const accused = this.players.get(this.accusedId);
    if (!accused) {
      if (!this.lastVoteResult) {
        this.lastVoteResult = { kind: 'none', text: 'Bugün kimse asılmadı.' };
        this.system(this.lastVoteResult.text);
      }
      return;
    }

    let yes = 0;
    let no = 0;
    for (const [voterId, verdict] of this.judgement) {
      const voter = this.players.get(voterId);
      if (!voter?.alive) continue;
      const w = this.voteWeight(voter);
      if (verdict) yes += w;
      else no += w;
    }

    if (yes <= no) {
      this.lastVoteResult = {
        kind: 'spared', playerId: accused.id, yes, no,
        text: `${accused.name} serbest bırakıldı. (${yes} evet, ${no} hayır)`,
      };
      this.system(this.lastVoteResult.text);
      this.accusedId = null;
      return;
    }

    accused.alive = false;
    accused.willLocked = true;
    accused.deathInfo = { cause: 'oylama', day: this.dayNo };

    const roleText = this.settings.revealRoleOnDeath ? ` Rolü: ${roleName(accused.roleId)}.` : '';
    this.lastVoteResult = {
      kind: 'lynch',
      playerId: accused.id,
      yes,
      no,
      text: `${accused.name} ${yes} evete karşı ${no} hayırla asıldı.${roleText}`,
      will: this.willOf(accused),
    };
    this.system(this.lastVoteResult.text);
    this.pushChat({ channel: 'olu', from: 'sistem', name: 'Sistem', text: `${accused.name} aramıza katıldı.`, kind: 'system' });

    this.checkLynchTasks(accused.id);
    this.promoteEdward();

    this.checkExecutioners();

    // İftiracının hedefi asıldıysa iftiracı kazanır.
    const iftiraci = this.alivePlayers().find(
      (p) => p.roleId === 'iftiraci' && p.execTargetId === accused.id
    );
    if (iftiraci) {
      this.endGame('iftiraci', `${iftiraci.name} hedefini astırdı. İftiracı kazandı.`);
      this.accusedId = null;
      return;
    }
    // Joker asıldı: ertesi gece "evet" diyenlerden birini öldürür.
    if (accused.roleId === 'joker') {
      this.hauntIds = [...this.judgement.entries()]
        .filter(([id, v]) => v === true && id !== accused.id)
        .map(([id]) => id)
        .filter((id) => this.players.get(id)?.alive);
    }

    if (accused.roleId === 'joker' && this.settings.jesterEndsGame) {
      this.endGame('joker', `${accused.name} tam istediği gibi asıldı. Joker kazandı.`);
    }
    this.accusedId = null;
  }

  // ---------- kazanma ----------

  /**
   * Kazanma koşulları.
   * Survivor kimsenin önünü kesmez; hayattaysa kazanan tarafa eklenir.
   */
  checkWin() {
    const alive = this.alivePlayers();
    const vamps = alive.filter((p) => isVampire(p.roleId));
    const killers = alive.filter((p) => p.roleId === 'serikatil');
    const survivors = alive.filter((p) => p.roleId === 'survivor');

    // Survivor ve joker kimseye tehdit değil, sayıma dahil ama taraf tutmaz.
    const neutralPassive = alive.filter((p) => p.roleId === 'survivor' || p.roleId === 'joker');
    const village = alive.filter((p) => roleTeam(p.roleId) === TEAM.VILLAGE);

    if (vamps.length === 0 && killers.length === 0) {
      return { winner: TEAM.VILLAGE, text: 'Tüm tehditler temizlendi. Köy kazandı.' };
    }

    // Seri katil tek başına kaldıysa (yanında sadece survivor varsa) kazanır.
    if (killers.length > 0 && vamps.length === 0 && village.length === 0) {
      const rest = alive.filter((p) => p.roleId !== 'serikatil' && p.roleId !== 'survivor');
      if (rest.length === 0) {
        return { winner: 'serikatil', text: 'Seri katil herkesi geride bıraktı.' };
      }
    }

    // Vampirler: seri katil yokken köyle sayıca eşitlenirlerse kazanır.
    if (vamps.length > 0 && killers.length === 0) {
      const opposition = village.length + neutralPassive.filter((p) => p.roleId === 'joker').length;
      if (vamps.length >= opposition) {
        return { winner: TEAM.VAMPIRE, text: 'Vampirler köyü ele geçirdi.' };
      }
    }

    return null;
  }

  finishIfOver() {
    if (this.phase === PHASE.END) return true;
    const win = this.checkWin();
    if (!win) return false;
    this.endGame(win.winner, win.text);
    return true;
  }

  endGame(winner, text) {
    const survivors = this.alivePlayers()
      .filter((p) => p.roleId === 'survivor')
      .map((p) => p.name);

    this.result = {
      winner,
      text,
      survivors,
      roles: this.seatedPlayers().map((p) => ({
        id: p.id,
        name: p.name,
        roleId: p.roleId,
        alive: p.alive,
        cosmetic: p.cosmetic,
      })),
    };
    this.system(text);
    this.gotoPhase(PHASE.END);
  }

  restart(hostId) {
    const host = this.players.get(hostId);
    if (!host?.isHost) return { error: 'Sadece moderatör yeniden başlatabilir.' };

    this.phase = PHASE.LOBBY;
    this.dayNo = 0;
    this.phaseEndsAt = null;
    this.result = null;
    this.votes.clear();
    this.night = this.freshNight();
    this.lastNightSummary = [];
    this.lastVoteResult = null;
    this.log = [];
    this.chat = this.chat.filter((m) => m.channel === 'kick').slice(-40);

    if (this.settings.tasksEnabled) this.applyTaskRewards();

    this.taskVotes = new Map();
    for (const p of this.players.values()) {
      p.alive = true;
      p.roleId = null;
      p.deathInfo = null;
      p.lastProtected = null;
      p.task = null;
      p.taskDone = false;
      p.taskRerolled = false;
    }
    // Kopmuş oyuncuları lobiye dönerken temizle.
    for (const p of [...this.players.values()]) {
      if (!p.connected && !p.isBot) this.players.delete(p.id);
    }

    this.system('Yeni oyun için lobiye dönüldü.');
    this.broadcast();
    return { ok: true };
  }

  // ---------- sohbet ----------

  pushChat({ channel, from, to = null, name, text, kind = 'player', color = null }) {
    const msg = { id: ++this.chatSeq, channel, from, to, name, text, kind, color, ts: now() };
    this.chat.push(msg);
    if (this.chat.length > 400) this.chat.splice(0, this.chat.length - 400);
    return msg;
  }

  system(text) {
    this.log.push({ text, ts: now(), day: this.dayNo, phase: this.phase });
    if (this.log.length > 200) this.log.shift();
    this.pushChat({ channel: 'sistem', from: 'sistem', name: 'Sistem', text, kind: 'system' });
  }

  chatChannelFor(player) {
    // Susturucu ile susturulan oyuncu o gün yazamaz.
    if (player?.alive && player.silencedDay === this.dayNo && this.phase !== PHASE.NIGHT) {
      return null;
    }
    if (!player) return null;

    // Gece medyum ile ölüler seansta konuşur.
    const seansVar = this.phase === PHASE.NIGHT && this.alivePlayers().some((p) => p.roleId === 'medium');
    if (!player.alive) return seansVar ? 'seans' : 'olu';

    if (this.phase === PHASE.NIGHT) {
      // Hapisteki ve gardiyan yalnızca birbirleriyle konuşur.
      if (player.id === this.jailedId) return 'hapis';
      if (player.roleId === 'jailor' && this.jailedId) return 'hapis';
      if (player.roleId === 'medium') return 'seans';
      // Casus okur ama yazamaz.
      if (player.roleId === 'casus') return null;
      if (isVampire(player.roleId)) return 'vampir';
      return null;
    }

    if (this.phase === PHASE.TRIAL) {
      // Savunma sırasında sadece sanık konuşur.
      return player.id === this.accusedId ? 'koy' : null;
    }

    if ([PHASE.LOBBY, PHASE.DAY, PHASE.VOTE, PHASE.JUDGEMENT, PHASE.END].includes(this.phase)) return 'koy';
    return null;
  }

  /**
   * Fısıldama: "/w3 merhaba" → 3 numaralı oyuncuya özel mesaj.
   * Metni sadece iki taraf görür; köy sohbetinde "X, Y'ye fısıldıyor..." satırı çıkar.
   */
  tryWhisper(player, raw) {
    const m = /^\/w\s*(\d+)\s+([\s\S]+)$/.exec(raw.trim());
    if (!m) return null;

    if (!player.alive) return { error: 'Ölüyken fısıldayamazsın.' };
    if (this.phase !== PHASE.DAY && this.phase !== PHASE.VOTE) {
      return { error: 'Sadece gündüz fısıldayabilirsin.' };
    }

    const seat = Number(m[1]);
    const target = this.seatedPlayers().find((p) => p.cosmetic?.number === seat);
    if (!target) return { error: `${seat} numaralı oyuncu yok.` };
    if (target.id === player.id) return { error: 'Kendine fısıldayamazsın.' };
    if (!target.alive) return { error: `${target.name} hayatta değil.` };

    const text = String(m[2]).slice(0, 300);

    this.pushChat({
      channel: 'fisilti',
      from: player.id,
      to: target.id,
      name: `${player.name} → ${target.name}`,
      text,
      color: player.cosmetic?.color,
    });

    this.pushChat({
      channel: 'koy',
      from: 'sistem',
      name: 'Sistem',
      kind: 'system',
      text: `${player.name}, ${target.name} adlı oyuncuya fısıldıyor...`,
    });

    this.broadcast();
    return { ok: true };
  }

  sendChat(playerId, rawText) {
    const player = this.players.get(playerId);
    if (!player) return { error: 'Oyuncu yok.' };

    const text = String(rawText ?? '').trim().slice(0, 240);
    if (!text) return { error: 'Boş mesaj.' };

    const whisper = this.tryWhisper(player, text);
    if (whisper) return whisper;

    const channel = this.chatChannelFor(player);
    if (!channel) return { error: 'Şu an konuşamazsın.' };

    // Basit spam koruması: saniyede 2 mesaj.
    const recent = this.chat.filter((m) => m.from === player.id && now() - m.ts < 1000);
    if (recent.length >= 2) return { error: 'Biraz yavaş.' };

    this.pushChat({
      channel,
      from: player.id,
      name: player.name,
      text,
      color: player.cosmetic.color,
    });
    this.broadcast();
    return { ok: true };
  }

  /** KICK yayın sohbetinden gelen mesaj (webhook). Oyuna müdahale etmez, sadece görünür. */
  pushKickMessage({ username, text }) {
    this.pushChat({
      channel: 'kick',
      from: 'kick',
      name: String(username ?? 'izleyici').slice(0, 24),
      text: String(text ?? '').slice(0, 240),
      kind: 'kick',
    });
    this.broadcast();
  }

  /** Casus için sabit takma adlar: aynı vampir hep aynı numarayı alır. */
  spyAlias(playerId) {
    if (!this._spyAliases) this._spyAliases = new Map();
    if (!this._spyAliases.has(playerId)) {
      this._spyAliases.set(playerId, `Vampir ${this._spyAliases.size + 1}`);
    }
    return this._spyAliases.get(playerId);
  }

  visibleChat(player) {
    const out = [];

    for (const m of this.chat) {
      if (m.channel === 'sistem' || m.channel === 'kick' || m.channel === 'koy') { out.push(m); continue; }
      if (!player) continue;

      if (m.channel === 'vampir') {
        // Casus köy tarafında ama sohbeti okuyabilir; isimler maskelenir.
        if (player.roleId === 'casus') {
          out.push(m.kind === 'system' ? m : { ...m, name: this.spyAlias(m.from), from: 'gizli', color: null });
        } else if (isVampire(player.roleId)) {
          out.push(m);
        }
        continue;
      }

      if (m.channel === 'hapis') {
        const isJailor = player.roleId === 'jailor';
        const isJailed = player.id === this.jailedId;
        if (!isJailor && !isJailed) continue;
        // Hapisteki gardiyanın adını göremez.
        out.push(isJailed && m.from !== player.id && m.kind !== 'system'
          ? { ...m, name: 'Gardiyan', from: 'gardiyan', color: null }
          : m);
        continue;
      }

      if (m.channel === 'fisilti') {
        // Casus bütün fısıltıları okur.
        if (m.from === player.id || m.to === player.id || player.roleId === 'casus') out.push(m);
        continue;
      }

      if (m.channel === 'ozel') {
        if (m.from === player.id) out.push(m);
        continue;
      }

      if (m.channel === 'kahin') {
        if (player.roleId === 'kahin' && m.from === player.id) out.push(m);
        continue;
      }

      if (m.channel === 'seans') {
        if (!player.alive || player.roleId === 'medium') out.push(m);
        continue;
      }

      if (m.channel === 'olu' && !player.alive) out.push(m);
    }

    return out.slice(-120);
  }

  // ---------- durum ----------

  judgementTally() {
    let yes = 0;
    let no = 0;
    for (const [voterId, verdict] of this.judgement) {
      const voter = this.players.get(voterId);
      if (!voter?.alive) continue;
      if (verdict) yes += this.voteWeight(voter);
      else no += this.voteWeight(voter);
    }
    return { yes, no };
  }

  timeLeft() {
    if (!this.phaseEndsAt) return null;
    return Math.max(0, Math.ceil((this.phaseEndsAt - now()) / 1000));
  }

  publicPlayer(p, viewer) {
    const viewerIsVamp = viewer && isVampire(viewer.roleId);
    const revealRole =
      this.phase === PHASE.END ||
      (!p.alive && this.settings.revealRoleOnDeath) ||
      (viewer && viewer.id === p.id) ||
      // Casus takım arkadaşlarını tanımaz.
      (viewerIsVamp && viewer.roleId !== 'casus' && isVampire(p.roleId));

    return {
      id: p.id,
      name: p.name,
      seat: p.seat,
      alive: p.alive,
      connected: p.connected,
      isHost: p.isHost,
      ready: p.ready,
      isBot: p.isBot,
      cosmetic: p.cosmetic,
      charId: p.charId,
      roleId: revealRole ? p.roleId : null,
      deathInfo: p.deathInfo,
      kickUser: p.kickUser,
      voiceOn: p.voiceOn,
      roleLuck: Number((p.roleLuck ?? 1).toFixed(2)),
      president: p.presidentRevealed && p.roleId === 'baskan',
      voteWeight: this.voteWeight(p),
      revived: p.abilityDisabled && p.alive,
      will: !p.alive ? this.willOf(p) : null,
    };
  }

  /** Gece hedef seçimi için uygun oyuncular. */
  targetsFor(player) {
    if (this.phase !== PHASE.NIGHT || !player?.alive || player.abilityDisabled) return [];
    const cfg = ROLES[player.roleId]?.night;
    if (!cfg?.prompt) return [];
    if (cfg.vest || cfg.jailorExecute || cfg.alert) return [];
    if (cfg.deadTargets) {
      return this.seatedPlayers().filter((p) => !p.alive).map((p) => p.id);
    }

    const left = this.usesLeft(player);
    if (left !== null && left <= 0) return [];

    const pool = cfg.targetsDead
      ? [...this.players.values()].filter((p) => !p.alive)
      : this.alivePlayers();

    return pool
      .filter((p) => {
        if (p.id === player.id) return this.selfTargetAllowed(player);
        if (isVampire(player.roleId) && isVampire(p.roleId)) return false;
        if (player.roleId === 'doktor' && !this.settings.doctorRepeat && player.lastProtected === p.id) return false;
        return true;
      })
      .map((p) => p.id);
  }

  stateFor(player, { spectatorName = null } = {}) {
    const viewer = player ?? null;
    const role = viewer ? ROLES[viewer.roleId] : null;

    const voteTally = {};
    if (this.phase === PHASE.VOTE || this.phase === PHASE.VOTE_RESULT) {
      for (const [voterId, targetId] of this.votes) {
        if (targetId === 'pas') continue;
        (voteTally[targetId] ??= []).push(voterId);
      }
    }

    const check = this.phase === PHASE.LOBBY ? this.roleCheck() : { ok: true };

    return {
      code: this.code,
      hostName: this.hostName,
      phase: this.phase,
      phaseLabel: PHASE_LABEL[this.phase],
      dayNo: this.dayNo,
      nightNo: this.nightNo(),
      voteEnabled: this.voteEnabled(),
      timeLeft: this.timeLeft(),
      settings: this.settings,
      slotInfo: (this.settings.slots ?? []).map((id) => ({ id, ...(slotInfo(id) ?? {}) })),
      roleCheck: check,
      playerCount: this.players.size,
      readyCount: this.seatedPlayers().filter((p) => p.ready).length,
      takenChars: this.seatedPlayers().map((p) => p.charId).filter(Boolean),
      allReady: this.allReady(),
      players: this.seatedPlayers().map((p) => this.publicPlayer(p, viewer)),
      chat: this.visibleChat(viewer),
      chatChannel: this.chatChannelFor(viewer),
      log: this.log.slice(-30),
      votes: voteTally,
      myVote: viewer ? this.votes.get(viewer.id) ?? null : null,
      nightSummary: this.lastNightSummary,
      accusedId: this.accusedId,
      judgement: this.phase === PHASE.JUDGEMENT || this.phase === PHASE.VOTE_RESULT
        ? { yes: this.judgementTally().yes, no: this.judgementTally().no, voted: this.judgement.size }
        : null,
      announce: this.announce ?? null,
      tasks: this.phase === PHASE.END ? this.taskSummary() : null,
      voteResult: this.lastVoteResult,
      result: this.result,
      you: viewer
        ? {
            id: viewer.id,
            name: viewer.name,
            seat: viewer.seat,
            alive: viewer.alive,
            isHost: viewer.isHost,
            ready: viewer.ready,
            cosmetic: viewer.cosmetic,
            charId: viewer.charId,
            roleId: viewer.roleId,
            teammates:
              isVampire(viewer.roleId) && viewer.roleId !== 'casus'
                ? this.seatedPlayers().filter((p) => isVampire(p.roleId) && p.id !== viewer.id).map((p) => p.id)
                : [],
            nightPrompt: role?.night?.prompt ?? null,
            canActNow:
              this.phase === PHASE.NIGHT &&
              viewer.alive &&
              !viewer.abilityDisabled &&
              viewer.id !== this.jailedId &&
              hasNightAction(viewer.roleId),
            // Sadece hedefin kimliği; yelek/idam gibi hedefsiz eylemlerde 'kendi'.
            chosenTarget: (() => {
              const a = this.night.actions.get(viewer.id);
              if (!a) return null;
              return a.targetId ?? 'kendi';
            })(),
            targets: this.targetsFor(viewer),
            privateResult: this.night.results.get(viewer.id) ?? null,
            team: roleTeam(viewer.roleId),
            teamLabel: TEAM_LABEL[roleTeam(viewer.roleId)] ?? null,
            will: viewer.will,
            willLocked: viewer.willLocked,
            usesLeft: this.usesLeft(viewer),
            jailing: viewer.jailing,
            jailedId: viewer.roleId === 'jailor' ? this.jailedId : (viewer.id === this.jailedId ? viewer.id : null),
            isJailed: viewer.id === this.jailedId,
            president: viewer.presidentRevealed,
            canRevealPresident: viewer.roleId === 'baskan' && !viewer.presidentRevealed && viewer.alive,
            abilityDisabled: viewer.abilityDisabled,
            myJudgement: this.judgement.has(viewer.id) ? this.judgement.get(viewer.id) : null,
            task: viewer.task,
            taskDone: viewer.taskDone,
            roleLuck: Number((viewer.roleLuck ?? 1).toFixed(2)),
            canReroll: !!viewer.task && !viewer.taskRerolled && this.canReroll(),
            voice: {
              enabled: this.settings.voiceEnabled,
              on: viewer.voiceOn,
              room: this.voiceRoomFor(viewer),
              canSpeak: this.voiceCanSpeak(viewer),
              peers: this.voicePeers(viewer),
            },
          }
        : null,
      spectator: viewer ? null : { name: spectatorName },
    };
  }

  broadcast() {
    for (const p of this.players.values()) {
      if (!p.connected || !p.socketId) continue;
      this.io.to(p.socketId).emit('state', this.stateFor(p));
    }
    for (const [socketId, s] of this.spectators) {
      this.io.to(socketId).emit('state', this.stateFor(null, { spectatorName: s.name }));
    }
  }
}
