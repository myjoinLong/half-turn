// Procedural WebAudio soundscape for carving snow, high-speed wind, and combo chimes.
export class SnowAudio {
  private ctx: AudioContext | null = null;
  private carveGain: GainNode | null = null;
  private carveFilter: BiquadFilterNode | null = null;
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;

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

        this.ctx = ctx;
        this.carveGain = carveGain;
        this.carveFilter = carveFilter;
        this.windGain = windGain;
        this.windFilter = windFilter;
      } catch {
        return;
      }
    }
    if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
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
}
