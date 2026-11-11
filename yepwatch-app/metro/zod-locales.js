// Stands in for zod/v4/locales/index.js (see metro.config.js). zod's `export * as locales` namespace would
// otherwise bundle and evaluate all ~50 locales (~290 KB minified, an eighth of the web bundle) at startup.
// The app only ever uses the default English messages, which zod imports directly from locales/en.js.
export { default as en } from 'zod/v4/locales/en.js';
