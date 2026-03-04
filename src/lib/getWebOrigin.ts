/**
 * Returns the public web origin of the app.
 * On Capacitor (iOS/Android), window.location.origin is "capacitor://localhost",
 * which breaks email links. This helper always returns the real web URL.
 */
export function getWebOrigin(): string {
  const origin = window.location.origin;
  if (origin.startsWith('capacitor://') || origin.startsWith('http://localhost')) {
    return 'https://fco-manager.fr';
  }
  return origin;
}
