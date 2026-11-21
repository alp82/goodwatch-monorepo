# Explore rethink: ship notes

These notes go with the push of branch `explore-ship` to `main`. The design and the full scope are in
[`spec.md`](spec.md). The lab that led to it is recorded in `docs/prototypes/explore-lab/`.

## What ships

- **Browse:** the hub (`/movies`, `/shows`, `/all`), the index pages (moods, genres, decades, countries, streaming,
  tropes), every single place page (mood, genre, decade, country, service, trope, theme, style), and every blend
  (`/movies/moods/cozy/comedy`, `?with=`).
- **Top:** `/<kind>/top` replaces `/<kind>/best`, as a poster ranking with dials. The all-time list leaves out titles
  from the current and previous year. "Best" reads "Top" everywhere a visitor sees it.
- **Navigation:** Explore's row is Browse, New, Hot, Top, Awards, People, Map, Discover. Browse pages carry the row
  with the Movies & Shows control and the family tabs.
- **Redirects:** every old Explore and category address, `/best`, `/explore/...`, `/tv-shows/...`, trait addresses,
  `?when=` and `?from=` answer one 301 to their final address.
- **Search engines:** single places and two-part blends with enough titles are indexable and self-canonical. Blends of
  three or more parts, `/all`, theme and style pages, and thin pages are `noindex, follow`. The new
  `/sitemaps/sitemap_browse.xml` is built by the site; `sitemap_categories.xml` is gone (410).
- **Mood rules:** ten of the 16 moods have tighter rules (`app/domain/moods.ts`). They also change what Discover's mood
  filters, Tonight, Watch next, and YepWatch pools return.

## What deploys with it

1. **Webapp:** the Coolify deploy that follows the push.
2. **Windmill:** CI pushes `main` to the workspace (`push-windmill-workspace.yml`). The changed
   `f/seo/regenerate_sitemaps` no longer builds category sitemaps. Check that run succeeds, because the old script calls
   the removed category builder.
3. **Caches that fill on first use** (shared Redis, nothing to migrate): `browse-trope-members-v1`,
   `browse-streaming-counts-v1`, `browse-streaming-countries-v1`, and `browse-page-<name>-v1`. The very first trope
   load after the deploy reads Crate once (a few seconds); later refreshes run in the background.
4. **Title snapshot:** the next snapshot build applies the new mood rules. Snapshot mood bits are append-only and no key
   changed, so no migration is needed.

## How to verify after the deploy

- `curl -sI https://goodwatch.app/movies/best` answers 301 to `/movies/top`. An old category address such as
  `/movies/moods/nostalgic` answers 301 to `/movies/moods/cozy`.
- These answer 200: `/movies`, `/all`, `/movies/moods`, `/movies/moods/cozy`, `/movies/moods/cozy/comedy`,
  `/movies/genres`, `/movies/decades/1990s`, `/movies/countries/japan`, `/movies/streaming/us`,
  `/movies/streaming/us/netflix`, `/movies/tropes`, `/movies/tropes/final-girl`, `/movies/top`, `/all/top`.
- `/all/moods/cozy` carries `noindex, follow`. `/movies/moods/cozy` carries a self canonical.
- `/sitemaps/sitemap_browse.xml` lists a few thousand URLs, none under `/all`.
- `node goodwatch-webapp/scripts/browse-crawl.mjs --origin https://goodwatch.app` finds no 404 and no internal link
  that redirects.
- Watch the server logs for `PlacesNotReady` 503s after a restart; they stop once the snapshot has loaded.

## Rollback

Revert the merge commit on `main` and push; Coolify redeploys the previous build. The Redis cache names are new, so the
old build ignores them. Old addresses work again as soon as the old build is live; the new addresses then answer 404,
so a rollback should be short. Revert the Windmill script with the same commit (CI pushes it).
