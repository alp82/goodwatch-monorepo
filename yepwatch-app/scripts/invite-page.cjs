#!/usr/bin/env node
// Finishes the web export (runs right after `expo export --platform web`):
//  1. index.html loads every route chunk and both fonts with the page, so nothing waits on them later.
//     Expo Router loads web routes lazily: a route whose chunk is missing suspends, and React then holds the
//     page back for its Suspense throttle (300 ms) even when the chunk arrives in 5 ms. That happened at
//     startup (the root layout) and on the first visit to every route (New room, the room page, an
//     invitation). A route chunk that already ran is imported synchronously (expo/async-require), so the
//     route renders in the same frame. The chunks are small (~40 KB gzip together); the fonts are preloaded
//     because the startup word waits for them.
//  2. Writes <web dir>/invite.html: that page with link-preview tags for a room invite.
//     Caddy serves it for /r/<code> through its templates handler, which fills in [[ ... ]] from the request path,
//     so the preview image is that invite's card (the api draws it with the host's name).
//   node scripts/invite-page.cjs /web
const fs = require('node:fs');
const path = require('node:path');

const dir = process.argv[2];
if (!dir) throw new Error('Usage: invite-page.cjs <web export dir>');
let html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');

const JS = '/_expo/static/js/web/';
const entry = html.match(new RegExp(`<script src="${JS}entry-[0-9a-f]+\\.js" defer></script>`));
if (!entry) throw new Error('index.html has no entry script tag');
if (!html.includes('data-route-chunk')) {
  // Every split chunk except the entry, the shared chunk, the runtime, and the fixtures-only preview route.
  const chunks = fs.readdirSync(path.join(dir, JS)).filter((f) => f.endsWith('.js') && !/^(entry|__common|__expo-metro-runtime|preview)-[0-9a-f]+\.js$/.test(f)).sort();
  if (!chunks.some((f) => /^_layout-/.test(f))) throw new Error('web export has no _layout chunk (did async routes change?)');
  // Deferred scripts run in document order: after the runtime and shared chunk (which define __d), before the entry starts the app.
  const tags = chunks.map((f) => `<script src="${JS}${f}" defer data-route-chunk></script>`).join('');
  html = html.replace(entry[0], tags + entry[0]);
  const fonts = fs.readdirSync(path.join(dir, 'assets/assets')).filter((f) => /^Gabarito-(Regular|Bold)\.[0-9a-f]+\.ttf$/.test(f)).sort();
  if (fonts.length !== 2) throw new Error(`expected the two Gabarito fonts in assets/assets, found ${fonts.length}`);
  const preload = fonts.map((f) => `<link rel="preload" href="/assets/assets/${f}" as="font" type="font/ttf" crossorigin />`).join('\n    ');
  html = html.replace('</title>', `</title>\n    ${preload}`);
  fs.writeFileSync(path.join(dir, 'index.html'), html);
}
const block = /<!-- link-preview[\s\S]*?-->[\s\S]*?<!-- \/link-preview -->/;
if (!block.test(html)) throw new Error('index.html has no link-preview block');
// Caddy's template delimiters must not occur anywhere else in the page.
if (html.includes('[[') || html.includes(']]')) throw new Error('index.html contains [[ or ]], which Caddy would read as a template');

const code = '[[ .OriginalReq.URL.Path | trimPrefix "/r/" | html ]]';
const tags = [
  ['property', 'og:type', 'website'],
  ['property', 'og:site_name', 'YepWatch'],
  ['property', 'og:title', 'Join my YepWatch room'],
  ['property', 'og:description', "Swipe Yep or Nope together. When everyone says Yep, it's a match."],
  ['property', 'og:url', `https://yepwatch.com/r/${code}`],
  ['property', 'og:image', `https://yepwatch.com/api/yepwatch/v1/proposal/invites/${code}/card.png`],
  ['property', 'og:image:width', '1200'],
  ['property', 'og:image:height', '630'],
  ['property', 'og:image:alt', 'You are invited to a YepWatch room. Join the room.'],
  ['name', 'twitter:card', 'summary_large_image'],
]
  // The values hold no double quotes besides the template's own.
  .map(([attr, key, value]) => `<meta ${attr}="${key}" content="${value}" />`)
  .join('\n    ');
fs.writeFileSync(path.join(dir, 'invite.html'), html.replace(block, tags).replace('<title>YepWatch</title>', '<title>Join my YepWatch room</title>'));
console.log(`wrote ${path.join(dir, 'invite.html')}`);
