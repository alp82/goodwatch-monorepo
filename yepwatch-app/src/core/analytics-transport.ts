import { RybbitReactNative } from '@rybbit/react-native';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import type { AnalyticsPayload } from './analytics-policy';
import { analyticsFetch } from './analytics-request';

export const anonymousAnalyticsKey = 'yepwatch.analytics.anonymous-id';
let ready: Promise<RybbitReactNative> | undefined;
export async function resetAnalyticsIdentity() {
  const previous = ready;
  ready = undefined;
  await previous?.then((sdk) => sdk.cleanup()).catch(() => undefined);
  await SecureStore.deleteItemAsync(anonymousAnalyticsKey);
}
export function analyticsAllowed() {
  return !__DEV__ && process.env.EXPO_PUBLIC_ENABLE_FIXTURES !== 'true' && process.env.EXPO_PUBLIC_ANALYTICS_ENABLED !== 'false';
}
function client() {
  return ready ??= (async () => {
    const sdk = new RybbitReactNative();
    await sdk.init({
      analyticsHost: 'https://a.seen.is/api', siteId: '96d946d8bf70', appIdentifier: 'com.yepwatch.app',
      appVersion: Constants.expoConfig?.version, autoTrackAppLifecycle: false,
      storage: {
        getItem: (key) => key.endsWith(':anonymous-id') ? SecureStore.getItemAsync(anonymousAnalyticsKey) : null,
        setItem: (key, value) => key.endsWith(':anonymous-id') ? SecureStore.setItemAsync(anonymousAnalyticsKey, value) : undefined,
        removeItem: () => SecureStore.deleteItemAsync(anonymousAnalyticsKey),
      },
      // Bound all requests, including offline flushes. No errors or route parameters are sent.
      fetch: analyticsFetch,
    });
    return sdk;
  })().catch((error: unknown) => { ready = undefined; throw error; });
}
export async function sendAnalytics(payload: AnalyticsPayload) {
  const sdk = await client();
  const context = { pathname: payload.pathname, title: payload.page_title, querystring: '', referrer: '' };
  if (payload.type === 'pageview') await sdk.screen(payload.page_title, undefined, context);
  else if (payload.event_name) await sdk.event(payload.event_name, undefined, context);
}
