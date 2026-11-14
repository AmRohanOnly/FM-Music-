export const CURRENT_APP_VERSION = '1.0.0';

const STORAGE_KEY_GITHUB_REPO = 'fm_music_github_repo';
const STORAGE_KEY_SKIPPED_TAG = 'fm_music_skipped_release_tag';

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
    return localStorage.getItem(STORAGE_KEY_GITHUB_REPO) || '';
  } catch {
    return '';
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

  const response = await fetch(`/api/app-update?${params.toString()}`, {
    signal: AbortSignal.timeout(8000),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error || `Update check failed (${response.status})`);
  }

  return data as AppUpdateCheckResult;
}
