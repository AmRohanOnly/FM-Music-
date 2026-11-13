# FM Music

A professional full-length music streaming app built as both a **native Android app** (Kotlin, Jetpack Compose, Media3 ExoPlayer) and a **Liquid Glass Web/PWA companion** (React, Vite, Express).

## Key Features
- **Full-Length In-App Streaming**: Direct InnerTube player resolution with signature cipher deobfuscation, live bitrate/codec display, and zero external redirects.
- **Native Android APK + In-App Auto-Updater**: Older installed APKs automatically check GitHub Releases (`update-manifest.json`) on startup, show a **"New Update Available"** dialog with release notes and live progress bar, and install the new APK via `FileProvider`.
- **Automated GitHub Packages & Releases CI/CD**: Pushing to `main`/`master` or creating a `v*` tag automatically builds and tests the Android APK, publishes it to **GitHub Packages** (`com.fmmusic:fm-music-android:<version>:apk`), and attaches `FM-Music-v<version>.apk`, `FM-Music-latest.apk`, and `update-manifest.json` to **GitHub Releases**.
- **iOS-Style Liquid Glass UI & Themes**: Multiple dark/light frosted glass themes, customizable blur depth, ambient glow orbs, and **Dynamic Color** extraction from track artwork.
- **Equalizer & Smart Shuffle**: Web Audio API multi-band equalizer with custom presets, crossfade, sleep timer, playback speed, synced lyrics (LRCLIB / Lyrics.ovh), and weighted Smart Shuffle.
- **Backup & Restore + Recent Searches**: Export/import library backups (liked songs, playlists, offline collection, themes) and quick recent search history dropdown.

---

## Automated Android APK Builds (GitHub Packages & Releases)

Workflow file: `.github/workflows/android-apk-release.yml`

1. Push this repository to GitHub (`main` or `master` branch, or tag `v1.0.1`).
2. GitHub Actions automatically:
   - Installs JDK 17 & Android SDK 35
   - Runs unit tests (`:app:testDebugUnitTest`)
   - Builds the signed release APK (`:app:assembleRelease`)
   - Embeds your `owner/repo` into `BuildConfig.GITHUB_REPO` so the APK knows where to check for future updates automatically
   - Publishes the `.apk` to **GitHub Packages** under `com.fmmusic:fm-music-android`
   - Publishes a **GitHub Release** with `FM-Music-v<version>.apk`, `FM-Music-latest.apk`, and `update-manifest.json`

### Optional Signing Keystore Secrets (Recommended for Production)
To keep the exact same signing signature across future updates so Android upgrades cleanly over older installed APKs without uninstalling:
Add these repository secrets in **GitHub Settings → Secrets and variables → Actions**:
- `ANDROID_KEYSTORE_BASE64`: Base64-encoded `.jks` / `.keystore` file
- `ANDROID_KEYSTORE_PASSWORD`: Keystore password
- `ANDROID_KEY_ALIAS`: Signing key alias
- `ANDROID_KEY_PASSWORD`: Key password

*(If not configured, the workflow falls back cleanly to the repository's `debug.keystore.base64`.)*

### How In-App Updates Work on Older APKs
1. When an older APK opens, `AppUpdateManager` queries GitHub Releases (`releases/latest` + `update-manifest.json`).
2. If `versionCode` or semantic `versionName` is newer than the installed APK, a **"New Update Available"** prompt appears with the changelog and APK file size.
3. Tapping **Update Now** downloads the APK with live progress and launches the Android Package Installer. Users can also open **Settings → APK** in either the Android app or Web Companion to configure `owner/repo`, check for updates manually, or open **GitHub Packages**.

---

## Local Commands

### Web & Express Companion
```bash
npm install
npm run dev       # Starts Express + Vite on http://localhost:3000
npm run build     # Type-check and build web bundle
```

- Download local APK build: `GET /api/download-apk`
- Check GitHub Release updates: `GET /api/app-update?repo=owner/repo&currentVersion=1.0.0`

### Android (Local Gradle with JDK 17 + Android SDK 35)
```bash
./gradlew :app:testDebugUnitTest
./gradlew :app:assembleRelease
```
