/** Reproducible vector artwork and crawlable policy pages. No app screenshots are fabricated here. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { legalUpdated, privacySections, supportSections, termsSections, type LegalSection } from '../src/features/legal/content';
const root = resolve(import.meta.dirname, '..');
const requireWeb = createRequire(resolve(root, '../goodwatch-webapp/package.json'));
const { Resvg } = requireWeb('@resvg/resvg-js');
const sharp = requireWeb('sharp');
const escape = (text: string) => text.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
async function main() {
  const output = resolve(root, 'store/assets');
  await mkdir(output, { recursive: true });
  await mkdir(resolve(root, 'public'), { recursive: true });
  for (const [path, title, sections] of [ ['privacy', 'YepWatch privacy policy', privacySections], ['support', 'YepWatch support', supportSections], ['terms', 'YepWatch terms of use', termsSections] ] as const) {
    const content = sections.map((s: LegalSection) => `<section><h2>${escape(s.title)}</h2>${s.paragraphs.map(p => `<p>${escape(p).replace(/https:\/\/[a-zA-Z0-9./-]+/g, url => `<a href="${url}">${url}</a>`)}</p>`).join('')}</section>`).join('');
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><link rel="canonical" href="https://yepwatch.com/${path}"><meta name="description" content="${title}: information and contact details."><style>body{margin:0;background:#070707;color:#fafafa;font:17px/1.65 system-ui,sans-serif}main{max-width:760px;margin:auto;padding:32px 22px 64px}h1{font-size:36px;line-height:1.15}h2{font-size:22px;margin-top:32px}a{color:#fbbf24}nav{display:flex;gap:20px;flex-wrap:wrap}footer{margin-top:40px;color:#a3a3a3}</style></head><body><main><nav><a href="/">YepWatch</a><a href="/privacy">Privacy</a><a href="/support">Support</a><a href="/terms">Terms</a><a href="/delete-account">Delete account</a></nav><h1>${title}</h1><p>Updated ${legalUpdated}</p>${content}<footer><a href="mailto:hello@goodwatch.app">hello@goodwatch.app</a></footer></main></body></html>`;
    await writeFile(resolve(root, `public/${path}.html`), html);
  }
  const icon = await readFile(resolve(root, 'assets/icon.svg'), 'utf8');
  const fonts = [resolve(root, 'assets/Gabarito-Bold.ttf'), resolve(root, 'assets/Gabarito-Regular.ttf')];
  for (const size of [512, 1024]) {
    const png = new Resvg(icon, { fitTo: { mode: 'width', value: size } }).render().asPng();
    await writeFile(resolve(output, `icon-${size}.png`), await sharp(png).removeAlpha().png().toBuffer());
  }
  const mark = icon.replace(/<svg[^>]*>/, '').replace('</svg>', '');
  const feature = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500" viewBox="0 0 1024 500"><defs><radialGradient id="light"><stop stop-color="#fbbf24" stop-opacity=".14"/><stop offset="1" stop-color="#fbbf24" stop-opacity="0"/></radialGradient></defs><rect width="1024" height="500" fill="#070707"/><ellipse cx="875" cy="230" rx="320" ry="320" fill="url(#light)"/><g transform="translate(700 100) scale(1.65)">${mark}</g><text x="64" y="112" font-family="Gabarito" font-weight="700" font-size="56" fill="#fafafa">Yep<tspan fill="#fbbf24">Watch</tspan></text><text x="64" y="218" font-family="Gabarito" font-weight="700" font-size="50" fill="#fafafa">Choose something</text><text x="64" y="278" font-family="Gabarito" font-weight="700" font-size="50" fill="#fafafa">to watch, <tspan fill="#fbbf24">together.</tspan></text><text x="66" y="359" font-family="Gabarito" font-size="25" fill="#d4d4d4">Your ideas. Your services. Your shared pick.</text><path d="M64 401H960" stroke="#ffffff" stroke-opacity=".12"/><text x="64" y="447" font-family="Gabarito" font-size="21" fill="#a3a3a3">Movies and shows · Choose on your own phones</text></svg>`;
  await writeFile(resolve(output, 'feature-graphic.svg'), feature);
  await writeFile(resolve(output, 'feature-graphic-1024x500.png'), await sharp(new Resvg(feature, { font: { fontFiles: fonts, loadSystemFonts: false } }).render().asPng()).removeAlpha().png().toBuffer());
  await writeFile(resolve(output, 'manifest.json'), JSON.stringify({ generatedFrom: ['assets/icon.svg', 'src/features/legal/content.ts'], artwork: ['icon-512.png', 'icon-1024.png', 'feature-graphic-1024x500.png'], screenshots: 'Captured separately from the app; this script generates no screen images.' }, null, 2));
  console.log(`Prepared policy pages and artwork in ${output}`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
