# FM Music (React)

A modern React web rewrite of FM Music, ported from the original Kotlin + Jetpack Compose Android client.

## Features Ported
- **Music Search**: Query input and mood vibe buttons ("New releases", "Hindi hits", "Chill", "Indie", "Focus", "Workout") that route queries cleanly to YouTube Music search using official URL encoding format (`https://music.youtube.com/search?q=...`).
- **Original Color Palette & Visuals**:
  - Ink (`#111116`) deep background
  - Panel (`#1B1B23`) card containers
  - Electric Chartreuse / Accent (`#B9F36A`) branding, focus rings, and primary buttons
  - Soft text (`#B7B7C4`) and crisp typography
- **Playback Controller**: Port of `Media3PlaybackController` managing playback UI state (`title`, `artist`, `isPlaying`, `isBuffering`, `errorMessage`, and `hasMedia`).
- **Licensed Media Rules Enforcement**: Direct port of `LicensedPlaybackSource` and `LicensedMediaItem`:
  - Enforces HTTPS / local URIs without sensitive user credentials.
  - Redacts sensitive media URIs in string/log representations (`uri=[REDACTED]`).
  - Restricts `InnerTubeX` to public catalog metadata only (rejected as playback provider).
  - Explicitly rejects unofficial YouTube/GoogleVideo media stream extraction in favor of the official YouTube Music experience.
- **Diagnostics & Test Runner**: Built-in interactive test suite verifying the behavior of `MusicSearchTest` and `LicensedPlaybackSourceTest`.
- **Public Visitor Session Initialization**: Port of `MusicNetworkClient` and `InnerTubeCatalogClient` representing the unauthenticated catalog browse session.

## Development & Build

```bash
# Install dependencies
npm install

# Start dev server (Port 3000, 0.0.0.0)
npm run dev

# Build for production
npm run build
```
