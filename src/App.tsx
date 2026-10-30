import React, { useState, useEffect, useRef } from 'react';
import { PlaybackController } from './services/playbackController';
import { PlaybackUiState } from './types/playback';
import { youtubeMusicSearchUrl, MusicNetworkClient } from './services/musicNetworkClient';
import { SampleLicensedPlaybackSource, runArchitectureDiagnostics, VerificationResult } from './services/mockLicensedProvider';
import { ExternalLink, Play, Pause, CheckCircle2, ShieldCheck, Info, X } from 'lucide-react';

const SEARCH_SUGGESTIONS = [
  'New releases',
  'Hindi hits',
  'Chill',
  'Indie',
  'Focus',
  'Workout',
];

export default function App() {
  const [query, setQuery] = useState('');
  const [playerState, setPlayerState] = useState<PlaybackUiState>({
    title: null,
    artist: null,
    isPlaying: false,
    isBuffering: false,
    errorMessage: null,
    hasMedia: false,
  });

  const [publicSessionReady, setPublicSessionReady] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [diagnosticResults, setDiagnosticResults] = useState<VerificationResult[]>([]);
  const [notification, setNotification] = useState<string | null>(null);

  // Initialize playback controller & network client matching MusicApplication.kt
  const playbackControllerRef = useRef<PlaybackController | null>(null);
  const networkClientRef = useRef<MusicNetworkClient | null>(null);
  const sampleProviderRef = useRef<SampleLicensedPlaybackSource>(new SampleLicensedPlaybackSource());

  useEffect(() => {
    const controller = new PlaybackController();
    playbackControllerRef.current = controller;

    const unsubscribe = controller.subscribe((state) => {
      setPlayerState(state);
    });

    const networkClient = new MusicNetworkClient();
    networkClientRef.current = networkClient;

    // Simulate startup public visitor session init
    networkClient.initializePublicSession().then((ready) => {
      setPublicSessionReady(ready);
    });

    return () => {
      unsubscribe();
      controller.release();
      networkClient.close();
    };
  }, []);

  const handleSearch = (searchQuery: string) => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;

    const url = youtubeMusicSearchUrl(trimmed);
    setNotification(`Navigating to YouTube Music for "${trimmed}"`);

    // In web browsers, open official YouTube Music search
    window.open(url, '_blank', 'noopener,noreferrer');

    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && query.trim()) {
      handleSearch(query);
    }
  };

  const togglePlayback = () => {
    playbackControllerRef.current?.togglePlayback();
  };

  // Demo action to test licensed provider integration
  const handleTestLicensedTrack = async () => {
    if (!playbackControllerRef.current) return;
    try {
      await playbackControllerRef.current.play(
        {
          id: 'sample-1',
          title: 'Acoustic Morning Sunlight',
          artist: 'Authorized Licensed Provider',
        },
        sampleProviderRef.current
      );
      setNotification('Loaded licensed media item into in-app player.');
      setTimeout(() => setNotification(null), 3500);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setNotification(`Provider error: ${message}`);
    }
  };

  const handleRunDiagnostics = () => {
    const results = runArchitectureDiagnostics();
    setDiagnosticResults(results);
    setShowDiagnostics(true);
  };

  return (
    <div className="min-h-screen bg-[#111116] text-white flex flex-col font-sans selection:bg-[#B9F36A] selection:text-[#111116]">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#1B1B23] border border-[#B9F36A]/40 text-white px-5 py-2.5 rounded-full text-xs sm:text-sm font-medium shadow-2xl flex items-center gap-2 animate-fade-in">
          <span className="w-2 h-2 rounded-full bg-[#B9F36A] animate-pulse" />
          <span>{notification}</span>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-2xl mx-auto px-6 pt-7 pb-36 sm:pb-32">
        {/* App Bar / Header */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-[42px] h-[42px] rounded-full bg-[#B9F36A] flex items-center justify-center shadow-sm shrink-0">
              <span className="text-[#111116] font-black text-sm tracking-tighter">FM</span>
            </div>
            <span className="text-white font-bold tracking-[2px] text-base">FM MUSIC</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRunDiagnostics}
              className="px-3 py-1.5 rounded-full text-xs font-semibold bg-[#1B1B23] hover:bg-[#252530] text-[#B7B7C4] hover:text-white border border-[#393943] transition-colors flex items-center gap-1.5 cursor-pointer"
              title="View Architecture & Validation Diagnostics"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-[#B9F36A]" />
              <span>Specs & Tests</span>
            </button>
          </div>
        </header>

        {/* Hero Section */}
        <section className="mt-[38px]">
          <h1 className="text-[38px] leading-[43px] font-bold tracking-tight text-white">
            Your next<br />favorite track.
          </h1>
          <p className="mt-[10px] text-[#B7B7C4] text-base">
            Search music on YouTube Music and start listening.
          </p>
        </section>

        {/* Search Bar Row */}
        <section className="mt-[28px]">
          <div className="flex items-center gap-2.5">
            <div className="relative flex-1">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Songs, artists, albums"
                className="w-full h-14 bg-transparent border border-[#393943] focus:border-[#B9F36A] focus:outline-none rounded-[16px] px-4 text-white placeholder-[#686875] text-base transition-colors"
              />
            </div>
            <button
              onClick={() => handleSearch(query)}
              disabled={!query.trim()}
              className="h-14 px-6 rounded-[14px] bg-[#B9F36A] hover:bg-[#a6e651] disabled:opacity-40 disabled:hover:bg-[#B9F36A] text-[#111116] font-bold text-base transition-all shrink-0 cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
            >
              <span>Go</span>
            </button>
          </div>
        </section>

        {/* Vibes Suggestions */}
        <section className="mt-[34px]">
          <h2 className="text-[#B7B7C4] text-xs font-bold tracking-[1.5px] uppercase">
            Pick a vibe
          </h2>

          <div className="mt-[14px] grid grid-cols-2 gap-3">
            {SEARCH_SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => handleSearch(suggestion)}
                className="bg-[#1B1B23] hover:bg-[#23232e] border border-transparent hover:border-[#393943] text-left p-[18px] rounded-[18px] transition-all group cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="text-white text-base font-semibold group-hover:text-[#B9F36A] transition-colors">
                    {suggestion}
                  </span>
                  <ExternalLink className="w-3.5 h-3.5 text-[#686875] group-hover:text-[#B9F36A] transition-colors opacity-0 group-hover:opacity-100" />
                </div>
                <p className="mt-[5px] text-[#B7B7C4] text-xs">
                  Explore on YouTube Music
                </p>
              </button>
            ))}
          </div>
        </section>

        {/* Legal / Architecture Disclaimer */}
        <footer className="mt-8">
          <p className="text-[#B7B7C4] text-xs leading-[18px]">
            Search opens the official YouTube Music app when available, or your browser. Playback,
            ads, account features, and availability are handled by YouTube.
          </p>

          <div className="mt-4 pt-4 border-t border-[#1F1F28] flex flex-wrap items-center justify-between gap-3 text-xs text-[#7E7E8E]">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${publicSessionReady ? 'bg-[#B9F36A]' : 'bg-amber-400'}`} />
              <span>Public catalog session: {publicSessionReady ? 'Active' : 'Initializing...'}</span>
            </div>
            <button
              onClick={handleTestLicensedTrack}
              className="text-[#B9F36A] hover:underline cursor-pointer"
            >
              Test licensed playback provider
            </button>
          </div>
        </footer>
      </main>

      {/* Bottom Player Bar (Media3PlayerBar) */}
      <aside className="fixed bottom-0 left-0 right-0 bg-[#1B1B23] border-t border-[#292934] shadow-[0_-8px_30px_rgba(0,0,0,0.5)] z-40">
        <div className="max-w-2xl mx-auto px-5 py-3 flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0 pr-2">
            <h3 className="text-white font-semibold text-sm sm:text-base truncate">
              {playerState.title || 'In-app player'}
            </h3>
            <p className="text-[#B7B7C4] text-xs truncate mt-0.5">
              {playerState.errorMessage
                ? playerState.errorMessage
                : playerState.hasMedia
                ? playerState.artist || 'Authorized Audio Stream'
                : 'A licensed music provider is needed for in-app playback.'}
            </p>
          </div>

          <div className="shrink-0 flex items-center gap-2">
            {playerState.hasMedia && (
              <button
                onClick={() => playbackControllerRef.current?.stop()}
                className="text-xs px-2.5 py-2 rounded-lg text-[#B7B7C4] hover:text-white hover:bg-[#2B2B38] transition-colors"
              >
                Reset
              </button>
            )}

            <button
              onClick={togglePlayback}
              disabled={!playerState.hasMedia || playerState.isBuffering}
              className="px-5 py-2 rounded-xl bg-[#B9F36A] hover:bg-[#a6e651] disabled:opacity-40 disabled:hover:bg-[#B9F36A] text-[#111116] font-bold text-xs sm:text-sm flex items-center gap-1.5 transition-all cursor-pointer disabled:cursor-not-allowed"
            >
              {playerState.isPlaying ? (
                <>
                  <Pause className="w-3.5 h-3.5 fill-current" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Play</span>
                </>
              )}
            </button>
          </div>
        </div>
      </aside>

      {/* Diagnostics & Specs Modal */}
      {showDiagnostics && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-[#1B1B23] border border-[#393943] w-full max-w-lg rounded-2xl p-6 shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-[#2B2B36]">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#B9F36A]" />
                <h3 className="font-bold text-white text-lg">Architecture & Tests</h3>
              </div>
              <button
                onClick={() => setShowDiagnostics(false)}
                className="p-1 rounded-lg hover:bg-[#2A2A37] text-[#B7B7C4] hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="mt-3 text-xs text-[#B7B7C4] leading-relaxed">
              Verifying port of Android tests (<code className="text-[#B9F36A]">MusicSearchTest.kt</code> and <code className="text-[#B9F36A]">LicensedPlaybackSourceTest.kt</code>).
            </p>

            <div className="mt-4 space-y-3 max-h-80 overflow-y-auto pr-1">
              {diagnosticResults.map((result, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-[#141419] border border-[#2B2B36] flex items-start gap-3"
                >
                  <CheckCircle2
                    className={`w-4 h-4 shrink-0 mt-0.5 ${
                      result.passed ? 'text-[#B9F36A]' : 'text-red-400'
                    }`}
                  />
                  <div>
                    <h4 className="text-white text-xs font-semibold font-mono">
                      {result.name}
                    </h4>
                    <p className="text-[11px] text-[#A0A0B0] mt-0.5">
                      {result.message}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 p-3 rounded-xl bg-[#23232E] border border-[#393943] text-xs text-[#B7B7C4] flex items-start gap-2.5">
              <Info className="w-4 h-4 text-[#B9F36A] shrink-0 mt-0.5" />
              <p>
                As defined in the project architecture, InnerTubeX handles catalog metadata only; audio extraction is prohibited, and YouTube URLs are routed to YouTube's official app/browser.
              </p>
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
