import 'dotenv/config';
import http from 'node:http';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

import express from 'express';
import { Server } from 'socket.io';

import { Room, COLORS, HATS } from './src/game.js';
import { ROLES } from './src/roles.js';
import { CHARACTERS, CHAR_FRAMES } from './src/characters.js';
import { SLOT_TYPES, CATEGORIES, rolesForSlot } from './src/roles.js';
import {
  createPkcePair,
  buildAuthorizeUrl,
  exchangeCode,
  fetchKickUser,
  verifyWebhook,
  parseChatEvent,
} from './src/kick.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env.PORT ?? 3000);
const PUBLIC_URL = process.env.PUBLIC_URL ?? `http://localhost:${PORT}`;
const HOST_USERNAME = process.env.HOST_USERNAME ?? 'EMREZL';
const ROOM_CODE = (process.env.ROOM_CODE ?? 'KOY').toUpperCase();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: false } });

app.set('trust proxy', 1);
app.disable('x-powered-by');

// Tek köy. Yayında tek lobi olması en pratiği.
const room = new Room(ROOM_CODE, io, { hostName: HOST_USERNAME });

// ---------------------------------------------------------------------------
// KICK webhook — ham gövde şart, imza doğrulaması ham baytlar üzerinden yapılır
// ---------------------------------------------------------------------------

app.post('/webhooks/kick', express.raw({ type: '*/*', limit: '256kb' }), async (req, res) => {
  const check = await verifyWebhook(req.headers, req.body);

  if (!check.ok) {
    if (check.duplicate) return res.status(200).json({ ok: true, skipped: 'duplicate' });
    console.warn('[kick] webhook reddedildi:', check.error);
    return res.status(401).json({ error: check.error });
  }

  let body;
  try {
    body = JSON.parse(req.body.toString('utf8'));
  } catch {
    return res.status(400).json({ error: 'Gövde JSON değil.' });
  }

  if (check.eventType === 'chat.message.sent') {
    const msg = parseChatEvent(body);
    if (msg) room.pushKickMessage(msg);
  }

  res.status(200).json({ ok: true });
});

app.use(express.json({ limit: '64kb' }));
// HTML asla önbelleğe alınmaz, yoksa güncelleme sonrası oyuncular eski sürümü görür.
// Diğer dosyalar da her seferinde sunucuya sorulur (ETag ile değişmediyse 304 döner).
app.use(
  express.static(path.join(__dirname, 'public'), {
    etag: true,
    lastModified: true,
    maxAge: 0,
    setHeaders(res, filePath) {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      } else {
        res.setHeader('Cache-Control', 'no-cache');
      }
    },
  })
);

// ---------------------------------------------------------------------------
// KICK OAuth 2.1 (PKCE)
// ---------------------------------------------------------------------------

const oauthStates = new Map(); // state -> {verifier, ts}
const kickTickets = new Map(); // ticket -> {name, ts}
const OAUTH_TTL = 10 * 60 * 1000;

setInterval(() => {
  const cutoff = Date.now() - OAUTH_TTL;
  for (const [key, v] of oauthStates) if (v.ts < cutoff) oauthStates.delete(key);
}, 60_000).unref();

/**
 * WebRTC için ICE sunucuları. STUN bedava ve yeterli olur,
 * ama mobil operatör ağlarının arkasındaki oyuncular için TURN gerekir.
 * TURN_URL/TURN_USERNAME/TURN_PASSWORD tanımlıysa listeye eklenir.
 */
function iceServers() {
  const list = [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  ];
  if (process.env.TURN_URL) {
    list.push({
      urls: process.env.TURN_URL.split(',').map((u) => u.trim()).filter(Boolean),
      username: process.env.TURN_USERNAME,
      credential: process.env.TURN_PASSWORD,
    });
  }
  return list;
}

const kickConfigured = () =>
  Boolean(process.env.KICK_CLIENT_ID && process.env.KICK_CLIENT_SECRET && process.env.KICK_REDIRECT_URI);

app.get('/auth/kick', (req, res) => {
  if (!kickConfigured()) {
    return res.status(503).send('KICK uygulaması ayarlanmamış. .env dosyasına KICK_CLIENT_ID, KICK_CLIENT_SECRET ve KICK_REDIRECT_URI ekle.');
  }

  const { verifier, challenge } = createPkcePair();
  const state = crypto.randomBytes(16).toString('hex');
  oauthStates.set(state, { verifier, ts: Date.now() });

  res.redirect(
    buildAuthorizeUrl({
      clientId: process.env.KICK_CLIENT_ID,
      redirectUri: process.env.KICK_REDIRECT_URI,
      scopes: ['user:read', 'chat:read'],
      state,
      challenge,
    })
  );
});

app.get('/auth/kick/callback', async (req, res) => {
  const { code, state, error } = req.query;
  if (error) return res.status(400).send(`KICK girişi reddedildi: ${error}`);

  const entry = oauthStates.get(state);
  if (!entry) return res.status(400).send('Giriş isteği geçersiz veya süresi doldu. Baştan dene.');
  oauthStates.delete(state);

  try {
    const tokens = await exchangeCode({
      clientId: process.env.KICK_CLIENT_ID,
      clientSecret: process.env.KICK_CLIENT_SECRET,
      redirectUri: process.env.KICK_REDIRECT_URI,
      code,
      verifier: entry.verifier,
    });

    const user = await fetchKickUser(tokens.access_token);
    const name = user?.name ?? user?.username ?? 'kickuser';

    // Access token tarayıcıya gönderilmez; sadece doğrulanmış isim aktarılır.
    const ticket = crypto.randomBytes(16).toString('hex');
    kickTickets.set(ticket, { name, ts: Date.now() });

    res.redirect(`/?kick=${ticket}`);
  } catch (err) {
    console.error('[kick] oauth hatası:', err);
    res.status(500).send('KICK girişi tamamlanamadı.');
  }
});

setInterval(() => {
  const cutoff = Date.now() - OAUTH_TTL;
  for (const [key, v] of kickTickets) if (v.ts < cutoff) kickTickets.delete(key);
}, 60_000).unref();

app.get('/api/config', (req, res) => {
  res.json({
    hostName: HOST_USERNAME,
    kickLogin: kickConfigured(),
    publicUrl: PUBLIC_URL,
    colors: COLORS,
    hats: HATS,
    slotTypes: SLOT_TYPES.map((t) => ({ ...t, roles: rolesForSlot(t.id).map((id) => ROLES[id].name) })),
    categories: CATEGORIES,
    characters: CHARACTERS,
    charFrames: CHAR_FRAMES,
    ice: iceServers(),
    roles: Object.values(ROLES).map((r) => ({
      id: r.id,
      name: r.name,
      team: r.team,
      color: r.color,
      glyph: r.glyph,
      tagline: r.tagline,
      task: r.task,
      hasNightAction: Boolean(r.night?.prompt),
      nightPrompt: r.night?.prompt ?? null,
      uses: r.night?.uses ?? null,
      fillsRemaining: !!r.fillsRemaining,
      min: r.min ?? 0,
      max: r.max ?? 0,
    })),
  });
});

// Giriş ekranı için: hangi karakterler alınmış?
app.get('/api/lobby', (req, res) => {
  res.json({
    phase: room.phase,
    players: room.players.size,
    taken: [...room.players.values()].filter((p) => room.holdsSlot(p)).map((p) => p.charId).filter(Boolean),
  });
});

app.get('/healthz', (req, res) => res.json({ ok: true, players: room.players.size, phase: room.phase }));

// ---------------------------------------------------------------------------
// Socket.IO
// ---------------------------------------------------------------------------

const reply = (cb, payload) => {
  if (typeof cb === 'function') cb(payload);
};

io.on('connection', (socket) => {
  let playerId = null;

  const me = () => (playerId ? room.players.get(playerId) : null);

  /**
   * Payload'suz emit'lerde callback ilk argüman olarak gelir.
   * Son argüman fonksiyonsa onu callback kabul ediyoruz.
   */
  const on = (event, fn) => {
    socket.on(event, (...args) => {
      const cb = typeof args[args.length - 1] === 'function' ? args.pop() : null;
      fn(args[0] ?? {}, cb);
    });
  };

  const guard = (cb, fn) => {
    const player = me();
    if (!player) return reply(cb, { error: 'Önce oyuna katıl.' });
    const out = fn(player);
    reply(cb, out ?? { ok: true });
    room.broadcast();
  };

  on('join', ({ name, token, kickTicket, charId } = {}, cb) => {
    // 1) Yeniden bağlanma
    const existing = room.reattach(token, socket.id);
    if (existing) {
      playerId = existing.id;
      reply(cb, { ok: true, token: existing.token, playerId: existing.id });
      room.system(`${existing.name} tekrar bağlandı.`);
      room.broadcast();
      return;
    }

    // 2) KICK ile doğrulanmış isim
    let finalName = name;
    let kickUser = null;
    if (kickTicket && kickTickets.has(kickTicket)) {
      finalName = kickTickets.get(kickTicket).name;
      kickUser = finalName;
      kickTickets.delete(kickTicket);
    }

    const result = room.addPlayer({ name: finalName, socketId: socket.id, kickUser, charId });

    if (result.error) {
      if (result.spectator) {
        room.spectators.set(socket.id, { name: String(finalName ?? 'izleyici').slice(0, 16) });
        reply(cb, { ok: true, spectator: true, note: result.error });
        room.broadcast();
        return;
      }
      return reply(cb, { error: result.error });
    }

    playerId = result.player.id;
    reply(cb, { ok: true, token: result.player.token, playerId });
    room.broadcast();
  });

  on('cosmetic', (patch, cb) => guard(cb, (p) => room.setCosmetic(p.id, patch ?? {})));
  on('character', ({ charId } = {}, cb) => guard(cb, (p) => room.setCharacter(p.id, charId)));
  on('settings', (patch, cb) => guard(cb, (p) => room.updateSettings(p.id, patch ?? {})));
  on('autoBalance', (_, cb) => guard(cb, (p) => room.autoBalance(p.id)));
  on('start', (_, cb) => guard(cb, (p) => room.start(p.id)));
  on('ready', ({ ready } = {}, cb) => guard(cb, (p) => room.toggleReady(p.id, ready)));
  on('setSlots', ({ slots } = {}, cb) => guard(cb, (p) => room.setSlots(p.id, slots ?? [])));
  on('addBot', ({ count } = {}, cb) => guard(cb, (p) => room.addBot(p.id, count ?? 1)));
  on('removeBot', ({ count } = {}, cb) => guard(cb, (p) => room.removeBot(p.id, count ?? 1)));
  on('skipPhase', (_, cb) => guard(cb, (p) => room.skipPhase(p.id)));
  on('restart', (_, cb) => guard(cb, (p) => room.restart(p.id)));
  on('kickPlayer', ({ targetId } = {}, cb) => guard(cb, (p) => room.kickPlayer(p.id, targetId)));
  on('transferHost', ({ targetId } = {}, cb) => guard(cb, (p) => room.transferHost(p.id, targetId)));
  on('nightAction', (payload = {}, cb) => guard(cb, (p) => room.submitNightAction(p.id, payload)));
  on('jail', ({ targetId } = {}, cb) => guard(cb, (p) => room.setJail(p.id, targetId)));
  on('revealPresident', (_, cb) => guard(cb, (p) => room.revealPresident(p.id)));
  on('will', ({ text } = {}, cb) => guard(cb, (p) => room.setWill(p.id, text)));
  on('judgement', ({ verdict } = {}, cb) => guard(cb, (p) => room.submitJudgement(p.id, verdict)));
  on('vote', ({ targetId } = {}, cb) => guard(cb, (p) => room.submitVote(p.id, targetId)));
  on('chat', ({ text } = {}, cb) => guard(cb, (p) => room.sendChat(p.id, text)));
  on('task:reroll', (_, cb) => guard(cb, (p) => room.rerollTask(p.id)));
  on('task:vote', ({ subjectId, ok } = {}, cb) =>
    guard(cb, (p) => room.submitTaskVote(p.id, subjectId, ok))
  );

  // ── sesli sohbet sinyalleşmesi ──
  // Sunucu ses taşımaz, sadece WebRTC teklif/cevaplarını iletir.
  on('voice:on', ({ on: enabled } = {}, cb) => guard(cb, (p) => room.setVoice(p.id, enabled)));

  on('voice:signal', ({ to, data } = {}, cb) => {
    const sender = me();
    if (!sender) return reply(cb, { error: 'Önce oyuna katıl.' });

    const target = room.players.get(to);
    if (!target?.socketId || !target.connected) return reply(cb, { error: 'Karşı taraf yok.' });

    // Aynı ses odasında değillerse sinyali iletme.
    const room1 = room.voiceRoomFor(sender);
    const room2 = room.voiceRoomFor(target);
    if (!room1 || room1 !== room2) return reply(cb, { error: 'Aynı ses odasında değilsiniz.' });

    io.to(target.socketId).emit('voice:signal', { from: sender.id, data });
    reply(cb, { ok: true });
  });

  socket.on('disconnect', () => {
    room.spectators.delete(socket.id);
    const player = me();
    if (player) {
      player.connected = false;
      player.socketId = null;
      player.voiceOn = false;
      room.removePlayer(player.id);
    }
    room.broadcast();
  });
});

server.listen(PORT, () => {
  console.log(`EZ Vampir Köylü → ${PUBLIC_URL}`);
  console.log(`Oyun sahibi: KICK:${HOST_USERNAME}`);
  console.log(kickConfigured() ? 'KICK OAuth aktif.' : 'KICK OAuth kapalı (demo isim girişi kullanılıyor).');
});
