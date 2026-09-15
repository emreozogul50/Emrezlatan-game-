// Soketsiz oyun testi: motoru baştan sona çalıştırır.
import assert from 'node:assert/strict';
import { Room, PHASE } from '../src/game.js';
import { validateRoleCounts, suggestRoleCounts, ROLES, hasNightAction } from '../src/roles.js';

const ROLES_HAS_NIGHT = (id) => Boolean(ROLES[id]?.night?.prompt);

const fakeIo = { to: () => ({ emit: () => {} }) };

const BASE = {
  edward: 1, vampir: 1, doktor: 0, bekci: 0, kahin: 0, jailor: 0, escort: 0,
  baskan: 0, canlandirici: 0, kanunsuz: 0, casus: 0, dolandirici: 0,
  joker: 0, serikatil: 0, survivor: 0, veteran: 0,
  serif: 0, medium: 0, takipci: 0, arabaci: 0, kapanci: 0, rolhirsizi: 0,
  jigolo: 0, susturucu: 0, tacizci: 0, kamuflaj: 0, iftiraci: 0, korumaci: 0, sahtekar: 0,
};

/** Köylü rolü kalktı: sıradan bir köy tarafı oyuncusu bul. */
function sivil(room, haric = []) {
  const uygun = (p) => !haric.includes(p.id) && !haric.includes(p.roleId);
  const canli = room.alivePlayers();
  return (
    canli.find((p) => p.roleId === 'koylu' && uygun(p)) ??
    canli.find((p) => ROLES[p.roleId].team === 'koy' && !hasNightAction(p.roleId) && uygun(p)) ??
    canli.find((p) => ROLES[p.roleId].team === 'koy' && uygun(p))
  );
}

function makeRoom(playerCount, roles = {}, settings = {}) {
  const room = new Room('TEST', fakeIo, { hostName: 'EMREZL' });
  clearInterval(room.timer);
  for (let i = 1; i <= playerCount; i++) {
    const r = room.addPlayer({ name: `Oyuncu${i}`, socketId: `s${i}` });
    assert.ok(r.player, r.error);
  }
  const host = room.host();
  const res = room.updateSettings(host.id, { roles: { ...BASE, ...roles }, ...settings });
  assert.ok(!res.error, res.error);
  for (const p of room.players.values()) p.ready = true;
  room.phaseEndsAt = null;
  return { room, host };
}

const step = (room) => { room.phaseEndsAt = Date.now() - 1; room.tick(); };
const by = (room, roleId) => [...room.players.values()].find((p) => p.roleId === roleId);
const allBy = (room, roleId) => [...room.players.values()].filter((p) => p.roleId === roleId);

/** Rolleri elle atayıp istenen kurulumu garantiler. */
function forceRoles(room, mapping) {
  const players = room.seatedPlayers();
  let i = 0;
  for (const [roleId, count] of Object.entries(mapping)) {
    for (let n = 0; n < count; n++) players[i++].roleId = roleId;
  }
  while (i < players.length) players[i++].roleId = 'koylu';
  for (const p of players) { p.alive = true; p.roleUses = {}; p.abilityDisabled = false; }
}

function toNight(room, host) {
  room.updateSettings(host.id, { firstDayTalk: false });
  room.start(host.id);
  step(room); // reveal -> night
  assert.equal(room.phase, PHASE.NIGHT);
}

// ── 1. rol doğrulama ────────────────────────────────────────────
{
  assert.equal(validateRoleCounts({ ...BASE, edward: 0 }, 8).ok, false);
  assert.equal(validateRoleCounts({ ...BASE, vampir: 4 }, 8).ok, false);
  const ok = validateRoleCounts({ ...BASE, vampir: 1, doktor: 1, kahin: 1 }, 10);
  assert.equal(ok.ok, true);
  assert.equal(ok.villagers, 6);

  for (const n of [8, 10, 12, 14, 16]) {
    assert.equal(validateRoleCounts(suggestRoleCounts(n), n).ok, true, `${n} kişilik öneri geçersiz`);
  }
  console.log('✓ rol dağılımı doğrulaması ve otomatik dağıtım');
}

// ── 2. herkes rol alıyor ────────────────────────────────────────
{
  const { room, host } = makeRoom(12, { vampir: 2, doktor: 1, kahin: 1, jailor: 1, escort: 1, casus: 1 });
  assert.ok(!room.start(host.id).error);
  const counts = {};
  for (const p of room.players.values()) counts[p.roleId] = (counts[p.roleId] ?? 0) + 1;
  assert.equal(counts.edward, 1);
  assert.equal(counts.vampir, 2);
  assert.equal(counts.casus, 1);
  // Klasik kurulumda boşluklar köylüyle dolar.
  assert.equal(counts.koylu, 4);
  room.destroy();
  console.log('✓ klasik kurulumda roller doğru sayıda dağıtıldı');
}

// ── 3. Edward emri, saldırıyı vampir yapar ──────────────────────
{
  const { room, host } = makeRoom(8, { vampir: 1, doktor: 1 });
  toNight(room, host);
  forceRoles(room, { edward: 1, vampir: 1, doktor: 1, escort: 1 });

  const edward = by(room, 'edward');
  const grunt = by(room, 'vampir');
  const victim = sivil(room);

  room.submitNightAction(edward.id, { targetId: victim.id });
  step(room);

  assert.equal(victim.alive, false, 'Edward emri uygulanmalı');
  assert.equal(room.night.actions.has(grunt.id), false, 'vampir ayrı emir vermez');
  room.destroy();
  console.log('✓ Edward emri veriyor, saldırıyı vampir yapıyor');
}

// ── 4. escort Edward'ı engellese de kil çıkar ───────────────────
{
  const { room, host } = makeRoom(8, { vampir: 1, escort: 1 });
  toNight(room, host);
  forceRoles(room, { edward: 1, vampir: 1, escort: 1 });

  const edward = by(room, 'edward');
  const escort = by(room, 'escort');
  const victim = sivil(room);

  room.submitNightAction(edward.id, { targetId: victim.id });
  room.submitNightAction(escort.id, { targetId: edward.id });
  step(room);

  assert.equal(victim.alive, false, 'Edward engellense de vampir öldürür');
  room.destroy();
  console.log('✓ Edward engellenince kil yine çıkıyor');
}

// ── 5. normal vampir engellenirse kil çıkmaz ────────────────────
{
  const { room, host } = makeRoom(8, { vampir: 1, escort: 1 });
  toNight(room, host);
  forceRoles(room, { edward: 1, vampir: 1, escort: 1 });

  const edward = by(room, 'edward');
  const grunt = by(room, 'vampir');
  const escort = by(room, 'escort');
  const victim = sivil(room);

  room.submitNightAction(edward.id, { targetId: victim.id });
  room.submitNightAction(escort.id, { targetId: grunt.id });
  step(room);

  assert.equal(victim.alive, true, 'tek vampir engellendiyse kil çıkmamalı');
  room.destroy();
  console.log('✓ vampir engellenince kil çıkmıyor');
}

// ── 6. gardiyan: hapis, engelleme, idam ─────────────────────────
{
  const { room, host } = makeRoom(8, { vampir: 1, jailor: 1, doktor: 1 });
  room.updateSettings(host.id, { firstDayTalk: true });
  room.start(host.id);
  forceRoles(room, { edward: 1, vampir: 1, jailor: 1, doktor: 1, kahin: 1 });
  step(room); // reveal -> day1

  const jailor = by(room, 'jailor');
  const kahin = by(room, 'kahin');
  const edward = by(room, 'edward');
  const doktor = by(room, 'doktor');

  assert.ok(!room.setJail(jailor.id, kahin.id).error);
  step(room); // day -> night
  assert.equal(room.jailedId, kahin.id);

  // Hapisteki rolünü kullanamaz, vampir ona ulaşamaz, doktor koruması gereksiz.
  assert.match(room.submitNightAction(kahin.id, { targetId: edward.id }).error, /hapistesin/);
  room.submitNightAction(edward.id, { targetId: kahin.id });
  room.submitNightAction(doktor.id, { targetId: kahin.id });
  room.submitNightAction(jailor.id, {}); // idam
  step(room);

  assert.equal(kahin.alive, false, 'gardiyan idamı doktoru deler');
  assert.equal(kahin.deathInfo.cause, 'idam');
  // Gardiyanın 3 idam hakkı var; masum astığı için hepsi gitti.
  assert.equal(room.usesLeft(jailor), 0, 'masum idam edilince haklar biter');
  room.destroy();
  console.log('✓ gardiyan hapsediyor, engelliyor ve idam ediyor');
}

// ── 7. hapisteki dışarıdan öldürülemez ──────────────────────────
{
  const { room, host } = makeRoom(8, { vampir: 1, jailor: 1 });
  room.updateSettings(host.id, { firstDayTalk: true });
  room.start(host.id);
  forceRoles(room, { edward: 1, vampir: 1, jailor: 1 });
  step(room);

  const jailor = by(room, 'jailor');
  const edward = by(room, 'edward');
  const victim = sivil(room);

  room.setJail(jailor.id, victim.id);
  step(room);
  room.submitNightAction(edward.id, { targetId: victim.id });
  step(room);

  assert.equal(victim.alive, true, 'hapisteki dışarıdan öldürülemez');
  room.destroy();
  console.log('✓ hapisteki kişi dışarıdan korunuyor');
}

// ── 8. escort gardiyanı engelleyemez ────────────────────────────
{
  const { room, host } = makeRoom(8, { vampir: 1, jailor: 1, escort: 1 });
  room.updateSettings(host.id, { firstDayTalk: true });
  room.start(host.id);
  forceRoles(room, { edward: 1, vampir: 1, jailor: 1, escort: 1 });
  step(room);

  const jailor = by(room, 'jailor');
  const escort = by(room, 'escort');
  const victim = sivil(room);

  room.setJail(jailor.id, victim.id);
  step(room);
  room.submitNightAction(escort.id, { targetId: jailor.id });
  room.submitNightAction(jailor.id, {});
  step(room);

  assert.equal(victim.alive, false, 'escort gardiyanı engelleyememeli');
  assert.match(room.night.results.get(escort.id).text, /Gardiyanı engelleyemedin/);
  room.destroy();
  console.log('✓ escort gardiyanı engelleyemiyor');
}

// ── 9. Edward ölünce yerine geçiliyor ───────────────────────────
{
  const { room, host } = makeRoom(9, { vampir: 1, casus: 1 });
  toNight(room, host);
  forceRoles(room, { edward: 1, vampir: 1, casus: 1 });

  const edward = by(room, 'edward');
  const grunt = by(room, 'vampir');
  edward.alive = false;
  room.promoteEdward();

  assert.equal(grunt.roleId, 'edward', 'önce normal vampir geçer');

  // Casus köy tarafında; Edward olamaz.
  const casus = by(room, 'casus');
  grunt.alive = false;
  room.promoteEdward();
  assert.equal(casus.roleId, 'casus', 'casus köylü olduğu için Edward olamaz');

  room.destroy();
  console.log('✓ Edward ölünce yerine vampir geçiyor, casus geçemiyor');
}

// ── 10. casus: anonim sohbet + hedefi görür ─────────────────────
{
  const { room, host } = makeRoom(9, { vampir: 1, casus: 1 });
  toNight(room, host);
  forceRoles(room, { edward: 1, vampir: 1, casus: 1 });

  const edward = by(room, 'edward');
  const casus = by(room, 'casus');
  const grunt = by(room, 'vampir');
  const victim = sivil(room);

  room.sendChat(edward.id, 'bu gece onu alalim');
  const casusView = room.stateFor(casus);
  const msg = casusView.chat.find((m) => m.text === 'bu gece onu alalim');
  assert.ok(msg, 'casus vampir sohbetini görmeli');
  assert.match(msg.name, /^Vampir \d+$/, 'casus konuşanın gerçek adını görmemeli');

  // Casus takım arkadaşlarının rolünü de görmemeli.
  assert.equal(casusView.players.filter((p) => p.roleId && p.id !== casus.id).length, 0);

  // Vampirler de casusu tanımaz (artık köy tarafında).
  const vampView = room.stateFor(grunt);
  assert.equal(vampView.players.some((p) => p.id === casus.id && p.roleId), false);

  room.submitNightAction(edward.id, { targetId: victim.id });
  step(room);
  assert.match(room.night.results.get(casus.id).text, new RegExp(victim.name));

  room.destroy();
  console.log('✓ casus anonim okuyor, hedefi görüyor, takımını tanımıyor');
}

// ── 11. seri katil ve survivor yeleği ───────────────────────────
{
  const { room, host } = makeRoom(9, { vampir: 1, serikatil: 1, survivor: 1 });
  toNight(room, host);
  forceRoles(room, { edward: 1, vampir: 1, serikatil: 1, survivor: 1 });

  const sk = by(room, 'serikatil');
  const survivor = by(room, 'survivor');

  room.submitNightAction(sk.id, { targetId: survivor.id });
  room.submitNightAction(survivor.id, {});
  step(room);

  assert.equal(survivor.alive, true, 'yelek saldırıyı durdurmalı');
  assert.equal(room.usesLeft(survivor), 3, 'bir yelek harcanmalı (4 hakkın 1i)');

  // İkinci gece yelek yok -> ölür.
  step(room); step(room); step(room); step(room); step(room);
  while (room.phase !== PHASE.NIGHT) step(room);
  room.submitNightAction(survivor.id, {});
  room.submitNightAction(survivor.id, {});
  assert.equal(room.usesLeft(survivor), 3, 'ikinci basış vazgeçiş, hak harcanmaz');

  room.destroy();
  console.log('✓ seri katil öldürüyor, survivor yeleği koruyor');
}

// ── 12. kanunsuz tek kurşun ─────────────────────────────────────
{
  const { room, host } = makeRoom(8, { vampir: 1, kanunsuz: 1 });
  toNight(room, host);
  forceRoles(room, { edward: 1, vampir: 1, kanunsuz: 1 });

  const k = by(room, 'kanunsuz');
  const t1 = sivil(room);
  room.submitNightAction(k.id, { targetId: t1.id });
  step(room);
  assert.equal(t1.alive, false);
  assert.equal(room.usesLeft(k), 0);

  while (room.phase !== PHASE.NIGHT) step(room);
  const t2 = sivil(room);
  assert.match(room.submitNightAction(k.id, { targetId: t2.id }).error, /Hakkın kalmadı/);

  room.destroy();
  console.log('✓ kanunsuzun tek kurşunu var');
}

// ── 13. duruşma: savunma + evet/hayır ───────────────────────────
{
  const { room, host } = makeRoom(8, { vampir: 1 });
  toNight(room, host);
  forceRoles(room, { edward: 1, vampir: 1 });

  const edward = by(room, 'edward');
  room.submitNightAction(edward.id, { targetId: sivil(room).id });
  step(room); // night_result
  step(room); // day
  step(room); // vote
  assert.equal(room.phase, PHASE.VOTE);

  const accused = sivil(room);
  for (const p of room.alivePlayers()) if (p.id !== accused.id) room.submitVote(p.id, accused.id);
  step(room);

  assert.equal(room.phase, PHASE.TRIAL, 'oy alan savunmaya çıkmalı');
  assert.equal(room.accusedId, accused.id);
  // Savunma sırasında sadece sanık konuşur.
  assert.equal(room.chatChannelFor(accused), 'koy');
  assert.equal(room.chatChannelFor(edward), null);

  step(room); // judgement
  assert.equal(room.phase, PHASE.JUDGEMENT);
  assert.match(room.submitJudgement(accused.id, true).error, /Kendi hakkında/);

  const jury = room.alivePlayers().filter((p) => p.id !== accused.id);
  jury.forEach((p, i) => room.submitJudgement(p.id, i < jury.length - 1));
  step(room);

  assert.equal(accused.alive, false, 'evet çoğunluğu asmalı');
  assert.equal(room.lastVoteResult.kind, 'lynch');
  room.destroy();
  console.log('✓ duruşma, savunma ve evet/hayır oylaması');
}

// ── 14. hayır çoğunluğu serbest bırakır ─────────────────────────
{
  const { room, host } = makeRoom(8, { vampir: 1 });
  toNight(room, host);
  forceRoles(room, { edward: 1, vampir: 1 });
  const edward = by(room, 'edward');
  room.submitNightAction(edward.id, { targetId: sivil(room).id });
  while (room.phase !== PHASE.VOTE) step(room);

  const accused = sivil(room);
  for (const p of room.alivePlayers()) if (p.id !== accused.id) room.submitVote(p.id, accused.id);
  step(room); step(room); // trial -> judgement

  for (const p of room.alivePlayers()) if (p.id !== accused.id) room.submitJudgement(p.id, false);
  step(room);

  assert.equal(accused.alive, true);
  assert.equal(room.lastVoteResult.kind, 'spared');
  room.destroy();
  console.log('✓ hayır çoğunluğu sanığı serbest bırakıyor');
}

// ── 15. başkan 3 oy ─────────────────────────────────────────────
{
  const { room, host } = makeRoom(8, { vampir: 1, baskan: 1 });
  toNight(room, host);
  forceRoles(room, { edward: 1, vampir: 1, baskan: 1 });
  const edward = by(room, 'edward');
  const baskan = by(room, 'baskan');
  room.submitNightAction(edward.id, { targetId: sivil(room).id });
  while (room.phase !== PHASE.DAY) step(room);

  assert.equal(room.voteWeight(baskan), 1);
  assert.ok(!room.revealPresident(baskan.id).error);
  assert.equal(room.voteWeight(baskan), 3);
  assert.match(room.revealPresident(baskan.id).error, /Zaten/);

  step(room); // vote
  const a = sivil(room);
  const b = sivil(room, [a.id]);
  room.submitVote(baskan.id, a.id);
  room.submitVote(edward.id, b.id);
  const other = room.alivePlayers().find((p) => ![baskan.id, edward.id, a.id, b.id].includes(p.id));
  if (other) room.submitVote(other.id, b.id);

  assert.equal(room.tallyNomination(), a.id, 'başkanın 3 oyu ağır basmalı');
  room.destroy();
  console.log('✓ başkan ilan edince oyu 3 sayılıyor');
}

// ── 16. vasiyet ve dolandırıcı ──────────────────────────────────
{
  const { room, host } = makeRoom(9, { vampir: 1, dolandirici: 1 });
  toNight(room, host);
  forceRoles(room, { edward: 1, vampir: 1, dolandirici: 1 });

  const edward = by(room, 'edward');
  const forger = by(room, 'dolandirici');
  const victim = sivil(room);

  room.setWill(victim.id, 'Doktor bendim, Ali vampir');
  room.submitNightAction(forger.id, { targetId: victim.id, text: 'Ben vampirim, beni asın' });
  room.submitNightAction(edward.id, { targetId: victim.id });
  step(room);

  assert.equal(victim.alive, false);
  const death = room.lastNightSummary.find((x) => x.kind === 'death');
  assert.equal(death.will.text, 'Ben vampirim, beni asın', 'sahte vasiyet çıkmalı');
  assert.equal(death.will.forged, true);
  assert.match(room.setWill(victim.id, 'yeni').error, /Öldükten sonra/);

  room.destroy();
  console.log('✓ vasiyet sistemi ve dolandırıcının sahteciliği');
}

// ── 17. canlandırıcı tek kullanım ───────────────────────────────
{
  const { room, host } = makeRoom(9, { vampir: 1, canlandirici: 1 });
  toNight(room, host);
  forceRoles(room, { edward: 1, vampir: 1, canlandirici: 1 });

  const edward = by(room, 'edward');
  const medic = by(room, 'canlandirici');
  const victim = sivil(room);

  room.submitNightAction(edward.id, { targetId: victim.id });
  step(room);
  assert.equal(victim.alive, false);

  while (room.phase !== PHASE.NIGHT) step(room);
  room.submitNightAction(medic.id, { targetId: victim.id });
  step(room);

  assert.equal(victim.alive, true, 'canlandırılmalı');
  assert.equal(victim.abilityDisabled, true, 'dönen yeteneğini kaybeder');
  assert.equal(room.usesLeft(medic), 0);

  room.destroy();
  console.log('✓ canlandırıcı bir kere diriltiyor, dönen yeteneksiz');
}

// ── 18. hapis sohbeti gardiyanı gizliyor ────────────────────────
{
  const { room, host } = makeRoom(8, { vampir: 1, jailor: 1 });
  room.updateSettings(host.id, { firstDayTalk: true });
  room.start(host.id);
  forceRoles(room, { edward: 1, vampir: 1, jailor: 1 });
  step(room);

  const jailor = by(room, 'jailor');
  const prisoner = sivil(room);
  room.setJail(jailor.id, prisoner.id);
  step(room); // night

  room.sendChat(jailor.id, 'rolun ne');
  const view = room.stateFor(prisoner);
  const msg = view.chat.find((m) => m.text === 'rolun ne');
  assert.ok(msg, 'hapisteki gardiyanın mesajını görmeli');
  assert.equal(msg.name, 'Gardiyan', 'gardiyanın gerçek adı gizli kalmalı');

  // Üçüncü biri bu sohbeti görmemeli.
  const outsider = room.alivePlayers().find((p) => ![jailor.id, prisoner.id].includes(p.id));
  assert.equal(room.stateFor(outsider).chat.some((m) => m.text === 'rolun ne'), false);

  room.destroy();
  console.log('✓ hapis sohbeti gizli, gardiyan anonim');
}

// ── 19. kazanma koşulları ───────────────────────────────────────
{
  const { room, host } = makeRoom(8, { vampir: 1, serikatil: 1 });
  toNight(room, host);
  forceRoles(room, { edward: 1, vampir: 1, serikatil: 1 });

  // Vampirler ölürse ve seri katil yaşıyorsa oyun bitmez.
  by(room, 'edward').alive = false;
  by(room, 'vampir').alive = false;
  assert.equal(room.checkWin(), null, 'seri katil hayattayken köy kazanamaz');

  // Seri katil de ölünce köy kazanır.
  by(room, 'serikatil').alive = false;
  assert.equal(room.checkWin().winner, 'koy');

  room.destroy();
  console.log('✓ seri katil hayattayken köy kazanamıyor');
}

// ── 20. survivor kazananlara ekleniyor ──────────────────────────
{
  const { room, host } = makeRoom(9, { vampir: 1, survivor: 1 });
  toNight(room, host);
  forceRoles(room, { edward: 1, vampir: 1, survivor: 1 });

  by(room, 'edward').alive = false;
  by(room, 'vampir').alive = false;
  room.finishIfOver();

  assert.equal(room.result.winner, 'koy');
  assert.ok(room.result.survivors.includes(by(room, 'survivor').name));
  room.destroy();
  console.log('✓ hayatta kalan survivor kazananlara ekleniyor');
}

// ── 21. rol gizliliği ───────────────────────────────────────────
{
  const { room, host } = makeRoom(12, { vampir: 2, doktor: 1, kahin: 1, jailor: 1, casus: 1 });
  room.start(host.id);

  const villager = sivil(room);
  const leaked = room.stateFor(villager).players.filter((p) => p.roleId && p.id !== villager.id);
  assert.equal(leaked.length, 0, 'köylü kimsenin rolünü görmemeli');

  const vamp = by(room, 'vampir');
  const seen = room.stateFor(vamp).players.filter((p) => p.roleId);
  assert.equal(seen.every((p) => ['edward', 'vampir', 'dolandirici'].includes(p.roleId)), true);
  room.destroy();
  console.log('✓ rol gizliliği korunuyor');
}

// ── 22. sohbet kanalları sızdırmıyor ────────────────────────────
{
  const { room, host } = makeRoom(9, { vampir: 1 });
  toNight(room, host);
  forceRoles(room, { edward: 1, vampir: 1 });

  const edward = by(room, 'edward');
  const villager = sivil(room);

  assert.ok(!room.sendChat(edward.id, 'kimi alalim').error);
  assert.match(room.sendChat(villager.id, 'uyanik miyim').error, /konuşamazsın/);
  assert.equal(room.stateFor(villager).chat.some((m) => m.text === 'kimi alalim'), false);
  room.destroy();
  console.log('✓ sohbet kanalları sızdırmıyor');
}

// ── 23. ayarlar ya hep ya hiç ───────────────────────────────────
{
  const { room, host } = makeRoom(8, { vampir: 1 });
  const res = room.updateSettings(host.id, { roles: { ...BASE, vampir: 2 }, timers: { day: 5 }, firstDayTalk: false });
  assert.ok(res.error);
  assert.equal(room.settings.roles.vampir, 1);
  assert.equal(room.settings.timers.day, 60);
  assert.equal(room.settings.firstDayTalk, true);
  room.destroy();
  console.log('✓ ayarlar ya hep ya hiç uygulanıyor');
}

// ── 24. görevler ve şans bonusu ─────────────────────────────────
{
  const { room, host } = makeRoom(10, { vampir: 1, doktor: 1, kahin: 1 });
  room.start(host.id);
  assert.equal([...room.players.values()].filter((p) => p.task).length, 3);

  const owner = [...room.players.values()].find((p) => p.task);
  owner.task = { id: 5, text: 'test', verify: 'koy', points: 1, targetId: null };
  room.endGame('koy', 'test');
  for (const v of [...room.players.values()].filter((p) => p.id !== owner.id).slice(0, 4)) {
    room.submitTaskVote(v.id, owner.id, true);
  }
  room.restart(host.id);
  assert.equal(owner.roleLuck, 1.5);
  room.destroy();
  console.log('✓ 3 gizli görev ve %50 şans bonusu');
}

// ── 25. şans bonusu özel slota düşürüyor ───────────────────────
{
  // "Rastgele Köylü" slotları sona kalır; şanslı oyuncu belirlenmiş slota düşer.
  let sansliOzel = 0;
  let normalOzel = 0;
  const TUR = 2000;

  for (let i = 0; i < TUR; i++) {
    const { room, host } = makeRoom(10, {});
    const oyuncular = room.seatedPlayers();
    const sansli = oyuncular.find((p) => p.id !== host.id);
    const normal = oyuncular.find((p) => p.id !== host.id && p.id !== sansli.id);
    sansli.roleLuck = 5;

    room.settings.slots = [
      'rol:jailor', 'rol:edward', 'rol:vampir', 'rol:serikatil',
      'kat:koy_arastirma', 'kat:koy_koruma',
      'kat:koy', 'kat:koy', 'kat:koy', 'kat:koy',
    ];
    room.settings.luckResetOnSpecial = false;
    room.beginGame();

    const ozelMi = (p) => !['koylu'].includes(p.roleId);
    const genelHavuz = ['medium', 'takipci', 'arabaci', 'canlandirici', 'baskan', 'rolhirsizi',
      'escort', 'veteran', 'kanunsuz', 'doktor', 'korumaci', 'kapanci', 'bekci', 'kahin', 'serif', 'casus'];

    // Belirlenmiş slot rolleri
    const belirli = ['jailor', 'edward', 'vampir', 'serikatil'];
    if (belirli.includes(sansli.roleId)) sansliOzel++;
    if (belirli.includes(normal.roleId)) normalOzel++;
    room.destroy();
  }

  assert.ok(
    sansliOzel > normalOzel * 1.2,
    `şanslı daha sık belirlenmiş slota düşmeli (${sansliOzel} vs ${normalOzel})`
  );
  console.log('✓ şans bonusu belirlenmiş slota düşme ihtimalini artırıyor');
}

// ── 26. ses odaları ─────────────────────────────────────────────
{
  const { room, host } = makeRoom(9, { vampir: 1, jailor: 1 });
  room.updateSettings(host.id, { firstDayTalk: true });
  room.start(host.id);
  forceRoles(room, { edward: 1, vampir: 1, jailor: 1 });
  for (const p of room.players.values()) p.voiceOn = true;
  step(room); // day1

  const jailor = by(room, 'jailor');
  const prisoner = sivil(room);
  room.setJail(jailor.id, prisoner.id);
  step(room); // night

  const edward = by(room, 'edward');
  const villager = sivil(room, [prisoner.id]);

  // Gece ses tamamen kapalı: vampir de köylü de konuşamaz.
  assert.equal(room.voiceRoomFor(edward), null, 'gece kimse konuşmaz');
  assert.equal(room.voiceRoomFor(villager), null, 'gece kimse konuşmaz');
  assert.equal(room.stateFor(villager).you.voice.peers.length, 0);
  assert.equal(room.stateFor(edward).you.voice.peers.length, 0);

  while (room.phase !== PHASE.DAY) step(room);
  assert.equal(room.voiceRoomFor(villager), 'koy');
  assert.equal(room.voiceRoomFor(edward), 'koy', 'gündüz herkes aynı odada');

  // Ölüler gündüz köyü dinler ama konuşamaz.
  villager.alive = false;
  assert.equal(room.voiceRoomFor(villager), 'koy', 'ölü de dinleyebilmeli');
  assert.equal(room.voiceCanSpeak(villager), false, 'ölü konuşamaz');
  assert.equal(room.stateFor(villager).you.voice.canSpeak, false);

  room.destroy();
  console.log('✓ ses sadece gündüz ve herkes tek odada');
}

// ── 27. hazır sistemi ve otomatik başlama ───────────────────────
{
  const room = new Room('TEST', fakeIo, { hostName: 'EMREZL' });
  clearInterval(room.timer);
  for (let i = 1; i <= 8; i++) room.addPlayer({ name: `P${i}`, socketId: `s${i}` });
  const host = room.host();
  room.updateSettings(host.id, { roles: { ...BASE, doktor: 1 } });

  const players = room.seatedPlayers();
  for (const p of players.slice(0, 7)) room.toggleReady(p.id, true);
  assert.equal(room.phaseEndsAt, null, 'herkes hazır olmadan geri sayım başlamamalı');
  assert.match(room.start(host.id).error, /Hazır olmayanlar/);

  room.toggleReady(players[7].id, true);
  assert.ok(room.phaseEndsAt, 'herkes hazır olunca geri sayım başlamalı');

  // Biri vazgeçerse iptal olur.
  room.toggleReady(players[3].id, false);
  assert.equal(room.phaseEndsAt, null, 'vazgeçince geri sayım durmalı');

  room.toggleReady(players[3].id, true);
  step(room);
  assert.equal(room.phase, PHASE.REVEAL, 'sayaç dolunca oyun başlamalı');
  room.destroy();
  console.log('✓ hazır sistemi ve otomatik başlama');
}

// ── 28. moderatör devri ─────────────────────────────────────────
{
  const { room, host } = makeRoom(8, { doktor: 1 });
  const other = room.seatedPlayers().find((p) => p.id !== host.id);

  assert.match(room.transferHost(other.id, host.id).error, /yapamazsın/i);
  assert.ok(!room.transferHost(host.id, other.id).error);
  assert.equal(other.isHost, true);
  assert.equal(host.isHost, false);
  assert.match(room.start(host.id).error, /Sadece moderatör/);
  room.destroy();
  console.log('✓ moderatörlük devredilebiliyor');
}

// ── 29. bot sistemi ─────────────────────────────────────────────
{
  const room = new Room('TEST', fakeIo, { hostName: 'EMREZL' });
  clearInterval(room.timer);
  const host = room.addPlayer({ name: 'EMREZL', socketId: 's1' }).player;

  for (let i = 0; i < 7; i++) assert.ok(!room.addBot(host.id).error);
  assert.equal(room.players.size, 8);
  assert.equal([...room.players.values()].filter((p) => p.isBot).length, 7);
  assert.equal([...room.players.values()].every((p) => p.isBot === (p.id !== host.id)), true);
  assert.equal(room.allReady(), false, 'moderatör henüz hazır değil');

  // Botlar isim ve karakter çakıştırmaz.
  const names = [...room.players.values()].map((p) => p.name);
  assert.equal(new Set(names).size, names.length);
  const chars = [...room.players.values()].map((p) => p.charId);
  assert.equal(new Set(chars).size, chars.length);

  assert.ok(!room.removeBot(host.id).error);
  assert.equal(room.players.size, 7);

  // Toplu ekleme ve doldurma
  assert.ok(!room.addBot(host.id, 4).error);
  assert.equal(room.players.size, 11);
  assert.ok(!room.addBot(host.id, 'fill').error);
  assert.equal(room.players.size, room.settings.maxPlayers);
  assert.match(room.addBot(host.id, 3).error, /dolu/);
  assert.ok(!room.removeBot(host.id, 'all').error);
  assert.equal(room.players.size, 1, 'moderatör kalmalı');
  for (let i = 0; i < 6; i++) room.addBot(host.id);

  // Oyun içinde bot eklenip çıkarılamaz.
  room.updateSettings(host.id, { roles: { ...BASE, doktor: 1 } });
  room.toggleReady(host.id, true);
  room.beginGame();
  assert.match(room.addBot(host.id).error, /Oyun sırasında/);
  assert.match(room.removeBot(host.id).error, /Oyun sırasında/);

  // Bot gece hedefini kendi seçer.
  room.updateSettings(host.id, {});
  const bot = [...room.players.values()].find((p) => p.isBot && ROLES_HAS_NIGHT(p.roleId));
  room.destroy();
  console.log('✓ bot ekleme, çıkarma, toplu doldurma');
}

// ── 30. moderatör oyuncuyu odadan atabiliyor ────────────────────
{
  const { room, host } = makeRoom(8, { doktor: 1 });
  const other = room.seatedPlayers().find((p) => p.id !== host.id);

  // Kendini atamaz, moderatör olmayan atamaz.
  assert.match(room.kickPlayer(host.id, host.id).error, /atılamaz/);
  assert.match(room.kickPlayer(other.id, host.id).error, /Sadece moderatör/);

  assert.ok(!room.kickPlayer(host.id, other.id).error);
  assert.equal(room.players.has(other.id), false);
  assert.equal(room.players.size, 7);

  // Oyun sırasında da atabilir.
  room.beginGame();
  const victim = room.seatedPlayers().find((p) => p.id !== host.id);
  assert.ok(!room.kickPlayer(host.id, victim.id).error);
  assert.equal(room.players.has(victim.id), false);

  room.destroy();
  console.log('✓ moderatör lobide ve oyun içinde oyuncu atabiliyor');
}

// ── 31. gece rolleri tıklanabilir (canActNow) ───────────────────
{
  const { room, host } = makeRoom(9, { vampir: 1, doktor: 1, kahin: 1, bekci: 1 });
  room.updateSettings(host.id, { firstDayTalk: false });
  room.start(host.id);
  step(room); // gece

  // Normal vampirin gece seçimi yok; hedefi Edward belirler.
  assert.equal(room.stateFor(by(room, 'vampir')).you.canActNow, false);

  for (const id of ['edward', 'doktor', 'kahin', 'bekci']) {
    const p = by(room, id);
    if (!p) continue;
    const view = room.stateFor(p);
    assert.equal(view.you.canActNow, true, `${id} gece hedef seçebilmeli`);
    assert.ok(view.you.nightPrompt, `${id} için gece sorusu olmalı`);
    assert.ok(view.you.targets.length > 0, `${id} için hedef listesi boş olmamalı`);
  }

  // Başkan'ın gece yeteneği yok (köylü rolü kaldırıldı).
  const baskan = by(room, 'baskan');
  if (baskan) assert.equal(room.stateFor(baskan).you.canActNow, false);

  room.destroy();
  console.log('✓ tüm gece rolleri hedef seçebiliyor');
}

// ── 32. isimler kalıcı kilitlenmiyor ────────────────────────────
{
  const room = new Room('TEST', fakeIo, { hostName: 'EMREZL' });
  clearInterval(room.timer);

  const a = room.addPlayer({ name: 'Emre', socketId: 's1' }).player;
  room.addPlayer({ name: 'Mert', socketId: 's2' });

  // Aynı anda aynı isim alınamaz.
  assert.match(room.addPlayer({ name: 'Emre', socketId: 's3' }).error, /alınmış/);
  assert.match(room.addPlayer({ name: 'emre', socketId: 's3' }).error, /alınmış/);

  // Lobide ayrılınca isim anında serbest kalır.
  room.removePlayer(a.id);
  assert.ok(room.addPlayer({ name: 'Emre', socketId: 's4' }).player, 'isim tekrar alınabilmeli');

  room.destroy();
  console.log('✓ isim sadece odada tutulurken kilitli');
}

// ── 33. oyun sürerken kopanın yeri korunur, sonra düşer ─────────
{
  const { room, host } = makeRoom(8, { doktor: 1 });
  room.beginGame();

  const other = room.seatedPlayers().find((p) => p.id !== host.id);
  const name = other.name;
  room.removePlayer(other.id);                    // bağlantı koptu

  assert.equal(room.holdsSlot(other), true, 'oyun sürerken yeri korunmalı');
  assert.equal(room.isNameTaken(name), true);

  // Oyun bitince bekleme süresi işlemeye başlar.
  room.endGame('koy', 'test');
  assert.equal(room.holdsSlot(other), true, 'hemen düşmemeli');

  other.disconnectedAt = Date.now() - 60_000;     // süre dolmuş say
  assert.equal(room.holdsSlot(other), false);
  assert.equal(room.isNameTaken(name), false, 'isim serbest kalmalı');

  room.sweepDisconnected();
  assert.equal(room.players.has(other.id), false, 'odadan düşmeli');

  room.destroy();
  console.log('✓ kopan oyuncunun yeri oyun boyunca korunuyor, sonra serbest kalıyor');
}

// ── 34. seçilen hedef istemciye düz kimlik olarak gider ────────
{
  const { room, host } = makeRoom(9, { vampir: 1, doktor: 1 });
  room.updateSettings(host.id, { firstDayTalk: false });
  room.start(host.id);
  step(room); // gece

  const doktor = by(room, 'doktor');
  const hedef = room.alivePlayers().find((p) => p.id !== doktor.id);
  room.submitNightAction(doktor.id, { targetId: hedef.id });

  const view = room.stateFor(doktor);
  assert.equal(typeof view.you.chosenTarget, 'string', 'nesne değil kimlik gitmeli');
  assert.equal(view.you.chosenTarget, hedef.id);

  room.destroy();
  console.log('✓ seçilen hedef arayüzde işaretlenebiliyor');
}

// ── 35. ölüm gece bitmeden bir saniye önce işlenir ──────────────
{
  const { room, host } = makeRoom(8, { vampir: 1 });
  room.updateSettings(host.id, { firstDayTalk: false, autoAdvance: false });
  room.start(host.id);
  step(room); // gece

  const edward = by(room, 'edward');
  const kurban = sivil(room);
  room.submitNightAction(edward.id, { targetId: kurban.id });

  // Gece bitmesine 0.5 sn kala tick
  room.phaseEndsAt = Date.now() + 500;
  room.tick();

  assert.equal(room.phase, PHASE.NIGHT, 'hâlâ gece olmalı');
  assert.equal(kurban.alive, false, 'ölüm gece içinde işlenmeli');

  // Rolü açıklanmamalı (varsayılan kapalı)
  const view = room.stateFor(sivil(room));
  const dead = view.players.find((p) => p.id === kurban.id);
  assert.equal(dead.alive, false);
  assert.equal(dead.roleId, null, 'ölenin rolü gizli kalmalı');

  room.destroy();
  console.log('✓ ölüm gecenin son saniyesinde, rol gizli');
}

// ── 36. yeniden bağlanma penceresi ──────────────────────────────
{
  const { room, host } = makeRoom(8, { doktor: 1 });
  const other = room.seatedPlayers().find((p) => p.id !== host.id);
  const token = other.token;

  // Lobide token ile geri dönüş yok: yeni ad istensin.
  room.removePlayer(other.id);
  assert.equal(room.reattach(token, 'yeni'), null, 'lobide otomatik dönüş olmamalı');

  // Oyun sürerken kopan bir dakika içinde döner.
  const { room: r2, host: h2 } = makeRoom(8, { doktor: 1 });
  r2.beginGame();
  const p2 = r2.seatedPlayers().find((p) => p.id !== h2.id);
  const t2 = p2.token;
  r2.removePlayer(p2.id);
  assert.ok(r2.reattach(t2, 'sok2'), 'oyun sürerken dönebilmeli');

  // Bir dakikayı aşarsa dönemez.
  r2.removePlayer(p2.id);
  p2.disconnectedAt = Date.now() - 90_000;
  assert.equal(r2.reattach(t2, 'sok3'), null, 'süre dolunca isim sorulmalı');

  room.destroy();
  r2.destroy();
  console.log('✓ yeniden bağlanma sadece oyun sürerken ve 1 dakika içinde');
}

// ── 37. fısıldama ───────────────────────────────────────────────
{
  const { room, host } = makeRoom(8, { doktor: 1 });
  room.updateSettings(host.id, { firstDayTalk: true });
  room.start(host.id);
  step(room); // reveal -> gündüz (ilk gün)
  assert.equal(room.phase, PHASE.DAY);

  const a = host;
  const b = room.alivePlayers().find((p) => p.id !== a.id);
  const bNo = b.cosmetic.number;

  assert.ok(!room.sendChat(a.id, `/w${bNo} gizli plan`).error);

  const fromA = room.stateFor(a).chat.filter((m) => m.channel === 'fisilti');
  const fromB = room.stateFor(b).chat.filter((m) => m.channel === 'fisilti');
  const other = room.alivePlayers().find((p) => p.id !== a.id && p.id !== b.id);
  const fromC = room.stateFor(other).chat.filter((m) => m.channel === 'fisilti');

  assert.equal(fromA.length, 1, 'gönderen görmeli');
  assert.equal(fromB.length, 1, 'alan görmeli');
  assert.equal(fromC.length, 0, 'üçüncü kişi metni görmemeli');
  assert.match(fromA[0].text, /gizli plan/);

  // Üçüncü kişi sadece "fısıldıyor" satırını görür.
  const ipucu = room.stateFor(other).chat.filter((m) => /fısıldıyor/.test(m.text));
  assert.equal(ipucu.length, 1);
  assert.equal(/gizli plan/.test(ipucu[0].text), false, 'metin sızmamalı');

  assert.match(room.sendChat(a.id, `/w${bNo}`).error ?? '', /^$|konuşamazsın/);
  assert.match(room.sendChat(a.id, '/w99 kimse').error, /yok/);
  assert.match(room.sendChat(a.id, `/w${a.cosmetic.number} ben`).error, /Kendine/);

  room.destroy();
  console.log('✓ fısıldama: metni sadece iki taraf görüyor');
}

// ── 38. veteran tetikte ─────────────────────────────────────────
{
  const { room, host } = makeRoom(8, { veteran: 1 });
  room.updateSettings(host.id, { firstDayTalk: false });
  room.start(host.id);
  step(room); // gece

  const vet = by(room, 'veteran');
  const ed = by(room, 'edward');
  const vamp = by(room, 'vampir');   // saldırıyı fiilen bu yapar, eve o gider

  assert.equal(room.usesLeft(vet), 3);
  room.submitNightAction(vet.id, {});
  room.submitNightAction(ed.id, { targetId: vet.id });
  step(room);

  assert.equal(vet.alive, true, 'tetikteyken saldırı işlemez');
  assert.equal(vamp.alive, false, 'eve giden vampir ölür');
  assert.equal(ed.alive, true, 'emri veren Edward eve gitmez');
  assert.equal(room.usesLeft(vet), 2, 'hak eksilir');

  room.destroy();
  console.log('✓ veteran tetikteyken ziyaretçiyi öldürüyor');
}

// ── 39. yetenek seçimi geri alınabiliyor ────────────────────────
{
  const { room, host } = makeRoom(8, { survivor: 1, doktor: 1 });
  room.updateSettings(host.id, { firstDayTalk: false });
  room.start(host.id);
  step(room); // gece

  const sv = by(room, 'survivor');
  room.submitNightAction(sv.id, {});
  assert.equal(room.stateFor(sv).you.chosenTarget, 'kendi');
  room.submitNightAction(sv.id, {});
  assert.equal(room.stateFor(sv).you.chosenTarget, null, 'yelekten vazgeçilebilmeli');

  const dr = by(room, 'doktor');
  const t = room.alivePlayers().find((p) => p.id !== dr.id);
  room.submitNightAction(dr.id, { targetId: t.id });
  assert.equal(room.stateFor(dr).you.chosenTarget, t.id);
  room.submitNightAction(dr.id, { targetId: t.id });
  assert.equal(room.stateFor(dr).you.chosenTarget, null, 'aynı hedefe basınca geri alınmalı');

  room.destroy();
  console.log('✓ yetenek seçimi tekrar basınca geri alınıyor');
}

// ── 40. botlar moderatör olamaz ─────────────────────────────────
{
  const room = new Room('TEST', fakeIo, { hostName: 'EMREZL' });
  clearInterval(room.timer);
  const host = room.addPlayer({ name: 'EMREZL', socketId: 's1' }).player;
  const real = room.addPlayer({ name: 'Berat', socketId: 's2' }).player;
  for (let i = 0; i < 4; i++) room.addBot(host.id);

  const bot = [...room.players.values()].find((p) => p.isBot);
  assert.match(room.transferHost(host.id, bot.id).error, /Botlar/);

  room.removePlayer(host.id);
  const yeni = [...room.players.values()].find((p) => p.isHost);
  assert.equal(yeni.isBot, false, 'moderatörlük bota geçmemeli');
  assert.equal(yeni.id, real.id);

  room.destroy();
  console.log('✓ moderatörlük botlara geçmiyor');
}

// ── 41. joker kendine oy verebilir ──────────────────────────────
{
  const { room, host } = makeRoom(8, { joker: 1 });
  room.updateSettings(host.id, { firstDayTalk: false });
  room.start(host.id);
  while (room.phase !== PHASE.VOTE) step(room);

  const joker = by(room, 'joker');
  const koylu = sivil(room);

  assert.ok(!room.submitVote(joker.id, joker.id).error, 'joker kendine oy verebilmeli');
  assert.equal(room.votes.get(joker.id), joker.id);
  assert.match(room.submitVote(koylu.id, koylu.id).error, /Kendine/);

  // Oy değiştirilebilmeli.
  assert.ok(!room.submitVote(joker.id, koylu.id).error);
  assert.equal(room.votes.get(joker.id), koylu.id);

  room.destroy();
  console.log('✓ joker kendine oy verebiliyor, oylar değiştirilebiliyor');
}

// ── 42. casus bütün fısıltıları görür ───────────────────────────
{
  const { room, host } = makeRoom(9, { casus: 1, vampir: 1 });
  room.updateSettings(host.id, { firstDayTalk: true });
  room.start(host.id);
  step(room); // gündüz

  const casus = by(room, 'casus');
  const a = room.alivePlayers().find((p) => p.id !== casus.id);
  const b = room.alivePlayers().find((p) => p.id !== casus.id && p.id !== a.id);

  room.sendChat(a.id, `/w${b.cosmetic.number} sana özel`);

  const casusGoruyor = room.stateFor(casus).chat.filter((m) => m.channel === 'fisilti');
  assert.equal(casusGoruyor.length, 1, 'casus fısıltıyı okumalı');
  assert.match(casusGoruyor[0].text, /sana özel/);

  const digeri = room.alivePlayers().find((p) => ![casus.id, a.id, b.id].includes(p.id));
  assert.equal(room.stateFor(digeri).chat.filter((m) => m.channel === 'fisilti').length, 0);

  room.destroy();
  console.log('✓ casus fısıltıları okuyabiliyor');
}

// ── 43. dolandırıcı vasiyeti değiştirebiliyor ───────────────────
{
  const { room, host } = makeRoom(9, { dolandirici: 1 });
  room.updateSettings(host.id, { firstDayTalk: false });
  room.start(host.id);
  step(room); // gece

  const dol = by(room, 'dolandirici');
  const kurban = sivil(room);
  kurban.will = 'Gerçek vasiyetim';

  room.submitNightAction(dol.id, { targetId: kurban.id, text: 'Ben vampirim' });
  // Yazarken gelen tazeleme seçimi bozmamalı.
  room.submitNightAction(dol.id, { targetId: kurban.id, text: 'Ben vampirim, kanıtı var', keep: true });
  assert.equal(room.stateFor(dol).you.chosenTarget, kurban.id, 'seçim durmalı');

  step(room);
  assert.equal(kurban.forgedWill, 'Ben vampirim, kanıtı var');
  assert.equal(room.willOf(kurban).forged, true);

  room.destroy();
  console.log('✓ dolandırıcı vasiyeti değiştiriyor, metin korunuyor');
}

// ── 44. şerif ve takipçi ────────────────────────────────────────
{
  const { room, host } = makeRoom(10, { serif: 1, takipci: 1, doktor: 1 });
  room.updateSettings(host.id, { firstDayTalk: false });
  room.start(host.id);
  step(room);

  const serif = by(room, 'serif');
  const takipci = by(room, 'takipci');
  const ed = by(room, 'edward');
  const vamp = by(room, 'vampir');
  const dr = by(room, 'doktor');
  const kurban = sivil(room);

  room.submitNightAction(serif.id, { targetId: ed.id });
  room.submitNightAction(takipci.id, { targetId: dr.id });
  room.submitNightAction(dr.id, { targetId: kurban.id });
  room.submitNightAction(ed.id, { targetId: kurban.id });
  step(room);

  assert.match(room.stateFor(serif).you.privateResult?.text ?? '', /suçsuz/, 'Edward suçsuz görünür');

  // Takipçi doktorun kime gittiğini görmeli.
  assert.match(room.stateFor(takipci).you.privateResult?.text ?? '', new RegExp(kurban.name));

  // Normal vampir suçlu görünür.
  const r2 = makeRoom(10, { serif: 1, vampir: 1 });
  r2.room.updateSettings(r2.host.id, { firstDayTalk: false });
  r2.room.start(r2.host.id);
  step(r2.room);
  const sf2 = by(r2.room, 'serif');
  const vp2 = by(r2.room, 'vampir');
  r2.room.submitNightAction(sf2.id, { targetId: vp2.id });
  step(r2.room);
  assert.match(r2.room.stateFor(sf2).you.privateResult?.text ?? '', /suçlu/);
  r2.room.destroy();

  room.destroy();
  console.log('✓ şerif Edward’ı suçsuz, vampiri suçlu görüyor; takipçi izi sürüyor');
}

// ── 45. arabacı hedefleri kaydırıyor ────────────────────────────
{
  const { room, host } = makeRoom(10, { arabaci: 1, doktor: 1 });
  room.updateSettings(host.id, { firstDayTalk: false });
  room.start(host.id);
  step(room);

  const tr = by(room, 'arabaci');
  const ed = by(room, 'edward');
  const koylular = room.alivePlayers().filter((p) => ROLES[p.roleId].team === 'koy');
  const [a, b] = koylular;

  room.submitNightAction(tr.id, { targetId: a.id, targetId2: b.id });
  room.submitNightAction(ed.id, { targetId: a.id });   // a'ya saldırı -> b'ye kayar
  step(room);

  assert.equal(a.alive, true, 'taşınan kurtulmalı');
  assert.equal(b.alive, false, 'saldırı diğerine kaymalı');
  room.destroy();
  console.log('✓ arabacı saldırıyı diğer eve kaydırıyor');
}

// ── 46. kapancı tuzağı ──────────────────────────────────────────
{
  const { room, host } = makeRoom(10, { kapanci: 1 });
  room.updateSettings(host.id, { firstDayTalk: false });
  room.start(host.id);
  step(room);

  const kp = by(room, 'kapanci');
  const ed = by(room, 'edward');
  const vamp = by(room, 'vampir');
  const kurban = sivil(room);

  assert.equal(room.usesLeft(kp), 2);
  room.submitNightAction(kp.id, { targetId: kurban.id });
  room.submitNightAction(ed.id, { targetId: kurban.id });
  step(room);

  assert.equal(vamp.alive, false, 'tuzağa giren vampir ölmeli');
  assert.equal(room.usesLeft(kp), 1);
  room.destroy();
  console.log('✓ kapancı tuzağı ziyaretçiyi öldürüyor');
}

// ── 47. susturucu ertesi gün konuşturmuyor ──────────────────────
{
  const { room, host } = makeRoom(10, { susturucu: 1 });
  room.updateSettings(host.id, { firstDayTalk: false });
  room.start(host.id);
  step(room);

  const sz = by(room, 'susturucu');
  const kurban = sivil(room);
  room.submitNightAction(sz.id, { targetId: kurban.id });
  while (room.phase !== PHASE.DAY) step(room);

  assert.equal(room.chatChannelFor(kurban), null, 'susturulan yazamaz');
  const baskasi = sivil(room, [kurban.id]);
  assert.ok(room.chatChannelFor(baskasi), 'diğerleri yazabilir');
  room.destroy();
  console.log('✓ susturucu hedefini ertesi gün susturuyor');
}

// ── 48. medyum ölülerle konuşuyor ───────────────────────────────
{
  const { room, host } = makeRoom(10, { medium: 1 });
  room.updateSettings(host.id, { firstDayTalk: false });
  room.start(host.id);
  step(room);

  const md = by(room, 'medium');
  const olu = sivil(room);
  olu.alive = false;

  assert.equal(room.chatChannelFor(md), 'seans');
  assert.equal(room.chatChannelFor(olu), 'seans');

  room.sendChat(olu.id, 'Beni vampir öldürdü');
  const mdGorur = room.stateFor(md).chat.filter((m) => m.channel === 'seans');
  assert.equal(mdGorur.length, 1);
  const digeri = room.alivePlayers().find((p) => p.id !== md.id);
  assert.equal(room.stateFor(digeri).chat.filter((m) => m.channel === 'seans').length, 0);
  room.destroy();
  console.log('✓ medyum ölülerle seans yapıyor');
}

// ── 49. iftiracı hedefini astırınca kazanıyor ───────────────────
{
  const { room, host } = makeRoom(10, { iftiraci: 1 });
  room.updateSettings(host.id, { firstDayTalk: false });
  room.start(host.id);

  const ex = by(room, 'iftiraci');
  assert.ok(ex.execTargetId, 'hedef atanmalı');
  const hedef = room.players.get(ex.execTargetId);
  assert.notEqual(ROLES[hedef.roleId].team, 'vampir', 'hedef köy tarafı olmalı');

  while (room.phase !== PHASE.VOTE) step(room);
  for (const p of room.alivePlayers()) if (p.id !== hedef.id) room.submitVote(p.id, hedef.id);
  while (room.phase === PHASE.VOTE) step(room);
  while (room.phase === PHASE.TRIAL) step(room);
  for (const p of room.alivePlayers()) if (p.id !== hedef.id) room.submitJudgement(p.id, true);
  while (![PHASE.END].includes(room.phase) && room.phase !== PHASE.NIGHT) step(room);

  assert.equal(room.phase, PHASE.END);
  assert.equal(room.result.winner, 'iftiraci');
  room.destroy();
  console.log('✓ iftiracı hedefini astırınca kazanıyor');
}

// ── 50. koruma canıyla durduruyor ───────────────────────────────
{
  const { room, host } = makeRoom(10, { korumaci: 1 });
  room.updateSettings(host.id, { firstDayTalk: false });
  room.start(host.id);
  step(room);

  const bg = by(room, 'korumaci');
  const ed = by(room, 'edward');
  const vamp = by(room, 'vampir');
  const hedef = sivil(room);

  room.submitNightAction(bg.id, { targetId: hedef.id });
  room.submitNightAction(ed.id, { targetId: hedef.id });
  step(room);

  assert.equal(hedef.alive, true, 'korunan yaşamalı');
  assert.equal(bg.alive, false, 'koruma ölmeli');
  assert.equal(vamp.alive, false, 'saldırgan da ölmeli');
  room.destroy();
  console.log('✓ koruma saldırganla birlikte ölüyor, hedefi kurtuluyor');
}

// ── 51. yer değiştiren uzaktan çalışıyor ────────────────────────
{
  const { room, host } = makeRoom(10, { arabaci: 1, kapanci: 1 });
  room.updateSettings(host.id, { firstDayTalk: false });
  room.start(host.id);
  step(room);

  const tr = by(room, 'arabaci');
  const kp = by(room, 'kapanci');
  const [a, b] = room.alivePlayers().filter((p) => ROLES[p.roleId].team === 'koy');

  room.submitNightAction(kp.id, { targetId: a.id });     // a evine tuzak
  room.submitNightAction(tr.id, { targetId: a.id, targetId2: b.id });
  step(room);

  assert.equal(tr.alive, true, 'uzaktan taşıdığı için tuzağa düşmemeli');
  room.destroy();
  console.log('✓ yer değiştiren eve gitmiyor, tuzağa yakalanmıyor');
}

// ── 52. şerif: seri katil ve joker masum görünür ────────────────
{
  const { room, host } = makeRoom(12, { serif: 1, serikatil: 1, joker: 1, jigolo: 1 });
  room.updateSettings(host.id, { firstDayTalk: false });
  room.start(host.id);
  step(room);

  const sf = by(room, 'serif');
  const bak = (t) => {
    room.night.actions.clear();
    room.submitNightAction(sf.id, { targetId: t.id });
    room.resolveNight();
    return room.night.results.get(sf.id)?.text ?? '';
  };

  assert.match(bak(by(room, 'serikatil')), /suçsuz/, 'seri katil masum görünür');
  assert.match(bak(by(room, 'joker')), /suçsuz/, 'joker masum görünür');
  assert.match(bak(by(room, 'edward')), /suçsuz/, 'Edward masum görünür');
  assert.match(bak(by(room, 'jigolo')), /suçlu/, 'diğer vampirler suçlu görünür');

  room.destroy();
  console.log('✓ şerif doğru kişileri suçlu gösteriyor');
}

// ── 53. slot kurulumunda köylü çıkmaz ──────────────────────────
{
  for (const n of [10, 13, 16]) {
    const room = new Room('TEST', fakeIo, { hostName: 'EMREZL' });
    clearInterval(room.timer);
    for (let i = 1; i <= n; i++) room.addPlayer({ name: `P${i}`, socketId: `s${i}` });
    const host = room.host();

    assert.ok(!room.autoBalance(host.id).error);
    assert.equal(room.settings.slots.length, n, `${n} oyuncuya ${n} slot`);
    assert.equal(room.roleCheck().ok, true, `${n} kişilik slot listesi geçerli olmalı`);

    room.beginGame();
    const roller = [...room.players.values()].map((p) => p.roleId);
    assert.equal(roller.filter((r) => r === 'koylu').length, 0, 'slot kurulumunda köylü olmamalı');
    assert.equal(new Set(roller).size >= n - 2, true, 'roller büyük ölçüde benzersiz olmalı');
    assert.equal(roller.filter((r) => r === 'edward').length, 1, 'tek Edward');
    assert.ok(roller.includes('jailor'), 'gardiyan her oyunda');

    room.destroy();
  }
  console.log('✓ slot kurulumu: köylü yok, gardiyan ve Edward her oyunda');
}

// ── 54. kategori slotları doğru havuzdan seçiyor ────────────────
{
  const room = new Room('TEST', fakeIo, { hostName: 'EMREZL' });
  clearInterval(room.timer);
  for (let i = 1; i <= 10; i++) room.addPlayer({ name: `P${i}`, socketId: `s${i}` });
  const host = room.host();

  room.setSlots(host.id, [
    'rol:jailor', 'rol:edward', 'rol:vampir', 'rol:serikatil',
    'kat:koy_arastirma', 'kat:koy_arastirma', 'kat:koy_koruma',
    'kat:koy_destek', 'kat:neutral', 'kat:vampir',
  ]);
  assert.equal(room.roleCheck().ok, true);

  const ARASTIRMA = ['bekci', 'kahin', 'serif', 'takipci', 'casus'];
  const KORUMA = ['doktor', 'korumaci', 'kapanci'];

  for (let i = 0; i < 200; i++) {
    room.beginGame();
    const roller = [...room.players.values()].map((p) => p.roleId);
    assert.equal(roller.filter((r) => ARASTIRMA.includes(r)).length, 2, 'her oyunda 2 araştırmacı');
    assert.equal(roller.filter((r) => KORUMA.includes(r)).length, 1, 'her oyunda 1 koruyucu');
    assert.equal(roller.filter((r) => r === 'serikatil').length, 1);
  }

  room.destroy();
  console.log('✓ kategori slotları her oyunda doğru sayıda rol veriyor');
}

// ── 55. sahtekâr masumu suçlu gösteriyor ───────────────────────
{
  const { room, host } = makeRoom(11, { sahtekar: 1, serif: 1 });
  room.updateSettings(host.id, { firstDayTalk: false });
  room.start(host.id);
  step(room);

  const fr = by(room, 'sahtekar');
  const sf = by(room, 'serif');
  const masum = sivil(room, [sf.id]);

  room.submitNightAction(fr.id, { targetId: masum.id });
  room.submitNightAction(sf.id, { targetId: masum.id });
  step(room);

  assert.match(room.stateFor(sf).you.privateResult?.text ?? '', /suçlu/, 'damgalı suçlu görünür');
  room.destroy();
  console.log('✓ sahtekâr şerifi yanıltıyor');
}

// ── 56. tuzak hem öldürüyor hem koruyor ────────────────────────
{
  const { room, host } = makeRoom(10, { kapanci: 1 });
  room.updateSettings(host.id, { firstDayTalk: false });
  room.start(host.id);
  step(room);

  const kp = by(room, 'kapanci');
  const ed = by(room, 'edward');
  const vamp = by(room, 'vampir');
  const hedef = sivil(room, [kp.id]);

  room.submitNightAction(kp.id, { targetId: hedef.id });
  room.submitNightAction(ed.id, { targetId: hedef.id });
  step(room);

  assert.equal(vamp.alive, false, 'tuzağa giren ölmeli');
  assert.equal(hedef.alive, true, 'tuzak ev sahibini korumalı');
  room.destroy();
  console.log('✓ tuzak saldırganı öldürüp hedefi kurtarıyor');
}

// ── 57. seri katil engelleyeni öldürüyor ───────────────────────
{
  const { room, host } = makeRoom(11, { serikatil: 1, escort: 1 });
  room.updateSettings(host.id, { firstDayTalk: false });
  room.start(host.id);
  step(room);

  const sk = by(room, 'serikatil');
  const es = by(room, 'escort');
  const kurban = sivil(room, [es.id]);

  room.submitNightAction(es.id, { targetId: sk.id });
  room.submitNightAction(sk.id, { targetId: kurban.id });
  step(room);

  assert.equal(es.alive, false, 'engellemeye gelen ölmeli');
  assert.equal(kurban.alive, false, 'engel işlememeli, hedef yine ölmeli');
  room.destroy();
  console.log('✓ seri katil engelleyeni öldürüyor ve işini yapıyor');
}

// ── 58. ilan eden başkan iyileştirilemez ───────────────────────
{
  const { room, host } = makeRoom(11, { baskan: 1, doktor: 1 });
  room.updateSettings(host.id, { firstDayTalk: false });
  room.start(host.id);
  while (room.phase !== PHASE.DAY) step(room);

  const bk = by(room, 'baskan');
  const dr = by(room, 'doktor');
  room.revealPresident(bk.id);
  assert.equal(bk.presidentRevealed, true);

  while (room.phase !== PHASE.NIGHT) step(room);
  const ed = by(room, 'edward');
  room.submitNightAction(dr.id, { targetId: bk.id });
  room.submitNightAction(ed.id, { targetId: bk.id });
  step(room);

  assert.equal(bk.alive, false, 'ilan eden başkan iyileştirilemez');
  room.destroy();
  console.log('✓ ilan eden başkanı doktor koruyamıyor');
}

// ── 59. Edward gece bağışıklığı ────────────────────────────────
{
  const { room, host } = makeRoom(11, { kanunsuz: 1 });
  room.updateSettings(host.id, { firstDayTalk: false });
  room.start(host.id);
  step(room);

  const kn = by(room, 'kanunsuz');
  const ed = by(room, 'edward');
  room.submitNightAction(kn.id, { targetId: ed.id });
  step(room);

  assert.equal(ed.alive, true, 'Edward gece saldırısından ölmez');
  const mesaj = room.stateFor(kn).you.privateResult?.text ?? '';
  assert.match(mesaj, /korunuyordu/, 'sebep sızmamalı, koruma mesajı verilmeli');
  assert.equal(/bağışık|immune/i.test(mesaj), false, 'bağışıklık kelimesi geçmemeli');

  room.destroy();
  console.log('✓ Edward gece bağışıklı, sebep sızmıyor');
}

// ── 60. kanunsuz masum vurursa ertesi gece ölüyor ──────────────
{
  const { room, host } = makeRoom(11, { kanunsuz: 1 });
  room.updateSettings(host.id, { firstDayTalk: false });
  room.start(host.id);
  step(room);

  const kn = by(room, 'kanunsuz');
  const masum = sivil(room, [kn.id]);
  room.submitNightAction(kn.id, { targetId: masum.id });
  step(room);

  assert.equal(masum.alive, false, 'masum vuruldu');
  assert.equal(kn.alive, true, 'kanunsuz o gece yaşar');
  assert.equal(kn.vigilanteGuilt, true, 'pişmanlık işaretlenmeli');

  while (room.phase !== PHASE.NIGHT) step(room);
  step(room);
  assert.equal(kn.alive, false, 'ertesi gece suçluluktan ölmeli');

  room.destroy();
  console.log('✓ kanunsuz masum vurunca ertesi gece ölüyor');
}

// ── 61. günde iki oylama turu ──────────────────────────────────
{
  const { room, host } = makeRoom(10, {});
  room.updateSettings(host.id, { firstDayTalk: false });
  room.start(host.id);
  while (room.phase !== PHASE.VOTE) step(room);

  assert.equal(room.trialsToday, 1);
  step(room);                       // kimse oylanmadı -> sonuç
  assert.equal(room.phase, PHASE.VOTE_RESULT);
  step(room);                       // ikinci tur açılmalı
  assert.equal(room.phase, PHASE.VOTE, 'ikinci oylama turu açılmalı');
  assert.equal(room.trialsToday, 2);

  step(room);
  step(room);
  assert.equal(room.phase, PHASE.NIGHT, 'üçüncü tur yok, gece gelir');

  room.destroy();
  console.log('✓ günde iki oylama turu, sonra gece');
}

console.log('\nHepsi geçti.');
