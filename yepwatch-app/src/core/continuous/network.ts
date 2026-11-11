/** A browser page: it hears online, offline and focus (the app has none of these). */
export const browserEvents = () =>
  typeof window !== 'undefined' && typeof window.addEventListener === 'function' && typeof navigator !== 'undefined' && 'onLine' in navigator;
/** The browser knows it has no network at all. */
export const browserOffline = () => browserEvents() && navigator.onLine === false;
/** Calls `back` when the browser is online again (a no-op in the app); returns the unsubscribe. */
export function onBackOnline(back: () => void) {
  if (!browserEvents()) return () => undefined;
  window.addEventListener('online', back);
  return () => window.removeEventListener('online', back);
}
