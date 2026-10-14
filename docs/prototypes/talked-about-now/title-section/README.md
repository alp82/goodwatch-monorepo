# Prototype: "Talked about now" on a title page, every source side by side

Ticket [542](https://github.com/alp82/goodwatch-monorepo/issues/542), under map [537](https://github.com/alp82/goodwatch-monorepo/issues/537). Throwaway: it stays on its branch and never goes to `main`.

**Question:** how should social content look on a title page, and what does each source cost?

**Owner review page:** [`review.html`](review.html) (self-contained, screenshots embedded).

## Run it

```sh
cd goodwatch-webapp
npm ci && npx patch-package          # once, in a fresh worktree
REC_TASTE_MATCH=on REC_FILTER_BAR=on REC_WATCH_NEXT=on REC_TASTE_PAGE=on REC_EXPLORER=on REC_NAVIGATION=on REC_AGE_FILTER=on REC_TRACKING=on \
  npx remix vite:dev --port 3142
```

Then open <http://localhost:3142/prototype/title-section>. The route needs no `.env`: run it without one (or with every key blanked), so nothing reaches production Crate or Valkey.

| URL parameter | Effect |
|---|---|
| `variant=rail` (default) | One mixed horizontal rail |
| `variant=grouped` | A grid grouped by platform, "Load all" per platform |
| `variant=featured` | One featured video, a feed of posts and headlines beside it |
| `variant=lab` | Every source side by side with its measured cost |
| `sources=youtube,bluesky,news` | Only these sources (the panel's toggles write this) |
| `only=<source>` | One source (what the measurement uses) |
| `panel=0`, `switcher=0` | Hide the prototype's floating panel and variant bar |

`←` / `→` switch the variant. The pink panel (bottom right) lists the third-party hosts the page has contacted, split into the ones the title page uses anyway (TMDB artwork, analytics) and the ones the embeds brought: it stays at **0** until a facade is clicked.

## What is in it

- `goodwatch-webapp/app/routes/prototype.title-section.tsx`: the route. Its loader returns Resident Evil (2026) exactly as goodwatch.app's title page loader served it on 14 Oct 2026 (`title-page.json`), so the real page renders without services.
- `goodwatch-webapp/app/ui/prototype-title-section/`
  - `page.tsx`: a copy of the real `Details` page with one slot between the fingerprint and the rest, the state panel and the switcher.
  - `social.ts`: the section's content, in memory. Real public posts: the title's own YouTube videos and Shorts (from GoodWatch's TMDB data), Deadline/Polygon on Bluesky, a mastodon.social post from the #ResidentEvil tag, and the articles behind them. TikTok, Instagram, Threads, Facebook and Reddit are hand-picked sources on the map and hand-picking is not built, so their players show the vendors' documented public samples (from ticket 538), tagged **sample**.
  - `embeds.tsx`: one facade and one official player per source.
  - `layouts.tsx`: the four variants.
  - `costs.json`: the measurement below, shown in the lab variant.
- `measure.mjs`, `shots.mjs`, `build-review.py` here: the cost measurement, the screenshots and the review page.

## Rules the facades follow

- Before the click no request goes to any third party: text, plus the title's own TMDB artwork for video items (the title page loads image.tmdb.org anyway). No `i.ytimg.com` thumbnails.
- The click is the consent for that one item; the button says which company it loads and that it may set cookies. Per-vendor consent is a parallel prototype.
- YouTube loads from `youtube-nocookie.com` with `strict-origin-when-cross-origin`. Shorts get a 9:16 frame instead of oEmbed's 113×200. TikTok uses Player v1, not oEmbed.
- Threads did not render on 14 Oct 2026: `threads.com/embed.js` answered HTTP 500 (also to `curl`), so its facade falls back to the "View on Threads" link.
- Bluesky authors with `!no-unauthenticated` are left out, and so are Mastodon authors who are not discoverable (shown in the panel and the lab's "Left out" box). Bluesky and Mastodon facades show the post's own text (open networks); for Meta, TikTok and Reddit the facade shows GoodWatch's own line, since Meta's oEmbed data may only render the embed.
- News headlines are links: no third party before or after.

## Measuring

```sh
PLAYWRIGHT=<folder with playwright-core> BASE=http://localhost:3142 RUNS=3 node measure.mjs > costs.json
PLAYWRIGHT=<folder with playwright-core> BASE=http://localhost:3142 OUT=shots node shots.mjs
python3 build-review.py costs.json shots review.html
```

`playwright-core` is not a repo dependency: install it in a scratch folder (`npm i playwright-core`) with Chromium at `/usr/bin/chromium` (or `CHROMIUM=`).
