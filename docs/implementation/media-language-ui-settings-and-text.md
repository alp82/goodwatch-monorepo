# Media language UI: settings page and text rendering

Decided 2026-10-14 in the UI thread of the multi-language work, under the orchestrator's brief. Revisable.

## Settings page (`/settings/country`)

- `/settings/country` is the only settings page that edits the country. It now edits the pair: **Country** and **Titles** lists side by side (stacked on a phone). The navigation entry is "Country & titles".
- Same pair rules as the title page's F pair (`ui/media-preference/machine.ts`, `MediaPreference.tsx`): one save call for the whole pair through `/api/user-settings/set`, a client id per page load, `expectedVersion` from the private `GET /api/media-preferences`, a 409 that adopts the saved record and keeps the pick for Retry.
- **No preview there: a pick saves at once.** A settings page has no title to show a pick on, so a pending "Keep this?" step would add a click without anything to look at. The toast offers Undo of the whole pair, through the same call ("Saved to your account: Japan" / "Restored …").
- While a save runs, both lists are off (a disabled fieldset) and "Saving to your account…" is said. A failure keeps the pick, shows it as "not saved", and offers **Retry** and **Cancel**; a conflict says "Saved elsewhere meanwhile".
- Browser default reads "Follow browser (currently German)"; the save destination comes from the server's answer ("to your account" for members; the page is members-only).
- **No companion offer on settings.** The language list stands right beside the country list, so a country pick saves only the country.

## Text in the launch languages

- **Fonts:** no web font is added. Body text uses Tailwind's system stack (`ui-sans-serif, system-ui, sans-serif`), and the operating system's fallback fonts draw CJK, Cyrillic and Arabic. Gabarito stays the brand face for Latin only (its files have unicode ranges, so other scripts never download it).
- **`lang` decides the glyphs:** Japanese and Simplified/Traditional Chinese share code points and differ in glyph shapes, and only the element's `lang` lets the browser choose. The document stays `lang="en"` (interface).
- **Bytes:** the shared stylesheet grows by 184 B raw (+77 B gzip, +57 B Brotli), from the production build compared with a build of e5d7930e. `MediaText` is not imported by any page yet, so no landing page script grows.
- **`ui/media-text/MediaText.tsx`** takes `{ value: { text, lang } }`, the shape the localized data will carry per field. `media-text.ts` maps a tag to attributes:
  - Every known tag gets its `lang`.
  - Arabic (and other right-to-left tags) gets `dir="rtl"`; the interface stays left to right, and `dir` isolates the text from the English around it.
  - A missing or malformed tag gets `dir="auto"`.
  - Scripts whose marks reach above and below the line (Arabic) get `data-media-script="tall"`. A rule in `main.css` gives them 0.15 em of room inside their own clipping box and takes it back outside, so nothing moves.
  - Use MediaText as the element that clips (`truncate`, `line-clamp-*`), not as a span inside it.
- **Korean** breaks lines between words (`word-break: keep-all` on `[lang|=ko]`); a word longer than its box still breaks.
- Evidence is in `media-language-screens/`: `text-*.png`, `arabic-zoom-*.png`, `cjk-zoom-*.png` (from `/prototype/media-language-ui?view=text`, development only).
