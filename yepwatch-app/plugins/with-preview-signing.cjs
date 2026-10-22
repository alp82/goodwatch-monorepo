const { withAppBuildGradle } = require('expo/config-plugins');
/** Local preview identity only. Keystore/passwords stay outside the generated/source project. */
module.exports = function withPreviewSigning(config) {
  if (process.env.APP_VARIANT !== 'preview') throw new Error('Local signing is preview-only.');
  return withAppBuildGradle(config, (mod) => {
    if (mod.modResults.language !== 'groovy') throw new Error('Expected Groovy Android build.');
    const marker = 'signingConfigs {\n';
    if (!mod.modResults.contents.includes(marker)) throw new Error('Android signing template changed.');
    mod.modResults.contents = mod.modResults.contents.replace(marker, `${marker}        preview {
            storeFile file(System.getenv('YEPWATCH_PREVIEW_KEYSTORE'))
            storePassword System.getenv('YEPWATCH_PREVIEW_STORE_PASSWORD')
            keyAlias 'yepwatch-preview'
            keyPassword System.getenv('YEPWATCH_PREVIEW_KEY_PASSWORD')
        }
`);
    const start = mod.modResults.contents.indexOf('        release {');
    if (start < 0) throw new Error('Android release template changed.');
    mod.modResults.contents = mod.modResults.contents.slice(0, start) +
      mod.modResults.contents.slice(start).replace('signingConfig signingConfigs.debug', 'signingConfig signingConfigs.preview');
    return mod;
  });
};
