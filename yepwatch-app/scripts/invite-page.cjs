#!/usr/bin/env node
// Writes <web dir>/invite.html: the exported index.html with link-preview tags for a room invite.
// Caddy serves it for /r/<code> through its templates handler, which fills in [[ ... ]] from the request path,
// so the preview image is that invite's card (the api draws it with the host's name).
//   node scripts/invite-page.cjs /web
const fs = require('node:fs');
const path = require('node:path');

const dir = process.argv[2];
if (!dir) throw new Error('Usage: invite-page.cjs <web export dir>');
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
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
