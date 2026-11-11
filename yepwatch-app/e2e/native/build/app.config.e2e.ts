import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * E2E build identity. Copied over app.config.ts in the harness's staging copy only (never in the
 * real app). It keeps the development config (no OTA url, so expo-updates stays on the embedded
 * bundle) and adds the release app-link filter for invitations, plus the local web origin's /r/
 * links so invitations copied from a local browser peer open the app too.
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'YepWatch E2E',
  android: {
    ...config.android,
    package: 'dev.yepwatch.e2e',
    intentFilters: [{
      action: 'VIEW', autoVerify: true, category: ['BROWSABLE', 'DEFAULT'],
      data: [
        { scheme: 'https', host: 'yepwatch.com', pathPrefix: '/r/' },
        { scheme: 'http', host: '127.0.0.1', pathPrefix: '/r/' },
      ],
    }],
  },
  plugins: [...(config.plugins ?? []), './e2e-plugins/with-loopback-cleartext.cjs'],
  extra: { ...config.extra, buildVariant: 'e2e' },
});
