/** Reproducible vector artwork and crawlable policy pages. No app screenshots are fabricated here. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { legalPages, renderLegalPage } from './legal-pages';
const root = resolve(import.meta.dirname, '..');
const requireWeb = createRequire(resolve(root, '../goodwatch-webapp/package.json'));
const { Resvg } = requireWeb('@resvg/resvg-js');
const sharp = requireWeb('sharp');
async function main() {
  const output = resolve(root, 'store/assets');
  await mkdir(output, { recursive: true });
  await mkdir(resolve(root, 'public'), { recursive: true });
  for (const page of legalPages) await writeFile(resolve(root, `public/${page.path}.html`), renderLegalPage(page));
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
