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

  // 4. Lyrics Provider Endpoint (LRCLIB synced + plain, Lyrics.ovh fallback, optional Genius)
  app.get('/api/lyrics', async (req, res) => {
    const rawTitle = String(req.query.title || '').trim();
    const rawArtist = String(req.query.artist || '').trim();
    const duration = Number(req.query.duration || 0);
    const providerPref = String(req.query.provider || 'auto').toLowerCase();

    if (!rawTitle) {
      return res.status(400).json({ found: false, error: 'title is required', syncedLines: [], plainLines: [] });
    }

    const cleanTitle = rawTitle
      .replace(/\(feat\.[^)]*\)/gi, '')
      .replace(/\(ft\.[^)]*\)/gi, '')
      .replace(/\(from[^)]*\)/gi, '')
      .replace(/\(official[^)]*\)/gi, '')
      .replace(/\[[^\]]*\]/g, '')
      .replace(/\s*-\s*(official|lyric|audio|video).*$/i, '')
      .trim();

    const cleanArtist = rawArtist
      .split(/,|&|\bft\.?\b|\bfeat\.?\b/i)[0]
      .trim();

    const parseLrc = (lrcText: string): Array<{ time: number; text: string }> => {
      const lines: Array<{ time: number; text: string }> = [];
      for (const rawLine of lrcText.split(/\r?\n/)) {
        const match = rawLine.match(/^\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]\s*(.*)$/);
        if (!match) continue;
        const mins = parseInt(match[1], 10);
        const secs = parseInt(match[2], 10);
        const msPart = match[3] ? match[3].padEnd(3, '0').slice(0, 3) : '000';
        const time = mins * 60 + secs + parseInt(msPart, 10) / 1000;
        const text = match[4].trim();
        if (text) lines.push({ time, text });
      }
      return lines;
    };

    const tryLrclib = async () => {
      const headers = { 'User-Agent': 'FM-Music-Player/1.0 (https://github.com/fm-music)' };

      // Direct /api/get first when artist & title are present
      if (cleanArtist) {
        try {
          const getParams = new URLSearchParams({
            track_name: cleanTitle || rawTitle,
            artist_name: cleanArtist,
          });
          if (duration > 0) getParams.set('duration', String(Math.round(duration)));
          const r = await fetch(`https://lrclib.net/api/get?${getParams.toString()}`, {
            headers,
            signal: AbortSignal.timeout(4500),
          });
          if (r.ok) {
            const item = await r.json();
            const syncedLines = typeof item?.syncedLyrics === 'string' ? parseLrc(item.syncedLyrics) : [];
            const plainLines =
              typeof item?.plainLyrics === 'string'
                ? item.plainLyrics.split(/\r?\n/).map((l: string) => l.trim()).filter(Boolean)
                : [];
            if (syncedLines.length > 0 || plainLines.length > 0) {
              return {
                found: true,
                provider: syncedLines.length > 0 ? 'LRCLIB (Synced)' : 'LRCLIB',
                syncedLines,
                plainLines: plainLines.length > 0 ? plainLines : syncedLines.map((l) => l.text),
              };
            }
          }
        } catch {
          // fall through to LRCLIB search
        }
      }

      // Fuzzy /api/search
      try {
        const q = `${cleanTitle || rawTitle} ${cleanArtist}`.trim();
        const r = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(q)}`, {
          headers,
          signal: AbortSignal.timeout(4500),
        });
        if (r.ok) {
          const arr = await r.json();
          if (Array.isArray(arr) && arr.length > 0) {
            const best =
              arr.find((entry: any) => typeof entry?.syncedLyrics === 'string' && entry.syncedLyrics.trim()) ||
              arr.find((entry: any) => typeof entry?.plainLyrics === 'string' && entry.plainLyrics.trim());
            if (best) {
              const syncedLines = typeof best.syncedLyrics === 'string' ? parseLrc(best.syncedLyrics) : [];
              const plainLines =
                typeof best.plainLyrics === 'string'
                  ? best.plainLyrics.split(/\r?\n/).map((l: string) => l.trim()).filter(Boolean)
                  : [];
              if (syncedLines.length > 0 || plainLines.length > 0) {
                return {
                  found: true,
                  provider: syncedLines.length > 0 ? 'LRCLIB (Synced)' : 'LRCLIB',
                  syncedLines,
                  plainLines: plainLines.length > 0 ? plainLines : syncedLines.map((l) => l.text),
                };
              }
            }
          }
        }
      } catch {
        // ignore
      }

      return null;
    };

    const tryLyricsOvh = async () => {
      if (!cleanArtist || !(cleanTitle || rawTitle)) return null;
      try {
        const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(cleanArtist)}/${encodeURIComponent(
          cleanTitle || rawTitle
        )}`;
        const r = await fetch(url, { signal: AbortSignal.timeout(4500) });
        if (r.ok) {
          const data = await r.json();
          if (typeof data?.lyrics === 'string' && data.lyrics.trim()) {
            const plainLines = data.lyrics
              .split(/\r?\n/)
              .map((l: string) => l.trim())
              .filter(Boolean);
            if (plainLines.length > 0) {
              return {
                found: true,
                provider: 'Lyrics.ovh',
                syncedLines: [],
                plainLines,
              };
            }
          }
        }
      } catch {
        // ignore
      }
      return null;
    };

    if (providerPref === 'lyricsovh') {
      const ovh = await tryLyricsOvh();
      if (ovh) return res.json(ovh);
      return res.json({ found: false, provider: 'Lyrics.ovh', syncedLines: [], plainLines: [] });
    }

    const lrc = await tryLrclib();
    if (lrc) return res.json(lrc);

    if (providerPref !== 'lrclib') {
      const ovh = await tryLyricsOvh();
      if (ovh) return res.json(ovh);
    }

    return res.json({ found: false, provider: 'None', syncedLines: [], plainLines: [] });
  });

  // 5. Same-origin Artwork Image Proxy for CORS-safe Canvas Dynamic Color Extraction
  app.get('/api/artwork-proxy', async (req, res) => {
    const rawUrl = String(req.query.url || '').trim();
    if (!rawUrl) {
      return res.status(400).json({ error: 'url is required' });
    }

    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      return res.status(400).json({ error: 'Invalid URL' });
    }

    if (parsed.protocol !== 'https:') {
      return res.status(400).json({ error: 'Only HTTPS URLs allowed' });
    }

    const host = parsed.hostname.toLowerCase();
    const isAllowedHost =
      host === 'i.ytimg.com' ||
      host === 'img.youtube.com' ||
      host === 'yt3.ggpht.com' ||
      host.endsWith('.ytimg.com') ||
      host.endsWith('.googleusercontent.com');

    if (!isAllowedHost) {
      return res.status(403).json({ error: 'Artwork host not allowlisted' });
    }

    try {
      const upstream = await fetch(parsed.toString(), {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(4500),
      });
      if (!upstream.ok) {
        return res.status(upstream.status).end();
      }
      const contentType = upstream.headers.get('content-type') || 'image/jpeg';
      if (!contentType.startsWith('image/')) {
        return res.status(415).json({ error: 'Unsupported media type' });
      }
      const buffer = Buffer.from(await upstream.arrayBuffer());
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.send(buffer);
    } catch {
      return res.status(502).end();
    }
  });

  // 6. Serve local Android APK directly for testing & sideloading
  app.get('/api/download-apk', (_req, res) => {
    const candidates = [
      path.join(__dirname, 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk'),
      path.join(__dirname, '.build-outputs', 'app-debug.apk'),
      path.join(__dirname, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk'),
    ];
    const apkPath = candidates.find((p) => fs.existsSync(p));
    if (!apkPath) {
      return res.status(404).json({
        error: 'Built APK not found locally. Push to GitHub to build via GitHub Actions.',
      });
    }

    const stat = fs.statSync(apkPath);
    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    res.setHeader('Content-Disposition', 'attachment; filename="FM-Music-Android.apk"');
    res.setHeader('Content-Length', String(stat.size));
    res.setHeader('Cache-Control', 'no-cache');
    return res.sendFile(apkPath, { dotfiles: 'allow' });
  });

  // 6b. Self-Hosted Android APK Update Manifest Feed
  app.get('/api/update-manifest.json', (req, res) => {
    const manifestCandidates = [
      path.join(__dirname, 'dist-apk', 'update-manifest.json'),
      path.join(__dirname, '.build-outputs', 'update-manifest.json'),
    ];
    const existingManifest = manifestCandidates.find((p) => fs.existsSync(p));
    if (existingManifest) {
      try {
        const parsed = JSON.parse(fs.readFileSync(existingManifest, 'utf8'));
        res.setHeader('Cache-Control', 'no-cache');
        return res.json(parsed);
      } catch {
        // fallback below
      }
    }

    const apkCandidates = [
      path.join(__dirname, 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk'),
      path.join(__dirname, '.build-outputs', 'app-debug.apk'),
      path.join(__dirname, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk'),
    ];
    const apkPath = apkCandidates.find((p) => fs.existsSync(p));
    const stat = apkPath ? fs.statSync(apkPath) : null;
    const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'https').split(',')[0].trim();
    const host = req.get('host') || 'localhost:3000';

    res.setHeader('Cache-Control', 'no-cache');
    return res.json({
      appName: 'FM Music',
      packageId: 'com.fmmusic.client',
      versionCode: 1,
      versionName: '1.0.0',
      tagName: 'v1.0.0',
      apkUrl: `${proto}://${host}/api/download-apk`,
      sizeBytes: stat ? stat.size : 0,
      publishedAt: stat ? stat.mtime.toISOString() : new Date().toISOString(),
      releaseNotes: 'FM Music Android release build.',
      mandatory: false,
    });
  });

  // 6c. Automated Update Config Endpoint
  app.get('/api/app-update/config', (_req, res) => {
    const defaultRepo = String(process.env.GITHUB_REPO || process.env.VITE_GITHUB_REPO || '').trim();
    return res.json({
      defaultRepo,
      currentVersion: '1.0.0',
    });
  });

  // 7. GitHub Releases / Packages & Direct Manifest Auto-Update Check Endpoint
  app.get('/api/app-update', async (req, res) => {
    const rawRepo = String(
      req.query.repo || process.env.GITHUB_REPO || process.env.VITE_GITHUB_REPO || ''
    ).trim();
    const currentVersion = String(req.query.currentVersion || '1.0.0').trim() || '1.0.0';

    const compareVersions = (remote: string, current: string): number => {
      const parse = (v: string) =>
        v
          .trim()
          .replace(/^v/i, '')
          .split('-')[0]
          .split('.')
          .map((p) => {
            const m = p.match(/^\d+/);
            return m ? parseInt(m[0], 10) : 0;
          });
      const a = parse(remote);
      const b = parse(current);
      const len = Math.max(a.length, b.length, 3);
      for (let i = 0; i < len; i++) {
        const av = a[i] ?? 0;
        const bv = b[i] ?? 0;
        if (av > bv) return 1;
        if (av < bv) return -1;
      }
      return 0;
    };

    // Support direct https://.../update-manifest.json self-hosted feed URLs
    const lowerRaw = rawRepo.toLowerCase();
    if (lowerRaw.startsWith('https://') && !lowerRaw.startsWith('https://github.com/')) {
      try {
        const mRes = await fetch(rawRepo, {
          headers: { Accept: 'application/json', 'User-Agent': 'FM-Music-Updater/1.0' },
          signal: AbortSignal.timeout(6000),
        });
        if (!mRes.ok) {
          return res.status(502).json({ error: `Manifest URL returned HTTP ${mRes.status}` });
        }
        const mJson = await mRes.json();
        const latestVersion = String(mJson?.versionName || currentVersion).replace(/^v/i, '').trim();
        const tagName = String(mJson?.tagName || `v${latestVersion}`);
        return res.json({
          repo: rawRepo,
          currentVersion,
          latestVersion,
          tagName,
          versionCode: typeof mJson?.versionCode === 'number' ? mJson.versionCode : null,
          updateAvailable: compareVersions(latestVersion, currentVersion) > 0,
          releaseTitle: `FM Music ${tagName}`,
          releaseNotes: String(mJson?.releaseNotes || '').trim(),
          apkDownloadUrl: mJson?.apkUrl || null,
          releasePageUrl: rawRepo,
          packagesUrl: rawRepo,
          sizeBytes: Number(mJson?.sizeBytes || 0),
          publishedAt: String(mJson?.publishedAt || ''),
          mandatory: Boolean(mJson?.mandatory),
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to fetch update manifest URL';
        return res.status(502).json({ error: message });
      }
    }

    const cleanRepo = rawRepo
      .replace(/^https?:\/\/github\.com\//i, '')
      .replace(/^github\.com\//i, '')
      .replace(/\.git$/i, '')
      .replace(/^\/+|\/+$/g, '');

    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(cleanRepo)) {
      return res.status(400).json({ error: 'Enter owner/repo or a direct https://.../update-manifest.json URL.' });
    }

    const packagesUrl = `https://github.com/${cleanRepo}?tab=packages`;
    const fallbackReleasePage = `https://github.com/${cleanRepo}/releases`;

    try {
      const ghRes = await fetch(`https://api.github.com/repos/${cleanRepo}/releases/latest`, {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'FM-Music-Updater/1.0',
        },
        signal: AbortSignal.timeout(6000),
      });

      if (ghRes.status === 404) {
        return res.json({
          repo: cleanRepo,
          currentVersion,
          latestVersion: currentVersion,
          tagName: '',
          versionCode: null,
          updateAvailable: false,
          releaseTitle: '',
          releaseNotes: '',
          apkDownloadUrl: null,
          releasePageUrl: fallbackReleasePage,
          packagesUrl,
          sizeBytes: 0,
          publishedAt: '',
          mandatory: false,
        });
      }

      if (!ghRes.ok) {
        return res.status(502).json({
          error: `GitHub API returned status ${ghRes.status}`,
        });
      }

      const release = await ghRes.json();
      const assets: Array<{ name?: string; browser_download_url?: string; size?: number }> =
        Array.isArray(release?.assets) ? release.assets : [];

      const apkAsset =
        assets.find((a) => typeof a.name === 'string' && a.name.toLowerCase().endsWith('-latest.apk')) ||
        assets.find((a) => typeof a.name === 'string' && a.name.toLowerCase().endsWith('.apk')) ||
        null;

      const manifestAsset =
        assets.find((a) => typeof a.name === 'string' && a.name.toLowerCase() === 'update-manifest.json') ||
        null;

      let manifestData: {
        versionName?: string;
        versionCode?: number;
        releaseNotes?: string;
        apkUrl?: string;
        sizeBytes?: number;
        publishedAt?: string;
        mandatory?: boolean;
      } | null = null;

      if (manifestAsset?.browser_download_url) {
        try {
          const mRes = await fetch(manifestAsset.browser_download_url, {
            headers: { 'User-Agent': 'FM-Music-Updater/1.0' },
            signal: AbortSignal.timeout(4000),
          });
          if (mRes.ok) {
            manifestData = await mRes.json();
          }
        } catch {
          // Optional manifest fallback
        }
      }

      const tagName = String(release?.tag_name || '');
      const latestVersion =
        String(manifestData?.versionName || '').trim() || tagName.replace(/^v/i, '').trim() || currentVersion;
      const versionCode = typeof manifestData?.versionCode === 'number' ? manifestData.versionCode : null;
      const apkDownloadUrl = manifestData?.apkUrl || apkAsset?.browser_download_url || null;
      const sizeBytes = Number(manifestData?.sizeBytes || apkAsset?.size || 0);
      const releaseNotes = String(manifestData?.releaseNotes || release?.body || '').trim();
      const publishedAt = String(manifestData?.publishedAt || release?.published_at || '');
      const releasePageUrl = String(release?.html_url || fallbackReleasePage);
      const releaseTitle = String(release?.name || tagName || `v${latestVersion}`);

      const updateAvailable = compareVersions(latestVersion, currentVersion) > 0;

      return res.json({
        repo: cleanRepo,
        currentVersion,
        latestVersion,
        tagName,
        versionCode,
        updateAvailable,
        releaseTitle,
        releaseNotes,
        apkDownloadUrl,
        releasePageUrl,
        packagesUrl,
        sizeBytes,
        publishedAt,
        mandatory: Boolean(manifestData?.mandatory),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to query GitHub Releases';
      return res.status(502).json({ error: message });
    }
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
