// Procedural WebAudio soundscape: snow carving, high-speed wind, chimes & subtle alpine ambient BGM.
export class SnowAudio {
  private ctx: AudioContext | null = null;
  private carveGain: GainNode | null = null;
  private carveFilter: BiquadFilterNode | null = null;
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private bgmFilter: BiquadFilterNode | null = null;
  private bgmGain: GainNode | null = null;
  private bgmTimer: number | null = null;
  private bgmStep = 0;
  private bgmMode: "off" | "lobby" | "run" = "off";
  private bgmAir = false;
  private bgmFever = false;

  unlock() {
    if (typeof window === "undefined") return;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;
    if (!this.ctx) {
      try {
        const ctx = new AudioCtx();
        const length = ctx.sampleRate * 2;
        const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;

        const carveSrc = ctx.createBufferSource();
        carveSrc.buffer = buffer;
        carveSrc.loop = true;
        const carveFilter = ctx.createBiquadFilter();
        carveFilter.type = "bandpass";
        carveFilter.frequency.value = 1200;
        carveFilter.Q.value = 1.4;
        const carveGain = ctx.createGain();
        carveGain.gain.value = 0;
        carveSrc.connect(carveFilter).connect(carveGain).connect(ctx.destination);
        carveSrc.start();

        const windSrc = ctx.createBufferSource();
        windSrc.buffer = buffer;
        windSrc.loop = true;
        const windFilter = ctx.createBiquadFilter();
        windFilter.type = "lowpass";
        windFilter.frequency.value = 380;
        windFilter.Q.value = 0.8;
        const windGain = ctx.createGain();
        windGain.gain.value = 0;
        windSrc.connect(windFilter).connect(windGain).connect(ctx.destination);
        windSrc.start();

        const bgmFilter = ctx.createBiquadFilter();
        bgmFilter.type = "lowpass";
        bgmFilter.frequency.value = 1100;
        const bgmGain = ctx.createGain();
        bgmGain.gain.value = 0;
        bgmFilter.connect(bgmGain).connect(ctx.destination);

        this.ctx = ctx;
        this.carveGain = carveGain;
        this.carveFilter = carveFilter;
        this.windGain = windGain;
        this.windFilter = windFilter;
        this.bgmFilter = bgmFilter;
        this.bgmGain = bgmGain;
        this.startBgmLoop();
      } catch {
        return;
      }
    }
    if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
  }

  private startBgmLoop() {
    if (this.bgmTimer !== null || typeof window === "undefined") return;
    // Nordic alpine pentatonic chill-pulse (D minor / F major ambient)
    const lobbyNotes = [293.66, 349.23, 440.0, 523.25, 440.0, 349.23, 392.0, 329.63];
    const runNotes = [293.66, 440.0, 523.25, 587.33, 523.25, 440.0, 392.0, 440.0];
    const bassNotes = [146.83, 146.83, 174.61, 174.61, 130.81, 130.81, 110.0, 130.81];
    this.bgmTimer = window.setInterval(() => {
      if (!this.ctx || !this.bgmFilter || this.ctx.state !== "running" || this.bgmMode === "off")
        return;
      const now = this.ctx.currentTime;
      const step = this.bgmStep++ % 8;
      const isRun = this.bgmMode === "run";
      const freq = (isRun ? runNotes : lobbyNotes)[step] * (this.bgmFever ? 1.122 : 1);

      // Gentle melodic pluck
      const osc = this.ctx.createOscillator();
      const env = this.ctx.createGain();
      osc.type = isRun ? "triangle" : "sine";
      osc.frequency.setValueAtTime(freq, now);
      const peak = isRun ? 0.024 : 0.016;
      env.gain.setValueAtTime(0.0001, now);
      env.gain.exponentialRampToValueAtTime(peak, now + 0.025);
      env.gain.exponentialRampToValueAtTime(0.0001, now + (isRun ? 0.24 : 0.42));
      osc.connect(env).connect(this.bgmFilter);
      osc.start(now);
      osc.stop(now + (isRun ? 0.26 : 0.45));

      // Warm sub-bass pulse on even steps while riding
      if (isRun && step % 2 === 0) {
        const bass = this.ctx.createOscillator();
        const bEnv = this.ctx.createGain();
        bass.type = "sine";
        bass.frequency.setValueAtTime(bassNotes[step], now);
        bEnv.gain.setValueAtTime(0.0001, now);
        bEnv.gain.exponentialRampToValueAtTime(0.032, now + 0.02);
        bEnv.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
        bass.connect(bEnv).connect(this.bgmFilter);
        bass.start(now);
        bass.stop(now + 0.32);
      }
    }, 340);
  }

  updateBgm(enabled: boolean, mode: "off" | "lobby" | "run", air = false, fever = false) {
    this.bgmMode = enabled ? mode : "off";
    this.bgmAir = air;
    this.bgmFever = fever;
    if (!this.ctx || !this.bgmGain || !this.bgmFilter) return;
    const now = this.ctx.currentTime;
    const targetGain = !enabled || mode === "off" ? 0 : mode === "run" ? 0.9 : 0.65;
    const targetCut = air ? 420 : fever ? 2400 : mode === "run" ? 1500 : 950;
    this.bgmGain.gain.setTargetAtTime(targetGain, now, 0.12);
    this.bgmFilter.frequency.setTargetAtTime(targetCut, now, 0.1);
  }

  update(
    enabled: boolean,
    active: boolean,
    speed: number,
    air: boolean,
    braking: boolean,
    crashing: boolean,
  ) {
    if (!this.ctx || !this.carveGain || !this.carveFilter || !this.windGain || !this.windFilter)
      return;
    const now = this.ctx.currentTime;
    if (!enabled || !active) {
      this.carveGain.gain.setTargetAtTime(0, now, 0.05);
      this.windGain.gain.setTargetAtTime(0, now, 0.08);
      return;
    }
    const kmh = speed * 3.6;
    const carveVol = air
      ? 0
      : Math.min(
          0.11,
          (Math.max(0, kmh - 15) / 80) * (braking ? 0.11 : crashing ? 0.09 : 0.042),
        );
    const carveFreq = braking ? 2100 : crashing ? 850 : 950 + Math.min(1200, kmh * 12);
    this.carveGain.gain.setTargetAtTime(carveVol, now, air ? 0.03 : 0.06);
    this.carveFilter.frequency.setTargetAtTime(carveFreq, now, 0.06);

    const windVol = Math.min(0.065, Math.max(0, (kmh - 42) / 55) * (air ? 0.065 : 0.045));
    const windFreq = 260 + Math.min(720, Math.max(0, kmh - 35) * 11);
    this.windGain.gain.setTargetAtTime(windVol, now, 0.09);
    this.windFilter.frequency.setTargetAtTime(windFreq, now, 0.09);
  }

  playChime(enabled: boolean, grade: string, combo: number) {
    if (!enabled || !this.ctx || this.ctx.state !== "running") return;
    if (grade !== "完美" && grade !== "干净") return;
    const now = this.ctx.currentTime;
    const scale = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];
    const base = scale[Math.min(scale.length - 1, Math.max(0, combo))];
    const notes = grade === "完美" ? [base, base * 1.25, base * 1.5] : [base];
    notes.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now + idx * 0.045);
      gain.gain.setValueAtTime(0.0001, now + idx * 0.045);
      gain.gain.exponentialRampToValueAtTime(
        grade === "完美" ? 0.055 : 0.035,
        now + idx * 0.045 + 0.02,
      );
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.045 + 0.28);
      osc.connect(gain).connect(this.ctx!.destination);
      osc.start(now + idx * 0.045);
      osc.stop(now + idx * 0.045 + 0.3);
    });
  }

  playGateChime(enabled: boolean, hits: number) {
    if (!enabled || !this.ctx || this.ctx.state !== "running") return;
    const now = this.ctx.currentTime;
    const freq = 587.33 * (1 + Math.min(5, Math.max(0, hits - 1)) * 0.12);
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.25, now + 0.08);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.045, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.18);
  }
}
