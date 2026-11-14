import React, { useState, useEffect, useRef, useMemo } from 'react';
import { CURATED_CATALOG, Track, searchCatalog } from './data/musicCatalog';
import {
  inAppPlayer,
  InAppPlayerState,
  formatAudioQualityLabel,
} from './services/inAppPlayerManager';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume1,
  Volume2,
  VolumeX,
  Maximize2,
  ListMusic,
  FileText,
  Search,
  Shuffle,
  Repeat,
  Repeat1,
  ShieldCheck,
  CheckCircle2,
  X,
  ChevronDown,
  Download,
  HardDrive,
  Globe,
  Trash2,
  Zap,
  Compass,
  Loader2,
  Music2,
  KeyRound,
  Settings,
  Heart,
  Plus,
  Library,
  FolderPlus,
  Moon,
  SlidersHorizontal,
  RefreshCw,
  Clock,
  Smartphone,
  Package,
  ExternalLink,
} from 'lucide-react';
import {
  musicNetworkClient,
  VisitorSessionState,
  StreamFormatInfo,
  PlayerCodePreloadResult,
} from './services/musicNetworkClient';
import {
  ThemeId,
  UserPlaylist,
  FmMusicBackup,
  PlayerCustomization,
  loadStoredTheme,
  saveStoredTheme,
  applyThemeToDocument,
  loadPlayerCustomization,
  savePlayerCustomization,
  applyGlassCustomizationToDocument,
  loadLikedTracks,
  saveLikedTracks,
  loadPlaylists,
  savePlaylists,
  loadDownloadedTracks,
  saveDownloadedTracks,
  mergeUniqueTracks,
  mergePlaylists,
  loadSearchHistory,
  saveSearchHistory,
  addSearchHistoryItem,
  removeSearchHistoryItem,
} from './services/libraryStore';
import { fetchTrackLyrics, LyricsResult } from './services/lyricsService';
import { BUILTIN_EQ_PROFILES } from './services/webAudioEqualizer';
import {
  extractArtworkPalette,
  applyDynamicPaletteToDocument,
  DynamicPalette,
} from './services/dynamicColorExtractor';
import { TrackArtwork } from './components/TrackArtwork';
import { PlaylistPickerModal } from './components/PlaylistPickerModal';
import { SettingsModal, RestoreMode } from './components/SettingsModal';
import {
  AppUpdateCheckResult,
  CURRENT_APP_VERSION,
  checkAppUpdate,
  fetchDefaultUpdateRepo,
  formatApkSize,
  loadSkippedReleaseTag,
  loadStoredGithubRepo,
  saveSkippedReleaseTag,
  saveStoredGithubRepo,
  shouldRunAutoUpdateCheck,
} from './services/appUpdateService';

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
      style={{ width: size, height: size, backgroundColor: 'var(--fm-accent)' }}
      className={`rounded-full flex items-center justify-center shadow-md shrink-0 relative overflow-hidden select-none ${className}`}
    >
      <svg
        viewBox="0 0 44 44"
        className="w-full h-full p-1"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="22" cy="22" r="18" stroke="var(--fm-accent-fg)" strokeWidth="1.2" strokeDasharray="3 3" opacity="0.35" />
        <path d="M9 22a13 13 0 0 1 26 0" stroke="var(--fm-accent-fg)" strokeWidth="1.6" strokeLinecap="round" opacity="0.45" />
        <text
          x="22"
          y="26.5"
          textAnchor="middle"
          fill="var(--fm-accent-fg)"
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
      className={`flex items-end justify-center gap-[3px] h-8 px-2 py-1 rounded-xl liquid-glass transition-all duration-300 shrink-0 select-none ${
        isPlaying ? 'opacity-100' : 'opacity-55'
      } ${className}`}
      title={isPlaying ? 'Audio visualizer: Playing' : 'Audio visualizer: Inactive'}
    >
      {bars.map((bar) => (
        <span
          key={bar.id}
          style={!isPlaying ? { height: `${bar.restHeight}px` } : undefined}
          className={`w-[3px] rounded-full transition-all duration-300 ${
            isPlaying
              ? `bg-[var(--fm-accent)] ${bar.animClass}`
              : 'bg-[var(--fm-text-muted)]/50'
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

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

const VIBES = ['Hindi hits', 'New releases', 'Chill', 'Indie', 'Focus', 'Workout'] as const;

export default function App() {
  const [themeId, setThemeId] = useState<ThemeId>(() => loadStoredTheme());
  const [customization, setCustomization] = useState<PlayerCustomization>(() =>
    loadPlayerCustomization()
  );
  const [query, setQuery] = useState('');
  const [selectedVibe, setSelectedVibe] = useState<string>('Hindi hits');
  const [searchResults, setSearchResults] = useState<Track[] | null>(null);
  const [playerState, setPlayerState] = useState<InAppPlayerState>(inAppPlayer.getState());
  const [showNowPlayingModal, setShowNowPlayingModal] = useState(false);
  const [activeModalTab, setActiveModalTab] = useState<'player' | 'lyrics' | 'queue'>('player');
  const [showQuickDrawer, setShowQuickDrawer] = useState<'none' | 'sleep' | 'customize'>('none');
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [playlistPickerTrack, setPlaylistPickerTrack] = useState<Track | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [greetingInfo, setGreetingInfo] = useState<GreetingInfo>(() => getTimeBasedGreeting());
  const [visitorSession, setVisitorSession] = useState<VisitorSessionState>(() =>
    musicNetworkClient.getVisitorSession()
  );
  const [mainTab, setMainTab] = useState<'online' | 'library' | 'offline'>('online');
  const [searchFilter, setSearchFilter] = useState<'all' | 'downloaded'>('all');
  const [offlineQuery, setOfflineQuery] = useState('');

  // Persisted Library State (Liked Songs, Custom Playlists, Downloaded Offline Tracks)
  const [likedTracks, setLikedTracks] = useState<Track[]>(() => loadLikedTracks());
  const [playlists, setPlaylists] = useState<UserPlaylist[]>(() => loadPlaylists([]));
  const [downloadedTracks, setDownloadedTracks] = useState<Track[]>(() =>
    loadDownloadedTracks(CURATED_CATALOG)
  );
  const [selectedPlaylistView, setSelectedPlaylistView] = useState<'liked' | string>('liked');
  const [newPlaylistName, setNewPlaylistName] = useState('');

  // Live Lyrics Provider State
  const [lyricsData, setLyricsData] = useState<LyricsResult | null>(null);
  const [isLoadingLyrics, setIsLoadingLyrics] = useState(false);
  const activeLyricRef = useRef<HTMLButtonElement | null>(null);

  const [testingStream, setTestingStream] = useState(false);
  const [extractedStreamResult, setExtractedStreamResult] = useState<StreamFormatInfo | null>(null);

  const [playerCodeStatus, setPlayerCodeStatus] = useState<PlayerCodePreloadResult>(() =>
    musicNetworkClient.getPlayerCodePreloadStatus()
  );
  const [isPreloadingPlayerCode, setIsPreloadingPlayerCode] = useState(false);
  const [cipherTestResult, setCipherTestResult] = useState<string | null>(null);
  const [isSearchingOnline, setIsSearchingOnline] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>(() => loadSearchHistory());
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [mobileNavTab, setMobileNavTab] = useState<'home' | 'library' | 'offline' | 'queue'>('home');
  const [githubRepo, setGithubRepo] = useState<string>(() => loadStoredGithubRepo());
  const [updateCheckResult, setUpdateCheckResult] = useState<AppUpdateCheckResult | null>(null);
  const [updateCheckError, setUpdateCheckError] = useState<string | null>(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [showUpdatePromptModal, setShowUpdatePromptModal] = useState(false);

  const notificationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  }, []);

  const showToast = (msg: string, durationMs = 3200) => {
    setNotification(msg);
    if (notificationTimerRef.current) {
      clearTimeout(notificationTimerRef.current);
    }
    notificationTimerRef.current = setTimeout(() => {
      setNotification(null);
    }, durationMs);
  };

  const [dynamicPalette, setDynamicPalette] = useState<DynamicPalette | null>(null);

  // Apply theme CSS custom properties, root .dark/.light class, and Dynamic Color from artwork
  useEffect(() => {
    const activeTheme = applyThemeToDocument(themeId);
    saveStoredTheme(themeId);

    const thumb = playerState.currentTrack?.thumbnail;
    if (!customization.dynamicColorEnabled || !thumb) {
      setDynamicPalette(null);
      return;
    }

    let cancelled = false;
    extractArtworkPalette(thumb, activeTheme.isLight).then((palette) => {
      if (cancelled) return;
      if (palette) {
        applyDynamicPaletteToDocument(palette);
        setDynamicPalette(palette);
      } else {
        setDynamicPalette(null);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [themeId, customization.dynamicColorEnabled, playerState.currentTrack?.thumbnail]);

  // Apply Liquid Glass, Equalizer, Smart Shuffle & Player customization
  useEffect(() => {
    applyGlassCustomizationToDocument(customization);
    savePlayerCustomization(customization);
    inAppPlayer.setCrossfadeSeconds(customization.crossfadeSeconds);
    inAppPlayer.setPlaybackRate(customization.playbackRate);
    inAppPlayer.setEqualizerConfig(customization.equalizer);
    inAppPlayer.setSmartShufflePreferred(customization.smartShuffleEnabled);
  }, [customization]);

  const handleUpdateCustomization = (patch: Partial<PlayerCustomization>) => {
    setCustomization((prev) => ({ ...prev, ...patch }));
  };

  const likedIds = useMemo(() => new Set(likedTracks.map((t) => t.id)), [likedTracks]);
  const downloadedIds = useMemo(() => new Set(downloadedTracks.map((t) => t.id)), [downloadedTracks]);

  // Keep Smart Shuffle favorite boost synced with user's liked songs
  useEffect(() => {
    inAppPlayer.setFavoriteTrackIds(likedIds);
  }, [likedIds]);

  const handleSelectTheme = (nextTheme: ThemeId) => {
    setThemeId(nextTheme);
    applyThemeToDocument(nextTheme);
    saveStoredTheme(nextTheme);
    showToast('Theme applied');
  };

  const handleSetSleepTimer = (minutes: number | null) => {
    inAppPlayer.setSleepTimer(minutes);
    showToast(minutes ? `Sleep timer set for ${minutes} min` : 'Sleep timer cancelled');
  };

  const handleSetSleepAtTrackEnd = (enabled: boolean) => {
    inAppPlayer.setSleepAtTrackEnd(enabled);
    showToast(enabled ? 'Playback will pause after current song' : 'End-of-song timer off');
  };

  const loadLyricsForTrack = async (track: Track) => {
    setIsLoadingLyrics(true);
    try {
      const res = await fetchTrackLyrics({
        title: track.title,
        artist: track.artist,
        duration: track.duration,
        provider: customization.lyricsProvider,
        fallbackLyrics: track.lyrics,
      });
      setLyricsData(res);
    } finally {
      setIsLoadingLyrics(false);
    }
  };

  // Fetch lyrics whenever current track or provider changes (if autoFetchLyrics enabled or Lyrics tab active)
  useEffect(() => {
    const track = playerState.currentTrack;
    if (!track) {
      setLyricsData(null);
      return;
    }
    if (!customization.autoFetchLyrics && activeModalTab !== 'lyrics') {
      if (track.lyrics && track.lyrics.length > 0) {
        setLyricsData({
          found: true,
          provider: 'Built-in Preview',
          syncedLines: [],
          plainLines: track.lyrics,
        });
      } else {
        setLyricsData(null);
      }
      return;
    }

    let cancelled = false;
    setIsLoadingLyrics(true);
    fetchTrackLyrics({
      title: track.title,
      artist: track.artist,
      duration: track.duration,
      provider: customization.lyricsProvider,
      fallbackLyrics: track.lyrics,
    })
      .then((res) => {
        if (!cancelled) setLyricsData(res);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingLyrics(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    playerState.currentTrack?.id,
    customization.lyricsProvider,
    customization.autoFetchLyrics,
    activeModalTab,
  ]);

  // Compute current active synced lyric index
  const activeSyncedIndex = useMemo(() => {
    if (!lyricsData?.syncedLines?.length) return -1;
    const t = playerState.currentTime;
    let activeIdx = -1;
    for (let i = 0; i < lyricsData.syncedLines.length; i++) {
      if (lyricsData.syncedLines[i].time <= t + 0.35) {
        activeIdx = i;
      } else {
        break;
      }
    }
    return activeIdx;
  }, [lyricsData, playerState.currentTime]);

  useEffect(() => {
    if (activeModalTab === 'lyrics' && activeLyricRef.current) {
      activeLyricRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeSyncedIndex, activeModalTab]);

  const toggleLike = (track: Track, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setLikedTracks((prev) => {
      const exists = prev.some((t) => t.id === track.id);
      const next = exists ? prev.filter((t) => t.id !== track.id) : [track, ...prev];
      saveLikedTracks(next);
      showToast(exists ? `Removed "${track.title}" from Liked Songs` : `Saved "${track.title}" to Liked Songs`);
      return next;
    });
  };

  const toggleDownload = (track: Track, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setDownloadedTracks((prev) => {
      const exists = prev.some((t) => t.id === track.id);
      const next = exists ? prev.filter((t) => t.id !== track.id) : [track, ...prev];
      saveDownloadedTracks(next);
      showToast(
        exists
          ? `Removed "${track.title}" from offline storage`
          : `Saved "${track.title}" for offline playback`
      );
      return next;
    });
  };

  const handleCreatePlaylist = (name: string, initialTrack?: Track) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const newPl: UserPlaylist = {
      id: `pl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: trimmed,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tracks: initialTrack ? [initialTrack] : [],
    };
    setPlaylists((prev) => {
      const next = [newPl, ...prev];
      savePlaylists(next);
      return next;
    });
    setSelectedPlaylistView(newPl.id);
    showToast(
      initialTrack
        ? `Created "${trimmed}" and added "${initialTrack.title}"`
        : `Created playlist "${trimmed}"`
    );
  };

  const handleToggleTrackInPlaylist = (playlistId: string, track: Track) => {
    setPlaylists((prev) => {
      const next = prev.map((pl) => {
        if (pl.id !== playlistId) return pl;
        const exists = pl.tracks.some((t) => t.id === track.id);
        const updatedTracks = exists
          ? pl.tracks.filter((t) => t.id !== track.id)
          : [...pl.tracks, track];
        showToast(
          exists ? `Removed "${track.title}" from "${pl.name}"` : `Added "${track.title}" to "${pl.name}"`
        );
        return { ...pl, tracks: updatedTracks, updatedAt: Date.now() };
      });
      savePlaylists(next);
      return next;
    });
  };

  const handleDeletePlaylist = (playlistId: string) => {
    setPlaylists((prev) => {
      const target = prev.find((p) => p.id === playlistId);
      const next = prev.filter((p) => p.id !== playlistId);
      savePlaylists(next);
      if (target) showToast(`Deleted playlist "${target.name}"`);
      return next;
    });
    if (selectedPlaylistView === playlistId) {
      setSelectedPlaylistView('liked');
    }
  };

  const handleRestoreBackup = (backup: FmMusicBackup, mode: RestoreMode) => {
    if (mode === 'merge') {
      setLikedTracks((prev) => {
        const merged = mergeUniqueTracks(prev, backup.likedTracks);
        saveLikedTracks(merged);
        return merged;
      });
      setPlaylists((prev) => {
        const merged = mergePlaylists(prev, backup.playlists);
        savePlaylists(merged);
        return merged;
      });
      setDownloadedTracks((prev) => {
        const merged = mergeUniqueTracks(prev, backup.downloadedTracks);
        saveDownloadedTracks(merged);
        return merged;
      });
      showToast('Backup merged into your library');
    } else {
      saveLikedTracks(backup.likedTracks);
      setLikedTracks(backup.likedTracks);

      savePlaylists(backup.playlists);
      setPlaylists(backup.playlists);

      saveDownloadedTracks(backup.downloadedTracks);
      setDownloadedTracks(backup.downloadedTracks);

      if (backup.settings?.theme) {
        setThemeId(backup.settings.theme);
        applyThemeToDocument(backup.settings.theme);
        saveStoredTheme(backup.settings.theme);
      }
      if (backup.settings?.customization) {
        setCustomization(backup.settings.customization);
      }
      showToast('Library restored from backup');
    }
  };

  const handlePreloadPlayerCode = async () => {
    setIsPreloadingPlayerCode(true);
    try {
      const res = await musicNetworkClient.preloadPlayerCode();
      setPlayerCodeStatus(res);
      const sampleCipher =
        's=8976543210ZYXWVUTSRQPONMLKJIHGFEDCBAabcdefghijklmnopqrstuvwxyz&sp=sig&url=https%3A%2F%2Fgooglevideo.example.com%2Fvideoplayback%3Fexpire%3D123456';
      const deobfuscatedUrl = musicNetworkClient.deobfuscateCipherUrl(sampleCipher);
      const urlObj = new URL(deobfuscatedUrl);
      const sig = urlObj.searchParams.get('sig');
      setCipherTestResult(sig ? `Deciphered: ${sig.substring(0, 16)}...` : 'Success');
      showToast(
        `Preloaded player code: ${res.playerVersion} (${res.operationsCount} ops, ${res.sampleDecipherLatencyMs}ms)`
      );
    } catch (err: any) {
      showToast(`Preload error: ${err?.message || 'Failed'}`);
    } finally {
      setIsPreloadingPlayerCode(false);
    }
  };

  const handleExtractStream = async (videoId: string) => {
    setTestingStream(true);
    try {
      const res = await musicNetworkClient.extractPlayerStreamUrl(videoId);
      setExtractedStreamResult(res);
      showToast(`Extracted signed stream: ${res.mimeType} (${Math.round(res.bitrate / 1000)} kbps)`);
    } catch (err: any) {
      showToast(`Extraction error: ${err?.message || 'Failed'}`);
    } finally {
      setTestingStream(false);
    }
  };

  // Subscribe to in-app player state and preload player code
  useEffect(() => {
    const unsubscribe = inAppPlayer.subscribe((state) => {
      setPlayerState(state);
    });

    musicNetworkClient
      .preloadPlayerCode()
      .then((status) => {
        setPlayerCodeStatus(status);
      })
      .catch(() => {});

    let isUnmounted = false;

    const runAutoUpdateCheck = async (respectCooldown = true) => {
      if (respectCooldown && !shouldRunAutoUpdateCheck()) return;

      let targetRepo = loadStoredGithubRepo();
      if (!targetRepo) {
        const serverDefaultRepo = await fetchDefaultUpdateRepo();
        if (isUnmounted) return;
        if (serverDefaultRepo) {
          targetRepo = serverDefaultRepo;
          saveStoredGithubRepo(serverDefaultRepo);
          setGithubRepo(serverDefaultRepo);
        }
      }

      if (!targetRepo) return;

      try {
        const res = await checkAppUpdate(targetRepo, CURRENT_APP_VERSION);
        if (isUnmounted) return;
        setUpdateCheckResult(res);
        const skippedTag = loadSkippedReleaseTag();
        if (res.updateAvailable && (res.mandatory || (res.tagName && res.tagName !== skippedTag))) {
          setShowUpdatePromptModal(true);
        }
      } catch {
        // Silent failure for background auto-checks
      }
    };

    void runAutoUpdateCheck(true);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void runAutoUpdateCheck(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const autoUpdateTimer = setInterval(() => {
      void runAutoUpdateCheck(true);
    }, 30 * 60 * 1000);

    const timer = setInterval(() => {
      setGreetingInfo(getTimeBasedGreeting());
    }, 60000);

    return () => {
      isUnmounted = true;
      unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(autoUpdateTimer);
      clearInterval(timer);
      if (notificationTimerRef.current) clearTimeout(notificationTimerRef.current);
    };
  }, []);

  const handleSaveGithubRepo = (repo: string) => {
    saveStoredGithubRepo(repo);
    setGithubRepo(repo);
    setUpdateCheckError(null);
  };

  const handleCheckForUpdates = async (repoOverride?: string) => {
    const targetRepo = (repoOverride ?? githubRepo).trim();
    if (!targetRepo) {
      setUpdateCheckError('Enter a GitHub repository in owner/repo format.');
      return;
    }

    setIsCheckingUpdate(true);
    setUpdateCheckError(null);
    try {
      const res = await checkAppUpdate(targetRepo, CURRENT_APP_VERSION);
      setUpdateCheckResult(res);
      if (res.updateAvailable) {
        setShowUpdatePromptModal(true);
        showToast(`New update available: v${res.latestVersion}`);
      } else if (res.tagName) {
        showToast(`You are on the latest version (v${res.latestVersion})`);
      } else {
        showToast(`Connected to ${res.repo} — no GitHub releases published yet`);
      }
    } catch (err: any) {
      const msg = err?.message || 'Could not check GitHub for updates.';
      setUpdateCheckError(msg);
      showToast(msg);
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const handleRestartVisitorSession = () => {
    const session = musicNetworkClient.startVisitorSession();
    setVisitorSession(session);
    showToast(`InnerTube visitor session active (${session.visitorData?.substring(0, 10)}...)`);
  };

  const QUICK_SEARCH_CHIPS = [
    'Kesariya',
    'Shape of You',
    'Arijit Singh',
    'Taylor Swift',
    'Coldplay',
    'Diljit Dosanjh',
    'Blinding Lights',
    'Lofi Beats',
    'Punjabi Hits',
  ];

  const handleSearch = async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) {
      setSearchResults(null);
      return;
    }

    setIsSearchFocused(false);
    setSearchHistory((prev) => {
      const next = addSearchHistoryItem(prev, trimmed);
      saveSearchHistory(next);
      return next;
    });

    setSearchFilter('all');
    setIsSearchingOnline(true);
    showToast(`Searching online music catalog for "${trimmed}"...`, 5000);

    try {
      const onlineResults = await musicNetworkClient.searchOnlineTracks(trimmed);
      const catalogResults = searchCatalog(trimmed);

      const map = new Map<string, Track>();
      for (const item of onlineResults) {
        const key = `${item.title.toLowerCase()}___${item.artist.toLowerCase()}`;
        map.set(key, item);
      }
      for (const item of catalogResults) {
        const key = `${item.title.toLowerCase()}___${item.artist.toLowerCase()}`;
        if (!map.has(key)) {
          map.set(key, item);
        }
      }

      const merged = Array.from(map.values());
      const finalResults = merged.length > 0 ? merged : onlineResults;
      setSearchResults(finalResults);
      showToast(`Found ${finalResults.length} tracks for "${trimmed}"`);
    } catch {
      const fallback = searchCatalog(trimmed);
      setSearchResults(fallback);
      showToast(`Found ${fallback.length} tracks for "${trimmed}"`);
    } finally {
      setIsSearchingOnline(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch(query);
    } else if (e.key === 'Escape') {
      setIsSearchFocused(false);
      searchInputRef.current?.blur();
    }
  };

  const handlePlayTrack = (track: Track, queueList?: Track[]) => {
    inAppPlayer.playTrack(track, queueList);
    showToast(`Now playing: ${track.title}`);
  };

  const currentVibeTracks = useMemo(
    () => CURATED_CATALOG.filter((t) => t.vibe.toLowerCase() === selectedVibe.toLowerCase()),
    [selectedVibe]
  );

  const activeCustomPlaylist = useMemo(
    () => playlists.find((p) => p.id === selectedPlaylistView) || null,
    [playlists, selectedPlaylistView]
  );

  const VolumeIcon =
    playerState.isMuted || playerState.volume === 0
      ? VolumeX
      : playerState.volume < 50
      ? Volume1
      : Volume2;

  const renderTrackActions = (
    track: Track,
    queueContext: Track[],
    options?: { removeFromPlaylistId?: string }
  ) => {
    const isLiked = likedIds.has(track.id);
    const isDownloaded = downloadedIds.has(track.id);
    const isThisTrackPlaying = playerState.currentTrack?.id === track.id && playerState.isPlaying;

    return (
      <div className="shrink-0 flex items-center gap-1.5 sm:gap-2">
        <span className="text-xs text-[var(--fm-text-muted)] hidden md:inline mr-1 tabular-nums">
          {track.durationFormatted}
        </span>

        {/* Like / Heart Button */}
        <button
          onClick={(e) => toggleLike(track, e)}
          className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
            isLiked
              ? 'bg-[var(--fm-accent)]/20 text-[var(--fm-accent)]'
              : 'liquid-glass-button text-[var(--fm-text-muted)] hover:text-[var(--fm-text)]'
          }`}
          title={isLiked ? 'Remove from Liked Songs' : 'Like song'}
          aria-label={isLiked ? 'Unlike song' : 'Like song'}
        >
          <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
        </button>

        {/* Add to Playlist Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setPlaylistPickerTrack(track);
          }}
          className="w-9 h-9 rounded-full liquid-glass-button text-[var(--fm-text-muted)] hover:text-[var(--fm-text)] flex items-center justify-center transition-colors cursor-pointer"
          title="Add to playlist"
          aria-label="Add to playlist"
        >
          <Plus className="w-4 h-4" />
        </button>

        {/* Download / Offline Toggle */}
        <button
          onClick={(e) => toggleDownload(track, e)}
          className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
            isDownloaded
              ? 'bg-[var(--fm-accent)]/20 text-[var(--fm-accent)] hover:bg-red-500/20 hover:text-red-400'
              : 'liquid-glass-button text-[var(--fm-text-muted)] hover:text-[var(--fm-text)]'
          }`}
          title={isDownloaded ? 'Remove from offline storage' : 'Save for offline playback'}
          aria-label={isDownloaded ? 'Remove offline track' : 'Save offline'}
        >
          {isDownloaded ? <CheckCircle2 className="w-4 h-4" /> : <Download className="w-4 h-4" />}
        </button>

        {/* Optional Remove from Custom Playlist */}
        {options?.removeFromPlaylistId && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleToggleTrackInPlaylist(options.removeFromPlaylistId!, track);
            }}
            className="w-9 h-9 rounded-full liquid-glass-button text-[var(--fm-text-muted)] hover:text-red-400 flex items-center justify-center transition-colors cursor-pointer"
            title="Remove from playlist"
            aria-label="Remove from playlist"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}

        {/* Play / Pause Action */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (isThisTrackPlaying) {
              inAppPlayer.togglePlayPause();
            } else {
              handlePlayTrack(track, queueContext);
            }
          }}
          className="w-9 h-9 rounded-full bg-[var(--fm-accent)] text-[var(--fm-accent-fg)] flex items-center justify-center transition-transform hover:scale-105 cursor-pointer shadow-xs"
          title={isThisTrackPlaying ? 'Pause' : 'Play'}
          aria-label={isThisTrackPlaying ? 'Pause' : 'Play'}
        >
          {isThisTrackPlaying ? (
            <Pause className="w-4 h-4 fill-current" />
          ) : (
            <Play className="w-4 h-4 fill-current ml-0.5" />
          )}
        </button>
      </div>
    );
  };

  return (
    <div className="min-h-screen relative text-[var(--fm-text)] flex flex-col font-sans selection:bg-[var(--fm-accent)] selection:text-[var(--fm-accent-fg)] pb-44 sm:pb-32">
      {/* Ambient Liquid Glass Mesh Orbs */}
      {customization.ambientOrbsEnabled && (
        <div
          style={{ opacity: 'var(--fm-orb-opacity, 1)' }}
          className="pointer-events-none fixed inset-0 -z-10 overflow-hidden transition-opacity duration-300"
          aria-hidden="true"
        >
          <div
            style={{ background: `radial-gradient(circle, var(--fm-orb-1) 0%, transparent 70%)` }}
            className="absolute -top-32 -left-24 w-[460px] h-[460px] rounded-full blur-3xl fm-orb-animate"
          />
          <div
            style={{ background: `radial-gradient(circle, var(--fm-orb-2) 0%, transparent 70%)` }}
            className="absolute top-1/3 -right-28 w-[520px] h-[520px] rounded-full blur-3xl fm-orb-animate"
          />
          <div
            style={{ background: `radial-gradient(circle, var(--fm-orb-1) 0%, transparent 72%)` }}
            className="absolute -bottom-40 left-1/4 w-[480px] h-[480px] rounded-full blur-3xl opacity-75"
          />
        </div>
      )}

      {/* Liquid Glass Toast Notification */}
      {notification && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 liquid-glass-strong text-[var(--fm-text)] px-5 py-2.5 rounded-full text-xs sm:text-sm font-medium shadow-2xl flex items-center gap-2 animate-fade-in max-w-[90vw] truncate">
          <span className="w-2 h-2 rounded-full bg-[var(--fm-accent)] shrink-0" />
          <span className="truncate">{notification}</span>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 pt-5 sm:pt-7 pb-6">
        {/* App Bar / Header */}
        <header className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <FmLogo size={42} />
            <div className="min-w-0">
              <span className="font-bold tracking-[2px] text-base leading-none block">FM MUSIC</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {updateCheckResult?.updateAvailable && (
              <button
                onClick={() => setShowUpdatePromptModal(true)}
                className="min-h-10 px-3 py-1.5 rounded-full text-xs font-bold bg-[var(--fm-accent)] text-[var(--fm-accent-fg)] flex items-center gap-1.5 cursor-pointer shadow-sm"
                title={`Update available: v${updateCheckResult.latestVersion}`}
              >
                <Smartphone className="w-3.5 h-3.5 shrink-0" />
                <span>Update v{updateCheckResult.latestVersion}</span>
              </button>
            )}

            <button
              onClick={() => setShowDiagnostics(true)}
              className="hidden md:flex min-h-10 px-3 py-1.5 rounded-full text-xs font-semibold liquid-glass-button text-[var(--fm-text-muted)] hover:text-[var(--fm-text)] items-center gap-1.5 cursor-pointer"
              title={`InnerTube Visitor Session Active: ${visitorSession.visitorData || 'Ready'}`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-[var(--fm-accent)]" />
              <span>Diagnostics</span>
            </button>

            <button
              onClick={() => setShowSettingsModal(true)}
              className="min-h-11 min-w-11 px-3 sm:px-3.5 rounded-full text-xs sm:text-sm font-semibold liquid-glass-button text-[var(--fm-text)] flex items-center justify-center gap-1.5 cursor-pointer"
              title="Settings, Themes, Player Customization, Backup & Android APK"
              aria-label="Open Settings"
            >
              <Settings className="w-4 h-4 text-[var(--fm-accent)]" />
              <span className="hidden xs:inline">Settings</span>
            </button>
          </div>
        </header>

        {/* Main Section Mode Switcher (Online Discovery / Library & Playlists / Offline Collection) */}
        <section className="mt-5 p-1.5 liquid-glass rounded-2xl flex items-center gap-1.5">
          <button
            onClick={() => setMainTab('online')}
            className={`flex-1 min-h-11 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              mainTab === 'online'
                ? 'bg-[var(--fm-accent)] text-[var(--fm-accent-fg)] shadow-md'
                : 'text-[var(--fm-text-muted)] hover:text-[var(--fm-text)]'
            }`}
          >
            <Globe className="w-4 h-4 shrink-0" />
            <span>Discover</span>
          </button>

          <button
            onClick={() => setMainTab('library')}
            className={`flex-1 min-h-11 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              mainTab === 'library'
                ? 'bg-[var(--fm-accent)] text-[var(--fm-accent-fg)] shadow-md'
                : 'text-[var(--fm-text-muted)] hover:text-[var(--fm-text)]'
            }`}
          >
            <Library className="w-4 h-4 shrink-0" />
            <span>
              Library
              {likedTracks.length + playlists.length > 0
                ? ` (${likedTracks.length + playlists.length})`
                : ''}
            </span>
          </button>

          <button
            onClick={() => setMainTab('offline')}
            className={`flex-1 min-h-11 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              mainTab === 'offline'
                ? 'bg-[var(--fm-accent)] text-[var(--fm-accent-fg)] shadow-md'
                : 'text-[var(--fm-text-muted)] hover:text-[var(--fm-text)]'
            }`}
          >
            <HardDrive className="w-4 h-4 shrink-0" />
            <span>Offline ({downloadedTracks.length})</span>
          </button>
        </section>

        {mainTab === 'online' && (
          <>
            {/* Hero Section */}
            <section className="mt-7">
              <div className="flex items-center gap-2.5 mb-2.5">
                <FmLogo size={26} />
                <span className="text-xs font-bold tracking-wider uppercase text-[var(--fm-accent)]">
                  {greetingInfo.tag}
                </span>
              </div>

              <h1 className="text-[32px] sm:text-[42px] leading-[38px] sm:leading-[48px] font-bold tracking-tight whitespace-pre-line">
                {greetingInfo.heading}
              </h1>

              <p className="mt-2.5 text-[var(--fm-text-muted)] text-sm sm:text-base">
                {greetingInfo.subtext}
              </p>
            </section>

            {/* Search Bar Row */}
            <section className="mt-6">
              <div className="flex items-center gap-2.5">
                <div ref={searchContainerRef} className="relative flex-1">
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={query}
                    onFocus={() => setIsSearchFocused(true)}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      if (!e.target.value.trim()) setSearchResults(null);
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="Search any online song, artist, or paste YouTube link..."
                    className="w-full h-14 liquid-glass-input focus:border-[var(--fm-accent)] focus:outline-none rounded-2xl pl-11 pr-10 text-[var(--fm-text)] placeholder-[var(--fm-text-muted)]/60 text-base transition-colors"
                    aria-expanded={isSearchFocused && searchHistory.length > 0}
                    aria-haspopup="listbox"
                  />
                  <Search className="w-5 h-5 text-[var(--fm-text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  {query && (
                    <button
                      onClick={() => {
                        setQuery('');
                        setSearchResults(null);
                        searchInputRef.current?.focus();
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-full text-[var(--fm-text-muted)] hover:text-[var(--fm-text)] cursor-pointer"
                      aria-label="Clear search"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}

                  {/* Recent Search History Dropdown (last 5 queries) */}
                  {isSearchFocused && searchHistory.length > 0 && (
                    <div
                      role="listbox"
                      aria-label="Recent searches"
                      className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 liquid-glass-strong rounded-2xl p-2 shadow-2xl animate-fade-in"
                    >
                      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-[var(--fm-glass-border)]">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--fm-text-muted)]">
                          Recent Searches
                        </span>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setSearchHistory([]);
                            saveSearchHistory([]);
                            setIsSearchFocused(false);
                          }}
                          className="text-xs font-semibold text-[var(--fm-text-muted)] hover:text-[var(--fm-accent)] cursor-pointer px-1.5 py-0.5"
                        >
                          Clear all
                        </button>
                      </div>
                      <div className="mt-1 space-y-0.5">
                        {searchHistory.map((item) => (
                          <div
                            key={item}
                            className="flex items-center justify-between gap-1 rounded-xl hover:bg-[var(--fm-glass)] transition-colors"
                          >
                            <button
                              type="button"
                              role="option"
                              aria-selected={query.trim().toLowerCase() === item.toLowerCase()}
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                setQuery(item);
                                handleSearch(item);
                              }}
                              className="flex-1 min-h-11 px-2.5 py-2 flex items-center gap-2.5 text-left cursor-pointer min-w-0"
                            >
                              <Clock className="w-4 h-4 text-[var(--fm-accent)] shrink-0" />
                              <span className="text-sm font-medium text-[var(--fm-text)] truncate">
                                {item}
                              </span>
                            </button>
                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSearchHistory((prev) => {
                                  const next = removeSearchHistoryItem(prev, item);
                                  saveSearchHistory(next);
                                  return next;
                                });
                              }}
                              className="w-9 h-9 mr-1 rounded-lg flex items-center justify-center text-[var(--fm-text-muted)] hover:text-[var(--fm-text)] cursor-pointer shrink-0"
                              title={`Remove "${item}" from history`}
                              aria-label={`Remove "${item}" from history`}
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handleSearch(query)}
                  disabled={!query.trim() || isSearchingOnline}
                  className="h-14 px-5 sm:px-6 rounded-2xl bg-[var(--fm-accent)] hover:opacity-95 disabled:opacity-40 text-[var(--fm-accent-fg)] font-bold text-sm sm:text-base transition-all shrink-0 cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-1.5 shadow-md"
                >
                  {isSearchingOnline ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Search className="w-4 h-4 hidden sm:inline" />
                      <span>Search</span>
                    </>
                  )}
                </button>
              </div>

              {/* Quick Search Chips for Online Music */}
              <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                <span className="text-[11px] uppercase font-bold text-[var(--fm-text-muted)] shrink-0 mr-1">
                  Trending:
                </span>
                {QUICK_SEARCH_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    onClick={() => {
                      setQuery(chip);
                      handleSearch(chip);
                    }}
                    className="min-h-9 text-xs px-3.5 py-1.5 rounded-full liquid-glass-button text-[var(--fm-text-muted)] hover:text-[var(--fm-text)] shrink-0 cursor-pointer"
                  >
                    {chip}
                  </button>
                ))}
              </div>

              {/* Searching Online Indicator */}
              {isSearchingOnline && (
                <div className="mt-3 p-3.5 rounded-2xl liquid-glass border-[var(--fm-accent)]/40 flex items-center gap-3">
                  <Loader2 className="w-4 h-4 text-[var(--fm-accent)] animate-spin shrink-0" />
                  <div className="text-xs text-[var(--fm-text-muted)]">
                    <span className="text-[var(--fm-accent)] font-semibold">Searching live online catalog...</span>{' '}
                    Querying high-fidelity audio streams and YouTube Music.
                  </div>
                </div>
              )}
            </section>

            {/* Search Results Display with Online / Downloaded Filter */}
            {searchResults && (
              <section className="mt-6 liquid-glass rounded-3xl p-4 sm:p-5 animate-fade-in">
                <div className="flex flex-wrap items-center justify-between pb-3 border-b border-[var(--fm-glass-border)] gap-2">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="text-xs font-bold text-[var(--fm-text-muted)] uppercase tracking-wider">
                      Search Results
                    </span>
                    <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--fm-input-bg)] border border-[var(--fm-glass-border)]">
                      <button
                        onClick={() => setSearchFilter('all')}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                          searchFilter === 'all'
                            ? 'bg-[var(--fm-accent)] text-[var(--fm-accent-fg)]'
                            : 'text-[var(--fm-text-muted)] hover:text-[var(--fm-text)]'
                        }`}
                      >
                        All ({searchResults.length})
                      </button>
                      <button
                        onClick={() => setSearchFilter('downloaded')}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                          searchFilter === 'downloaded'
                            ? 'bg-[var(--fm-accent)] text-[var(--fm-accent-fg)]'
                            : 'text-[var(--fm-text-muted)] hover:text-[var(--fm-text)]'
                        }`}
                      >
                        Offline ({searchResults.filter((t) => downloadedIds.has(t.id)).length})
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={() => setSearchResults(null)}
                    className="text-xs font-semibold text-[var(--fm-accent)] hover:underline cursor-pointer"
                  >
                    Clear
                  </button>
                </div>

                <div className="mt-3 space-y-1.5 max-h-96 overflow-y-auto pr-1">
                  {searchResults
                    .filter((track) => (searchFilter === 'downloaded' ? downloadedIds.has(track.id) : true))
                    .map((track) => {
                      const isThisTrackPlaying =
                        playerState.currentTrack?.id === track.id && playerState.isPlaying;

                      return (
                        <div
                          key={track.id}
                          onClick={() => handlePlayTrack(track, searchResults)}
                          className="flex items-center justify-between p-2.5 rounded-2xl hover:bg-[var(--fm-glass)] cursor-pointer transition-colors group"
                        >
                          <div className="flex items-center gap-3 min-w-0 pr-2">
                            <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0">
                              <TrackArtwork
                                src={track.thumbnail}
                                alt={track.title}
                                className="w-full h-full"
                              />
                              <div
                                className={`absolute inset-0 bg-black/45 flex items-center justify-center ${
                                  isThisTrackPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                                } transition-opacity`}
                              >
                                {isThisTrackPlaying && customization.showVisualizer ? (
                                  <AudioVisualizer
                                    isPlaying={true}
                                    className="scale-75 border-none bg-transparent shadow-none"
                                  />
                                ) : (
                                  <Play className="w-4 h-4 text-white fill-current" />
                                )}
                              </div>
                            </div>
                            <div className="min-w-0">
                              <h4
                                className={`text-sm font-semibold truncate ${
                                  playerState.currentTrack?.id === track.id
                                    ? 'text-[var(--fm-accent)]'
                                    : 'text-[var(--fm-text)]'
                                }`}
                              >
                                {track.title}
                              </h4>
                              <p className="text-xs text-[var(--fm-text-muted)] truncate mt-0.5">
                                {track.artist}
                                {downloadedIds.has(track.id) ? ' • Offline' : ''}
                              </p>
                            </div>
                          </div>

                          {renderTrackActions(track, searchResults)}
                        </div>
                      );
                    })}

                  {searchResults.filter((track) => (searchFilter === 'downloaded' ? downloadedIds.has(track.id) : true))
                    .length === 0 && (
                    <div className="text-center py-8 text-xs text-[var(--fm-text-muted)]">
                      No offline tracks match your search filter.
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Vibe Tabs Selector */}
            <section className="mt-8">
              <div className="flex items-center justify-between mb-3.5">
                <h2 className="text-[var(--fm-text-muted)] text-xs font-bold tracking-[1.5px] uppercase">
                  Pick a vibe
                </h2>
                <button
                  onClick={() => currentVibeTracks[0] && handlePlayTrack(currentVibeTracks[0], currentVibeTracks)}
                  className="text-xs text-[var(--fm-accent)] hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Play Vibe Mix</span>
                </button>
              </div>

              {/* Vibe Pill Selector */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                {VIBES.map((vibe) => (
                  <button
                    key={vibe}
                    onClick={() => setSelectedVibe(vibe)}
                    className={`min-h-10 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all shrink-0 cursor-pointer ${
                      selectedVibe === vibe
                        ? 'bg-[var(--fm-accent)] text-[var(--fm-accent-fg)] shadow-sm'
                        : 'liquid-glass-button text-[var(--fm-text-muted)] hover:text-[var(--fm-text)]'
                    }`}
                  >
                    {vibe}
                  </button>
                ))}
              </div>

              {/* Tracklist for Selected Vibe */}
              <div className="mt-4 space-y-1.5 liquid-glass rounded-3xl p-3 sm:p-4">
                <div className="flex items-center justify-between pb-2.5 border-b border-[var(--fm-glass-border)] px-2 text-xs text-[var(--fm-text-muted)]">
                  <span>Tracks in {selectedVibe}</span>
                  <span>{currentVibeTracks.length} Songs</span>
                </div>

                {currentVibeTracks.map((track, idx) => {
                  const isThisTrackPlaying =
                    playerState.currentTrack?.id === track.id && playerState.isPlaying;

                  return (
                    <div
                      key={track.id}
                      onClick={() => handlePlayTrack(track, currentVibeTracks)}
                      className="flex items-center justify-between p-2.5 rounded-2xl hover:bg-[var(--fm-glass)] cursor-pointer transition-all group"
                    >
                      <div className="flex items-center gap-3.5 min-w-0 pr-2">
                        <span className="w-4 text-xs font-bold text-[var(--fm-text-muted)] text-center shrink-0 tabular-nums">
                          {idx + 1}
                        </span>
                        <div className="relative w-11 h-11 rounded-xl overflow-hidden shrink-0">
                          <TrackArtwork
                            src={track.thumbnail}
                            alt={track.title}
                            className="w-full h-full"
                          />
                          <div
                            className={`absolute inset-0 bg-black/45 flex items-center justify-center ${
                              isThisTrackPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                            } transition-opacity`}
                          >
                            {isThisTrackPlaying ? (
                              <span className="w-2.5 h-2.5 rounded-full bg-[var(--fm-accent)] animate-ping" />
                            ) : (
                              <Play className="w-4 h-4 text-white fill-current" />
                            )}
                          </div>
                        </div>
                        <div className="min-w-0">
                          <h4
                            className={`text-sm font-semibold truncate ${
                              playerState.currentTrack?.id === track.id
                                ? 'text-[var(--fm-accent)]'
                                : 'text-[var(--fm-text)]'
                            }`}
                          >
                            {track.title}
                          </h4>
                          <p className="text-xs text-[var(--fm-text-muted)] truncate mt-0.5">
                            {track.artist}
                            {downloadedIds.has(track.id) ? ' • Offline' : ''}
                          </p>
                        </div>
                      </div>

                      {renderTrackActions(track, currentVibeTracks)}
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}

        {mainTab === 'library' && (
          /* LIBRARY: LIKED SONGS & CUSTOM PLAYLISTS */
          <section className="mt-7 animate-fade-in space-y-5">
            <div className="p-5 sm:p-6 liquid-glass rounded-3xl flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[var(--fm-accent)]">
                  Personal Library
                </p>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mt-1">
                  Playlists & Liked Songs
                </h2>
                <p className="text-xs sm:text-sm text-[var(--fm-text-muted)] mt-1">
                  {likedTracks.length} liked songs • {playlists.length} custom playlists. Export or restore anytime in Settings.
                </p>
              </div>
              <button
                onClick={() => setShowSettingsModal(true)}
                className="min-h-11 px-4 py-2 rounded-xl liquid-glass-button text-xs sm:text-sm font-bold flex items-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4 text-[var(--fm-accent)]" />
                <span>Backup / Restore</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
              <div className="md:col-span-4 space-y-3">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!newPlaylistName.trim()) return;
                    handleCreatePlaylist(newPlaylistName);
                    setNewPlaylistName('');
                  }}
                  className="liquid-glass rounded-2xl p-3 flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={newPlaylistName}
                    onChange={(e) => setNewPlaylistName(e.target.value)}
                    placeholder="New playlist name..."
                    className="flex-1 min-w-0 h-10 px-3 rounded-xl liquid-glass-input text-xs sm:text-sm text-[var(--fm-text)] placeholder-[var(--fm-text-muted)]/60 focus:outline-none focus:border-[var(--fm-accent)]"
                  />
                  <button
                    type="submit"
                    disabled={!newPlaylistName.trim()}
                    className="h-10 px-3 rounded-xl bg-[var(--fm-accent)] text-[var(--fm-accent-fg)] font-bold text-xs flex items-center gap-1 disabled:opacity-40 cursor-pointer shrink-0"
                    title="Create Playlist"
                  >
                    <FolderPlus className="w-4 h-4" />
                    <span>Add</span>
                  </button>
                </form>

                <div className="liquid-glass rounded-2xl p-2 space-y-1.5">
                  <button
                    onClick={() => setSelectedPlaylistView('liked')}
                    className={`w-full min-h-12 px-3 py-2.5 rounded-xl flex items-center justify-between gap-2 transition-all cursor-pointer ${
                      selectedPlaylistView === 'liked'
                        ? 'bg-[var(--fm-accent)] text-[var(--fm-accent-fg)] font-bold'
                        : 'hover:bg-[var(--fm-glass)] text-[var(--fm-text)]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Heart className="w-4 h-4 fill-current shrink-0" />
                      <span className="text-sm truncate">Liked Songs</span>
                    </div>
                    <span className="text-xs opacity-80 shrink-0 tabular-nums">{likedTracks.length}</span>
                  </button>

                  {playlists.map((pl) => {
                    const isSelected = selectedPlaylistView === pl.id;
                    return (
                      <div
                        key={pl.id}
                        className={`flex items-center justify-between gap-1 rounded-xl transition-all ${
                          isSelected
                            ? 'bg-[var(--fm-accent)] text-[var(--fm-accent-fg)] font-bold'
                            : 'hover:bg-[var(--fm-glass)] text-[var(--fm-text)]'
                        }`}
                      >
                        <button
                          onClick={() => setSelectedPlaylistView(pl.id)}
                          className="flex-1 min-h-12 px-3 py-2.5 flex items-center justify-between gap-2 text-left cursor-pointer min-w-0"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <ListMusic className="w-4 h-4 shrink-0" />
                            <span className="text-sm truncate">{pl.name}</span>
                          </div>
                          <span className="text-xs opacity-80 shrink-0 tabular-nums">{pl.tracks.length}</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeletePlaylist(pl.id);
                          }}
                          className={`w-9 h-9 mr-1 rounded-lg flex items-center justify-center shrink-0 cursor-pointer ${
                            isSelected
                              ? 'hover:bg-black/15 text-[var(--fm-accent-fg)]'
                              : 'hover:bg-red-500/20 text-[var(--fm-text-muted)] hover:text-red-400'
                          }`}
                          title={`Delete ${pl.name}`}
                          aria-label={`Delete playlist ${pl.name}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="md:col-span-8">
                {selectedPlaylistView === 'liked' ? (
                  <div className="liquid-glass rounded-3xl p-4 sm:p-5 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[var(--fm-glass-border)]">
                      <div>
                        <h3 className="text-lg font-bold">Liked Songs</h3>
                        <p className="text-xs text-[var(--fm-text-muted)]">
                          {likedTracks.length} {likedTracks.length === 1 ? 'track' : 'tracks'}
                        </p>
                      </div>
                      {likedTracks.length > 0 && (
                        <button
                          onClick={() => handlePlayTrack(likedTracks[0], likedTracks)}
                          className="min-h-10 px-4 py-2 rounded-xl bg-[var(--fm-accent)] text-[var(--fm-accent-fg)] font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Play Liked</span>
                        </button>
                      )}
                    </div>

                    {likedTracks.length === 0 ? (
                      <div className="text-center py-10 space-y-3">
                        <Heart className="w-9 h-9 text-[var(--fm-accent)] mx-auto opacity-80" />
                        <p className="text-sm font-semibold">No Liked Songs Yet</p>
                        <p className="text-xs text-[var(--fm-text-muted)] max-w-xs mx-auto">
                          Tap the heart icon on any song from Discover or Search to add it here.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {likedTracks.map((track, idx) => {
                          const isThisTrackPlaying =
                            playerState.currentTrack?.id === track.id && playerState.isPlaying;
                          return (
                            <div
                              key={track.id}
                              onClick={() => handlePlayTrack(track, likedTracks)}
                              className="flex items-center justify-between p-2.5 rounded-2xl hover:bg-[var(--fm-glass)] cursor-pointer transition-all group"
                            >
                              <div className="flex items-center gap-3 min-w-0 pr-2">
                                <span className="w-4 text-xs font-bold text-[var(--fm-text-muted)] text-center shrink-0 tabular-nums">
                                  {idx + 1}
                                </span>
                                <div className="relative w-11 h-11 rounded-xl overflow-hidden shrink-0">
                                  <TrackArtwork src={track.thumbnail} alt={track.title} className="w-full h-full" />
                                  {isThisTrackPlaying && (
                                    <div className="absolute inset-0 bg-black/45 flex items-center justify-center">
                                      <span className="w-2.5 h-2.5 rounded-full bg-[var(--fm-accent)] animate-ping" />
                                    </div>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <h4
                                    className={`text-sm font-semibold truncate ${
                                      playerState.currentTrack?.id === track.id
                                        ? 'text-[var(--fm-accent)]'
                                        : 'text-[var(--fm-text)]'
                                    }`}
                                  >
                                    {track.title}
                                  </h4>
                                  <p className="text-xs text-[var(--fm-text-muted)] truncate mt-0.5">
                                    {track.artist}
                                  </p>
                                </div>
                              </div>
                              {renderTrackActions(track, likedTracks)}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : activeCustomPlaylist ? (
                  <div className="liquid-glass rounded-3xl p-4 sm:p-5 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[var(--fm-glass-border)]">
                      <div>
                        <h3 className="text-lg font-bold">{activeCustomPlaylist.name}</h3>
                        <p className="text-xs text-[var(--fm-text-muted)]">
                          {activeCustomPlaylist.tracks.length}{' '}
                          {activeCustomPlaylist.tracks.length === 1 ? 'track' : 'tracks'}
                        </p>
                      </div>
                      {activeCustomPlaylist.tracks.length > 0 && (
                        <button
                          onClick={() =>
                            handlePlayTrack(activeCustomPlaylist.tracks[0], activeCustomPlaylist.tracks)
                          }
                          className="min-h-10 px-4 py-2 rounded-xl bg-[var(--fm-accent)] text-[var(--fm-accent-fg)] font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Play Playlist</span>
                        </button>
                      )}
                    </div>

                    {activeCustomPlaylist.tracks.length === 0 ? (
                      <div className="text-center py-10 space-y-3">
                        <ListMusic className="w-9 h-9 text-[var(--fm-accent)] mx-auto opacity-80" />
                        <p className="text-sm font-semibold">Playlist is Empty</p>
                        <p className="text-xs text-[var(--fm-text-muted)] max-w-xs mx-auto">
                          Tap the + icon on any track in Discover or Search to add songs to &ldquo;{activeCustomPlaylist.name}&rdquo;.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {activeCustomPlaylist.tracks.map((track, idx) => {
                          const isThisTrackPlaying =
                            playerState.currentTrack?.id === track.id && playerState.isPlaying;
                          return (
                            <div
                              key={track.id}
                              onClick={() => handlePlayTrack(track, activeCustomPlaylist.tracks)}
                              className="flex items-center justify-between p-2.5 rounded-2xl hover:bg-[var(--fm-glass)] cursor-pointer transition-all group"
                            >
                              <div className="flex items-center gap-3 min-w-0 pr-2">
                                <span className="w-4 text-xs font-bold text-[var(--fm-text-muted)] text-center shrink-0 tabular-nums">
                                  {idx + 1}
                                </span>
                                <div className="relative w-11 h-11 rounded-xl overflow-hidden shrink-0">
                                  <TrackArtwork src={track.thumbnail} alt={track.title} className="w-full h-full" />
                                  {isThisTrackPlaying && (
                                    <div className="absolute inset-0 bg-black/45 flex items-center justify-center">
                                      <span className="w-2.5 h-2.5 rounded-full bg-[var(--fm-accent)] animate-ping" />
                                    </div>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <h4
                                    className={`text-sm font-semibold truncate ${
                                      playerState.currentTrack?.id === track.id
                                        ? 'text-[var(--fm-accent)]'
                                        : 'text-[var(--fm-text)]'
                                    }`}
                                  >
                                    {track.title}
                                  </h4>
                                  <p className="text-xs text-[var(--fm-text-muted)] truncate mt-0.5">
                                    {track.artist}
                                  </p>
                                </div>
                              </div>
                              {renderTrackActions(track, activeCustomPlaylist.tracks, {
                                removeFromPlaylistId: activeCustomPlaylist.id,
                              })}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        )}

        {mainTab === 'offline' && (
          /* OFFLINE COLLECTION SECTION */
          <section className="mt-7 animate-fade-in space-y-5">
            <div className="p-5 sm:p-6 liquid-glass rounded-3xl relative overflow-hidden">
              <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-[var(--fm-accent)]">
                    Local Storage • Saved Tracks
                  </p>
                  <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mt-1">
                    Offline Collection
                  </h2>
                  <p className="text-xs sm:text-sm text-[var(--fm-text-muted)] mt-1">
                    {downloadedTracks.length} song{downloadedTracks.length !== 1 ? 's' : ''} saved in your collection.
                  </p>
                </div>

                {downloadedTracks.length > 0 && (
                  <button
                    onClick={() => handlePlayTrack(downloadedTracks[0], downloadedTracks)}
                    className="min-h-11 px-4 py-2.5 rounded-xl bg-[var(--fm-accent)] hover:opacity-95 text-[var(--fm-accent-fg)] font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Play All Offline</span>
                  </button>
                )}
              </div>
            </div>

            {downloadedTracks.length > 0 ? (
              <>
                <div className="relative">
                  <input
                    type="text"
                    value={offlineQuery}
                    onChange={(e) => setOfflineQuery(e.target.value)}
                    placeholder="Search your saved songs..."
                    className="w-full h-12 liquid-glass-input focus:border-[var(--fm-accent)] focus:outline-none rounded-2xl pl-10 pr-10 text-[var(--fm-text)] placeholder-[var(--fm-text-muted)]/60 text-sm transition-colors"
                  />
                  <Search className="w-4 h-4 text-[var(--fm-text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  {offlineQuery && (
                    <button
                      onClick={() => setOfflineQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--fm-text-muted)] hover:text-[var(--fm-text)] cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="liquid-glass rounded-3xl p-3 sm:p-4 space-y-1.5">
                  <div className="flex items-center justify-between pb-2 border-b border-[var(--fm-glass-border)] px-2 text-xs text-[var(--fm-text-muted)]">
                    <span>Saved Tracks</span>
                    <span>
                      {
                        downloadedTracks.filter((t) => {
                          if (!offlineQuery.trim()) return true;
                          const q = offlineQuery.toLowerCase();
                          return t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q);
                        }).length
                      }{' '}
                      Available
                    </span>
                  </div>

                  {downloadedTracks
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
                          onClick={() => handlePlayTrack(track, downloadedTracks)}
                          className="flex items-center justify-between p-2.5 rounded-2xl hover:bg-[var(--fm-glass)] cursor-pointer transition-all group"
                        >
                          <div className="flex items-center gap-3.5 min-w-0 pr-2">
                            <span className="w-4 text-xs font-bold text-[var(--fm-text-muted)] text-center shrink-0 tabular-nums">
                              {idx + 1}
                            </span>
                            <div className="relative w-11 h-11 rounded-xl overflow-hidden shrink-0">
                              <TrackArtwork src={track.thumbnail} alt={track.title} className="w-full h-full" />
                              <div
                                className={`absolute inset-0 bg-black/45 flex items-center justify-center ${
                                  isThisTrackPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                                } transition-opacity`}
                              >
                                {isThisTrackPlaying ? (
                                  <span className="w-2.5 h-2.5 rounded-full bg-[var(--fm-accent)] animate-ping" />
                                ) : (
                                  <Play className="w-4 h-4 text-white fill-current" />
                                )}
                              </div>
                            </div>
                            <div className="min-w-0">
                              <h4
                                className={`text-sm font-semibold truncate ${
                                  playerState.currentTrack?.id === track.id
                                    ? 'text-[var(--fm-accent)]'
                                    : 'text-[var(--fm-text)]'
                                }`}
                              >
                                {track.title}
                              </h4>
                              <p className="text-xs text-[var(--fm-text-muted)] truncate mt-0.5">
                                {track.artist}
                              </p>
                            </div>
                          </div>

                          {renderTrackActions(track, downloadedTracks)}
                        </div>
                      );
                    })}

                  {downloadedTracks.filter((t) => {
                    if (!offlineQuery.trim()) return true;
                    const q = offlineQuery.toLowerCase();
                    return t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q);
                  }).length === 0 && (
                    <div className="text-center py-8 text-xs text-[var(--fm-text-muted)]">
                      No saved tracks match &ldquo;{offlineQuery}&rdquo;.
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="liquid-glass rounded-3xl p-8 sm:p-12 text-center flex flex-col items-center">
                <div className="w-16 h-16 rounded-2xl liquid-glass flex items-center justify-center text-[var(--fm-accent)] mb-4">
                  <Download className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold">No Offline Tracks Yet</h3>
                <p className="text-xs sm:text-sm text-[var(--fm-text-muted)] max-w-sm mt-1.5 leading-relaxed">
                  Tap the download icon next to any song in Discover or Search to save it in your offline collection.
                </p>
                <button
                  onClick={() => setMainTab('online')}
                  className="mt-6 min-h-11 px-5 py-2.5 rounded-xl bg-[var(--fm-accent)] hover:opacity-95 text-[var(--fm-accent-fg)] font-bold text-xs sm:text-sm transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Globe className="w-4 h-4" />
                  <span>Browse Online Music</span>
                </button>
              </div>
            )}
          </section>
        )}
      </main>

      {/* Bottom Floating Liquid Glass Mini-Player Bar */}
      <aside className="fixed bottom-16 sm:bottom-3 left-0 right-0 sm:left-4 sm:right-4 max-w-4xl sm:mx-auto liquid-glass-strong sm:rounded-3xl z-40 transition-all overflow-hidden">
        {/* Scrubber Progress Bar */}
        <div className="relative w-full h-1 bg-[var(--fm-glass-border)] cursor-pointer group">
          <div
            className="h-full bg-[var(--fm-accent)] transition-all duration-150 relative"
            style={{
              width: `${playerState.duration ? (playerState.currentTime / playerState.duration) * 100 : 0}%`,
            }}
          >
            <span className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-[var(--fm-accent)] rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <input
            type="range"
            min={0}
            max={playerState.duration || 100}
            value={playerState.currentTime}
            onChange={(e) => inAppPlayer.seekTo(Number(e.target.value))}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            aria-label="Seek track position"
          />
        </div>

        <div className="px-3 sm:px-4 py-2 sm:py-2.5 flex items-center justify-between gap-2.5 sm:gap-3">
          {/* Left: Track Info & Artwork */}
          <div
            onClick={() => setShowNowPlayingModal(true)}
            className="flex items-center gap-2.5 sm:gap-3 flex-1 min-w-0 cursor-pointer group"
          >
            {playerState.currentTrack ? (
              <div className="relative w-11 h-11 sm:w-12 sm:h-12 rounded-xl overflow-hidden shrink-0 shadow-sm">
                <TrackArtwork
                  src={playerState.currentTrack.thumbnail}
                  alt={playerState.currentTrack.title}
                  className="w-full h-full"
                />
              </div>
            ) : (
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl liquid-glass flex items-center justify-center shrink-0">
                <FmLogo size={24} />
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h3 className="font-semibold text-xs sm:text-sm truncate group-hover:text-[var(--fm-accent)] transition-colors">
                  {playerState.currentTrack ? playerState.currentTrack.title : 'Ready to Play'}
                </h3>
                {(playerState.sleepTimerRemainingSec || playerState.sleepAtTrackEnd) && (
                  <span className="shrink-0 text-[10px] font-bold text-[var(--fm-accent)] flex items-center gap-0.5 tabular-nums">
                    <Moon className="w-3 h-3" />
                    {playerState.sleepAtTrackEnd
                      ? 'End'
                      : formatCountdown(playerState.sleepTimerRemainingSec || 0)}
                  </span>
                )}
              </div>
              <p className="text-[var(--fm-text-muted)] text-[11px] sm:text-xs truncate mt-0.5 tabular-nums">
                {playerState.currentTrack
                  ? `${playerState.currentTrack.artist} • ${formatTime(playerState.currentTime)} / ${formatTime(playerState.duration)}`
                  : 'Select a vibe or song above'}
              </p>
            </div>
          </div>

          {/* Right: Visualizer, Volume & Controls */}
          <div className="shrink-0 flex items-center gap-1 sm:gap-2">
            {customization.showVisualizer && (
              <AudioVisualizer isPlaying={playerState.isPlaying} className="hidden lg:flex" />
            )}

            {/* Desktop Volume Slider */}
            <div className="hidden md:flex items-center gap-1.5 px-2 py-1 rounded-full liquid-glass">
              <button
                onClick={() => inAppPlayer.toggleMute()}
                className="w-7 h-7 rounded-full flex items-center justify-center text-[var(--fm-text-muted)] hover:text-[var(--fm-text)] cursor-pointer"
                title={playerState.isMuted ? 'Unmute' : 'Mute'}
                aria-label={playerState.isMuted ? 'Unmute' : 'Mute'}
              >
                <VolumeIcon className="w-4 h-4" />
              </button>
              <input
                type="range"
                min={0}
                max={100}
                value={playerState.isMuted ? 0 : playerState.volume}
                onChange={(e) => inAppPlayer.setVolume(Number(e.target.value))}
                className="w-16 fm-range"
                aria-label="Volume"
              />
            </div>

            {playerState.currentTrack && (
              <button
                onClick={(e) => toggleLike(playerState.currentTrack!, e)}
                className={`hidden sm:flex w-9 h-9 rounded-full items-center justify-center cursor-pointer transition-colors ${
                  likedIds.has(playerState.currentTrack.id)
                    ? 'text-[var(--fm-accent)]'
                    : 'text-[var(--fm-text-muted)] hover:text-[var(--fm-text)]'
                }`}
                title="Like current track"
                aria-label="Like current track"
              >
                <Heart
                  className={`w-4 h-4 ${likedIds.has(playerState.currentTrack.id) ? 'fill-current' : ''}`}
                />
              </button>
            )}

            <button
              onClick={() => inAppPlayer.prev()}
              className="w-9 h-9 rounded-full flex items-center justify-center text-[var(--fm-text-muted)] hover:text-[var(--fm-text)] transition-colors cursor-pointer"
              title="Previous Track"
              aria-label="Previous Track"
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
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[var(--fm-accent)] hover:opacity-95 text-[var(--fm-accent-fg)] font-bold flex items-center justify-center shadow-md transition-all cursor-pointer"
              title={playerState.isPlaying ? 'Pause' : 'Play'}
              aria-label={playerState.isPlaying ? 'Pause' : 'Play'}
            >
              {playerState.isPlaying ? (
                <Pause className="w-4 h-4 fill-current" />
              ) : (
                <Play className="w-4 h-4 fill-current ml-0.5" />
              )}
            </button>

            <button
              onClick={() => inAppPlayer.next()}
              className="w-9 h-9 rounded-full flex items-center justify-center text-[var(--fm-text-muted)] hover:text-[var(--fm-text)] transition-colors cursor-pointer"
              title="Next Track"
              aria-label="Next Track"
            >
              <SkipForward className="w-4 h-4 fill-current" />
            </button>

            <button
              onClick={() => setShowNowPlayingModal(true)}
              className="w-9 h-9 rounded-full flex items-center justify-center text-[var(--fm-text-muted)] hover:text-[var(--fm-text)] transition-colors cursor-pointer"
              title="Open Now Playing Sheet"
              aria-label="Open Now Playing Sheet"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 liquid-glass-strong z-40 flex items-center justify-around px-2 sm:hidden pb-[env(safe-area-inset-bottom)] select-none">
        <button
          onClick={() => {
            setMainTab('online');
            setMobileNavTab('home');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`flex-1 min-h-11 py-1 flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
            mainTab === 'online' ? 'text-[var(--fm-accent)]' : 'text-[var(--fm-text-muted)]'
          }`}
        >
          <Compass className="w-5 h-5" />
          <span className="text-[10px] font-bold">Discover</span>
        </button>

        <button
          onClick={() => {
            setMainTab('library');
            setMobileNavTab('library');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`flex-1 min-h-11 py-1 flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
            mainTab === 'library' ? 'text-[var(--fm-accent)]' : 'text-[var(--fm-text-muted)]'
          }`}
        >
          <Library className="w-5 h-5" />
          <span className="text-[10px] font-bold">Library</span>
        </button>

        <button
          onClick={() => {
            setMainTab('offline');
            setMobileNavTab('offline');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`flex-1 min-h-11 py-1 flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer relative ${
            mainTab === 'offline' ? 'text-[var(--fm-accent)]' : 'text-[var(--fm-text-muted)]'
          }`}
        >
          <div className="relative">
            <HardDrive className="w-5 h-5" />
            {downloadedTracks.length > 0 && (
              <span className="absolute -top-1 -right-2 bg-[var(--fm-accent)] text-[var(--fm-accent-fg)] text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                {downloadedTracks.length}
              </span>
            )}
          </div>
          <span className="text-[10px] font-bold">Offline</span>
        </button>

        <button
          onClick={() => {
            setShowNowPlayingModal(true);
            setMobileNavTab('queue');
          }}
          className={`flex-1 min-h-11 py-1 flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
            mobileNavTab === 'queue' || playerState.isPlaying
              ? 'text-[var(--fm-accent)]'
              : 'text-[var(--fm-text-muted)]'
          }`}
        >
          <Music2 className="w-5 h-5" />
          <span className="text-[10px] font-bold">Player</span>
        </button>
      </nav>

      {/* Now Playing Full Screen Liquid Glass Sheet */}
      {showNowPlayingModal && (
        <div
          style={{ backgroundColor: 'var(--fm-bg)' }}
          className="fixed inset-0 z-50 flex flex-col justify-between animate-fade-in pb-[env(safe-area-inset-bottom)] overflow-hidden"
        >
          {/* Ambient sheet orbs */}
          {customization.ambientOrbsEnabled && (
            <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
              <div
                style={{ background: `radial-gradient(circle, var(--fm-orb-1) 0%, transparent 70%)` }}
                className="absolute -top-24 left-1/4 w-96 h-96 rounded-full blur-3xl"
              />
              <div
                style={{ background: `radial-gradient(circle, var(--fm-orb-2) 0%, transparent 70%)` }}
                className="absolute bottom-0 right-1/4 w-96 h-96 rounded-full blur-3xl"
              />
            </div>
          )}

          {/* Top Sheet Header */}
          <div className="max-w-md w-full mx-auto px-5 sm:px-6 pt-3 sm:pt-5 flex flex-col items-center">
            <div
              onClick={() => setShowNowPlayingModal(false)}
              className="w-12 h-1.5 rounded-full bg-[var(--fm-text-muted)]/30 mb-2 cursor-pointer hover:bg-[var(--fm-text-muted)]/60 transition-colors"
            />
            <div className="w-full flex items-center justify-between gap-2">
              <button
                onClick={() => setShowNowPlayingModal(false)}
                className="w-11 h-11 rounded-full liquid-glass-button flex items-center justify-center text-[var(--fm-text)] cursor-pointer shrink-0"
                title="Collapse player"
                aria-label="Collapse player"
              >
                <ChevronDown className="w-5 h-5" />
              </button>

              <div className="text-center px-2 min-w-0">
                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-[var(--fm-text-muted)] block truncate">
                  {playerState.currentTrack?.vibe || 'NOW PLAYING'}
                </span>
                {(playerState.sleepTimerRemainingSec || playerState.sleepAtTrackEnd) ? (
                  <span className="text-xs font-semibold text-[var(--fm-accent)] mt-0.5 inline-flex items-center gap-1 tabular-nums">
                    <Moon className="w-3 h-3" />
                    {playerState.sleepAtTrackEnd
                      ? 'Sleep at song end'
                      : `Sleep in ${formatCountdown(playerState.sleepTimerRemainingSec || 0)}`}
                  </span>
                ) : (
                  <h4 className="text-xs font-semibold text-[var(--fm-accent)] mt-0.5">FM Music</h4>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => setShowQuickDrawer((d) => (d === 'sleep' ? 'none' : 'sleep'))}
                  className={`w-11 h-11 rounded-full flex items-center justify-center cursor-pointer transition-colors ${
                    showQuickDrawer === 'sleep' ||
                    playerState.sleepTimerRemainingSec ||
                    playerState.sleepAtTrackEnd
                      ? 'bg-[var(--fm-accent)] text-[var(--fm-accent-fg)]'
                      : 'liquid-glass-button text-[var(--fm-text)]'
                  }`}
                  title="Sleep Timer"
                  aria-label="Sleep Timer"
                >
                  <Moon className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setShowQuickDrawer((d) => (d === 'customize' ? 'none' : 'customize'))}
                  className={`w-11 h-11 rounded-full flex items-center justify-center cursor-pointer transition-colors ${
                    showQuickDrawer === 'customize'
                      ? 'bg-[var(--fm-accent)] text-[var(--fm-accent-fg)]'
                      : 'liquid-glass-button text-[var(--fm-text)]'
                  }`}
                  title="Customize Player & Crossfade"
                  aria-label="Customize Player"
                >
                  <SlidersHorizontal className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Inline Sleep Timer or Player Customization Quick Drawer */}
          {showQuickDrawer !== 'none' && (
            <div className="max-w-md w-full mx-auto px-5 sm:px-6 mt-3 animate-fade-in">
              <div className="liquid-glass-strong rounded-2xl p-4 space-y-3">
                {showQuickDrawer === 'sleep' && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-[var(--fm-accent)]">
                        Sleep Timer
                      </span>
                      <button
                        onClick={() => setShowQuickDrawer('none')}
                        className="text-xs text-[var(--fm-text-muted)] hover:text-[var(--fm-text)] cursor-pointer"
                      >
                        Done
                      </button>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        onClick={() => {
                          handleSetSleepTimer(null);
                          handleSetSleepAtTrackEnd(false);
                        }}
                        className={`min-h-9 px-3 rounded-xl text-xs font-bold cursor-pointer ${
                          !playerState.sleepTimerRemainingSec && !playerState.sleepAtTrackEnd
                            ? 'bg-[var(--fm-accent)] text-[var(--fm-accent-fg)]'
                            : 'liquid-glass-button text-[var(--fm-text-muted)]'
                        }`}
                      >
                        Off
                      </button>
                      {[10, 15, 30, 45, 60].map((min) => (
                        <button
                          key={min}
                          onClick={() => handleSetSleepTimer(min)}
                          className="min-h-9 px-3 rounded-xl liquid-glass-button text-xs font-bold cursor-pointer hover:border-[var(--fm-accent)]"
                        >
                          {min}m
                        </button>
                      ))}
                      <button
                        onClick={() => handleSetSleepAtTrackEnd(!playerState.sleepAtTrackEnd)}
                        className={`min-h-9 px-3 rounded-xl text-xs font-bold cursor-pointer ${
                          playerState.sleepAtTrackEnd
                            ? 'bg-[var(--fm-accent)] text-[var(--fm-accent-fg)]'
                            : 'liquid-glass-button text-[var(--fm-text-muted)]'
                        }`}
                      >
                        End of Song
                      </button>
                    </div>
                  </>
                )}

                {showQuickDrawer === 'customize' && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-[var(--fm-accent)]">
                        Player Customization
                      </span>
                      <button
                        onClick={() => {
                          setShowQuickDrawer('none');
                          setShowSettingsModal(true);
                        }}
                        className="text-xs font-semibold text-[var(--fm-accent)] hover:underline cursor-pointer"
                      >
                        All Settings
                      </button>
                    </div>

                    {/* Crossfade Quick Slider */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold">Crossfade</span>
                        <span className="font-mono text-[var(--fm-accent)]">
                          {customization.crossfadeSeconds === 0 ? 'Off' : `${customization.crossfadeSeconds}s`}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={12}
                        step={1}
                        value={customization.crossfadeSeconds}
                        onChange={(e) =>
                          handleUpdateCustomization({ crossfadeSeconds: Number(e.target.value) })
                        }
                        className="w-full fm-range"
                      />
                    </div>

                    {/* Speed + Artwork Style */}
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <span className="text-xs font-semibold">Speed</span>
                      <div className="flex items-center gap-1">
                        {[0.75, 1, 1.25, 1.5].map((rate) => (
                          <button
                            key={rate}
                            onClick={() => handleUpdateCustomization({ playbackRate: rate })}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                              customization.playbackRate === rate
                                ? 'bg-[var(--fm-accent)] text-[var(--fm-accent-fg)]'
                                : 'liquid-glass-button text-[var(--fm-text-muted)]'
                            }`}
                          >
                            {rate}×
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <span className="text-xs font-semibold">Artwork</span>
                      <div className="flex items-center gap-1">
                        {(['card', 'vinyl', 'glow'] as const).map((style) => (
                          <button
                            key={style}
                            onClick={() => handleUpdateCustomization({ artworkStyle: style })}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold capitalize cursor-pointer ${
                              customization.artworkStyle === style
                                ? 'bg-[var(--fm-accent)] text-[var(--fm-accent-fg)]'
                                : 'liquid-glass-button text-[var(--fm-text-muted)]'
                            }`}
                          >
                            {style}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <span className="text-xs font-semibold">Dynamic Color</span>
                      <button
                        onClick={() =>
                          handleUpdateCustomization({
                            dynamicColorEnabled: !customization.dynamicColorEnabled,
                          })
                        }
                        className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer flex items-center gap-1.5 ${
                          customization.dynamicColorEnabled
                            ? 'bg-[var(--fm-accent)] text-[var(--fm-accent-fg)]'
                            : 'liquid-glass-button text-[var(--fm-text-muted)]'
                        }`}
                      >
                        {customization.dynamicColorEnabled ? 'On' : 'Off'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Modal Tab Switcher (Track / Lyrics / Queue) */}
          <div className="max-w-md w-full mx-auto px-5 sm:px-6 mt-3 flex justify-center gap-2">
            <button
              onClick={() => setActiveModalTab('player')}
              className={`min-h-9 px-4 py-1.5 rounded-full text-xs font-bold transition-colors cursor-pointer ${
                activeModalTab === 'player'
                  ? 'bg-[var(--fm-accent)] text-[var(--fm-accent-fg)]'
                  : 'liquid-glass-button text-[var(--fm-text-muted)]'
              }`}
            >
              Track
            </button>
            <button
              onClick={() => setActiveModalTab('lyrics')}
              className={`min-h-9 px-4 py-1.5 rounded-full text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeModalTab === 'lyrics'
                  ? 'bg-[var(--fm-accent)] text-[var(--fm-accent-fg)]'
                  : 'liquid-glass-button text-[var(--fm-text-muted)]'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Lyrics</span>
            </button>
            <button
              onClick={() => setActiveModalTab('queue')}
              className={`min-h-9 px-4 py-1.5 rounded-full text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeModalTab === 'queue'
                  ? 'bg-[var(--fm-accent)] text-[var(--fm-accent-fg)]'
                  : 'liquid-glass-button text-[var(--fm-text-muted)]'
              }`}
            >
              <ListMusic className="w-3.5 h-3.5" />
              <span>Queue ({playerState.queue.length})</span>
            </button>
          </div>

          {/* Content Body */}
          <div className="max-w-md w-full mx-auto px-5 sm:px-6 flex-1 flex flex-col justify-center my-2 sm:my-3 overflow-y-auto">
            {activeModalTab === 'player' && (
              <div className="flex flex-col items-center text-center">
                {/* Cover Art (Customizable: Card / Spinning Vinyl / Ambient Glow) */}
                <div className="relative my-2 sm:my-3">
                  {customization.artworkStyle === 'glow' && (
                    <div
                      style={{ background: 'var(--fm-accent)' }}
                      className="absolute -inset-4 rounded-full blur-3xl opacity-25 pointer-events-none"
                    />
                  )}
                  <div
                    className={`relative w-48 h-48 xs:w-56 xs:h-56 sm:w-64 sm:h-64 overflow-hidden shadow-2xl border border-[var(--fm-glass-border)] ${
                      customization.artworkStyle === 'vinyl' ? 'rounded-full' : 'rounded-3xl'
                    }`}
                  >
                    <TrackArtwork
                      src={playerState.currentTrack?.thumbnail}
                      alt={playerState.currentTrack?.title || 'Album Cover'}
                      iconClassName="w-16 h-16"
                      className={`w-full h-full transition-transform duration-700 ${
                        customization.artworkStyle === 'vinyl' && playerState.isPlaying
                          ? 'fm-vinyl-spin'
                          : playerState.isPlaying
                          ? 'scale-105'
                          : 'scale-100'
                      }`}
                    />
                    {customization.artworkStyle === 'vinyl' && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-10 h-10 rounded-full bg-[var(--fm-bg)] border-4 border-white/25 shadow-inner" />
                      </div>
                    )}
                    {customization.showVisualizer && customization.artworkStyle !== 'vinyl' && (
                      <div className="absolute bottom-3 right-3">
                        <AudioVisualizer isPlaying={playerState.isPlaying} />
                      </div>
                    )}
                  </div>
                </div>

                {/* Track Details + Quick Like & Playlist Actions */}
                <div className="w-full flex items-center justify-between gap-3 mt-3 px-1">
                  <div className="min-w-0 text-left flex-1">
                    <h2 className="text-xl sm:text-2xl font-bold truncate">
                      {playerState.currentTrack?.title || 'No Track Selected'}
                    </h2>
                    {playerState.currentTrack && (
                      <p className="text-xs font-medium text-[var(--fm-accent)] mt-0.5 truncate tabular-nums">
                        {formatAudioQualityLabel(
                          playerState.streamMimeType,
                          playerState.streamBitrate,
                          playerState.isBuffering ? 'Detecting bitrate · codec…' : 'Adaptive Stream'
                        )}
                      </p>
                    )}
                    <p className="text-sm sm:text-base text-[var(--fm-text-muted)] mt-0.5 truncate">
                      {playerState.currentTrack?.artist || 'FM Music Catalog'}
                    </p>
                  </div>
                  {playerState.currentTrack && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => toggleLike(playerState.currentTrack!)}
                        className={`w-11 h-11 rounded-full flex items-center justify-center cursor-pointer transition-colors ${
                          likedIds.has(playerState.currentTrack.id)
                            ? 'bg-[var(--fm-accent)]/20 text-[var(--fm-accent)]'
                            : 'liquid-glass-button text-[var(--fm-text-muted)]'
                        }`}
                        title="Like track"
                        aria-label="Like track"
                      >
                        <Heart
                          className={`w-5 h-5 ${
                            likedIds.has(playerState.currentTrack.id) ? 'fill-current' : ''
                          }`}
                        />
                      </button>
                      <button
                        onClick={() => setPlaylistPickerTrack(playerState.currentTrack!)}
                        className="w-11 h-11 rounded-full liquid-glass-button flex items-center justify-center text-[var(--fm-text-muted)] hover:text-[var(--fm-text)] cursor-pointer"
                        title="Add to playlist"
                        aria-label="Add to playlist"
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Clean Unboxed Stream Metadata Line */}
                <p className="mt-2.5 text-xs text-[var(--fm-text-muted)] font-medium tabular-nums">
                  Full-Length ({formatTime(playerState.duration)})
                  {customization.crossfadeSeconds > 0 ? ` • Crossfade ${customization.crossfadeSeconds}s` : ''}
                  {playerState.playbackRate !== 1 ? ` • ${playerState.playbackRate}×` : ''}
                  {customization.equalizer?.enabled && customization.equalizer.activeProfileId !== 'flat'
                    ? ` • EQ: ${
                        [...BUILTIN_EQ_PROFILES, ...(customization.equalizer.customProfiles || [])].find(
                          (p) => p.id === customization.equalizer.activeProfileId
                        )?.name || 'Custom'
                      }`
                    : ''}
                  {playerState.shuffleMode === 'smart'
                    ? ' • Smart Shuffle'
                    : playerState.shuffleMode === 'standard'
                    ? ' • Shuffle'
                    : ''}
                </p>
              </div>
            )}

            {activeModalTab === 'lyrics' && (
              <div className="liquid-glass rounded-3xl p-5 h-80 flex flex-col">
                <div className="flex items-center justify-between pb-2.5 border-b border-[var(--fm-glass-border)] gap-2">
                  <div className="text-left min-w-0">
                    <h3 className="text-xs uppercase tracking-widest text-[var(--fm-accent)] font-bold">
                      Lyrics
                    </h3>
                    <p className="text-[11px] text-[var(--fm-text-muted)] truncate">
                      Provider: {lyricsData?.provider || customization.lyricsProvider.toUpperCase()}
                    </p>
                  </div>
                  {playerState.currentTrack && (
                    <button
                      onClick={() => loadLyricsForTrack(playerState.currentTrack!)}
                      disabled={isLoadingLyrics}
                      className="min-h-8 px-2.5 rounded-lg liquid-glass-button text-xs font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      title="Refresh lyrics from provider"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLyrics ? 'animate-spin' : ''}`} />
                      <span>Refresh</span>
                    </button>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto pt-3 space-y-2.5 text-center pr-1">
                  {!playerState.currentTrack ? (
                    <p className="text-xs text-[var(--fm-text-muted)] pt-14">
                      Select a track to view lyrics.
                    </p>
                  ) : isLoadingLyrics ? (
                    <div className="pt-14 flex flex-col items-center gap-2 text-xs text-[var(--fm-text-muted)]">
                      <Loader2 className="w-5 h-5 animate-spin text-[var(--fm-accent)]" />
                      <span>Fetching lyrics...</span>
                    </div>
                  ) : lyricsData?.syncedLines && lyricsData.syncedLines.length > 0 ? (
                    lyricsData.syncedLines.map((line, idx) => {
                      const isActive = idx === activeSyncedIndex;
                      return (
                        <button
                          key={`${line.time}-${idx}`}
                          ref={isActive ? activeLyricRef : null}
                          onClick={() => inAppPlayer.seekTo(line.time)}
                          className={`w-full px-2 py-1 rounded-xl text-center transition-all cursor-pointer block ${
                            isActive
                              ? 'text-[var(--fm-accent)] font-bold text-base scale-[1.02]'
                              : 'text-[var(--fm-text-muted)] hover:text-[var(--fm-text)] text-sm font-medium'
                          }`}
                        >
                          {line.text}
                        </button>
                      );
                    })
                  ) : lyricsData?.plainLines && lyricsData.plainLines.length > 0 ? (
                    lyricsData.plainLines.map((line, idx) => (
                      <p key={idx} className="text-sm font-medium leading-relaxed">
                        {line}
                      </p>
                    ))
                  ) : (
                    <p className="text-xs text-[var(--fm-text-muted)] pt-12">
                      No lyrics found for &ldquo;{playerState.currentTrack.title}&rdquo;.
                    </p>
                  )}
                </div>
              </div>
            )}

            {activeModalTab === 'queue' && (
              <div className="liquid-glass rounded-3xl p-4 h-80 overflow-y-auto space-y-1.5">
                <h3 className="text-xs uppercase tracking-widest text-[var(--fm-accent)] font-bold pb-2 border-b border-[var(--fm-glass-border)]">
                  Up Next Queue
                </h3>
                {playerState.queue.map((qTrack, idx) => (
                  <div
                    key={qTrack.id + idx}
                    onClick={() => handlePlayTrack(qTrack)}
                    className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition-colors ${
                      playerState.currentTrack?.id === qTrack.id
                        ? 'bg-[var(--fm-accent)]/15 text-[var(--fm-accent)]'
                        : 'hover:bg-[var(--fm-glass)]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <span className="text-xs text-[var(--fm-text-muted)] w-4 tabular-nums">{idx + 1}</span>
                      <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0">
                        <TrackArtwork src={qTrack.thumbnail} alt={qTrack.title} className="w-full h-full" />
                      </div>
                      <div className="truncate">
                        <p className="text-xs font-semibold truncate">{qTrack.title}</p>
                        <p className="text-[11px] text-[var(--fm-text-muted)] truncate">{qTrack.artist}</p>
                      </div>
                    </div>
                    <span className="text-xs text-[var(--fm-text-muted)] shrink-0 tabular-nums">
                      {qTrack.durationFormatted}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Player Modal Controls Footer (Timeline + Controls + Volume Slider) */}
          <div className="max-w-md w-full mx-auto px-6 pb-6 space-y-3.5">
            {/* Timeline slider */}
            <div className="space-y-1.5">
              <div className="relative w-full h-1.5 bg-[var(--fm-glass-border)] rounded-full cursor-pointer">
                <div
                  className="h-full bg-[var(--fm-accent)] rounded-full"
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
                  aria-label="Seek track position"
                />
              </div>
              <div className="flex items-center justify-between text-xs text-[var(--fm-text-muted)] tabular-nums">
                <span>{formatTime(playerState.currentTime)}</span>
                <span>{formatTime(playerState.duration)}</span>
              </div>
            </div>

            {/* Playback Controls Row */}
            <div className="flex items-center justify-between pt-1">
              <button
                onClick={() => {
                  inAppPlayer.cycleShuffleMode();
                  const nextMode = inAppPlayer.getState().shuffleMode;
                  showToast(
                    nextMode === 'smart'
                      ? 'Smart Shuffle on (favors liked, avoids skipped)'
                      : nextMode === 'standard'
                      ? 'Standard Shuffle on'
                      : 'Shuffle off'
                  );
                }}
                className={`relative w-11 h-11 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                  playerState.shuffleMode !== 'off'
                    ? 'text-[var(--fm-accent)] bg-[var(--fm-accent)]/15'
                    : 'text-[var(--fm-text-muted)] hover:text-[var(--fm-text)]'
                }`}
                title={
                  playerState.shuffleMode === 'smart'
                    ? 'Shuffle: Smart (tap to switch to Standard)'
                    : playerState.shuffleMode === 'standard'
                    ? 'Shuffle: Standard (tap to turn Off)'
                    : 'Shuffle: Off (tap to enable Smart Shuffle)'
                }
                aria-label="Cycle Shuffle Mode"
              >
                <Shuffle className="w-5 h-5" />
                {playerState.shuffleMode === 'smart' && (
                  <span className="absolute -bottom-0.5 text-[8px] font-black uppercase tracking-tighter text-[var(--fm-accent)] leading-none">
                    Smart
                  </span>
                )}
              </button>

              <button
                onClick={() => inAppPlayer.prev()}
                className="w-12 h-12 rounded-full flex items-center justify-center hover:text-[var(--fm-accent)] transition-colors cursor-pointer"
                aria-label="Previous track"
              >
                <SkipBack className="w-6 h-6 fill-current" />
              </button>

              <button
                onClick={() => inAppPlayer.togglePlayPause()}
                className="w-16 h-16 rounded-full bg-[var(--fm-accent)] hover:opacity-95 text-[var(--fm-accent-fg)] flex items-center justify-center shadow-xl transition-all scale-100 hover:scale-105 active:scale-95 cursor-pointer"
                aria-label={playerState.isPlaying ? 'Pause' : 'Play'}
              >
                {playerState.isPlaying ? (
                  <Pause className="w-7 h-7 fill-current" />
                ) : (
                  <Play className="w-7 h-7 fill-current ml-1" />
                )}
              </button>

              <button
                onClick={() => inAppPlayer.next()}
                className="w-12 h-12 rounded-full flex items-center justify-center hover:text-[var(--fm-accent)] transition-colors cursor-pointer"
                aria-label="Next track"
              >
                <SkipForward className="w-6 h-6 fill-current" />
              </button>

              <button
                onClick={() => {
                  inAppPlayer.cycleRepeatMode();
                  const nextRepeat = inAppPlayer.getState().repeatMode;
                  showToast(
                    nextRepeat === 'one'
                      ? 'Repeat: Current song'
                      : nextRepeat === 'all'
                      ? 'Repeat: All songs'
                      : 'Repeat: Off'
                  );
                }}
                className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                  playerState.repeatMode !== 'off'
                    ? 'text-[var(--fm-accent)] bg-[var(--fm-accent)]/15'
                    : 'text-[var(--fm-text-muted)] hover:text-[var(--fm-text)]'
                }`}
                title={`Repeat mode: ${playerState.repeatMode}`}
                aria-label="Cycle Repeat Mode"
              >
                {playerState.repeatMode === 'one' ? (
                  <Repeat1 className="w-5 h-5" />
                ) : (
                  <Repeat className="w-5 h-5" />
                )}
              </button>
            </div>

            {/* Interactive Volume Bar */}
            <div className="liquid-glass rounded-2xl px-3.5 py-2 flex items-center gap-3">
              <button
                onClick={() => inAppPlayer.toggleMute()}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--fm-text-muted)] hover:text-[var(--fm-text)] cursor-pointer shrink-0"
                title={playerState.isMuted ? 'Unmute' : 'Mute'}
                aria-label={playerState.isMuted ? 'Unmute' : 'Mute'}
              >
                <VolumeIcon className={`w-4 h-4 ${playerState.isMuted ? 'text-red-400' : ''}`} />
              </button>
              <input
                type="range"
                min={0}
                max={100}
                value={playerState.isMuted ? 0 : playerState.volume}
                onChange={(e) => inAppPlayer.setVolume(Number(e.target.value))}
                className="flex-1 fm-range"
                aria-label="Player Volume"
              />
              <span className="text-xs font-mono text-[var(--fm-text-muted)] w-9 text-right tabular-nums">
                {playerState.isMuted ? '0%' : `${playerState.volume}%`}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Settings, Themes, Customization, Equalizer & Backup Modal */}
      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        currentTheme={themeId}
        onSelectTheme={handleSelectTheme}
        customization={customization}
        onUpdateCustomization={handleUpdateCustomization}
        sleepTimerRemainingSec={playerState.sleepTimerRemainingSec}
        sleepAtTrackEnd={playerState.sleepAtTrackEnd}
        onSetSleepTimer={handleSetSleepTimer}
        onSetSleepAtTrackEnd={handleSetSleepAtTrackEnd}
        skippedTrackCount={playerState.skippedTrackCount}
        onResetSkipHistory={() => {
          inAppPlayer.resetSkipHistory();
          showToast('Smart Shuffle skip history cleared');
        }}
        dynamicAccentHex={dynamicPalette?.accentHex || null}
        likedTracks={likedTracks}
        playlists={playlists}
        downloadedTracks={downloadedTracks}
        onRestoreBackup={handleRestoreBackup}
        onOpenDiagnostics={() => setShowDiagnostics(true)}
        onNotify={showToast}
        githubRepo={githubRepo}
        onSaveGithubRepo={handleSaveGithubRepo}
        updateCheckResult={updateCheckResult}
        updateCheckError={updateCheckError}
        isCheckingUpdate={isCheckingUpdate}
        onCheckForUpdates={handleCheckForUpdates}
        onOpenUpdatePrompt={() => {
          setShowSettingsModal(false);
          setShowUpdatePromptModal(true);
        }}
      />

      {/* Add to Playlist Modal */}
      <PlaylistPickerModal
        track={playlistPickerTrack}
        playlists={playlists}
        onClose={() => setPlaylistPickerTrack(null)}
        onToggleTrackInPlaylist={handleToggleTrackInPlaylist}
        onCreatePlaylistWithTrack={(name, track) => handleCreatePlaylist(name, track)}
      />

      {/* Diagnostics / Info Modal */}
      {showDiagnostics && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4"
          onClick={() => setShowDiagnostics(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="liquid-glass-strong w-full max-w-lg rounded-3xl p-6 shadow-2xl animate-scale-in max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[var(--fm-glass-border)]">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[var(--fm-accent)]" />
                <h3 className="font-bold text-lg">In-App Streaming Architecture</h3>
              </div>
              <button
                onClick={() => setShowDiagnostics(false)}
                className="w-10 h-10 rounded-full liquid-glass-button flex items-center justify-center text-[var(--fm-text-muted)] hover:text-[var(--fm-text)] transition-colors cursor-pointer"
                aria-label="Close diagnostics"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="mt-3 text-xs text-[var(--fm-text-muted)] leading-relaxed">
              Full-length playback pipeline with InnerTube search, cipher deobfuscation, and synced lyrics resolution.
            </p>

            {/* InnerTube Visitor Session Section */}
            <div className="mt-4 p-4 rounded-2xl liquid-glass space-y-2">
              <div className="flex items-center justify-between pb-1.5 border-b border-[var(--fm-glass-border)]">
                <span className="text-xs font-bold uppercase tracking-wider">InnerTube Visitor Session</span>
                <button
                  onClick={handleRestartVisitorSession}
                  className="text-xs text-[var(--fm-accent)] hover:underline font-semibold cursor-pointer"
                >
                  Renew Session
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[var(--fm-text-muted)]">Client Context:</span>
                  <p className="font-mono mt-0.5">{visitorSession.clientName}</p>
                </div>
                <div>
                  <span className="text-[var(--fm-text-muted)]">Browsing Mode:</span>
                  <p className="text-[var(--fm-accent)] font-semibold mt-0.5">Public Unauthenticated</p>
                </div>
                <div className="col-span-2">
                  <span className="text-[var(--fm-text-muted)]">Visitor Token (X-Goog-Visitor-Id):</span>
                  <p className="font-mono bg-[var(--fm-input-bg)] px-2.5 py-1.5 rounded-lg text-[11px] truncate mt-1 border border-[var(--fm-glass-border)]">
                    {visitorSession.visitorData || 'Generating...'}
                  </p>
                </div>
              </div>
            </div>

            {/* InnerTube Player Endpoint & Signed Stream Architecture */}
            <div className="mt-3 p-4 rounded-2xl liquid-glass space-y-2.5">
              <div className="flex items-center justify-between pb-1.5 border-b border-[var(--fm-glass-border)]">
                <div className="flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5 text-[var(--fm-accent)]" />
                  <span className="text-xs font-bold uppercase tracking-wider">
                    Full-Length Stream Resolver
                  </span>
                </div>
                <span className="text-xs text-[var(--fm-accent)] font-semibold">Full-Length Default</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[var(--fm-text-muted)]">Stream Source:</span>
                  <p className="font-mono mt-0.5 text-[11px]">{playerState.streamSource || 'Ready on play'}</p>
                </div>
                <div>
                  <span className="text-[var(--fm-text-muted)]">Audio Bitrate & Codec:</span>
                  <p className="font-mono mt-0.5 text-[11px] tabular-nums">
                    {formatAudioQualityLabel(playerState.streamMimeType, playerState.streamBitrate)}
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-[var(--fm-glass-border)]">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[var(--fm-text-muted)]">Test Endpoint Extraction:</span>
                  <button
                    disabled={testingStream}
                    onClick={() => handleExtractStream(playerState.currentTrack?.youtubeId || 'NJAv_7lHUIU')}
                    className="px-3 py-1.5 liquid-glass-button text-[var(--fm-accent)] text-xs font-semibold rounded-lg cursor-pointer disabled:opacity-50"
                  >
                    {testingStream ? 'Resolving...' : 'Extract Signed Stream'}
                  </button>
                </div>

                {extractedStreamResult && (
                  <div className="mt-2 p-2.5 rounded-xl bg-[var(--fm-input-bg)] border border-[var(--fm-glass-border)] text-[11px] space-y-1 font-mono">
                    <div className="flex justify-between items-center">
                      <span>Source: {extractedStreamResult.source}</span>
                      <span className="text-[var(--fm-accent)] font-bold">
                        {Math.round(extractedStreamResult.bitrate / 1000)} kbps
                      </span>
                    </div>
                    <div className="flex justify-between text-[var(--fm-text-muted)]">
                      <span>Codec: {extractedStreamResult.mimeType.split(';')[0]}</span>
                      {extractedStreamResult.approxDurationMs && (
                        <span>Duration: {formatTime(Math.round(extractedStreamResult.approxDurationMs / 1000))}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Preload Player Code & Cipher Deobfuscator Section */}
            <div className="mt-3 p-4 rounded-2xl liquid-glass space-y-2.5">
              <div className="flex items-center justify-between pb-1.5 border-b border-[var(--fm-glass-border)]">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-3.5 h-3.5 text-[var(--fm-accent)]" />
                  <span className="text-xs font-bold uppercase tracking-wider">
                    Cipher Deobfuscator & Preload
                  </span>
                </div>
                <button
                  disabled={isPreloadingPlayerCode}
                  onClick={handlePreloadPlayerCode}
                  className="text-xs text-[var(--fm-accent)] hover:underline font-semibold cursor-pointer disabled:opacity-50 flex items-center gap-1"
                >
                  {isPreloadingPlayerCode ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                  <span>{isPreloadingPlayerCode ? 'Preloading...' : 'Preload Player Code'}</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[var(--fm-text-muted)]">Preload Status:</span>
                  <p className="text-[var(--fm-accent)] font-semibold mt-0.5">
                    {playerCodeStatus.isPreloaded ? 'Preloaded & Compiled' : 'Pending'}
                  </p>
                </div>
                <div>
                  <span className="text-[var(--fm-text-muted)]">Transforms Loaded:</span>
                  <p className="font-mono mt-0.5 text-[11px]">{playerCodeStatus.operationsCount} Ops</p>
                </div>
              </div>

              <div className="pt-2 border-t border-[var(--fm-glass-border)] flex items-center justify-between">
                <span className="text-xs text-[var(--fm-text-muted)]">Verify Cipher Signature:</span>
                <button
                  onClick={handlePreloadPlayerCode}
                  disabled={isPreloadingPlayerCode}
                  className="px-3 py-1.5 liquid-glass-button text-[var(--fm-accent)] text-xs font-semibold rounded-lg cursor-pointer disabled:opacity-50"
                >
                  {cipherTestResult ? cipherTestResult : 'Run Deobfuscate Test'}
                </button>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setShowDiagnostics(false)}
                className="min-h-10 px-5 py-2 bg-[var(--fm-accent)] text-[var(--fm-accent-fg)] font-bold rounded-xl text-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Android APK Update Available Prompt */}
      {showUpdatePromptModal && updateCheckResult && (
        <div
          className="fixed inset-0 bg-black/65 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => {
            if (!updateCheckResult.mandatory) setShowUpdatePromptModal(false);
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="liquid-glass-strong w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl animate-scale-in space-y-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-2xl bg-[var(--fm-accent)] text-[var(--fm-accent-fg)] flex items-center justify-center shrink-0">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold tracking-tight">
                    {updateCheckResult.mandatory ? 'Required Update Available' : 'New Update Available'}
                  </h3>
                  <p className="text-xs text-[var(--fm-text-muted)] mt-0.5 font-mono">
                    v{updateCheckResult.currentVersion} → v{updateCheckResult.latestVersion}
                    {updateCheckResult.sizeBytes > 0
                      ? ` • ${formatApkSize(updateCheckResult.sizeBytes)}`
                      : ''}
                  </p>
                </div>
              </div>
              {!updateCheckResult.mandatory && (
                <button
                  onClick={() => setShowUpdatePromptModal(false)}
                  className="w-10 h-10 rounded-full liquid-glass-button flex items-center justify-center text-[var(--fm-text-muted)] hover:text-[var(--fm-text)] cursor-pointer shrink-0"
                  aria-label="Close update prompt"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="p-3.5 rounded-2xl bg-[var(--fm-input-bg)] border border-[var(--fm-glass-border)] max-h-48 overflow-y-auto">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--fm-accent)] mb-1.5">
                {updateCheckResult.releaseTitle || `Release v${updateCheckResult.latestVersion}`}
              </p>
              <p className="text-xs text-[var(--fm-text-muted)] whitespace-pre-line leading-relaxed">
                {updateCheckResult.releaseNotes ||
                  'A newer FM Music Android APK release is ready with the latest playback improvements and bug fixes.'}
              </p>
            </div>

            <div className="space-y-2.5">
              {updateCheckResult.apkDownloadUrl ? (
                <a
                  href={updateCheckResult.apkDownloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => showToast(`Downloading FM Music v${updateCheckResult.latestVersion} APK...`)}
                  className="min-h-12 w-full px-4 rounded-2xl bg-[var(--fm-accent)] text-[var(--fm-accent-fg)] font-bold text-sm flex items-center justify-center gap-2 shadow-md hover:opacity-95 transition-opacity"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Updated APK</span>
                </a>
              ) : (
                <a
                  href={updateCheckResult.releasePageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-12 w-full px-4 rounded-2xl bg-[var(--fm-accent)] text-[var(--fm-accent-fg)] font-bold text-sm flex items-center justify-center gap-2 shadow-md"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Open Release</span>
                </a>
              )}

              {!updateCheckResult.mandatory && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <a
                      href={updateCheckResult.packagesUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-11 px-3 rounded-xl liquid-glass-button text-xs font-semibold flex items-center justify-center gap-1.5"
                    >
                      <Package className="w-3.5 h-3.5 text-[var(--fm-accent)]" />
                      <span>GitHub Packages</span>
                    </a>

                    <button
                      onClick={() => {
                        if (updateCheckResult.tagName) {
                          saveSkippedReleaseTag(updateCheckResult.tagName);
                        }
                        setShowUpdatePromptModal(false);
                        showToast(`Skipped v${updateCheckResult.latestVersion}`);
                      }}
                      className="min-h-11 px-3 rounded-xl liquid-glass-button text-xs font-semibold text-[var(--fm-text-muted)] hover:text-[var(--fm-text)] cursor-pointer"
                    >
                      Skip Version
                    </button>
                  </div>

                  <button
                    onClick={() => setShowUpdatePromptModal(false)}
                    className="min-h-10 w-full text-xs font-semibold text-[var(--fm-text-muted)] hover:text-[var(--fm-text)] cursor-pointer"
                  >
                    Remind Me Later
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
