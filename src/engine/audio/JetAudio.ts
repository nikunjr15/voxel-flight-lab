import type { AircraftConfig } from '../../aircraft/types';

/** What an engine sounds like, reduced to the few numbers the synth uses. */
export interface EngineVoice {
  /** Turbojets are higher and harsher; turbofans deeper and smoother. */
  kind: 'turbojet' | 'turbofan';
  afterburner: boolean;
  /** Two engines beat slightly against each other. */
  count: number;
}

export const voiceFor = (c: AircraftConfig): EngineVoice => {
  const t = c.spec.engines.type;
  return {
    kind: t === 'turbojet' || t === 'afterburning-turbojet' ? 'turbojet' : 'turbofan',
    afterburner: t.startsWith('afterburning'),
    count: c.spec.engines.count,
  };
};

/** Targets for one voice at idle (0) and full thrust (1). */
interface Tuning {
  roarHz: [number, number];
  roarQ: number;
  roarGain: [number, number];
  whineHz: [number, number];
  whineType: OscillatorType;
  whineGain: [number, number];
  rumbleHz: number;
  rumbleGain: [number, number];
}

// Levels are deliberately low. The master stage below adds a further cut and
// a limiter, so nothing here can reach the speakers loud.
const TUNING: Record<EngineVoice['kind'], Tuning> = {
  // Centrifugal and early axial jets: a narrow, high roar and a scream on top.
  turbojet: {
    roarHz: [950, 2300],
    roarQ: 1.1,
    roarGain: [0.025, 0.2],
    whineHz: [1900, 3500],
    whineType: 'sawtooth',
    whineGain: [0.004, 0.022],
    rumbleHz: 150,
    rumbleGain: [0.02, 0.16],
  },
  // Bypass air rounds everything off: lower, broader, more weight underneath.
  turbofan: {
    roarHz: [380, 950],
    roarQ: 0.6,
    roarGain: [0.025, 0.18],
    whineHz: [700, 1350],
    whineType: 'triangle',
    whineGain: [0.003, 0.012],
    rumbleHz: 95,
    rumbleGain: [0.03, 0.26],
  },
};

/** Master level when sound is on. Conservative; the limiter catches the rest. */
const MASTER = 0.42;

/**
 * Synthesised engine sound: Web Audio only, no files.
 *
 *   noise -> band-pass  -> roar   \
 *   noise -> low-pass   -> rumble  > master -> limiter -> speakers
 *   2 oscillators -> band-pass -> whine /
 *
 * Every level change is a ramp with a time constant of at least 50 ms, so
 * nothing ever starts with a click or a jump. The context is created on the
 * first call to start(), which must come from a user gesture.
 */
export class JetAudio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private meterNode!: AnalyserNode;
  private noise!: AudioBuffer;
  private roarFilter!: BiquadFilterNode;
  private roarGain!: GainNode;
  private rumbleGain!: GainNode;
  private rumbleFilter!: BiquadFilterNode;
  private whineFilter!: BiquadFilterNode;
  private whineGain!: GainNode;
  private oscs: OscillatorNode[] = [];
  private voice: EngineVoice = { kind: 'turbofan', afterburner: true, count: 1 };
  private thrust = 0;
  private on = false;
  private suspendTimer = 0;

  get running(): boolean {
    return this.on;
  }

  /** Call from a click or key handler: browsers only allow audio after one. */
  start(): void {
    window.clearTimeout(this.suspendTimer);
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.build(this.ctx);
    }
    void this.ctx.resume();
    this.on = true;
    this.apply(0.5);
    this.master.gain.setTargetAtTime(MASTER, this.ctx.currentTime, 0.35);
  }

  stop(): void {
    const ctx = this.ctx;
    this.on = false;
    if (!ctx) return;
    this.master.gain.setTargetAtTime(0, ctx.currentTime, 0.12);
    window.clearTimeout(this.suspendTimer);
    this.suspendTimer = window.setTimeout(() => {
      if (!this.on) void ctx.suspend();
    }, 900);
  }

  setVoice(v: EngineVoice): void {
    const changed = v.kind !== this.voice.kind || v.count !== this.voice.count;
    this.voice = v;
    if (!this.ctx) return;
    if (changed) for (const o of this.oscs) o.type = TUNING[v.kind].whineType;
    this.apply(0.4);
  }

  /** Thrust ramps pitch, volume and rumble over about two seconds. */
  setThrust(on: boolean): void {
    this.thrust = on ? 1 : 0;
    this.apply(on ? 0.65 : 0.5);
  }

  /** A soft band-passed rush of air, for the voxel morph. */
  whoosh(): void {
    const ctx = this.live();
    if (!ctx) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 0.8;
    bp.frequency.setValueAtTime(320, t);
    bp.frequency.exponentialRampToValueAtTime(1700, t + 0.45);
    bp.frequency.exponentialRampToValueAtTime(420, t + 1.1);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.setTargetAtTime(0.09, t, 0.12);
    g.gain.setTargetAtTime(0, t + 0.5, 0.22);
    src.connect(bp).connect(g).connect(this.master);
    src.start(t, Math.random() * 1.5);
    src.stop(t + 1.8);
  }

  /** A short, quiet tick for toolbar presses. */
  tick(): void {
    const ctx = this.live();
    if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(1850, t);
    const g = ctx.createGain();
    // A 4 ms rise rather than an instant start: no click under the tick.
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.035, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.08);
  }

  /** The flyby's sonic boom: a low double thump, softened at the front. */
  boom(): void {
    const ctx = this.live();
    if (!ctx) return;
    const t = ctx.currentTime;
    for (const [at, level] of [
      [0, 0.32],
      [0.11, 0.24],
    ] as const) {
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(260, t + at);
      lp.frequency.exponentialRampToValueAtTime(60, t + at + 1.2);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t + at);
      g.gain.setTargetAtTime(level, t + at, 0.02);
      g.gain.setTargetAtTime(0, t + at + 0.08, 0.45);
      src.connect(lp).connect(g).connect(this.master);
      src.start(t + at, Math.random() * 1.5);
      src.stop(t + at + 2.6);
    }
  }

  /** Peak and RMS of what is going out, in dBFS. Review builds read this. */
  meter(): { peak: number; rms: number } {
    if (!this.ctx) return { peak: -Infinity, rms: -Infinity };
    const buf = new Float32Array(this.meterNode.fftSize);
    this.meterNode.getFloatTimeDomainData(buf);
    let peak = 0;
    let sum = 0;
    for (const v of buf) {
      peak = Math.max(peak, Math.abs(v));
      sum += v * v;
    }
    const db = (x: number) => (x > 0 ? 20 * Math.log10(x) : -Infinity);
    return { peak: db(peak), rms: db(Math.sqrt(sum / buf.length)) };
  }

  dispose(): void {
    window.clearTimeout(this.suspendTimer);
    void this.ctx?.close();
    this.ctx = null;
  }

  private live(): AudioContext | null {
    return this.on && this.ctx && this.ctx.state === 'running' ? this.ctx : null;
  }

  private build(ctx: AudioContext): void {
    // Two seconds of white noise, looped: the raw material for roar, rumble,
    // whoosh and boom alike.
    this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    this.master = ctx.createGain();
    this.master.gain.value = 0;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -20;
    limiter.knee.value = 6;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.25;
    this.meterNode = ctx.createAnalyser();
    this.meterNode.fftSize = 2048;
    this.master.connect(limiter).connect(this.meterNode).connect(ctx.destination);

    const bed = ctx.createBufferSource();
    bed.buffer = this.noise;
    bed.loop = true;

    this.roarFilter = ctx.createBiquadFilter();
    this.roarFilter.type = 'bandpass';
    this.roarGain = ctx.createGain();
    this.roarGain.gain.value = 0;
    bed.connect(this.roarFilter).connect(this.roarGain).connect(this.master);

    this.rumbleFilter = ctx.createBiquadFilter();
    this.rumbleFilter.type = 'lowpass';
    this.rumbleGain = ctx.createGain();
    this.rumbleGain.gain.value = 0;
    bed.connect(this.rumbleFilter).connect(this.rumbleGain).connect(this.master);

    this.whineFilter = ctx.createBiquadFilter();
    this.whineFilter.type = 'bandpass';
    this.whineFilter.Q.value = 5;
    this.whineGain = ctx.createGain();
    this.whineGain.gain.value = 0;
    this.whineFilter.connect(this.whineGain).connect(this.master);
    for (let i = 0; i < 2; i++) {
      const o = ctx.createOscillator();
      o.type = TUNING[this.voice.kind].whineType;
      o.connect(this.whineFilter);
      o.start();
      this.oscs.push(o);
    }
    bed.start();
  }

  /** Moves every parameter toward the current voice and thrust. */
  private apply(timeConstant: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const k = this.thrust;
    const tune = TUNING[this.voice.kind];
    const mix = (r: [number, number]) => r[0] + (r[1] - r[0]) * k;
    // Afterburner: more roar and a heavier floor, not a different sound.
    const ab = this.voice.afterburner ? 1 + 0.25 * k : 1;
    this.roarFilter.frequency.setTargetAtTime(mix(tune.roarHz), t, timeConstant);
    this.roarFilter.Q.setTargetAtTime(tune.roarQ, t, timeConstant);
    this.roarGain.gain.setTargetAtTime(mix(tune.roarGain) * ab, t, timeConstant);
    this.rumbleFilter.frequency.setTargetAtTime(tune.rumbleHz, t, timeConstant);
    this.rumbleGain.gain.setTargetAtTime(mix(tune.rumbleGain) * ab, t, timeConstant);
    const whine = mix(tune.whineHz);
    this.whineFilter.frequency.setTargetAtTime(whine, t, timeConstant);
    this.whineGain.gain.setTargetAtTime(mix(tune.whineGain), t, timeConstant);
    // Two engines run a few cents apart and beat; one engine, the pair sits
    // close enough to read as a single tone.
    const spread = this.voice.count > 1 ? 9 : 2;
    this.oscs.forEach((o, i) => {
      o.frequency.setTargetAtTime(whine, t, timeConstant);
      o.detune.setTargetAtTime(i === 0 ? -spread : spread, t, timeConstant);
    });
  }
}
