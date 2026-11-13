export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export interface HslColor {
  h: number; // 0..360
  s: number; // 0..1
  l: number; // 0..1
}

export interface DynamicPalette {
  accentHex: string;
  accentFgHex: string;
  orb1Rgba: string;
  orb2Rgba: string;
  swatches: string[];
}

export function clampByte(val: number): number {
  return Math.max(0, Math.min(255, Math.round(val)));
}

export function rgbToHex({ r, g, b }: RgbColor): string {
  const toHex = (n: number) => clampByte(n).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function rgbToHsl(r: number, g: number, b: number): HslColor {
  const rn = clampByte(r) / 255;
  const gn = clampByte(g) / 255;
  const bn = clampByte(b) / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;

  if (max === min) {
    return { h: 0, s: 0, l };
  }

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h = 0;
  switch (max) {
    case rn:
      h = (gn - bn) / d + (gn < bn ? 6 : 0);
      break;
    case gn:
      h = (bn - rn) / d + 2;
      break;
    case bn:
      h = (rn - gn) / d + 4;
      break;
  }
  h *= 60;

  return { h, s, l };
}

export function hslToRgb(h: number, s: number, l: number): RgbColor {
  const hue = ((h % 360) + 360) % 360;
  const sat = Math.max(0, Math.min(1, s));
  const lig = Math.max(0, Math.min(1, l));

  if (sat === 0) {
    const v = clampByte(lig * 255);
    return { r: v, g: v, b: v };
  }

  const q = lig < 0.5 ? lig * (1 + sat) : lig + sat - lig * sat;
  const p = 2 * lig - q;
  const hueToChannel = (t: number) => {
    let tn = t;
    if (tn < 0) tn += 1;
    if (tn > 1) tn -= 1;
    if (tn < 1 / 6) return p + (q - p) * 6 * tn;
    if (tn < 1 / 2) return q;
    if (tn < 2 / 3) return p + (q - p) * (2 / 3 - tn) * 6;
    return p;
  };

  const hNorm = hue / 360;
  return {
    r: clampByte(hueToChannel(hNorm + 1 / 3) * 255),
    g: clampByte(hueToChannel(hNorm) * 255),
    b: clampByte(hueToChannel(hNorm - 1 / 3) * 255),
  };
}

export function getRelativeLuminance({ r, g, b }: RgbColor): number {
  const toLinear = (c: number) => {
    const s = clampByte(c) / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

export function getContrastRatio(a: RgbColor, b: RgbColor): number {
  const la = getRelativeLuminance(a);
  const lb = getRelativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Adjusts a dominant RGB color so it maintains WCAG AA contrast against the active theme surface
 * and chooses an accessible foreground text color (`--fm-accent-fg`).
 */
export function buildAccessiblePalette(
  primary: RgbColor,
  secondary: RgbColor,
  isLightTheme: boolean
): DynamicPalette {
  const hsl = rgbToHsl(primary.r, primary.g, primary.b);

  // Preserve neutral monochrome covers gracefully, otherwise keep vivid saturation
  const isMonochrome = hsl.s < 0.1;
  const targetSat = isMonochrome
    ? 0.08
    : isLightTheme
    ? Math.max(0.55, Math.min(0.88, hsl.s))
    : Math.max(0.58, Math.min(0.92, hsl.s));

  let targetLight = isLightTheme
    ? Math.max(0.32, Math.min(0.46, hsl.l))
    : Math.max(0.58, Math.min(0.76, hsl.l));

  const referenceBg: RgbColor = isLightTheme
    ? { r: 234, g: 240, b: 248 } // #EAF0F8 ios-frost
    : { r: 15, g: 16, b: 24 }; // dark obsidian card surface

  let adapted = hslToRgb(hsl.h, targetSat, targetLight);

  // Iteratively nudge lightness until WCAG AA (>= 4.5:1) against theme surface
  for (let i = 0; i < 12; i++) {
    if (getContrastRatio(adapted, referenceBg) >= 4.5) break;
    targetLight = isLightTheme
      ? Math.max(0.22, targetLight - 0.03)
      : Math.min(0.86, targetLight + 0.03);
    adapted = hslToRgb(hsl.h, targetSat, targetLight);
  }

  const darkFg: RgbColor = { r: 12, g: 15, b: 20 };
  const lightFg: RgbColor = { r: 255, g: 255, b: 255 };
  const fg =
    getContrastRatio(adapted, darkFg) >= getContrastRatio(adapted, lightFg)
      ? darkFg
      : lightFg;

  const secHsl = rgbToHsl(secondary.r, secondary.g, secondary.b);
  const adaptedSecondary = hslToRgb(
    secHsl.s < 0.08 ? (hsl.h + 42) % 360 : secHsl.h,
    Math.max(0.45, Math.min(0.85, secHsl.s < 0.08 ? 0.6 : secHsl.s)),
    isLightTheme ? 0.52 : 0.62
  );

  return {
    accentHex: rgbToHex(adapted),
    accentFgHex: rgbToHex(fg),
    orb1Rgba: `rgba(${adapted.r}, ${adapted.g}, ${adapted.b}, ${isLightTheme ? 0.22 : 0.22})`,
    orb2Rgba: `rgba(${adaptedSecondary.r}, ${adaptedSecondary.g}, ${adaptedSecondary.b}, ${
      isLightTheme ? 0.18 : 0.17
    })`,
    swatches: [rgbToHex(primary), rgbToHex(adapted), rgbToHex(adaptedSecondary)],
  };
}

/**
 * Extracts dominant + secondary vibrant colors from an RGBA Uint8ClampedArray/number[] buffer
 * using vibrancy-weighted hue histogram quantization.
 */
export function extractDominantPaletteFromPixels(
  rgba: Uint8ClampedArray | number[],
  isLightTheme: boolean
): DynamicPalette | null {
  if (!rgba || rgba.length < 4) return null;

  const HUE_BINS = 24; // 15 deg per bucket
  const buckets = Array.from({ length: HUE_BINS }, () => ({
    weightSum: 0,
    rSum: 0,
    gSum: 0,
    bSum: 0,
  }));

  let fallbackWeight = 0;
  let fallbackR = 0;
  let fallbackG = 0;
  let fallbackB = 0;

  for (let i = 0; i + 3 < rgba.length; i += 4) {
    const r = rgba[i];
    const g = rgba[i + 1];
    const b = rgba[i + 2];
    const a = rgba[i + 3];
    if (a < 128) continue;

    const { h, s, l } = rgbToHsl(r, g, b);

    // Keep mild fallback average for monochrome/desaturated covers
    if (l > 0.08 && l < 0.92) {
      fallbackWeight += 1;
      fallbackR += r;
      fallbackG += g;
      fallbackB += b;
    }

    // Skip near-black, near-white, or washed-out neutral pixels for vibrant dominant pick
    if (l < 0.1 || l > 0.9 || s < 0.16) continue;

    // Favor mid-luminance and higher saturation pixels
    const luminanceFactor = 1 - Math.abs(l - 0.52) * 1.3;
    const weight = (0.35 + s * 2.2) * Math.max(0.2, luminanceFactor);
    const binIdx = Math.floor((h % 360) / (360 / HUE_BINS));
    const bucket = buckets[binIdx];
    bucket.weightSum += weight;
    bucket.rSum += r * weight;
    bucket.gSum += g * weight;
    bucket.bSum += b * weight;
  }

  const ranked = buckets
    .map((b, idx) => ({ ...b, idx }))
    .filter((b) => b.weightSum > 0)
    .sort((a, b) => b.weightSum - a.weightSum);

  let primary: RgbColor;
  let secondary: RgbColor;

  if (ranked.length > 0) {
    const top = ranked[0];
    primary = {
      r: top.rSum / top.weightSum,
      g: top.gSum / top.weightSum,
      b: top.bSum / top.weightSum,
    };

    // Pick a secondary hue bin at least 2 bins (~30 deg) away for rich dual-orb contrast
    const distinctSecond = ranked.find((b) => {
      const diff = Math.abs(b.idx - top.idx);
      const wrapDiff = Math.min(diff, HUE_BINS - diff);
      return wrapDiff >= 2;
    });

    if (distinctSecond) {
      secondary = {
        r: distinctSecond.rSum / distinctSecond.weightSum,
        g: distinctSecond.gSum / distinctSecond.weightSum,
        b: distinctSecond.bSum / distinctSecond.weightSum,
      };
    } else {
      const pHsl = rgbToHsl(primary.r, primary.g, primary.b);
      secondary = hslToRgb((pHsl.h + 45) % 360, pHsl.s, pHsl.l);
    }
  } else if (fallbackWeight > 0) {
    primary = {
      r: fallbackR / fallbackWeight,
      g: fallbackG / fallbackWeight,
      b: fallbackB / fallbackWeight,
    };
    secondary = primary;
  } else {
    return null;
  }

  return buildAccessiblePalette(primary, secondary, isLightTheme);
}

// Cache raw pixel extraction results per image URL + theme polarity
const paletteCache = new Map<string, DynamicPalette | null>();

function resolveCanvasReadableUrl(imageUrl: string): string {
  if (!imageUrl) return '';
  if (imageUrl.startsWith('/') || imageUrl.startsWith('data:') || imageUrl.startsWith('blob:')) {
    return imageUrl;
  }
  try {
    const parsed = new URL(imageUrl);
    if (typeof window !== 'undefined' && parsed.origin === window.location.origin) {
      return imageUrl;
    }
    if (parsed.protocol === 'https:') {
      return `/api/artwork-proxy?url=${encodeURIComponent(imageUrl)}`;
    }
  } catch {
    return imageUrl;
  }
  return imageUrl;
}

export async function extractArtworkPalette(
  imageUrl: string,
  isLightTheme: boolean
): Promise<DynamicPalette | null> {
  if (!imageUrl || typeof document === 'undefined') return null;

  const cacheKey = `${isLightTheme ? 'L' : 'D'}:${imageUrl}`;
  if (paletteCache.has(cacheKey)) {
    return paletteCache.get(cacheKey) || null;
  }

  const targetUrl = resolveCanvasReadableUrl(imageUrl);
  if (!targetUrl) return null;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.referrerPolicy = 'no-referrer';

    const finish = (palette: DynamicPalette | null) => {
      if (paletteCache.size > 80) {
        const firstKey = paletteCache.keys().next().value;
        if (firstKey) paletteCache.delete(firstKey);
      }
      paletteCache.set(cacheKey, palette);
      resolve(palette);
    };

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const size = 48;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          finish(null);
          return;
        }
        ctx.drawImage(img, 0, 0, size, size);
        const imageData = ctx.getImageData(0, 0, size, size);
        const palette = extractDominantPaletteFromPixels(imageData.data, isLightTheme);
        finish(palette);
      } catch {
        finish(null);
      }
    };

    img.onerror = () => finish(null);
    img.src = targetUrl;
  });
}

export function applyDynamicPaletteToDocument(palette: DynamicPalette): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.style.setProperty('--fm-accent', palette.accentHex);
  root.style.setProperty('--fm-accent-fg', palette.accentFgHex);
  root.style.setProperty('--fm-orb-1', palette.orb1Rgba);
  root.style.setProperty('--fm-orb-2', palette.orb2Rgba);
}
