/**
 * Track definition representing metadata requested for playback.
 */
export interface PlaybackTrack {
  id: string;
  title: string;
  artist: string;
}

export function createPlaybackTrack(id: string, title: string, artist: string): PlaybackTrack {
  if (!id || !id.trim()) {
    throw new Error('Track ID must not be blank.');
  }
  if (!title || !title.trim()) {
    throw new Error('Track title must not be blank.');
  }
  if (!artist || !artist.trim()) {
    throw new Error('Track artist must not be blank.');
  }
  return {
    id: id.trim(),
    title: title.trim(),
    artist: artist.trim(),
  };
}

const YOUTUBE_HOSTS = ['youtube.com', 'youtube-nocookie.com', 'youtu.be', 'googlevideo.com', 'ytimg.com'];

export function isYouTubeHost(host: string): boolean {
  const normalizedHost = host.toLowerCase().replace(/\.$/, '');
  return YOUTUBE_HOSTS.some(
    (domain) => normalizedHost === domain || normalizedHost.endsWith(`.${domain}`)
  );
}

/**
 * A provider-authorized audio location. The URI is sensitive and must not be logged.
 * Ports com.fmmusic.client.playback.LicensedMediaItem directly.
 */
export class LicensedMediaItem {
  readonly providerId: string;
  readonly uri: string;
  readonly title: string;
  readonly artist: string;
  readonly mimeType?: string;

  constructor(
    providerId: string,
    uri: string,
    title: string,
    artist: string,
    mimeType?: string
  ) {
    this.providerId = (providerId || '').trim();

    if (!this.providerId) {
      throw new Error('Provider ID must not be blank.');
    }

    if (this.providerId.toLowerCase() === 'innertubex') {
      throw new Error('InnerTubeX is restricted to public catalog metadata, not playback.');
    }

    if (!title || !title.trim()) {
      throw new Error('Track title must not be blank.');
    }

    if (!artist || !artist.trim()) {
      throw new Error('Track artist must not be blank.');
    }

    let parsedUrl: URL;
    try {
      // Support https, content, file schemes
      parsedUrl = new URL(uri);
    } catch {
      throw new Error('Licensed media must use an HTTPS or local content URI.');
    }

    const scheme = parsedUrl.protocol.replace(':', '').toLowerCase();
    if (!['https', 'content', 'file'].includes(scheme)) {
      throw new Error('Licensed media must use an HTTPS or local content URI.');
    }

    if (scheme === 'https') {
      if (!parsedUrl.hostname || parsedUrl.username || parsedUrl.password) {
        throw new Error('HTTPS media URIs must have a host and must not include user information.');
      }
    }

    if (parsedUrl.hostname && isYouTubeHost(parsedUrl.hostname)) {
      throw new Error("YouTube media must use YouTube's official playback experience.");
    }

    this.uri = uri;
    this.title = title.trim();
    this.artist = artist.trim();
    this.mimeType = mimeType;
  }

  toString(): string {
    return `LicensedMediaItem(providerId=${this.providerId}, uri=[REDACTED], title=${this.title}, artist=${this.artist}, mimeType=${this.mimeType ?? 'null'})`;
  }
}

/**
 * Implement this only for a provider that is authorized to stream the requested track.
 * The implementation owns provider-specific licensing, consent, and authentication.
 */
export interface LicensedPlaybackSource {
  resolve(track: PlaybackTrack): Promise<LicensedMediaItem | null>;
}

export interface PlaybackUiState {
  title: string | null;
  artist: string | null;
  isPlaying: boolean;
  isBuffering: boolean;
  errorMessage: string | null;
  hasMedia: boolean;
}
