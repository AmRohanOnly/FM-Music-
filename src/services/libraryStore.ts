import { Track } from '../data/musicCatalog';
import {
  EqualizerConfig,
  EqualizerProfile,
  DEFAULT_EQUALIZER_CONFIG,
  clampEqDb,
} from './webAudioEqualizer';

/* ==========================================================================
   Milestone 2 Theming Types & Interface Contracts
   ========================================================================== */

export type BaseThemeId =
  | 'yt-dark'
  | 'ios-glass-dark'
  | 'ios-glass-light'
  | 'modern-light'
  | 'midnight-lime'
  | 'aurora-cyan'
  | 'obsidian-rose'
  | 'amber-vinyl';

// Backward compatibility alias for existing code
export type ThemeId = BaseThemeId;

export type AccentMode = 'preset' | 'custom' | 'dynamic';

export interface AccentConfig {
  mode: AccentMode;
  presetId?: string;
  customHex?: string;
}

export interface CuratedAccent {
  id: string;
  name: string;
  hex: string;
  rgb: [number, number, number];
  fg: string;
  orb1: string;
  orb2: string;
}

export interface ThemeConfig {
  id: BaseThemeId;
  name: string;
  category: 'dark' | 'light' | 'glass-dark' | 'glass-light';
  colors: Record<string, string>;
  // Additional metadata & backward compatibility properties
  subtitle: string;
  isLight: boolean;
  previewSwatches: [string, string, string];
  vars: Record<string, string>;
}

/* ==========================================================================
   9 Curated Accent Colors
   ========================================================================== */

export const CURATED_ACCENTS: CuratedAccent[] = [
  {
    id: 'yt-red',
    name: 'YouTube Red',
    hex: '#FF0000',
    rgb: [255, 0, 0],
    fg: '#FFFFFF',
    orb1: 'rgba(255, 0, 0, 0.20)',
    orb2: 'rgba(255, 60, 60, 0.15)',
  },
  {
    id: 'electric-lime',
    name: 'Electric Lime',
    hex: '#B9F36A',
    rgb: [185, 243, 106],
    fg: '#0C1207',
    orb1: 'rgba(185, 243, 106, 0.18)',
    orb2: 'rgba(94, 129, 244, 0.15)',
  },
  {
    id: 'apple-azure',
    name: 'Apple Azure',
    hex: '#007AFF',
    rgb: [0, 122, 255],
    fg: '#FFFFFF',
    orb1: 'rgba(0, 122, 255, 0.22)',
    orb2: 'rgba(56, 189, 248, 0.18)',
  },
  {
    id: 'emerald-mint',
    name: 'Emerald Mint',
    hex: '#10B981',
    rgb: [16, 185, 129],
    fg: '#04160E',
    orb1: 'rgba(16, 185, 129, 0.20)',
    orb2: 'rgba(52, 211, 153, 0.16)',
  },
  {
    id: 'glacier-cyan',
    name: 'Glacier Cyan',
    hex: '#06B6D4',
    rgb: [6, 182, 212],
    fg: '#02141A',
    orb1: 'rgba(6, 182, 212, 0.20)',
    orb2: 'rgba(45, 212, 191, 0.16)',
  },
  {
    id: 'royal-purple',
    name: 'Royal Purple',
    hex: '#8B5CF6',
    rgb: [139, 92, 246],
    fg: '#FFFFFF',
    orb1: 'rgba(139, 92, 246, 0.22)',
    orb2: 'rgba(192, 132, 252, 0.16)',
  },
  {
    id: 'sunset-orange',
    name: 'Sunset Orange',
    hex: '#F97316',
    rgb: [249, 115, 22],
    fg: '#FFFFFF',
    orb1: 'rgba(249, 115, 22, 0.22)',
    orb2: 'rgba(251, 146, 60, 0.16)',
  },
  {
    id: 'velvet-rose',
    name: 'Velvet Rose',
    hex: '#FB7185',
    rgb: [251, 113, 133],
    fg: '#1C060B',
    orb1: 'rgba(251, 113, 133, 0.22)',
    orb2: 'rgba(244, 114, 182, 0.15)',
  },
  {
    id: 'amber-gold',
    name: 'Amber Gold',
    hex: '#FBBF24',
    rgb: [251, 191, 36],
    fg: '#1A1203',
    orb1: 'rgba(251, 191, 36, 0.22)',
    orb2: 'rgba(245, 158, 11, 0.16)',
  },
];

/* ==========================================================================
   WCAG AA Contrast & Color Utilities
   ========================================================================== */

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  if (!hex || typeof hex !== 'string') return null;
  const clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
    return { r, g, b };
  }
  if (clean.length === 6) {
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
    return { r, g, b };
  }
  return null;
}

export function getRelativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((val) => {
    const v = val / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

export function getContrastRatio(lum1: number, lum2: number): number {
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function getAccessibleFgColor(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return '#FFFFFF';
  const lum = getRelativeLuminance(rgb.r, rgb.g, rgb.b);
  const contrastWithWhite = getContrastRatio(1.0, lum);
  const contrastWithDark = getContrastRatio(lum, 0.015);
  return contrastWithDark >= contrastWithWhite ? '#0C1207' : '#FFFFFF';
}

/* ==========================================================================
   Base Theme Definitions
   ========================================================================== */

const ytDarkVars: Record<string, string> = {
  '--fm-bg': '#030303',
  '--fm-bg-elevated': '#212121',
  '--fm-surface-card': '#181818',
  '--fm-surface-hover': '#282828',
  '--fm-header-bg': 'rgba(3, 3, 3, 0.95)',
  '--fm-player-bg': '#212121',
  '--fm-text': '#FFFFFF',
  '--fm-text-muted': '#AAAAAA',
  '--fm-accent': '#FF0000',
  '--fm-accent-fg': '#FFFFFF',
  '--fm-accent-rgb': '255, 0, 0',
  '--fm-accent-subtle': 'rgba(255, 0, 0, 0.15)',
  '--fm-accent-border': 'rgba(255, 0, 0, 0.40)',
  '--fm-glass': '#212121',
  '--fm-glass-strong': '#1F1F1F',
  '--fm-glass-border': 'rgba(255, 255, 255, 0.10)',
  '--fm-glass-highlight': 'rgba(255, 255, 255, 0.12)',
  '--fm-glass-blur': '14px',
  '--fm-glass-sat': '100%',
  '--fm-glass-sheen': '0.5',
  '--fm-orb-1': 'rgba(255, 0, 0, 0.08)',
  '--fm-orb-2': 'rgba(255, 60, 60, 0.05)',
  '--fm-orb-opacity': '0.35',
  '--fm-input-bg': '#1E1E1E',
  '--fm-chip-bg': '#212121',
  '--fm-chip-text': '#FFFFFF',
  '--fm-chip-border': 'rgba(255, 255, 255, 0.12)',
};

const iosGlassDarkVars: Record<string, string> = {
  '--fm-bg': '#0A0B10',
  '--fm-bg-elevated': 'rgba(26, 27, 36, 0.72)',
  '--fm-surface-card': 'rgba(255, 255, 255, 0.055)',
  '--fm-surface-hover': 'rgba(255, 255, 255, 0.11)',
  '--fm-header-bg': 'rgba(10, 11, 16, 0.65)',
  '--fm-player-bg': 'rgba(22, 23, 32, 0.82)',
  '--fm-text': '#FFFFFF',
  '--fm-text-muted': '#94A3B8',
  '--fm-accent': '#007AFF',
  '--fm-accent-fg': '#FFFFFF',
  '--fm-accent-rgb': '0, 122, 255',
  '--fm-accent-subtle': 'rgba(0, 122, 255, 0.18)',
  '--fm-accent-border': 'rgba(0, 122, 255, 0.38)',
  '--fm-glass': 'rgba(255, 255, 255, 0.065)',
  '--fm-glass-strong': 'rgba(22, 23, 32, 0.80)',
  '--fm-glass-border': 'rgba(255, 255, 255, 0.15)',
  '--fm-glass-highlight': 'rgba(255, 255, 255, 0.25)',
  '--fm-glass-blur': '26px',
  '--fm-glass-sat': '190%',
  '--fm-glass-sheen': '1',
  '--fm-orb-1': 'rgba(0, 122, 255, 0.20)',
  '--fm-orb-2': 'rgba(168, 85, 247, 0.16)',
  '--fm-orb-opacity': '1',
  '--fm-input-bg': 'rgba(255, 255, 255, 0.07)',
  '--fm-chip-bg': 'rgba(255, 255, 255, 0.08)',
  '--fm-chip-text': '#FFFFFF',
  '--fm-chip-border': 'rgba(255, 255, 255, 0.14)',
};

const iosGlassLightVars: Record<string, string> = {
  '--fm-bg': '#EBF0F7',
  '--fm-bg-elevated': 'rgba(255, 255, 255, 0.78)',
  '--fm-surface-card': 'rgba(255, 255, 255, 0.65)',
  '--fm-surface-hover': 'rgba(255, 255, 255, 0.90)',
  '--fm-header-bg': 'rgba(235, 240, 247, 0.70)',
  '--fm-player-bg': 'rgba(255, 255, 255, 0.85)',
  '--fm-text': '#0F172A',
  '--fm-text-muted': '#475569',
  '--fm-accent': '#007AFF',
  '--fm-accent-fg': '#FFFFFF',
  '--fm-accent-rgb': '0, 122, 255',
  '--fm-accent-subtle': 'rgba(0, 122, 255, 0.15)',
  '--fm-accent-border': 'rgba(0, 122, 255, 0.35)',
  '--fm-glass': 'rgba(255, 255, 255, 0.58)',
  '--fm-glass-strong': 'rgba(255, 255, 255, 0.86)',
  '--fm-glass-border': 'rgba(15, 23, 42, 0.10)',
  '--fm-glass-highlight': 'rgba(255, 255, 255, 0.92)',
  '--fm-glass-blur': '24px',
  '--fm-glass-sat': '185%',
  '--fm-glass-sheen': '1',
  '--fm-orb-1': 'rgba(0, 122, 255, 0.18)',
  '--fm-orb-2': 'rgba(56, 189, 248, 0.20)',
  '--fm-orb-opacity': '1',
  '--fm-input-bg': 'rgba(255, 255, 255, 0.72)',
  '--fm-chip-bg': 'rgba(255, 255, 255, 0.70)',
  '--fm-chip-text': '#0F172A',
  '--fm-chip-border': 'rgba(15, 23, 42, 0.10)',
};

const modernLightVars: Record<string, string> = {
  '--fm-bg': '#FFFFFF',
  '--fm-bg-elevated': '#F8FAFC',
  '--fm-surface-card': '#FFFFFF',
  '--fm-surface-hover': '#F1F5F9',
  '--fm-header-bg': 'rgba(255, 255, 255, 0.95)',
  '--fm-player-bg': '#F8FAFC',
  '--fm-text': '#0F172A',
  '--fm-text-muted': '#64748B',
  '--fm-accent': '#FF0000',
  '--fm-accent-fg': '#FFFFFF',
  '--fm-accent-rgb': '255, 0, 0',
  '--fm-accent-subtle': 'rgba(255, 0, 0, 0.12)',
  '--fm-accent-border': 'rgba(255, 0, 0, 0.35)',
  '--fm-glass': '#F8FAFC',
  '--fm-glass-strong': '#FFFFFF',
  '--fm-glass-border': 'rgba(15, 23, 42, 0.08)',
  '--fm-glass-highlight': 'rgba(255, 255, 255, 1)',
  '--fm-glass-blur': '12px',
  '--fm-glass-sat': '100%',
  '--fm-glass-sheen': '0.5',
  '--fm-orb-1': 'rgba(255, 0, 0, 0.06)',
  '--fm-orb-2': 'rgba(255, 60, 60, 0.04)',
  '--fm-orb-opacity': '0.2',
  '--fm-input-bg': '#F1F5F9',
  '--fm-chip-bg': '#F1F5F9',
  '--fm-chip-text': '#0F172A',
  '--fm-chip-border': 'rgba(15, 23, 42, 0.08)',
};

const midnightLimeVars: Record<string, string> = {
  '--fm-bg': '#09090E',
  '--fm-bg-elevated': 'rgba(22, 23, 32, 0.72)',
  '--fm-surface-card': 'rgba(255, 255, 255, 0.06)',
  '--fm-surface-hover': 'rgba(255, 255, 255, 0.10)',
  '--fm-header-bg': 'rgba(9, 9, 14, 0.75)',
  '--fm-player-bg': 'rgba(20, 21, 30, 0.85)',
  '--fm-text': '#FFFFFF',
  '--fm-text-muted': '#B4B6C7',
  '--fm-accent': '#B9F36A',
  '--fm-accent-fg': '#0C1207',
  '--fm-accent-rgb': '185, 243, 106',
  '--fm-accent-subtle': 'rgba(185, 243, 106, 0.16)',
  '--fm-accent-border': 'rgba(185, 243, 106, 0.38)',
  '--fm-glass': 'rgba(255, 255, 255, 0.065)',
  '--fm-glass-strong': 'rgba(20, 21, 30, 0.78)',
  '--fm-glass-border': 'rgba(255, 255, 255, 0.14)',
  '--fm-glass-highlight': 'rgba(255, 255, 255, 0.24)',
  '--fm-glass-blur': '24px',
  '--fm-glass-sat': '185%',
  '--fm-glass-sheen': '1',
  '--fm-orb-1': 'rgba(185, 243, 106, 0.16)',
  '--fm-orb-2': 'rgba(94, 129, 244, 0.15)',
  '--fm-orb-opacity': '1',
  '--fm-input-bg': 'rgba(255, 255, 255, 0.06)',
  '--fm-chip-bg': 'rgba(255, 255, 255, 0.08)',
  '--fm-chip-text': '#FFFFFF',
  '--fm-chip-border': 'rgba(255, 255, 255, 0.12)',
};

const auroraCyanVars: Record<string, string> = {
  '--fm-bg': '#07101F',
  '--fm-bg-elevated': 'rgba(14, 29, 52, 0.74)',
  '--fm-surface-card': 'rgba(186, 230, 253, 0.06)',
  '--fm-surface-hover': 'rgba(186, 230, 253, 0.12)',
  '--fm-header-bg': 'rgba(7, 16, 31, 0.75)',
  '--fm-player-bg': 'rgba(10, 22, 42, 0.85)',
  '--fm-text': '#F8FAFC',
  '--fm-text-muted': '#A6BDD8',
  '--fm-accent': '#38BDF8',
  '--fm-accent-fg': '#041423',
  '--fm-accent-rgb': '56, 189, 248',
  '--fm-accent-subtle': 'rgba(56, 189, 248, 0.16)',
  '--fm-accent-border': 'rgba(56, 189, 248, 0.38)',
  '--fm-glass': 'rgba(186, 230, 253, 0.08)',
  '--fm-glass-strong': 'rgba(10, 22, 42, 0.80)',
  '--fm-glass-border': 'rgba(186, 230, 253, 0.16)',
  '--fm-glass-highlight': 'rgba(224, 242, 254, 0.28)',
  '--fm-glass-blur': '24px',
  '--fm-glass-sat': '185%',
  '--fm-glass-sheen': '1',
  '--fm-orb-1': 'rgba(56, 189, 248, 0.20)',
  '--fm-orb-2': 'rgba(45, 212, 191, 0.15)',
  '--fm-orb-opacity': '1',
  '--fm-input-bg': 'rgba(186, 230, 253, 0.07)',
  '--fm-chip-bg': 'rgba(186, 230, 253, 0.08)',
  '--fm-chip-text': '#F8FAFC',
  '--fm-chip-border': 'rgba(186, 230, 253, 0.14)',
};

const obsidianRoseVars: Record<string, string> = {
  '--fm-bg': '#110A11',
  '--fm-bg-elevated': 'rgba(34, 19, 32, 0.74)',
  '--fm-surface-card': 'rgba(255, 228, 235, 0.06)',
  '--fm-surface-hover': 'rgba(255, 228, 235, 0.12)',
  '--fm-header-bg': 'rgba(17, 10, 17, 0.75)',
  '--fm-player-bg': 'rgba(28, 15, 26, 0.85)',
  '--fm-text': '#FFF8FA',
  '--fm-text-muted': '#CEB6C2',
  '--fm-accent': '#FB7185',
  '--fm-accent-fg': '#1C060B',
  '--fm-accent-rgb': '251, 113, 133',
  '--fm-accent-subtle': 'rgba(251, 113, 133, 0.18)',
  '--fm-accent-border': 'rgba(251, 113, 133, 0.38)',
  '--fm-glass': 'rgba(255, 228, 235, 0.07)',
  '--fm-glass-strong': 'rgba(28, 15, 26, 0.82)',
  '--fm-glass-border': 'rgba(255, 220, 230, 0.15)',
  '--fm-glass-highlight': 'rgba(255, 230, 238, 0.25)',
  '--fm-glass-blur': '24px',
  '--fm-glass-sat': '185%',
  '--fm-glass-sheen': '1',
  '--fm-orb-1': 'rgba(251, 113, 133, 0.20)',
  '--fm-orb-2': 'rgba(244, 114, 182, 0.13)',
  '--fm-orb-opacity': '1',
  '--fm-input-bg': 'rgba(255, 228, 235, 0.07)',
  '--fm-chip-bg': 'rgba(255, 228, 235, 0.08)',
  '--fm-chip-text': '#FFF8FA',
  '--fm-chip-border': 'rgba(255, 220, 230, 0.14)',
};

const amberVinylVars: Record<string, string> = {
  '--fm-bg': '#110E0A',
  '--fm-bg-elevated': 'rgba(34, 27, 19, 0.75)',
  '--fm-surface-card': 'rgba(255, 243, 214, 0.06)',
  '--fm-surface-hover': 'rgba(255, 243, 214, 0.12)',
  '--fm-header-bg': 'rgba(17, 14, 10, 0.75)',
  '--fm-player-bg': 'rgba(26, 21, 15, 0.85)',
  '--fm-text': '#FFFBF2',
  '--fm-text-muted': '#CFC2AE',
  '--fm-accent': '#FBBF24',
  '--fm-accent-fg': '#1A1203',
  '--fm-accent-rgb': '251, 191, 36',
  '--fm-accent-subtle': 'rgba(251, 191, 36, 0.18)',
  '--fm-accent-border': 'rgba(251, 191, 36, 0.38)',
  '--fm-glass': 'rgba(255, 243, 214, 0.07)',
  '--fm-glass-strong': 'rgba(26, 21, 15, 0.82)',
  '--fm-glass-border': 'rgba(255, 236, 194, 0.15)',
  '--fm-glass-highlight': 'rgba(255, 244, 214, 0.24)',
  '--fm-glass-blur': '24px',
  '--fm-glass-sat': '185%',
  '--fm-glass-sheen': '1',
  '--fm-orb-1': 'rgba(251, 191, 36, 0.18)',
  '--fm-orb-2': 'rgba(249, 115, 22, 0.14)',
  '--fm-orb-opacity': '1',
  '--fm-input-bg': 'rgba(255, 243, 214, 0.07)',
  '--fm-chip-bg': 'rgba(255, 243, 214, 0.08)',
  '--fm-chip-text': '#FFFBF2',
  '--fm-chip-border': 'rgba(255, 236, 194, 0.14)',
};

export const THEMES: ThemeConfig[] = [
  {
    id: 'yt-dark',
    name: 'YouTube Music Dark',
    subtitle: 'Authentic deep black and opaque card surfaces with YouTube red',
    category: 'dark',
    isLight: false,
    previewSwatches: ['#030303', '#212121', '#FF0000'],
    colors: ytDarkVars,
    vars: ytDarkVars,
  },
  {
    id: 'ios-glass-dark',
    name: 'iOS Glass Dark',
    subtitle: 'Deep obsidian with high-translucency frosted glass and glowing orbs',
    category: 'glass-dark',
    isLight: false,
    previewSwatches: ['#0A0B10', '#1A1B24', '#007AFF'],
    colors: iosGlassDarkVars,
    vars: iosGlassDarkVars,
  },
  {
    id: 'ios-glass-light',
    name: 'iOS Glass Light',
    subtitle: 'Apple Music translucent frosted glass over soft daylight background',
    category: 'glass-light',
    isLight: true,
    previewSwatches: ['#EBF0F7', '#FFFFFF', '#007AFF'],
    colors: iosGlassLightVars,
    vars: iosGlassLightVars,
  },
  {
    id: 'modern-light',
    name: 'Modern Daylight',
    subtitle: 'Clean, high-contrast, distraction-free daylight mode',
    category: 'light',
    isLight: true,
    previewSwatches: ['#FFFFFF', '#F8FAFC', '#FF0000'],
    colors: modernLightVars,
    vars: modernLightVars,
  },
  {
    id: 'midnight-lime',
    name: 'Midnight Lime',
    subtitle: 'Deep obsidian glass with electric lime accent',
    category: 'dark',
    isLight: false,
    previewSwatches: ['#0B0B10', '#1E2420', '#B9F36A'],
    colors: midnightLimeVars,
    vars: midnightLimeVars,
  },
  {
    id: 'aurora-cyan',
    name: 'Aurora Glass',
    subtitle: 'Deep twilight slate glass with glacier cyan',
    category: 'dark',
    isLight: false,
    previewSwatches: ['#07101F', '#10223A', '#38BDF8'],
    colors: auroraCyanVars,
    vars: auroraCyanVars,
  },
  {
    id: 'obsidian-rose',
    name: 'Velvet Rose',
    subtitle: 'Smoked plum glass with warm rose-coral highlights',
    category: 'dark',
    isLight: false,
    previewSwatches: ['#120B12', '#261522', '#FB7185'],
    colors: obsidianRoseVars,
    vars: obsidianRoseVars,
  },
  {
    id: 'amber-vinyl',
    name: 'Amber Vinyl',
    subtitle: 'Warm espresso studio glass with golden amber tone',
    category: 'dark',
    isLight: false,
    previewSwatches: ['#120F0B', '#251E15', '#FBBF24'],
    colors: amberVinylVars,
    vars: amberVinylVars,
  },
];

/* ==========================================================================
   Storage Keys
   ========================================================================== */

const STORAGE_KEYS = {
  THEME: 'fm_theme_id',
  ACCENT: 'fm_accent_config',
  LIKED_TRACKS: 'fm_liked_tracks',
  PLAYLISTS: 'fm_user_playlists',
  DOWNLOADED_IDS: 'fm_downloaded_ids',
  DOWNLOADED_TRACKS: 'fm_downloaded_tracks',
  CUSTOMIZATION: 'fm_player_customization',
  SEARCH_HISTORY: 'fm_search_history',
};

/* ==========================================================================
   Theme & Accent Persistence & Application Logic
   ========================================================================== */

const DEFAULT_ACCENT_CONFIG: AccentConfig = {
  mode: 'preset',
  presetId: 'yt-red',
};

export function getStoredTheme(): BaseThemeId {
  try {
    const val = localStorage.getItem(STORAGE_KEYS.THEME) as string | null;
    if (val === 'ios-frost') return 'ios-glass-light';
    if (val && THEMES.some((t) => t.id === val)) return val as BaseThemeId;
  } catch {}
  return 'yt-dark';
}

export function setStoredTheme(themeId: BaseThemeId): void {
  try {
    localStorage.setItem(STORAGE_KEYS.THEME, themeId);
  } catch {}
}

export const loadStoredTheme = getStoredTheme;
export const saveStoredTheme = setStoredTheme;

export function getStoredAccent(): AccentConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ACCENT);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        const mode: AccentMode = ['preset', 'custom', 'dynamic'].includes(parsed.mode)
          ? parsed.mode
          : 'preset';
        return {
          mode,
          presetId: typeof parsed.presetId === 'string' ? parsed.presetId : undefined,
          customHex: typeof parsed.customHex === 'string' ? parsed.customHex : undefined,
        };
      }
    }
  } catch {}
  return { ...DEFAULT_ACCENT_CONFIG };
}

export function setStoredAccent(accent: AccentConfig): void {
  try {
    localStorage.setItem(STORAGE_KEYS.ACCENT, JSON.stringify(accent));
  } catch {}
  if (typeof document !== 'undefined') {
    if (accent.mode === 'preset' && accent.presetId) {
      const found = CURATED_ACCENTS.find((a) => a.id === accent.presetId);
      if (found) applyAccentToDocument(found.hex);
    } else if (accent.mode === 'custom' && accent.customHex) {
      applyAccentToDocument(accent.customHex);
    }
  }
}

export function applyAccentToDocument(hex: string): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const rgb = hexToRgb(hex) || { r: 255, g: 0, b: 0 };
  const fg = getAccessibleFgColor(hex);

  root.style.setProperty('--fm-accent', hex);
  root.style.setProperty('--fm-accent-fg', fg);
  root.style.setProperty('--fm-accent-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);
  root.style.setProperty('--fm-accent-subtle', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.16)`);
  root.style.setProperty('--fm-accent-border', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.40)`);
  root.style.setProperty('--fm-orb-1', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.20)`);
}

export function applyThemeToDocument(
  themeId: BaseThemeId,
  accentHexOverride?: string
): ThemeConfig {
  let normalizedId: BaseThemeId = themeId;
  if ((themeId as string) === 'ios-frost') {
    normalizedId = 'ios-glass-light';
  }
  const theme = THEMES.find((t) => t.id === normalizedId) || THEMES[0];

  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme.id);

    // Apply 24 tokens from base theme
    Object.entries(theme.vars).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });

    // Determine and apply active accent
    if (accentHexOverride) {
      applyAccentToDocument(accentHexOverride);
    } else {
      const storedAccent = getStoredAccent();
      if (storedAccent.mode === 'custom' && storedAccent.customHex) {
        applyAccentToDocument(storedAccent.customHex);
      } else if (storedAccent.mode === 'preset' && storedAccent.presetId) {
        const found = CURATED_ACCENTS.find((a) => a.id === storedAccent.presetId);
        if (found) {
          applyAccentToDocument(found.hex);
        } else {
          applyAccentToDocument(theme.vars['--fm-accent']);
        }
      }
    }

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

/* ==========================================================================
   Library, Playlists, and Player Customization (Existing Store Preserved)
   ========================================================================== */

export interface UserPlaylist {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  tracks: Track[];
}

// M3 Interface Contract Alias
export type Playlist = UserPlaylist;

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
  dynamicColorEnabled: boolean;
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
  dynamicColorEnabled: true,
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
    theme: BaseThemeId;
    accent?: AccentConfig;
    customization?: PlayerCustomization;
  };
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
    dynamicColorEnabled:
      typeof raw?.dynamicColorEnabled === 'boolean'
        ? raw.dynamicColorEnabled
        : DEFAULT_PLAYER_CUSTOMIZATION.dynamicColorEnabled,
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

export function toggleLikedTrack(track: Track): boolean {
  const current = loadLikedTracks();
  const exists = current.some((t) => t.id === track.id);
  const updated = exists ? current.filter((t) => t.id !== track.id) : [track, ...current];
  saveLikedTracks(updated);
  return !exists;
}

export function isTrackLiked(trackId: string): boolean {
  const current = loadLikedTracks();
  return current.some((t) => t.id === trackId);
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

export function renamePlaylist(playlistId: string, newName: string): UserPlaylist[] {
  const current = loadPlaylists();
  const trimmed = newName.trim();
  const updated = current.map((pl) =>
    pl.id === playlistId
      ? { ...pl, name: trimmed || pl.name, updatedAt: Date.now() }
      : pl
  );
  savePlaylists(updated);
  return updated;
}

export function loadDownloadedTracks(fallbackCatalog: Track[]): Track[] {
  try {
    const rawTracks = localStorage.getItem(STORAGE_KEYS.DOWNLOADED_TRACKS);
    if (rawTracks) {
      const parsed = JSON.parse(rawTracks);
      if (Array.isArray(parsed)) return parsed.filter(isValidTrack);
    }
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
  theme: BaseThemeId;
  accent?: AccentConfig;
  customization?: PlayerCustomization;
}): FmMusicBackup {
  return {
    version: 3,
    app: 'FM Music',
    exportedAt: new Date().toISOString(),
    likedTracks: params.likedTracks,
    playlists: params.playlists,
    downloadedTracks: params.downloadedTracks,
    settings: {
      theme: params.theme,
      accent: params.accent || getStoredAccent(),
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

  let candidateTheme = parsed?.settings?.theme;
  if (candidateTheme === 'ios-frost') candidateTheme = 'ios-glass-light';
  const theme: BaseThemeId = THEMES.some((t) => t.id === candidateTheme)
    ? candidateTheme
    : 'yt-dark';

  let accent: AccentConfig | undefined = undefined;
  if (parsed?.settings?.accent && typeof parsed.settings.accent === 'object') {
    const rawAcc = parsed.settings.accent;
    const mode: AccentMode = ['preset', 'custom', 'dynamic'].includes(rawAcc.mode)
      ? rawAcc.mode
      : 'preset';
    accent = {
      mode,
      presetId: typeof rawAcc.presetId === 'string' ? rawAcc.presetId : undefined,
      customHex: typeof rawAcc.customHex === 'string' ? rawAcc.customHex : undefined,
    };
  }

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
    settings: { theme, accent, customization },
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

export const MAX_SEARCH_HISTORY = 5;

export function addSearchHistoryItem(
  existing: string[],
  query: string,
  limit = MAX_SEARCH_HISTORY
): string[] {
  const trimmed = query.trim();
  if (!trimmed) return existing.slice(0, limit);
  const lower = trimmed.toLowerCase();
  const filtered = existing.filter((item) => item.trim().toLowerCase() !== lower);
  return [trimmed, ...filtered].slice(0, limit);
}

export function removeSearchHistoryItem(existing: string[], query: string): string[] {
  const lower = query.trim().toLowerCase();
  return existing.filter((item) => item.trim().toLowerCase() !== lower);
}

export function loadSearchHistory(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SEARCH_HISTORY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
          .slice(0, MAX_SEARCH_HISTORY);
      }
    }
  } catch {}
  return [];
}

export function saveSearchHistory(items: string[]): void {
  try {
    localStorage.setItem(
      STORAGE_KEYS.SEARCH_HISTORY,
      JSON.stringify(items.slice(0, MAX_SEARCH_HISTORY))
    );
  } catch {}
}
