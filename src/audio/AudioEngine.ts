// Síntesis procedural con Web Audio API (cero archivos externos):
// - Rotor principal: ruido marrón filtrado modulado en amplitud (AM) a frecuencia de paso de pala (N_blades * Ω / 2π) -> "whop-whop"
// - Turbina Turboméca Arriel: armónicos senoidales agudos ligados a RPM y torque
// - Viento aerodinámico proporcional a airSpeed
// - Alarma de bajas RPM / descenso excesivo cerca del suelo
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  private bladeNoiseFilter: BiquadFilterNode | null = null;
  private bladeAmGain: GainNode | null = null;
  private bladeLfo: OscillatorNode | null = null;
  private bladeLfoDepth: GainNode | null = null;

  private turbineOsc: OscillatorNode | null = null;
  private turbineGain: GainNode | null = null;

  private windFilter: BiquadFilterNode | null = null;
  private windGain: GainNode | null = null;

  private warningOsc: OscillatorNode | null = null;
  private warningGain: GainNode | null = null;

  private muted = false;
  private masterVolume = 0.55;

  ensureStarted(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      return;
    }
    if (typeof window === 'undefined') return;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    this.ctx = ctx;

    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = this.muted ? 0 : this.masterVolume;
    this.masterGain.connect(ctx.destination);

    // Buffer de ruido rosa/marrón de 2 segundos para rotor y viento
    const bufferSize = ctx.sampleRate * 2;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      data[i] = (lastOut + 0.045 * white) / 1.045;
      lastOut = data[i];
      data[i] *= 2.8;
    }

    // 1. Cadena Rotor "Whop-Whop"
    const rotorNoise = ctx.createBufferSource();
    rotorNoise.buffer = noiseBuffer;
    rotorNoise.loop = true;

    this.bladeNoiseFilter = ctx.createBiquadFilter();
    this.bladeNoiseFilter.type = 'bandpass';
    this.bladeNoiseFilter.frequency.value = 115;
    this.bladeNoiseFilter.Q.value = 1.4;

    this.bladeAmGain = ctx.createGain();
    this.bladeAmGain.gain.value = 0;

    this.bladeLfo = ctx.createOscillator();
    this.bladeLfo.type = 'sine';
    this.bladeLfo.frequency.value = 19.5; // 3 palas * ~6.5 Hz

    this.bladeLfoDepth = ctx.createGain();
    this.bladeLfoDepth.gain.value = 0;

    this.bladeLfo.connect(this.bladeLfoDepth);
    this.bladeLfoDepth.connect(this.bladeAmGain.gain);

    rotorNoise.connect(this.bladeNoiseFilter);
    this.bladeNoiseFilter.connect(this.bladeAmGain);
    this.bladeAmGain.connect(this.masterGain);

    rotorNoise.start();
    this.bladeLfo.start();

    // 2. Cadena Turbina
    this.turbineOsc = ctx.createOscillator();
    this.turbineOsc.type = 'triangle';
    this.turbineOsc.frequency.value = 520;

    const turbFilter = ctx.createBiquadFilter();
    turbFilter.type = 'bandpass';
    turbFilter.frequency.value = 950;
    turbFilter.Q.value = 2.5;

    this.turbineGain = ctx.createGain();
    this.turbineGain.gain.value = 0;

    this.turbineOsc.connect(turbFilter);
    turbFilter.connect(this.turbineGain);
    this.turbineGain.connect(this.masterGain);
    this.turbineOsc.start();

    // 3. Cadena Viento
    const windSource = ctx.createBufferSource();
    windSource.buffer = noiseBuffer;
    windSource.loop = true;

    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'highpass';
    this.windFilter.frequency.value = 380;

    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;

    windSource.connect(this.windFilter);
    this.windFilter.connect(this.windGain);
    this.windGain.connect(this.masterGain);
    windSource.start();

    // 4. Alarma de cabina (sink rate / low RPM)
    this.warningOsc = ctx.createOscillator();
    this.warningOsc.type = 'square';
    this.warningOsc.frequency.value = 880;
    this.warningGain = ctx.createGain();
    this.warningGain.gain.value = 0;
    this.warningOsc.connect(this.warningGain);
    this.warningGain.connect(this.masterGain);
    this.warningOsc.start();
  }

  setVolume(vol: number): void {
    this.masterVolume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx && !this.muted) {
      this.masterGain.gain.setTargetAtTime(this.masterVolume, this.ctx.currentTime, 0.05);
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : this.masterVolume, this.ctx.currentTime, 0.04);
    }
  }

  isMuted(): boolean {
    return this.muted;
  }

  update(params: {
    rotorOmega: number;
    nominalOmega: number;
    blades: number;
    collective: number;
    airSpeedMs: number;
    sinkRateWarning: boolean;
    paused: boolean;
  }): void {
    if (!this.ctx || !this.bladeAmGain || !this.bladeLfo || !this.bladeLfoDepth || !this.bladeNoiseFilter) {
      return;
    }

    const t = this.ctx.currentTime;
    if (params.paused) {
      this.bladeAmGain.gain.setTargetAtTime(0, t, 0.06);
      this.bladeLfoDepth.gain.setTargetAtTime(0, t, 0.06);
      this.turbineGain?.gain.setTargetAtTime(0, t, 0.06);
      this.windGain?.gain.setTargetAtTime(0, t, 0.06);
      this.warningGain?.gain.setTargetAtTime(0, t, 0.04);
      return;
    }

    const rpmRatio = Math.max(0, Math.min(1.1, params.rotorOmega / params.nominalOmega));
    // Frecuencia de paso de pala: (Ω / 2π) * blades
    const bladePassFreq = Math.max(1.5, (params.rotorOmega / (Math.PI * 2)) * params.blades);
    this.bladeLfo.frequency.setTargetAtTime(bladePassFreq, t, 0.05);

    const loadFactor = 0.45 + params.collective * 0.75;
    const baseRotorVol = rpmRatio * rpmRatio * 0.34 * loadFactor;
    this.bladeAmGain.gain.setTargetAtTime(baseRotorVol, t, 0.06);
    this.bladeLfoDepth.gain.setTargetAtTime(baseRotorVol * 0.78, t, 0.06);
    this.bladeNoiseFilter.frequency.setTargetAtTime(85 + rpmRatio * 95 + params.collective * 55, t, 0.08);

    // Turbina
    this.turbineOsc?.frequency.setTargetAtTime(220 + rpmRatio * 590 + params.collective * 60, t, 0.08);
    this.turbineGain?.gain.setTargetAtTime(rpmRatio * 0.045, t, 0.08);

    // Viento
    const speedRatio = Math.min(1, params.airSpeedMs / 55);
    this.windGain?.gain.setTargetAtTime(speedRatio * speedRatio * 0.18, t, 0.1);
    this.windFilter?.frequency.setTargetAtTime(320 + speedRatio * 550, t, 0.1);

    // Alarma intermitente
    if (params.sinkRateWarning) {
      const beep = Math.sin(t * 18) > 0 ? 0.055 : 0;
      this.warningGain?.gain.setTargetAtTime(beep, t, 0.015);
    } else {
      this.warningGain?.gain.setTargetAtTime(0, t, 0.03);
    }
  }

  playPing(high = true): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(high ? 880 : 587.33, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(high ? 1318.5 : 880, this.ctx.currentTime + 0.14);

    gain.gain.setValueAtTime(0.14, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.28);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.3);
  }

  dispose(): void {
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }
}
