export interface EqualizerBands {
  bass: number; // -12 to +12 dB (120Hz lowshelf)
  mids: number; // -12 to +12 dB (1000Hz peaking)
  treble: number; // -12 to +12 dB (6000Hz highshelf)
}

export interface EqualizerProfile {
  id: string;
  name: string;
  bands: EqualizerBands;
  isBuiltIn?: boolean;
}

export interface EqualizerConfig {
  enabled: boolean;
  activeProfileId: string;
  bands: EqualizerBands;
  customProfiles: EqualizerProfile[];
}

export const BUILTIN_EQ_PROFILES: EqualizerProfile[] = [
  { id: 'flat', name: 'Flat', bands: { bass: 0, mids: 0, treble: 0 }, isBuiltIn: true },
  { id: 'bass-boost', name: 'Bass Boost', bands: { bass: 7, mids: -1, treble: 1 }, isBuiltIn: true },
  { id: 'vocal', name: 'Vocal Clarity', bands: { bass: -2, mids: 5, treble: 3 }, isBuiltIn: true },
  { id: 'warm', name: 'Acoustic Warmth', bands: { bass: 3, mids: 2, treble: 1 }, isBuiltIn: true },
  { id: 'treble', name: 'Treble Sparkle', bands: { bass: 0, mids: 1, treble: 6 }, isBuiltIn: true },
  { id: 'late-night', name: 'Late Night', bands: { bass: 4, mids: -2, treble: -3 }, isBuiltIn: true },
];

export const DEFAULT_EQUALIZER_CONFIG: EqualizerConfig = {
  enabled: true,
  activeProfileId: 'flat',
  bands: { bass: 0, mids: 0, treble: 0 },
  customProfiles: [],
};

export function clampEqDb(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(-12, Math.min(12, Math.round(value * 2) / 2));
}

class WebAudioEqualizerService {
  private audioCtx: AudioContext | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private attachedElement: HTMLAudioElement | null = null;
  private bassFilter: BiquadFilterNode | null = null;
  private midsFilter: BiquadFilterNode | null = null;
  private trebleFilter: BiquadFilterNode | null = null;
  private limiter: DynamicsCompressorNode | null = null;
  private currentConfig: EqualizerConfig = { ...DEFAULT_EQUALIZER_CONFIG };

  private ensureContextAndFilters(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return null;

    if (!this.audioCtx) {
      try {
        this.audioCtx = new AudioCtx();
        this.bassFilter = this.audioCtx.createBiquadFilter();
        this.bassFilter.type = 'lowshelf';
        this.bassFilter.frequency.value = 120;

        this.midsFilter = this.audioCtx.createBiquadFilter();
        this.midsFilter.type = 'peaking';
        this.midsFilter.frequency.value = 1000;
        this.midsFilter.Q.value = 1.0;

        this.trebleFilter = this.audioCtx.createBiquadFilter();
        this.trebleFilter.type = 'highshelf';
        this.trebleFilter.frequency.value = 6000;

        this.limiter = this.audioCtx.createDynamicsCompressor();
        this.limiter.threshold.value = -3;
        this.limiter.ratio.value = 6;

        this.bassFilter.connect(this.midsFilter);
        this.midsFilter.connect(this.trebleFilter);
        this.trebleFilter.connect(this.limiter);
        this.limiter.connect(this.audioCtx.destination);

        this.syncFilterGains();
      } catch {
        this.audioCtx = null;
      }
    }

    return this.audioCtx;
  }

  public attachAudioElement(audio: HTMLAudioElement): boolean {
    if (this.attachedElement === audio && this.sourceNode) {
      return true;
    }

    const ctx = this.ensureContextAndFilters();
    if (!ctx || !this.bassFilter) return false;

    try {
      this.sourceNode = ctx.createMediaElementSource(audio);
      this.sourceNode.connect(this.bassFilter);
      this.attachedElement = audio;
      this.syncFilterGains();
      return true;
    } catch {
      return false;
    }
  }

  public async resumeIfSuspended(): Promise<void> {
    const ctx = this.ensureContextAndFilters();
    if (ctx && ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {}
    }
  }

  public applyConfig(config: EqualizerConfig): void {
    this.currentConfig = {
      ...config,
      bands: {
        bass: clampEqDb(config.bands.bass),
        mids: clampEqDb(config.bands.mids),
        treble: clampEqDb(config.bands.treble),
      },
    };
    this.syncFilterGains();
  }

  private syncFilterGains(): void {
    const ctx = this.audioCtx;
    if (!ctx || !this.bassFilter || !this.midsFilter || !this.trebleFilter) return;

    const now = ctx.currentTime;
    const bass = this.currentConfig.enabled ? this.currentConfig.bands.bass : 0;
    const mids = this.currentConfig.enabled ? this.currentConfig.bands.mids : 0;
    const treble = this.currentConfig.enabled ? this.currentConfig.bands.treble : 0;

    this.bassFilter.gain.setTargetAtTime(bass, now, 0.02);
    this.midsFilter.gain.setTargetAtTime(mids, now, 0.02);
    this.trebleFilter.gain.setTargetAtTime(treble, now, 0.02);
  }

  public getStatus(): {
    supported: boolean;
    contextState: string;
    hasMediaSource: boolean;
  } {
    const supported =
      typeof window !== 'undefined' &&
      Boolean(window.AudioContext || (window as any).webkitAudioContext);
    return {
      supported,
      contextState: this.audioCtx?.state || 'ready',
      hasMediaSource: Boolean(this.sourceNode),
    };
  }

  /**
   * Computes exact logarithmic frequency response points (20Hz - 20kHz)
   * using Web Audio API BiquadFilterNode.getFrequencyResponse when available.
   */
  public computeFrequencyResponse(
    config: EqualizerConfig,
    numPoints = 44
  ): Array<{ hz: number; db: number }> {
    const freqs = new Float32Array(numPoints);
    const minLog = Math.log10(20);
    const maxLog = Math.log10(20000);
    for (let i = 0; i < numPoints; i++) {
      const ratio = i / (numPoints - 1);
      freqs[i] = Math.pow(10, minLog + ratio * (maxLog - minLog));
    }

    if (!config.enabled) {
      return Array.from(freqs).map((hz) => ({ hz, db: 0 }));
    }

    const ctx = this.ensureContextAndFilters();
    if (ctx && this.bassFilter && this.midsFilter && this.trebleFilter) {
      try {
        // Create temporary detached filter nodes matching the target config for pure preview
        const fBass = ctx.createBiquadFilter();
        fBass.type = 'lowshelf';
        fBass.frequency.value = 120;
        fBass.gain.value = config.bands.bass;

        const fMids = ctx.createBiquadFilter();
        fMids.type = 'peaking';
        fMids.frequency.value = 1000;
        fMids.Q.value = 1.0;
        fMids.gain.value = config.bands.mids;

        const fTreble = ctx.createBiquadFilter();
        fTreble.type = 'highshelf';
        fTreble.frequency.value = 6000;
        fTreble.gain.value = config.bands.treble;

        const magBass = new Float32Array(numPoints);
        const magMids = new Float32Array(numPoints);
        const magTreble = new Float32Array(numPoints);
        const phase = new Float32Array(numPoints);

        fBass.getFrequencyResponse(freqs, magBass, phase);
        fMids.getFrequencyResponse(freqs, magMids, phase);
        fTreble.getFrequencyResponse(freqs, magTreble, phase);

        return Array.from(freqs).map((hz, i) => {
          const totalMag = Math.max(0.0001, magBass[i] * magMids[i] * magTreble[i]);
          const db = 20 * Math.log10(totalMag);
          return { hz, db: Math.max(-14, Math.min(14, db)) };
        });
      } catch {
        // Fallback below
      }
    }

    // Pure math approximation fallback (used in Node unit tests or before AudioContext init)
    return Array.from(freqs).map((hz) => {
      const logF = Math.log10(hz);
      const bassContrib = config.bands.bass * (1 / (1 + Math.exp((logF - Math.log10(220)) * 5)));
      const midsContrib =
        config.bands.mids * Math.exp(-Math.pow((logF - Math.log10(1000)) / 0.45, 2));
      const trebleContrib = config.bands.treble * (1 / (1 + Math.exp((Math.log10(3500) - logF) * 5)));
      return {
        hz,
        db: Math.max(-14, Math.min(14, bassContrib + midsContrib + trebleContrib)),
      };
    });
  }
}

export const webAudioEqualizer = new WebAudioEqualizerService();
