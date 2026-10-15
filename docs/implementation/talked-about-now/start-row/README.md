# "Talked about now" on the start page

Implements [#557](https://github.com/alp82/goodwatch-monorepo/issues/557), variant E of
[#541](https://github.com/alp82/goodwatch-monorepo/issues/541) (prototype: branch `ghostex/d9970ebd`,
`/prototype/start-row?variant=E`), part of [the Talked about now map](https://github.com/alp82/goodwatch-monorepo/issues/537).

A board of the eight titles read about most on Wikipedia against their own 28-day usual, each with its 14-day curve,
"×N its usual", the reason of the day (a trailer, a premiere, a season, Netflix's Top 10) and one line of what is said
about it. One title is featured beside the board, large, with its curve and up to three pieces as they are on their
platforms: the best-ranked of what was judged worth showing, whatever its source; none when nothing was. Pressing a row features that title. From 1024 px the
featured title stands beside the board; on a phone it opens in the board, under its row. The row is the same for every
visitor.

## Behind a flag

`TALKED_ABOUT_NOW_ROW=off|preview|on`, default off: the `row` surface of the map's flag module
(`app/server/talked-about-now/flags.server.ts`, from #558, whose title section is `TALKED_ABOUT_NOW_TITLE`). Preview
shows it only to the members in `TALKED_ABOUT_NOW_PREVIEW_USERS` (Supabase user ids, separated by commas), the same
list for both surfaces. Read on every request, so a container restart applies a change. With it off, the start page is
byte for byte what it was, and `/api/talked-about-now` answers 404.

## The start page stays as it was

- **HTML:** the loader adds one field, `talked: true`, only while the feature is on for the viewer. A guest's HTML is
  still the same for every guest, so the page cache keeps it as before.
- **First view:** the room. The row's slot (`ui/talked-about-now/start-row/StartRowSlot.tsx`, at the top of the section
  below the room in `BelowRoom.tsx`) waits until the page is open below the room (`<html data-lr="open">`,
  `use-below-room.ts`) and the slot is within half a window of the screen. Then it asks for the row's chunk and its
  data together. The row's code, its stylesheet (`start-row.css`, plain CSS, so the global Tailwind sheet doesn't
  grow) and the shared facade (`ui/social-embed`) are in that chunk.
- **Data:** `GET /api/talked-about-now` (`routes/api.talked-about-now.ts`). The server keeps one answer for every
  visitor for 10 minutes (`server/talked-about-now/start-row.server.ts`), and a failed read for one.

### Measured

Two production builds on 14 October 2026, this branch against its base (`8b3080ec`, #558), both with the same
`SENTRY_RELEASE`. The start page's first-view files are the client manifest's entry, `root` and `routes/_index` with
their imports.

| | Base | This branch |
| --- | --- | --- |
| First-view scripts | 10 files, 206,128 B gzip | 10 files, 206,583 B gzip (+455) |
| The start page's chunk (`_index`, the room) | 81,486 B raw, 27,882 gzip | 82,640 B raw, 28,350 gzip (+468) |
| The shell chunk, every page | 131,923 B raw | 131,923 B raw (the same) |
| `tailwind-*.css`, `living-room-*.css` | `tailwind-Dkit0sTB.css`, `living-room-BQaOAR4z.css` | the same files, byte for byte |
| Row files in the first view | | none |

The growth is the slot: it decides when to load the row. The row loads on its own: `StartRow-*.js` (10.5 KB raw,
4.0 KB gzip) and `StartRow-*.css` (7.6 KB raw, 2.2 KB gzip). The home's script limit is 202,752 B; the last production
runs measured 192,965 B (`docs/benchmarks/viral-spike-render-path-budget.md`), so `budget.json` stays as it is.

The request helper is part of the slot module on purpose. As a module of its own, imported by the slot and the row, it
went into the shell chunk that every page loads (rule 3 in `vite.config.js`).

## The read

`server/talked-about-now/start-row.server.ts`; the rules are in `domain/talked-about-now.ts`.

1. `SELECT day, payload FROM doc.buzz_snapshot WHERE snapshot_key = 'current'`, as
   [buzz-score.md](../buzz-score.md) hands it to the start page. Its eligible titles, most lifted first, the first
   eight. No snapshot, or none eligible: no row.
2. The day before's dated snapshot (key = the ISO day), for each title's move (`▲3`, `NEW`). Missing: no moves.
3. The titles' backdrops and years through `getDisplayFields`, as every card reads them.
4. One read of the visible links of the eight titles to their posts, with the filters of social discovery's reference
   read (`Store.read_title` of #556, `docs/implementation/talked-about-now/social.md`): a passing content-quality
   verdict (`social_content_quality`, `status = 'pass'`, `version = 'content-quality-1'`, the post's current
   `content_hash`), as an inner join from `contentQualityJoin` in `social-store.server.ts`, and a `keep` relevance
   verdict for the link (`social_relevance`, `version = 'relevance-1'`, the post's current `content_hash`), an inner
   join from `relevanceJoin` beside it; both the same as the title section's read. No reported (open or confirmed),
   hidden, deleted, outdated (content hash) or expired (30 days) link, no lane in `SOCIAL_DISABLED_LANES`, one of each
   duplicate group per title (the verdict's `dup_group`, else the link's `duplicate_group`), the best-ranked by the
   verdict's `score`. If the tables are missing (the relevance table too), empty or refuse the read, the titles show
   without what is said: never pieces without a verdict.

A title's pieces (`pickItems`, see [relevance](../relevance/README.md)): the best-ranked by score, at most three, at
most one video and one of each duplicate group. No source has a place of its own and nothing fills a gap: a title whose
links were all dropped shows none. Between equal scores an English piece comes first (the start page is in English),
then the newer. The board's preview line is the best-ranked piece, whatever its kind.

Whether a piece reads as English is a guess on the server (`isEnglish`): short words common in English against short
words common in German, Spanish, French, Italian and Portuguese, accents, and non-Latin scripts. An article from a
`.de` address is never English. A headline with none of those words ("Bob Odenkirk Mourns ‘Breaking Bad’ Co-Star")
counts as English. Social discovery stores no language, so there is nothing better to read yet.

The UI names the source and the window ("Wikipedia reading on 13 Oct against each title's 28-day usual"), as #540
asked: the signal measures reading, not conversation.

## Click to load

The pieces are the title page's facade (`ui/social-embed/SocialEmbed.tsx`, #558). Before a press nothing reaches a
third party: a video shows the title's own TMDB backdrop, a post its stored text, and a headline is a link to the
publisher. `shots.mjs` checks this: before the press the only other host is `image.tmdb.org`. After the press
`www.youtube-nocookie.com` loads.

## The height of the featured title and the board

In the prototype the featured title was about 960 px tall on a desktop, and the board 810 px. Here the two stretch to
the taller one. When the featured title is taller, the board's rows share the extra height. When the board is taller,
the featured title's picture takes it. Measured on 14 October 2026 at 1440 × 900 with production data: 876 / 876 px
with Narnia featured, and 809 / 809 px with Breaking Bad featured.

## Run it and check it

A dev server on production Crate (read-only) with no Valkey and no `.env` in the worktree, from `goodwatch-webapp/`:

```sh
set -a; . <main checkout>/goodwatch-webapp/.env; set +a
REDIS_HOST= REDIS_HOST2= REDIS_HOST3= REDIS_PORT= REDIS_PASS= TALKED_ABOUT_NOW_ROW=on \
  npx remix vite:dev --port 3161 --strictPort
```

Open `/#browse`. Without the title snapshot (Valkey) the section below the room has no start titles; the row doesn't
need them.

`PLAYWRIGHT=<folder with playwright-core> BASE=http://localhost:3161 node shots.mjs <out dir>` takes the desktop and
phone screenshots, measures the two heights, checks that a fresh visit asks for nothing of the row, and checks that
nothing reaches a third party before a press.

`shots/` has the row at 1440 × 900 (`desktop.png`) and at 390 × 844 on a phone (`phone.png`), taken on 15 October
2026 with the board of the day and `SOCIAL_FIXTURE=../relevance/fixture.json` (production has no relevance table yet),
and the script's `report.json` from that run.

With `SOCIAL_FIXTURE` set (development only), the board's pieces come from that file through the fixture store, the
same filters as the title section's read of it; the ranking still comes from Crate.

Tests: `node --test app/domain/talked-about-now.test.ts app/server/talked-about-now/start-row.test.ts`.

## After merge

- Set `TALKED_ABOUT_NOW_ROW=preview` and the owner's id in `TALKED_ABOUT_NOW_PREVIEW_USERS` in Coolify, and restart.
  Then `on`.

## A "wrong title?" report

`forgetTalkedAboutNow()` is one of the resets in `afterReport` (`title-social.server.ts`), which `reportWrongTitle`
runs before it answers: the process that took the report reads the row again on its next request. Another process
keeps its answer for up to its 10 minutes. The route asks for 5 minutes plus 5 stale in shared caches, but
`applyCachePolicy` turns a guest's data request into `private, max-age=0` unless a front cache named the cache
identity, so a browser asks again each time.
