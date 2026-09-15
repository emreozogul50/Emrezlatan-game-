// Sesli sohbet. Mesh WebRTC: herkes aynı odadakilerle doğrudan bağlanır.
// Sunucu ses taşımaz, sadece bağlantı kurulurken sinyalleri iletir.
//
// Gizlilik: istemci SADECE sunucunun bildirdiği ses odasındaki kişilerle
// bağlantı kurar. Gece köylüye vampir sesi hiç gönderilmez, kapatılmaz —
// bağlantı zaten kurulmaz.

const SPEAK_THRESHOLD = 0.022;
const SPEAK_HOLD_MS = 320;

export class VoiceClient {
  constructor({ socket, onUpdate, onProblem }) {
    this.socket = socket;
    this.onUpdate = onUpdate ?? (() => {});
    this.onProblem = onProblem ?? (() => {});
    this.failed = 0;          // kaç bağlantı kurulamadı
    this.connected = 0;       // kaç bağlantı kuruldu

    this.myId = null;
    this.ice = [{ urls: ['stun:stun.l.google.com:19302'] }];
    this.stream = null;
    this.muted = false;
    this.active = false;

    this.peers = new Map(); // peerId -> { pc, audio, analyser, buf, lastLoud }
    this.speaking = new Set();
    this.localMeter = null;
    this.audioCtx = null;
    this.loop = null;

    socket.on('voice:signal', (msg) => this.handleSignal(msg));
  }

  setIceServers(list) {
    if (Array.isArray(list) && list.length) this.ice = list;
  }

  // ── açma / kapama ────────────────────────────────────────

  async enable(myId) {
    this.myId = myId;
    if (this.active) return;

    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Tarayıcın mikrofonu desteklemiyor. HTTPS bağlantı gerekli.');
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
    } catch (err) {
      if (err.name === 'NotAllowedError') throw new Error('Mikrofon izni verilmedi.');
      if (err.name === 'NotFoundError') throw new Error('Mikrofon bulunamadı.');
      throw new Error('Mikrofon açılamadı: ' + err.message);
    }

    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.audioCtx.state === 'suspended') await this.audioCtx.resume();
    this.localMeter = this.makeMeter(this.stream);

    this.active = true;
    this.startMeterLoop();
    this.socket.emit('voice:on', { on: true }, () => {});
    this.onUpdate();
  }

  disable() {
    for (const id of [...this.peers.keys()]) this.dropPeer(id);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;

    if (this.loop) cancelAnimationFrame(this.loop);
    this.loop = null;
    this.localMeter = null;
    this.audioCtx?.close().catch(() => {});
    this.audioCtx = null;

    this.speaking.clear();
    this.active = false;
    this.socket.emit('voice:on', { on: false }, () => {});
    this.onUpdate();
  }

  setMuted(muted) {
    this.muted = muted;
    this.stream?.getAudioTracks().forEach((t) => (t.enabled = !muted));
    if (muted) this.speaking.delete(this.myId);
    this.onUpdate();
  }

  // ── eş yönetimi ──────────────────────────────────────────

  /** Sunucudan gelen listeye göre bağlantıları kurar ve kapatır. */
  sync(peerIds) {
    if (!this.active) {
      if (this.peers.size) for (const id of [...this.peers.keys()]) this.dropPeer(id);
      return;
    }

    const wanted = new Set(peerIds ?? []);

    for (const id of [...this.peers.keys()]) {
      if (!wanted.has(id)) this.dropPeer(id);
    }

    for (const id of wanted) {
      if (this.peers.has(id)) continue;
      // Çakışmayı önlemek için teklifi her zaman id'si küçük olan başlatır.
      this.connect(id, this.myId < id);
    }
  }

  connect(peerId, initiator) {
    const pc = new RTCPeerConnection({ iceServers: this.ice });
    const entry = { pc, audio: null, meter: null, lastLoud: 0, queue: [], retried: false, state: 'yeni' };
    this.peers.set(peerId, entry);

    for (const track of this.stream.getTracks()) pc.addTrack(track, this.stream);

    pc.onicecandidate = (e) => {
      if (e.candidate) this.send(peerId, { type: 'ice', candidate: e.candidate });
    };

    pc.ontrack = (e) => {
      const [stream] = e.streams;
      if (!stream) return;

      const audio = document.createElement('audio');
      audio.srcObject = stream;
      audio.autoplay = true;
      audio.playsInline = true;
      audio.dataset.peer = peerId;
      document.body.appendChild(audio);
      audio.play().catch(() => {});

      entry.audio = audio;
      entry.meter = this.makeMeter(stream);
      this.onUpdate();
    };

    pc.onconnectionstatechange = () => {
      entry.state = pc.connectionState;

      if (pc.connectionState === 'connected') {
        this.connected++;
        this.onUpdate();
        return;
      }

      if (pc.connectionState === 'failed') {
        // Bir kere ICE'i yeniden dene; çoğu kopma böyle toparlanır.
        if (!entry.retried && typeof pc.restartIce === 'function') {
          entry.retried = true;
          entry.state = 'yeniden deneniyor';
          try {
            pc.restartIce();
          } catch {
            this.giveUp(peerId);
          }
          this.onUpdate();
          return;
        }
        this.giveUp(peerId);
        return;
      }

      if (pc.connectionState === 'closed') this.dropPeer(peerId);
      this.onUpdate();
    };

    if (initiator) {
      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .then(() => this.send(peerId, { type: 'offer', sdp: pc.localDescription }))
        .catch(() => this.dropPeer(peerId));
    }

    return entry;
  }

  /** Bağlantı kurulamadı: bırak ve sebebini bildir. */
  giveUp(peerId) {
    this.failed++;
    this.dropPeer(peerId);
    if (this.failed === 1 && this.connected === 0) {
      this.onProblem(
        'Ses bağlantısı kurulamadı. Mobil veride ve bazı ev ağlarında TURN sunucusu gerekiyor.'
      );
    }
  }

  /** Bağlantı sağlığı: kaç eş bağlandı, kaçı kurulamadı. */
  health() {
    let ok = 0;
    let kuruluyor = 0;
    for (const e of this.peers.values()) {
      if (e.pc?.connectionState === 'connected') ok++;
      else kuruluyor++;
    }
    return { ok, kuruluyor, basarisiz: this.failed };
  }

  dropPeer(peerId) {
    const entry = this.peers.get(peerId);
    if (!entry) return;
    try {
      entry.pc.close();
    } catch {}
    entry.audio?.remove();
    this.peers.delete(peerId);
    this.speaking.delete(peerId);
    this.onUpdate();
  }

  send(peerId, data) {
    this.socket.emit('voice:signal', { to: peerId, data }, () => {});
  }

  async handleSignal({ from, data }) {
    if (!this.active) return;

    let entry = this.peers.get(from);
    if (!entry) {
      if (data.type !== 'offer') return;
      entry = this.connect(from, false);
    }

    const pc = entry.pc;

    try {
      if (data.type === 'offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        for (const c of entry.queue.splice(0)) await pc.addIceCandidate(c).catch(() => {});
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        this.send(from, { type: 'answer', sdp: pc.localDescription });
      } else if (data.type === 'answer') {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        for (const c of entry.queue.splice(0)) await pc.addIceCandidate(c).catch(() => {});
      } else if (data.type === 'ice') {
        const candidate = new RTCIceCandidate(data.candidate);
        // Uzak taraf henüz hazır değilse adayları biriktir.
        if (pc.remoteDescription?.type) await pc.addIceCandidate(candidate).catch(() => {});
        else entry.queue.push(candidate);
      }
    } catch {
      this.dropPeer(from);
    }
  }

  // ── konuşma göstergesi ───────────────────────────────────

  makeMeter(stream) {
    if (!this.audioCtx) return null;
    const source = this.audioCtx.createMediaStreamSource(stream);
    const analyser = this.audioCtx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.4;
    source.connect(analyser);
    return { analyser, buf: new Uint8Array(analyser.fftSize) };
  }

  level(meter) {
    if (!meter) return 0;
    meter.analyser.getByteTimeDomainData(meter.buf);
    let sum = 0;
    for (let i = 0; i < meter.buf.length; i++) {
      const v = (meter.buf[i] - 128) / 128;
      sum += v * v;
    }
    return Math.sqrt(sum / meter.buf.length);
  }

  startMeterLoop() {
    let lastEmit = 0;

    const tick = (now) => {
      if (!this.active) return;
      this.loop = requestAnimationFrame(tick);
      if (now - lastEmit < 120) return;
      lastEmit = now;

      const before = this.speaking.size;
      const mark = (id, loud, entry) => {
        if (loud) {
          entry.lastLoud = now;
          this.speaking.add(id);
        } else if (now - entry.lastLoud > SPEAK_HOLD_MS) {
          this.speaking.delete(id);
        }
      };

      if (this.localMeter && !this.muted) {
        this.localSelf ??= { lastLoud: 0 };
        mark(this.myId, this.level(this.localMeter) > SPEAK_THRESHOLD, this.localSelf);
      }

      for (const [id, entry] of this.peers) {
        if (!entry.meter) continue;
        mark(id, this.level(entry.meter) > SPEAK_THRESHOLD, entry);
      }

      if (before !== this.speaking.size) this.onUpdate();
    };

    this.loop = requestAnimationFrame(tick);
  }

  status() {
    return {
      active: this.active,
      muted: this.muted,
      connected: this.peers.size,
      speaking: this.speaking,
    };
  }
}
