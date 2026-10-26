# README feature descriptions: formatting without CSS

Research date: 2026-10-26. Scope: how to format the "Why GoodWatch" intro and the 11 centered feature descriptions in the README prototype (branch `prototype/readme-animations`, generator `.github/readme/make-variants.py`) so they look tidy. The owner said the centered paragraphs with hand-set `<br>` breaks "look awful": centered lines of very different lengths.

Statements marked **(measured)** come from loading the prototype README on github.com in headless Chromium (playwright-core, Chromium build 1248, logged out, device scale 1) and reading layout values from the page. Statements marked **(API)** come from posting test Markdown to GitHub's own renderer, `POST /markdown` with `mode: gfm` and `context: alp82/goodwatch-monorepo` ([REST docs](https://docs.github.com/en/rest/markdown/markdown)), which runs GitHub's live sanitizer. Statements marked **(inference)** are my reading, not something a source states.

## Recommendation

Use **one centered sentence of at most about 65 characters** under each heading, with no `<br>` at all (pattern A below). Rewrite each description to that length. Where a second fact matters, move it into the picture or drop it.

Why:

- The ragged look comes from the generator, not from GitHub. `make-variants.py` splits every sentence longer than `MAX_LINE = 58` characters into hand-set lines (`.github/readme/make-variants.py` lines 60-88). Hand breaks only fit one column width. On a phone, GitHub then wraps those hand-set lines again, so the "Why GoodWatch" paragraph turns into 9 centered lines, one of them 37 px wide (measured, table below).
- A single line can't be ragged. At 16 px Mona Sans, a 65-character sentence is about 500 px wide (measured). That fits on one line in the README column at every desktop width from about 1012 px up, and it stays inside even the narrowest picture (`width="60%"`, 503 px at the 838 px column).
- On phones (294-364 px column) such a sentence wraps into exactly two lines by itself. Two centered lines read as a balanced block; four to nine do not (inference).

If the owner wants to keep two facts per section, pattern B (a centered one-liner plus a `<sub>` line) is the fallback. If he wants to keep the current two-sentence copy, pattern C (left-aligned text) is the honest way to show prose. Do not use tables, alerts, blockquotes or `<dl>` for feature text (see "Elements to avoid").

## How wide the README column is

**(measured)** README content width on github.com, logged out, at `16px` body text in `"Mona Sans VF", -apple-system, …`, `h3` at `20px`/600:

| Viewport | Repo home (`/tree/<branch>`, with sidebar) | File view (`/blob/…/README.md`) |
|---|---|---|
| 1920, 1440, 1280 | **838 px** | 1012 px (1280: 861 px) |
| 1100 | 658 px | 681 px |
| 1012 | 570 px | 593 px |
| 768 | 406 px | 670 px |
| 430 | 364 px | 364 px |
| 390 | 324 px | 324 px |
| 360 | 294 px | 294 px |

The repo home page is what most visitors see, so 838 px is the desktop number to design for. The width stops growing at 1280 px viewports.

**(measured)** Average width of English sentence text in that font: about 7.6 px per character (e.g. the 104-character score description is 804 px; a 58-character sentence is 464 px). So:

| Column | Characters per line |
|---|---|
| 838 px (desktop home) | about 110 |
| 720 px (an 86% picture) | about 94 |
| 520 px (a 62% picture) | about 68 |
| 324 px (390 px phone) | about 42 |
| 294 px (360 px phone) | about 38 |

**How short is short enough:** at most **65 characters** stays on one line on desktop down to about a 1012 px viewport and never runs wider than any of the section pictures (smallest is 60%, 503 px). At most **70** still fits a 1100 px viewport (658 px column). Above 42 characters, every line wraps on a 390 px phone, so phones always get two lines; keep sentences under about 80 characters so they never get three.

**Font and sizes (source: [github-markdown-css](https://github.com/sindresorhus/github-markdown-css/blob/main/github-markdown.css), a generated copy of GitHub's Markdown styles, not GitHub's own repo):** `.markdown-body` is `font-size: 16px; line-height: 1.5` (lines 138-141), `p` has `margin-bottom: 10px` (lines 440-443), `h3` is `1.25em`/600 (lines 419-422), `sub`/`sup` are `75%` with `line-height: 0` (lines 223-236), `img` gets `max-width: 100%` (lines 239-243). The live page uses Mona Sans VF rather than the stylesheet's system stack (measured).

### What the current markup does (measured)

Rendered line widths in px of each centered description, per line:

| Section | 1280 px viewport (838 px column) | 390 px viewport (324 px column) |
|---|---|---|
| Why GoodWatch | 314, 211, 464, 444, 358, 269 | 314, 211, 312, 147, 255, 185, 318, **37**, 269 |
| One score you can trust | 464, 321 | 298, 163, 321 |
| Picked for your taste | 155, 357, 218 | 155, 292, 61, 218 |
| Your taste fingerprint | 317, 261, 398 | 317, 261, 289, 104 |
| From everything to tonight | 423, 351 | 316, 103, 302, 45 |
| Use with AI | 461, 399 | 298, 159, 295, 100 |

On desktop the lines differ by up to 300 px; on phones the hand breaks plus GitHub's own wrapping leave orphans of one or two words. The `make-variants.py` comment "GitHub has no max-width, so long descriptions get hand-set line breaks" (line 60) is the root cause: the breaks are tuned to 58 characters, but no GitHub column is 58 characters wide.

## What GitHub's sanitizer allows

[github/markup](https://github.com/github/markup/blob/master/README.md) (line 7) says rendered HTML "is sanitized, aggressively removing things that could harm you and your kin—such as `script` tags, inline-styles, and `class` or `id` attributes." GitHub's production allowlist is not public. The closest published source is the `SanitizationFilter` in [html-pipeline v2.14.3](https://github.com/gjtorikian/html-pipeline/blob/v2.14.3/lib/html/pipeline/sanitization_filter.rb) (elements lines 43-49, attributes lines 52-76). The live renderer differs from it in both directions, so the table below is what the **(API)** probe returned on 2026-10-26.

| Markup | Kept? | Notes |
|---|---|---|
| `align` on `p`, `div`, `h1`-`h6`, `td`, `th`, `img`, `table` | Kept | `center`, `left`, `right`, `justify` all survive. |
| `style`, `class` | Removed | `id` is kept but rewritten to `user-content-…`. |
| `width`, `height` on `img` | Kept | GitHub adds `style="max-width: 100%"`; with a `height` it also adds `height: auto; max-height: <height>px`. |
| `hspace` on `img` | Kept | `vspace` is removed (html-pipeline lists it, live drops it). |
| `width` on `td`/`th`/`table`, `valign`, `nowrap`, `cellpadding`, `cellspacing`, `frame`, `rules` | Kept as attributes | But see tables below: CSS still draws borders. |
| `border` on `table` | **Removed** | So `border="0"` can't hide cell borders. |
| `<br clear="left">`, `<br clear="all">` | Kept | Clears a floated `align` image. |
| `<picture>` + `<source media>` | Kept | Wrapped in `<themed-picture>`. `media="(prefers-color-scheme: dark)"` and `media="(prefers-reduced-motion: reduce)"` both survive. GitHub Docs: "The `<picture>` HTML element is supported" ([basic writing and formatting syntax](https://github.com/github/docs/blob/main/content/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax.md), line 272; theme example in [`picture-element-example.md`](https://github.com/github/docs/blob/main/data/reusables/getting-started/picture-element-example.md)). |
| `<sub>`, `<sup>`, `<ins>` | Kept | Documented in the same Docs page, lines 44-46. |
| `<kbd>`, `<mark>`, `<span title>` | Kept | |
| `<small>`, `<abbr>`, `<u>`, `<font>`, `<center>`, `<nobr>`, `<wbr>` | **Removed** (text kept) | `small` and `abbr` are in html-pipeline's list but the live renderer drops them. |
| `<figure>`, `<figcaption>` | **Removed** (contents kept) | The caption becomes loose text. |
| `<details open>`, `<summary>` | Kept | Docs: [collapsed sections](https://github.com/github/docs/blob/main/content/get-started/writing-on-github/working-with-advanced-formatting/organizing-information-with-collapsed-sections.md). |
| `<dl>`, `<dt>`, `<dd>` | Kept | |
| `<blockquote>`, `<hr>` | Kept | |
| `> [!NOTE]` etc. | Kept | Rendered as `div.markdown-alert` with an octicon. Docs page lines 422-449: five types; "limit them to one or two per article" and "avoid placing alerts consecutively" (line 426). |
| `role`, `aria-label` on `p` | Removed | `dir`, `lang`, `title` are kept. |
| `<svg>`, `<video>` (in rendered Markdown) | Removed | |
| Markdown inside `<div align="center">` | Rendered | Only when blank lines separate the HTML tags from the Markdown. Without blank lines it stays literal, which is why the generator converts backticks to `<code>` (`make-variants.py` line 87). |
| Trailing `\` line break | Becomes `<br>` | Docs page lines 204-230 list the line-break options. |
| `&nbsp;` | Kept (plain text) | Useful to keep the last two words together (inference: it is a character, not markup, so the sanitizer has nothing to strip). |

### Light vs dark theme

From [github-markdown-css](https://github.com/sindresorhus/github-markdown-css/blob/main/github-markdown.css) (dark tokens lines 20-63, light tokens lines 76-116):

- **Tables:** every `th`/`td` gets `border: 1px solid var(--borderColor-default)` and padding `6px 13px` (lines 702-706); every second row gets `--bgColor-muted` (lines 717-719). Light: border `#d1d9e0`, stripe `#f6f8fa`. Dark: border `#3d444d`, stripe `#151b23`. `table` is `display: block; width: max-content; max-width: 100%; overflow: auto` (lines 333-339), so on a phone a wide table scrolls sideways instead of stacking.
- **Blockquote:** `color: var(--fgColor-muted)` with a `.25em` left bar (lines 445-450). Light `#59636e`, dark `#9198a1`.
- **`<hr>`:** a `.25em` bar in `--borderColor-default` (lines 257-266).
- **`<kbd>`:** key cap with muted background and border, 11 px monospace (lines 386-397).
- **Alerts:** colored left border, title and icon per type, defined per theme (lines 1179 onward).
- **`<sub>`/`<sup>`:** no color change, only size and position, so they look the same in both themes (lines 223-236).
- **`<dl>`:** `dt` is italic and bold, `dd` indented `16px` (lines 681-696).
- **Images:** `#gh-light-mode-only` / `#gh-dark-mode-only` URL fragments also switch images per theme ([Supabase README](https://github.com/supabase/supabase/blob/master/README.md), lines 1-4), but `<picture>` is the documented way.

## How well-known READMEs format text near images

Raw READMEs fetched 2026-10-26 with `gh api repos/<owner>/<repo>/readme`. Line numbers refer to those copies.

- **[Ghostty](https://github.com/ghostty-org/ghostty/blob/main/README.md):** the centered tagline is two lines, and each line is a whole sentence: "Fast, native, feature-rich terminal emulator pushing modern features." `<br />` "A native GUI or embeddable library via `libghostty`." (lines 7-11). Body text below is left-aligned prose.
- **[LobeHub](https://github.com/lobehub/lobehub/blob/canary/README.md):** the centered header uses one short sentence per paragraph, not line breaks inside a sentence: "LobeHub organizes your agents into 7×24 operation." / "It hires, schedules, reports on your entire AI team." / "You stay in charge — without staying online." (lines 7-11), plus a `<sup>` tagline (line 41). Feature sections are left-aligned: `###` heading, one short line, two bullets with bold lead-ins, then a full-width image (lines 117-124).
- **[Dub](https://github.com/dubinc/dub/blob/main/README.md):** centered `h3` "Dub", then a single centered sentence, "The open-source link attribution platform." (lines 5-8).
- **[tldraw](https://github.com/tldraw/tldraw/blob/main/README.md):** one centered `h3` sentence (lines 15-17); features are a left-aligned list with bold lead-ins and an em dash: "**Multiplayer** — self-hostable real-time collaboration…" (lines 27-33).
- **[Excalidraw](https://github.com/excalidraw/excalidraw/blob/master/README.md):** two centered sentence-lines in an `h2` (lines 15-21); one centered sentence under the hero image (lines 39-50, inside `<figure>`, which GitHub strips, see the sanitizer table); features are a left-aligned emoji list (lines 56-69).
- **[AFFiNE](https://github.com/toeverything/AFFiNE/blob/canary/README.md):** two centered sentences split with `<br />` at the sentence end (lines 12-15); features are left-aligned bold one-liners followed by a bullet of prose (lines 59-75).
- **[Hoppscotch](https://github.com/hoppscotch/hoppscotch/blob/main/README.md):** features are left-aligned paragraphs, "❤️ **Lightweight:** Crafted with minimalistic UI design." (lines 48-75); a `<sub>` credit line in the centered header (lines 23-29).
- **[Twenty](https://github.com/twentyhq/twenty/blob/main/README.md):** feature descriptions are baked into the images; the cells of a two-column `<table>` hold only the picture and a centered one-line link (lines 96-151). The table borders show, which is the cost of this pattern.
- **[Immich](https://github.com/immich-app/immich/blob/main/README.md):** one centered `h3` sentence (line 14), features as a Markdown table (lines 74 onward).
- **[Supabase](https://github.com/supabase/supabase/blob/master/README.md), [Payload](https://github.com/payloadcms/payload/blob/main/README.md):** features as a plain left-aligned list (Supabase lines 5-16 as a checklist, Payload lines 84-101).

**What they share (inference):** nobody wraps a centered sentence by hand. Centered text is either a single short sentence or a short stack of whole sentences, one per line. Anything longer than a sentence is left-aligned prose or a list. Where text sits next to images, it is either very short (a one-line link) or baked into the image.

## Patterns for GoodWatch

All three keep the existing badge and centered `h3`. Example section: "One score you can trust" with `.github/readme/clips/score.avif`.

### A. One centered sentence (recommended)

```html
<p align="center"><img src="https://shieldcn.dev/badge/Score-fbbf24.svg?logo=lu:Star&size=xs" alt="Score"></p>
<h3 align="center">One score you can trust</h3>
<p align="center">IMDb, Rotten Tomatoes, Metacritic, and TMDB in one&nbsp;number.</p>
<p align="center"><img src=".github/readme/clips/score.avif" alt="One score you can trust: a scene from the GoodWatch intro" width="62%"></p>
```

- 58 characters, 464 px: one line on desktop, narrower than its 520 px picture; two lines on phones (measured widths of the sentence; phone wrap is inference from the 324 px column).
- `&nbsp;` before the last word stops a one-word orphan when a phone wraps it.
- Generator change: drop `lines()` and `MAX_LINE`, emit the text as is, and fail the build when a description is over 65 characters.
- "Critics count half, audiences the other half" leaves the README. It is still on /how-it-works, which the README links.

Draft one-liners for all sections (owner copy pass needed), with measured widths at 16 px:

| Section | Draft | Chars | px |
|---|---|---|---|
| Why GoodWatch (two `<p>`s) | You have more services than ever and still spend the evening scrolling. | 71 | 529 |
| | GoodWatch finds the few titles that fit your taste and your evening. | 68 | 503 |
| One score you can trust | IMDb, Rotten Tomatoes, Metacritic, and TMDB in one number. | 58 | 464 |
| Where it streams | 325 services in 139 countries, and which of yours has it tonight. | 65 | 475 |
| Picked for your taste | Rate what you loved. Your match shows how well everything else fits. | 68 | 517 |
| Your taste fingerprint | Your ratings draw a fingerprint across 74 attributes. Tune it anytime. | 70 | 512 |
| Search by mood | Type the evening you want, like "cozy mystery with a twist". | 60 | 442 |
| From everything to tonight | From 1.5 million titles to a few: on your services, unseen, and highly rated. | 77 | 556 (too long; trim) |
| A map of how movies feel | Islands of titles that feel alike. Mix two to see what they share. | 66 | 465 |
| Every episode at a glance | A ratings grid shows where a show peaks and where it drops off. | 63 | 483 |
| It keeps track for you | Your Wishlist and shows in one place, with a heads-up when one starts streaming. | 80 | 614 (too long; trim) |
| Bring your ratings | Import from IMDb, Letterboxd, Trakt, Plex, and more. | 52 | 400 |
| Use with AI | Ask ChatGPT, Claude, and other AI apps what to watch tonight. | 61 | 471 |
| Discord bot | Type `/watch` for a pick, or let everyone vote on what to watch together. | 71 | 527 |

For the intro, two separate `<p align="center">` elements (one sentence each) beat one paragraph with `<br>`: each wraps on its own on a phone, and the 10 px paragraph gap marks the sentence end. The 1.5 million and 325-services facts already appear in the Discover and Streaming sections, so the intro doesn't need them.

### B. Centered one-liner plus a `<sub>` fact line

```html
<h3 align="center">One score you can trust</h3>
<p align="center">IMDb, Rotten Tomatoes, Metacritic, and TMDB in one&nbsp;number.<br>
<sub>Critics count half, audiences the other&nbsp;half.</sub></p>
```

- `<sub>` renders at 75% (12 px), the same color, and is the caption idiom in Hoppscotch and LobeHub (sources above). Each line is a whole sentence, like Ghostty's tagline.
- The cost: a `<br>` again. The main line still wraps on phones, giving three lines of mixed size there (inference). And 12 px text sits low (`bottom: -0.25em`) with `line-height: 0`, which reads as fine print, not as a description.
- Use only if a section truly needs a second fact.

### C. Left-aligned text under the heading

```html
<h3>One score you can trust</h3>
<p>IMDb, Rotten Tomatoes, Metacritic, and TMDB in one number. Critics count half, audiences the other half.</p>
<p align="center"><img src=".github/readme/clips/score.avif" alt="One score you can trust: a scene from the GoodWatch intro" width="62%"></p>
```

- This is how LobeHub, AFFiNE, Hoppscotch and tldraw show feature prose. Ragged-right text is the normal reading shape, so two sentences can stay.
- The cost: it breaks the centered composition under the banner. With pictures at 60-86% width and centered, the text's left edge doesn't line up with the picture's (inference). It looks right only if the badge, heading and text are left-aligned too and the pictures are `width="100%"`.

## Elements to avoid for feature text

- **Two-column tables (text beside picture):** borders and row stripes are drawn by GitHub's CSS in both themes, and `border="0"` is stripped (API, CSS lines 702-719). Tables don't stack on phones; they scroll sideways (CSS lines 333-339).
- **Floated pictures (`align="left"` + `hspace`, variant B in `make-variants.py` lines 99-106):** kept by the sanitizer, but at a 324 px phone column a 52% picture leaves about 140 px for text beside it (inference from measured column width).
- **Alerts:** colored callouts with icons, and GitHub Docs asks for one or two per page and none in a row (Docs line 426). Eleven would look like warnings.
- **Blockquotes:** gray text with a bar, which reads as a quote.
- **`<dl>`:** `dt` renders italic and bold, `dd` is indented; there's no way to center it nicely.
- **`<figure>`/`<figcaption>`, `<small>`, `<center>`:** stripped (API).
