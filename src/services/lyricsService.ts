export interface SyncedLyricLine {
  time: number; // seconds
  text: string;
}

export interface LyricsResult {
  found: boolean;
  provider: string;
  syncedLines: SyncedLyricLine[];
  plainLines: string[];
}

const lyricsCache = new Map<string, LyricsResult>();

export async function fetchTrackLyrics(params: {
  title: string;
  artist: string;
  duration?: number;
  provider?: 'auto' | 'lrclib' | 'lyricsovh';
  fallbackLyrics?: string[];
}): Promise<LyricsResult> {
  const { title, artist, duration = 0, provider = 'auto', fallbackLyrics } = params;
  const cacheKey = `${provider}::${title.toLowerCase()}::${artist.toLowerCase()}`;
  const cached = lyricsCache.get(cacheKey);
  if (cached) return cached;

  try {
    const url = `/api/lyrics?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(
      artist
    )}&duration=${Math.round(duration)}&provider=${encodeURIComponent(provider)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(7000) });
    if (res.ok) {
      const data: LyricsResult = await res.json();
      if (data.found && (data.syncedLines.length > 0 || data.plainLines.length > 0)) {
        lyricsCache.set(cacheKey, data);
        return data;
      }
    }
  } catch {
    // Fall back to embedded track lyrics
  }

  if (fallbackLyrics && fallbackLyrics.length > 0) {
    return {
      found: true,
      provider: 'Built-in Preview',
      syncedLines: [],
      plainLines: fallbackLyrics,
    };
  }

  return {
    found: false,
    provider: 'None',
    syncedLines: [],
    plainLines: [],
  };
}
