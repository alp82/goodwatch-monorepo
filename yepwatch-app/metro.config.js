// Metro config. Not part of the Expo runtime fingerprint (JS-only change, safe for OTA updates).
const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// zod's locale namespace (every language's error messages) is replaced by English only: metro/zod-locales.js.
const ZOD_LOCALES = /[\\/]zod[\\/]v4[\\/]locales[\\/]index\.c?js$/;
const englishOnly = path.join(__dirname, 'metro/zod-locales.js');
const upstream = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolved = (upstream ?? context.resolveRequest)(context, moduleName, platform);
  return resolved.type === 'sourceFile' && ZOD_LOCALES.test(resolved.filePath) ? { type: 'sourceFile', filePath: englishOnly } : resolved;
};

module.exports = config;
