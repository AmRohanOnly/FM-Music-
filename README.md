# FM Music for Android

A native Android music client built with Kotlin, Jetpack Compose, and Media3 ExoPlayer, inspired by **MetroList**, **InnerTune**, and **OuterTune**.

## Features Implemented
- **Direct In-App Streaming**: Audio playback powered by ExoPlayer and InnerTube/stream extraction with zero external redirects.
- **Dynamic Time-Based Greeting**: Changes dynamically based on local device time (*Good morning*, *Good afternoon*, *Evening beats*, *Late night vibes*).
- **Vibe Mixes**: Curated catalogs and playlists for Hindi hits, New releases, Chill, Indie, Focus, and Workout.
- **Search**: Instant debounced search for tracks, artists, and albums.
- **Mini-Player Bar**: Persistent bottom player with draggable progress scrubber, playback controls, and animated frequency visualizer bars.
- **Expandable Now Playing Sheet**:
  - Full album artwork & FM branding badge
  - Real-time animated audio visualizer
  - Complete timeline slider with live position and duration timestamps
  - Shuffle, Previous, Play/Pause, Next, and Repeat (Off / All / One)
  - Synchronized Lyrics view
  - Active Queue view
  - Sleep Timer with customizable countdown intervals (15m, 30m, 45m, 60m)
  - Favorites and offline download flags

## Build & Run

```bash
# Compile and assemble debug APK
./gradlew :app:assembleDebug

# Run unit tests
./gradlew :app:testDebugUnitTest
```

Generated APK output: `app/build/outputs/apk/debug/app-debug.apk`
