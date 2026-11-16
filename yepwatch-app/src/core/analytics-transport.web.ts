import type { AnalyticsPayload } from './analytics-policy';
import { analyticsFetch } from './analytics-request';

export async function resetAnalyticsIdentity() { /* Web analytics keeps no client identifier. */ }

export function analyticsAllowed() {
  try {
    return !__DEV__ && process.env.EXPO_PUBLIC_ENABLE_FIXTURES !== 'true' && process.env.EXPO_PUBLIC_ANALYTICS_ENABLED !== 'false' &&
      typeof window !== 'undefined' && window.location.hostname === 'yepwatch.com' &&
      !(window as Window & { __RYBBIT_OPTOUT__?: boolean }).__RYBBIT_OPTOUT__ && localStorage.getItem('disable-rybbit') !== 'true';
  } catch { return false; }
}
/** Use Rybbit's ingestion API explicitly: its web script also captures private URLs and DOM content. */
export async function sendAnalytics(payload: AnalyticsPayload) {
  await analyticsFetch('https://a.seen.is/api/track', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    credentials: 'omit', referrerPolicy: 'no-referrer', keepalive: true,
    body: JSON.stringify({ site_id: 'b28bba760aaf', hostname: 'yepwatch.com',
      ...payload, querystring: '', referrer: '', language: navigator.language }),
  });
}
