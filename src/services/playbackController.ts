import {
  LicensedMediaItem,
  LicensedPlaybackSource,
  PlaybackTrack,
  PlaybackUiState,
} from '../types/playback';

export type StateListener = (state: PlaybackUiState) => void;

/**
 * Playback controller porting Android's Media3PlaybackController.
 * Manages player state flow, media items, playback transitions, and errors.
 */
export class PlaybackController {
  private audio: HTMLAudioElement | null = null;
  private listeners = new Set<StateListener>();
  private currentTitle: string | null = null;
  private currentArtist: string | null = null;
  private isPlaying = false;
  private isBuffering = false;
  private errorMessage: string | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.audio = new Audio();
      this.setupAudioListeners();
    }
  }

  private setupAudioListeners() {
    if (!this.audio) return;

    this.audio.addEventListener('play', () => {
      this.isPlaying = true;
      this.isBuffering = false;
      this.publishState();
    });

    this.audio.addEventListener('pause', () => {
      this.isPlaying = false;
      this.publishState();
    });

    this.audio.addEventListener('ended', () => {
      this.isPlaying = false;
      this.isBuffering = false;
      this.publishState();
    });

    this.audio.addEventListener('waiting', () => {
      this.isBuffering = true;
      this.publishState();
    });

    this.audio.addEventListener('playing', () => {
      this.isPlaying = true;
      this.isBuffering = false;
      this.publishState();
    });

    this.audio.addEventListener('error', () => {
      this.isPlaying = false;
      this.isBuffering = false;
      this.publishState('Playback failed. Check the provider and try again.');
    });
  }

  public getState(): PlaybackUiState {
    return {
      title: this.currentTitle,
      artist: this.currentArtist,
      isPlaying: this.isPlaying,
      isBuffering: this.isBuffering,
      errorMessage: this.errorMessage,
      hasMedia: this.currentTitle !== null,
    };
  }

  public subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private publishState(errorMessage: string | null = null) {
    this.errorMessage = errorMessage;
    const currentState = this.getState();
    this.listeners.forEach((listener) => listener(currentState));
  }

  public async play(track: PlaybackTrack, source: LicensedPlaybackSource): Promise<void> {
    const media = await source.resolve(track);
    if (!media) {
      throw new Error('The licensed provider did not return a playable track.');
    }
    await this.playMedia(media);
  }

  public async playMedia(media: LicensedMediaItem): Promise<void> {
    if (!this.audio) return;

    this.currentTitle = media.title;
    this.currentArtist = media.artist;
    this.errorMessage = null;
    this.isBuffering = true;
    this.publishState();

    try {
      this.audio.src = media.uri;
      this.audio.load();
      await this.audio.play();
    } catch {
      this.isBuffering = false;
      this.isPlaying = false;
      this.publishState('Playback failed. Check the provider and try again.');
    }
  }

  public togglePlayback(): void {
    if (!this.audio) return;

    if (this.isPlaying) {
      this.audio.pause();
    } else if (this.currentTitle !== null) {
      this.audio.play().catch(() => {
        this.publishState('Playback failed. Check the provider and try again.');
      });
    }
  }

  public stop(): void {
    if (!this.audio) return;
    this.audio.pause();
    this.audio.currentTime = 0;
    this.currentTitle = null;
    this.currentArtist = null;
    this.isPlaying = false;
    this.isBuffering = false;
    this.errorMessage = null;
    this.publishState();
  }

  public release(): void {
    if (this.audio) {
      this.audio.pause();
      this.audio.src = '';
      this.audio = null;
    }
    this.listeners.clear();
  }
}
