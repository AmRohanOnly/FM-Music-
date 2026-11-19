import { useState } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Volume2,
  VolumeX,
  Volume1,
  Heart,
  ListMusic,
  SlidersHorizontal,
  FileText,
  ChevronUp,
} from 'lucide-react';
import { Track } from '../data/musicCatalog';
import { TrackArtwork } from './TrackArtwork';
import { InAppPlayerState } from '../services/inAppPlayerManager';

interface YtPlayerBarProps {
  playerState: InAppPlayerState;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek: (seconds: number) => void;
  onSetVolume: (vol: number) => void;
  onToggleMute: () => void;
  onCycleRepeat: () => void;
  onCycleShuffle: () => void;
  isLiked: boolean;
  onToggleLike: (track: Track) => void;
  onOpenLyrics: () => void;
  onOpenQueue: () => void;
  onOpenEqualizer: () => void;
  onExpandNowPlaying: () => void;
}

function formatSeconds(sec: number): string {
  if (isNaN(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export function YtPlayerBar({
  playerState,
  onTogglePlay,
  onNext,
  onPrev,
  onSeek,
  onSetVolume,
  onToggleMute,
  onCycleRepeat,
  onCycleShuffle,
  isLiked,
  onToggleLike,
  onOpenLyrics,
  onOpenQueue,
  onOpenEqualizer,
  onExpandNowPlaying,
}: YtPlayerBarProps) {
  const track = playerState.currentTrack;
  if (!track) return null;

  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubValue, setScrubValue] = useState<number | null>(null);

  const displayTime = isScrubbing && scrubValue !== null ? scrubValue : playerState.currentTime;
  const progressPercent = playerState.duration > 0
    ? (displayTime / playerState.duration) * 100
    : 0;

  return (
    <div className="fixed bottom-0 left-0 right-0 h-20 z-40 bg-[var(--fm-player-bg)] backdrop-blur-2xl border-t border-[var(--fm-glass-border)] px-3 sm:px-6 flex items-center justify-between gap-2 sm:gap-4 select-none shadow-2xl transition-colors">
      {/* Top Thin Interactive Scrubber Line for Instant Seeking & Dragging */}
      <div
        className="absolute -top-2 left-0 right-0 h-4 flex items-center group cursor-pointer z-50 touch-none select-none"
        onPointerDown={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const handleSeek = (clientX: number, isFinal: boolean) => {
            const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
            const targetSec = ratio * (playerState.duration || 100);
            if (isFinal) {
              onSeek(targetSec);
              setIsScrubbing(false);
              setScrubValue(null);
            } else {
              setIsScrubbing(true);
              setScrubValue(targetSec);
            }
          };

          handleSeek(e.clientX, false);

          const onPointerMove = (moveEvent: PointerEvent) => {
            handleSeek(moveEvent.clientX, false);
          };

          const onPointerUp = (upEvent: PointerEvent) => {
            handleSeek(upEvent.clientX, true);
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
            window.removeEventListener('pointercancel', onPointerUp);
          };

          window.addEventListener('pointermove', onPointerMove);
          window.addEventListener('pointerup', onPointerUp);
          window.addEventListener('pointercancel', onPointerUp);
        }}
      >
        <div className="w-full h-1 bg-[var(--fm-glass-border)] group-hover:h-2 transition-all rounded-full overflow-hidden">
          <div
            style={{ width: `${progressPercent}%` }}
            className="h-full bg-[var(--fm-accent)] relative transition-[width] duration-75"
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-[var(--fm-accent)] opacity-0 group-hover:opacity-100 shadow-lg transition-opacity" />
          </div>
        </div>
      </div>

      {/* Left: Track Info & Heart Like Button */}
      <div className="flex items-center gap-3 min-w-0 max-w-[28%] sm:max-w-[30%]">
        <div
          onClick={onExpandNowPlaying}
          className="relative w-12 h-12 rounded-lg overflow-hidden shrink-0 cursor-pointer group shadow-sm"
        >
          <TrackArtwork
            src={track.thumbnail}
            alt={track.title}
            className="w-full h-full object-cover transition-transform group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
            <ChevronUp className="w-5 h-5 text-white" />
          </div>
        </div>

        <div className="min-w-0 flex flex-col justify-center">
          <span
            onClick={onExpandNowPlaying}
            className="text-xs sm:text-sm font-bold text-[var(--fm-text)] truncate cursor-pointer hover:underline"
          >
            {track.title}
          </span>
          <span className="text-[11px] sm:text-xs text-[var(--fm-text-muted)] truncate">
            {track.artist}
          </span>
        </div>

        <button
          onClick={() => onToggleLike(track)}
          className={`p-2 rounded-full transition-all shrink-0 cursor-pointer ${
            isLiked
              ? 'text-red-500 scale-105'
              : 'text-[var(--fm-text-muted)] hover:text-[var(--fm-text)]'
          }`}
          title={isLiked ? 'Unlike' : 'Like'}
          aria-label={isLiked ? 'Unlike track' : 'Like track'}
        >
          <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
        </button>
      </div>

      {/* Center: Playback Controls & Scrubber */}
      <div className="flex flex-col items-center justify-center flex-1 max-w-xl mx-auto px-1 sm:px-4">
        {/* Buttons */}
        <div className="flex items-center gap-2 sm:gap-4">
          <button
            onClick={onCycleShuffle}
            className={`p-1.5 rounded-full transition-colors cursor-pointer ${
              playerState.shuffleMode !== 'off'
                ? 'text-[var(--fm-accent)]'
                : 'text-[var(--fm-text-muted)] hover:text-[var(--fm-text)]'
            }`}
            title={`Shuffle: ${playerState.shuffleMode}`}
          >
            <Shuffle className="w-4 h-4" />
          </button>

          <button
            onClick={onPrev}
            className="p-1.5 rounded-full text-[var(--fm-text)] hover:bg-[var(--fm-glass)] transition-colors cursor-pointer"
            title="Previous"
          >
            <SkipBack className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
          </button>

          <button
            onClick={onTogglePlay}
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[var(--fm-accent)] text-[var(--fm-accent-fg)] flex items-center justify-center shadow-md hover:scale-105 transition-transform cursor-pointer"
            title={playerState.isPlaying ? 'Pause' : 'Play'}
          >
            {playerState.isPlaying ? (
              <Pause className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
            ) : (
              <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current ml-0.5" />
            )}
          </button>

          <button
            onClick={onNext}
            className="p-1.5 rounded-full text-[var(--fm-text)] hover:bg-[var(--fm-glass)] transition-colors cursor-pointer"
            title="Next"
          >
            <SkipForward className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
          </button>

          <button
            onClick={onCycleRepeat}
            className={`p-1.5 rounded-full transition-colors cursor-pointer ${
              playerState.repeatMode !== 'off'
                ? 'text-[var(--fm-accent)]'
                : 'text-[var(--fm-text-muted)] hover:text-[var(--fm-text)]'
            }`}
            title={`Repeat: ${playerState.repeatMode}`}
          >
            {playerState.repeatMode === 'one' ? (
              <Repeat1 className="w-4 h-4" />
            ) : (
              <Repeat className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Scrubber Timeline */}
        <div className="w-full hidden sm:flex items-center gap-2.5 mt-1 text-[11px] font-mono text-[var(--fm-text-muted)]">
          <span className="w-9 text-right shrink-0">{formatSeconds(displayTime)}</span>
          <div className="relative flex-1 flex items-center">
            <input
              type="range"
              min={0}
              max={playerState.duration || 100}
              value={displayTime || 0}
              onMouseDown={() => setIsScrubbing(true)}
              onTouchStart={() => setIsScrubbing(true)}
              onChange={(e) => {
                const val = Number(e.target.value);
                setScrubValue(val);
              }}
              onMouseUp={(e) => {
                const val = Number(e.currentTarget.value);
                onSeek(val);
                setIsScrubbing(false);
                setScrubValue(null);
              }}
              onTouchEnd={(e) => {
                const val = Number(e.currentTarget.value);
                onSeek(val);
                setIsScrubbing(false);
                setScrubValue(null);
              }}
              className="w-full h-1 bg-[var(--fm-glass-border)] rounded-lg appearance-none cursor-pointer accent-[var(--fm-accent)]"
            />
          </div>
          <span className="w-9 text-left shrink-0">{formatSeconds(playerState.duration)}</span>
        </div>
      </div>

      {/* Right: Volume & Utility Toggles */}
      <div className="flex items-center gap-1 sm:gap-2.5 shrink-0">
        <button
          onClick={onOpenEqualizer}
          className="p-2 rounded-full text-[var(--fm-text-muted)] hover:text-[var(--fm-text)] hover:bg-[var(--fm-glass)] transition-colors cursor-pointer hidden md:flex"
          title="Equalizer"
        >
          <SlidersHorizontal className="w-4 h-4" />
        </button>

        <button
          onClick={onOpenLyrics}
          className="p-2 rounded-full text-[var(--fm-text-muted)] hover:text-[var(--fm-text)] hover:bg-[var(--fm-glass)] transition-colors cursor-pointer"
          title="Lyrics"
        >
          <FileText className="w-4 h-4" />
        </button>

        <button
          onClick={onOpenQueue}
          className="p-2 rounded-full text-[var(--fm-text-muted)] hover:text-[var(--fm-text)] hover:bg-[var(--fm-glass)] transition-colors cursor-pointer"
          title="Queue"
        >
          <ListMusic className="w-4 h-4" />
        </button>

        {/* Volume Slider on Desktop */}
        <div className="hidden lg:flex items-center gap-2 pl-1">
          <button
            onClick={onToggleMute}
            className="p-1 rounded-full text-[var(--fm-text-muted)] hover:text-[var(--fm-text)] cursor-pointer"
            title={playerState.isMuted ? 'Unmute' : 'Mute'}
          >
            {playerState.isMuted || playerState.volume === 0 ? (
              <VolumeX className="w-4 h-4 text-red-400" />
            ) : playerState.volume < 0.5 ? (
              <Volume1 className="w-4 h-4" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={playerState.isMuted ? 0 : playerState.volume}
            onChange={(e) => onSetVolume(Number(e.target.value))}
            className="w-18 h-1 bg-[var(--fm-glass-border)] rounded-lg appearance-none cursor-pointer accent-[var(--fm-accent)]"
            title={`Volume: ${Math.round(playerState.volume * 100)}%`}
          />
        </div>

        <button
          onClick={onExpandNowPlaying}
          className="p-2 rounded-full text-[var(--fm-text-muted)] hover:text-[var(--fm-text)] hover:bg-[var(--fm-glass)] transition-colors cursor-pointer"
          title="Expand Player"
        >
          <ChevronUp className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
