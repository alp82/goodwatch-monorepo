/** Public origin only. This is never a database endpoint or embedded credential. */
export const apiOrigin = (process.env.EXPO_PUBLIC_API_ORIGIN ?? 'https://yepwatch.com').replace(/\/$/, '');
// Browser invitations stay on the participating app; native shares the configured public app host.
export const appOrigin = (process.env.EXPO_PUBLIC_APP_ORIGIN ?? (typeof window !== 'undefined' && window.location?.origin ? window.location.origin : 'https://yepwatch.com')).replace(/\/$/, '');
export const fixturesEnabled = process.env.EXPO_PUBLIC_ENABLE_FIXTURES === 'true';
export const developmentNotice = process.env.EXPO_PUBLIC_DEVELOPMENT_NOTICE;
export function apiUrl(path: string) {
  const origin = new URL(apiOrigin);
  if (origin.protocol !== 'https:' && !(['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname) && origin.protocol === 'http:')) throw new Error('The API requires HTTPS (HTTP is allowed only on loopback for development).');
  if (!path.startsWith('/api/yepwatch/v1/')) throw new Error('Unexpected API path.');
  return `${origin.origin}${path}`;
}
export function realtimeUrl(path: string) {
  if (path !== '/api/yepwatch/v1/realtime') throw new Error('Unexpected realtime path.');
  const url = new URL(process.env.EXPO_PUBLIC_WS_ORIGIN ?? apiOrigin.replace(/^http/, 'ws'));
  if (url.protocol !== 'wss:' && !(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) && url.protocol === 'ws:')) throw new Error('Realtime requires WSS outside loopback development.');
  return `${url.origin}${path}`;
}
/** v2 is isolated from retained contract1 deployments. */
export function continuousRealtimeUrl(path: string) {
  if (path !== '/api/yepwatch/v1/continuous/realtime') throw new Error('Unexpected continuous realtime path.');
  const url = new URL(process.env.EXPO_PUBLIC_WS_ORIGIN ?? apiOrigin.replace(/^http/, 'ws'));
  if (url.protocol !== 'wss:' && !(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) && url.protocol === 'ws:')) throw new Error('Realtime requires WSS outside loopback.');
  return `${url.origin}${path}`;
}
