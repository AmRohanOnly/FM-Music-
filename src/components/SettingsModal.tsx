import React, { useState, useRef } from 'react';
import {
  X,
  Palette,
  Download,
  Upload,
  Copy,
  Check,
  Heart,
  ListMusic,
  HardDrive,
  SlidersHorizontal,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  FileJson,
  Sun,
  Moon,
  Sparkles,
  Gauge,
  Disc3,
  AudioWaveform,
  FileText,
  Clock,
  Sliders,
  Shuffle,
} from 'lucide-react';
import { EqualizerPanel } from './EqualizerPanel';
import { Track } from '../data/musicCatalog';
import {
  THEMES,
  ThemeId,
  UserPlaylist,
  FmMusicBackup,
  PlayerCustomization,
  GlassPreset,
  ArtworkStyle,
  LyricsProviderPreference,
  buildBackupPayload,
  downloadBackupFile,
  parseBackupJson,
} from '../services/libraryStore';

export type RestoreMode = 'merge' | 'replace';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTheme: ThemeId;
  onSelectTheme: (themeId: ThemeId) => void;
  customization: PlayerCustomization;
  onUpdateCustomization: (patch: Partial<PlayerCustomization>) => void;
  sleepTimerRemainingSec: number | null;
  sleepAtTrackEnd: boolean;
  onSetSleepTimer: (minutes: number | null) => void;
  onSetSleepAtTrackEnd: (enabled: boolean) => void;
  skippedTrackCount: number;
  onResetSkipHistory: () => void;
  dynamicAccentHex?: string | null;
  likedTracks: Track[];
  playlists: UserPlaylist[];
  downloadedTracks: Track[];
  onRestoreBackup: (backup: FmMusicBackup, mode: RestoreMode) => void;
  onOpenDiagnostics: () => void;
  onNotify: (message: string) => void;
}

function formatCountdown(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export function SettingsModal({
  isOpen,
  onClose,
  currentTheme,
  onSelectTheme,
  customization,
  onUpdateCustomization,
  sleepTimerRemainingSec,
  sleepAtTrackEnd,
  onSetSleepTimer,
  onSetSleepAtTrackEnd,
  skippedTrackCount,
  onResetSkipHistory,
  dynamicAccentHex,
  likedTracks,
  playlists,
  downloadedTracks,
  onRestoreBackup,
  onOpenDiagnostics,
  onNotify,
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'themes' | 'player' | 'eq' | 'backup'>('themes');
  const [restoreMode, setRestoreMode] = useState<RestoreMode>('merge');
  const [pasteInput, setPasteInput] = useState('');
  const [showPasteArea, setShowPasteArea] = useState(false);
  const [pendingBackup, setPendingBackup] = useState<FmMusicBackup | null>(null);
  const [pendingSourceLabel, setPendingSourceLabel] = useState<string>('');
  const [backupError, setBackupError] = useState<string | null>(null);
  const [backupSuccess, setBackupSuccess] = useState<string | null>(null);
  const [copiedJson, setCopiedJson] = useState(false);
  const [customSleepMin, setCustomSleepMin] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const totalPlaylistTracks = playlists.reduce((acc, pl) => acc + pl.tracks.length, 0);

  const getPayload = () =>
    buildBackupPayload({
      likedTracks,
      playlists,
      downloadedTracks,
      theme: currentTheme,
      customization,
    });

  const handleExportDownload = () => {
    setBackupError(null);
    try {
      const payload = getPayload();
      const filename = downloadBackupFile(payload);
      const msg = `Exported backup to ${filename}`;
      setBackupSuccess(msg);
      onNotify(msg);
    } catch (err: any) {
      setBackupError(err?.message || 'Failed to export backup file.');
    }
  };

  const handleCopyBackup = async () => {
    setBackupError(null);
    try {
      const payload = getPayload();
      const json = JSON.stringify(payload, null, 2);
      await navigator.clipboard.writeText(json);
      setCopiedJson(true);
      setBackupSuccess('Backup JSON copied to clipboard.');
      onNotify('Backup JSON copied to clipboard');
      setTimeout(() => setCopiedJson(false), 2500);
    } catch {
      setBackupError('Clipboard permission unavailable. Please use "Export Backup (.json)" instead.');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBackupError(null);
    setBackupSuccess(null);

    try {
      const text = await file.text();
      const parsed = parseBackupJson(text);
      setPendingBackup(parsed);
      setPendingSourceLabel(file.name);
    } catch (err: any) {
      setPendingBackup(null);
      setBackupError(err?.message || 'Could not read backup file.');
    } finally {
      e.target.value = '';
    }
  };

  const handleParsePastedJson = () => {
    setBackupError(null);
    setBackupSuccess(null);
    if (!pasteInput.trim()) {
      setBackupError('Paste your FM Music backup JSON first.');
      return;
    }
    try {
      const parsed = parseBackupJson(pasteInput);
      setPendingBackup(parsed);
      setPendingSourceLabel('Pasted JSON');
    } catch (err: any) {
      setPendingBackup(null);
      setBackupError(err?.message || 'Invalid JSON backup text.');
    }
  };

  const handleConfirmRestore = () => {
    if (!pendingBackup) return;
    onRestoreBackup(pendingBackup, restoreMode);
    const summary = `${
      restoreMode === 'merge' ? 'Merged' : 'Restored'
    } ${pendingBackup.likedTracks.length} liked songs, ${pendingBackup.playlists.length} playlists, and ${pendingBackup.downloadedTracks.length} offline tracks.`;
    setBackupSuccess(summary);
    setPendingBackup(null);
    setPasteInput('');
    setShowPasteArea(false);
  };

  const GLASS_PRESETS: Array<{ id: GlassPreset; label: string; blur: number }> = [
    { id: 'subtle', label: 'Subtle', blur: 12 },
    { id: 'balanced', label: 'Balanced', blur: 24 },
    { id: 'ultra-frost', label: 'Ultra Frost', blur: 34 },
    { id: 'crystal', label: 'Clear Crystal', blur: 18 },
  ];

  const ARTWORK_STYLES: Array<{ id: ArtworkStyle; label: string }> = [
    { id: 'card', label: 'Rounded Card' },
    { id: 'vinyl', label: 'Spinning Vinyl' },
    { id: 'glow', label: 'Ambient Glow' },
  ];

  const LYRICS_PROVIDERS: Array<{ id: LyricsProviderPreference; label: string; desc: string }> = [
    { id: 'auto', label: 'Auto (LRCLIB + Lyrics.ovh)', desc: 'Synced timestamps first, plain lyrics fallback' },
    { id: 'lrclib', label: 'LRCLIB Synced', desc: 'Open-source time-synced & plain lyrics' },
    { id: 'lyricsovh', label: 'Lyrics.ovh', desc: 'Fast standard plain-text lyrics lookup' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="liquid-glass-strong w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 text-[var(--fm-text)] animate-scale-in max-h-[90vh] flex flex-col"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[var(--fm-glass-border)]">
          <div>
            <h2 className="text-lg sm:text-xl font-bold tracking-tight">Settings & Customization</h2>
            <p className="text-xs text-[var(--fm-text-muted)] mt-0.5">
              Themes, Liquid Glass effects, crossfade, sleep timer, lyrics, and backups
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-11 h-11 rounded-full liquid-glass-button flex items-center justify-center text-[var(--fm-text-muted)] hover:text-[var(--fm-text)] cursor-pointer"
            aria-label="Close settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="mt-4 p-1 rounded-2xl liquid-glass grid grid-cols-4 gap-1">
          <button
            onClick={() => setActiveTab('themes')}
            className={`min-h-11 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'themes'
                ? 'bg-[var(--fm-accent)] text-[var(--fm-accent-fg)] shadow-sm'
                : 'text-[var(--fm-text-muted)] hover:text-[var(--fm-text)]'
            }`}
          >
            <Palette className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Themes</span>
          </button>
          <button
            onClick={() => setActiveTab('player')}
            className={`min-h-11 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'player'
                ? 'bg-[var(--fm-accent)] text-[var(--fm-accent-fg)] shadow-sm'
                : 'text-[var(--fm-text-muted)] hover:text-[var(--fm-text)]'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Player</span>
          </button>
          <button
            onClick={() => setActiveTab('eq')}
            className={`min-h-11 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'eq'
                ? 'bg-[var(--fm-accent)] text-[var(--fm-accent-fg)] shadow-sm'
                : 'text-[var(--fm-text-muted)] hover:text-[var(--fm-text)]'
            }`}
          >
            <Sliders className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Equalizer</span>
          </button>
          <button
            onClick={() => setActiveTab('backup')}
            className={`min-h-11 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'backup'
                ? 'bg-[var(--fm-accent)] text-[var(--fm-accent-fg)] shadow-sm'
                : 'text-[var(--fm-text-muted)] hover:text-[var(--fm-text)]'
            }`}
          >
            <FileJson className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Backup</span>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="mt-4 flex-1 overflow-y-auto space-y-4 pr-1 pb-2">
          {activeTab === 'themes' && (
            <div className="space-y-5">
              {/* Theme Picker */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--fm-text-muted)]">
                    Color Themes
                  </h3>
                  <span className="text-xs text-[var(--fm-text-muted)]">{THEMES.length} themes</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {THEMES.map((theme) => {
                    const isActive = theme.id === currentTheme;
                    return (
                      <button
                        key={theme.id}
                        onClick={() => onSelectTheme(theme.id)}
                        className={`p-4 rounded-2xl text-left transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                          isActive
                            ? 'liquid-glass ring-2 ring-[var(--fm-accent)]'
                            : 'liquid-glass-button hover:scale-[1.01]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className="flex items-center -space-x-1.5">
                              {theme.previewSwatches.map((swatch, idx) => (
                                <span
                                  key={idx}
                                  style={{ backgroundColor: swatch }}
                                  className="w-5 h-5 rounded-full border border-white/30 shadow-xs"
                                />
                              ))}
                            </div>
                            <span className="text-xs font-semibold text-[var(--fm-text-muted)] flex items-center gap-1">
                              {theme.isLight ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                              {theme.isLight ? 'Light' : 'Dark'}
                            </span>
                          </div>
                          {isActive && (
                            <span className="w-6 h-6 rounded-full bg-[var(--fm-accent)] text-[var(--fm-accent-fg)] flex items-center justify-center shrink-0">
                              <Check className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </div>

                        <div>
                          <h4 className="text-sm font-bold text-[var(--fm-text)]">{theme.name}</h4>
                          <p className="text-xs text-[var(--fm-text-muted)] mt-0.5 leading-snug">
                            {theme.subtitle}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Dynamic Color from Track Artwork */}
              <div className="liquid-glass rounded-2xl p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      style={{ backgroundColor: dynamicAccentHex || 'var(--fm-accent)' }}
                      className="w-3.5 h-3.5 rounded-full border border-white/30 shrink-0"
                    />
                    <h4 className="text-sm font-bold">Dynamic Color</h4>
                  </div>
                  <p className="text-xs text-[var(--fm-text-muted)] mt-0.5 leading-snug">
                    Automatically adapts app accent and glow orbs to match the current track&apos;s album art
                    {customization.dynamicColorEnabled && dynamicAccentHex ? ` · ${dynamicAccentHex.toUpperCase()}` : ''}
                  </p>
                </div>
                <button
                  onClick={() =>
                    onUpdateCustomization({ dynamicColorEnabled: !customization.dynamicColorEnabled })
                  }
                  className={`min-h-10 px-4 rounded-xl text-xs font-bold shrink-0 cursor-pointer transition-colors ${
                    customization.dynamicColorEnabled
                      ? 'bg-[var(--fm-accent)] text-[var(--fm-accent-fg)]'
                      : 'liquid-glass-button text-[var(--fm-text-muted)]'
                  }`}
                >
                  {customization.dynamicColorEnabled ? 'On' : 'Off'}
                </button>
              </div>

              {/* Liquid Glass Effect Customizer */}
              <div className="liquid-glass rounded-2xl p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[var(--fm-accent)]" />
                    <h4 className="text-sm font-bold">iOS Liquid Glass Effect</h4>
                  </div>
                  <span className="text-xs font-mono text-[var(--fm-accent)]">
                    {customization.glassBlurPx}px blur
                  </span>
                </div>

                {/* Presets */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {GLASS_PRESETS.map((preset) => {
                    const active = customization.glassPreset === preset.id;
                    return (
                      <button
                        key={preset.id}
                        onClick={() =>
                          onUpdateCustomization({
                            glassPreset: preset.id,
                            glassBlurPx: preset.blur,
                          })
                        }
                        className={`min-h-10 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          active
                            ? 'bg-[var(--fm-accent)] text-[var(--fm-accent-fg)]'
                            : 'liquid-glass-button text-[var(--fm-text-muted)] hover:text-[var(--fm-text)]'
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>

                {/* Blur Depth Slider */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-[var(--fm-text-muted)]">
                    <span>Glass Frosted Blur Depth</span>
                    <span className="font-mono">{customization.glassBlurPx}px</span>
                  </div>
                  <input
                    type="range"
                    min={8}
                    max={40}
                    step={2}
                    value={customization.glassBlurPx}
                    onChange={(e) => onUpdateCustomization({ glassBlurPx: Number(e.target.value) })}
                    className="w-full fm-range"
                  />
                </div>

                {/* Ambient Orbs Toggle */}
                <div className="flex items-center justify-between pt-1">
                  <div>
                    <p className="text-xs sm:text-sm font-semibold">Ambient Liquid Glow Orbs</p>
                    <p className="text-xs text-[var(--fm-text-muted)]">
                      Soft refracted color gradients behind frosted panels
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      onUpdateCustomization({ ambientOrbsEnabled: !customization.ambientOrbsEnabled })
                    }
                    className={`min-h-9 px-3.5 rounded-full text-xs font-bold cursor-pointer transition-colors ${
                      customization.ambientOrbsEnabled
                        ? 'bg-[var(--fm-accent)] text-[var(--fm-accent-fg)]'
                        : 'liquid-glass-button text-[var(--fm-text-muted)]'
                    }`}
                  >
                    {customization.ambientOrbsEnabled ? 'On' : 'Off'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'player' && (
            <div className="space-y-4">
              {/* Crossfade */}
              <div className="liquid-glass rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AudioWaveform className="w-4 h-4 text-[var(--fm-accent)]" />
                    <div>
                      <h4 className="text-sm font-bold">Crossfade</h4>
                      <p className="text-xs text-[var(--fm-text-muted)]">
                        Smoothly blend volume between consecutive songs
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold text-[var(--fm-accent)]">
                    {customization.crossfadeSeconds === 0 ? 'Off' : `${customization.crossfadeSeconds}s`}
                  </span>
                </div>

                <input
                  type="range"
                  min={0}
                  max={12}
                  step={1}
                  value={customization.crossfadeSeconds}
                  onChange={(e) => onUpdateCustomization({ crossfadeSeconds: Number(e.target.value) })}
                  className="w-full fm-range"
                />

                <div className="flex items-center gap-2 flex-wrap">
                  {[0, 3, 6, 9, 12].map((sec) => (
                    <button
                      key={sec}
                      onClick={() => onUpdateCustomization({ crossfadeSeconds: sec })}
                      className={`min-h-9 px-3 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                        customization.crossfadeSeconds === sec
                          ? 'bg-[var(--fm-accent)] text-[var(--fm-accent-fg)]'
                          : 'liquid-glass-button text-[var(--fm-text-muted)] hover:text-[var(--fm-text)]'
                      }`}
                    >
                      {sec === 0 ? 'Off' : `${sec}s`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sleep Timer */}
              <div className="liquid-glass rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[var(--fm-accent)]" />
                    <div>
                      <h4 className="text-sm font-bold">Sleep Timer</h4>
                      <p className="text-xs text-[var(--fm-text-muted)]">
                        Automatically pause playback with gentle fade-out
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold text-[var(--fm-accent)]">
                    {sleepAtTrackEnd
                      ? 'End of song'
                      : sleepTimerRemainingSec
                      ? formatCountdown(sleepTimerRemainingSec)
                      : 'Off'}
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => {
                      onSetSleepTimer(null);
                      onSetSleepAtTrackEnd(false);
                    }}
                    className={`min-h-9 px-3 rounded-xl text-xs font-bold cursor-pointer ${
                      !sleepTimerRemainingSec && !sleepAtTrackEnd
                        ? 'bg-[var(--fm-accent)] text-[var(--fm-accent-fg)]'
                        : 'liquid-glass-button text-[var(--fm-text-muted)]'
                    }`}
                  >
                    Off
                  </button>
                  {[10, 15, 30, 45, 60].map((min) => (
                    <button
                      key={min}
                      onClick={() => onSetSleepTimer(min)}
                      className="min-h-9 px-3 rounded-xl liquid-glass-button text-xs font-bold text-[var(--fm-text)] hover:border-[var(--fm-accent)] cursor-pointer"
                    >
                      {min}m
                    </button>
                  ))}
                  <button
                    onClick={() => onSetSleepAtTrackEnd(!sleepAtTrackEnd)}
                    className={`min-h-9 px-3 rounded-xl text-xs font-bold cursor-pointer ${
                      sleepAtTrackEnd
                        ? 'bg-[var(--fm-accent)] text-[var(--fm-accent-fg)]'
                        : 'liquid-glass-button text-[var(--fm-text-muted)]'
                    }`}
                  >
                    End of Song
                  </button>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const parsed = parseInt(customSleepMin, 10);
                    if (parsed > 0 && parsed <= 480) {
                      onSetSleepTimer(parsed);
                      setCustomSleepMin('');
                    }
                  }}
                  className="flex items-center gap-2 pt-1"
                >
                  <input
                    type="number"
                    min={1}
                    max={480}
                    value={customSleepMin}
                    onChange={(e) => setCustomSleepMin(e.target.value)}
                    placeholder="Custom minutes (e.g. 25)"
                    className="flex-1 h-10 px-3 rounded-xl liquid-glass-input text-xs text-[var(--fm-text)] placeholder-[var(--fm-text-muted)]/60 focus:outline-none focus:border-[var(--fm-accent)]"
                  />
                  <button
                    type="submit"
                    disabled={!customSleepMin.trim()}
                    className="h-10 px-3.5 rounded-xl bg-[var(--fm-accent)] text-[var(--fm-accent-fg)] font-bold text-xs disabled:opacity-40 cursor-pointer"
                  >
                    Set
                  </button>
                </form>
              </div>

              {/* Playback Speed & Appearance Customization */}
              <div className="liquid-glass rounded-2xl p-4 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Gauge className="w-4 h-4 text-[var(--fm-accent)]" />
                    <h4 className="text-sm font-bold">Playback Speed</h4>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {[0.75, 1, 1.25, 1.5].map((rate) => (
                      <button
                        key={rate}
                        onClick={() => onUpdateCustomization({ playbackRate: rate })}
                        className={`min-h-9 px-2.5 rounded-xl text-xs font-bold cursor-pointer ${
                          customization.playbackRate === rate
                            ? 'bg-[var(--fm-accent)] text-[var(--fm-accent-fg)]'
                            : 'liquid-glass-button text-[var(--fm-text-muted)]'
                        }`}
                      >
                        {rate}×
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-[var(--fm-glass-border)]">
                  <div className="flex items-center gap-2">
                    <Disc3 className="w-4 h-4 text-[var(--fm-accent)]" />
                    <h4 className="text-sm font-bold">Now Playing Artwork Style</h4>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {ARTWORK_STYLES.map((style) => (
                      <button
                        key={style.id}
                        onClick={() => onUpdateCustomization({ artworkStyle: style.id })}
                        className={`min-h-10 px-3 py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                          customization.artworkStyle === style.id
                            ? 'bg-[var(--fm-accent)] text-[var(--fm-accent-fg)]'
                            : 'liquid-glass-button text-[var(--fm-text-muted)]'
                        }`}
                      >
                        {style.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[var(--fm-glass-border)]">
                  <div>
                    <p className="text-sm font-bold">Audio Visualizer Bars</p>
                    <p className="text-xs text-[var(--fm-text-muted)]">
                      Show animated equalizer bars in player & cover art
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      onUpdateCustomization({ showVisualizer: !customization.showVisualizer })
                    }
                    className={`min-h-9 px-3.5 rounded-full text-xs font-bold cursor-pointer ${
                      customization.showVisualizer
                        ? 'bg-[var(--fm-accent)] text-[var(--fm-accent-fg)]'
                        : 'liquid-glass-button text-[var(--fm-text-muted)]'
                    }`}
                  >
                    {customization.showVisualizer ? 'Visible' : 'Hidden'}
                  </button>
                </div>

                {/* Smart Shuffle Weighted Algorithm */}
                <div className="pt-2 border-t border-[var(--fm-glass-border)] space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-start gap-2">
                      <Shuffle className="w-4 h-4 text-[var(--fm-accent)] shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-bold">Smart Shuffle Algorithm</p>
                        <p className="text-xs text-[var(--fm-text-muted)]">
                          Weighted randomization favors liked songs (3.2×) and deprioritizes recently skipped tracks
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        onUpdateCustomization({ smartShuffleEnabled: !customization.smartShuffleEnabled })
                      }
                      className={`min-h-9 px-3.5 rounded-full text-xs font-bold cursor-pointer shrink-0 ${
                        customization.smartShuffleEnabled
                          ? 'bg-[var(--fm-accent)] text-[var(--fm-accent-fg)]'
                          : 'liquid-glass-button text-[var(--fm-text-muted)]'
                      }`}
                    >
                      {customization.smartShuffleEnabled ? 'Smart' : 'Standard'}
                    </button>
                  </div>
                  {skippedTrackCount > 0 && (
                    <div className="flex items-center justify-between text-xs text-[var(--fm-text-muted)] pl-6">
                      <span>{skippedTrackCount} recently skipped track{skippedTrackCount === 1 ? '' : 's'} weighted lower</span>
                      <button
                        onClick={onResetSkipHistory}
                        className="text-[var(--fm-accent)] hover:underline font-semibold cursor-pointer"
                      >
                        Reset Skips
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Lyrics Provider Customization */}
              <div className="liquid-glass rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[var(--fm-accent)]" />
                    <div>
                      <h4 className="text-sm font-bold">Lyrics Provider</h4>
                      <p className="text-xs text-[var(--fm-text-muted)]">
                        Free built-in providers (no API key required)
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      onUpdateCustomization({ autoFetchLyrics: !customization.autoFetchLyrics })
                    }
                    className={`min-h-9 px-3 rounded-full text-xs font-bold cursor-pointer ${
                      customization.autoFetchLyrics
                        ? 'bg-[var(--fm-accent)] text-[var(--fm-accent-fg)]'
                        : 'liquid-glass-button text-[var(--fm-text-muted)]'
                    }`}
                  >
                    Auto-Fetch: {customization.autoFetchLyrics ? 'On' : 'Off'}
                  </button>
                </div>

                <div className="space-y-2">
                  {LYRICS_PROVIDERS.map((prov) => {
                    const active = customization.lyricsProvider === prov.id;
                    return (
                      <button
                        key={prov.id}
                        onClick={() => onUpdateCustomization({ lyricsProvider: prov.id })}
                        className={`w-full p-3 rounded-xl text-left flex items-center justify-between gap-2 cursor-pointer transition-all ${
                          active
                            ? 'liquid-glass ring-2 ring-[var(--fm-accent)]'
                            : 'liquid-glass-button'
                        }`}
                      >
                        <div>
                          <p className="text-xs sm:text-sm font-bold">{prov.label}</p>
                          <p className="text-xs text-[var(--fm-text-muted)]">{prov.desc}</p>
                        </div>
                        {active && (
                          <span className="w-6 h-6 rounded-full bg-[var(--fm-accent)] text-[var(--fm-accent-fg)] flex items-center justify-center shrink-0">
                            <Check className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Diagnostics Link */}
              <div className="liquid-glass rounded-2xl p-4 flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-bold">Streaming & Cipher Diagnostics</h4>
                  <p className="text-xs text-[var(--fm-text-muted)] mt-0.5">
                    Inspect InnerTube tokens and cipher deobfuscation
                  </p>
                </div>
                <button
                  onClick={() => {
                    onClose();
                    onOpenDiagnostics();
                  }}
                  className="min-h-10 px-3.5 py-2 rounded-xl liquid-glass-button text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <ShieldCheck className="w-4 h-4 text-[var(--fm-accent)]" />
                  <span>Diagnostics</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'eq' && (
            <EqualizerPanel
              config={customization.equalizer}
              onChange={(eq) => onUpdateCustomization({ equalizer: eq })}
              onNotify={onNotify}
            />
          )}

          {activeTab === 'backup' && (
            <div className="space-y-4">
              {/* Library Snapshot */}
              <div className="liquid-glass rounded-2xl p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--fm-text-muted)] mb-3">
                  Your Library Data
                </h3>
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="p-3 rounded-xl bg-[var(--fm-input-bg)] border border-[var(--fm-glass-border)]">
                    <div className="flex items-center gap-1.5 text-[var(--fm-accent)] text-xs font-semibold">
                      <Heart className="w-3.5 h-3.5" />
                      <span>Liked</span>
                    </div>
                    <p className="text-xl font-bold mt-1">{likedTracks.length}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-[var(--fm-input-bg)] border border-[var(--fm-glass-border)]">
                    <div className="flex items-center gap-1.5 text-[var(--fm-accent)] text-xs font-semibold">
                      <ListMusic className="w-3.5 h-3.5" />
                      <span>Playlists</span>
                    </div>
                    <p className="text-xl font-bold mt-1">
                      {playlists.length}
                      <span className="text-xs font-normal text-[var(--fm-text-muted)] ml-1">
                        ({totalPlaylistTracks})
                      </span>
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-[var(--fm-input-bg)] border border-[var(--fm-glass-border)]">
                    <div className="flex items-center gap-1.5 text-[var(--fm-accent)] text-xs font-semibold">
                      <HardDrive className="w-3.5 h-3.5" />
                      <span>Offline</span>
                    </div>
                    <p className="text-xl font-bold mt-1">{downloadedTracks.length}</p>
                  </div>
                </div>
              </div>

              {/* Status Alerts */}
              {backupError && (
                <div className="p-3.5 rounded-2xl bg-red-500/15 border border-red-400/40 flex items-start gap-2.5 text-xs">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span className="text-[var(--fm-text)]">{backupError}</span>
                </div>
              )}

              {backupSuccess && (
                <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-400/40 flex items-start gap-2.5 text-xs">
                  <CheckCircle2 className="w-4 h-4 text-[var(--fm-accent)] shrink-0 mt-0.5" />
                  <span className="text-[var(--fm-text)]">{backupSuccess}</span>
                </div>
              )}

              {/* Export Backup */}
              <div className="liquid-glass rounded-2xl p-4 space-y-3">
                <div>
                  <h4 className="text-sm font-bold">Export Backup</h4>
                  <p className="text-xs text-[var(--fm-text-muted)] mt-0.5">
                    Save your playlists, liked songs, offline collection, themes, and player settings as a portable JSON file.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    onClick={handleExportDownload}
                    className="min-h-11 px-4 py-2.5 rounded-xl bg-[var(--fm-accent)] text-[var(--fm-accent-fg)] font-bold text-xs sm:text-sm flex items-center gap-2 cursor-pointer shadow-sm hover:opacity-95 transition-opacity"
                  >
                    <Download className="w-4 h-4" />
                    <span>Export Backup (.json)</span>
                  </button>
                  <button
                    onClick={handleCopyBackup}
                    className="min-h-11 px-4 py-2.5 rounded-xl liquid-glass-button text-xs sm:text-sm font-semibold flex items-center gap-2 cursor-pointer"
                  >
                    {copiedJson ? <Check className="w-4 h-4 text-[var(--fm-accent)]" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedJson ? 'Copied!' : 'Copy JSON'}</span>
                  </button>
                </div>
              </div>

              {/* Import Backup */}
              <div className="liquid-glass rounded-2xl p-4 space-y-3">
                <div>
                  <h4 className="text-sm font-bold">Import & Restore Backup</h4>
                  <p className="text-xs text-[var(--fm-text-muted)] mt-0.5">
                    Restore from a previously exported FM Music JSON file or pasted backup data.
                  </p>
                </div>

                {/* Merge vs Replace Mode */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[var(--fm-text-muted)]">Restore mode:</span>
                  <div className="p-1 rounded-xl bg-[var(--fm-input-bg)] border border-[var(--fm-glass-border)] flex items-center gap-1">
                    <button
                      onClick={() => setRestoreMode('merge')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        restoreMode === 'merge'
                          ? 'bg-[var(--fm-accent)] text-[var(--fm-accent-fg)]'
                          : 'text-[var(--fm-text-muted)] hover:text-[var(--fm-text)]'
                      }`}
                    >
                      Merge
                    </button>
                    <button
                      onClick={() => setRestoreMode('replace')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        restoreMode === 'replace'
                          ? 'bg-[var(--fm-accent)] text-[var(--fm-accent-fg)]'
                          : 'text-[var(--fm-text-muted)] hover:text-[var(--fm-text)]'
                      }`}
                    >
                      Replace
                    </button>
                  </div>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="min-h-11 px-4 py-2.5 rounded-xl liquid-glass-button font-bold text-xs sm:text-sm flex items-center gap-2 cursor-pointer"
                  >
                    <Upload className="w-4 h-4 text-[var(--fm-accent)]" />
                    <span>Choose Backup File (.json)</span>
                  </button>
                  <button
                    onClick={() => setShowPasteArea((prev) => !prev)}
                    className="min-h-11 px-4 py-2.5 rounded-xl liquid-glass-button text-xs sm:text-sm font-semibold cursor-pointer"
                  >
                    {showPasteArea ? 'Hide Paste Box' : 'Paste JSON'}
                  </button>
                </div>

                {showPasteArea && (
                  <div className="space-y-2 pt-1">
                    <textarea
                      value={pasteInput}
                      onChange={(e) => setPasteInput(e.target.value)}
                      rows={4}
                      placeholder='Paste exported FM Music JSON here...'
                      className="w-full p-3 rounded-xl liquid-glass-input text-xs font-mono text-[var(--fm-text)] placeholder-[var(--fm-text-muted)]/60 focus:outline-none focus:border-[var(--fm-accent)]"
                    />
                    <button
                      onClick={handleParsePastedJson}
                      className="min-h-10 px-4 py-2 rounded-xl bg-[var(--fm-accent)] text-[var(--fm-accent-fg)] font-bold text-xs cursor-pointer"
                    >
                      Validate JSON
                    </button>
                  </div>
                )}

                {pendingBackup && (
                  <div className="p-3.5 rounded-2xl bg-[var(--fm-input-bg)] border border-[var(--fm-accent)]/50 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-[var(--fm-accent)]">
                        Ready to {restoreMode === 'merge' ? 'Merge' : 'Replace'} ({pendingSourceLabel})
                      </span>
                      <button
                        onClick={() => setPendingBackup(null)}
                        className="text-xs text-[var(--fm-text-muted)] hover:text-[var(--fm-text)] cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                    <p className="text-xs text-[var(--fm-text-muted)]">
                      Contains <strong className="text-[var(--fm-text)]">{pendingBackup.likedTracks.length}</strong> liked songs,{' '}
                      <strong className="text-[var(--fm-text)]">{pendingBackup.playlists.length}</strong> playlists, and{' '}
                      <strong className="text-[var(--fm-text)]">{pendingBackup.downloadedTracks.length}</strong> offline tracks
                      {pendingBackup.exportedAt ? ` (exported ${pendingBackup.exportedAt.slice(0, 10)})` : ''}.
                    </p>
                    <button
                      onClick={handleConfirmRestore}
                      className="min-h-11 w-full rounded-xl bg-[var(--fm-accent)] text-[var(--fm-accent-fg)] font-bold text-xs sm:text-sm cursor-pointer"
                    >
                      {restoreMode === 'merge' ? 'Confirm Merge Backup' : 'Confirm Replace Library'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
