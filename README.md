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

Install Java 21, Gradle 9.8.2, and current Android command-line tools first.
Set `ANDROID_HOME` to your SDK directory. API 37 uses the package name
`platforms;android-37.0` (not `platforms;android-37`).

```bash
sdkmanager 'platforms;android-37.0' 'build-tools;37.0.0'

# One-time local debug signing key (do not overwrite an existing key)
keytool -genkeypair -noprompt -keystore debug.keystore -storepass android \
  -alias androiddebugkey -keypass android -keyalg RSA -keysize 2048 \
  -validity 10000 -dname 'CN=Android Debug,O=Android,C=US'

# Compile, assemble, and test (this repository does not include a Gradle wrapper)
gradle --no-daemon :app:assembleDebug :app:testDebugUnitTest
```

Generated APK output: `app/build/outputs/apk/debug/app-debug.apk`

## Download an Android APK

The **Android APK** GitHub Actions workflow builds a debug APK and runs unit tests
on pushes to `main` and `arena/**` branches. It can also be run manually from the
Actions tab once the workflow is on the default branch. CI installs Java 21,
Gradle 9.8.2, Android SDK 37.0, and Build Tools 37.0.0; a local Gradle wrapper is not required by CI.

Open a successful run and download its `FM-Music-debug-<commit>` artifact. It
contains `FM-Music-debug.apk`, the source commit, and SHA-256 checksums. Extract
it into `packages/` locally (this folder is ignored by Git).

These APKs use a disposable debug signing key, not a production release key.
Installing a later build may require uninstalling the previous build, which
removes its local app data. Artifacts are retained for 30 days.

The Android build uses AGP 9.4.1 with built-in Kotlin and Kotlin Compose 2.4.21.
InnerTubeX, QuackJS, and OkHttp require compile SDK 37; downgrading only
`compileSdk` to 36 will fail dependency metadata validation. `minSdk` remains
24 and `targetSdk` remains 34.

SDK/build failures are included in GitHub check annotations and build failures
in the run summary, in addition to the full job log.
