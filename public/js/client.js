import { characterHTML, roleGlyph, renderScenery, seatPosition, homePosition, gallowsPosition, VILLA_COUNT } from './village.js';
import { VoiceClient } from './voice.js';
import { VillageStage } from './stage3d.js';
import { GameAudio } from './audio.js';

const $ = (id) => document.getElementById(id);
const socket = io({ transports: ['websocket', 'polling'] });

let config = { hostName: 'EMREZL', kickLogin: false, roles: [], colors: [], hats: [] };
let state = null;
let joined = false;
let chatFilter = 'koy';
let chatAutoSwitched = false;
let pending = { color: null, hat: 'fedora', charId: null };
let hostLabel = '';
let sceneryFor = 0;
let walkingUntil = 0;
let wasHome = false;
let fxShownFor = null;
let joinedCharSynced = false;
let lobbyTaken = new Set();
let lobbyPaneShown = false;
let lastLobbyState = null;

// Yatayda tüm paneller aynı anda görünür; sekme değiştirme sadece dikey modda.
const isLandscapeCompact = () =>
  window.innerWidth > window.innerHeight && window.innerHeight <= 600;

const isNarrowLayout = () => window.innerWidth <= 860 && !isLandscapeCompact();

function showPane(pane) {
  document.querySelectorAll('.mtab').forEach((t) => t.classList.toggle('is-active', t.dataset.pane === pane));
  document.querySelectorAll('.col').forEach((c) => c.classList.toggle('is-open', c.dataset.pane === pane));
}
let lobbyPoll = null;

// Yeni köy sahnesi. Ayarlardan kapatılınca eski görünüme dönülür.
let useVillage = localStorage.getItem('vk_stage') !== 'klasik';
let village = null;

window.__pickForTest = (id) => pickTarget(id);

function pickTarget(id) {
  if (state.phase === 'night') ask('nightAction', { targetId: id });
  else if (state.phase === 'vote') ask('vote', { targetId: id });
  else if (state.you?.roleId === 'jailor' && ['day', 'trial', 'judgement'].includes(state.phase)) {
    ask('jail', { targetId: id });
  }
}

function ensureVillage() {
  const box = $('phaserStage');
  const old = $('stage');

  if (!useVillage) {
    if (village) { village.destroy(); village = null; }
    box.hidden = true;
    old.hidden = false;
    return false;
  }

  box.hidden = false;
  old.hidden = true;
  if (!village) {
    village = new VillageStage({
      parent: box,
      labelLayer: $('phaserNames'),
      onPick: pickTarget,
    });
  }
  return true;
}

// Takım renkleri — sadece rolü bilinen oyuncularda kullanılır.
const TEAM_COLOR = { koy: '#3ddc84', vampir: '#e2405b' };
const ROLE_COLOR = { serikatil: '#4ea8ff', joker: '#ffd23d', survivor: '#a26bf0' };

function roleColorOf(roleId) {
  if (!roleId) return null;
  if (ROLE_COLOR[roleId]) return ROLE_COLOR[roleId];
  const meta = roleMeta(roleId);
  return TEAM_COLOR[meta?.team] ?? null;
}

/** Gece olurken son 4 saniyede herkes evine yürür. */
function goingHome() {
  const { phase, timeLeft, voteEnabled } = state;
  if (phase === 'night' || phase === 'night_result') return true;
  const nextIsNight = phase === 'vote_result' || (phase === 'day' && !voteEnabled);
  return nextIsNight && timeLeft != null && timeLeft <= 4;
}

let voiceWarned = false;
let forgeDraft = '';        // sahte vasiyet metni: panel yeniden çizilince kaybolmasın
let forgeTimer = null;
let transportPick = [];   // arabacının seçtiği iki kişi
const voice = new VoiceClient({
  socket,
  onUpdate: () => { renderVoice(); renderStage(); },
  onProblem: (msg) => {
    if (voiceWarned) return;
    voiceWarned = true;
    toast(msg);
  },
});
const music = new GameAudio();
window.__music = music;   // yayında sorun çıkarsa konsoldan bakmak için

$('volSlider').value = String(Math.round(music.volume * 100));
$('volSlider').addEventListener('input', (e) => music.setVolume(Number(e.target.value) / 100));
$('muteBtn').addEventListener('click', () => {
  music.setMuted(!music.muted);
  renderMute();
});
function renderMute() {
  const b = $('muteBtn');
  b.textContent = music.muted ? '🔇' : '♪';
  b.classList.toggle('is-muted', music.muted);
  b.title = music.muted ? 'Müziği aç' : 'Müziği kapat';
  $('volSlider').disabled = music.muted;
}
renderMute();

const VOICE_ROOM_LABEL = { koy: 'Köy sesi', vampir: 'Vampir sesi', olu: 'Ölü sesi' };

// Yayında sorun çıkarsa konsoldan bakabilmek için.
window.__voice = voice;

const HAT_LABEL = {
  fedora: 'Fötr',
  kapusonlu: 'Kapüşon',
  silindir: 'Silindir',
  basortu: 'Başörtü',
  kasket: 'Kasket',
  yok: 'Şapkasız',
};

const roleMeta = (id) => config.roles.find((r) => r.id === id) ?? null;

// ── yardımcılar ───────────────────────────────────────

let toastTimer = null;
function toast(text) {
  const el = $('toast');
  el.textContent = text;
  el.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-on'), 2600);
}

function mmss(seconds) {
  if (seconds == null) return '--:--';
  const m = String(Math.floor(seconds / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  return `${m}:${s}`;
}

const isNight = (phase) => phase === 'night' || phase === 'night_result';

function ask(event, payload = {}) {
  socket.emit(event, payload, (res) => {
    if (res?.error) toast(res.error);
  });
}

// ── giriş ekranı ──────────────────────────────────────

async function boot() {
  try {
    config = await (await fetch('/api/config')).json();
  } catch {
    toast('Sunucuya ulaşılamadı.');
    return;
  }

  voice.setIceServers(config.ice);
  $('joinHost').textContent = `KICK:${config.hostName}`;
  $('hostName').textContent = `KICK:${config.hostName}`;
  hostLabel = config.hostName;
  if (config.kickLogin) $('kickLoginBtn').hidden = false;

  pending.color = config.colors[0];
  pending.charId = config.characters?.[0]?.id ?? null;
  window.__cfg = config;
  renderPickers();


  // Giriş ekranındayken alınan karakterleri takip et.
  const pollLobby = async () => {
    if (joined) return;
    try {
      const info = await (await fetch('/api/lobby')).json();
      lobbyTaken = new Set(info.taken ?? []);
      if (lobbyTaken.has(pending.charId)) {
        const free = config.characters.find((c) => !lobbyTaken.has(c.id));
        pending.charId = free?.id ?? pending.charId;
      }
      renderPickers();
    } catch {}
  };
  pollLobby();
  lobbyPoll = setInterval(pollLobby, 2500);

  const savedName = localStorage.getItem('vk_name');
  if (savedName) $('nameInput').value = savedName;

  const ticket = new URLSearchParams(location.search).get('kick');
  const token = localStorage.getItem('vk_token');

  if (ticket) {
    history.replaceState({}, '', '/');
    doJoin({ kickTicket: ticket });
  } else if (token) {
    // Sunucu izin verirse oyuna geri döneriz; vermezse isim ekranı açık kalır.
    doJoin({ token });
  }
}

function renderPickers() {
  $('colorPicker').innerHTML = config.colors
    .map(
      (c) =>
        `<button type="button" class="swatch${c === pending.color ? ' is-active' : ''}"
           style="background:${c}" data-color="${c}" aria-label="Renk ${c}"></button>`
    )
    .join('');

  const taken = joined ? new Set(state?.takenChars ?? []) : lobbyTaken;
  $('charPicker').innerHTML = (config.characters ?? [])
    .map((c) => {
      const mine = c.id === pending.charId;
      const busy = taken.has(c.id) && !mine;
      return `<button type="button" class="char-pick${mine ? ' is-active' : ''}${busy ? ' is-taken' : ''}"
        data-char="${c.id}" ${busy ? 'disabled' : ''} title="${c.ad}">
        <img src="/assets/chars/${c.id}_port.png" alt="${c.ad}" />
      </button>`;
    })
    .join('');

  const cur = (config.characters ?? []).find((c) => c.id === pending.charId);
  $('charName').textContent = cur ? `${cur.ad} (${cur.cins === 'kiz' ? 'kız' : 'erkek'})` : 'Bir karakter seç';
}

$('charPicker').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-char]');
  if (!btn || btn.disabled) return;
  pending.charId = btn.dataset.char;
  renderPickers();
  if (joined) ask('character', { charId: pending.charId });
});

$('colorPicker').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-color]');
  if (!btn) return;
  pending.color = btn.dataset.color;
  renderPickers();
  if (joined) ask('cosmetic', { color: pending.color });
});

function doJoin({ token = null, kickTicket = null } = {}) {
  const name = $('nameInput').value.trim();
  if (!token && !kickTicket && name.length < 2) {
    $('joinError').textContent = 'En az 2 karakterlik bir isim yaz.';
    return;
  }

  socket.emit('join', { name, token, kickTicket, charId: pending.charId }, (res) => {
    if (res?.error) {
      // Token ile sessiz deneme başarısızsa kullanıcıyı korkutma, isim sor.
      if (token) {
        localStorage.removeItem('vk_token');
        $('joinError').textContent = '';
        return;
      }
      $('joinError').textContent = res.error;
      return;
    }
    if (res.token) localStorage.setItem('vk_token', res.token);
    if (name) localStorage.setItem('vk_name', name);

    joined = true;
    clearInterval(lobbyPoll);
    $('join').hidden = true;
    $('game').hidden = false;

    if (!token) ask('cosmetic', { color: pending.color });
    if (res.note) toast(res.note);
  });
}

$('joinBtn').addEventListener('click', () => doJoin());
$('nameInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') doJoin();
});

// ── socket ────────────────────────────────────────────

socket.on('state', (next) => {
  state = next;
  window.__lastState = next;
  render();
});

socket.on('kicked', ({ reason }) => {
  localStorage.removeItem('vk_token');
  alert(reason ?? 'Oyundan çıkarıldın.');
  location.reload();
});

socket.on('disconnect', () => toast('Bağlantı koptu, yeniden deneniyor...'));
socket.io.on('reconnect', () => {
  const token = localStorage.getItem('vk_token');
  if (token) doJoin({ token });
});

// ── ana render ────────────────────────────────────────

function render() {
  if (!state) return;
  renderTopbar();
  music.syncPhase(state.phase);
  renderStage();
  renderRolePanel();
  renderExecTarget();
  renderTaskPanel();
  renderChat();
  renderPlayerList();
  renderAction();
  if (state.you?.charId && pending.charId !== state.you.charId && !joinedCharSynced) {
    pending.charId = state.you.charId;
    joinedCharSynced = true;
  }
  renderLobby();
  renderBanner();
  renderTask();
  renderWill();
  renderWillList();
  renderWillReveal();
  renderVoice();
  if (!$('taskModal').hidden) renderTaskModal();
  voice.sync(state.you?.voice?.peers ?? []);
}

function renderTopbar() {
  const { phase, dayNo, nightNo, phaseLabel, timeLeft, playerCount, settings } = state;

  let title = 'Lobi';
  if (phase === 'reveal') title = 'Rolünü öğren';
  else if (phase === 'night') title = `Gece ${nightNo}`;
  else if (phase === 'night_result') title = 'Sabah oldu';
  else if (['day', 'vote', 'trial', 'judgement', 'vote_result'].includes(phase)) title = `Gün ${dayNo}`;
  else if (phase === 'end') title = 'Oyun bitti';

  $('phaseTitle').textContent = title;
  $('phaseLabel').textContent = phaseLabel;
  $('timer').textContent = mmss(timeLeft);
  $('playerCount').textContent = `${playerCount}/${settings.maxPlayers}`;
  $('restartBtn').hidden = !state.you?.isHost || state.phase === 'lobby';
  const mod = state.players.find((p) => p.isHost);
  $('hostName').textContent = mod ? mod.name : `KICK:${hostLabel}`;
  $('clockIcon').classList.toggle('is-night', isNight(phase));
}

function renderStage() {
  if (ensureVillage()) {
    const targets = new Set(state.you?.targets ?? []);
    village.sync(state, {
      speaking: voice.speaking,
      roleColorOf,
      selectable: (p) => {
        const you = state.you;
        if (!p.alive || !you?.alive) return false;
        if (state.phase === 'night') return you.canActNow && targets.has(p.id);
        if (state.phase === 'vote') return p.id !== you.id;
        if (you.roleId === 'jailor' && ['day', 'trial', 'judgement'].includes(state.phase)) {
          return p.id !== you.id;
        }
        return false;
      },
      chosen: (p) => state.you?.chosenTarget === p.id || state.myVote === p.id || state.you?.jailing === p.id,
    });
    return;
  }

  const { players, phase, you, votes } = state;
  $('phaseVeil').classList.toggle('is-night', isNight(phase));

  // Köyde her zaman 16 villa var; sahne bir kere çizilir.
  if (!sceneryFor) {
    renderScenery($('scenery'));
    sceneryFor = 1;
  }

  const home = goingHome();
  if (home !== wasHome) {
    wasHome = home;
    walkingUntil = Date.now() + 1400;
  }
  const running = Date.now() < walkingUntil;
  if (running) setTimeout(() => renderStage(), 250);

  // Asılan oyuncu idam tahtasında kalır ve animasyonu oynatılır.
  const executedId =
    phase === 'vote_result' && state.voteResult?.kind === 'lynch' ? state.voteResult.playerId : null;

  const canTarget = phase === 'night' && you?.canActNow;
  const canVote = phase === 'vote' && you?.alive;
  const targets = new Set(you?.targets ?? []);

  $('actors').innerHTML = players
    .filter((p) => p.id !== executedId)
    .map((p, i) => {
      const onTrial = state.accusedId === p.id && ['trial', 'judgement'].includes(phase);

      const slot = (p.seat ?? i + 1) - 1;
      const pos = onTrial
        ? gallowsPosition()
        : home
          ? homePosition(slot, VILLA_COUNT)
          : seatPosition(slot, VILLA_COUNT);
      const selectable = p.alive && ((canTarget && targets.has(p.id)) || (canVote && p.id !== you.id));
      const chosen = you?.chosenTarget === p.id || state.myVote === p.id;
      const voteCount = (votes[p.id] ?? []).reduce((sum, id) => {
        const voter = state.players.find((x) => x.id === id);
        return sum + (voter?.voteWeight ?? 1);
      }, 0);
      const accused = state.accusedId === p.id;
      const speaking = voice.speaking.has(p.id);
      const ringColor = roleColorOf(p.roleId);

      const classes = [
        'actor',
        speaking ? 'is-speaking' : '',
        selectable ? 'is-selectable' : '',
        chosen ? 'is-chosen' : '',
        p.alive ? '' : 'is-dead',
        accused ? 'is-accused' : '',
        p.president ? 'is-president' : '',
        you && p.id === you.id ? 'is-me' : '',
      ].filter(Boolean).join(' ');

      return `<button type="button" class="${classes}" data-id="${p.id}"
        style="left:${pos.left}%;top:${pos.top}%;width:clamp(48px, ${(pos.scale * 12).toFixed(2)}cqw, 165px);z-index:${pos.z}"
        ${selectable ? '' : 'disabled'}>
        <span class="actor-tag"${ringColor ? ` style="border-color:${ringColor};color:${ringColor}"` : ''}>${
          p.alive ? '' : '† '
        }${p.president ? '👑 ' : ''}${escapeHtml(p.name)}</span>
        ${characterHTML({
          seat: p.seat,
          cosmetic: p.cosmetic,
          dead: !p.alive,
          ringColor,
          running: running && p.alive,
        })}
        ${p.voiceOn ? '<span class="actor-mic">🎤</span>' : ''}
        ${voteCount ? `<span class="actor-votes">${voteCount}</span>` : ''}
      </button>`;
    })
    .join('');

  renderExecutionFx(executedId);
}

/**
 * İdam animasyonu ayrı katmanda durur.
 * Sahne her saniye yeniden çizildiği için burada tutulmazsa animasyon başa sarardı.
 */
function renderExecutionFx(executedId) {
  const layer = $('fxLayer');

  if (!executedId) {
    if (fxShownFor !== null) {
      layer.innerHTML = '';
      fxShownFor = null;
    }
    return;
  }
  if (fxShownFor === executedId) return;

  fxShownFor = executedId;
  const victim = state.players.find((p) => p.id === executedId);
  const pos = gallowsPosition();

  layer.innerHTML = `
    <div class="fx-actor" style="left:${pos.left}%;top:${pos.top}%">
      ${victim ? characterHTML({ seat: victim.seat, cosmetic: victim.cosmetic, dead: false }) : ''}
    </div>
    <div class="fx-hang">
      <span class="fx-puff"></span>
      <span class="fx-ghost"></span>
    </div>`;
}

$('actors').addEventListener('click', (e) => {
  const btn = e.target.closest('.actor');
  if (!btn || btn.disabled) return;
  const id = btn.dataset.id;
  if (state.phase === 'night') ask('nightAction', { targetId: id });
  else if (state.phase === 'vote') ask('vote', { targetId: id });
  else if (['day', 'trial', 'judgement'].includes(state.phase) && state.you?.jailing !== undefined
           && roleMeta(state.you?.roleId)?.id === 'jailor') {
    ask('jail', { targetId: id });
  }
});

function renderExecTarget() {
  const box = $('execTarget');
  if (!box) return;
  const ad = state?.you?.execTarget;
  box.hidden = !ad;
  if (ad) box.innerHTML = `<span>Hedefin</span><strong>${escapeHtml(ad)}</strong>`;
}

function renderRolePanel() {
  const { you, settings } = state;
  const box = $('myRole');

  if (you?.roleId) {
    const meta = roleMeta(you.roleId);
    const mates = (you.teammates ?? [])
      .map((id) => state.players.find((p) => p.id === id)?.name)
      .filter(Boolean);

    box.style.setProperty('--role-color', meta.color);
    box.innerHTML = `
      <h3>${meta.name}</h3>
      <p>${escapeHtml(meta.task)}</p>
      ${mates.length ? `<div class="mates">Diğer vampirler: ${mates.map(escapeHtml).join(', ')}</div>` : ''}
      ${you.alive ? '' : '<div class="mates">Öldün. Artık sadece ölülerle konuşabilirsin.</div>'}
      ${you.roleLuck > 1 ? `<div class="luck">🍀 Rol şansın x${you.roleLuck}</div>` : ''}`;
    box.hidden = false;
  } else {
    box.hidden = true;
  }

  const TEAM_ORDER = [
    ['koy', 'Köy tarafı', '#3ddc84'],
    ['vampir', 'Vampir tarafı', '#e2405b'],
    ['solo', 'Tek başına', '#ffd23d'],
  ];

  $('roleList').innerHTML = TEAM_ORDER.map(([team, label, color]) => {
    const roles = config.roles.filter((r) => r.team === team);
    if (!roles.length) return '';

    const items = roles
      .map((r) => {
        const count = r.fillsRemaining ? null : settings.roles[r.id] ?? 0;
        const off = count === 0;
        const tint = ROLE_COLOR[r.id] ?? color;
        return `<li class="${off ? 'is-off' : ''}" style="--rc:${tint}">
          ${roleGlyph(r.glyph, tint)}
          <div><span class="rl-name">${r.name}</span><span class="rl-desc">${escapeHtml(r.tagline)}</span></div>
          ${count === null ? '' : `<span class="rl-count${off ? ' is-off' : ''}">${count}</span>`}
        </li>`;
      })
      .join('');

    return `<li class="rl-team" style="--rc:${color}"><span></span><b>${label}</b><span></span></li>${items}`;
  }).join('');
}

function renderTaskPanel() {
  const { you, phase } = state;
  const meta = you?.roleId ? roleMeta(you.roleId) : null;

  const lines = [];
  if (meta) lines.push(`<p><strong>${meta.name}:</strong> ${escapeHtml(meta.task)}</p>`);
  if (phase === 'night') {
    lines.push(
      you?.canActNow
        ? '<p>Gece yeteneğini kullan. Meydandan birine tıkla.</p>'
        : '<p>Gece uyuyorsun. Sabahı bekle.</p>'
    );
  } else if (phase === 'day') {
    lines.push(
      state.voteEnabled
        ? '<p>Tartış, bilgi topla. Süre bitince oylama açılacak.</p>'
        : '<p>Tanışma günü. Bugün oylama yok.</p>'
    );
  } else if (phase === 'vote') {
    lines.push('<p>Asılmasını istediğin kişiyi seç. Kararsızsan pas geç.</p>');
  }

  $('taskBody').innerHTML = lines.join('') || '<p>Oyunun başlamasını bekle.</p>';
  $('eventLog').innerHTML = state.log
    .slice(-12)
    .reverse()
    .map((l) => `<li>${escapeHtml(l.text)}</li>`)
    .join('');
}

/** Vampir sekmesi: tarafı vampir olanlarda ve casusta hep açık. */
function canSeeVampChat() {
  const you = state?.you;
  if (!you) return false;
  if (you.team === 'vampir' || you.roleId === 'casus') return true;
  return (state.chat ?? []).some((m) => m.channel === 'vampir');
}

/** Köy ve Vampir olmak üzere iki kanal. Ölü ve kâhin satırları Köy'de görünür. */
function chatGroupOf(msg) {
  return msg.channel === 'vampir' ? 'vampir' : 'koy';
}

function renderChat() {
  const { chat, chatChannel } = state;
  const vampAvailable = canSeeVampChat();

  if (chatFilter === 'vampir' && !vampAvailable) chatFilter = 'koy';
  if (chatFilter !== 'vampir') chatFilter = 'koy';

  const tabs = [['koy', 'Köy']];
  if (vampAvailable) tabs.push(['vampir', 'Vampir']);

  $('chatFilters').innerHTML = tabs
    .map(
      ([id, label]) =>
        `<button type="button" class="${id === chatFilter ? 'is-active' : ''}" data-filter="${id}">${label}</button>`
    )
    .join('');

  const shown = chat.filter((m) => chatGroupOf(m) === chatFilter);
  const box = $('chatBox');
  const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 60;

  box.innerHTML = shown
    .map((m) => {
      if (m.kind === 'system') return `<div class="msg system">${escapeHtml(m.text)}</div>`;
      if (m.channel === 'seans') {
        return `<div class="msg seans"><span class="who">${escapeHtml(m.name)}:</span> ${escapeHtml(
          m.text
        )}</div>`;
      }
      if (m.channel === 'fisilti') {
        return `<div class="msg fisilti"><span class="who">${escapeHtml(m.name)}:</span> ${escapeHtml(
          m.text
        )}</div>`;
      }
      const color = m.color ? ` style="color:${m.color}"` : '';
      return `<div class="msg ${m.channel}"><span class="who"${color}>${escapeHtml(m.name)}:</span> ${escapeHtml(
        m.text
      )}</div>`;
    })
    .join('');

  if (atBottom) box.scrollTop = box.scrollHeight;

  const label =
    { koy: 'Köy', vampir: 'Vampir', olu: 'Ölüler', hapis: 'Hapis', seans: 'Seans' }[chatChannel] ?? 'Kapalı';
  $('chatTitle').textContent = `Sohbet (${label})`;
  $('chatInput').disabled = !chatChannel;
  $('chatInput').placeholder = !chatChannel
    ? 'Şu an konuşamazsın'
    : chatChannel === 'koy'
      ? 'Mesaj yaz...  (/w3 selam = 3 numaraya fısılda)'
      : 'Mesaj yaz...';

  // Gece vampirsen otomatik vampir sekmesine geç.
  if (vampAvailable && chatChannel === 'vampir' && !chatAutoSwitched) {
    chatAutoSwitched = true;
    chatFilter = 'vampir';
    renderChat();
  }
  if (chatChannel !== 'vampir') chatAutoSwitched = false;
}

$('chatFilters').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-filter]');
  if (!btn) return;
  chatFilter = btn.dataset.filter;
  renderChat();
});

$('chatForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = $('chatInput');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  ask('chat', { text });
});

function renderPlayerList() {
  const { players, you } = state;
  const rows = players.map((p) => {
    const role = p.roleId ? roleMeta(p.roleId) : null;
    return `<li class="${p.alive ? '' : 'is-dead'} ${you && p.id === you.id ? 'is-me' : ''}">
      <span class="pl-seat">${p.seat}</span>
      <span class="pl-dot" style="background:${p.cosmetic.color}"></span>
      <span>${escapeHtml(p.name)}${role ? ` <em style="color:${role.color};font-style:normal">· ${role.name}</em>` : ''}</span>
      <span class="pl-meta">
        ${p.isBot ? '<span class="pl-badge bot">bot</span>' : ''}
        ${state.phase === 'lobby' && p.ready && !p.isBot ? '<span class="pl-badge ok">hazır</span>' : ''}
        ${p.roleLuck > 1 ? `<span class="pl-badge luck">x${p.roleLuck}</span>` : ''}
        ${p.isHost ? '<span class="pl-badge host">mod</span>' : ''}
        ${
          you?.isHost && !p.isHost
            ? `${
                state.phase === 'lobby'
                  ? `<button type="button" class="pl-mod" data-give-mod="${p.id}" title="Moderatörlüğü ver">⇄</button>`
                  : ''
              }<button type="button" class="pl-mod pl-kick" data-kick="${p.id}" title="Odadan çıkar">✕</button>`
            : ''
        }
        ${p.connected ? '' : '<span class="pl-badge off">kopuk</span>'}
      </span>
    </li>`;
  });

  const empty = Math.max(0, state.settings.maxPlayers - players.length);
  for (let i = 0; i < empty; i++) {
    rows.push(`<li style="opacity:.3"><span class="pl-seat">${players.length + i + 1}</span><span></span><span>—</span><span></span></li>`);
  }

  $('playerList').innerHTML = rows.join('');
}

$('playerList').addEventListener('click', (e) => {
  const kick = e.target.closest('[data-kick]');
  if (kick) {
    const p = state.players.find((x) => x.id === kick.dataset.kick);
    if (p && confirm(`${p.name} odadan çıkarılsın mı?`)) ask('kickPlayer', { targetId: p.id });
    return;
  }

  const btn = e.target.closest('[data-give-mod]');
  if (!btn) return;
  const p = state.players.find((x) => x.id === btn.dataset.giveMod);
  if (p && confirm(`Moderatörlük ${p.name} oyuncusuna geçsin mi?`)) {
    ask('transferHost', { targetId: p.id });
  }
});

function targetGrid(ids, chosenId, disabled = false, mode = null) {
  return `<div class="action-grid">${ids
    .map((id) => {
      const p = state.players.find((x) => x.id === id);
      if (!p) return '';
      const attr = mode === 'jail' ? `data-jail="${id}"` : `data-target="${id}"`;
      return `<button type="button" ${attr} class="${chosenId === id ? 'is-chosen' : ''}" ${
        disabled ? 'disabled' : ''
      }>${p.seat}. ${escapeHtml(p.name)}</button>`;
    })
    .join('')}</div>`;
}

function renderAction() {
  const { phase, you } = state;
  const panel = $('actionPanel');
  const parts = [];

  if (you?.privateResult) {
    parts.push(`<div class="action-result">${escapeHtml(you.privateResult.text)}</div>`);
  }

  // ── gündüz: gardiyan hapis seçimi ──
  if (you?.roleId === 'jailor' && you.alive && ['day', 'vote', 'trial', 'judgement'].includes(phase)) {
    const jailed = state.players.find((p) => p.id === you.jailing);
    parts.push('<div class="action-title">Bu gece kimi hapsedeceksin?</div>');
    parts.push(
      `<div class="action-hint">${jailed ? `Seçildi: <b>${escapeHtml(jailed.name)}</b>` : 'Meydandan birine tıkla.'}</div>`
    );
    const ids = state.players.filter((p) => p.alive && p.id !== you.id).map((p) => p.id);
    parts.push(targetGrid(ids, you.jailing, false, 'jail'));
  }

  // ── gündüz: başkan ilanı ──
  if (you?.canRevealPresident && ['day', 'vote'].includes(phase)) {
    parts.push('<button type="button" class="btn btn-primary" data-president>Başkanlığımı ilan et</button>');
    parts.push('<div class="action-hint">Oyun 3 sayılır ama herkes seni tanır.</div>');
  }

  // ── gece ──
  if (phase === 'night' && you?.alive) {
    const meta = roleMeta(you.roleId);
    const cfg = meta?.hasNightAction;

    if (you.isJailed) {
      parts.push('<div class="action-hint">Hapistesin. Bu gece rolünü kullanamazsın, sadece Gardiyan ile yazışabilirsin.</div>');
    } else if (you.abilityDisabled) {
      parts.push('<div class="action-hint">Mezardan döndün. Gece yeteneğin artık yok.</div>');
    } else if (you.roleId === 'jailor') {
      if (you.jailedId) {
        const jailed = state.players.find((p) => p.id === you.jailedId);
        parts.push(`<div class="action-title">${escapeHtml(jailed?.name ?? '')} hapiste</div>`);
        if (you.usesLeft > 0) {
          const chosen = you.chosenTarget != null;
          parts.push(
            `<button type="button" class="btn ${chosen ? 'btn-danger' : 'btn-ghost'}" data-execute>` +
              `${chosen ? 'İdam kararı verildi — vazgeç' : 'İdam et'} (${you.usesLeft} hak)</button>`
          );
          parts.push('<div class="action-hint">İdam doktoru da deler. Tekrar basarsan vazgeçersin.</div>');
        } else {
          parts.push('<div class="action-hint">İdam hakkın kalmadı.</div>');
        }
      } else {
        parts.push('<div class="action-hint">Bu gece hapiste kimse yok.</div>');
      }
    } else if (you.roleId === 'survivor') {
      const on = you.chosenTarget != null;
      parts.push('<div class="action-title">Yelek giyeyim mi?</div>');
      parts.push(
        `<button type="button" class="btn ${on ? 'btn-danger' : 'btn-ghost'}" data-vest ` +
          `${you.usesLeft <= 0 && !on ? 'disabled' : ''}>` +
          `${on ? 'Yelek giyildi — çıkar' : 'Yelek giy'} (${you.usesLeft} kaldı)</button>`
      );
    } else if (you.roleId === 'veteran') {
      const on = you.chosenTarget != null;
      parts.push('<div class="action-title">Tetikte bekleyeyim mi?</div>');
      parts.push(
        `<button type="button" class="btn ${on ? 'btn-danger' : 'btn-ghost'}" data-alert ` +
          `${you.usesLeft <= 0 && !on ? 'disabled' : ''}>` +
          `${on ? 'Tetiktesin — vazgeç' : 'Tetikte bekle'} (${you.usesLeft} hak)</button>`
      );
      parts.push('<div class="action-hint">Tetikteyken evine gelen herkes ölür, masum olsa bile.</div>');
    } else if (you.roleId === 'arabaci') {
      parts.push('<div class="action-title">Evlerini değiştireceğin iki kişi</div>');
      parts.push(
        `<div class="action-hint">${
          transportPick.length === 0
            ? 'Birinciyi seç.'
            : transportPick.length === 1
              ? 'Şimdi ikinciyi seç.'
              : 'İkisi de seçildi. Değiştirmek için birine tekrar bas.'
        }</div>`
      );
      parts.push(
        `<div class="action-grid">${you.targets
          .map((id) => {
            const p = state.players.find((x) => x.id === id);
            if (!p) return '';
            const secili = transportPick.includes(id);
            return `<button type="button" data-target="${id}" class="${secili ? 'is-chosen' : ''}">${
              p.seat
            }. ${escapeHtml(p.name)}</button>`;
          })
          .join('')}</div>`
      );
    } else if (cfg && you.targets?.length) {
      parts.push(`<div class="action-title">${escapeHtml(you.nightPrompt ?? 'Hedefini seç')}</div>`);
      if (you.usesLeft !== null) parts.push(`<div class="action-hint">Kalan hak: ${you.usesLeft}</div>`);

      if (you.roleId === 'dolandirici') {
        parts.push(
          `<textarea id="forgeText" class="will-box" maxlength="500"
             placeholder="Onun vasiyeti olarak ne yazsın?"></textarea>`
        );
      }
      parts.push(targetGrid(you.targets, you.chosenTarget));
    } else if (cfg) {
      parts.push('<div class="action-hint">Bu gece kullanabileceğin hak kalmadı.</div>');
    } else {
      const why =
        you.roleId === 'vampir'
          ? 'Hedefi Edward seçiyor. Vampir sohbetinden fikrini söyleyebilirsin.'
          : `${meta?.name ?? 'Rolün'} gece yeteneği olmayan bir rol. Gündüzü bekle.`;
      parts.push(`<div class="action-title">Gece sırası sende değil</div>
        <div class="action-hint">${escapeHtml(why)}</div>`);
    }
  }

  // ── oylama ──
  if (phase === 'vote' && you?.alive) {
    parts.push('<div class="action-title">Kim savunma yapsın?</div>');
    if (you.president) parts.push('<div class="action-hint">Başkan olarak oyun 3 sayılıyor.</div>');
    const ids = state.players.filter((p) => p.alive && p.id !== you.id).map((p) => p.id);
    parts.push(targetGrid(ids, state.myVote));
    parts.push(
      `<button type="button" class="btn btn-ghost" data-target="pas" ${state.myVote === 'pas' ? 'disabled' : ''}>Pas geç</button>`
    );
  }

  // ── savunma ──
  if (phase === 'trial') {
    const accused = state.players.find((p) => p.id === state.accusedId);
    parts.push(`<div class="action-title">${escapeHtml(accused?.name ?? '')} savunma yapıyor</div>`);
    parts.push(
      `<div class="action-hint">${
        you?.id === state.accusedId ? 'Sıra sende. Kendini anlat.' : 'Dinle. Şimdilik sadece sanık konuşabilir.'
      }</div>`
    );
  }

  // ── karar ──
  if (phase === 'judgement') {
    const accused = state.players.find((p) => p.id === state.accusedId);
    parts.push(`<div class="action-title">${escapeHtml(accused?.name ?? '')} asılsın mı?</div>`);
    if (you?.alive && you.id !== state.accusedId) {
      parts.push(`<div class="action-grid">
        <button type="button" data-verdict="1" class="${state.you.myJudgement === true ? 'is-chosen' : ''}">Evet, asılsın</button>
        <button type="button" data-verdict="0" class="${state.you.myJudgement === false ? 'is-chosen' : ''}">Hayır, bıraksın</button>
      </div>`);
    }
    if (state.judgement) {
      parts.push(`<div class="action-hint">${state.judgement.yes} evet · ${state.judgement.no} hayır</div>`);
    }
  }

  // ── oyun sonu ──
  if (phase === 'end') {
    const { result } = state;
    const label = {
      koy: 'Köy kazandı', vampir: 'Vampirler kazandı',
      joker: 'Joker kazandı', serikatil: 'Seri katil kazandı',
      iftiraci: 'İftiracı kazandı',
    }[result?.winner];
    parts.push(`<div class="action-title">${label ?? 'Oyun bitti'}</div>`);
    if (result?.survivors?.length) {
      parts.push(`<div class="action-hint">Hayatta kalan Survivor da kazandı: ${result.survivors.map(escapeHtml).join(', ')}</div>`);
    }
    parts.push(
      `<div class="action-hint">${(result?.roles ?? [])
        .map((r) => `${escapeHtml(r.name)} — ${roleMeta(r.roleId)?.name ?? '?'}`)
        .join('<br>')}</div>`
    );
    if (state.tasks?.length) parts.push('<button type="button" class="btn btn-ghost" data-tasks>Gizli görevler</button>');
    if (you?.isHost) parts.push('<button type="button" class="btn btn-primary" data-restart>Yeni oyun</button>');
  }

  if (you?.execTarget && phase !== 'lobby' && phase !== 'end') {
    parts.unshift(
      `<div class="action-hint">Hedefin: <b>${escapeHtml(you.execTarget)}</b> — astır ve kazan.</div>`
    );
  }

  if (you?.isHost && phase !== 'lobby' && phase !== 'end') {
    parts.push('<button type="button" class="btn btn-ghost" data-skip>Fazı geç</button>');
  }

  panel.innerHTML = parts.join('');

  // Panel her saniye yeniden çiziliyor; yazılan sahte vasiyeti geri koy.
  const forge = $('forgeText');
  if (forge) {
    const aktifti = document.activeElement?.id === 'forgeText';
    const konum = aktifti ? document.activeElement.selectionStart : null;
    forge.value = forgeDraft;
    if (aktifti) {
      forge.focus();
      if (konum != null) forge.setSelectionRange(konum, konum);
    }
  } else if (phase !== 'night') {
    forgeDraft = '';
  }
  if (phase !== 'night') transportPick = [];
}

$('actionPanel').addEventListener('input', (e) => {
  if (e.target.id !== 'forgeText') return;
  forgeDraft = e.target.value;

  // Hedef zaten seçiliyse metni sunucuya tazele (seçimi bozmadan).
  clearTimeout(forgeTimer);
  forgeTimer = setTimeout(() => {
    const hedef = state?.you?.chosenTarget;
    if (hedef && hedef !== 'kendi') ask('nightAction', { targetId: hedef, text: forgeDraft, keep: true });
  }, 500);
});

$('actionPanel').addEventListener('click', (e) => {
  const jail = e.target.closest('[data-jail]');
  if (jail) return ask('jail', { targetId: jail.dataset.jail });

  const verdict = e.target.closest('[data-verdict]');
  if (verdict) return ask('judgement', { verdict: verdict.dataset.verdict === '1' });

  const target = e.target.closest('[data-target]');
  if (target) {
    const id = target.dataset.target;
    if (state.phase === 'night') {
      // Arabacı iki kişi seçer.
      if (state.you?.roleId === 'arabaci') {
        if (transportPick.includes(id)) transportPick = transportPick.filter((x) => x !== id);
        else transportPick = [...transportPick, id].slice(-2);

        if (transportPick.length === 2) {
          ask('nightAction', { targetId: transportPick[0], targetId2: transportPick[1] });
        }
        renderAction();
        return;
      }

      const payload = { targetId: id };
      if ($('forgeText')) payload.text = forgeDraft;
      ask('nightAction', payload);
    } else if (state.phase === 'vote') ask('vote', { targetId: id });
    return;
  }

  if (e.target.closest('[data-vest]')) return ask('nightAction', { use: true });
  if (e.target.closest('[data-alert]')) return ask('nightAction', { alert: true });
  if (e.target.closest('[data-execute]')) return ask('nightAction', { execute: true });
  if (e.target.closest('[data-president]')) return ask('revealPresident');
  if (e.target.closest('[data-tasks]')) openTaskModal();
  if (e.target.closest('[data-skip]')) ask('skipPhase');
  if (e.target.closest('[data-restart]')) ask('restart');
});


/** Slot listesi: her satır bir oyuncuya karşılık gelir. */
function renderSlotSetup() {
  const box = $('slotSetup');
  if (!box || !state) return;

  const isHost = !!state.you?.isHost;
  const slots = state.slotInfo ?? [];
  const types = config.slotTypes ?? [];
  const takim = (t) => (['koy', 'vampir', 'solo'].includes(t) ? t : 'koy');

  const liste = slots
    .map(
      (s, i) => `<li class="slot-row t-${takim(s.team)}">
        <span class="slot-no">${i + 1}</span>
        <span class="slot-label">${escapeHtml(s.label ?? s.id)}</span>
        ${isHost ? `<button type="button" class="slot-x" data-slot-del="${i}" title="Kaldır">✕</button>` : ''}
      </li>`
    )
    .join('');

  const ekle = isHost
    ? `<div class="slot-add">${types
        .map(
          (t) =>
            `<button type="button" class="slot-chip t-${takim(t.team)}" data-slot-add="${t.id}"
               title="${escapeHtml((t.roles ?? []).join(', '))}">+ ${escapeHtml(t.label)}</button>`
        )
        .join('')}</div>`
    : '';

  const fark = state.playerCount - slots.length;
  const durum =
    fark === 0
      ? `<p class="slot-ok">${slots.length} slot / ${state.playerCount} oyuncu — hazır.</p>`
      : `<p class="slot-warn">${slots.length} slot / ${state.playerCount} oyuncu — ${
          fark > 0 ? `${fark} slot eksik` : `${-fark} slot fazla`
        }.</p>`;

  box.innerHTML = `${durum}<ol class="slot-list">${liste}</ol>${ekle}`;
}

$('slotSetup').addEventListener('click', (e) => {
  const sil = e.target.closest('[data-slot-del]');
  if (sil) {
    const yeni = (state.slotInfo ?? []).map((s) => s.id);
    yeni.splice(Number(sil.dataset.slotDel), 1);
    return ask('setSlots', { slots: yeni });
  }
  const ekle = e.target.closest('[data-slot-add]');
  if (ekle) {
    return ask('setSlots', { slots: [...(state.slotInfo ?? []).map((s) => s.id), ekle.dataset.slotAdd] });
  }
});

document.querySelector('.setup-tabs')?.addEventListener('click', (e) => {
  const b = e.target.closest('[data-setup]');
  if (!b) return;
  document.querySelectorAll('.stab').forEach((t) => t.classList.toggle('is-active', t === b));
  $('slotSetup').hidden = b.dataset.setup !== 'slot';
  $('roleSetup').hidden = b.dataset.setup !== 'klasik';
});

function renderLobby() {
  const inLobby = state.phase === 'lobby';
  $('lobbyPanel').hidden = !inLobby;
  document.body.classList.toggle('in-lobby', inLobby);

  // Dar/alçak ekranda yan paneller gizli olduğu için lobide kurulum
  // paneline erişilemiyordu. Lobiye girince bir kere otomatik aç.
  // Dar ekranda oyun başlayınca köy sekmesine geç; yoksa sahne gizli kalıyor.
  if (!inLobby && lastLobbyState === true && isNarrowLayout()) showPane('koy');
  lastLobbyState = inLobby;

  if (inLobby) {
    willSeen.clear();
    willQueue = [];
    clearTimeout(willOpenTimer);
    willOpenTimer = null;
    $('willReveal').hidden = true;
  }
  if (inLobby && !lobbyPaneShown && isNarrowLayout()) {
    lobbyPaneShown = true;
    showPane('oyuncular');
  }
  if (!inLobby) lobbyPaneShown = false;
  if (!inLobby) return;

  const isHost = !!state.you?.isHost;
  const counts = state.settings.roles;

  renderSlotSetup();

  $('roleSetup').innerHTML = config.roles
    .filter((r) => !r.fillsRemaining)
    .map((r) => {
      const n = counts[r.id] ?? 0;
      return `<div class="rs-row" style="--rc:${r.color}">
        <span class="rs-name">${r.name}<small>${escapeHtml(r.tagline)}</small></span>
        <span class="stepper">
          <button type="button" data-role="${r.id}" data-step="-1" ${!isHost || n <= r.min ? 'disabled' : ''}>−</button>
          <output>${n}</output>
          <button type="button" data-role="${r.id}" data-step="1" ${!isHost || n >= r.max ? 'disabled' : ''}>+</button>
        </span>
      </div>`;
    })
    .join('');

  const note = $('setupNote');
  const check = state.roleCheck;
  const enough = state.playerCount >= state.settings.minPlayers;

  if (!check.ok) {
    note.textContent = check.error;
    note.classList.add('is-bad');
  } else if (!enough) {
    note.textContent = `${state.playerCount} oyuncu · en az ${state.settings.minPlayers} kişi gerekli.`;
    note.classList.add('is-bad');
  } else if (state.timeLeft != null) {
    note.textContent = `Herkes hazır. Başlıyor: ${state.timeLeft}`;
    note.classList.remove('is-bad');
  } else {
    note.textContent = `${state.readyCount}/${state.playerCount} hazır · ${check.villagers} köylü olacak.`;
    note.classList.remove('is-bad');
  }

  const ready = !!state.you?.ready;
  $('readyBtn').textContent = ready ? 'Hazır değilim' : 'Hazırım';
  $('readyBtn').className = `btn ${ready ? 'btn-ghost' : 'btn-primary'}`;

  const bots = state.players.filter((p) => p.isBot).length;
  const full = state.playerCount >= state.settings.maxPlayers;
  $('botCount').textContent = `${bots} bot`;
  document.querySelector('.bot-row').hidden = !isHost;
  document.querySelectorAll('[data-bot]').forEach((b) => {
    const v = b.dataset.bot;
    b.disabled = v.startsWith('-') ? bots === 0 : full;
  });

  $('startBtn').hidden = !isHost;
  $('startBtn').disabled = !check.ok || !enough;
  $('autoBalanceBtn').disabled = !isHost;
}

$('roleSetup').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-role]');
  if (!btn) return;
  const id = btn.dataset.role;
  const step = Number(btn.dataset.step);
  const next = (state.settings.roles[id] ?? 0) + step;
  ask('settings', { roles: { [id]: next } });
});

$('readyBtn').addEventListener('click', () => ask('ready'));
document.querySelector('.bot-row').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-bot]');
  if (!btn) return;
  const v = btn.dataset.bot;
  if (v === 'fill') ask('addBot', { count: 'fill' });
  else if (v === '-all') ask('removeBot', { count: 'all' });
  else if (v.startsWith('-')) ask('removeBot', { count: Number(v.slice(1)) });
  else ask('addBot', { count: Number(v) });
});
$('startBtn').addEventListener('click', () => ask('start'));
$('autoBalanceBtn').addEventListener('click', () => ask('autoBalance'));

function renderBanner() {
  const el = $('banner');

  // Sabah özetini sıra yönetir: ölümler tek tek duyurulur.
  if (sabahAnlat()) return;

  let text = null;
  let tone = '';

  if (state.phase === 'trial') {
    const accused = state.players.find((p) => p.id === state.accusedId);
    text = `${accused?.name ?? 'Sanık'} meydanın ortasında savunma yapıyor.`;
    tone = 'is-bad';
  } else if (state.phase === 'vote_result' && state.voteResult) {
    text = state.voteResult.text;
    tone = state.voteResult.kind === 'lynch' ? 'is-bad' : '';
  } else if (state.phase === 'reveal') {
    text = 'Roller dağıtıldı. Rol panelinden kendi rolüne bak.';
  } else if (state.phase === 'end') {
    text = state.result?.text ?? 'Oyun bitti.';
    tone = state.result?.winner === 'vampir' ? 'is-bad' : 'is-good';
  }

  el.hidden = !text;
  el.textContent = text ?? '';
  el.className = `banner ${tone}`.trim();
}

// ── ayarlar penceresi ─────────────────────────────────

const DAY_CHOICES = [40, 50, 60, 70, 80, 90, 100, 110, 120];

const TIMER_FIELDS = [
  ['vote', 'Oylama süresi', 15, 180],
  ['night', 'Gece süresi', 15, 180],
  ['reveal', 'Rol gösterme', 5, 30],
  ['nightResult', 'Sabah özeti', 3, 30],
  ['voteResult', 'Oylama özeti', 3, 30],
];

const TOGGLES = [
  ['doctorSelfHeal', 'Doktor kendini koruyabilir', ''],
  ['doctorRepeat', 'Doktor aynı kişiyi üst üste koruyabilir', ''],
  ['jesterEndsGame', 'Joker asılınca oyun biter', 'Kapalıysa Joker sadece ölür.'],
  ['revealRoleOnDeath', 'Ölenin rolü açıklanır', ''],
  ['firstDayTalk', 'İlk gün oylamasız tanışma', ''],
  ['autoAdvance', 'Herkes seçince faz erken bitsin', 'Gece hariç: gece hep tam sürer.'],
  ['tasksEnabled', 'Gizli görevler açık', ''],
  ['voiceEnabled', 'Sesli sohbet açık', ''],
];

function renderSettings() {
  const isHost = !!state?.you?.isHost;
  const s = state.settings;
  const dis = isHost ? '' : 'disabled';

  $('settingsBody').innerHTML = `
    <div class="set-group">
      <h3>Oyuncu sayısı</h3>
      <label class="set-row"><span>En az oyuncu<small>Bu sayıya ulaşmadan oyun başlamaz.</small></span>
        <input type="number" min="4" max="16" value="${s.minPlayers}" data-num="minPlayers" ${dis} /></label>
      <label class="set-row"><span>En fazla oyuncu</span>
        <input type="number" min="4" max="16" value="${s.maxPlayers}" data-num="maxPlayers" ${dis} /></label>
    </div>
    <div class="set-group">
      <h3>Süreler (saniye)</h3>
      <label class="set-row"><span>Tartışma süresi<small>Sabah konuşma süresi.</small></span>
        <select data-timer="day" ${dis}>
          ${DAY_CHOICES.map(
            (n) => `<option value="${n}" ${s.timers.day === n ? 'selected' : ''}>${n} saniye</option>`
          ).join('')}
        </select></label>
      ${TIMER_FIELDS.map(
        ([key, label, min, max]) =>
          `<label class="set-row"><span>${label}</span>
             <input type="number" min="${min}" max="${max}" value="${s.timers[key]}" data-timer="${key}" ${dis} /></label>`
      ).join('')}
    </div>
    <div class="set-group">
      <h3>Görünüm</h3>
      <label class="set-row"><span>Yeni köy sahnesi<small>Kapatırsan eski basit görünüme döner. Sadece senin ekranını etkiler.</small></span>
        <span class="switch"><input type="checkbox" data-stage ${useVillage ? 'checked' : ''} /><span></span></span></label>
    </div>
    <div class="set-group">
      <h3>Gizli görevler</h3>
      <label class="set-row"><span>Görev alan kişi sayısı<small>Her oyunda kaç kişiye gizli görev verilir.</small></span>
        <input type="number" min="0" max="16" value="${s.taskCount}" data-num="taskCount" ${dis} /></label>
      <label class="set-row"><span>Başarı bonusu (%)<small>Görevi başaranın sonraki oyunda özel rol alma şansı.</small></span>
        <input type="number" min="0" max="200" value="${s.luckBonusPct}" data-num="luckBonusPct" ${dis} /></label>
      <label class="set-row"><span>Özel rol alınca bonus sıfırlansın<small>Kapalıysa bonus birikmeye devam eder.</small></span>
        <span class="switch"><input type="checkbox" data-flag="luckResetOnSpecial" ${s.luckResetOnSpecial ? 'checked' : ''} ${dis} /><span></span></span></label>
    </div>
    <div class="set-group">
      <h3>Kurallar</h3>
      ${TOGGLES.map(
        ([key, label, hint]) =>
          `<label class="set-row"><span>${label}${hint ? `<small>${hint}</small>` : ''}</span>
             <span class="switch"><input type="checkbox" data-flag="${key}" ${s[key] ? 'checked' : ''} ${dis} /><span></span></span></label>`
      ).join('')}
    </div>
    ${isHost ? '' : '<p class="action-hint">Ayarları sadece oyun sahibi değiştirebilir.</p>'}
    ${state.phase === 'lobby' ? '' : '<p class="action-hint">Oyun sürerken ayar değişmez.</p>'}`;
}

// Tam ekran — telefonu yatay çevirenler için.
$('fsBtn').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    toast('Tarayıcı tam ekranı desteklemiyor.');
  }
});

document.addEventListener('fullscreenchange', () => {
  $('fsBtn').textContent = document.fullscreenElement ? '⛶' : '⛶';
  document.body.classList.toggle('is-fullscreen', !!document.fullscreenElement);
  // Yatay modda panelleri kapat, köy tam ekran olsun.
  // Yatayda paneller zaten hep açık; sekme zorlamaya gerek yok.
});

$('restartBtn').addEventListener('click', () => {
  if (confirm('Oyun baştan başlasın mı? Herkes lobiye döner.')) ask('restart');
});

$('settingsBtn').addEventListener('click', () => {
  if (!state) return;
  renderSettings();
  $('settingsModal').hidden = false;
});
$('closeSettings').addEventListener('click', () => ($('settingsModal').hidden = true));
$('settingsModal').addEventListener('click', (e) => {
  if (e.target === $('settingsModal')) $('settingsModal').hidden = true;
});

$('settingsBody').addEventListener('change', (e) => {
  const el = e.target;
  if (el.dataset.stage !== undefined) {
    useVillage = el.checked;
    localStorage.setItem('vk_stage', useVillage ? 'koy' : 'klasik');
    if (state) renderStage();
    return;
  }
  if (el.dataset.timer) ask('settings', { timers: { [el.dataset.timer]: Number(el.value) } });
  else if (el.dataset.num) ask('settings', { [el.dataset.num]: Number(el.value) });
  else if (el.dataset.flag) ask('settings', { [el.dataset.flag]: el.checked });
});

// ── mobil sekmeler ────────────────────────────────────

document.querySelectorAll('.mtab').forEach((tab) => {
  tab.addEventListener('click', () => showPane(tab.dataset.pane));
});
document.querySelector('.col-stage').classList.add('is-open');

document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('is-active', t === tab));
    $('tabRol').hidden = tab.dataset.tab !== 'rol';
    $('tabGorev').hidden = tab.dataset.tab !== 'gorev';
    $('tabVasiyet').hidden = tab.dataset.tab !== 'vasiyet';
  });
});

// ── sesli sohbet ──────────────────────────────────────

function renderVoice() {
  const bar = $('voiceBar');
  const info = state?.you?.voice;

  if (!info?.enabled) {
    bar.hidden = true;
    return;
  }
  bar.hidden = false;

  const st = voice.status();
  const canSpeak = info.canSpeak !== false;

  // Sesli sohbet açıkken müziği kıs, kapanınca geri aç.
  music.setDucked(st.active);

  // Ölüler sadece dinler: mikrofon zorla kapalı.
  if (st.active && !canSpeak && !st.muted) voice.setMuted(true);

  const joinBtn = $('voiceJoinBtn');
  const muteBtn = $('voiceMuteBtn');
  const roomEl = $('voiceRoom');

  joinBtn.textContent = st.active ? 'Sesten çık' : '🎤 Sese katıl';
  joinBtn.classList.toggle('is-on', st.active);

  muteBtn.hidden = !st.active;
  muteBtn.disabled = !canSpeak;
  muteBtn.textContent = st.muted ? '🔇' : '🎙';
  muteBtn.title = canSpeak
    ? st.muted ? 'Mikrofonu aç' : 'Mikrofonu kapat'
    : 'Ölüler konuşamaz, sadece dinlersin';
  muteBtn.classList.toggle('is-muted', st.muted);

  roomEl.hidden = !st.active;
  if (st.active) {
    const h = voice.health();
    let label;
    if (!info.room) label = 'Gece sessizliği';
    else if (h.kuruluyor > 0) label = `${VOICE_ROOM_LABEL[info.room]} · bağlanıyor…`;
    else if (h.ok === 0 && h.basarisiz > 0) label = `${VOICE_ROOM_LABEL[info.room]} · bağlanamadı`;
    else if (!canSpeak) label = `Dinliyorsun · ${h.ok + 1}`;
    else label = `${VOICE_ROOM_LABEL[info.room]} · ${h.ok + 1}`;
    roomEl.textContent = label;
    roomEl.className = `pill voice-room room-${info.room ?? 'off'}`;
  }
}

$('voiceJoinBtn').addEventListener('click', async () => {
  if (voice.status().active) {
    voice.disable();
    return;
  }
  if (!state?.you) return toast('Önce oyuna katıl.');
  try {
    await voice.enable(state.you.id);
  } catch (err) {
    toast(err.message);
  }
});

$('voiceMuteBtn').addEventListener('click', () => voice.setMuted(!voice.status().muted));

// ── gizli görev ───────────────────────────────────────

const VERIFY_LABEL = {
  oto: 'Oyun takip ediyor',
  yayinci: 'Oyun sahibi onaylar',
  koy: 'Köy oylar',
};

function renderTask() {
  const el = $('secretTask');
  const you = state?.you;
  const task = you?.task;

  if (!task) {
    el.hidden = true;
    return;
  }
  el.hidden = false;

  el.innerHTML = `
    <h3>Gizli görevin</h3>
    <p class="st-text">${escapeHtml(task.text)}</p>
    <div class="st-meta">
      <span>${VERIFY_LABEL[task.verify] ?? ''}</span>
      <span>${task.points} puan</span>
    </div>
    ${you.taskDone ? '<div class="st-done">Tamamlandı</div>' : ''}
    ${you.canReroll ? '<button type="button" class="btn btn-ghost" data-reroll>Başka görev ver</button>' : ''}
    <p class="st-hint">Kimseye söyleme. Oyun sonunda açıklanacak.</p>`;
}

$('secretTask').addEventListener('click', (e) => {
  if (e.target.closest('[data-reroll]')) ask('task:reroll');
});

function openTaskModal() {
  renderTaskModal();
  $('taskModal').hidden = false;
}

function renderTaskModal() {
  const rows = state?.tasks ?? [];
  const you = state?.you;
  const isHost = !!you?.isHost;

  const badge = {
    basarili: '<span class="tm-badge ok">Başardı</span>',
    basarisiz: '<span class="tm-badge no">Başaramadı</span>',
    bekliyor: '<span class="tm-badge wait">Oy bekliyor</span>',
    yok: '',
  };

  const intro = `<p class="tm-intro">Bu oyunda ${rows.length} kişiye gizli görev verildi.
    "Yaptı" oyu çoğunluğu alan, sonraki oyunda özel rol alma şansını
    %${state.settings.luckBonusPct} artırır.</p>`;

  $('taskModalBody').innerHTML = intro + rows
    .map((r) => {
      const canVote =
        you &&
        r.playerId !== you.id &&
        (r.task.verify === 'koy' || (r.task.verify === 'yayinci' && isHost));

      const votes =
        r.task.verify === 'oto' ? '' : `<span class="tm-votes">${r.yes} evet · ${r.no} hayır</span>`;

      return `<div class="tm-row">
        <div class="tm-head">
          <span class="pl-dot" style="background:${r.cosmetic.color}"></span>
          <strong>${escapeHtml(r.name)}</strong>
          ${badge[r.outcome] ?? ''}
          <span class="tm-points">${r.points} puan</span>
        </div>
        <p class="tm-task">${escapeHtml(r.task.text)}</p>
        <div class="tm-foot">
          ${votes}
          ${
            canVote
              ? `<span class="tm-actions">
                   <button type="button" data-vote="1" data-subject="${r.playerId}">Yaptı</button>
                   <button type="button" data-vote="0" data-subject="${r.playerId}">Yapmadı</button>
                 </span>`
              : ''
          }
        </div>
      </div>`;
    })
    .join('');
}

$('taskModalBody').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-vote]');
  if (!btn) return;
  ask('task:vote', { subjectId: btn.dataset.subject, ok: btn.dataset.vote === '1' });
});

$('closeTasks').addEventListener('click', () => ($('taskModal').hidden = true));
$('taskModal').addEventListener('click', (e) => {
  if (e.target === $('taskModal')) $('taskModal').hidden = true;
});

// ── vasiyet ──────────────────────────────────────────

let willTimer = null;
let willDirty = false;

/** Ölen oyuncuların vasiyetleri, herkes görsün. */
function renderWillList() {
  const dead = state.players.filter((p) => !p.alive && p.will?.text);
  $('willList').innerHTML = dead.length
    ? `<h3>Açılan vasiyetler</h3>` +
      dead
        .map(
          (p) => `<div class="will-card">
            <strong>${escapeHtml(p.name)}</strong>
            <p>${escapeHtml(p.will.text)}</p>
          </div>`
        )
        .join('')
    : '';
}

function renderWill() {
  const you = state?.you;
  const panel = $('willPanel');
  const box = $('willInput');

  if (!you || state.phase === 'lobby') {
    panel.hidden = true;
    return;
  }
  panel.hidden = false;

  if (you.willLocked) {
    box.disabled = true;
    $('willState').textContent = 'Öldün, vasiyetin kilitlendi.';
  } else {
    box.disabled = false;
    if (!willDirty && box.value !== (you.will ?? '')) box.value = you.will ?? '';
    if (!willDirty) $('willState').textContent = 'Kaydedildi.';
  }
}

$('willInput').addEventListener('input', () => {
  willDirty = true;
  $('willState').textContent = 'Yazılıyor...';
  clearTimeout(willTimer);
  willTimer = setTimeout(() => {
    socket.emit('will', { text: $('willInput').value }, (res) => {
      willDirty = false;
      $('willState').textContent = res?.error ? res.error : 'Kaydedildi.';
    });
  }, 700);
});

// ── ölenin vasiyeti: parşömen ─────────────────────────

const willSeen = new Set();
let willQueue = [];
let sabahSirasi = null;     // {adim, satirlar, zamanlayici}
let revealTimer = null;

function collectWills() {
  const out = [];
  const add = (playerId, will) => {
    if (!playerId || !will?.text) return;
    const key = `${playerId}:${state.dayNo}`;
    if (willSeen.has(key)) return;
    willSeen.add(key);
    const p = state.players.find((x) => x.id === playerId);
    out.push({ name: p?.name ?? 'Bilinmeyen', text: will.text });
  };

  // Asılan, idamdan sonra. Gece ölenleri sabah sırası yönetir.
  if (state.phase === 'vote_result' && state.voteResult?.kind === 'lynch') {
    add(state.voteResult.playerId, state.voteResult.will);
  }
  return out;
}

/**
 * Sabah özeti: ölümler tek tek duyurulur, her birinin ardından vasiyeti açılır.
 * Hepsini aynı anda basmak yerine sıraya koyuyoruz.
 */
function sabahAnlat() {
  if (state.phase !== 'night_result') {
    if (sabahSirasi) {
      clearTimeout(sabahSirasi.zamanlayici);
      sabahSirasi = null;
    }
    return false;
  }
  if (sabahSirasi) return true;

  const olumler = (state.nightSummary ?? []).filter((x) => x.kind === 'death');
  const digerleri = (state.nightSummary ?? []).filter((x) => x.kind !== 'death');

  sabahSirasi = { satirlar: digerleri.map((x) => x.text), zamanlayici: null };
  bannerYaz();

  const adimla = (i) => {
    if (!sabahSirasi || i >= olumler.length) return;
    const o = olumler[i];

    sabahSirasi.satirlar.push(o.text);
    bannerYaz();

    // Bir saniye sonra vasiyeti aç, sonra sıradakine geç.
    sabahSirasi.zamanlayici = setTimeout(() => {
      if (o.will?.text) {
        const p = state.players.find((x) => x.id === o.playerId);
        willQueue.push({ name: p?.name ?? 'Bilinmeyen', text: o.will.text });
        if ($('willReveal').hidden) showNextWill();
      }
      sabahSirasi.zamanlayici = setTimeout(() => adimla(i + 1), o.will?.text ? 4200 : 1200);
    }, 1000);
  };

  adimla(0);
  return true;
}

function bannerYaz() {
  const el = $('banner');
  const satirlar = sabahSirasi?.satirlar ?? [];
  const olumVar = satirlar.some((t) => /öldü|can verdi|asıldı|kıydı|bulundu|bıçaklandı|vuruldu|geceydi|çıkamadı/.test(t));
  el.hidden = satirlar.length === 0;
  el.className = `banner ${olumVar ? 'is-bad' : 'is-good'}`;
  el.textContent = satirlar.join(' ');
}

function showNextWill() {
  const next = willQueue.shift();
  if (!next) {
    $('willReveal').hidden = true;
    return;
  }
  $('willWho').textContent = `${next.name} — son vasiyeti`;
  $('willText').textContent = next.text;
  $('willReveal').hidden = false;

  clearTimeout(revealTimer);
  revealTimer = setTimeout(showNextWill, 9000);
}

let willOpenTimer = null;

function renderWillReveal() {
  const found = collectWills();
  if (!found.length) return;
  willQueue.push(...found);

  // Sabah bildirimi okunsun, vasiyet ondan sonra açılsın.
  if ($('willReveal').hidden && !willOpenTimer) {
    willOpenTimer = setTimeout(() => {
      willOpenTimer = null;
      showNextWill();
    }, 2600);
  }
}

$('willClose').addEventListener('click', () => {
  clearTimeout(revealTimer);
  showNextWill();
});
$('willReveal').addEventListener('click', (e) => {
  if (e.target === $('willReveal')) {
    clearTimeout(revealTimer);
    showNextWill();
  }
});

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

boot();
