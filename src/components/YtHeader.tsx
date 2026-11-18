import React, { useRef, useEffect } from 'react';
import {
  Menu,
  Search,
  X,
  Settings,
  ShieldCheck,
  Smartphone,
  Palette,
} from 'lucide-react';
import { ThemeId, THEMES } from '../services/libraryStore';

interface YtHeaderProps {
  onToggleSidebar: () => void;
  query: string;
  onQueryChange: (q: string) => void;
  onSearchSubmit: (q: string) => void;
  onClearSearch: () => void;
  isSearchFocused: boolean;
  setIsSearchFocused: (focused: boolean) => void;
  searchHistory: string[];
  onSelectHistoryItem: (item: string) => void;
  onClearHistory: () => void;
  currentTheme: ThemeId;
  onOpenSettings: () => void;
  onOpenDiagnostics: () => void;
  updateAvailable: boolean;
  latestVersion?: string;
  onOpenUpdatePrompt: () => void;
}

export function YtHeader({
  onToggleSidebar,
  query,
  onQueryChange,
  onSearchSubmit,
  onClearSearch,
  isSearchFocused,
  setIsSearchFocused,
  searchHistory,
  onSelectHistoryItem,
  onClearHistory,
  currentTheme,
  onOpenSettings,
  onOpenDiagnostics,
  updateAvailable,
  latestVersion,
  onOpenUpdatePrompt,
}: YtHeaderProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setIsSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
    };
  }, [setIsSearchFocused]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSearchSubmit(query);
      setIsSearchFocused(false);
    } else if (e.key === 'Escape') {
      setIsSearchFocused(false);
      searchInputRef.current?.blur();
    }
  };

  const activeThemeMeta = THEMES.find((t) => t.id === currentTheme) || THEMES[0];

  return (
    <header className="fixed top-0 left-0 right-0 h-16 z-40 px-3 sm:px-5 flex items-center justify-between gap-3 border-b border-[var(--fm-glass-border)] bg-[var(--fm-header-bg)] backdrop-blur-xl transition-colors">
      {/* Left: Hamburger & Brand */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={onToggleSidebar}
          aria-label="Toggle navigation drawer"
          className="w-10 h-10 rounded-full flex items-center justify-center text-[var(--fm-text-muted)] hover:text-[var(--fm-text)] hover:bg-[var(--fm-glass)] transition-colors cursor-pointer"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 select-none cursor-pointer">
          <div className="w-8 h-8 rounded-lg bg-[var(--fm-accent)] text-[var(--fm-accent-fg)] flex items-center justify-center shadow-sm">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 ml-0.5">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold tracking-tight text-base sm:text-lg leading-none flex items-center gap-1">
              FM <span className="text-[var(--fm-accent)]">Music</span>
            </span>
          </div>
        </div>
      </div>

      {/* Center: YouTube Music Style Search Bar */}
      <div ref={searchContainerRef} className="relative flex-1 max-w-xl mx-2">
        <div className="relative flex items-center w-full">
          <input
            ref={searchInputRef}
            type="text"
            value={query}
            onFocus={() => setIsSearchFocused(true)}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search songs, albums, artists, or paste YouTube link..."
            className="w-full h-11 pl-11 pr-10 rounded-full liquid-glass-input text-[var(--fm-text)] placeholder-[var(--fm-text-muted)]/60 text-sm focus:outline-none focus:border-[var(--fm-accent)] focus:ring-1 focus:ring-[var(--fm-accent)] transition-all shadow-inner"
          />
          <Search className="w-4 h-4 text-[var(--fm-text-muted)] absolute left-3.5 pointer-events-none" />
          {query && (
            <button
              onClick={() => {
                onClearSearch();
                searchInputRef.current?.focus();
              }}
              className="absolute right-2.5 w-7 h-7 rounded-full flex items-center justify-center text-[var(--fm-text-muted)] hover:text-[var(--fm-text)] hover:bg-[var(--fm-glass)] transition-colors cursor-pointer"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Search History & Trending Suggestions Dropdown */}
        {isSearchFocused && (
          <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 liquid-glass-strong rounded-2xl p-2.5 shadow-2xl border border-[var(--fm-glass-border)] animate-fade-in space-y-2">
            {searchHistory.length > 0 && (
              <div>
                <div className="flex items-center justify-between px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-[var(--fm-text-muted)]">
                  <span>Recent Searches</span>
                  <button
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={onClearHistory}
                    className="hover:text-[var(--fm-text)] cursor-pointer"
                  >
                    Clear All
                  </button>
                </div>
                <div className="space-y-0.5">
                  {searchHistory.slice(0, 5).map((item) => (
                    <button
                      key={item}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        onSelectHistoryItem(item);
                        setIsSearchFocused(false);
                      }}
                      className="w-full px-3 py-2 rounded-xl text-left text-xs text-[var(--fm-text)] hover:bg-[var(--fm-glass)] flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                      <Search className="w-3.5 h-3.5 text-[var(--fm-text-muted)]" />
                      <span className="truncate">{item}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-1 border-t border-[var(--fm-glass-border)]">
              <span className="block px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-[var(--fm-text-muted)]">
                Trending Suggestions
              </span>
              <div className="flex flex-wrap gap-1.5 px-1 pt-1">
                {['Kesariya', 'Apna Bana Le', 'Tum Hi Ho', 'Chaleya', 'Lofi Beats', 'Arijit Singh'].map((tag) => (
                  <button
                    key={tag}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onSelectHistoryItem(tag);
                      setIsSearchFocused(false);
                    }}
                    className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[var(--fm-glass)] text-[var(--fm-text-muted)] hover:text-[var(--fm-text)] hover:bg-[var(--fm-surface-hover)] border border-[var(--fm-glass-border)] transition-colors cursor-pointer"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right: Quick Controls & Settings */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {updateAvailable && (
          <button
            onClick={onOpenUpdatePrompt}
            className="hidden sm:flex min-h-9 px-3 py-1 rounded-full text-xs font-bold bg-[var(--fm-accent)] text-[var(--fm-accent-fg)] items-center gap-1.5 cursor-pointer shadow-sm hover:opacity-90 transition-opacity"
            title={`Update available: v${latestVersion}`}
          >
            <Smartphone className="w-3.5 h-3.5 shrink-0" />
            <span>v{latestVersion}</span>
          </button>
        )}

        <button
          onClick={onOpenSettings}
          className="hidden md:flex min-h-9 px-3 py-1 rounded-full text-xs font-semibold liquid-glass-button text-[var(--fm-text)] items-center gap-1.5 cursor-pointer"
          title={`Active Theme: ${activeThemeMeta.name}`}
        >
          <Palette className="w-3.5 h-3.5 text-[var(--fm-accent)]" />
          <span className="max-w-[100px] truncate">{activeThemeMeta.name}</span>
        </button>

        <button
          onClick={onOpenDiagnostics}
          className="w-10 h-10 rounded-full flex items-center justify-center text-[var(--fm-text-muted)] hover:text-[var(--fm-text)] hover:bg-[var(--fm-glass)] transition-colors cursor-pointer"
          title="Diagnostics & Network Status"
          aria-label="Open Diagnostics"
        >
          <ShieldCheck className="w-4 h-4 text-[var(--fm-accent)]" />
        </button>

        <button
          onClick={onOpenSettings}
          className="w-10 h-10 rounded-full flex items-center justify-center text-[var(--fm-text)] hover:bg-[var(--fm-glass)] transition-colors cursor-pointer"
          title="Settings, Themes & Customization"
          aria-label="Open Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
