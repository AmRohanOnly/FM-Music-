import React, { useState, useEffect, useRef } from 'react';
import { CURATED_CATALOG, Track, searchCatalog } from './data/musicCatalog';
import { inAppPlayer, InAppPlayerState } from './services/inAppPlayerManager';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Maximize2,
  ListMusic,
  FileText,
  Search,
  Shuffle,
  ShieldCheck,
  CheckCircle2,
  X,
  ExternalLink,
  ChevronDown,
  Download,
  HardDrive,
  Globe,
  Trash2,
} from 'lucide-react';
import { musicNetworkClient, VisitorSessionState } from './services/musicNetworkClient';

interface GreetingInfo {
  heading: string;
  subtext: string;
  tag: string;
  timeSlot: 'morning' | 'afternoon' | 'evening' | 'night';
}

function getTimeBasedGreeting(): GreetingInfo {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) {
    return {
      heading: 'Good morning,\nstart listening.',
      subtext: 'Discover tracks and stream in-app without leaving FM Music.',
      tag: 'Morning vibes',
      timeSlot: 'morning',
    };
  } else if (hour >= 12 && hour < 17) {
    return {
      heading: 'Good afternoon,\nfind your rhythm.',
      subtext: 'Discover tracks and stream in-app without leaving FM Music.',
      tag: 'Afternoon flow',
      timeSlot: 'afternoon',
    };
  } else if (hour >= 17 && hour < 22) {
    return {
      heading: 'Evening beats\nstart here.',
      subtext: 'Discover tracks and stream in-app without leaving FM Music.',
      tag: 'Evening beats',
      timeSlot: 'evening',
    };
  } else {
    return {
      heading: 'Late night vibes\nstart here.',
      subtext: 'Discover tracks and stream in-app without leaving FM Music.',
      tag: 'Night session',
      timeSlot: 'night',
    };
  }
}

export function FmLogo({ size = 42, className = '' }: { size?: number; className?: string }) {
  return (
    <div
      style={{ width: size, height: size }}
      className={`rounded-full bg-[#B9F36A] flex items-center justify-center shadow-md shadow-[#B9F36A]/20 shrink-0 relative overflow-hidden group select-none ${className}`}
    >
      <svg
        viewBox="0 0 44 44"
        className="w-full h-full p-1"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="22" cy="22" r="18" stroke="#111116" strokeWidth="1.2" strokeDasharray="3 3" opacity="0.35" />
        <path d="M9 22a13 13 0 0 1 26 0" stroke="#111116" strokeWidth="1.6" strokeLinecap="round" opacity="0.45" />
        <text
          x="22"
          y="26.5"
          textAnchor="middle"
          fill="#111116"
          fontSize="14"
          fontWeight="900"
          fontFamily="system-ui, -apple-system, sans-serif"
          letterSpacing="-0.5"
        >
          FM
        </text>
      </svg>
    </div>
  );
}

export function AudioVisualizer({ isPlaying, className = '' }: { isPlaying: boolean; className?: string }) {
  const bars = [
    { id: 1, animClass: 'anim-audio-bar-1', restHeight: 4 },
    { id: 2, animClass: 'anim-audio-bar-2', restHeight: 7 },
    { id: 3, animClass: 'anim-audio-bar-3', restHeight: 4 },
    { id: 4, animClass: 'anim-audio-bar-4', restHeight: 8 },
    { id: 5, animClass: 'anim-audio-bar-5', restHeight: 5 },
  ];

  return (
    <div
      className={`flex items-end justify-center gap-[3px] h-8 px-2 py-1 rounded-xl bg-[#141419] border transition-all duration-300 shrink-0 select-none ${
        isPlaying
          ? 'border-[#B9F36A]/40 shadow-sm shadow-[#B9F36A]/15 ring-1 ring-[#B9F36A]/20'
          : 'border-[#282834] opacity-50'
      } ${className}`}
      title={isPlaying ? 'Audio visualizer: Playing' : 'Audio visualizer: Inactive'}
    >
      {bars.map((bar) => (
        <span
          key={bar.id}
          style={!isPlaying ? { height: `${bar.restHeight}px` } : undefined}
          className={`w-[3px] rounded-full transition-all duration-300 ${
            isPlaying
              ? `bg-[#B9F36A] ${bar.animClass}`
              : 'bg-[#B7B7C4]/50'
          }`}
        />
      ))}
    </div>
  );
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

const VIBES = ['Hindi hits', 'New releases', 'Chill', 'Indie', 'Focus', 'Workout'] as const;

export default function App() {
  const [query, setQuery] = useState('');
  const [selectedVibe, setSelectedVibe] = useState<string>('Hindi hits');
  const [searchResults, setSearchResults] = useState<Track[] | null>(null);
  const [playerState, setPlayerState] = useState<InAppPlayerState>(inAppPlayer.getState());
  const [showNowPlayingModal, setShowNowPlayingModal] = useState(false);
  const [activeModalTab, setActiveModalTab] = useState<'player' | 'lyrics' | 'queue'>('player');
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [greetingInfo, setGreetingInfo] = useState<GreetingInfo>(() => getTimeBasedGreeting());
  const [visitorSession, setVisitorSession] = useState<VisitorSessionState>(() => musicNetworkClient.getVisitorSession());
  const [mainTab, setMainTab] = useState<'online' | 'offline'>('online');
  const [searchFilter, setSearchFilter] = useState<'all' | 'downloaded'>('all');
  const [offlineQuery, setOfflineQuery] = useState('');
  const [downloadedIds, setDownloadedIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('fm_downloaded_ids');
      return saved ? new Set(JSON.parse(saved)) : new Set(['hindi-1', 'chill-1', 'new-1']);
    } catch {
      return new Set(['hindi-1', 'chill-1', 'new-1']);
    }
  });

  const toggleDownload = (track: Track, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setDownloadedIds((prev) => {
      const next = new Set(prev);
      if (next.has(track.id)) {
        next.delete(track.id);
        setNotification(`Removed "${track.title}" from offline storage`);
      } else {
        next.add(track.id);
        setNotification(`Downloaded "${track.title}" for offline playback`);
      }
      try {
        localStorage.setItem('fm_downloaded_ids', JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
    setTimeout(() => setNotification(null), 3000);
  };

  const allDownloadedTracks = CURATED_CATALOG.filter((t) => downloadedIds.has(t.id));

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Subscribe to in-app player state
  useEffect(() => {
    const unsubscribe = inAppPlayer.subscribe((state) => {
      setPlayerState(state);
    });

    const timer = setInterval(() => {
      setGreetingInfo(getTimeBasedGreeting());
    }, 60000);

    return () => {
      unsubscribe();
      clearInterval(timer);
    };
  }, []);

  const handleRestartVisitorSession = () => {
    const session = musicNetworkClient.startVisitorSession();
    setVisitorSession(session);
    setNotification(`InnerTube visitor session active (${session.visitorData?.substring(0, 10)}...)`);
    setTimeout(() => setNotification(null), 3000);
  };

  const handleSearch = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) {
      setSearchResults(null);
      return;
    }
    const results = searchCatalog(trimmed);
    setSearchResults(results);
    setNotification(`Found ${results.length} tracks for "${trimmed}"`);
    setTimeout(() => setNotification(null), 3000);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch(query);
    }
  };

  const handlePlayTrack = (track: Track, queueList?: Track[]) => {
    inAppPlayer.playTrack(track, queueList);
    setNotification(`Now playing: ${track.title}`);
    setTimeout(() => setNotification(null), 3000);
  };

  const currentVibeTracks = CURATED_CATALOG.filter(
    (t) => t.vibe.toLowerCase() === selectedVibe.toLowerCase()
  );

  return (
    <div className="min-h-screen bg-[#111116] text-white flex flex-col font-sans selection:bg-[#B9F36A] selection:text-[#111116] pb-36">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#1B1B23] border border-[#B9F36A]/40 text-white px-5 py-2.5 rounded-full text-xs sm:text-sm font-medium shadow-2xl flex items-center gap-2 animate-fade-in">
          <span className="w-2 h-2 rounded-full bg-[#B9F36A] animate-pulse" />
          <span>{notification}</span>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-2xl mx-auto px-5 sm:px-6 pt-7">
        {/* App Bar / Header */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FmLogo size={42} />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-white font-bold tracking-[2px] text-base leading-none">FM MUSIC</span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#B9F36A]" />
              </div>
              <p className="text-[10px] text-[#B7B7C4] font-medium tracking-wider mt-1">OPEN MUSIC PLAYER</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDiagnostics(true)}
              className="px-2.5 py-1.5 rounded-full text-xs font-semibold bg-[#1B1B23] hover:bg-[#252530] text-[#B7B7C4] hover:text-white border border-[#393943] transition-colors flex items-center gap-1.5 cursor-pointer"
              title={`InnerTube Visitor Session Active: ${visitorSession.visitorData || 'Ready'}`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#B9F36A] animate-pulse" />
              <span className="text-[11px] font-bold text-[#B9F36A]">InnerTube</span>
            </button>
            <button
              onClick={() => setShowDiagnostics(true)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold bg-[#1B1B23] hover:bg-[#252530] text-[#B7B7C4] hover:text-white border border-[#393943] transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Architecture Info"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-[#B9F36A]" />
              <span>Info</span>
            </button>
          </div>
        </header>

        {/* Main Section Mode Switcher (Online Discovery vs Offline Collection) */}
        <section className="mt-5 p-1 bg-[#171720] border border-[#2B2B38] rounded-2xl flex items-center gap-1.5 shadow-sm">
          <button
            onClick={() => setMainTab('online')}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              mainTab === 'online'
                ? 'bg-[#B9F36A] text-[#111116] shadow-md shadow-[#B9F36A]/20'
                : 'text-[#B7B7C4] hover:text-white hover:bg-[#20202A]'
            }`}
          >
            <Globe className="w-4 h-4" />
            <span>Online Discovery</span>
          </button>
          <button
            onClick={() => setMainTab('offline')}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              mainTab === 'offline'
                ? 'bg-[#B9F36A] text-[#111116] shadow-md shadow-[#B9F36A]/20'
                : 'text-[#B7B7C4] hover:text-white hover:bg-[#20202A]'
            }`}
          >
            <HardDrive className="w-4 h-4" />
            <span>Offline Collection ({downloadedIds.size})</span>
          </button>
        </section>

        {mainTab === 'online' ? (
          <>
            {/* Hero Section */}
            <section className="mt-[28px]">
              <div className="flex items-center gap-2.5 mb-3">
                <FmLogo size={28} />
                <span className="text-[11px] font-semibold tracking-wider uppercase px-2.5 py-1 rounded-full bg-[#1B1B23] border border-[#393943] text-[#B9F36A] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#B9F36A] animate-pulse" />
                  {greetingInfo.tag}
                </span>
              </div>

              <h1 className="text-[32px] sm:text-[38px] leading-[38px] sm:leading-[43px] font-bold tracking-tight text-white whitespace-pre-line">
                {greetingInfo.heading}
              </h1>

              <p className="mt-[10px] text-[#B7B7C4] text-sm sm:text-base">
                {greetingInfo.subtext}
              </p>
            </section>

            {/* Search Bar Row */}
            <section className="mt-[24px]">
              <div className="flex items-center gap-2.5">
                <div className="relative flex-1">
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      if (!e.target.value.trim()) setSearchResults(null);
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="Songs, artists, albums"
                    className="w-full h-14 bg-[#181820] border border-[#393943] focus:border-[#B9F36A] focus:outline-none rounded-[16px] pl-11 pr-4 text-white placeholder-[#686875] text-base transition-colors"
                  />
                  <Search className="w-5 h-5 text-[#737384] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  {query && (
                    <button
                      onClick={() => {
                        setQuery('');
                        setSearchResults(null);
                      }}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#737384] hover:text-white cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <button
                  onClick={() => handleSearch(query)}
                  disabled={!query.trim()}
                  className="h-14 px-6 rounded-[14px] bg-[#B9F36A] hover:bg-[#a6e651] disabled:opacity-40 disabled:hover:bg-[#B9F36A] text-[#111116] font-bold text-base transition-all shrink-0 cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                >
                  <span>Search</span>
                </button>
              </div>
            </section>

            {/* Search Results Display with Online / Downloaded Filter */}
            {searchResults && (
              <section className="mt-6 bg-[#16161D] border border-[#2B2B36] rounded-2xl p-4 animate-fade-in">
                <div className="flex flex-wrap items-center justify-between pb-3 border-b border-[#242430] gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#B7B7C4] uppercase tracking-wider">
                      Search Results
                    </span>
                    <div className="flex items-center gap-1 bg-[#20202A] p-0.5 rounded-lg border border-[#323242]">
                      <button
                        onClick={() => setSearchFilter('all')}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                          searchFilter === 'all'
                            ? 'bg-[#B9F36A] text-[#111116]'
                            : 'text-[#B7B7C4] hover:text-white'
                        }`}
                      >
                        All ({searchResults.length})
                      </button>
                      <button
                        onClick={() => setSearchFilter('downloaded')}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                          searchFilter === 'downloaded'
                            ? 'bg-[#B9F36A] text-[#111116]'
                            : 'text-[#B7B7C4] hover:text-white'
                        }`}
                      >
                        Downloaded ({searchResults.filter((t) => downloadedIds.has(t.id)).length})
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={() => setSearchResults(null)}
                    className="text-xs text-[#B9F36A] hover:underline cursor-pointer"
                  >
                    Clear
                  </button>
                </div>

                <div className="mt-3 space-y-2 max-h-80 overflow-y-auto pr-1">
                  {searchResults
                    .filter((track) => (searchFilter === 'downloaded' ? downloadedIds.has(track.id) : true))
                    .map((track) => {
                      const isThisTrackPlaying =
                        playerState.currentTrack?.id === track.id && playerState.isPlaying;
                      const isDownloaded = downloadedIds.has(track.id);

                      return (
                        <div
                          key={track.id}
                          onClick={() => handlePlayTrack(track, searchResults)}
                          className="flex items-center justify-between p-2.5 rounded-xl hover:bg-[#20202A] cursor-pointer transition-colors group"
                        >
                          <div className="flex items-center gap-3 min-w-0 pr-2">
                            <div className="relative w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-[#252532]">
                              <img
                                src={track.thumbnail}
                                alt={track.title}
                                className="w-full h-full object-cover"
                              />
                              <div
                                className={`absolute inset-0 bg-black/40 flex items-center justify-center ${
                                  isThisTrackPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                                } transition-opacity`}
                              >
                                {isThisTrackPlaying ? (
                                  <AudioVisualizer isPlaying={true} className="scale-75 border-none bg-transparent" />
                                ) : (
                                  <Play className="w-4 h-4 text-[#B9F36A] fill-current" />
                                )}
                              </div>
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <h4
                                  className={`text-sm font-semibold truncate ${
                                    playerState.currentTrack?.id === track.id ? 'text-[#B9F36A]' : 'text-white'
                                  }`}
                                >
                                  {track.title}
                                </h4>
                                {isDownloaded && (
                                  <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#B9F36A]/20 text-[#B9F36A] border border-[#B9F36A]/30">
                                    Offline
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-[#B7B7C4] truncate mt-0.5">
                                {track.artist}
                              </p>
                            </div>
                          </div>
                          <div className="shrink-0 flex items-center gap-2">
                            <span className="text-xs text-[#727282] hidden sm:inline">{track.durationFormatted}</span>
                            <button
                              onClick={(e) => toggleDownload(track, e)}
                              className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                                isDownloaded
                                  ? 'bg-[#B9F36A]/20 text-[#B9F36A] hover:bg-red-500/20 hover:text-red-400'
                                  : 'bg-[#252533] text-[#A0A0B0] hover:bg-[#B9F36A] hover:text-[#111116]'
                              }`}
                              title={isDownloaded ? 'Remove download' : 'Download for offline playback'}
                            >
                              {isDownloaded ? (
                                <CheckCircle2 className="w-4 h-4" />
                              ) : (
                                <Download className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button className="w-8 h-8 rounded-full bg-[#2A2A38] group-hover:bg-[#B9F36A] text-[#B7B7C4] group-hover:text-[#111116] flex items-center justify-center transition-colors">
                              <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}

                  {searchResults.filter((track) => (searchFilter === 'downloaded' ? downloadedIds.has(track.id) : true)).length === 0 && (
                    <div className="text-center py-8 text-xs text-[#808092]">
                      No downloaded tracks match your search filter.
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Vibe Tabs Selector */}
            <section className="mt-[34px]">
              <div className="flex items-center justify-between mb-3.5">
                <h2 className="text-[#B7B7C4] text-xs font-bold tracking-[1.5px] uppercase">
                  Pick a vibe
                </h2>
                <button
                  onClick={() => handlePlayTrack(currentVibeTracks[0], currentVibeTracks)}
                  className="text-xs text-[#B9F36A] hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>Play Vibe Mix</span>
                </button>
              </div>

              {/* Vibe Pill Selector */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                {VIBES.map((vibe) => (
                  <button
                    key={vibe}
                    onClick={() => setSelectedVibe(vibe)}
                    className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all shrink-0 cursor-pointer ${
                      selectedVibe === vibe
                        ? 'bg-[#B9F36A] text-[#111116] shadow-sm shadow-[#B9F36A]/20'
                        : 'bg-[#1B1B23] hover:bg-[#262633] text-[#B7B7C4] border border-[#2F2F3D]'
                    }`}
                  >
                    {vibe}
                  </button>
                ))}
              </div>

              {/* Tracklist for Selected Vibe */}
              <div className="mt-4 space-y-2 bg-[#171720] border border-[#2A2A36] rounded-2xl p-3 sm:p-4">
                <div className="flex items-center justify-between pb-2 border-b border-[#252533] px-1 text-xs text-[#828294]">
                  <span>Tracks in {selectedVibe}</span>
                  <span>{currentVibeTracks.length} Songs</span>
                </div>

                {currentVibeTracks.map((track, idx) => {
                  const isThisTrackPlaying =
                    playerState.currentTrack?.id === track.id && playerState.isPlaying;
                  const isDownloaded = downloadedIds.has(track.id);

                  return (
                    <div
                      key={track.id}
                      onClick={() => handlePlayTrack(track, currentVibeTracks)}
                      className="flex items-center justify-between p-2.5 rounded-xl hover:bg-[#22222E] cursor-pointer transition-all group"
                    >
                      <div className="flex items-center gap-3.5 min-w-0 pr-2">
                        <span className="w-4 text-xs font-bold text-[#646476] text-center shrink-0">
                          {idx + 1}
                        </span>
                        <div className="relative w-11 h-11 rounded-lg overflow-hidden shrink-0 bg-[#242432]">
                          <img
                            src={track.thumbnail}
                            alt={track.title}
                            className="w-full h-full object-cover"
                          />
                          <div
                            className={`absolute inset-0 bg-black/40 flex items-center justify-center ${
                              isThisTrackPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                            } transition-opacity`}
                          >
                            {isThisTrackPlaying ? (
                              <span className="w-2.5 h-2.5 rounded-full bg-[#B9F36A] animate-ping" />
                            ) : (
                              <Play className="w-4 h-4 text-[#B9F36A] fill-current" />
                            )}
                          </div>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h4
                              className={`text-sm font-semibold truncate ${
                                playerState.currentTrack?.id === track.id ? 'text-[#B9F36A]' : 'text-white'
                              }`}
                            >
                              {track.title}
                            </h4>
                            {isDownloaded && (
                              <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#B9F36A]/20 text-[#B9F36A] border border-[#B9F36A]/30">
                                Offline
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[#B7B7C4] truncate mt-0.5">
                            {track.artist}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-2.5">
                        <span className="text-xs text-[#727282] hidden sm:inline">{track.durationFormatted}</span>
                        <button
                          onClick={(e) => toggleDownload(track, e)}
                          className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                            isDownloaded
                              ? 'bg-[#B9F36A]/20 text-[#B9F36A] hover:bg-red-500/20 hover:text-red-400'
                              : 'bg-[#262635] text-[#A0A0B0] hover:bg-[#B9F36A] hover:text-[#111116]'
                          }`}
                          title={isDownloaded ? 'Remove from offline' : 'Download for offline playback'}
                        >
                          {isDownloaded ? (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          ) : (
                            <Download className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePlayTrack(track, currentVibeTracks);
                          }}
                          className="w-8 h-8 rounded-full bg-[#262635] group-hover:bg-[#B9F36A] text-[#B7B7C4] group-hover:text-[#111116] flex items-center justify-center transition-colors cursor-pointer"
                        >
                          {isThisTrackPlaying ? (
                            <Pause className="w-3.5 h-3.5 fill-current" />
                          ) : (
                            <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        ) : (
          /* OFFLINE COLLECTION SECTION */
          <section className="mt-[28px] animate-fade-in space-y-5">
            {/* Offline Header Card */}
            <div className="p-5 sm:p-6 bg-[#171720] border border-[#2B2B38] rounded-2xl relative overflow-hidden">
              <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-[#B9F36A]/15 text-[#B9F36A] border border-[#B9F36A]/30">
                      LOCAL STORAGE • MEDIA3 CACHE
                    </span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                    Offline Collection
                  </h2>
                  <p className="text-xs sm:text-sm text-[#B7B7C4] mt-1">
                    {allDownloadedTracks.length} song{allDownloadedTracks.length !== 1 ? 's' : ''} saved locally. Play anytime with zero cellular data.
                  </p>
                </div>

                {allDownloadedTracks.length > 0 && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handlePlayTrack(allDownloadedTracks[0], allDownloadedTracks)}
                      className="px-4 py-2.5 rounded-xl bg-[#B9F36A] hover:bg-[#a6e651] text-[#111116] font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow-md shadow-[#B9F36A]/20 transition-all cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Play All Offline</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Offline Track Search & Filtering */}
            {allDownloadedTracks.length > 0 ? (
              <>
                <div className="relative">
                  <input
                    type="text"
                    value={offlineQuery}
                    onChange={(e) => setOfflineQuery(e.target.value)}
                    placeholder="Search your downloaded songs..."
                    className="w-full h-12 bg-[#181820] border border-[#323242] focus:border-[#B9F36A] focus:outline-none rounded-xl pl-10 pr-4 text-white placeholder-[#686875] text-sm transition-colors"
                  />
                  <Search className="w-4 h-4 text-[#737384] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  {offlineQuery && (
                    <button
                      onClick={() => setOfflineQuery('')}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#737384] hover:text-white cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Filtered Offline Songs List */}
                <div className="bg-[#171720] border border-[#2B2B38] rounded-2xl p-3 sm:p-4 space-y-2">
                  <div className="flex items-center justify-between pb-2 border-b border-[#252533] px-1 text-xs text-[#828294]">
                    <span>Downloaded Tracks</span>
                    <span>
                      {
                        allDownloadedTracks.filter((t) => {
                          if (!offlineQuery.trim()) return true;
                          const q = offlineQuery.toLowerCase();
                          return t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q);
                        }).length
                      }{' '}
                      Available
                    </span>
                  </div>

                  {allDownloadedTracks
                    .filter((t) => {
                      if (!offlineQuery.trim()) return true;
                      const q = offlineQuery.toLowerCase();
                      return t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q);
                    })
                    .map((track, idx) => {
                      const isThisTrackPlaying =
                        playerState.currentTrack?.id === track.id && playerState.isPlaying;

                      return (
                        <div
                          key={track.id}
                          onClick={() => handlePlayTrack(track, allDownloadedTracks)}
                          className="flex items-center justify-between p-2.5 rounded-xl hover:bg-[#22222E] cursor-pointer transition-all group"
                        >
                          <div className="flex items-center gap-3.5 min-w-0 pr-2">
                            <span className="w-4 text-xs font-bold text-[#646476] text-center shrink-0">
                              {idx + 1}
                            </span>
                            <div className="relative w-11 h-11 rounded-lg overflow-hidden shrink-0 bg-[#242432]">
                              <img
                                src={track.thumbnail}
                                alt={track.title}
                                className="w-full h-full object-cover"
                              />
                              <div
                                className={`absolute inset-0 bg-black/40 flex items-center justify-center ${
                                  isThisTrackPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                                } transition-opacity`}
                              >
                                {isThisTrackPlaying ? (
                                  <span className="w-2.5 h-2.5 rounded-full bg-[#B9F36A] animate-ping" />
                                ) : (
                                  <Play className="w-4 h-4 text-[#B9F36A] fill-current" />
                                )}
                              </div>
                            </div>
                            <div className="min-w-0">
                              <h4
                                className={`text-sm font-semibold truncate ${
                                  playerState.currentTrack?.id === track.id ? 'text-[#B9F36A]' : 'text-white'
                                }`}
                              >
                                {track.title}
                              </h4>
                              <p className="text-xs text-[#B7B7C4] truncate mt-0.5">
                                {track.artist}
                              </p>
                            </div>
                          </div>

                          <div className="shrink-0 flex items-center gap-2.5">
                            <span className="text-xs text-[#727282] hidden sm:inline">{track.durationFormatted}</span>
                            <button
                              onClick={(e) => toggleDownload(track, e)}
                              className="w-8 h-8 rounded-full bg-[#262635] hover:bg-red-500/20 text-[#A0A0B0] hover:text-red-400 flex items-center justify-center transition-colors cursor-pointer"
                              title="Delete from offline storage"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePlayTrack(track, allDownloadedTracks);
                              }}
                              className="w-8 h-8 rounded-full bg-[#262635] group-hover:bg-[#B9F36A] text-[#B7B7C4] group-hover:text-[#111116] flex items-center justify-center transition-colors cursor-pointer"
                            >
                              {isThisTrackPlaying ? (
                                <Pause className="w-3.5 h-3.5 fill-current" />
                              ) : (
                                <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}

                  {allDownloadedTracks.filter((t) => {
                    if (!offlineQuery.trim()) return true;
                    const q = offlineQuery.toLowerCase();
                    return t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q);
                  }).length === 0 && (
                    <div className="text-center py-8 text-xs text-[#808092]">
                      No downloaded tracks match &ldquo;{offlineQuery}&rdquo;.
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* Empty Offline State */
              <div className="bg-[#171720] border border-[#2B2B38] rounded-2xl p-8 sm:p-12 text-center flex flex-col items-center">
                <div className="w-16 h-16 rounded-2xl bg-[#22222E] border border-[#323242] flex items-center justify-center text-[#B9F36A] mb-4">
                  <Download className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-white">No Offline Tracks Yet</h3>
                <p className="text-xs sm:text-sm text-[#8E8E9E] max-w-sm mt-1.5 leading-relaxed">
                  Download songs from the Online Discovery tab by clicking the download icon next to any song to store them for offline listening.
                </p>
                <button
                  onClick={() => setMainTab('online')}
                  className="mt-6 px-5 py-2.5 rounded-xl bg-[#B9F36A] hover:bg-[#a6e651] text-[#111116] font-bold text-xs sm:text-sm transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Globe className="w-4 h-4" />
                  <span>Browse Online Music</span>
                </button>
              </div>
            )}
          </section>
        )}

        {/* Footer info */}
        <footer className="mt-8 pt-4 border-t border-[#1F1F28] text-xs text-[#7E7E8E] flex flex-wrap items-center justify-between gap-3">
          <p>FM Music in-app streaming with queue, lyrics, and audio visualizer.</p>
          <button
            onClick={() => {
              if (playerState.currentTrack) {
                window.open(`https://music.youtube.com/search?q=${encodeURIComponent(playerState.currentTrack.title)}`, '_blank');
              }
            }}
            className="text-[#B9F36A] hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>Open in YouTube Music</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        </footer>
      </main>

      {/* Bottom Player Bar */}
      <aside className="fixed bottom-0 left-0 right-0 bg-[#171720] border-t border-[#292938] shadow-[0_-10px_35px_rgba(0,0,0,0.6)] z-40">
        {/* Scrubber Progress Bar */}
        <div className="relative w-full h-1 bg-[#252535] cursor-pointer group">
          <div
            className="h-full bg-[#B9F36A] transition-all duration-150 relative"
            style={{
              width: `${playerState.duration ? (playerState.currentTime / playerState.duration) * 100 : 0}%`,
            }}
          >
            <span className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-[#B9F36A] rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <input
            type="range"
            min={0}
            max={playerState.duration || 100}
            value={playerState.currentTime}
            onChange={(e) => inAppPlayer.seekTo(Number(e.target.value))}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </div>

        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          {/* Left: Track Info & Artwork */}
          <div
            onClick={() => setShowNowPlayingModal(true)}
            className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer group"
          >
            {playerState.currentTrack ? (
              <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-[#252532] shadow-sm">
                <img
                  src={playerState.currentTrack.thumbnail}
                  alt={playerState.currentTrack.title}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="w-12 h-12 rounded-xl bg-[#1F1F2B] border border-[#2F2F3E] flex items-center justify-center shrink-0">
                <FmLogo size={24} />
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-white font-semibold text-sm truncate group-hover:text-[#B9F36A] transition-colors">
                  {playerState.currentTrack ? playerState.currentTrack.title : 'Ready to Play'}
                </h3>
                {playerState.isPlaying && (
                  <span className="shrink-0 text-[9px] font-extrabold uppercase tracking-wider text-[#111116] bg-[#B9F36A] px-1 py-0.5 rounded-xs leading-none">
                    PLAYING
                  </span>
                )}
              </div>
              <p className="text-[#A2A2B2] text-xs truncate mt-0.5">
                {playerState.currentTrack
                  ? `${playerState.currentTrack.artist} • ${formatTime(playerState.currentTime)} / ${formatTime(playerState.duration)}`
                  : 'Select a vibe or song above'}
              </p>
            </div>
          </div>

          {/* Center/Right: Audio Visualizer & Controls */}
          <div className="shrink-0 flex items-center gap-2 sm:gap-3">
            <AudioVisualizer isPlaying={playerState.isPlaying} />

            <button
              onClick={() => inAppPlayer.prev()}
              className="p-2 text-[#B7B7C4] hover:text-white transition-colors cursor-pointer"
              title="Previous Track"
            >
              <SkipBack className="w-4 h-4 fill-current" />
            </button>

            <button
              onClick={() => {
                if (!playerState.currentTrack && currentVibeTracks.length > 0) {
                  handlePlayTrack(currentVibeTracks[0], currentVibeTracks);
                } else {
                  inAppPlayer.togglePlayPause();
                }
              }}
              className="w-10 h-10 rounded-full bg-[#B9F36A] hover:bg-[#a6e651] text-[#111116] font-bold flex items-center justify-center shadow-md transition-all cursor-pointer"
              title={playerState.isPlaying ? 'Pause' : 'Play'}
            >
              {playerState.isPlaying ? (
                <Pause className="w-4 h-4 fill-current" />
              ) : (
                <Play className="w-4 h-4 fill-current ml-0.5" />
              )}
            </button>

            <button
              onClick={() => inAppPlayer.next()}
              className="p-2 text-[#B7B7C4] hover:text-white transition-colors cursor-pointer"
              title="Next Track"
            >
              <SkipForward className="w-4 h-4 fill-current" />
            </button>

            <button
              onClick={() => setShowNowPlayingModal(true)}
              className="p-2 text-[#B7B7C4] hover:text-white transition-colors cursor-pointer hidden sm:block"
              title="Open Now Playing Sheet"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Now Playing Full Screen Sheet (InnerTune / MetroList style) */}
      {showNowPlayingModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex flex-col justify-between animate-fade-in">
          {/* Top Sheet Header */}
          <div className="max-w-md w-full mx-auto px-6 pt-6 flex items-center justify-between">
            <button
              onClick={() => setShowNowPlayingModal(false)}
              className="p-2 rounded-full hover:bg-white/10 text-white transition-colors cursor-pointer"
            >
              <ChevronDown className="w-6 h-6" />
            </button>
            <div className="text-center">
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#B7B7C4]">
                PLAYING FROM {playerState.currentTrack?.vibe || 'CATALOG'}
              </span>
              <h4 className="text-xs font-semibold text-[#B9F36A] mt-0.5">FM Music Player</h4>
            </div>
            <div className="w-10" />
          </div>

          {/* Modal Tab Switcher (Player / Lyrics / Queue) */}
          <div className="max-w-md w-full mx-auto px-6 mt-3 flex justify-center gap-2">
            <button
              onClick={() => setActiveModalTab('player')}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                activeModalTab === 'player'
                  ? 'bg-[#B9F36A] text-[#111116]'
                  : 'bg-[#1E1E28] text-[#B7B7C4]'
              }`}
            >
              Track
            </button>
            <button
              onClick={() => setActiveModalTab('lyrics')}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors flex items-center gap-1 ${
                activeModalTab === 'lyrics'
                  ? 'bg-[#B9F36A] text-[#111116]'
                  : 'bg-[#1E1E28] text-[#B7B7C4]'
              }`}
            >
              <FileText className="w-3 h-3" />
              <span>Lyrics</span>
            </button>
            <button
              onClick={() => setActiveModalTab('queue')}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors flex items-center gap-1 ${
                activeModalTab === 'queue'
                  ? 'bg-[#B9F36A] text-[#111116]'
                  : 'bg-[#1E1E28] text-[#B7B7C4]'
              }`}
            >
              <ListMusic className="w-3 h-3" />
              <span>Queue ({playerState.queue.length})</span>
            </button>
          </div>

          {/* Content Body */}
          <div className="max-w-md w-full mx-auto px-6 flex-1 flex flex-col justify-center my-4 overflow-y-auto">
            {activeModalTab === 'player' && (
              <div className="flex flex-col items-center text-center">
                {/* Vinyl / Cover Art */}
                <div className="relative w-64 h-64 sm:w-72 sm:h-72 rounded-3xl overflow-hidden shadow-2xl border border-white/10 my-4 group">
                  <img
                    src={playerState.currentTrack?.thumbnail || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&q=80'}
                    alt="Album Cover"
                    className={`w-full h-full object-cover transition-transform duration-700 ${
                      playerState.isPlaying ? 'scale-105' : 'scale-100'
                    }`}
                  />
                  <div className="absolute bottom-3 right-3">
                    <AudioVisualizer isPlaying={playerState.isPlaying} />
                  </div>
                </div>

                {/* Track Details */}
                <h2 className="text-xl sm:text-2xl font-bold text-white mt-4 text-center line-clamp-1">
                  {playerState.currentTrack?.title || 'No Track Selected'}
                </h2>
                <p className="text-sm sm:text-base text-[#B7B7C4] mt-1 line-clamp-1">
                  {playerState.currentTrack?.artist || 'FM Music Catalog'}
                </p>
              </div>
            )}

            {activeModalTab === 'lyrics' && (
              <div className="bg-[#181822] border border-[#2A2A38] rounded-2xl p-6 h-80 overflow-y-auto space-y-3 text-center">
                <h3 className="text-xs uppercase tracking-widest text-[#B9F36A] font-bold pb-2 border-b border-[#2A2A38]">
                  Lyrics Preview
                </h3>
                {playerState.currentTrack?.lyrics && playerState.currentTrack.lyrics.length > 0 ? (
                  playerState.currentTrack.lyrics.map((line, idx) => (
                    <p key={idx} className="text-sm text-[#D4D4E0] font-medium leading-relaxed">
                      {line}
                    </p>
                  ))
                ) : (
                  <p className="text-xs text-[#7A7A8C] pt-12">
                    Lyrics are unavailable for this track or instrumental.
                  </p>
                )}
              </div>
            )}

            {activeModalTab === 'queue' && (
              <div className="bg-[#181822] border border-[#2A2A38] rounded-2xl p-4 h-80 overflow-y-auto space-y-2">
                <h3 className="text-xs uppercase tracking-widest text-[#B9F36A] font-bold pb-2 border-b border-[#2A2A38]">
                  Up Next Queue
                </h3>
                {playerState.queue.map((qTrack, idx) => (
                  <div
                    key={qTrack.id + idx}
                    onClick={() => handlePlayTrack(qTrack)}
                    className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition-colors ${
                      playerState.currentTrack?.id === qTrack.id
                        ? 'bg-[#B9F36A]/15 text-[#B9F36A]'
                        : 'hover:bg-white/5 text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <span className="text-xs text-[#707080] w-4">{idx + 1}</span>
                      <img src={qTrack.thumbnail} className="w-8 h-8 rounded-md object-cover" />
                      <div className="truncate">
                        <p className="text-xs font-semibold truncate">{qTrack.title}</p>
                        <p className="text-[11px] text-[#8E8E9E] truncate">{qTrack.artist}</p>
                      </div>
                    </div>
                    <span className="text-xs text-[#727282] shrink-0">{qTrack.durationFormatted}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Player Modal Controls Footer */}
          <div className="max-w-md w-full mx-auto px-6 pb-8 space-y-4">
            {/* Timeline slider */}
            <div className="space-y-1.5">
              <div className="relative w-full h-1.5 bg-white/20 rounded-full cursor-pointer">
                <div
                  className="h-full bg-[#B9F36A] rounded-full"
                  style={{
                    width: `${playerState.duration ? (playerState.currentTime / playerState.duration) * 100 : 0}%`,
                  }}
                />
                <input
                  type="range"
                  min={0}
                  max={playerState.duration || 100}
                  value={playerState.currentTime}
                  onChange={(e) => inAppPlayer.seekTo(Number(e.target.value))}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>
              <div className="flex items-center justify-between text-xs text-[#8E8E9E]">
                <span>{formatTime(playerState.currentTime)}</span>
                <span>{formatTime(playerState.duration)}</span>
              </div>
            </div>

            {/* Playback Controls Row */}
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => inAppPlayer.toggleMute()}
                className="p-2 text-[#B7B7C4] hover:text-white"
              >
                {playerState.isMuted ? <VolumeX className="w-5 h-5 text-red-400" /> : <Volume2 className="w-5 h-5" />}
              </button>

              <button
                onClick={() => inAppPlayer.prev()}
                className="p-3 text-white hover:text-[#B9F36A] transition-colors"
              >
                <SkipBack className="w-6 h-6 fill-current" />
              </button>

              <button
                onClick={() => inAppPlayer.togglePlayPause()}
                className="w-16 h-16 rounded-full bg-[#B9F36A] hover:bg-[#a6e651] text-[#111116] flex items-center justify-center shadow-xl shadow-[#B9F36A]/20 transition-all scale-100 hover:scale-105 active:scale-95"
              >
                {playerState.isPlaying ? (
                  <Pause className="w-7 h-7 fill-current" />
                ) : (
                  <Play className="w-7 h-7 fill-current ml-1" />
                )}
              </button>

              <button
                onClick={() => inAppPlayer.next()}
                className="p-3 text-white hover:text-[#B9F36A] transition-colors"
              >
                <SkipForward className="w-6 h-6 fill-current" />
              </button>

              <button
                onClick={() => inAppPlayer.next()}
                className="p-2 text-[#B7B7C4] hover:text-[#B9F36A]"
                title="Shuffle / Next"
              >
                <Shuffle className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Diagnostics / Info Modal */}
      {showDiagnostics && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-[#1B1B23] border border-[#393943] w-full max-w-lg rounded-2xl p-6 shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-[#2B2B36]">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#B9F36A]" />
                <h3 className="font-bold text-white text-lg">In-App Streaming Architecture</h3>
              </div>
              <button
                onClick={() => setShowDiagnostics(false)}
                className="p-1 rounded-lg hover:bg-[#2A2A37] text-[#B7B7C4] hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="mt-3 text-xs text-[#B7B7C4] leading-relaxed">
              Inspired by open-source clients like <strong>MetroList</strong>, <strong>InnerTune</strong>, and <strong>OuterTune</strong>:
            </p>

            {/* InnerTube Visitor Session Section */}
            <div className="mt-4 p-3.5 rounded-xl bg-[#141419] border border-[#2B2B36] space-y-2">
              <div className="flex items-center justify-between pb-1.5 border-b border-[#22222E]">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#B9F36A] animate-pulse" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    InnerTube Visitor Session
                  </span>
                </div>
                <button
                  onClick={handleRestartVisitorSession}
                  className="text-[11px] text-[#B9F36A] hover:underline font-semibold cursor-pointer"
                >
                  Renew Session
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-[#727282]">Client Context:</span>
                  <p className="text-[#D0D0E0] font-mono mt-0.5">{visitorSession.clientName}</p>
                </div>
                <div>
                  <span className="text-[#727282]">Browsing Mode:</span>
                  <p className="text-[#B9F36A] font-semibold mt-0.5">Public Unauthenticated</p>
                </div>
                <div className="col-span-2">
                  <span className="text-[#727282]">Visitor Token (X-Goog-Visitor-Id):</span>
                  <p className="text-white font-mono bg-[#1E1E28] px-2 py-1 rounded text-[10px] truncate mt-0.5 border border-[#2F2F3F]">
                    {visitorSession.visitorData || 'Generating...'}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-3 space-y-2.5">
              <div className="p-3 rounded-xl bg-[#141419] border border-[#2B2B36] flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-[#B9F36A] shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-white text-xs font-semibold">Zero-Redirect In-App Playback</h4>
                  <p className="text-[11px] text-[#A0A0B0] mt-0.5">
                    Audio plays directly in the app player using integrated streaming pipelines.
                  </p>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-[#141419] border border-[#2B2B36] flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-[#B9F36A] shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-white text-xs font-semibold">Dynamic CSS Audio Visualizer</h4>
                  <p className="text-[11px] text-[#A0A0B0] mt-0.5">
                    Real-time equalizer frequency simulation active when music is playing.
                  </p>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-[#141419] border border-[#2B2B36] flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-[#B9F36A] shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-white text-xs font-semibold">Queue & Lyrics View</h4>
                  <p className="text-[11px] text-[#A0A0B0] mt-0.5">
                    Expandable Now Playing sheet with lyrics and up-next queue management.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setShowDiagnostics(false)}
                className="px-4 py-2 bg-[#B9F36A] hover:bg-[#a6e651] text-[#111116] font-bold rounded-xl text-xs cursor-pointer transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
