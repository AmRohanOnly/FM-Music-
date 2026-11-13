import { Track } from '../data/musicCatalog';
import {
  EqualizerConfig,
  EqualizerProfile,
  DEFAULT_EQUALIZER_CONFIG,
  clampEqDb,
} from './webAudioEqualizer';

export type ThemeId =
  | 'midnight-lime'
  | 'ios-frost'
  | 'obsidian-rose'
  | 'aurora-cyan'
  | 'amber-vinyl';

export interface ThemeConfig {
  id: ThemeId;
  name: string;
  subtitle: string;
  isLight: boolean;
  previewSwatches: [string, string, string];
  vars: {
    '--fm-bg': string;
    '--fm-bg-elevated': string;
    '--fm-text': string;
    '--fm-text-muted': string;
    '--fm-accent': string;
    '--fm-accent-fg': string;
    '--fm-glass': string;
    '--fm-glass-strong': string;
    '--fm-glass-border': string;
    '--fm-glass-highlight': string;
    '--fm-orb-1': string;
    '--fm-orb-2': string;
    '--fm-input-bg': string;
  };
}

export const THEMES: ThemeConfig[] = [
  {
    id: 'midnight-lime',
    name: 'Midnight Lime',
    subtitle: 'Deep obsidian glass with electric lime accent',
    isLight: false,
    previewSwatches: ['#0B0B10', '#1E2420', '#B9F36A'],
    vars: {
      '--fm-bg': '#09090E',
      '--fm-bg-elevated': 'rgba(22, 23, 32, 0.72)',
      '--fm-text': '#FFFFFF',
      '--fm-text-muted': '#B4B6C7',
      '--fm-accent': '#B9F36A',
      '--fm-accent-fg': '#0C1207',
      '--fm-glass': 'rgba(255, 255, 255, 0.065)',
      '--fm-glass-strong': 'rgba(20, 21, 30, 0.78)',
      '--fm-glass-border': 'rgba(255, 255, 255, 0.14)',
      '--fm-glass-highlight': 'rgba(255, 255, 255, 0.24)',
      '--fm-orb-1': 'rgba(185, 243, 106, 0.16)',
      '--fm-orb-2': 'rgba(94, 129, 244, 0.15)',
      '--fm-input-bg': 'rgba(255, 255, 255, 0.06)',
    },
  },
  {
    id: 'ios-frost',
    name: 'iOS Frost Light',
    subtitle: 'Bright frosted liquid glass with Apple-style azure accent',
    isLight: true,
    previewSwatches: ['#EEF2F8', '#FFFFFF', '#007AFF'],
    vars: {
      '--fm-bg': '#EAF0F8',
      '--fm-bg-elevated': 'rgba(255, 255, 255, 0.78)',
      '--fm-text': '#0F172A',
      '--fm-text-muted': '#475569',
      '--fm-accent': '#007AFF',
      '--fm-accent-fg': '#FFFFFF',
      '--fm-glass': 'rgba(255, 255, 255, 0.58)',
      '--fm-glass-strong': 'rgba(255, 255, 255, 0.84)',
      '--fm-glass-border': 'rgba(15, 23, 42, 0.10)',
      '--fm-glass-highlight': 'rgba(255, 255, 255, 0.92)',
      '--fm-orb-1': 'rgba(0, 122, 255, 0.18)',
      '--fm-orb-2': 'rgba(56, 189, 248, 0.20)',
      '--fm-input-bg': 'rgba(255, 255, 255, 0.72)',
    },
  },
  {
    id: 'aurora-cyan',
    name: 'Aurora Glass',
    subtitle: 'Deep twilight slate glass with glacier cyan',
    isLight: false,
    previewSwatches: ['#07101F', '#10223A', '#38BDF8'],
    vars: {
      '--fm-bg': '#07101F',
      '--fm-bg-elevated': 'rgba(14, 29, 52, 0.74)',
      '--fm-text': '#F8FAFC',
      '--fm-text-muted': '#A6BDD8',
      '--fm-accent': '#38BDF8',
      '--fm-accent-fg': '#041423',
      '--fm-glass': 'rgba(186, 230, 253, 0.08)',
      '--fm-glass-strong': 'rgba(10, 22, 42, 0.80)',
      '--fm-glass-border': 'rgba(186, 230, 253, 0.16)',
      '--fm-glass-highlight': 'rgba(224, 242, 254, 0.28)',
      '--fm-orb-1': 'rgba(56, 189, 248, 0.20)',
      '--fm-orb-2': 'rgba(45, 212, 191, 0.15)',
      '--fm-input-bg': 'rgba(186, 230, 253, 0.07)',
    },
  },
  {
    id: 'obsidian-rose',
    name: 'Velvet Rose',
    subtitle: 'Smoked plum glass with warm rose-coral highlights',
    isLight: false,
    previewSwatches: ['#120B12', '#261522', '#FB7185'],
    vars: {
      '--fm-bg': '#110A11',
      '--fm-bg-elevated': 'rgba(34, 19, 32, 0.74)',
      '--fm-text': '#FFF8FA',
      '--fm-text-muted': '#CEB6C2',
      '--fm-accent': '#FB7185',
      '--fm-accent-fg': '#1C060B',
      '--fm-glass': 'rgba(255, 228, 235, 0.07)',
      '--fm-glass-strong': 'rgba(28, 15, 26, 0.82)',
      '--fm-glass-border': 'rgba(255, 220, 230, 0.15)',
      '--fm-glass-highlight': 'rgba(255, 230, 238, 0.25)',
      '--fm-orb-1': 'rgba(251, 113, 133, 0.20)',
      '--fm-orb-2': 'rgba(244, 114, 182, 0.13)',
      '--fm-input-bg': 'rgba(255, 228, 235, 0.07)',
    },
  },
  {
    id: 'amber-vinyl',
    name: 'Amber Vinyl',
    subtitle: 'Warm espresso studio glass with golden amber tone',
    isLight: false,
    previewSwatches: ['#120F0B', '#251E15', '#FBBF24'],
    vars: {
      '--fm-bg': '#110E0A',
      '--fm-bg-elevated': 'rgba(34, 27, 19, 0.75)',
      '--fm-text': '#FFFBF2',
      '--fm-text-muted': '#CFC2AE',
      '--fm-accent': '#FBBF24',
      '--fm-accent-fg': '#1A1203',
      '--fm-glass': 'rgba(255, 243, 214, 0.07)',
      '--fm-glass-strong': 'rgba(26, 21, 15, 0.82)',
      '--fm-glass-border': 'rgba(255, 236, 194, 0.15)',
      '--fm-glass-highlight': 'rgba(255, 244, 214, 0.24)',
      '--fm-orb-1': 'rgba(251, 191, 36, 0.18)',
      '--fm-orb-2': 'rgba(249, 115, 22, 0.14)',
      '--fm-input-bg': 'rgba(255, 243, 214, 0.07)',
    },
  },
];

export interface UserPlaylist {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  tracks: Track[];
}

export type GlassPreset = 'subtle' | 'balanced' | 'ultra-frost' | 'crystal';
export type ArtworkStyle = 'card' | 'vinyl' | 'glow';
export type LyricsProviderPreference = 'auto' | 'lrclib' | 'lyricsovh';

export interface PlayerCustomization {
  crossfadeSeconds: number; // 0 - 12s
  playbackRate: number; // 0.75 | 1 | 1.25 | 1.5
  glassPreset: GlassPreset;
  glassBlurPx: number; // 8 - 40
  ambientOrbsEnabled: boolean;
  artworkStyle: ArtworkStyle;
  showVisualizer: boolean;
  lyricsProvider: LyricsProviderPreference;
  autoFetchLyrics: boolean;
  smartShuffleEnabled: boolean;
  equalizer: EqualizerConfig;
}

export const DEFAULT_PLAYER_CUSTOMIZATION: PlayerCustomization = {
  crossfadeSeconds: 4,
  playbackRate: 1,
  glassPreset: 'balanced',
  glassBlurPx: 24,
  ambientOrbsEnabled: true,
  artworkStyle: 'card',
  showVisualizer: true,
  lyricsProvider: 'auto',
  autoFetchLyrics: true,
  smartShuffleEnabled: true,
  equalizer: { ...DEFAULT_EQUALIZER_CONFIG },
};

export interface FmMusicBackup {
  version: number;
  app: string;
  exportedAt: string;
  likedTracks: Track[];
  playlists: UserPlaylist[];
  downloadedTracks: Track[];
  settings: {
    theme: ThemeId;
    customization?: PlayerCustomization;
  };
}

const STORAGE_KEYS = {
  THEME: 'fm_theme_id',
  LIKED_TRACKS: 'fm_liked_tracks',
  PLAYLISTS: 'fm_user_playlists',
  DOWNLOADED_IDS: 'fm_downloaded_ids',
  DOWNLOADED_TRACKS: 'fm_downloaded_tracks',
  CUSTOMIZATION: 'fm_player_customization',
};

export function loadStoredTheme(): ThemeId {
  try {
    const val = localStorage.getItem(STORAGE_KEYS.THEME) as ThemeId | null;
    if (val && THEMES.some((t) => t.id === val)) return val;
  } catch {}
  return 'midnight-lime';
}

export function saveStoredTheme(themeId: ThemeId): void {
  try {
    localStorage.setItem(STORAGE_KEYS.THEME, themeId);
  } catch {}
}

export function applyThemeToDocument(themeId: ThemeId): ThemeConfig {
  const theme = THEMES.find((t) => t.id === themeId) || THEMES[0];
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    Object.entries(theme.vars).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
    if (theme.isLight) {
      root.classList.remove('dark');
      root.classList.add('light');
    } else {
      root.classList.remove('light');
      root.classList.add('dark');
    }
  }
  return theme;
}

export function loadPlayerCustomization(): PlayerCustomization {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CUSTOMIZATION);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return normalizeCustomization(parsed);
      }
    }
  } catch {}
  return { ...DEFAULT_PLAYER_CUSTOMIZATION };
}

export function savePlayerCustomization(custom: PlayerCustomization): void {
  try {
    localStorage.setItem(STORAGE_KEYS.CUSTOMIZATION, JSON.stringify(custom));
  } catch {}
}

export function normalizeCustomization(raw: any): PlayerCustomization {
  const validPresets: GlassPreset[] = ['subtle', 'balanced', 'ultra-frost', 'crystal'];
  const validArt: ArtworkStyle[] = ['card', 'vinyl', 'glow'];
  const validLyrics: LyricsProviderPreference[] = ['auto', 'lrclib', 'lyricsovh'];
  const cf = Number(raw?.crossfadeSeconds);
  const rate = Number(raw?.playbackRate);
  const blur = Number(raw?.glassBlurPx);

  return {
    crossfadeSeconds:
      Number.isFinite(cf) && cf >= 0 && cf <= 12 ? Math.round(cf) : DEFAULT_PLAYER_CUSTOMIZATION.crossfadeSeconds,
    playbackRate:
      [0.75, 1, 1.25, 1.5].includes(rate) ? rate : DEFAULT_PLAYER_CUSTOMIZATION.playbackRate,
    glassPreset: validPresets.includes(raw?.glassPreset)
      ? raw.glassPreset
      : DEFAULT_PLAYER_CUSTOMIZATION.glassPreset,
    glassBlurPx:
      Number.isFinite(blur) && blur >= 8 && blur <= 40 ? Math.round(blur) : DEFAULT_PLAYER_CUSTOMIZATION.glassBlurPx,
    ambientOrbsEnabled:
      typeof raw?.ambientOrbsEnabled === 'boolean'
        ? raw.ambientOrbsEnabled
        : DEFAULT_PLAYER_CUSTOMIZATION.ambientOrbsEnabled,
    artworkStyle: validArt.includes(raw?.artworkStyle)
      ? raw.artworkStyle
      : DEFAULT_PLAYER_CUSTOMIZATION.artworkStyle,
    showVisualizer:
      typeof raw?.showVisualizer === 'boolean'
        ? raw.showVisualizer
        : DEFAULT_PLAYER_CUSTOMIZATION.showVisualizer,
    lyricsProvider: validLyrics.includes(raw?.lyricsProvider)
      ? raw.lyricsProvider
      : DEFAULT_PLAYER_CUSTOMIZATION.lyricsProvider,
    autoFetchLyrics:
      typeof raw?.autoFetchLyrics === 'boolean'
        ? raw.autoFetchLyrics
        : DEFAULT_PLAYER_CUSTOMIZATION.autoFetchLyrics,
    smartShuffleEnabled:
      typeof raw?.smartShuffleEnabled === 'boolean'
        ? raw.smartShuffleEnabled
        : DEFAULT_PLAYER_CUSTOMIZATION.smartShuffleEnabled,
    equalizer: normalizeEqualizerConfig(raw?.equalizer),
  };
}

export function normalizeEqualizerConfig(raw: any): EqualizerConfig {
  const customProfiles: EqualizerProfile[] = Array.isArray(raw?.customProfiles)
    ? raw.customProfiles
        .filter(
          (p: any) =>
            p &&
            typeof p.id === 'string' &&
            typeof p.name === 'string' &&
            p.bands &&
            typeof p.bands === 'object'
        )
        .map((p: any) => ({
          id: p.id,
          name: String(p.name).trim() || 'Custom Profile',
          bands: {
            bass: clampEqDb(Number(p.bands.bass)),
            mids: clampEqDb(Number(p.bands.mids)),
            treble: clampEqDb(Number(p.bands.treble)),
          },
        }))
    : [];

  return {
    enabled:
      typeof raw?.enabled === 'boolean' ? raw.enabled : DEFAULT_EQUALIZER_CONFIG.enabled,
    activeProfileId:
      typeof raw?.activeProfileId === 'string'
        ? raw.activeProfileId
        : DEFAULT_EQUALIZER_CONFIG.activeProfileId,
    bands: {
      bass: clampEqDb(Number(raw?.bands?.bass ?? DEFAULT_EQUALIZER_CONFIG.bands.bass)),
      mids: clampEqDb(Number(raw?.bands?.mids ?? DEFAULT_EQUALIZER_CONFIG.bands.mids)),
      treble: clampEqDb(Number(raw?.bands?.treble ?? DEFAULT_EQUALIZER_CONFIG.bands.treble)),
    },
    customProfiles,
  };
}

export function applyGlassCustomizationToDocument(custom: PlayerCustomization): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  const presetMap: Record<GlassPreset, { sat: string; orbOpacity: string; sheen: string }> = {
    subtle: { sat: '140%', orbOpacity: '0.6', sheen: '0.75' },
    balanced: { sat: '185%', orbOpacity: '1', sheen: '1' },
    'ultra-frost': { sat: '220%', orbOpacity: '1', sheen: '1.25' },
    crystal: { sat: '240%', orbOpacity: '0.9', sheen: '1.35' },
  };

  const preset = presetMap[custom.glassPreset] || presetMap.balanced;
  root.style.setProperty('--fm-glass-blur', `${custom.glassBlurPx}px`);
  root.style.setProperty('--fm-glass-sat', preset.sat);
  root.style.setProperty('--fm-orb-opacity', custom.ambientOrbsEnabled ? preset.orbOpacity : '0');
  root.style.setProperty('--fm-glass-sheen', preset.sheen);
}

export function loadLikedTracks(): Track[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.LIKED_TRACKS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter(isValidTrack);
    }
  } catch {}
  return [];
}

export function saveLikedTracks(tracks: Track[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.LIKED_TRACKS, JSON.stringify(tracks));
  } catch {}
}

export function loadPlaylists(defaultPlaylists: UserPlaylist[] = []): UserPlaylist[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PLAYLISTS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter(isValidPlaylist);
      }
    }
  } catch {}
  return defaultPlaylists;
}

export function savePlaylists(playlists: UserPlaylist[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.PLAYLISTS, JSON.stringify(playlists));
  } catch {}
}

export function loadDownloadedTracks(fallbackCatalog: Track[]): Track[] {
  try {
    const rawTracks = localStorage.getItem(STORAGE_KEYS.DOWNLOADED_TRACKS);
    if (rawTracks) {
      const parsed = JSON.parse(rawTracks);
      if (Array.isArray(parsed)) return parsed.filter(isValidTrack);
    }
    // Migrate legacy downloaded IDs
    const rawIds = localStorage.getItem(STORAGE_KEYS.DOWNLOADED_IDS);
    if (rawIds) {
      const ids: string[] = JSON.parse(rawIds);
      return fallbackCatalog.filter((t) => ids.includes(t.id));
    }
  } catch {}
  return fallbackCatalog.filter((t) => ['hindi-1', 'chill-1', 'new-1'].includes(t.id));
}

export function saveDownloadedTracks(tracks: Track[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.DOWNLOADED_TRACKS, JSON.stringify(tracks));
    localStorage.setItem(STORAGE_KEYS.DOWNLOADED_IDS, JSON.stringify(tracks.map((t) => t.id)));
  } catch {}
}

function isValidTrack(obj: any): obj is Track {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.id === 'string' &&
    typeof obj.title === 'string' &&
    typeof obj.artist === 'string' &&
    (typeof obj.youtubeId === 'string' || obj.youtubeId === undefined)
  );
}

function isValidPlaylist(obj: any): obj is UserPlaylist {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    Array.isArray(obj.tracks)
  );
}

export function buildBackupPayload(params: {
  likedTracks: Track[];
  playlists: UserPlaylist[];
  downloadedTracks: Track[];
  theme: ThemeId;
  customization?: PlayerCustomization;
}): FmMusicBackup {
  return {
    version: 2,
    app: 'FM Music',
    exportedAt: new Date().toISOString(),
    likedTracks: params.likedTracks,
    playlists: params.playlists,
    downloadedTracks: params.downloadedTracks,
    settings: {
      theme: params.theme,
      customization: params.customization,
    },
  };
}

export function downloadBackupFile(backup: FmMusicBackup): string {
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const dateStamp = new Date().toISOString().slice(0, 10);
  const filename = `fm-music-backup-${dateStamp}.json`;

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return filename;
}

export function parseBackupJson(rawText: string): FmMusicBackup {
  let parsed: any;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error('Invalid JSON file. Please select a valid FM Music backup file.');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Backup data is empty or malformed.');
  }

  const hasKnownArrays =
    Array.isArray(parsed.likedTracks) ||
    Array.isArray(parsed.playlists) ||
    Array.isArray(parsed.downloadedTracks);

  if (!hasKnownArrays) {
    throw new Error('Backup does not contain playlists, liked songs, or offline tracks.');
  }

  const likedTracks: Track[] = Array.isArray(parsed.likedTracks)
    ? parsed.likedTracks.filter(isValidTrack).map(normalizeTrack)
    : [];

  const playlists: UserPlaylist[] = Array.isArray(parsed.playlists)
    ? parsed.playlists
        .filter(isValidPlaylist)
        .map((pl: any) => ({
          id: String(pl.id),
          name: String(pl.name).trim() || 'Imported Playlist',
          description: typeof pl.description === 'string' ? pl.description : undefined,
          createdAt: typeof pl.createdAt === 'number' ? pl.createdAt : Date.now(),
          updatedAt: Date.now(),
          tracks: Array.isArray(pl.tracks) ? pl.tracks.filter(isValidTrack).map(normalizeTrack) : [],
        }))
    : [];

  const downloadedTracks: Track[] = Array.isArray(parsed.downloadedTracks)
    ? parsed.downloadedTracks.filter(isValidTrack).map(normalizeTrack)
    : [];

  const candidateTheme = parsed?.settings?.theme;
  const theme: ThemeId = THEMES.some((t) => t.id === candidateTheme)
    ? candidateTheme
    : 'midnight-lime';

  const customization = parsed?.settings?.customization
    ? normalizeCustomization(parsed.settings.customization)
    : undefined;

  return {
    version: Number(parsed.version) || 1,
    app: typeof parsed.app === 'string' ? parsed.app : 'FM Music',
    exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : new Date().toISOString(),
    likedTracks,
    playlists,
    downloadedTracks,
    settings: { theme, customization },
  };
}

function normalizeTrack(t: Track): Track {
  return {
    id: t.id,
    youtubeId: typeof t.youtubeId === 'string' ? t.youtubeId : '',
    title: t.title,
    artist: t.artist,
    album: t.album || 'FM Music',
    vibe: t.vibe || 'Top hits',
    duration: typeof t.duration === 'number' && t.duration > 0 ? t.duration : 210,
    durationFormatted: t.durationFormatted || '3:30',
    thumbnail:
      t.thumbnail ||
      (t.youtubeId ? `https://i.ytimg.com/vi/${t.youtubeId}/hqdefault.jpg` : ''),
    fallbackAudio: t.fallbackAudio,
    lyrics: Array.isArray(t.lyrics) ? t.lyrics : undefined,
  };
}

export function mergeUniqueTracks(existing: Track[], incoming: Track[]): Track[] {
  const map = new Map<string, Track>();
  for (const t of existing) {
    map.set(t.id, t);
  }
  for (const t of incoming) {
    if (!map.has(t.id)) {
      map.set(t.id, t);
    }
  }
  return Array.from(map.values());
}

export function mergePlaylists(existing: UserPlaylist[], incoming: UserPlaylist[]): UserPlaylist[] {
  const map = new Map<string, UserPlaylist>();
  for (const pl of existing) {
    map.set(pl.id, pl);
  }
  for (const pl of incoming) {
    const prev = map.get(pl.id);
    if (prev) {
      map.set(pl.id, {
        ...prev,
        name: pl.name || prev.name,
        updatedAt: Date.now(),
        tracks: mergeUniqueTracks(prev.tracks, pl.tracks),
      });
    } else {
      map.set(pl.id, pl);
    }
  }
  return Array.from(map.values());
}
