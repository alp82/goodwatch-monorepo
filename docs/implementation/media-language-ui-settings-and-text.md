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

## Localized preview on the title page (F) and media text readers

Added 2026-10-14, after the backend overlays (4718b47c).

- **Two previews, two sources.** A picked country still reads the title route's data for that country (its offers); the route takes its language from what is saved, so a picked titles language reads the read-only `GET /api/media-title?type=…&id=…&displayLanguage=…` instead (`useTitlePreview.ts`, `localized-preview.ts`). The preview swaps the title, poster, description and tagline of the current title and nothing else; seasons, related titles and cards follow after Keep, when the page reads its data again.
- **No layout shift:** the header title is one truncated line, the hero poster is a fixed 2:3 box, and About sits below the fold. Measured with the browser's layout-shift entries after each pick: 0.0000 on desktop and phone for German, Japanese, Arabic and Browser default.
- **Stale answers are never shown:** one query per title and language (`localizedTitleQueryKey`), aborted when the pick changes, and `withLocalizedText` refuses a payload for another title, type or language. Checked live by holding back the Japanese answer five seconds behind a later Arabic pick.
- While a language's text is on its way the page keeps the text it has; the header title says `aria-busy`.
- **MediaText on the readers.** `presentedText(media, field, text)` and `episodeText(episode, field)` adapt the payload's provenance to `{ text, lang }`; `und` (language not established) gives `lang="und" dir="auto"`. Used as the clipping element in: the details header title, About's tagline and description, MovieTvCard titles (TitlePosterCard, Discover, related carousel, person pages; the year stays interface text), the fingerprint and questions headings' title mention, the command palette's titles, main search result titles, the episode grid's tip and the tracking episode rows (names, descriptions, Next).
- **Not tagged:** title mentions inside English sentences that are built as strings (the questions' answers, aria labels, toasts) cannot carry a language of their own.
- Evidence: `media-language-screens/drive-live.mjs` and `live-*.png`.
