import { Track } from '../data/musicCatalog';
import { musicNetworkClient, StreamFormatInfo } from './musicNetworkClient';
import { loadPlayerCustomization, loadLikedTracks } from './libraryStore';
import { webAudioEqualizer, EqualizerConfig } from './webAudioEqualizer';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: (() => void) | undefined;
  }
}

export type ShuffleMode = 'off' | 'standard' | 'smart';

export interface SkipRecord {
  count: number;
  lastSkippedAt: number;
}

export interface SmartShuffleContext {
  favoriteTrackIds: Set<string>;
  recentlySkipped: Map<string, SkipRecord>;
  recentHistory: string[];
  now?: number;
}

/**
 * Computes a weighted selection score for Smart Shuffle:
 * - Favorites receive a strong positive boost (3.2x)
 * - Recently skipped tracks receive an exponential penalty (0.22^count, recovering over 30m)
 * - Very recently played tracks receive a cooldown penalty (0.2x) to keep variety high
 */
export function computeSmartTrackWeight(
  trackId: string,
  ctx: SmartShuffleContext
): number {
  const now = ctx.now ?? Date.now();
  let weight = 1.0;

  if (ctx.favoriteTrackIds.has(trackId)) {
    weight *= 3.2;
  }

  const skipInfo = ctx.recentlySkipped.get(trackId);
  if (skipInfo && skipInfo.count > 0) {
    const elapsedMinutes = Math.max(0, (now - skipInfo.lastSkippedAt) / 60_000);
    // Skip penalty is strongest within 30 minutes and recovers smoothly afterwards
    const recencyFactor = Math.max(0, 1 - elapsedMinutes / 30);
    const rawPenalty = Math.pow(0.22, Math.min(skipInfo.count, 3));
    const effectiveMultiplier = 1 - recencyFactor * (1 - rawPenalty);
    weight *= effectiveMultiplier;
  }

  const recentLen = ctx.recentHistory.length;
  if (recentLen > 0) {
    const idx = ctx.recentHistory.lastIndexOf(trackId);
    if (idx !== -1 && recentLen - idx <= 3) {
      weight *= 0.2;
    }
  }

  return Math.max(0.03, weight);
}

/**
 * Picks a candidate track index using weighted roulette-wheel selection.
 */
export function pickSmartShuffleCandidate(
  queue: Track[],
  currentTrackId: string | undefined,
  ctx: SmartShuffleContext,
  rng: () => number = Math.random
): number {
  if (queue.length === 0) return -1;
  if (queue.length === 1) return 0;

  const candidates: Array<{ index: number; weight: number }> = [];
  for (let i = 0; i < queue.length; i++) {
    const track = queue[i];
    if (track.id === currentTrackId) continue;
    candidates.push({
      index: i,
      weight: computeSmartTrackWeight(track.id, ctx),
    });
  }

  if (candidates.length === 0) return 0;

  const totalWeight = candidates.reduce((sum, c) => sum + c.weight, 0);
  let target = rng() * totalWeight;
  for (const candidate of candidates) {
    target -= candidate.weight;
    if (target <= 0) {
      return candidate.index;
    }
  }
  return candidates[candidates.length - 1].index;
}

/**
 * Formats raw MIME/codec strings (e.g. 'audio/webm; codecs="opus"', 'audio/mp4; codecs="mp4a.40.2"')
 * and bitrate in bps into a concise, transparent audio quality label (e.g. '160 kbps · Opus').
 */
export function formatAudioQualityLabel(
  mimeType?: string,
  bitrate?: number,
  fallbackLabel = 'Adaptive Stream'
): string {
  const kbps = typeof bitrate === 'number' && bitrate > 0 ? Math.round(bitrate / 1000) : null;
  let codec = '';

  if (typeof mimeType === 'string' && mimeType.trim()) {
    const lower = mimeType.toLowerCase();
    if (lower.includes('opus')) {
      codec = 'Opus';
    } else if (lower.includes('mp4a') || lower.includes('aac')) {
      codec = 'AAC';
    } else if (lower.includes('flac')) {
      codec = 'FLAC';
    } else if (lower.includes('mpeg') || lower.includes('mp3')) {
      codec = 'MP3';
    } else if (lower.includes('vorbis')) {
      codec = 'Vorbis';
    } else if (lower.includes('webm')) {
      codec = 'WebM Audio';
    } else if (lower.includes('mp4')) {
      codec = 'M4A / AAC';
    } else {
      const sub = lower.split(';')[0]?.split('/')[1]?.trim();
      if (sub) codec = sub.toUpperCase();
    }
  }

  if (kbps && codec) return `${kbps} kbps · ${codec}`;
  if (kbps) return `${kbps} kbps`;
  if (codec) return codec;
  return fallbackLabel;
}

export interface InAppPlayerState {
  currentTrack: Track | null;
  queue: Track[];
  queueIndex: number;
  isPlaying: boolean;
  isBuffering: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isShuffle: boolean;
  shuffleMode: ShuffleMode;
  skippedTrackCount: number;
  repeatMode: 'off' | 'all' | 'one';
  crossfadeSeconds: number;
  isCrossfading: boolean;
  playbackRate: number;
  sleepTimerEndAt: number | null;
  sleepTimerRemainingSec: number | null;
  sleepAtTrackEnd: boolean;
  streamEngine: 'local_audio' | 'youtube_iframe';
  streamSource?: string;
  streamBitrate?: number;
  streamMimeType?: string;
  isSignedStream: boolean;
  extractedStreamUrl?: string;
}

type PlayerStateListener = (state: InAppPlayerState) => void;

class InAppPlayerManager {
  private ytPlayer: any = null;
  private ytReady = false;
  private pendingYouTubeTrack: { track: Track; startSeconds: number } | null = null;
  private failedVideoIds = new Set<string>();
  private audioFallback: HTMLAudioElement | null = null;
  private currentMode: 'youtube' | 'audio' = 'youtube';
  private containerId = 'fm-yt-hidden-player';
  private listeners = new Set<PlayerStateListener>();
  private progressInterval: any = null;
  private sleepInterval: any = null;
  private fadeInterval: any = null;
  private activeExtractionRequestId = 0;
  private crossfadeTriggeredForTrackId: string | null = null;
  private favoriteTrackIds = new Set<string>();
  private recentlySkipped = new Map<string, SkipRecord>();
  private recentHistory: string[] = [];
  private smartShufflePreferred = true;

  private state: InAppPlayerState = {
    currentTrack: null,
    queue: [],
    queueIndex: -1,
    isPlaying: false,
    isBuffering: false,
    currentTime: 0,
    duration: 0,
    volume: 80,
    isMuted: false,
    isShuffle: false,
    shuffleMode: 'off',
    skippedTrackCount: 0,
    repeatMode: 'off',
    crossfadeSeconds: 4,
    isCrossfading: false,
    playbackRate: 1,
    sleepTimerEndAt: null,
    sleepTimerRemainingSec: null,
    sleepAtTrackEnd: false,
    streamEngine: 'youtube_iframe',
    streamSource: undefined,
    streamBitrate: undefined,
    streamMimeType: undefined,
    isSignedStream: false,
    extractedStreamUrl: undefined,
  };

  constructor() {
    if (typeof window !== 'undefined') {
      const savedCustom = loadPlayerCustomization();
      this.state.crossfadeSeconds = savedCustom.crossfadeSeconds;
      this.state.playbackRate = savedCustom.playbackRate;
      this.smartShufflePreferred = savedCustom.smartShuffleEnabled;
      this.favoriteTrackIds = new Set(loadLikedTracks().map((t) => t.id));
      webAudioEqualizer.applyConfig(savedCustom.equalizer);
      this.initAudioFallback();
      this.initYouTubeApi();
      this.startProgressTracker();
      this.startSleepTimerLoop();
    }
  }

  private initAudioFallback() {
    this.audioFallback = new Audio();
    this.audioFallback.crossOrigin = 'anonymous';
    webAudioEqualizer.attachAudioElement(this.audioFallback);
    this.audioFallback.addEventListener('play', () => {
      this.state.isPlaying = true;
      this.state.isBuffering = false;
      if (this.audioFallback) {
        this.audioFallback.playbackRate = this.state.playbackRate;
      }
      this.publish();
    });
    this.audioFallback.addEventListener('pause', () => {
      if (this.currentMode === 'audio') {
        this.state.isPlaying = false;
        this.publish();
      }
    });
    this.audioFallback.addEventListener('ended', () => {
      if (this.currentMode === 'audio') {
        this.handleTrackEnded();
      }
    });
    this.audioFallback.addEventListener('timeupdate', () => {
      if (this.currentMode === 'audio' && this.audioFallback) {
        this.state.currentTime = this.audioFallback.currentTime;
        const knownDuration = this.state.currentTrack?.duration || 0;
        const mediaDuration = this.audioFallback.duration;
        if (typeof mediaDuration === 'number' && !isNaN(mediaDuration) && mediaDuration > 45) {
          this.state.duration = mediaDuration;
        } else if (knownDuration > 0) {
          this.state.duration = knownDuration;
        } else if (typeof mediaDuration === 'number' && !isNaN(mediaDuration) && mediaDuration > 0) {
          this.state.duration = mediaDuration;
        }
        this.evaluateCrossfadeWindow();
        this.publish();
      }
    });
    this.audioFallback.addEventListener('waiting', () => {
      if (this.currentMode === 'audio') {
        this.state.isBuffering = true;
        this.publish();
      }
    });
    this.audioFallback.addEventListener('playing', () => {
      if (this.currentMode === 'audio') {
        this.state.isBuffering = false;
        this.publish();
      }
    });
  }

  private initYouTubeApi() {
    if (window.YT && window.YT.Player) {
      this.createYouTubePlayer();
      return;
    }

    const prevReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (prevReady) prevReady();
      this.createYouTubePlayer();
    };

    if (!document.getElementById('yt-iframe-api-script')) {
      const tag = document.createElement('script');
      tag.id = 'yt-iframe-api-script';
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }
  }

  private createYouTubePlayer() {
    let container = document.getElementById(this.containerId);
    if (!container) {
      container = document.createElement('div');
      container.id = this.containerId;
      container.style.position = 'fixed';
      container.style.bottom = '80px';
      container.style.right = '0px';
      container.style.width = '200px';
      container.style.height = '200px';
      container.style.opacity = '0.001';
      container.style.pointerEvents = 'none';
      container.style.zIndex = '0';
      document.body.appendChild(container);
    }

    try {
      this.ytPlayer = new window.YT.Player(this.containerId, {
        height: '200',
        width: '200',
        videoId: '',
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          rel: 0,
          playsinline: 1,
          enablejsapi: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
            this.ytReady = true;
            this.applyEffectiveVolume(this.state.isMuted ? 0 : this.state.volume);
            try {
              this.ytPlayer.setPlaybackRate?.(this.state.playbackRate);
            } catch {}
            if (this.pendingYouTubeTrack) {
              const pending = this.pendingYouTubeTrack;
              this.pendingYouTubeTrack = null;
              this.playViaYouTubeIframe(pending.track, pending.startSeconds);
            }
          },
          onStateChange: (event: any) => {
            if (this.currentMode !== 'youtube') return;
            const state = event.data;
            if (state === 1) {
              this.state.isPlaying = true;
              this.state.isBuffering = false;
              const dur = this.ytPlayer.getDuration?.();
              if (typeof dur === 'number' && !isNaN(dur) && dur > 0) {
                this.state.duration = dur;
              }
              try {
                this.ytPlayer.setPlaybackRate?.(this.state.playbackRate);
              } catch {}
              this.publish();
            } else if (state === 2) {
              this.state.isPlaying = false;
              this.state.isBuffering = false;
              this.publish();
            } else if (state === 3) {
              this.state.isBuffering = true;
              this.publish();
            } else if (state === 0) {
              this.handleTrackEnded();
            }
          },
          onError: async () => {
            const track = this.state.currentTrack;
            if (track?.youtubeId && !this.failedVideoIds.has(track.youtubeId)) {
              this.failedVideoIds.add(track.youtubeId);
              const altId = await musicNetworkClient.resolveAlternateVideoId(
                track.title,
                track.artist,
                track.youtubeId
              );
              if (altId && !this.failedVideoIds.has(altId) && this.state.currentTrack?.id === track.id) {
                const updatedTrack = { ...track, youtubeId: altId };
                this.state.currentTrack = updatedTrack;
                this.playViaYouTubeIframe(updatedTrack, this.state.currentTime);
                return;
              }
            }

            if (track?.fallbackAudio && this.audioFallback) {
              this.currentMode = 'audio';
              this.audioFallback.src = track.fallbackAudio;
              this.audioFallback.play().catch(() => {});
            } else {
              this.state.isBuffering = false;
              this.state.isPlaying = false;
              this.publish();
            }
          },
        },
      });
    } catch {
      // Ignored, will fallback gracefully
    }
  }

  private applyEffectiveVolume(volPercent: number) {
    const clamped = Math.max(0, Math.min(100, volPercent));
    if (this.ytPlayer && this.ytReady) {
      try {
        if (clamped === 0) {
          this.ytPlayer.setVolume?.(0);
        } else {
          this.ytPlayer.unMute?.();
          this.ytPlayer.setVolume?.(clamped);
        }
      } catch {}
    }
    if (this.audioFallback) {
      this.audioFallback.muted = clamped === 0;
      this.audioFallback.volume = clamped / 100;
    }
  }

  private clearActiveFade() {
    if (this.fadeInterval) {
      clearInterval(this.fadeInterval);
      this.fadeInterval = null;
    }
    if (this.state.isCrossfading) {
      this.state.isCrossfading = false;
    }
  }

  private fadeInIncoming(durationMs: number) {
    this.clearActiveFade();
    if (this.state.isMuted || this.state.volume <= 0 || durationMs <= 0) {
      this.applyEffectiveVolume(this.state.isMuted ? 0 : this.state.volume);
      return;
    }

    const targetVol = this.state.volume;
    const steps = 16;
    const stepMs = Math.max(50, Math.round(durationMs / steps));
    let step = 0;

    this.state.isCrossfading = true;
    this.applyEffectiveVolume(Math.max(4, Math.round(targetVol * 0.1)));

    this.fadeInterval = setInterval(() => {
      step += 1;
      const ratio = Math.min(1, step / steps);
      this.applyEffectiveVolume(Math.round(targetVol * ratio));
      if (ratio >= 1) {
        this.clearActiveFade();
        this.publish();
      }
    }, stepMs);
  }

  private evaluateCrossfadeWindow() {
    const cf = this.state.crossfadeSeconds;
    const track = this.state.currentTrack;
    if (
      !track ||
      !this.state.isPlaying ||
      cf <= 0 ||
      this.state.sleepAtTrackEnd ||
      this.state.repeatMode === 'one' ||
      this.state.queue.length <= 1 ||
      this.state.duration < cf + 6
    ) {
      return;
    }

    // Do not auto-crossfade off the last track if repeat is off
    const isLastTrack = this.state.queueIndex >= this.state.queue.length - 1;
    if (isLastTrack && this.state.repeatMode === 'off' && !this.state.isShuffle) {
      return;
    }

    const remaining = this.state.duration - this.state.currentTime;
    if (remaining <= cf && remaining > 0) {
      if (remaining <= 0.65 && this.crossfadeTriggeredForTrackId !== track.id) {
        this.crossfadeTriggeredForTrackId = track.id;
        this.state.isCrossfading = true;
        this.recordTrackCompleted(track.id);
        this.next(true, true);
      } else if (remaining > 0.65 && this.crossfadeTriggeredForTrackId !== track.id) {
        this.state.isCrossfading = true;
        const ratio = Math.max(0.05, remaining / cf);
        const target = this.state.isMuted ? 0 : this.state.volume;
        this.applyEffectiveVolume(Math.round(target * ratio));
      }
    }
  }

  private startProgressTracker() {
    this.progressInterval = setInterval(() => {
      if (
        this.currentMode === 'youtube' &&
        this.ytPlayer &&
        this.ytReady &&
        (this.state.isPlaying || this.state.isBuffering)
      ) {
        try {
          const cur = this.ytPlayer.getCurrentTime?.();
          const dur = this.ytPlayer.getDuration?.();
          if (typeof cur === 'number' && !isNaN(cur)) {
            this.state.currentTime = cur;
          }
          if (typeof dur === 'number' && !isNaN(dur) && dur > 0) {
            this.state.duration = dur;
          } else if (this.state.currentTrack) {
            this.state.duration = this.state.currentTrack.duration;
          }
          this.evaluateCrossfadeWindow();
          this.publish();
        } catch {
          // ignore
        }
      }
    }, 350);
  }

  private startSleepTimerLoop() {
    this.sleepInterval = setInterval(() => {
      if (!this.state.sleepTimerEndAt) return;
      const msLeft = this.state.sleepTimerEndAt - Date.now();
      if (msLeft <= 0) {
        this.state.sleepTimerEndAt = null;
        this.state.sleepTimerRemainingSec = null;
        this.clearActiveFade();
        this.pause();
        this.applyEffectiveVolume(this.state.isMuted ? 0 : this.state.volume);
        this.publish();
        return;
      }

      const secLeft = Math.ceil(msLeft / 1000);
      this.state.sleepTimerRemainingSec = secLeft;

      // Gentle 5-second fade out before pausing
      if (secLeft <= 5 && this.state.isPlaying && !this.state.isMuted) {
        const fadeRatio = Math.max(0.1, msLeft / 5000);
        this.applyEffectiveVolume(Math.round(this.state.volume * fadeRatio));
      }
      this.publish();
    }, 1000);
  }

  public subscribe(listener: PlayerStateListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getState(): InAppPlayerState {
    return { ...this.state };
  }

  private publish() {
    const s = this.getState();
    this.listeners.forEach((fn) => fn(s));
  }

  public playTrack(track: Track, newQueue?: Track[], withFadeIn = false) {
    this.clearActiveFade();
    this.crossfadeTriggeredForTrackId = null;

    if (newQueue) {
      this.state.queue = newQueue;
      this.state.queueIndex = newQueue.findIndex((t) => t.id === track.id);
    } else if (!this.state.queue.some((t) => t.id === track.id)) {
      this.state.queue.push(track);
      this.state.queueIndex = this.state.queue.length - 1;
    } else {
      this.state.queueIndex = this.state.queue.findIndex((t) => t.id === track.id);
    }

    this.state.currentTrack = track;
    this.state.currentTime = 0;
    this.state.duration = track.duration;
    this.state.isBuffering = true;
    this.state.streamBitrate = undefined;
    this.state.streamMimeType = undefined;
    this.state.extractedStreamUrl = undefined;
    this.recentHistory.push(track.id);
    if (this.recentHistory.length > 12) {
      this.recentHistory.shift();
    }
    webAudioEqualizer.resumeIfSuspended().catch(() => {});
    this.publish();

    if (withFadeIn && this.state.crossfadeSeconds > 0) {
      this.fadeInIncoming(Math.min(this.state.crossfadeSeconds, 4) * 1000);
    } else {
      this.applyEffectiveVolume(this.state.isMuted ? 0 : this.state.volume);
    }

    const currentRequestId = ++this.activeExtractionRequestId;
    const videoId = track.youtubeId;

    const resolveStreamMetadata = (targetVideoId: string) => {
      musicNetworkClient
        .extractPlayerStreamUrl(targetVideoId)
        .then((streamInfo: StreamFormatInfo) => {
          if (this.activeExtractionRequestId !== currentRequestId) return;

          if (streamInfo.approxDurationMs && streamInfo.approxDurationMs > 30000) {
            const streamSec = Math.round(streamInfo.approxDurationMs / 1000);
            if (streamSec > this.state.duration) {
              this.state.duration = streamSec;
            }
          }

          this.state.streamBitrate = streamInfo.bitrate;
          this.state.streamMimeType = streamInfo.mimeType;
          this.state.isSignedStream = streamInfo.isSigned;
          this.state.extractedStreamUrl = streamInfo.url || `youtube://watch?v=${targetVideoId}`;
          this.state.streamSource = 'YouTube Full-Length Stream';
          this.publish();
        })
        .catch(() => {});
    };

    // Default full-length YouTube stream playback synchronously on tap
    if (videoId) {
      this.playViaYouTubeIframe(track, 0);
      resolveStreamMetadata(videoId);
      return;
    }

    // Track arrived without a youtubeId: resolve full YouTube Music track
    musicNetworkClient
      .resolveAlternateVideoId(track.title, track.artist)
      .then((resolvedId) => {
        if (this.activeExtractionRequestId !== currentRequestId) return;
        if (resolvedId) {
          const updatedTrack = { ...track, youtubeId: resolvedId };
          this.state.currentTrack = updatedTrack;
          this.playViaYouTubeIframe(updatedTrack, 0);
          resolveStreamMetadata(resolvedId);
        } else if (track.fallbackAudio && this.audioFallback) {
          this.currentMode = 'audio';
          this.state.streamEngine = 'local_audio';
          this.state.streamSource = 'Direct Audio Stream';
          this.state.streamMimeType = track.fallbackAudio.toLowerCase().endsWith('.mp3')
            ? 'audio/mpeg'
            : 'audio/mp4';
          this.audioFallback.src = track.fallbackAudio;
          this.audioFallback.play().catch(() => {});
          this.publish();
        }
      });
  }

  private playViaYouTubeIframe(track: Track, startSeconds: number = 0) {
    if (!track.youtubeId) {
      if (track.fallbackAudio && this.audioFallback) {
        this.currentMode = 'audio';
        this.audioFallback.src = track.fallbackAudio;
        this.audioFallback.play().catch(() => {});
      }
      return;
    }

    this.currentMode = 'youtube';
    if (this.audioFallback) {
      this.audioFallback.pause();
    }

    this.state.streamEngine = 'youtube_iframe';
    this.state.streamSource = 'YouTube Full-Length Stream';
    this.state.isSignedStream = true;

    if (this.ytReady && this.ytPlayer && this.ytPlayer.loadVideoById) {
      this.pendingYouTubeTrack = null;
      try {
        this.ytPlayer.loadVideoById({
          videoId: track.youtubeId,
          startSeconds: Math.floor(startSeconds),
        });
        this.ytPlayer.playVideo();
        this.ytPlayer.setPlaybackRate?.(this.state.playbackRate);
        this.state.isPlaying = true;
        this.publish();
      } catch {
        if (track.fallbackAudio && this.audioFallback) {
          this.currentMode = 'audio';
          this.audioFallback.src = track.fallbackAudio;
          this.audioFallback.play().catch(() => {});
        }
      }
    } else {
      this.pendingYouTubeTrack = { track, startSeconds };
      this.state.isBuffering = true;
      this.publish();
    }
  }

  public setCrossfadeSeconds(seconds: number) {
    const clamped = Math.max(0, Math.min(12, Math.round(seconds)));
    this.state.crossfadeSeconds = clamped;
    this.publish();
  }

  public setPlaybackRate(rate: number) {
    const allowed = [0.75, 1, 1.25, 1.5];
    const nextRate = allowed.includes(rate) ? rate : 1;
    this.state.playbackRate = nextRate;
    if (this.ytPlayer && this.ytReady) {
      try {
        this.ytPlayer.setPlaybackRate?.(nextRate);
      } catch {}
    }
    if (this.audioFallback) {
      this.audioFallback.playbackRate = nextRate;
    }
    this.publish();
  }

  public setSleepTimer(minutes: number | null) {
    this.state.sleepAtTrackEnd = false;
    if (!minutes || minutes <= 0) {
      this.state.sleepTimerEndAt = null;
      this.state.sleepTimerRemainingSec = null;
      this.applyEffectiveVolume(this.state.isMuted ? 0 : this.state.volume);
    } else {
      const endAt = Date.now() + minutes * 60 * 1000;
      this.state.sleepTimerEndAt = endAt;
      this.state.sleepTimerRemainingSec = minutes * 60;
    }
    this.publish();
  }

  public setSleepAtTrackEnd(enabled: boolean) {
    if (enabled) {
      this.state.sleepTimerEndAt = null;
      this.state.sleepTimerRemainingSec = null;
    }
    this.state.sleepAtTrackEnd = enabled;
    this.publish();
  }

  public togglePlayPause() {
    if (this.state.isPlaying) {
      this.pause();
    } else {
      this.resume();
    }
  }

  public pause() {
    this.clearActiveFade();
    if (this.currentMode === 'youtube' && this.ytPlayer && this.ytReady) {
      try {
        this.ytPlayer.pauseVideo?.();
      } catch {}
    } else if (this.audioFallback) {
      this.audioFallback.pause();
    }
    this.state.isPlaying = false;
    this.applyEffectiveVolume(this.state.isMuted ? 0 : this.state.volume);
    this.publish();
  }

  public resume() {
    if (!this.state.currentTrack) return;
    this.applyEffectiveVolume(this.state.isMuted ? 0 : this.state.volume);

    if (this.currentMode === 'youtube') {
      if (this.ytPlayer && this.ytReady) {
        try {
          this.ytPlayer.playVideo?.();
          this.state.isPlaying = true;
          this.publish();
          return;
        } catch {}
      } else {
        this.playViaYouTubeIframe(this.state.currentTrack, this.state.currentTime);
        return;
      }
    }

    if (this.audioFallback && this.audioFallback.src) {
      this.audioFallback.play().catch(() => {});
      this.state.isPlaying = true;
      this.publish();
    }
  }

  public seekTo(seconds: number) {
    this.clearActiveFade();
    this.crossfadeTriggeredForTrackId = null;
    this.applyEffectiveVolume(this.state.isMuted ? 0 : this.state.volume);
    this.state.currentTime = seconds;
    if (this.currentMode === 'youtube' && this.ytPlayer && this.ytReady) {
      try {
        this.ytPlayer.seekTo?.(seconds, true);
      } catch {}
    } else if (this.audioFallback) {
      const mediaDuration = this.audioFallback.duration || 0;
      if (this.state.currentTrack?.youtubeId && (seconds > mediaDuration - 2 || mediaDuration <= 45)) {
        this.playViaYouTubeIframe(this.state.currentTrack, seconds);
      } else {
        try {
          this.audioFallback.currentTime = seconds;
        } catch {}
      }
    }
    this.publish();
  }

  public setEqualizerConfig(config: EqualizerConfig) {
    webAudioEqualizer.applyConfig(config);
  }

  public setFavoriteTrackIds(ids: Set<string>) {
    this.favoriteTrackIds = new Set(ids);
  }

  public setSmartShufflePreferred(enabled: boolean) {
    this.smartShufflePreferred = enabled;
    if (this.state.isShuffle) {
      this.state.shuffleMode = enabled ? 'smart' : 'standard';
      this.publish();
    }
  }

  public setShuffleMode(mode: ShuffleMode) {
    this.state.shuffleMode = mode;
    this.state.isShuffle = mode !== 'off';
    if (mode === 'smart') this.smartShufflePreferred = true;
    if (mode === 'standard') this.smartShufflePreferred = false;
    this.publish();
  }

  public toggleShuffle() {
    if (this.state.shuffleMode === 'off') {
      this.state.shuffleMode = this.smartShufflePreferred ? 'smart' : 'standard';
      this.state.isShuffle = true;
    } else {
      this.state.shuffleMode = 'off';
      this.state.isShuffle = false;
    }
    this.publish();
  }

  public cycleShuffleMode() {
    const order: ShuffleMode[] = ['off', 'smart', 'standard'];
    const idx = order.indexOf(this.state.shuffleMode);
    this.setShuffleMode(order[(idx + 1) % order.length]);
  }

  public resetSkipHistory() {
    this.recentlySkipped.clear();
    this.state.skippedTrackCount = 0;
    this.publish();
  }

  private recordTrackSkip(trackId: string) {
    const prev = this.recentlySkipped.get(trackId);
    this.recentlySkipped.set(trackId, {
      count: (prev?.count || 0) + 1,
      lastSkippedAt: Date.now(),
    });
    this.state.skippedTrackCount = this.recentlySkipped.size;
  }

  private recordTrackCompleted(trackId: string) {
    if (this.recentlySkipped.has(trackId)) {
      this.recentlySkipped.delete(trackId);
      this.state.skippedTrackCount = this.recentlySkipped.size;
    }
  }

  public cycleRepeatMode() {
    const order: Array<'off' | 'all' | 'one'> = ['off', 'all', 'one'];
    const idx = order.indexOf(this.state.repeatMode);
    this.state.repeatMode = order[(idx + 1) % order.length];
    this.publish();
  }

  public next(withFadeIn = false, isAutoAdvance = false) {
    if (this.state.queue.length === 0) return;

    // Record skip penalty when user manually skips before track nears completion
    if (!isAutoAdvance && this.state.currentTrack) {
      const dur = this.state.duration || this.state.currentTrack.duration || 0;
      const threshold = dur > 0 ? Math.min(60, dur * 0.75) : 45;
      if (this.state.currentTime < threshold) {
        this.recordTrackSkip(this.state.currentTrack.id);
      }
    }

    if (this.state.shuffleMode === 'smart' && this.state.queue.length > 1) {
      const chosenIdx = pickSmartShuffleCandidate(
        this.state.queue,
        this.state.currentTrack?.id,
        {
          favoriteTrackIds: this.favoriteTrackIds,
          recentlySkipped: this.recentlySkipped,
          recentHistory: this.recentHistory,
        }
      );
      if (chosenIdx >= 0) {
        this.playTrack(this.state.queue[chosenIdx], undefined, withFadeIn);
        return;
      }
    }

    if (this.state.shuffleMode === 'standard' && this.state.queue.length > 1) {
      let randIdx = Math.floor(Math.random() * this.state.queue.length);
      if (randIdx === this.state.queueIndex) {
        randIdx = (randIdx + 1) % this.state.queue.length;
      }
      this.playTrack(this.state.queue[randIdx], undefined, withFadeIn);
      return;
    }

    const nextIdx = (this.state.queueIndex + 1) % this.state.queue.length;
    const nextTrack = this.state.queue[nextIdx];
    this.playTrack(nextTrack, undefined, withFadeIn);
  }

  public prev() {
    if (this.state.queue.length === 0) return;
    if (this.state.currentTime > 3) {
      this.seekTo(0);
      return;
    }
    const prevIdx = (this.state.queueIndex - 1 + this.state.queue.length) % this.state.queue.length;
    const prevTrack = this.state.queue[prevIdx];
    this.playTrack(prevTrack);
  }

  public setVolume(vol: number) {
    this.clearActiveFade();
    const clamped = Math.max(0, Math.min(100, Math.round(vol)));
    this.state.volume = clamped;
    this.state.isMuted = clamped === 0;
    this.applyEffectiveVolume(clamped);
    this.publish();
  }

  public toggleMute() {
    this.clearActiveFade();
    if (this.state.isMuted) {
      const restoredVol = this.state.volume > 0 ? this.state.volume : 80;
      this.state.volume = restoredVol;
      this.state.isMuted = false;
      this.applyEffectiveVolume(restoredVol);
    } else {
      this.state.isMuted = true;
      this.applyEffectiveVolume(0);
    }
    this.publish();
  }

  private handleTrackEnded() {
    const fullDuration = this.state.currentTrack?.duration || this.state.duration || 0;
    if (
      this.currentMode === 'audio' &&
      this.state.currentTrack?.youtubeId &&
      fullDuration > 40 &&
      this.state.currentTime < fullDuration - 10
    ) {
      this.playViaYouTubeIframe(this.state.currentTrack, Math.floor(this.state.currentTime));
      return;
    }

    if (this.state.currentTrack) {
      this.recordTrackCompleted(this.state.currentTrack.id);
    }

    if (this.state.sleepAtTrackEnd) {
      this.state.sleepAtTrackEnd = false;
      this.state.isPlaying = false;
      this.state.currentTime = 0;
      this.applyEffectiveVolume(this.state.isMuted ? 0 : this.state.volume);
      this.publish();
      return;
    }

    if (this.state.repeatMode === 'one' && this.state.currentTrack) {
      this.seekTo(0);
      this.resume();
    } else if (this.state.repeatMode === 'all' || this.state.queueIndex < this.state.queue.length - 1) {
      this.next(false, true);
    } else {
      this.state.isPlaying = false;
      this.state.currentTime = 0;
      this.applyEffectiveVolume(this.state.isMuted ? 0 : this.state.volume);
      this.publish();
    }
  }

  public destroy() {
    if (this.progressInterval) clearInterval(this.progressInterval);
    if (this.sleepInterval) clearInterval(this.sleepInterval);
    this.clearActiveFade();
    if (this.audioFallback) {
      this.audioFallback.pause();
      this.audioFallback = null;
    }
    this.listeners.clear();
  }
}

export const inAppPlayer = new InAppPlayerManager();
