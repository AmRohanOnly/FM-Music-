# FM Music: Native Android Architecture & Implementation Plan

A comprehensive roadmap to transform FM Music into a production-grade, open-source native Android music client inspired by **MetroList**, **InnerTune**, and **OuterTune**, featuring background audio playback, stream extraction, offline downloads, playlists, and synchronized lyrics.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural decisions were confirmed during the alignment phase:
> - **Native Android Target**: Rebuilding with Kotlin, Jetpack Compose, and AndroidX Media3 (`MediaSessionService`).
> - **Audio Stream Extraction**: Leveraging InnerTube and Piped API endpoints for direct audio-only stream extraction (`audio/webm`, `audio/mp4`).
> - **Core Feature Set**: Background playback service with system media notification/lockscreen controls, offline song downloads, Room-backed playlist database, synchronized lyrics, and a sleep timer.

---

## 1. Overview & Core Concept

### What It Does
FM Music provides an ad-free, high-fidelity music streaming and discovery experience on Android. Users can search the YouTube Music catalog, stream audio in the background with lock screen controls, download tracks for offline listening, curate custom playlists, view live synchronized lyrics, and set sleep timers.

### Target Persona
Android users seeking a privacy-friendly, lightweight, and modern music player that functions seamlessly without external browser redirects or paywalls.

### Key Value
- **Zero-Redirect Playback**: Audio streams directly through a dedicated Android foreground service.
- **Full Offline Autonomy**: High-bitrate audio caching and downloaded track playback when offline.
- **Modern Material 3 / Custom Dark Aesthetic**: Fluid gestures, album-art dynamic theming, and real-time audio visualizer.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Discovery & Search**:
   - The user opens the app to a personalized time-based greeting (*"Good morning, start listening"*), browsing quick vibe mixes (Hindi hits, Chill, Workout, Indie).
   - Typing in the search bar triggers instant live debounced query completions across songs, artists, albums, and community playlists.

2. **Playback & Full Player Sheet**:
   - Tapping any track starts playback immediately in the bottom mini-player with an animated CSS/Compose visualizer.
   - Swiping up expands the **Now Playing** screen, featuring rotating album art, a smooth scrubbing timeline, shuffle/repeat toggles, a sleep timer button, a lyrics sheet, and queue management.

3. **Offline Downloads & Playlists**:
   - A single tap on the download icon saves the raw audio stream to scoped app storage, automatically registered in the Room database for zero-data playback.
   - Users can create and organize custom playlists, reorder songs with drag-and-drop, and favorite tracks.

### Visual Identity & Theme
- **Background Atmosphere**: Pitch-black Ink (`#111116`) and deep surface panels (`#1B1B23`).
- **Signature Accent**: Electric Lime (`#B9F36A`) with smooth neon glow for active controls, scrubber thumbs, and visualizer bars.
- **Typography**: Clean geometric typography with high legibility across metadata tags and timestamps.
- **Interactive Feedback**: Micro-animations for play/pause morphing, bouncy visualizer bars, and smooth bottom sheet drag gestures.

---

## 3. Key Product Decisions & Trade-Offs

### Decision 1: Audio Extraction Strategy (InnerTube vs. Piped API)
- **Chosen Approach**: Dual-layered extractor utilizing local InnerTube client protocols with automatic failover to public Piped / Invidious instances.
- **Why**: Protects against upstream endpoint changes, rate limits, and network throttling while maintaining low latency.
- **Alternatives Considered**: Official YouTube IFrame/WebView (discarded due to lack of background playback and lockscreen controls).

### Decision 2: Playback Engine (`MediaSessionService` + ExoPlayer)
- **Chosen Approach**: AndroidX Media3 `MediaSessionService` paired with `DefaultRenderersFactory` and `CacheDataSource`.
- **Why**: Native integration with Android Auto, Bluetooth headset buttons, lockscreen notification tiles, and seamless background playback lifecycle.
- **Alternatives Considered**: Standard Android `MediaPlayer` (lacks caching, custom audio sources, and modern Media3 session synchronization).

### Decision 3: Local Persistence & Storage
- **Chosen Approach**: Room ORM (SQLite) for track metadata, playlists, and history; Scoped Internal Storage with AES/Simple stream chunking for downloaded media.
- **Why**: Instant reactive queries via Kotlin Coroutines `Flow`, schema migrations, and secure file sandboxing.

---

## 4. Technical Architecture & Data Strategy

### System Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Jetpack Compose UI Layer                        │
│  ┌──────────────────┐  ┌─────────────────────┐  ┌───────────────────┐  │
│  │   Home & Vibes   │  │   Search & Results  │  │   Now Playing     │  │
│  │  (Greeting, Mix) │  │  (Debounced Filter) │  │ (Art, Scrubber)   │  │
│  └────────┬─────────┘  └──────────┬──────────┘  └─────────┬─────────┘  │
│           │                       │                       │            │
│           └───────────────────────┼───────────────────────┘            │
│                                   ▼                                    │
│                       UI ViewModels & StateFlows                       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                    Domain & Playback Orchestration                     │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │              Media3 Playback Service (Foreground)                │  │
│  │  - MediaSession & Notification Controller                        │  │
│  │  - ExoPlayer Audio Pipeline & CacheDataSource                    │  │
│  │  - Sleep Timer Controller & Audio Visualizer Processor           │  │
│  └──────────────────┬─────────────────────────────┬─────────────────┘  │
└─────────────────────┼─────────────────────────────┼────────────────────┘
                      │                             │
┌─────────────────────▼──────────┐   ┌──────────────▼────────────────────┐
│    Network & Stream Extractor  │   │      Local Database & Storage     │
│  - InnerTubeX Catalog Client   │   │  - Room Database (Playlists/Favs) │
│  - Piped API Stream Extractor  │   │  - Download Manager & Cache       │
│  - Time-Synced LRCLIB Lyrics   │   │  - DataStore Preferences          │
└────────────────────────────────┘   └───────────────────────────────────┘
```

### Data Model & Entities

```kotlin
// Track Entity
data class Track(
    val id: String,
    val title: String,
    val artist: String,
    val album: String?,
    val durationMs: Long,
    val thumbnailUrl: String,
    val streamUrl: String?,
    val localUri: String?,
    val isDownloaded: Boolean = false,
    val isFavorite: Boolean = false
)

// Playlist Entity
data class Playlist(
    val id: Long,
    val name: String,
    val createdAt: Long,
    val trackCount: Int
)

// Synchronized Lyric Line
data class LyricLine(
    val timestampMs: Long,
    val text: String
)
```

---

## 5. Phased Implementation Roadmap

1. **Phase 1: Android Gradle & Foundation Setup**
   - Configure Gradle Kotlin DSL with AGP, Kotlin 2.x, Jetpack Compose BOM, Room, Ktor/OkHttp, and AndroidX Media3 (`1.3.x`).
   - Establish dependency injection and application lifecycle.

2. **Phase 2: Stream Extraction & Network Engine**
   - Integrate InnerTube catalog search and Piped audio stream resolver.
   - Implement synchronized lyrics fetcher using LRCLIB API.

3. **Phase 3: Media3 Background Playback Service**
   - Implement `MusicService : MediaSessionService` with notification channel and lockscreen controls.
   - Connect ExoPlayer with `SimpleCache` for progressive buffering.

4. **Phase 4: Room Database & Offline Downloads**
   - Create Room entities for Tracks, Playlists, and Playback History.
   - Build `DownloadManager` executing background downloads via WorkManager.

5. **Phase 5: Compose UI & Visual Polish**
   - Construct Home, Search, Vibe mixes, and the Expandable Now Playing sheet.
   - Add sleep timer modal, equalizer hook, and real-time audio visualizer animations.
