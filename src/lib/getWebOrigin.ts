/**
 * Returns the public web origin of the app.
 * On Capacitor (iOS/Android), window.location.origin is "capacitor://localhost",
 * which breaks email links. This helper always returns the real web URL.
 */
export function getWebOrigin(): string {
  return 'https://fco-manager.fr';
}
