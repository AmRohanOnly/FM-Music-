export const CURRENT_APP_VERSION = '1.0.0';

const rawEnvRepo =
  typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GITHUB_REPO
    ? String((import.meta as any).env.VITE_GITHUB_REPO)
    : '';

export const DEFAULT_GITHUB_REPO = rawEnvRepo.trim();

const STORAGE_KEY_GITHUB_REPO = 'fm_music_github_repo';
const STORAGE_KEY_SKIPPED_TAG = 'fm_music_skipped_release_tag';
const STORAGE_KEY_LAST_CHECK_AT = 'fm_music_last_update_check_at';

export interface AppUpdateCheckResult {
  repo: string;
  currentVersion: string;
  latestVersion: string;
  tagName: string;
  versionCode: number | null;
  updateAvailable: boolean;
  releaseTitle: string;
  releaseNotes: string;
  apkDownloadUrl: string | null;
  releasePageUrl: string;
  packagesUrl: string;
  sizeBytes: number;
  publishedAt: string;
  mandatory?: boolean;
  error?: string;
}

export function isDirectManifestUrl(raw: string): boolean {
  const lower = raw.trim().toLowerCase();
  return lower.startsWith('https://') && !lower.startsWith('https://github.com/');
}

export function sanitizeGithubRepo(raw: string): string {
  const trimmed = raw.trim();
  if (isDirectManifestUrl(trimmed)) return trimmed;

  const cleaned = trimmed
    .replace(/^https?:\/\/github\.com\//i, '')
    .replace(/^github\.com\//i, '')
    .replace(/\.git$/i, '')
    .replace(/^\/+|\/+$/g, '');

  const parts = cleaned.split('/').filter(Boolean);
  if (parts.length < 2) return '';
  const owner = parts[0].replace(/[^A-Za-z0-9_.-]/g, '');
  const repo = parts[1].replace(/[^A-Za-z0-9_.-]/g, '');
  if (!owner || !repo) return '';
  return `${owner}/${repo}`;
}

export function compareSemver(remoteVersion: string, currentVersion: string): number {
  const parse = (v: string): number[] =>
    v
      .trim()
      .replace(/^v/i, '')
      .split('-')[0]
      .split('.')
      .map((part) => {
        const match = part.match(/^\d+/);
        return match ? parseInt(match[0], 10) : 0;
      });

  const a = parse(remoteVersion);
  const b = parse(currentVersion);
  const maxLen = Math.max(a.length, b.length, 3);
  for (let i = 0; i < maxLen; i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (av > bv) return 1;
    if (av < bv) return -1;
  }
  return 0;
}

export function formatApkSize(bytes: number): string {
  if (!bytes || bytes <= 0) return 'APK build';
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

export function loadStoredGithubRepo(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_GITHUB_REPO) || '';
    return saved.trim() || sanitizeGithubRepo(DEFAULT_GITHUB_REPO);
  } catch {
    return sanitizeGithubRepo(DEFAULT_GITHUB_REPO);
  }
}

export function saveStoredGithubRepo(repo: string): void {
  try {
    const clean = sanitizeGithubRepo(repo);
    if (clean) {
      localStorage.setItem(STORAGE_KEY_GITHUB_REPO, clean);
    } else {
      localStorage.removeItem(STORAGE_KEY_GITHUB_REPO);
    }
  } catch {
    // ignore storage errors
  }
}

export function loadSkippedReleaseTag(): string {
  try {
    return localStorage.getItem(STORAGE_KEY_SKIPPED_TAG) || '';
  } catch {
    return '';
  }
}

export function saveSkippedReleaseTag(tagName: string): void {
  try {
    if (tagName) {
      localStorage.setItem(STORAGE_KEY_SKIPPED_TAG, tagName);
    } else {
      localStorage.removeItem(STORAGE_KEY_SKIPPED_TAG);
    }
  } catch {
    // ignore
  }
}

export function shouldRunAutoUpdateCheck(cooldownMs = 15 * 60 * 1000): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LAST_CHECK_AT);
    if (!raw) return true;
    const last = parseInt(raw, 10);
    if (Number.isNaN(last)) return true;
    return Date.now() - last >= cooldownMs;
  } catch {
    return true;
  }
}

export function markAutoUpdateChecked(timestampMs = Date.now()): void {
  try {
    localStorage.setItem(STORAGE_KEY_LAST_CHECK_AT, String(timestampMs));
  } catch {
    // ignore
  }
}

export async function fetchDefaultUpdateRepo(): Promise<string> {
  try {
    const res = await fetch('/api/app-update/config', {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return '';
    const data = await res.json();
    return sanitizeGithubRepo(String(data?.defaultRepo || ''));
  } catch {
    return '';
  }
}

export function evaluateGithubReleasePayload(
  release: {
    tag_name?: string;
    name?: string;
    body?: string;
    html_url?: string;
    published_at?: string;
    assets?: Array<{ name?: string; browser_download_url?: string; size?: number }>;
  },
  repo: string,
  currentVersion = CURRENT_APP_VERSION
): AppUpdateCheckResult {
  const tagName = String(release?.tag_name || '').trim();
  const latestVersion = tagName.replace(/^v/i, '').trim() || currentVersion;
  const assets = Array.isArray(release?.assets) ? release.assets : [];

  const apkAsset =
    assets.find((a) => typeof a.name === 'string' && a.name.toLowerCase().endsWith('-latest.apk')) ||
    assets.find((a) => typeof a.name === 'string' && a.name.toLowerCase().endsWith('.apk')) ||
    null;

  return {
    repo,
    currentVersion,
    latestVersion,
    tagName,
    versionCode: null,
    updateAvailable: tagName.length > 0 && compareSemver(tagName, currentVersion) > 0,
    releaseTitle: String(release?.name || tagName || `v${latestVersion}`),
    releaseNotes: String(release?.body || '').trim(),
    apkDownloadUrl: apkAsset?.browser_download_url || null,
    releasePageUrl: String(release?.html_url || `https://github.com/${repo}/releases`),
    packagesUrl: `https://github.com/${repo}?tab=packages`,
    sizeBytes: Number(apkAsset?.size || 0),
    publishedAt: String(release?.published_at || ''),
    mandatory: false,
  };
}

async function fetchGithubReleaseDirect(
  repo: string,
  currentVersion: string
): Promise<AppUpdateCheckResult> {
  const ghRes = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
    headers: { Accept: 'application/vnd.github+json' },
    signal: AbortSignal.timeout(7000),
  });

  if (ghRes.status === 404) {
    return {
      repo,
      currentVersion,
      latestVersion: currentVersion,
      tagName: '',
      versionCode: null,
      updateAvailable: false,
      releaseTitle: '',
      releaseNotes: '',
      apkDownloadUrl: null,
      releasePageUrl: `https://github.com/${repo}/releases`,
      packagesUrl: `https://github.com/${repo}?tab=packages`,
      sizeBytes: 0,
      publishedAt: '',
      mandatory: false,
    };
  }

  if (!ghRes.ok) {
    throw new Error(`GitHub Releases API returned HTTP ${ghRes.status}`);
  }

  const release = await ghRes.json();
  return evaluateGithubReleasePayload(release, repo, currentVersion);
}

export async function checkAppUpdate(
  repoInput: string,
  currentVersion = CURRENT_APP_VERSION
): Promise<AppUpdateCheckResult> {
  const repo = sanitizeGithubRepo(repoInput);
  if (!repo) {
    throw new Error('Enter a valid GitHub repository in owner/repo format.');
  }

  const params = new URLSearchParams({
    repo,
    currentVersion,
  });

  try {
    const response = await fetch(`/api/app-update?${params.toString()}`, {
      signal: AbortSignal.timeout(8000),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error || `Update check failed (${response.status})`);
    }
    markAutoUpdateChecked();
    return data as AppUpdateCheckResult;
  } catch (err) {
    // Fallback to querying GitHub Releases API directly if backend route is unreachable
    if (!isDirectManifestUrl(repo)) {
      const directResult = await fetchGithubReleaseDirect(repo, currentVersion);
      markAutoUpdateChecked();
      return directResult;
    }
    throw err;
  }
}
