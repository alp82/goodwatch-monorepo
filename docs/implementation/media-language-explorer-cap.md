# Media language: the Explorer's localization cap

Measured 2026-10-15 for item 5 of #592. Before this change, Explorer responses localized at most 200 unique titles
and left the rest in English. The cap is now 800 (`EXPLORER_OVERLAY_MAX_TITLES` in
`goodwatch-webapp/app/server/explorer/http.server.ts`). The same constant covers the page's SSR and every
`/api/explorer/*` endpoint.

## What the world holds

These are anonymous `POST /api/explorer/world` requests to production. The page itself makes this request. Unique
titles are counted by title key across every island of every map.

| Who | Maps | Title cards | Unique titles | Localized at 200 |
|---|---:|---:|---:|---|
| A new guest | 6 | 768 | 502 | Mood all, Theme 107 of 168 cards, the rest 24 to 44 cards each (40%) |
| A guest with ten ratings | 7 | 1,166 | 704 | Mood all, every other map 20 to 60 cards (28%) |

Mood is the first map and the default grouping. At 200, any other grouping a visitor switched to showed mostly
English titles and posters. Island trees and combinations stay under 200 with the default branching
(5 first posters × 43), and a card is a single title, so the cap only binds on the world and map payloads.

## What 200 titles cost

The overlay reads in batches of 200 unique titles (`OVERLAY_BATCH_SIZE`). Each batch is a Redis MGET, and on a
cache miss it is one canonical statement, then the translation and poster statements in parallel. Batches run one
after another. The source cache lasts 30 minutes for each title and locale.

| Request (new guest) | TTFB |
|---|---|
| English, 5 runs | 442 to 747 ms (about 450 once warm) |
| `displayLanguage=de`, 5 runs, warm | 486 to 766 ms (about 40 to 80 ms over English) |
| `pl` and `ko`, first request | 685 and 662 ms (about 200 ms over English, cold) |
| `pl` and `ko`, second request | 493 and 484 ms |

The wire cost is small: 200 localized titles add 9 KB gzipped (55.5 to 64.4 KB) to the guest world, because the
presentation objects repeat and compress well.

## The choice

The cap now covers both measured worlds: 502 titles take 3 batches and 704 take 4. Expected cost at 704 titles:

- Warm: about 3 more batches, roughly 120 to 240 ms over today's localized response.
- Cold: up to about 600 ms more on the first request per locale in each 30-minute window.
- Wire: about 23 to 32 KB gzipped over the English world, 14 to 23 KB over today.

Lazy localization would mean fetching `/api/explorer/map?grouping=X` with the display language when a visitor
switches grouping, and merging those titles into the world's query data. That is more code and a second request
on every switch, so it was not built. If the warm latency shows up in the Explorer's timings, the next cheap step
is to run the overlay's batches concurrently in `createMediaOverlay`. That costs more Crate load at once, so it
should wait for the owner.

Titles beyond 800 still stay canonical, and their canonical fallback is unchanged.
