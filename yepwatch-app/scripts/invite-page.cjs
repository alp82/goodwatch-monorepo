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
//     Its inline script asks for the room preview and the invite resolution right away, while the app's scripts
//     download (~0.9 s on fast 4G); the app's first request for each takes that answer
//     (src/core/continuous/early-invite-core.ts), so the join page shows as soon as the app has started.
//  3. Precompresses the immutable files (/_expo, /assets) with brotli, zstd and gzip at their highest levels, which
//     Caddy serves as they are (file_server precompressed): ~25% fewer bytes than on-the-fly zstd, all on the path
//     to a fresh browser's first screen.
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
// Same paths as the contracts' paths.invitePreview / paths.resolveInvite (tests/early-invite.test.ts), same body as
// the app's request. Never a template delimiter in here (checked below).
const EARLY_INVITE_PATHS = ['/api/yepwatch/v1/proposal/invites/preview', '/api/yepwatch/v1/proposal/guest/resolve-invite'];
const early = `<script>
      (function () {
        try {
          var m = /^\\/r\\/([A-Za-z0-9._-]{1,200})$/.exec(location.pathname);
          if (!m || !window.fetch) return;
          var body = JSON.stringify({ code: m[1] });
          var requests = {};
          ${JSON.stringify(EARLY_INVITE_PATHS)}.forEach(function (p) {
            var r = fetch(p, { method: 'POST', credentials: 'include', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: body });
            r.catch(function () {});
            requests[p] = r;
          });
          window.__ywEarlyInvite = { code: m[1], at: Date.now(), requests: requests };
        } catch (e) { /* The app asks again. */ }
      })();
    </script>`;
const invite = html.replace(block, `${tags}\n    ${early}`).replace('<title>YepWatch</title>', '<title>Join my YepWatch room</title>');
if (!invite.includes(code) || /\[\[|\]\]/.test(invite.split(code).join('')))
  throw new Error('invite.html has a [[ or ]] besides its templates');
fs.writeFileSync(path.join(dir, 'invite.html'), invite);
console.log(`wrote ${path.join(dir, 'invite.html')}`);

// ---- 3. precompressed immutable files --------------------------------------------------------------------------
const zlib = require('node:zlib');
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
let raw = 0;
let packed = 0;
for (const sub of ['_expo', 'assets']) {
  const root = path.join(dir, sub);
  if (!fs.existsSync(root)) continue;
  for (const file of walk(root)) {
    if (!/\.(js|css|json|ttf|otf|svg|wasm)$/.test(file)) continue;
    const data = fs.readFileSync(file);
    if (data.length < 1024) continue;
    const br = zlib.brotliCompressSync(data, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: data.length } });
    fs.writeFileSync(`${file}.br`, br);
    fs.writeFileSync(`${file}.gz`, zlib.gzipSync(data, { level: 9 }));
    if (zlib.zstdCompressSync) fs.writeFileSync(`${file}.zst`, zlib.zstdCompressSync(data, { params: { [zlib.constants.ZSTD_c_compressionLevel]: 19 } }));
    raw += data.length;
    packed += br.length;
  }
}
console.log(`precompressed ${(raw / 1024).toFixed(0)} KB to ${(packed / 1024).toFixed(0)} KB (brotli)`);
