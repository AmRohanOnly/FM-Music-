import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { cipherDeobfuscator } from './src/services/cipherDeobfuscator.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

interface ParsedMusicTrack {
  id: string;
  youtubeId: string;
  title: string;
  artist: string;
  album: string;
  duration: string;
  durationSeconds: number;
  thumbnailUrl: string;
  source: 'youtube_music' | 'youtube_video';
}

function parseDurationToSeconds(durationText: string): number {
  const parts = durationText
    .trim()
    .split(':')
    .map((p) => parseInt(p, 10));
  if (parts.some((n) => Number.isNaN(n))) return 210;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 210;
}

function upgradeThumbnailUrl(url: string, videoId: string): string {
  if (!url) return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  return url
    .replace(/w\d+-h\d+-l\d+-rj/, 'w544-h544-l90-rj')
    .replace(/=w\d+-h\d+/, '=w544-h544')
    .replace(/=s\d+/, '=s544');
}

async function searchYouTubeMusic(query: string, limit = 20): Promise<ParsedMusicTrack[]> {
  const results: ParsedMusicTrack[] = [];
  const seenIds = new Set<string>();

  // 1. Primary: YouTube Music InnerTube Search (Songs filter: EgWKAQIIAWoMEAMQBBAJEAoQBRAV)
  try {
    const res = await fetch('https://music.youtube.com/youtubei/v1/search?prettyPrint=false', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': USER_AGENT,
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: 'WEB_REMIX',
            clientVersion: '1.20240101.01.00',
            hl: 'en',
            gl: 'US',
          },
        },
        query,
        params: 'EgWKAQIIAWoMEAMQBBAJEAoQBRAV',
      }),
      signal: AbortSignal.timeout(6000),
    });

    if (res.ok) {
      const data = await res.json();
      const tabs = data?.contents?.tabbedSearchResultsRenderer?.tabs || [];
      const sections = tabs[0]?.tabRenderer?.content?.sectionListRenderer?.contents || [];

      for (const sec of sections) {
        const shelfContents = sec?.musicShelfRenderer?.contents || [];
        for (const entry of shelfContents) {
          const item = entry?.musicResponsiveListItemRenderer;
          if (!item) continue;

          const videoId: string | undefined =
            item?.playlistItemData?.videoId ||
            item?.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer
              ?.playNavigationEndpoint?.watchEndpoint?.videoId;

          if (!videoId || seenIds.has(videoId)) continue;

          const flexCols = item?.flexColumns || [];
          const titleRuns = flexCols[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];
          const title = titleRuns.map((r: { text?: string }) => r.text || '').join('').trim();
          if (!title) continue;

          const subRuns = flexCols[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];
          const subText = subRuns.map((r: { text?: string }) => r.text || '').join('').trim();
          const segments = subText
            .split(' • ')
            .map((s: string) => s.trim())
            .filter(Boolean);

          let duration = '3:30';
          let durationSeconds = 210;
          const lastSeg = segments[segments.length - 1] || '';
          if (/^\d+:\d{2}(:\d{2})?$/.test(lastSeg)) {
            duration = lastSeg;
            durationSeconds = parseDurationToSeconds(lastSeg);
            segments.pop();
          }

          // Remove leading "Song" / "Video" badge if present
          if (segments[0] && /^(Song|Video|Single|EP)$/i.test(segments[0])) {
            segments.shift();
          }

          const artist = segments[0] || 'YouTube Music Artist';
          const album = segments.length > 1 ? segments.slice(1).join(' • ') : 'Single';

          const thumbs = item?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails || [];
          const rawThumb = thumbs[thumbs.length - 1]?.url || '';
          const thumbnailUrl = upgradeThumbnailUrl(rawThumb, videoId);

          seenIds.add(videoId);
          results.push({
            id: `ytm_${videoId}`,
            youtubeId: videoId,
            title,
            artist,
            album,
            duration,
            durationSeconds,
            thumbnailUrl,
            source: 'youtube_music',
          });

          if (results.length >= limit) break;
        }
        if (results.length >= limit) break;
      }
    }
  } catch {
    // Fall through to general YouTube search
  }

  // 2. Fallback: General YouTube Music search without Songs filter (covers podcasts/covers/remixes)
  if (results.length === 0) {
    try {
      const res = await fetch('https://music.youtube.com/youtubei/v1/search?prettyPrint=false', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': USER_AGENT,
        },
        body: JSON.stringify({
          context: {
            client: {
              clientName: 'WEB_REMIX',
              clientVersion: '1.20240101.01.00',
              hl: 'en',
              gl: 'US',
            },
          },
          query,
        }),
        signal: AbortSignal.timeout(6000),
      });

      if (res.ok) {
        const data = await res.json();
        const tabs = data?.contents?.tabbedSearchResultsRenderer?.tabs || [];
        const sections = tabs[0]?.tabRenderer?.content?.sectionListRenderer?.contents || [];

        for (const sec of sections) {
          const shelfContents = sec?.musicShelfRenderer?.contents || [];
          for (const entry of shelfContents) {
            const item = entry?.musicResponsiveListItemRenderer;
            if (!item) continue;
            const videoId: string | undefined =
              item?.playlistItemData?.videoId ||
              item?.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer
                ?.playNavigationEndpoint?.watchEndpoint?.videoId;
            if (!videoId || seenIds.has(videoId)) continue;

            const flexCols = item?.flexColumns || [];
            const title = (flexCols[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [])
              .map((r: { text?: string }) => r.text || '')
              .join('')
              .trim();
            if (!title) continue;

            const subText = (flexCols[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [])
              .map((r: { text?: string }) => r.text || '')
              .join('')
              .trim();
            const segments = subText
              .split(' • ')
              .map((s: string) => s.trim())
              .filter(Boolean);

            let duration = '3:30';
            let durationSeconds = 210;
            const lastSeg = segments[segments.length - 1] || '';
            if (/^\d+:\d{2}(:\d{2})?$/.test(lastSeg)) {
              duration = lastSeg;
              durationSeconds = parseDurationToSeconds(lastSeg);
              segments.pop();
            }
            if (segments[0] && /^(Song|Video|Single|EP)$/i.test(segments[0])) {
              segments.shift();
            }

            const thumbs = item?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails || [];
            const rawThumb = thumbs[thumbs.length - 1]?.url || '';
            seenIds.add(videoId);
            results.push({
              id: `ytm_${videoId}`,
              youtubeId: videoId,
              title,
              artist: segments[0] || 'YouTube Music',
              album: segments.slice(1).join(' • ') || 'YouTube Music',
              duration,
              durationSeconds,
              thumbnailUrl: upgradeThumbnailUrl(rawThumb, videoId),
              source: 'youtube_music',
            });
            if (results.length >= limit) break;
          }
          if (results.length >= limit) break;
        }
      }
    } catch {
      // ignore
    }
  }

  return results;
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // 1. Live YouTube Music Full-Length Song Search
  app.get('/api/search', async (req, res) => {
    const query = String(req.query.q || '').trim();
    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    try {
      const items = await searchYouTubeMusic(query, 20);
      return res.json({
        query,
        totalResults: items.length,
        items,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Search failed';
      return res.status(500).json({ error: message, items: [] });
    }
  });

  // 2. Resolve an embeddable alternate YouTube video ID for a song title + artist
  app.get('/api/resolve-track', async (req, res) => {
    const query = String(req.query.q || '').trim();
    const exclude = String(req.query.exclude || '').trim();
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    try {
      const items = await searchYouTubeMusic(query, 8);
      for (const item of items) {
        if (item.youtubeId === exclude) continue;
        try {
          const oe = await fetch(
            `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${item.youtubeId}&format=json`,
            { signal: AbortSignal.timeout(2500) }
          );
          if (oe.ok) {
            return res.json({ found: true, track: item });
          }
        } catch {
          // try next candidate
        }
      }
      return res.json({ found: false, track: items[0] || null });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Resolve failed';
      return res.status(500).json({ found: false, error: message });
    }
  });

  // 3. Server-side InnerTube / Piped player stream extractor (bypasses browser CORS)
  app.get('/api/stream/:videoId', async (req, res) => {
    const cleanId = String(req.params.videoId || '').trim();
    if (!cleanId) {
      return res.status(400).json({ error: 'videoId is required' });
    }

    // Ensure cipher deobfuscator is preloaded
    if (!cipherDeobfuscator.getPreloadStatus().isPreloaded) {
      await cipherDeobfuscator.preloadPlayerCode().catch(() => {});
    }

    // Try InnerTube player endpoint
    try {
      const response = await fetch('https://music.youtube.com/youtubei/v1/player?prettyPrint=false', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': USER_AGENT,
        },
        body: JSON.stringify({
          context: {
            client: {
              clientName: 'WEB_REMIX',
              clientVersion: '1.20240101.01.00',
              hl: 'en',
              gl: 'US',
            },
          },
          videoId: cleanId,
        }),
        signal: AbortSignal.timeout(4500),
      });

      if (response.ok) {
        const data = await response.json();
        const adaptiveFormats = data?.streamingData?.adaptiveFormats || [];
        const audioFormats = adaptiveFormats
          .filter((f: { mimeType?: string }) => typeof f.mimeType === 'string' && f.mimeType.startsWith('audio/'))
          .sort((a: { bitrate?: number }, b: { bitrate?: number }) => (b.bitrate || 0) - (a.bitrate || 0));

        for (const format of audioFormats) {
          let resolvedAudioUrl: string | null = null;
          let cipherDeobfuscated = false;

          if (typeof format.url === 'string' && format.url.length > 0) {
            resolvedAudioUrl = cipherDeobfuscator.deobfuscateNParameter(format.url);
          } else if (format.signatureCipher || format.cipher) {
            const cipherStr = format.signatureCipher || format.cipher;
            resolvedAudioUrl = cipherDeobfuscator.deobfuscateCipherUrl(cipherStr);
            cipherDeobfuscated = true;
          }

          if (resolvedAudioUrl) {
            const expiresIn = parseInt(data.streamingData?.expiresInSeconds || '21600', 10);
            const durationSec = parseInt(data.videoDetails?.lengthSeconds || '210', 10);
            const approxDurationMs = format.approxDurationMs
              ? parseInt(format.approxDurationMs, 10)
              : durationSec * 1000;

            return res.json({
              videoId: cleanId,
              url: resolvedAudioUrl,
              mimeType: format.mimeType || 'audio/mp4; codecs="mp4a.40.2"',
              bitrate: format.bitrate || 128000,
              audioQuality: format.audioQuality || 'AUDIO_QUALITY_MEDIUM',
              itag: format.itag,
              contentLength: format.contentLength,
              expiresInSeconds: expiresIn,
              approxDurationMs,
              source: 'innertube_player',
              isSigned: true,
              cipherDeobfuscated,
              expiresAt: Date.now() + expiresIn * 1000,
            });
          }
        }
      }
    } catch {
      // Fall through to Piped
    }

    // Try Piped API fallback
    const pipedEndpoints = [
      `https://pipedapi.kavin.rocks/streams/${encodeURIComponent(cleanId)}`,
      `https://api.piped.video/streams/${encodeURIComponent(cleanId)}`,
      `https://pipedapi.tokhmi.xyz/streams/${encodeURIComponent(cleanId)}`,
    ];

    for (const endpoint of pipedEndpoints) {
      try {
        const r = await fetch(endpoint, { signal: AbortSignal.timeout(3000) });
        if (r.ok) {
          const json = await r.json();
          const audioStreams = json?.audioStreams;
          if (Array.isArray(audioStreams) && audioStreams.length > 0) {
            const bestStream = [...audioStreams].sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
            if (bestStream?.url) {
              const durationSec = typeof json.duration === 'number' ? json.duration : 210;
              return res.json({
                videoId: cleanId,
                url: bestStream.url,
                mimeType: bestStream.mimeType || 'audio/mp4',
                bitrate: bestStream.bitrate || 128000,
                audioQuality: bestStream.quality || 'HIGH',
                itag: bestStream.itag,
                contentLength: bestStream.contentLength ? String(bestStream.contentLength) : undefined,
                expiresInSeconds: 21600,
                approxDurationMs: durationSec * 1000,
                source: 'piped_api',
                isSigned: true,
                cipherDeobfuscated: true,
                expiresAt: Date.now() + 21600 * 1000,
              });
            }
          }
        }
      } catch {
        // Try next
      }
    }

    // Return full-length YouTube client playback directive (never a 30s decoy!)
    return res.json({
      videoId: cleanId,
      url: '',
      mimeType: 'audio/mp4; codecs="mp4a.40.2"',
      bitrate: 160000,
      audioQuality: 'AUDIO_QUALITY_HIGH',
      expiresInSeconds: 21600,
      source: 'youtube_full_stream',
      isSigned: true,
      cipherDeobfuscated: true,
      requiresYouTubeEngine: true,
      expiresAt: Date.now() + 21600 * 1000,
    });
  });

  // Vite middleware in dev or static serving in production
  const isProd = process.env.NODE_ENV === 'production';
  const distPath = path.join(__dirname, 'dist');

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`FM Music server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start FM Music server:', err);
  process.exit(1);
});
