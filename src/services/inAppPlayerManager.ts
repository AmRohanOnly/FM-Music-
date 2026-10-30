import { Track } from '../data/musicCatalog';

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
}

type PlayerStateListener = (state: InAppPlayerState) => void;

class InAppPlayerManager {
  private ytPlayer: any = null;
  private ytReady = false;
  private audioFallback: HTMLAudioElement | null = null;
  private currentMode: 'youtube' | 'audio' = 'youtube';
  private containerId = 'fm-yt-hidden-player';
  private listeners = new Set<PlayerStateListener>();
  private progressInterval: any = null;

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
      this.state.isPlaying = false;
      this.publish();
    });
    this.audioFallback.addEventListener('ended', () => {
      this.handleTrackEnded();
    });
    this.audioFallback.addEventListener('timeupdate', () => {
      if (this.currentMode === 'audio' && this.audioFallback) {
        this.state.currentTime = this.audioFallback.currentTime;
        this.state.duration = this.audioFallback.duration || this.state.currentTrack?.duration || 0;
        this.publish();
      }
    });
    this.audioFallback.addEventListener('waiting', () => {
      this.state.isBuffering = true;
      this.publish();
    });
    this.audioFallback.addEventListener('playing', () => {
      this.state.isBuffering = false;
      this.publish();
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
      container.style.bottom = '-9999px';
      container.style.left = '-9999px';
      container.style.width = '200px';
      container.style.height = '200px';
      container.style.opacity = '0';
      container.style.pointerEvents = 'none';
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
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
            this.ytReady = true;
            this.ytPlayer.setVolume(this.state.volume);
          },
          onStateChange: (event: any) => {
            // YT.PlayerState: -1 (unstarted), 0 (ended), 1 (playing), 2 (paused), 3 (buffering), 5 (cued)
            const state = event.data;
            if (state === 1) {
              this.state.isPlaying = true;
              this.state.isBuffering = false;
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
          onError: () => {
            // Fallback to audio if YouTube embedding fails
            if (this.state.currentTrack?.fallbackAudio && this.audioFallback) {
              this.currentMode = 'audio';
              this.audioFallback.src = this.state.currentTrack.fallbackAudio;
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
      if (this.state.isPlaying && this.currentMode === 'youtube' && this.ytPlayer && this.ytReady) {
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
    }, 500);
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

    // Use YouTube IFrame player
    if (track.youtubeId) {
      this.currentMode = 'youtube';
      if (this.audioFallback) {
        this.audioFallback.pause();
      }

      if (this.ytReady && this.ytPlayer && this.ytPlayer.loadVideoById) {
        try {
          this.ytPlayer.loadVideoById({
            videoId: track.youtubeId,
            startSeconds: 0,
          });
          this.ytPlayer.playVideo();
          return;
        } catch {
          // fall through
        }
      }
    }

    // Audio stream fallback
    if (track.fallbackAudio && this.audioFallback) {
      this.currentMode = 'audio';
      this.audioFallback.src = track.fallbackAudio;
      this.audioFallback.play().catch(() => {});
    }
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

    if (this.currentMode === 'youtube' && this.ytPlayer && this.ytReady) {
      try {
        this.ytPlayer.playVideo?.();
        this.state.isPlaying = true;
        this.publish();
        return;
      } catch {}
    }

    if (this.audioFallback) {
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
      this.audioFallback.currentTime = seconds;
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
        this.ytPlayer.setVolume?.(clamped);
      } catch {}
    }
    if (this.audioFallback) {
      this.audioFallback.volume = clamped / 100;
    }
    this.publish();
  }

  public toggleMute() {
    if (this.state.isMuted) {
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
