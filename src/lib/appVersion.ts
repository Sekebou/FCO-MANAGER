import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

/**
 * Fallback version used on web (preview). 
 * On native (iOS/Android), the real version is read from the app bundle.
 */
const FALLBACK_VERSION = '1.0.0';

let cachedVersion: string | null = null;

/**
 * Get the native app version (from Info.plist / build.gradle).
 * Returns the fallback on web.
 */
export async function getAppVersion(): Promise<string> {
  if (cachedVersion) return cachedVersion;

  if (Capacitor.isNativePlatform()) {
    try {
      const info = await App.getInfo();
      cachedVersion = info.version;
      return cachedVersion;
    } catch {
      return FALLBACK_VERSION;
    }
  }

  return FALLBACK_VERSION;
}

/**
 * Compare two semver strings (e.g. "1.2.3").
 * Returns true if `current` is older than `minimum`.
 */
export function isVersionOutdated(current: string, minimum: string): boolean {
  const parse = (v: string) => v.split('.').map(Number);
  const cur = parse(current);
  const min = parse(minimum);

  for (let i = 0; i < 3; i++) {
    if ((cur[i] ?? 0) < (min[i] ?? 0)) return true;
    if ((cur[i] ?? 0) > (min[i] ?? 0)) return false;
  }
  return false;
}
