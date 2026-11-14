# FM Music

A full-length music streaming app built as both a **native Android app** (Kotlin, Jetpack Compose, Media3 ExoPlayer) and a **Liquid Glass Web/PWA companion** (React, Vite, Express).

## Building & Shipping APK Updates (Two Ways)

### Option 1: Automatic Cloud Build (GitHub Actions + GitHub Packages + GitHub Releases)
You do **not** need Android Studio installed locally if you use GitHub Actions:
1. Push this repository to GitHub (`main` / `master`) or push a release tag (`git tag v1.0.1 && git push origin v1.0.1`).
2. `.github/workflows/android-apk-release.yml` automatically builds the signed release APK, publishes it to **GitHub Packages** (`com.fmmusic:fm-music-android:<version>:apk`), and creates a **GitHub Release** with `FM-Music-v<version>.apk`, `FM-Music-latest.apk`, and `update-manifest.json`.
3. Every APK built by this workflow embeds your `owner/repo` automatically (`BuildConfig.GITHUB_REPO`). When you publish a newer version later, older installed APKs detect it on startup and prompt users with **"New Update Available"** and one-tap APK install.

### Option 2: Local Build (Android Studio or CLI — No GitHub Actions Required)
If you have JDK 17 + Android SDK installed on your PC/Mac:
```bash
chmod +x scripts/build-release-apk.sh
./scripts/build-release-apk.sh "1.0.1" "2" "yourname/fm-music" "Bug fixes and improvements"
```
This outputs `dist-apk/FM-Music-v1.0.1.apk` and `dist-apk/update-manifest.json`.
- **Distribute via GitHub**: Upload both files to a GitHub Release.
- **Distribute via Your Own Server / CDN**: Pass your manifest URL as the 5th argument (`"https://your-domain.com/update-manifest.json"`) so the APK checks your own server directly instead of GitHub.

### Release Signing Keystore Secrets (Important for Seamless Upgrades)
To ensure future APKs install cleanly over older APKs without uninstalling first, keep the same keystore across releases:
- In GitHub **Settings → Secrets and variables → Actions**, optionally set:
  - `ANDROID_KEYSTORE_BASE64`
  - `ANDROID_KEYSTORE_PASSWORD`
  - `ANDROID_KEY_ALIAS`
  - `ANDROID_KEY_PASSWORD`
- If omitted, builds consistently use the repository's `debug.keystore.base64`.

### Mandatory vs Optional Updates
In `update-manifest.json` (or via GitHub Actions **Run workflow → `force_update`** or Settings → APK → **Release Manifest Builder**), setting `"mandatory": true` turns the prompt into **"Required Update Available"** and hides **Skip** / **Later** on older APKs.

---

## Web & Express Companion
```bash
npm install
npm run dev       # Starts Express + Vite on http://localhost:3000
npm run build     # Type-check and build web bundle
```

- Download local APK build: `GET /api/download-apk`
- Self-hosted update manifest feed: `GET /api/update-manifest.json`
- Check updates: `GET /api/app-update?repo=owner/repo&currentVersion=1.0.0` (also accepts `https://.../update-manifest.json`)
