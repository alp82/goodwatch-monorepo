import type { ConfigContext, ExpoConfig } from 'expo/config';

/** Separate install identities; default development config remains untouched. */
export default ({ config }: ConfigContext): ExpoConfig => {
  const variant = process.env.APP_VARIANT ?? 'development';
  if (!['development', 'preview', 'production'].includes(variant))
    throw new Error('APP_VARIANT must be development, preview or production.');
  if (variant === 'development') return config as ExpoConfig;
  const preview = variant === 'preview';
  const build = Number(process.env.APP_BUILD_NUMBER ?? '1');
  if (!Number.isSafeInteger(build) || build < 1) throw new Error('APP_BUILD_NUMBER must be a positive integer.');
  for (const key of ['EXPO_PUBLIC_API_ORIGIN', 'EXPO_PUBLIC_APP_ORIGIN']) {
    if (process.env[key] !== 'https://yepwatch.com') throw new Error(`${key} must be https://yepwatch.com for release builds.`);
  }
  if (process.env.EXPO_PUBLIC_WS_ORIGIN !== 'wss://yepwatch.com' ||
      process.env.EXPO_PUBLIC_ENABLE_FIXTURES !== 'false' ||
      process.env.EXPO_PUBLIC_GUEST_ONLY !== 'true' || process.env.EXPO_PUBLIC_DEVELOPMENT_NOTICE)
    throw new Error('Release builds require public WSS, guest-only mode, fixtures disabled and no development notice.');
  const id = preview ? 'com.yepwatch.preview' : 'com.yepwatch.app';
  return {
    ...config,
    name: preview ? 'YepWatch Beta' : 'YepWatch',
    slug: 'yepwatch',
    version: '0.1.0',
    scheme: preview ? 'yepwatch-preview' : 'yepwatch',
    ios: { ...config.ios, bundleIdentifier: id, buildNumber: String(build),
      associatedDomains: ['applinks:yepwatch.com'],
      infoPlist: { ...config.ios?.infoPlist, ITSAppUsesNonExemptEncryption: false } },
    android: { ...config.android, package: id, versionCode: build,
      intentFilters: [{ action: 'VIEW', autoVerify: true,
        category: ['BROWSABLE', 'DEFAULT'], data: [{ scheme: 'https', host: 'yepwatch.com', pathPrefix: '/r/' }] }] },
    plugins: [...(config.plugins ?? []), ...(process.env.YEPWATCH_LOCAL_PREVIEW_SIGNING === '1' ? ['./plugins/with-preview-signing.cjs'] : [])],
    extra: { ...config.extra, buildVariant: variant,
      ...(process.env.EAS_PROJECT_ID ? { eas: { projectId: process.env.EAS_PROJECT_ID } } : {}) },
    ...(process.env.EXPO_ACCOUNT_OWNER ? { owner: process.env.EXPO_ACCOUNT_OWNER } : {}),
  };
};
