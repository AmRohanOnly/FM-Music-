import {
  Home,
  Compass,
  Library,
  Heart,
  Plus,
  ListMusic,
  HardDrive,
} from 'lucide-react';
import { UserPlaylist } from '../services/libraryStore';

interface YtSidebarProps {
  isOpen: boolean;
  currentTab: 'home' | 'explore' | 'library' | 'offline';
  onSelectTab: (tab: 'home' | 'explore' | 'library' | 'offline') => void;
  likedTracksCount: number;
  onSelectLikedSongs: () => void;
  isLikedSelected: boolean;
  playlists: UserPlaylist[];
  activePlaylistId?: string;
  onSelectPlaylist: (id: string) => void;
  onCreatePlaylist: () => void;
}

export function YtSidebar({
  isOpen,
  currentTab,
  onSelectTab,
  likedTracksCount,
  onSelectLikedSongs,
  isLikedSelected,
  playlists,
  activePlaylistId,
  onSelectPlaylist,
  onCreatePlaylist,
}: YtSidebarProps) {
  return (
    <aside
      className={`fixed top-16 bottom-20 left-0 z-30 bg-[var(--fm-bg)] border-r border-[var(--fm-glass-border)] transition-all duration-300 flex flex-col ${
        isOpen ? 'w-60' : 'w-18'
      } hidden md:flex select-none`}
    >
      {/* Primary Navigation Destinations */}
      <div className="p-3 space-y-1">
        <button
          onClick={() => onSelectTab('home')}
          className={`w-full flex items-center gap-4 px-3.5 py-3 rounded-2xl text-sm font-semibold transition-all cursor-pointer ${
            currentTab === 'home'
              ? 'bg-[var(--fm-accent)] text-[var(--fm-accent-fg)] shadow-sm'
              : 'text-[var(--fm-text-muted)] hover:text-[var(--fm-text)] hover:bg-[var(--fm-glass)]'
          }`}
          title="Home"
        >
          <Home className="w-5 h-5 shrink-0" />
          {isOpen && <span className="truncate">Home</span>}
        </button>

        <button
          onClick={() => onSelectTab('explore')}
          className={`w-full flex items-center gap-4 px-3.5 py-3 rounded-2xl text-sm font-semibold transition-all cursor-pointer ${
            currentTab === 'explore'
              ? 'bg-[var(--fm-accent)] text-[var(--fm-accent-fg)] shadow-sm'
              : 'text-[var(--fm-text-muted)] hover:text-[var(--fm-text)] hover:bg-[var(--fm-glass)]'
          }`}
          title="Explore"
        >
          <Compass className="w-5 h-5 shrink-0" />
          {isOpen && <span className="truncate">Explore</span>}
        </button>

        <button
          onClick={() => onSelectTab('library')}
          className={`w-full flex items-center gap-4 px-3.5 py-3 rounded-2xl text-sm font-semibold transition-all cursor-pointer ${
            currentTab === 'library'
              ? 'bg-[var(--fm-accent)] text-[var(--fm-accent-fg)] shadow-sm'
              : 'text-[var(--fm-text-muted)] hover:text-[var(--fm-text)] hover:bg-[var(--fm-glass)]'
          }`}
          title="Library"
        >
          <Library className="w-5 h-5 shrink-0" />
          {isOpen && <span className="truncate">Library</span>}
        </button>

        <button
          onClick={() => onSelectTab('offline')}
          className={`w-full flex items-center gap-4 px-3.5 py-3 rounded-2xl text-sm font-semibold transition-all cursor-pointer ${
            currentTab === 'offline'
              ? 'bg-[var(--fm-accent)] text-[var(--fm-accent-fg)] shadow-sm'
              : 'text-[var(--fm-text-muted)] hover:text-[var(--fm-text)] hover:bg-[var(--fm-glass)]'
          }`}
          title="Offline Downloads"
        >
          <HardDrive className="w-5 h-5 shrink-0" />
          {isOpen && <span className="truncate">Offline</span>}
        </button>
      </div>

      {/* Playlist & Library Shortcuts Section */}
      {isOpen && (
        <div className="flex-1 overflow-y-auto px-3 py-2 border-t border-[var(--fm-glass-border)] space-y-3">
          <div className="flex items-center justify-between px-2 pt-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--fm-text-muted)]">
              Playlists & Favorites
            </span>
            <button
              onClick={onCreatePlaylist}
              className="p-1 rounded-lg text-[var(--fm-text-muted)] hover:text-[var(--fm-accent)] hover:bg-[var(--fm-glass)] transition-colors cursor-pointer"
              title="New Playlist"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-1">
            {/* Auto Liked Songs Playlist */}
            <button
              onClick={onSelectLikedSongs}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                isLikedSelected
                  ? 'bg-[var(--fm-accent-subtle)] text-[var(--fm-accent)] border border-[var(--fm-accent-border)]'
                  : 'text-[var(--fm-text-muted)] hover:text-[var(--fm-text)] hover:bg-[var(--fm-glass)]'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-6 h-6 rounded-lg bg-red-500/20 text-red-500 flex items-center justify-center shrink-0">
                  <Heart className="w-3.5 h-3.5 fill-current" />
                </div>
                <span className="truncate">Liked Music</span>
              </div>
              <span className="text-[11px] opacity-70 shrink-0 font-mono">
                {likedTracksCount}
              </span>
            </button>

            {/* Custom User Playlists */}
            {playlists.map((pl) => {
              const isSelected = activePlaylistId === pl.id;
              return (
                <button
                  key={pl.id}
                  onClick={() => onSelectPlaylist(pl.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[var(--fm-accent-subtle)] text-[var(--fm-accent)] border border-[var(--fm-accent-border)]'
                      : 'text-[var(--fm-text-muted)] hover:text-[var(--fm-text)] hover:bg-[var(--fm-glass)]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-6 h-6 rounded-lg bg-[var(--fm-glass)] text-[var(--fm-text-muted)] flex items-center justify-center shrink-0">
                      <ListMusic className="w-3.5 h-3.5" />
                    </div>
                    <span className="truncate">{pl.name}</span>
                  </div>
                  <span className="text-[11px] opacity-70 shrink-0 font-mono">
                    {pl.tracks.length}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </aside>
  );
}
