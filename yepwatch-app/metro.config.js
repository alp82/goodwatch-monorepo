// Metro config. Not part of the Expo runtime fingerprint (JS-only change, safe for OTA updates).
const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// zod's locale namespace (every language's error messages) is replaced by English only: metro/zod-locales.js.
const ZOD_LOCALES = /[\\/]zod[\\/]v4[\\/]locales[\\/]index\.c?js$/;
const englishOnly = path.join(__dirname, 'metro/zod-locales.js');
// Web only: react-native-web's Animated writes transform/opacity frames to the element instead of re-rendering
// the component through React on every frame, and hands timing animations' frames to the Web Animations API:
// metro/animated-props.web.js, metro/compositor-plan.web.js.
const ANIMATED_PROPS = /[\\/]react-native-web[\\/]dist[\\/]vendor[\\/]react-native[\\/]Animated[\\/]useAnimatedProps\.js$/;
const directAnimatedProps = path.join(__dirname, 'metro/animated-props.web.js');
const upstream = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolved = (upstream ?? context.resolveRequest)(context, moduleName, platform);
  if (resolved.type !== 'sourceFile') return resolved;
  if (ZOD_LOCALES.test(resolved.filePath)) return { type: 'sourceFile', filePath: englishOnly };
  if (platform === 'web' && ANIMATED_PROPS.test(resolved.filePath)) return { type: 'sourceFile', filePath: directAnimatedProps };
  return resolved;
};

module.exports = config;
