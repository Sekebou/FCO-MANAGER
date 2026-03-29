/**
 * Current app version — must be bumped on each store release.
 * Used by ForceUpdateGuard to compare against the minimum version in the database.
 */
export const APP_VERSION = '1.0.0';

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
