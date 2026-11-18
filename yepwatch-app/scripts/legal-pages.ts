/**
 * The static /privacy, /support and /terms pages Caddy serves for direct visits, in the app's look: Gabarito,
 * the glow colors, the header's wordmark, Bold 32 titles and a 640 px reading column. No JavaScript.
 * Links are amber with a thin underline: amber on white text is only ~1.5:1, so the underline marks the link.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { legalUpdated, privacySections, supportSections, termsSections, type LegalSection } from '../src/features/legal/content';

/**
 * The URL of an app font in the web export, so the pages reuse the file (and its year-long cache) the app ships.
 * Expo names a single-scale asset by the MD5 of its bytes; scripts/invite-page.cjs fails the export if it isn't there.
 */
export function gabaritoUrl(weight: 'Regular' | 'Bold') {
  const hash = createHash('md5').update(readFileSync(resolve(import.meta.dirname, `../assets/Gabarito-${weight}.ttf`))).digest('hex');
  return `/assets/assets/Gabarito-${weight}.${hash}.ttf`;
}

/** The pages, written to public/<path>.html. */
export const legalPages = [
  { path: 'privacy', title: 'YepWatch privacy policy', sections: privacySections },
  { path: 'support', title: 'YepWatch support', sections: supportSections },
  { path: 'terms', title: 'YepWatch terms of use', sections: termsSections },
] as const;

export const escapeHtml = (text: string) => text.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);

// A URL or an email address ends on a letter, digit or slash, so a sentence's final period stays outside the link.
const LINK = /https:\/\/[\w./-]*[\w/]|[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
/** Escapes a paragraph and turns its URLs and email addresses into links, keeping the text as written. */
export const linkify = (text: string) => escapeHtml(text).replace(LINK, link => `<a href="${link.includes('@') ? `mailto:${link}` : link}">${link}</a>`);

const css = (fonts: { regular: string; bold: string }) => `@font-face{font-family:Gabarito;src:url(${fonts.regular}) format("truetype");font-weight:400;font-display:swap}`
  + `@font-face{font-family:Gabarito;src:url(${fonts.bold}) format("truetype");font-weight:700;font-display:swap}`
  + ':root{color-scheme:dark}*{box-sizing:border-box}'
  + 'body{margin:0;background:#070707;color:#fafafa;font:17px/1.6 Gabarito,system-ui,sans-serif;-webkit-text-size-adjust:100%}'
  + 'header{background:rgba(10,9,8,.86);border-bottom:1px solid #ffffff14}'
  + 'nav{max-width:1278px;margin:0 auto;padding:4px 8px;display:flex;flex-wrap:wrap;align-items:center}'
  + 'nav a{display:inline-flex;align-items:center;min-height:48px;padding:0 8px;color:#d4d4d4;font-size:15px;text-decoration:none}'
  + 'nav a:hover{color:#fafafa}'
  + '.mark{flex-basis:100%;color:#fafafa;font-weight:700;font-size:22px;letter-spacing:-.8px}.mark span{color:#fbbf24}'
  + 'main{max-width:672px;margin:0 auto;padding:24px 16px 72px}'
  + 'h1{margin:0;font-size:32px;font-weight:700;line-height:1.2;letter-spacing:-.3px}'
  + 'h1+p{margin:12px 0 0;font-size:13px;color:#a3a3a3}'
  + 'h2{margin:36px 0 10px;font-size:21px;font-weight:700;line-height:1.28}'
  + 'p{margin:0 0 12px}'
  + 'main a{color:#fbbf24;text-decoration:underline;text-decoration-thickness:1px;text-decoration-color:rgba(251,191,36,.55);text-underline-offset:3px;overflow-wrap:anywhere}'
  + 'main a:hover{text-decoration-color:currentColor}'
  + 'a:focus-visible{outline:2px solid #fbbf24;outline-offset:2px;border-radius:4px}'
  + 'footer{margin-top:40px;padding-top:20px;border-top:1px solid #ffffff14}footer a{font-weight:700}'
  + '@media (min-width:760px){header{position:sticky;top:0;-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px)}'
  + 'nav{height:60px;padding:0 24px}.mark{flex-basis:auto;margin-right:auto;font-size:24px}main{padding-top:48px}}';

export function renderLegalPage({ path, title, sections }: { path: string; title: string; sections: readonly LegalSection[] }) {
  const fonts = { regular: gabaritoUrl('Regular'), bold: gabaritoUrl('Bold') };
  const content = sections.map(s => `<section><h2>${escapeHtml(s.title)}</h2>${s.paragraphs.map(p => `<p>${linkify(p)}</p>`).join('')}</section>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><link rel="canonical" href="https://yepwatch.com/${path}"><meta name="description" content="${title}: information and contact details."><link rel="preload" href="${fonts.regular}" as="font" type="font/ttf" crossorigin><style>${css(fonts)}</style></head>`
    + `<body><header><nav><a class="mark" href="/">Yep<span>Watch</span></a><a href="/privacy">Privacy</a><a href="/support">Support</a><a href="/terms">Terms</a><a href="/delete-account">Delete account</a></nav></header>`
    + `<main><h1>${title}</h1><p>Updated ${legalUpdated}</p>${content}<footer><a href="mailto:hello@goodwatch.app">hello@goodwatch.app</a></footer></main></body></html>`;
}
