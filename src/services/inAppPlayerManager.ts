import { Track } from '../data/musicCatalog';
import { musicNetworkClient, StreamFormatInfo } from './musicNetworkClient';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: (() => void) | undefined;
  }
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
  repeatMode: 'off' | 'all' | 'one';
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
  private activeExtractionRequestId = 0;

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
    repeatMode: 'off',
    streamEngine: 'youtube_iframe',
    streamSource: undefined,
    streamBitrate: undefined,
    streamMimeType: undefined,
    isSignedStream: false,
    extractedStreamUrl: undefined,
  };

  constructor() {
    if (typeof window !== 'undefined') {
      this.initAudioFallback();
      this.initYouTubeApi();
      this.startProgressTracker();
    }
  }

  private initAudioFallback() {
    this.audioFallback = new Audio();
    this.audioFallback.addEventListener('play', () => {
      this.state.isPlaying = true;
      this.state.isBuffering = false;
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
            this.ytPlayer.setVolume(this.state.volume);
            if (this.state.isMuted) {
              this.ytPlayer.mute?.();
            }
            if (this.pendingYouTubeTrack) {
              const pending = this.pendingYouTubeTrack;
              this.pendingYouTubeTrack = null;
              this.playViaYouTubeIframe(pending.track, pending.startSeconds);
            }
          },
          onStateChange: (event: any) => {
            if (this.currentMode !== 'youtube') return;
            // YT.PlayerState: -1 (unstarted), 0 (ended), 1 (playing), 2 (paused), 3 (buffering), 5 (cued)
            const state = event.data;
            if (state === 1) {
              this.state.isPlaying = true;
              this.state.isBuffering = false;
              const dur = this.ytPlayer.getDuration?.();
              if (typeof dur === 'number' && !isNaN(dur) && dur > 0) {
                this.state.duration = dur;
              }
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

            // Fallback to audio only if alternate YouTube Music resolution fails
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
          this.publish();
        } catch {
          // ignore
        }
      }
    }, 350);
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

  public playTrack(track: Track, newQueue?: Track[]) {
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
    this.publish();

    const currentRequestId = ++this.activeExtractionRequestId;
    const videoId = track.youtubeId;

    // 1. If the user selected local_audio AND a genuine direct full-length audio stream is already cached, play it right away
    if (videoId && this.state.streamEngine === 'local_audio') {
      const cached = musicNetworkClient.getCachedStream(videoId);
      if (cached && cached.url && !cached.requiresYouTubeEngine && this.audioFallback) {
        this.playDirectAudioStream(track, cached);
        return;
      }
    }

    // 2. If track has a youtubeId, start full-length YouTube streaming synchronously on click
    // so mobile/desktop browser autoplay policy is always satisfied and full songs never cut off at 30s!
    if (videoId) {
      this.playViaYouTubeIframe(track, 0);

      // Query player endpoint in background for stream telemetry & direct audio extraction
      musicNetworkClient
        .extractPlayerStreamUrl(videoId)
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
          this.state.extractedStreamUrl = streamInfo.url || `youtube://watch?v=${videoId}`;

          if (
            this.state.streamEngine === 'local_audio' &&
            streamInfo.url &&
            !streamInfo.requiresYouTubeEngine &&
            (streamInfo.source === 'innertube_player' || streamInfo.source === 'piped_api')
          ) {
            this.playDirectAudioStream(track, streamInfo, this.state.currentTime);
          } else {
            this.state.streamSource = 'YouTube Full-Length Stream';
            this.publish();
          }
        })
        .catch(() => {
          // Full-length YouTube player continues uninterrupted
        });
      return;
    }

    // 3. Track arrived without a youtubeId (e.g. offline metadata fallback): resolve full YouTube Music track
    musicNetworkClient
      .resolveAlternateVideoId(track.title, track.artist)
      .then((resolvedId) => {
        if (this.activeExtractionRequestId !== currentRequestId) return;
        if (resolvedId) {
          const updatedTrack = { ...track, youtubeId: resolvedId };
          this.state.currentTrack = updatedTrack;
          this.playViaYouTubeIframe(updatedTrack, 0);
        } else if (track.fallbackAudio && this.audioFallback) {
          this.currentMode = 'audio';
          this.audioFallback.src = track.fallbackAudio;
          this.audioFallback.play().catch(() => {});
        }
      });
  }

  private playDirectAudioStream(track: Track, streamInfo: StreamFormatInfo, startAtSeconds: number = 0) {
    if (!this.audioFallback || !streamInfo.url) return;

    this.currentMode = 'audio';
    if (this.ytPlayer && this.ytReady) {
      try {
        this.ytPlayer.pauseVideo?.();
      } catch {}
    }

    this.audioFallback.src = streamInfo.url;
    this.audioFallback.volume = this.state.isMuted ? 0 : this.state.volume / 100;
    try {
      this.audioFallback.currentTime = startAtSeconds;
    } catch {}

    this.state.streamEngine = 'local_audio';
    this.state.streamSource =
      streamInfo.source === 'innertube_player'
        ? 'InnerTube Player Endpoint (Signed Audio)'
        : 'Piped Direct Audio Stream';
    this.state.streamBitrate = streamInfo.bitrate;
    this.state.streamMimeType = streamInfo.mimeType;
    this.state.isSignedStream = streamInfo.isSigned;
    this.state.extractedStreamUrl = streamInfo.url;

    this.audioFallback
      .play()
      .then(() => {
        this.state.isPlaying = true;
        this.state.isBuffering = false;
        this.publish();
      })
      .catch(() => {
        if (track.youtubeId) {
          this.playViaYouTubeIframe(track, startAtSeconds);
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
      // Queue track until YouTube IFrame API finishes initializing
      this.pendingYouTubeTrack = { track, startSeconds };
      this.state.isBuffering = true;
      this.publish();
    }
  }

  public setStreamEngine(engine: 'local_audio' | 'youtube_iframe') {
    this.state.streamEngine = engine;
    this.publish();
    if (this.state.currentTrack) {
      this.playTrack(this.state.currentTrack);
    }
  }

  public toggleStreamEngine() {
    const nextEngine = this.state.streamEngine === 'local_audio' ? 'youtube_iframe' : 'local_audio';
    this.setStreamEngine(nextEngine);
  }

  public togglePlayPause() {
    if (this.state.isPlaying) {
      this.pause();
    } else {
      this.resume();
    }
  }

  public pause() {
    if (this.currentMode === 'youtube' && this.ytPlayer && this.ytReady) {
      try {
        this.ytPlayer.pauseVideo?.();
      } catch {}
    } else if (this.audioFallback) {
      this.audioFallback.pause();
    }
    this.state.isPlaying = false;
    this.publish();
  }

  public resume() {
    if (!this.state.currentTrack) return;

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
    this.state.currentTime = seconds;
    if (this.currentMode === 'youtube' && this.ytPlayer && this.ytReady) {
      try {
        this.ytPlayer.seekTo?.(seconds, true);
      } catch {}
    } else if (this.audioFallback) {
      const mediaDuration = this.audioFallback.duration || 0;
      if (this.state.currentTrack?.youtubeId && (seconds > (mediaDuration - 2) || mediaDuration <= 45)) {
        this.playViaYouTubeIframe(this.state.currentTrack, seconds);
      } else {
        try {
          this.audioFallback.currentTime = seconds;
        } catch {}
      }
    }
    this.publish();
  }

  public next() {
    if (this.state.queue.length === 0) return;
    const nextIdx = (this.state.queueIndex + 1) % this.state.queue.length;
    const nextTrack = this.state.queue[nextIdx];
    this.playTrack(nextTrack);
  }

  public prev() {
    if (this.state.queue.length === 0) return;
    // If more than 3 seconds in, restart track
    if (this.state.currentTime > 3) {
      this.seekTo(0);
      return;
    }
    const prevIdx = (this.state.queueIndex - 1 + this.state.queue.length) % this.state.queue.length;
    const prevTrack = this.state.queue[prevIdx];
    this.playTrack(prevTrack);
  }

  public setVolume(vol: number) {
    const clamped = Math.max(0, Math.min(100, vol));
    this.state.volume = clamped;
    this.state.isMuted = clamped === 0;

    if (this.ytPlayer && this.ytReady) {
      try {
        if (clamped > 0) this.ytPlayer.unMute?.();
        this.ytPlayer.setVolume?.(clamped);
      } catch {}
    }
    if (this.audioFallback) {
      this.audioFallback.muted = clamped === 0;
      this.audioFallback.volume = clamped / 100;
    }
    this.publish();
  }

  public toggleMute() {
    if (this.state.isMuted) {
      if (this.ytPlayer && this.ytReady) {
        try {
          this.ytPlayer.unMute?.();
        } catch {}
      }
      if (this.audioFallback) {
        this.audioFallback.muted = false;
      }
      this.setVolume(this.state.volume || 80);
      this.state.isMuted = false;
    } else {
      if (this.ytPlayer && this.ytReady) {
        try {
          this.ytPlayer.mute?.();
        } catch {}
      }
      if (this.audioFallback) {
        this.audioFallback.muted = true;
      }
      this.state.isMuted = true;
    }
    this.publish();
  }

  private handleTrackEnded() {
    const fullDuration = this.state.currentTrack?.duration || this.state.duration || 0;
    // If the audio preview stream ended prematurely while full track is a complete song (> 40s),
    // seamlessly transition to full-length YouTube streaming without skipping the song!
    if (
      this.currentMode === 'audio' &&
      this.state.currentTrack?.youtubeId &&
      fullDuration > 40 &&
      this.state.currentTime < (fullDuration - 10)
    ) {
      this.playViaYouTubeIframe(this.state.currentTrack, Math.floor(this.state.currentTime));
      return;
    }

    if (this.state.repeatMode === 'one' && this.state.currentTrack) {
      this.seekTo(0);
      this.resume();
    } else if (this.state.repeatMode === 'all' || this.state.queueIndex < this.state.queue.length - 1) {
      this.next();
    } else {
      this.state.isPlaying = false;
      this.state.currentTime = 0;
      this.publish();
    }
  }

  public destroy() {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
    }
    if (this.audioFallback) {
      this.audioFallback.pause();
      this.audioFallback = null;
    }
    this.listeners.clear();
  }
}

export const inAppPlayer = new InAppPlayerManager();
