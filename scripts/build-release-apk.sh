#!/usr/bin/env bash
set -euo pipefail

# Build a release APK + update-manifest.json locally without needing GitHub Actions.
# Usage:
#   ./scripts/build-release-apk.sh 1.0.1 2 owner/fm-music "Bug fixes and improvements"
#
# Requirements on local machine:
#   - JDK 17+
#   - Android SDK (ANDROID_HOME set)
#   - Gradle 8.13 (or ./gradlew)

VERSION_NAME="${1:-1.0.1}"
VERSION_CODE="${2:-2}"
GITHUB_REPO="${3:-}"
RELEASE_NOTES="${4:-Performance improvements, streaming updates, and bug fixes.}"
MANIFEST_URL="${5:-}"
MANDATORY="${6:-false}"

GRADLE_BIN="${GRADLE_BIN:-}"
if [[ -z "$GRADLE_BIN" ]]; then
  if [[ -x "./gradlew" ]]; then
    GRADLE_BIN="./gradlew"
  elif command -v gradle >/dev/null 2>&1; then
    GRADLE_BIN="gradle"
  else
    echo "Error: Neither ./gradlew nor 'gradle' found in PATH. Open this folder in Android Studio or install Gradle 8.13." >&2
    exit 1
  fi
fi

if [[ ! -f debug.keystore && -f debug.keystore.base64 ]]; then
  base64 -d debug.keystore.base64 > debug.keystore
fi

echo "Building FM Music v${VERSION_NAME} (versionCode=${VERSION_CODE})..."

"$GRADLE_BIN" :app:assembleRelease \
  -PFM_VERSION_CODE="${VERSION_CODE}" \
  -PFM_VERSION_NAME="${VERSION_NAME}" \
  -PFM_GITHUB_REPO="${GITHUB_REPO}" \
  -PFM_UPDATE_MANIFEST_URL="${MANIFEST_URL}"

mkdir -p dist-apk
APK_SRC="$(find app/build/outputs/apk/release -name "*.apk" | head -n 1)"
if [[ -z "$APK_SRC" ]]; then
  echo "Error: APK output not found under app/build/outputs/apk/release." >&2
  exit 1
fi

OUT_APK="dist-apk/FM-Music-v${VERSION_NAME}.apk"
cp "$APK_SRC" "$OUT_APK"
cp "$APK_SRC" "dist-apk/FM-Music-latest.apk"

SIZE_BYTES=$(wc -c < "$OUT_APK" | tr -d ' ')
if command -v sha256sum >/dev/null 2>&1; then
  SHA256=$(sha256sum "$OUT_APK" | awk '{print $1}')
else
  SHA256=$(shasum -a 256 "$OUT_APK" | awk '{print $1}')
fi

APK_URL=""
if [[ -n "$GITHUB_REPO" ]]; then
  APK_URL="https://github.com/${GITHUB_REPO}/releases/download/v${VERSION_NAME}/FM-Music-v${VERSION_NAME}.apk"
fi

PUBLISHED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

cat > dist-apk/update-manifest.json <<EOF
{
  "appName": "FM Music",
  "packageId": "com.fmmusic.client",
  "versionCode": ${VERSION_CODE},
  "versionName": "${VERSION_NAME}",
  "tagName": "v${VERSION_NAME}",
  "apkUrl": "${APK_URL}",
  "sha256": "${SHA256}",
  "sizeBytes": ${SIZE_BYTES},
  "publishedAt": "${PUBLISHED_AT}",
  "releaseNotes": $(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$RELEASE_NOTES" 2>/dev/null || echo "\"$RELEASE_NOTES\""),
  "mandatory": ${MANDATORY}
}
EOF

echo ""
echo "Build complete:"
echo "  APK:      ${OUT_APK} (${SIZE_BYTES} bytes)"
echo "  Manifest: dist-apk/update-manifest.json"
echo ""
echo "To push this update to users:"
echo "  1) Upload both ${OUT_APK} and dist-apk/update-manifest.json to your GitHub Release (or web server)."
echo "  2) All older installed APKs will automatically show 'New Update Available' on launch."
