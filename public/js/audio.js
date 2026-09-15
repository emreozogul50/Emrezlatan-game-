// Oyun sesi: gece gergin müzik, gündüz sakin müzik, sabah kısa jingle.
// Tarayıcılar kullanıcı etkileşimi olmadan ses çalmaya izin vermez;
// bu yüzden ilk tıklamada devreye girer.

const TRACKS = {
  night: '/assets/audio/night.mp3',
  day: '/assets/audio/day.mp3',
};
const STING = '/assets/audio/morning.mp3';

const FADE_MS = 900;

export class GameAudio {
  constructor() {
    this.volume = Number(localStorage.getItem('vk_vol') ?? 0.45);
    this.ducked = false;      // sesli sohbet açıkken müzik kısılır
    this.muted = localStorage.getItem('vk_mute') === '1';
    this.started = false;
    this.current = null;
    this.loops = {};
    this.fades = {};

    for (const [key, src] of Object.entries(TRACKS)) {
      const a = new Audio(src);
      a.loop = true;
      a.preload = 'auto';
      a.volume = 0;
      this.loops[key] = a;
    }

    // Sabah sesi. Gerçek horoz kaydın varsa morning.mp3 dosyasının üzerine yaz.
    this.sting = new Audio(STING);

    // İlk kullanıcı hareketinde sesi başlat.
    const kick = () => {
      this.started = true;
      if (this.current) this.play(this.current);
      window.removeEventListener('pointerdown', kick);
      window.removeEventListener('keydown', kick);
    };
    window.addEventListener('pointerdown', kick, { once: true });
    window.addEventListener('keydown', kick, { once: true });
  }

  get target() {
    if (this.muted) return 0;
    return this.ducked ? this.volume * 0.18 : this.volume;
  }

  /**
   * Sesli sohbet açıkken müziği kıs.
   * iOS'ta çalan bir <audio> ses oturumunu ele geçirip gelen WebRTC sesini
   * bastırabiliyor; kısmak bunu da azaltıyor.
   */
  setDucked(on) {
    if (this.ducked === !!on) return;
    this.ducked = !!on;
    if (this.current) this.fadeTo(this.loops[this.current], this.target, 400);
  }

  setVolume(v) {
    this.volume = Math.min(1, Math.max(0, v));
    localStorage.setItem('vk_vol', String(this.volume));
    if (this.current && !this.muted) this.fadeTo(this.loops[this.current], this.target);
  }

  setMuted(on) {
    this.muted = !!on;
    localStorage.setItem('vk_mute', this.muted ? '1' : '0');
    for (const [key, a] of Object.entries(this.loops)) {
      this.fadeTo(a, key === this.current ? this.target : 0);
    }
  }

  /** İki parça arasında yumuşak geçiş. */
  fadeTo(audio, to, ms = FADE_MS) {
    clearInterval(this.fades[audio.src]);
    const from = audio.volume;
    const steps = Math.max(1, Math.round(ms / 40));
    let i = 0;

    this.fades[audio.src] = setInterval(() => {
      i++;
      audio.volume = Math.min(1, Math.max(0, from + (to - from) * (i / steps)));
      if (i >= steps) {
        clearInterval(this.fades[audio.src]);
        if (audio.volume === 0) audio.pause();
      }
    }, 40);

    if (to > 0 && audio.paused) audio.play().catch(() => {});
  }

  play(key) {
    this.current = key;
    if (!this.started) return;

    for (const [k, a] of Object.entries(this.loops)) {
      if (k === key) {
        if (a.paused) a.play().catch(() => {});
        this.fadeTo(a, this.target);
      } else {
        this.fadeTo(a, 0);
      }
    }
  }

  /** Sabah sesi. */
  playMorning() {
    if (!this.started || this.muted) return;
    const a = this.sting;
    a.volume = Math.min(1, this.volume * 1.2);
    a.currentTime = 0;
    a.play().catch(() => {});
  }

  /** Oyun durumuna göre doğru parçayı seçer. */
  syncPhase(phase) {
    const night = phase === 'night' || phase === 'night_result';
    const want = night ? 'night' : 'day';

    if (this.lastPhase !== phase) {
      // Geceden güne geçiş: sabah sesi
      const wasNight = this.lastPhase === 'night' || this.lastPhase === 'night_result';
      if (wasNight && !night) this.playMorning();
      this.lastPhase = phase;
    }

    if (this.current !== want) this.play(want);
  }

  stop() {
    for (const a of Object.values(this.loops)) this.fadeTo(a, 0, 400);
    this.current = null;
  }
}
