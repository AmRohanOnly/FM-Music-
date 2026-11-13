import React, { useState, useMemo } from 'react';
import { Sliders, Plus, Trash2, RotateCcw, Check } from 'lucide-react';
import {
  BUILTIN_EQ_PROFILES,
  EqualizerConfig,
  EqualizerProfile,
  clampEqDb,
  webAudioEqualizer,
} from '../services/webAudioEqualizer';

interface EqualizerPanelProps {
  config: EqualizerConfig;
  onChange: (next: EqualizerConfig) => void;
  onNotify?: (msg: string) => void;
}

function formatDb(db: number): string {
  if (db === 0) return '0 dB';
  return `${db > 0 ? '+' : ''}${db % 1 === 0 ? db.toFixed(0) : db.toFixed(1)} dB`;
}

export function EqualizerPanel({ config, onChange, onNotify }: EqualizerPanelProps) {
  const [profileName, setProfileName] = useState('');

  const allProfiles: EqualizerProfile[] = useMemo(
    () => [...BUILTIN_EQ_PROFILES, ...config.customProfiles],
    [config.customProfiles]
  );

  const responsePoints = useMemo(
    () => webAudioEqualizer.computeFrequencyResponse(config, 44),
    [config]
  );

  // Build SVG path for logarithmic 20Hz..20kHz curve (-14dB..+14dB)
  const { linePath, areaPath } = useMemo(() => {
    const width = 320;
    const height = 96;
    const minDb = -14;
    const maxDb = 14;

    const coords = responsePoints.map((pt, i) => {
      const x = (i / (responsePoints.length - 1)) * width;
      const normY = (pt.db - minDb) / (maxDb - minDb);
      const y = height - normY * height;
      return { x, y };
    });

    const line = coords
      .map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
      .join(' ');
    const area = `${line} L ${width} ${height / 2} L 0 ${height / 2} Z`;
    return { linePath: line, areaPath: area };
  }, [responsePoints]);

  const updateBand = (band: 'bass' | 'mids' | 'treble', value: number) => {
    webAudioEqualizer.resumeIfSuspended().catch(() => {});
    const clamped = clampEqDb(value);
    onChange({
      ...config,
      enabled: true,
      activeProfileId: 'custom-manual',
      bands: {
        ...config.bands,
        [band]: clamped,
      },
    });
  };

  const applyProfile = (profile: EqualizerProfile) => {
    webAudioEqualizer.resumeIfSuspended().catch(() => {});
    onChange({
      ...config,
      enabled: true,
      activeProfileId: profile.id,
      bands: { ...profile.bands },
    });
    onNotify?.(`Equalizer profile: ${profile.name}`);
  };

  const handleSaveCustomProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = profileName.trim();
    if (!trimmed) return;
    const newProfile: EqualizerProfile = {
      id: `eq_custom_${Date.now()}`,
      name: trimmed,
      bands: { ...config.bands },
    };
    onChange({
      ...config,
      enabled: true,
      activeProfileId: newProfile.id,
      customProfiles: [...config.customProfiles, newProfile],
    });
    setProfileName('');
    onNotify?.(`Saved sound profile "${trimmed}"`);
  };

  const handleDeleteCustomProfile = (id: string) => {
    const nextProfiles = config.customProfiles.filter((p) => p.id !== id);
    onChange({
      ...config,
      activeProfileId: config.activeProfileId === id ? 'flat' : config.activeProfileId,
      customProfiles: nextProfiles,
    });
  };

  const handleResetFlat = () => {
    onChange({
      ...config,
      enabled: true,
      activeProfileId: 'flat',
      bands: { bass: 0, mids: 0, treble: 0 },
    });
    onNotify?.('Equalizer reset to Flat');
  };

  const eqStatus = webAudioEqualizer.getStatus();

  return (
    <div className="space-y-4">
      {/* Header & Enable Toggle */}
      <div className="liquid-glass rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-[var(--fm-accent)]" />
            <div>
              <h4 className="text-sm font-bold">Web Audio Equalizer</h4>
              <p className="text-xs text-[var(--fm-text-muted)]">
                3-band BiquadFilterNode DSP (120Hz • 1kHz • 6kHz)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleResetFlat}
              className="min-h-9 px-2.5 rounded-xl liquid-glass-button text-xs font-semibold text-[var(--fm-text-muted)] hover:text-[var(--fm-text)] flex items-center gap-1 cursor-pointer"
              title="Reset bands to 0 dB"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
            <button
              onClick={() => {
                webAudioEqualizer.resumeIfSuspended().catch(() => {});
                onChange({ ...config, enabled: !config.enabled });
              }}
              className={`min-h-9 px-3.5 rounded-full text-xs font-bold cursor-pointer transition-colors ${
                config.enabled
                  ? 'bg-[var(--fm-accent)] text-[var(--fm-accent-fg)]'
                  : 'liquid-glass-button text-[var(--fm-text-muted)]'
              }`}
            >
              {config.enabled ? 'On' : 'Bypassed'}
            </button>
          </div>
        </div>

        {/* Live Frequency Response Curve (Web Audio BiquadFilterNode) */}
        <div className="p-3 rounded-xl bg-[var(--fm-input-bg)] border border-[var(--fm-glass-border)]">
          <svg viewBox="0 0 320 96" className="w-full h-24 overflow-visible">
            <defs>
              <linearGradient id="eqCurveGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--fm-accent)" stopOpacity="0.32" />
                <stop offset="100%" stopColor="var(--fm-accent)" stopOpacity="0.02" />
              </linearGradient>
            </defs>
            {/* 0 dB centerline */}
            <line
              x1="0"
              y1="48"
              x2="320"
              y2="48"
              stroke="var(--fm-glass-border)"
              strokeDasharray="4 4"
              strokeWidth="1"
            />
            <path d={areaPath} fill="url(#eqCurveGrad)" />
            <path
              d={linePath}
              fill="none"
              stroke={config.enabled ? 'var(--fm-accent)' : 'var(--fm-text-muted)'}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div className="flex justify-between text-[10px] font-mono text-[var(--fm-text-muted)] mt-1">
            <span>20Hz</span>
            <span>120Hz (Bass)</span>
            <span>1kHz (Mids)</span>
            <span>6kHz (Treble)</span>
            <span>20kHz</span>
          </div>
        </div>

        {/* Bass, Mids, Treble Frequency Band Sliders */}
        <div className="space-y-3 pt-1">
          {[
            { key: 'bass' as const, label: 'Bass', sub: '120 Hz Lowshelf', val: config.bands.bass },
            { key: 'mids' as const, label: 'Mids', sub: '1.0 kHz Peaking', val: config.bands.mids },
            { key: 'treble' as const, label: 'Treble', sub: '6.0 kHz Highshelf', val: config.bands.treble },
          ].map((band) => (
            <div key={band.key} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold">{band.label}</span>
                  <span className="text-[var(--fm-text-muted)] ml-1.5">{band.sub}</span>
                </div>
                <span className="font-mono font-bold text-[var(--fm-accent)] tabular-nums">
                  {formatDb(band.val)}
                </span>
              </div>
              <input
                type="range"
                min={-12}
                max={12}
                step={0.5}
                value={band.val}
                onChange={(e) => updateBand(band.key, Number(e.target.value))}
                className="w-full fm-range"
                aria-label={`${band.label} gain`}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Sound Profiles (Built-in + User Saved Custom Profiles) */}
      <div className="liquid-glass rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold">Sound Profiles</h4>
          <span className="text-xs text-[var(--fm-text-muted)]">
            {allProfiles.length} profiles
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {allProfiles.map((profile) => {
            const isActive = config.enabled && config.activeProfileId === profile.id;
            return (
              <div
                key={profile.id}
                className={`rounded-xl flex items-center justify-between transition-all ${
                  isActive
                    ? 'bg-[var(--fm-accent)] text-[var(--fm-accent-fg)] font-bold'
                    : 'liquid-glass-button text-[var(--fm-text)]'
                }`}
              >
                <button
                  onClick={() => applyProfile(profile)}
                  className="flex-1 min-h-10 px-3 py-2 text-left text-xs truncate cursor-pointer flex items-center gap-1.5"
                >
                  {isActive && <Check className="w-3.5 h-3.5 shrink-0" />}
                  <span className="truncate">{profile.name}</span>
                </button>
                {!profile.isBuiltIn && (
                  <button
                    onClick={() => handleDeleteCustomProfile(profile.id)}
                    className={`w-8 h-8 mr-1 rounded-lg flex items-center justify-center shrink-0 cursor-pointer ${
                      isActive
                        ? 'hover:bg-black/15 text-[var(--fm-accent-fg)]'
                        : 'hover:bg-red-500/20 text-[var(--fm-text-muted)] hover:text-red-400'
                    }`}
                    title={`Delete ${profile.name}`}
                    aria-label={`Delete ${profile.name}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Save Current Curve as Custom Sound Profile */}
        <form onSubmit={handleSaveCustomProfile} className="flex items-center gap-2 pt-1">
          <input
            type="text"
            value={profileName}
            onChange={(e) => setProfileName(e.target.value)}
            placeholder="Save custom profile name (e.g. Late Drive)..."
            className="flex-1 h-10 px-3 rounded-xl liquid-glass-input text-xs text-[var(--fm-text)] placeholder-[var(--fm-text-muted)]/60 focus:outline-none focus:border-[var(--fm-accent)]"
          />
          <button
            type="submit"
            disabled={!profileName.trim()}
            className="h-10 px-3.5 rounded-xl bg-[var(--fm-accent)] text-[var(--fm-accent-fg)] font-bold text-xs flex items-center gap-1 disabled:opacity-40 cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Save</span>
          </button>
        </form>

        <p className="text-[11px] text-[var(--fm-text-muted)] leading-relaxed">
          Web Audio graph: {eqStatus.supported ? `${eqStatus.contextState} • 3 BiquadFilterNodes + Limiter` : 'Not supported'}. Applies directly to CORS-enabled audio streams; embedded YouTube frames are sandboxed by browser security policy.
        </p>
      </div>
    </div>
  );
}
