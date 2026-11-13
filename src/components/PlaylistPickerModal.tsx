import React, { useState } from 'react';
import { X, Plus, Check, ListMusic } from 'lucide-react';
import { Track } from '../data/musicCatalog';
import { UserPlaylist } from '../services/libraryStore';
import { TrackArtwork } from './TrackArtwork';

interface PlaylistPickerModalProps {
  track: Track | null;
  playlists: UserPlaylist[];
  onClose: () => void;
  onToggleTrackInPlaylist: (playlistId: string, track: Track) => void;
  onCreatePlaylistWithTrack: (name: string, track: Track) => void;
}

export function PlaylistPickerModal({
  track,
  playlists,
  onClose,
  onToggleTrackInPlaylist,
  onCreatePlaylistWithTrack,
}: PlaylistPickerModalProps) {
  const [newName, setNewName] = useState('');

  if (!track) return null;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;
    onCreatePlaylistWithTrack(trimmed, track);
    setNewName('');
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/55 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="liquid-glass-strong w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 text-[var(--fm-text)] animate-scale-in max-h-[85vh] flex flex-col"
      >
        <div className="flex items-center justify-between pb-3 border-b border-[var(--fm-glass-border)]">
          <div className="flex items-center gap-2">
            <ListMusic className="w-5 h-5 text-[var(--fm-accent)]" />
            <h3 className="font-bold text-base sm:text-lg">Add to Playlist</h3>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full liquid-glass-button flex items-center justify-center text-[var(--fm-text-muted)] hover:text-[var(--fm-text)] cursor-pointer"
            aria-label="Close playlist picker"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Selected Track Preview */}
        <div className="mt-4 flex items-center gap-3 p-3 rounded-2xl liquid-glass">
          <div className="w-11 h-11 rounded-xl overflow-hidden shrink-0">
            <TrackArtwork src={track.thumbnail} alt={track.title} className="w-full h-full" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate">{track.title}</p>
            <p className="text-xs text-[var(--fm-text-muted)] truncate">{track.artist}</p>
          </div>
        </div>

        {/* Create New Playlist Form */}
        <form onSubmit={handleCreate} className="mt-4 flex items-center gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New playlist name..."
            className="flex-1 h-11 px-3.5 rounded-xl liquid-glass-input text-sm text-[var(--fm-text)] placeholder-[var(--fm-text-muted)]/60 focus:outline-none focus:border-[var(--fm-accent)]"
          />
          <button
            type="submit"
            disabled={!newName.trim()}
            className="h-11 px-4 rounded-xl bg-[var(--fm-accent)] text-[var(--fm-accent-fg)] font-bold text-xs sm:text-sm flex items-center gap-1.5 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed shrink-0 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            <span>Create</span>
          </button>
        </form>

        {/* Existing Playlists */}
        <div className="mt-4 flex-1 overflow-y-auto space-y-2 pr-1">
          {playlists.length === 0 ? (
            <p className="text-xs text-[var(--fm-text-muted)] text-center py-6">
              No custom playlists yet. Create one above to save this song.
            </p>
          ) : (
            playlists.map((pl) => {
              const containsTrack = pl.tracks.some((t) => t.id === track.id);
              return (
                <button
                  key={pl.id}
                  onClick={() => onToggleTrackInPlaylist(pl.id, track)}
                  className={`w-full min-h-12 px-3.5 py-2.5 rounded-2xl flex items-center justify-between gap-3 transition-all cursor-pointer ${
                    containsTrack
                      ? 'liquid-glass border-[var(--fm-accent)]/60'
                      : 'liquid-glass-button'
                  }`}
                >
                  <div className="min-w-0 text-left">
                    <p className="text-sm font-semibold truncate">{pl.name}</p>
                    <p className="text-xs text-[var(--fm-text-muted)]">
                      {pl.tracks.length} {pl.tracks.length === 1 ? 'song' : 'songs'}
                    </p>
                  </div>
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                      containsTrack
                        ? 'bg-[var(--fm-accent)] text-[var(--fm-accent-fg)]'
                        : 'bg-[var(--fm-glass)] text-[var(--fm-text-muted)]'
                    }`}
                  >
                    {containsTrack ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
