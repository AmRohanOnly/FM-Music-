import {
  LicensedMediaItem,
  LicensedPlaybackSource,
  PlaybackTrack,
} from '../types/playback';
import { youtubeMusicSearchUrl } from './musicNetworkClient';

/**
 * An authorized licensed playback provider sample for testing and verification.
 * Adheres strictly to the licensed media constraints (HTTPS non-YouTube media).
 */
export class SampleLicensedPlaybackSource implements LicensedPlaybackSource {
  private sampleTracks: Record<string, { uri: string; mimeType: string }> = {
    'sample-1': {
      uri: 'https://cdn.freesound.org/previews/682/682054_11861866-lq.mp3',
      mimeType: 'audio/mpeg',
    },
    'sample-2': {
      uri: 'https://cdn.freesound.org/previews/682/682055_11861866-lq.mp3',
      mimeType: 'audio/mpeg',
    },
  };

  async resolve(track: PlaybackTrack): Promise<LicensedMediaItem | null> {
    const audio = this.sampleTracks[track.id] || {
      uri: 'https://cdn.freesound.org/previews/682/682054_11861866-lq.mp3',
      mimeType: 'audio/mpeg',
    };

    return new LicensedMediaItem(
      'sample-licensed-provider',
      audio.uri,
      track.title,
      track.artist,
      audio.mimeType
    );
  }
}

export interface VerificationResult {
  name: string;
  passed: boolean;
  message: string;
}

/**
 * Runs the unit test assertions originally present in:
 * - MusicSearchTest.kt
 * - LicensedPlaybackSourceTest.kt
 */
export function runArchitectureDiagnostics(): VerificationResult[] {
  const results: VerificationResult[] = [];

  // Test 1: URL Encoding test
  try {
    const url = youtubeMusicSearchUrl('  Daft Punk & Justice  ');
    const expected = 'https://music.youtube.com/search?q=Daft+Punk+%26+Justice';
    const passed = url === expected;
    results.push({
      name: 'encodesSearchTextForOfficialYouTubeMusicUrl',
      passed,
      message: passed ? 'Passed: Matches expected query encoding format' : `Failed: Expected ${expected}, got ${url}`,
    });
  } catch (err) {
    results.push({
      name: 'encodesSearchTextForOfficialYouTubeMusicUrl',
      passed: false,
      message: `Error: ${String(err)}`,
    });
  }

  // Test 2: Accepts secure provider and redacts URI from toString()
  try {
    const media = new LicensedMediaItem(
      'licensed-provider',
      'https://audio.example.test/track?token=private',
      'Example track',
      'Example artist'
    );
    const mediaString = media.toString();
    const tokenHidden = !mediaString.includes('token=private');
    const redactedShown = mediaString.includes('uri=[REDACTED]');
    const passed = tokenHidden && redactedShown;
    results.push({
      name: 'acceptsSecureProviderMediaAndRedactsUriFromLogs',
      passed,
      message: passed ? 'Passed: Sensitive audio URI is redacted from logs/toString()' : 'Failed: URI was not properly redacted',
    });
  } catch (err) {
    results.push({
      name: 'acceptsSecureProviderMediaAndRedactsUriFromLogs',
      passed: false,
      message: `Error: ${String(err)}`,
    });
  }

  // Test 3: Rejects InnerTubeX as playback provider
  try {
    let threw = false;
    try {
      new LicensedMediaItem(
        'InnerTubeX',
        'https://audio.example.test/track',
        'Example track',
        'Example artist'
      );
    } catch {
      threw = true;
    }
    results.push({
      name: 'rejectsInnerTubeXAsPlaybackProvider',
      passed: threw,
      message: threw ? 'Passed: InnerTubeX is restricted to public metadata, rejected as playback provider' : 'Failed: Did not throw on InnerTubeX provider',
    });
  } catch (err) {
    results.push({
      name: 'rejectsInnerTubeXAsPlaybackProvider',
      passed: false,
      message: `Error: ${String(err)}`,
    });
  }

  // Test 4: Rejects YouTube and Google Video media hosts
  try {
    const forbiddenUris = [
      'https://music.youtube.com/audio',
      'https://r1.googlevideo.com/audio',
      'https://youtu.be/example',
    ];

    let allRejected = true;
    for (const uri of forbiddenUris) {
      let threw = false;
      try {
        new LicensedMediaItem('licensed-provider', uri, 'Example track', 'Example artist');
      } catch {
        threw = true;
      }
      if (!threw) {
        allRejected = false;
        break;
      }
    }

    results.push({
      name: 'rejectsYouTubeAndGoogleVideoMediaHosts',
      passed: allRejected,
      message: allRejected
        ? 'Passed: YouTube media hosts rejected to enforce official YouTube playback'
        : 'Failed: Allowed forbidden YouTube domain in in-app player',
    });
  } catch (err) {
    results.push({
      name: 'rejectsYouTubeAndGoogleVideoMediaHosts',
      passed: false,
      message: `Error: ${String(err)}`,
    });
  }

  return results;
}
