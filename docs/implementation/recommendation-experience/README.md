# Recommendation experience implementation

This spec describes how to take the recommendation redesign from its accepted prototypes to production: one shared
filter bar, taste match on every card, Watch next, a three-tab Taste page, one page for Discover and Search, the
Explorer map, and the new site navigation. It also defines the storage and modules they share, the performance
budgets, the rollout, and the issue breakdown.

Status: approved by the owner on September 27, 2026 ([#193](https://github.com/alp82/goodwatch-monorepo/issues/193)),
with the answers recorded in [Owner answers](#owner-answers). The implementation issues are listed in
[Issue breakdown](#issue-breakdown).

Sources:

- The map, [#172](https://github.com/alp82/goodwatch-monorepo/issues/172), and its closed decision tickets:
  [#173](https://github.com/alp82/goodwatch-monorepo/issues/173) research,
  [#174](https://github.com/alp82/goodwatch-monorepo/issues/174) taste match,
  [#175](https://github.com/alp82/goodwatch-monorepo/issues/175) filter bar,
  [#176](https://github.com/alp82/goodwatch-monorepo/issues/176) Watch next,
  [#177](https://github.com/alp82/goodwatch-monorepo/issues/177) Taste,
  [#179](https://github.com/alp82/goodwatch-monorepo/issues/179) Discover and Search,
  [#180](https://github.com/alp82/goodwatch-monorepo/issues/180) Explorer,
  [#181](https://github.com/alp82/goodwatch-monorepo/issues/181) fingerprint view,
  [#192](https://github.com/alp82/goodwatch-monorepo/issues/192) navigation.
- The prototypes on the branch
  [`prototype/recommendation-experience`](https://github.com/alp82/goodwatch-monorepo/tree/prototype/recommendation-experience)
  (commit `5c5e0506`, pushed to origin). Implementers read the prototype code there with `git show` or
  `git worktree add`; it is never merged. The final rounds are
  `/prototype/rec-filter-bar-2`, `/prototype/rec-watch-next-8` (with round 7's mood rules),
  `/prototype/rec-taste-6?variant=bridge`, `/prototype/rec-discover-4?variant=flip`,
  `/prototype/rec-explorer-9?variant=preview` (with round 7's sea), and `/prototype/rec-nav?variant=hub`.
- Research: [competitive patterns](https://github.com/alp82/goodwatch-monorepo/blob/research/recommendation-experience/docs/research/recommendation-experience/competitive-patterns.md)
  and [taste match for any 100 titles](https://github.com/alp82/goodwatch-monorepo/blob/research/taste-match/docs/research/recommendation-experience/taste-match/README.md).
- Glossary: [CONTEXT.md](../../../CONTEXT.md). This spec uses its terms: Watch next, Tonight's pick, Seen, Not seen
  yet, On my services, Mood, Taste, Taste match, For you, Side of you, Fingerprint family, You vs everyone, Explorer,
  Island, and Bridge.

## Contents

- [Goal](#goal)
- [Decisions](#decisions)
- [Scope and the Living room boundary](#scope-and-the-living-room-boundary)
- [Architecture](#architecture)
- [Storage](#storage)
- [Modules and interfaces](#modules-and-interfaces)
- [Routes and API](#routes-and-api)
- [Surfaces](#surfaces): [filter bar](#shared-filter-bar), [title cards](#title-cards),
  [Watch next](#watch-next), [Taste](#taste), [Discover and Search](#discover-and-search), [Explorer](#explorer),
  [navigation](#navigation)
- [Guests and members](#guests-and-members)
- [Performance budgets](#performance-budgets)
- [Explorer rendering fallbacks](#explorer-rendering-fallbacks)
- [Accessibility and reduced motion](#accessibility-and-reduced-motion)
- [Rollout](#rollout)
- [Cleanup of replaced code](#cleanup-of-replaced-code)
- [Production verification](#production-verification)
- [Owner answers](#owner-answers)
- [Issue breakdown](#issue-breakdown)

## Goal

Every surface where people look for something to watch builds in the same three things: On my services, Not seen yet,
and taste match. A Watch next view of the Wishlist is one tap away from any page. Taste shows people their taste in a
way that is useful on every visit, and Explorer lets them browse by moving across a map. The experience must stay
fast: taste match costs no per-request Qdrant or Crate call, and no request waits on a query anywhere near Crate's
10-second timeout.

Today only the members' start-page row "Recommended for you" is personalized, and it sends up to 50 liked and 50
disliked titles to Qdrant's recommend API on every call. Taste is an unlock ladder of statistics that feed nothing.
Hide seen exists only in Discover and ignores ratings. The Wishlist has no working streaming filter.

## Decisions

The owner made these decisions on the map between September 26 and 27, 2026. Each links to its resolution.

1. **Filter bar** ([#175](https://github.com/alp82/goodwatch-monorepo/issues/175#issuecomment-5846473781)). Desktop is
   the studio row: On my services, Not seen yet with the number of titles it hides, a fixed-width sort, and a Filters
   side sheet with search, grouped sections, per-option counts, and a live "Show N titles". A sub-bar shows removable
   chips and the hidden-titles insight ("31 showing, 53 hidden") with the biggest one-tap recoveries. Mobile is the
   slab: the filter strip merges with the bottom navigation.
2. **Taste match** ([#174](https://github.com/alp82/goodwatch-monorepo/issues/174#issuecomment-5845568014)). Title
   fingerprints live in webapp memory as `uint8`. Each member's taste vector (`2P - N` over all ratings, score
   weighted, Want to See at 0.5) and quantile table live in Redis and are rebuilt after each rating. Guests' vectors
   are built per request. The match shown is `round(50 + 0.49 * percentile)`. Qdrant and Crate stay off the card path.
3. **Watch next** ([#176](https://github.com/alp82/goodwatch-monorepo/issues/176#issuecomment-5854483935) and its
   [addendum](https://github.com/alp82/goodwatch-monorepo/issues/176#issuecomment-5854937535)). One interest signal,
   Want to See. No manual order. The person picks a sort, Best match by default. Up to three data-derived moods. On my
   services is on by default. Desktop has a docked strip and a mood grid dropdown; mobile has one drawer per slab
   button. Watch next gets its own menu item. Guests see a sign-up call to action on taste-dependent features.
4. **Taste** ([#177](https://github.com/alp82/goodwatch-monorepo/issues/177#issuecomment-5850466380), Sides layout
   [pick](https://github.com/alp82/goodwatch-monorepo/issues/177#issuecomment-5857275777)). Three tabs: Sides of you
   (the chosen layout: contradiction headline, sides picked from poster chips, "You're here" then "Just past it", then
   "More of this" on the person's services), You vs everyone, and Fingerprint (five fingerprint families, from
   [#181](https://github.com/alp82/goodwatch-monorepo/issues/181#issuecomment-5850159094)). The unlock ladder goes.
5. **Discover and Search** ([#179](https://github.com/alp82/goodwatch-monorepo/issues/179#issuecomment-5850466578),
   transition [pick](https://github.com/alp82/goodwatch-monorepo/issues/179#issuecomment-5857275893)). One page.
   Cards carry a taste-match pill under the GoodWatch score. For you is an on/off switch, on by default, that applies
   to any sort; on a search it moves a result at most 5 places. The taste explanation and the search's "Read as" line
   render as small colored chips. The browse and search lists swap with the glide transition (about 260 ms).
6. **Explorer** ([#180](https://github.com/alp82/goodwatch-monorepo/issues/180#issuecomment-5856685222)). An islands map
   with the grouping chosen up front, WebGL2 with WebGL1 and Canvas 2D fallbacks, lit posters with distance-based
   detail, proximity cards, and combining islands by preview (a bridge forms between them and takes focus). The page
   never scrolls.
7. **Navigation** ([#192](https://github.com/alp82/goodwatch-monorepo/issues/192#issuecomment-5857275514)). Mobile: a
   dock with Tonight's pick, a hub key that opens a remote-style sheet, and Search. Desktop: a Browse button whose
   panel mirrors the sheet. The search entry is an omnibox with its shortcut; it opens a command palette whose first
   suggestion is "Search for …".
8. **Defaults** (map notes, September 26, and [#193](https://github.com/alp82/goodwatch-monorepo/issues/193)). Not
   seen yet hides titles the person watched, rated, or marked Not interested (skipped). On my services is on by default
   for members with saved services, with one tap to widen to everywhere.
9. **Out of scope** (owner, September 27): watch-history import, "new on your services" and "leaving soon" rows, a new
   recommendation model, query-relevance changes to the search ranker beyond blending in taste, share lists, public
   profiles, and native apps.
10. **Spec answers** ([#193](https://github.com/alp82/goodwatch-monorepo/issues/193), September 27): the owner's
    answers to the spec's open questions, recorded in [Owner answers](#owner-answers) and applied throughout.

## Scope and the Living room boundary

The start page becomes the Living room. Its room, remote, TV screens, rendering, and production build are specified
and built under their own tickets ([#178](https://github.com/alp82/goodwatch-monorepo/issues/178),
[#186](https://github.com/alp82/goodwatch-monorepo/issues/186) to
[#191](https://github.com/alp82/goodwatch-monorepo/issues/191)). This spec covers everything else and only these
integration points with it:

- **Entry links.** The Living room's feature keys and its "Or open" row open the routes in [Routes and API](#routes-and-api):
  Watch next (the remote key reads "Watch now"), Taste, Discover, and Explorer. Guests pressing Watch now get the same
  sign-up card this spec defines for Watch next.
- **Tonight's pick.** The navigation dock and the Living room's TV use one server function and one endpoint,
  `GET /api/tonight` (see [Tonight's pick](#tonights-pick)). The TV's "three picks" screen extends it; it doesn't
  fork it.
- **Home.** The hub sheet's and the Browse panel's Home entry goes to `/`, whatever the start page is at the time.
- **Shared modules.** The Living room reuses this spec's taste, mood, availability, and title-card modules for its
  mood picker (moods with Wishlist counts), its three picks, and its guest this-or-that taste. It must not grow its
  own copies.

The old members' home rows (Recommended for you, Your Wishlist, moods, trending) move with the Living room's tickets,
not with this spec. Until the Living room ships, this spec keeps "Recommended for you" working and moves it to one
vector query (see [issue 7](#issue-breakdown)).

## Architecture

```
Windmill (offline)                           Webapp process                              Browser
------------------                           --------------                              -------
title snapshot publish ──> Redis chunks ──>  title snapshot (uint8 fingerprints,          filter bar (desktop row, mobile slab)
  (nightly + new batches)   + manifest        facts, genre and mood bits, stats)          title cards with taste-match pill
                                                 │                                        Watch next, Taste, Discover and Search
Crate user_* tables ──────────────────────>  viewer context (seen, Wishlist with          Explorer: map engine + sea renderer
  (ratings, Want to See, watched, skipped)     added-at, services, country)                 (WebGL2 | WebGL1 | Canvas 2D)
                                                 │                                        dock, hub sheet, command palette
Redis taste:<user> <─── rebuild after write ─ taste (member vector + quantiles in Redis,
                                               guest vector per request)
Crate streaming_availability ─── background ─> availability index (per country, in memory)
                                                 │
                                              title filter (filters, sorts, facet counts,
                                               recoveries, For you blend)
                                                 │
Crate movie/show ─── display fields by id ──> title cards (at most one page of ids)
Qdrant ─── search ranking only (unchanged) ──> Discover in search mode
```

The rule of the design: **everything that runs for every card or every filter change runs in webapp memory.** Crate
serves the person's own rows, display fields for one page of titles, and background loads. Qdrant serves search
ranking as today and one vector query for "Recommended for you", and nothing else on a request path.

## Storage

### Title snapshot (new, Redis, written by Windmill)

A compact binary snapshot of every title with a fingerprint, loaded into webapp memory at boot and when its version
changes. It replaces reading `fingerprint_scores` from Crate, which takes about 82 ms for 100 titles and about 2.5
minutes for the whole catalog ([#174](https://github.com/alp82/goodwatch-monorepo/issues/174)).

- **Rows:** every movie and show with a title analysis, about 238,000 on September 27, 2026 (156,463 movies and 81,253
  shows with `fingerprint_scores`).
- **Columns**, stored column by column, little-endian:

  | Column | Type | Notes |
  |---|---|---|
  | point id | `float64` | `makePointId`: movie `1e12 + tmdb_id`, show `2e12 + tmdb_id` |
  | fingerprint | `uint8[74]` | Raw 0 to 10 scores in `CoreScores` order; 255 for a missing key |
  | genres | `uint32` | One bit per genre in a fixed genre table shipped in the manifest |
  | release day | `int32` | Days since 1970-01-01: a film's release date, a show's last air date; `INT32_MIN` when unknown |
  | GoodWatch score | `uint8` | `goodwatch_overall_score_normalized_percent`, 0 to 100; 255 when unknown |
  | votes | `uint32` | `goodwatch_overall_score_voting_count` |
  | popularity | `float32` | TMDB popularity |
  | origin | `uint8` | Index into an origin table in the manifest (first production country, else original language) |
  | flags | `uint8` | Bits: has poster, has backdrop, adult, anime |

  About 100 bytes per title, so about 24 MB in total. Per-title inverse norms, mood bits, and catalog statistics are
  derived in the webapp at load time, not stored.
- **Keys:** `title-snapshot:<version>:<n>` for chunks of at most 1 MB (ioredis keeps a reply buffer of about three
  times the largest value, so 4 MB chunks would push the webapp past its memory budget), and `title-snapshot:current`
  holding a JSON manifest: `{ version, format: 1, count, chunks, sha256, keyOrder, genres[], origins[], builtAt }`, plus
  the publisher's `sourceMark`, which the webapp ignores. `keyOrder` is the 74 fingerprint keys; the webapp refuses a
  snapshot whose key order differs from its own `VALID_FINGERPRINT_KEYS`. `title-snapshot:lock` keeps two publishes
  from running at once.
- **Publishing:** `f/sync/copy/title_snapshot.py` writes all chunks of a new version, then swaps
  `title-snapshot:current`, then deletes the chunks of versions older than the previous one. It runs nightly on a
  schedule, after each fingerprint batch, and on demand (owner, [#193](https://github.com/alp82/goodwatch-monorepo/issues/193)).
  A fingerprint batch reaches Crate and Qdrant through the copies (`f/sync/copy/dna_data.py` and
  `f/sync/copy/vector_data.py`), so each scheduled vector copy starts the publisher, which publishes only when a title
  analysis was added, changed, or removed since the current version; otherwise it exits without a new version
  (default, not yet confirmed by the owner). It compares a mark, per table the count and sum of Crate's
  `dna_updated_at` (two aggregates, well under a second), with the `sourceMark` in the manifest, not the manifest's
  `builtAt`: `dna_updated_at` is the analysis's time in MongoDB, so an analysis the DNA copy brings to Crate after a
  publish would be older than that publish's `builtAt`. It uses its own binary Redis client (`decode_responses=False`).
- **Source** ([#195](https://github.com/alp82/goodwatch-monorepo/issues/195), measured September 27, 2026): Crate alone,
  in pages of 2,000 by `tmdb_id` filtered on `dna_updated_at`, reading the scores from the typed
  `fingerprint_scores['<key>']` subcolumns (237,736 titles; 85 s of page reads over HTTP from a workstation, worst page 3.5 s; a whole local run with the Python client took 152 to 167 s). Reading the whole
  `fingerprint_scores` object took 119 s for the shows alone with pages up to 6.6 s. A Qdrant scroll of
  `fingerprint_v1_raw` took 46 s over gRPC (126 s over REST) but holds 227,150 points, 4.5% fewer than Crate's titles
  with a fingerprint, and its payload lacks popularity, the release day, and the origin, so it would still need the
  Crate read. It runs offline, so it doesn't count against the per-request Qdrant rule.
- **Freshness:** a title analyzed minutes ago shows no taste match and belongs to no mood until the next snapshot.
  That is accepted ([#174](https://github.com/alp82/goodwatch-monorepo/issues/174)).
- **Capacity:** the Redis cluster had no `maxmemory` and 4.57 GB used on the node checked on September 27, 2026. Two
  versions at 24 MB each are small next to that, but the owner confirms the node memory before the first publish
  ([issue 5](#issue-breakdown)).

### Taste vector per member (new, Redis)

- **Key:** `taste:v1:<user_id>`, one per member, under 1 KB. Value (binary or JSON, the ticket picks):
  `{ vector: float32[74] (unit length), quantiles: float32[101], ratings, liked, wantToSee, builtAt, sourceAt,
  snapshotVersion }`. `sourceAt` is the newest interaction timestamp the vector saw.
- **Formula** ([#174](https://github.com/alp82/goodwatch-monorepo/issues/174)): over the unit-length fingerprint
  vectors, `P` is the weighted mean of liked titles (score 6 and up, weight `score - 5`) plus Want to See titles at
  weight 0.5; `N` is the weighted mean of disliked titles (score 5 and below, weight `6 - score`); `taste = 2P - N`,
  or `P` without dislikes, then normalized. Skipped and watched-only titles don't enter the vector.
- **Quantiles:** 101 quantiles of the person's cosine over the reference pool: titles with at least 1,000 votes and a
  poster (58,628 titles when measured). `percentile = interpolate(cosine, quantiles)`, and the match shown is
  `round(50 + 0.49 * percentile)`.
- **Rebuild:** after every committed write to `user_score`, `user_wishlist`, or a guest-progress import, the server
  schedules a rebuild for that person (coalesced, one in flight per person). A rebuild reads the person's ratings and
  Want to See in one Crate statement (9 to 19 ms measured), builds the vector (under 1 ms) and quantiles (about 15 ms),
  and writes the key (about 1 ms). A write also sets `taste:touched:<user_id>` to the write time. A reader that finds
  `sourceAt` older than `touched`, a missing key, or an older `snapshotVersion` rebuilds inline before answering.
- **Minimum signal:** taste match shows from 5 liked titles (rated 6 or more; Want to See doesn't count toward the
  threshold) (owner, [#193](https://github.com/alp82/goodwatch-monorepo/issues/193)). Below it, the key records the
  counts but no vector, and surfaces treat the person as having no taste yet.

### Guest taste (no storage)

Guests' ratings and Want to See live in the browser as shared guest progress (`utils/guest-progress.ts`). Guest-aware
endpoints accept them in a POST body, as `api.guest-recommendations` does today, and build the vector and quantiles in
memory per request (well under 1 ms for the vector; quantiles over the reference pool about 15 ms, so the endpoint
caches them per request body hash for 10 minutes in process). Nothing about a guest's taste is stored on the server.

### Wishlist added-at time (existing column, schema declaration)

Waiting longest and Last added sort by when a title was added to the Wishlist. The prototype used
`user_wishlist.updated_at`; production uses `created_at`.

Checked read-only in production on September 27, 2026: `user_wishlist` has `created_at` and `updated_at`
(`timestamp without time zone`) although `crate_schemas.py` doesn't declare them. All 2,015 rows of 144 members have
`created_at`, which differs from `updated_at` on 3 rows. Adding uses `ON CONFLICT DO NOTHING`, so marking a title
again keeps its first time; removing and adding again starts a new time, which is the intended meaning. Some rows share
one `created_at` (up to 106 rows), which is a guest-progress import or a bulk copy; they sort by title key within the
same time.

So no data migration is needed. The migration ticket ([issue 5](#issue-breakdown)) declares `created_at` and
`updated_at` on the user tables in `crate_schemas.py`, re-checks that no `created_at` is NULL, and fixes any it finds
by copying `updated_at`. It is marked "needs owner to apply".

### Availability index (new, webapp memory)

On my services needs availability for thousands of titles per request. The index holds, per country, a map from point
id to the bitset of subscription services (`flatrate`, `free`, `ads`) that carry the title, with duplicate providers
mapped to their base service through the existing `duplicateProviderMapping`.

- **Load:** one statement per country, `SELECT media_tmdb_id, media_type, streaming_service_id FROM
  streaming_availability WHERE country_code = ? AND streaming_type IN ('flatrate', 'free', 'ads')`. Measured on
  September 27, 2026: Germany returns about 196,000 rows in 546 ms and the United States in 1,127 ms. That is a
  background load, never on a request path.
- **Lifetime:** countries load on first use and refresh every 6 hours in the background. At boot, the countries of the
  most members preload. While a country loads, requests for it filter by the `streaming_availabilities` column of the
  titles on the page (the way Discover does today) and mark the counts as approximate.

### Viewer context (existing tables, one read)

The person's scores, Want to See (with `created_at`), watch history, and skipped titles come from the existing
`getUserData` read, extended to return `created_at` for the Wishlist. Seen is the union of scored and watched titles.
Not seen yet hides Seen titles and skipped (Not interested) titles. Country, saved services, and the For you setting
come from `user_setting`.

### Catalog statistics (derived, webapp memory)

Taste, Explorer, and the explanation chips need per-attribute statistics over a reference pool of popular titles: the
mean and standard deviation of each fingerprint key, the vote-weighted mean z-score ("everyone"), the 75th percentile
threshold per key, and the vote-weighted share of titles at or above it. The webapp computes them from the snapshot
when it loads (74 keys over about 6,000 titles, a few milliseconds). Nothing about other members is aggregated.

### No new Crate tables

This spec adds no Crate table. The only Crate change is the schema declaration above.

## Modules and interfaces

Each module below is deep: callers learn a small interface, and the layout, caching, and refresh logic stay behind it.
Names describe behavior; no prototype round names or variant labels (`rec-`, `-8`, `bridge` as a layout name, `studio`,
`slab`, `hub`, `preview`) carry into file names, identifiers, CSS classes, or cache keys
(see [Rollout](#rollout) for cache-key versions).

### Title snapshot: `app/server/title-snapshot/`

```ts
type TitleKey = number // point id: movie 1e12 + tmdb_id, show 2e12 + tmdb_id

interface TitleSnapshot {
  readonly version: string
  has(key: TitleKey): boolean
  facts(key: TitleKey): TitleFacts | null        // media type, genres, release day, score, votes, popularity, origin, flags, moods
  cosine(key: TitleKey, unitTaste: Float32Array): number | null
  forEach(fn: (key: TitleKey, row: number) => void): void
  readonly stats: CatalogStats                     // per-key mean, sd, everyone-z, threshold, share
  fingerprint(key: TitleKey): Uint8Array | null  // a view, not a copy
}

function getTitleSnapshot(): TitleSnapshot | null // null until the first load completes
```

- Loads the manifest and chunks from Redis at boot, verifies the checksum and key order, builds the id map, inverse
  norms, mood bits, and catalog statistics, then swaps the whole object in one assignment. It polls
  `title-snapshot:current` once a minute.
- Callers never see chunks, byte layouts, or reloads. A failed load keeps the previous snapshot and logs.
- Memory: about 24 MB of columns plus the id map (about 11 MB), about 35 MB in total.

### Taste: `app/server/taste/`

```ts
type Viewer =
  | { kind: "member"; userId: string }
  | { kind: "guest"; progress: GuestProgress } // ratings and Want to See from the browser

interface Taste {
  readonly signal: "none" | "some"          // "none" below 5 liked titles; no vector
  readonly ratings: number
  match(keys: TitleKey[]): (number | null)[] // 50..99, null without a fingerprint or taste
  reasons(key: TitleKey, n?: number): FingerprintKey[] // attributes that most drive the match
  leanings(n?: number): FingerprintKey[]    // the person's strongest attributes against everyone
}

function loadTaste(viewer: Viewer): Promise<Taste>
function markTasteChanged(userId: string): void // called by every write path; schedules the rebuild
```

- One module owns the formula, the Redis key, the rebuild, calibration, and the guest path. Every surface, the
  Living room included, calls `loadTaste` and `match`.
- `reasons` picks the keys with the largest positive `taste[k] * fingerprint[k]` contribution relative to the catalog
  mean, excluding the craft keys the prototypes excluded (direction, acting, cinematography, editing,
  music_composition, dialogue_quality, narrative_structure, rewatchability).
- Write paths call `markTasteChanged` next to their existing `resetUserDataCache` call: `updateScores`,
  `updateWishList`, and `api.import-guest-interactions`.

### Moods: `app/domain/moods.ts` (shared by server and browser)

A pure module: the 11 mood definitions (key, name, one-line description, hue, rule in words, test), `MAX_MOODS = 3`,
and `moodsOf(fingerprint, genres): MoodKey[]`. The rules are round 7's, verbatim:

| Key | Name | Rule |
|---|---|---|
| `funny` | Funny | Highest of situational comedy, wit and wordplay, physical comedy, absurdist humor, satire and parody at least 8, and bleakness at most 5 |
| `feelgood` | Feel-good | Wholesome at least 7, hopefulness at least 7, bleakness at most 3 |
| `romance` | Romance | Romance at least 7 |
| `action` | Action | Adrenaline at least 8 and spectacle at least 7 |
| `scary` | Scary | Scare at least 7, or the Horror genre with scare at least 5 |
| `crime` | Crime & mystery | Mystery at least 8, or crime at least 8 with intrigue at least 8 and spectacle at most 7 |
| `mind` | Mind-bending | Surrealism at least 6, or complexity at least 8 with philosophical at least 7 or non-linear narrative at least 8 |
| `heavy` | Heavy | Pathos at least 8 or melancholy at least 8 |
| `worlds` | Other worlds | Fantasy at least 7 or futuristic at least 7 |
| `history` | History | Biographical at least 6 or historical at least 8 |
| `growing` | Coming of age | Coming of age at least 8 |

- A missing score counts as 0. A title without a title analysis (fewer than 10 keys) belongs to no mood.
- Picking several moods is OR: a title fits if it belongs to at least one picked mood.
- The keys are stable identifiers (they appear in URLs); the names may change. Audit from round 7: over the owner's
  349 Wishlist titles and a pool of 4,500 popular titles, 93 to 94% belong to at least one mood and no pair of moods
  overlaps 0.3 or more (Jaccard).
- The snapshot loader precomputes an 11-bit mood mask per title with this module, so a mood filter is one bit test.

### Title filter: `app/server/title-filter/`

The in-memory engine behind the filter bar on Discover, Watch next, and Explorer.

```ts
interface FilterState {
  type: "all" | "movie" | "show"
  onMyServices: boolean          // false = everywhere
  services?: number[]            // explicit services when onMyServices is false
  notSeenYet: boolean
  moods: MoodKey[]               // up to 3
  genres: string[]
  minScore: 0 | 60 | 70 | 80
  minMatch: 0 | 70 | 80 | 90     // least taste match; doesn't narrow for a person without taste
  released: "any" | "recent" | "2010s" | "2000s" | "before2000"
  similarTo?: TitleKey[]         // resolved to an id set before filtering
  people?: number[]              // cast and crew, resolved to an id set before filtering
  legacy?: LegacyFilters         // old Discover URL filters, resolved to an id set before filtering
}

interface FilterResult {
  keys: TitleKey[]               // passing titles in the requested order
  total: number
  hidden: number                 // universe size minus total
  recoveries: { filter: FilterName; titles: number }[] // titles that only that filter hides, largest first
  optionCounts: Record<FilterName, Record<string, number>> // what each option would leave, others unchanged
  moved?: { key: TitleKey; by: number }[] // For you movement against the plain order
}

function filterTitles(input: {
  universe: Iterable<TitleKey> | "catalog"
  state: FilterState
  sort: SortKey
  forYou: { taste: Taste; surface: "browse" | "search" } | null
  viewer: ViewerContext
}): FilterResult
```

- **One pass for counts.** For each title, the engine computes a bitmask of the filter groups it fails. Titles with an
  empty mask pass. A title with exactly one bit set is the recovery count of that group. Per-option counts come from
  one pass per group over the titles that pass every other group. This is about eight passes over the universe
  instead of one count per option.
- **Universe.** Browse uses the catalog titles that meet Discover's current eligibility (a presentable title,
  votes threshold, no adult). Search passes its ranked list. Watch next passes the Wishlist. Explorer passes its pool.
- **Id-set filters.** Similar to and cast and crew are resolved to id sets before filtering, through the existing
  similar-titles recommend path and a Crate credit read, each cached in Redis for 30 minutes per parameter set. Their
  per-option counts show only for the options already chosen.
- **Legacy filters.** The old Discover filters the new sheet doesn't offer (keywords, age rating, language,
  fingerprint pillars and conditions, suitability, and context) keep working when an old URL carries them, and the sheet
  doesn't show them (owner, [#193](https://github.com/alp82/goodwatch-monorepo/issues/193)). They resolve to one id set
  through the SQL conditions `server/discover.server.ts` builds for them today, cached in Redis for 30 minutes per
  parameter set, and count as one filter group for recoveries. A parameter today's SQL ignores stays ignored. Each active
  legacy filter shows as a removable chip in the sub-bar, so the person can see why results are narrowed (default, not
  yet confirmed by the owner). New links never write them.
- **For you** is `rankForYou` from `app/domain/for-you.ts`, a pure function shared with the browser so the moved
  counts agree:
  - Browse: over every passing title, with no window. A title at plain index `i` lands at `i * (1 - lift)`, and the
    titles are sorted by that. The lift (`browseLift`) is 0 up to a match of 79, rises in a straight line from there,
    and is 1 from a match of 98, so the higher the match the further a title rises and the best matches go to the top.
    Only titles with a GoodWatch score of at least 60 are lifted; a title without a match isn't. Nothing is pushed
    down by its match. Ties keep the plain order. The four numbers are constants in `app/domain/for-you.ts`
    (`BROWSE_LIFT_START`, `BROWSE_LIFT_FULL`, `BROWSE_LIFT_EXPONENT`, `BROWSE_QUALITY_FLOOR`) and can be tried out on
    the development page `/dev/for-you`.
  - With the Best match sort the order is the taste match already, so For you has nothing to blend and reports no
    movement.
  - Search: score `-(i - 3 * lean)` with `lean = clamp((match - 50) / 50, -1, 1)`, so no title moves 5 places or more.
    It runs over the whole ranked list of up to 100 titles.
  - `moved = plainIndex - newIndex`. "↑N moved" is the number of titles with `moved > 0`.

### Title cards: `app/server/title-cards.server.ts`

```ts
function getTitleCards(keys: TitleKey[], viewer: ViewerContext, taste: Taste): Promise<TitleCard[]>
```

Reads display fields (title, poster, backdrop, year, runtime, GoodWatch score, tagline) for at most one page of keys
(at most 60) in one Crate statement by primary key, caches each title's fields in Redis for 6 hours, and adds taste
match, reasons, services on the viewer's country, and Seen and Want to See flags. Measured: 100 movies by id in about
44 to 110 ms without the fingerprint column.

### Viewer context: `app/server/viewer.server.ts`

```ts
interface ViewerContext {
  viewer: Viewer
  country: string
  services: number[]             // saved, expanded through duplicateProviderMapping; [] for none
  seen: ReadonlySet<TitleKey>    // scored or watched
  wishlist: ReadonlyMap<TitleKey, Date> // added-at
  skipped: ReadonlySet<TitleKey> // Not interested; hidden by Not seen yet
  forYou: boolean                // the member's saved For you setting; true for guests
}
function getViewerContext(request: Request, guest?: GuestProgress): Promise<ViewerContext>
```

One call replaces the per-page reads of user data and settings. Guests get their country from the existing guess and
their services from guest settings when they chose some (the Living room's guest flow asks for them).

### Availability: `app/server/availability-index.server.ts`

```ts
function servicesFor(country: string, keys: TitleKey[]): (number[] | null)[] // null while the country loads
function isOnServices(country: string, services: number[], key: TitleKey): boolean | null
```

### Surface modules

Each surface has one server module that composes the ones above and returns what its page renders:

| Module | Interface |
|---|---|
| `app/server/watch-next.server.ts` | `getWatchNext(ctx, { sort, moods, onMyServices }) → { hero, then[], tiers[], moodCounts, note }` |
| `app/server/discover-results.server.ts` | `getDiscoverResults(ctx, { state, sort, forYou, page, query? }) → { cards, FilterResult fields, explanation }` |
| `app/server/taste-portrait/` | `getTastePortrait(ctx, tab) → SidesView \| EveryoneView \| FingerprintView` |
| `app/server/explorer/` | `getExplorerMap`, `getIsland`, `getBridge`, `getIslandPairs`, `getNearCard` |
| `app/server/tonight.server.ts` | `getTonightsPick(ctx) → { title, reason } \| null` |
| `app/server/features.server.ts` | `isEnabled(feature, viewer) → boolean`; see [Rollout](#rollout) |

### Browser modules

| Module | What it owns |
|---|---|
| `app/ui/filter-bar/` | The desktop row, sub-bar, and Filters side sheet; the mobile slab strip, sort menu, and snapping sheet; one `useFilterState` hook bound to the URL |
| `app/ui/title-card/` | The existing poster card with the taste-match pill, reason chips, and quick actions |
| `app/ui/watch-next/` | Docked strip, mood grid dropdown, hero with its Then column, stepped grid, three mobile drawers |
| `app/ui/taste/` | The three tabs; the old unlock-ladder files are deleted with the cleanup |
| `app/ui/discover/` | The browse and search heading, For you control, explanation chips, glide transition |
| `app/ui/explorer/` | The map engine (camera, layout, level of detail, lit posters, input, history), overlays, and `sea/` |
| `app/ui/explorer/sea/` | One `SeaRenderer` interface with three adapters: WebGL2, WebGL1, Canvas 2D |
| `app/ui/navigation/` | Mobile dock, hub sheet, desktop Browse panel, omnibox, command palette |
| `app/ui/sign-up-prompt/` | The sign-up call to action for taste-dependent features, in inline, chip, and card sizes |

The sea renderer is the one client seam with real variation, so it's the one with an interface:

```ts
interface SeaRenderer {
  readonly kind: "webgl2" | "webgl1" | "canvas2d"
  setIslands(islands: IslandShape[]): void // outline, color, backdrop tile, focus weight
  setCamera(camera: Camera): void
  draw(timeMs: number): boolean            // returns true while anything still moves
  dispose(): void
}
function createSeaRenderer(canvas: HTMLCanvasElement, prefs: { reducedMotion: boolean }): SeaRenderer
```

## Routes and API

### Pages

| Route | Page | Replaces |
|---|---|---|
| `/watch-next` | Watch next | `/wishlist` (301, owner, [#193](https://github.com/alp82/goodwatch-monorepo/issues/193)) and the header's "Want to See" link |
| `/taste` | Taste, Sides of you tab | The unlock-ladder profile |
| `/taste/everyone` | Taste, You vs everyone tab | |
| `/taste/fingerprint` | Taste, Fingerprint tab | |
| `/discover`, `/discover/:type` | Discover, browse mode | The current Discover page and its filter bar |
| `/discover?q=…` | Discover, search mode | `/search` (301 to `/discover?q=…`) |
| `/explorer` | Explorer | (new; `/explore/...` stays a legacy redirect) |
| `/movies`, `/shows` | Search-engine landing pages | Nothing: they stay, linked from the hub sheet and the Browse panel |
| `/taste/quiz` | The taste quiz | Nothing: it stays for now; its future is explored in [#220](https://github.com/alp82/goodwatch-monorepo/issues/220) |

Tabs are routes so that each is linkable and the browser's back button moves between them.

**URL state.** Filters, sort, and For you live in the URL so a page can be shared and reloaded:
`services=mine|all|<ids>`, `unseen=0|1`, `type`, `moods=funny,scary`, `genres`, `score`, `match=70|80|90`,
`released`, `similar`, `people`, `sort` (`match` is Best match), `foryou=0|1`, `q`. Defaults are omitted. Discover keeps accepting today's parameters (`withGenres`,
`minScore`, `withStreamingProviders`, `sortBy`, `watchedType`, and so on) and rewrites them to the new names with a
redirect, so existing links keep working. The parameters for filters the new sheet doesn't offer keep their old names
and apply as [legacy filters](#title-filter-appservertitle-filter).

**For you setting.** For you is saved per member as the `user_setting` key `for_you` and also reflected in the URL
(owner, [#193](https://github.com/alp82/goodwatch-monorepo/issues/193)). Flipping the switch saves the setting and
updates the URL. The URL writes `foryou=0` or `foryou=1` whenever the state differs from on, the global default, so a
shared link opens the way the sender saw it. On load, a `foryou` parameter wins for that view without changing the
setting; without one, the member's setting applies. Guests keep it in the URL only (default, not yet confirmed by the
owner).

### Endpoints

All JSON endpoints are `Cache-Control: private, no-store`. Guest variants take `POST` with the guest progress in the
body; member variants take `GET` and read the session.

| Endpoint | Returns | Budget (server p95) |
|---|---|---|
| `GET/POST /api/discover/results` | One page of cards, counts, recoveries, moved, explanation chips | 250 ms |
| `POST /api/combined-search` (existing) | Up to 100 ranked rows; adds match per row and For you movement to each batch | +40 ms over today |
| `GET/POST /api/watch-next` | Hero, Then, tiers, mood counts | 250 ms |
| `GET/POST /api/taste/portrait?tab=` | One tab's view model | 400 ms uncached, 50 ms cached |
| `GET/POST /api/taste/match` | Match and reasons for up to 100 keys | 50 ms |
| `GET/POST /api/explorer/map?grouping=` | Islands, positions, counts, first posters, personal flags | 300 ms cold, 80 ms warm |
| `GET/POST /api/explorer/island`, `/bridge`, `/pairs`, `/card` | Island trees, bridge members, pair counts, a near card | 150 ms |
| `GET/POST /api/tonight` | Tonight's pick, or null | 100 ms |
| `GET /api/command-palette?q=` | Destinations and up to 5 matching titles | 120 ms |

## Surfaces

### Shared filter bar

Used on Discover (browse and search), Watch next, and Explorer (Explorer uses only On my services and Not seen yet).

**Desktop row**, fixed widths so nothing shifts when labels change:

- **On my services:** a segmented control with the person's service logos and "Everywhere". It reads "Add my
  services" for a viewer without saved services and opens the services setting.
- **Not seen yet:** a switch that shows how many titles it hides ("−53"): Seen titles and titles marked Not
  interested.
- **Sort:** a fixed-width button opening a popover. Discover's sorts: Best match, Popular, Top rated, Newest;
  Relevance joins them only while searching. Popular stays the default. Best match needs taste: without it the option
  shows unavailable with the reason. Watch next sorts: see [Watch next](#watch-next).
- **For you** (Discover only) sits before the sort; see [Discover and Search](#discover-and-search).
- **Filters:** opens a 480 px side sheet from the right, with a search field (focused on open) that filters option
  labels, and these groups in order: Movies or shows, Mood (the 11 moods), Genre, GoodWatch score (Any, 60+, 70+,
  80+), Taste match (Any, 70%+, 80%+, 90%+; unavailable without taste, with the reason), Released (Any, last 3 years, 2010s, 2000s, before 2000), Streaming services (logos), Similar to, Cast and
  crew. Each option shows what the result would be if tapped; an option that would leave 0 titles is dimmed. The
  footer has Clear all, "N hidden", and a live "Show N titles" that counts as the state changes.
- **Sub-bar:** removable chips for every active filter (legacy filters from old URLs included), Clear filters, and the
  hidden-titles insight: a thin meter,
  "N showing, M hidden by your filters", and the two largest recoveries as one-tap buttons ("Show 21 not on your
  services"). Recoveries don't add up to the hidden count, because a title hidden by two filters counts in neither;
  the wording never implies they do.
- The live count in the sheet's button and the insight line are the adopted live count from the glass variant. The
  large result heading count is not used on Discover (owner, [#179](https://github.com/alp82/goodwatch-monorepo/issues/179)).

**Mobile slab**: one fixed panel at the bottom that merges the filter strip with the site navigation:

- From top to bottom: the hidden line (meter, "N hidden by filters", the top recovery; with a query, "N matches, M
  hidden"), the strip (On my services, Not seen yet, For you on Discover, and Sort), a 52 px Filters key with a badge
  of active secondary filters, and the navigation dock.
- Scrolling down more than 10 px folds the hidden line and the dock away; the strip stays. Near the top (under 80 px)
  both always show.
- Sort opens a 272 px menu above the thumb. Filters opens a sheet that snaps to 58% and 94% of the height, drags by its
  handle and header, and closes below 60% of the first snap or with Escape.
- On Watch next, each of the three strip buttons (moods, services, sort) opens its own drawer (owner addendum,
  [#176](https://github.com/alp82/goodwatch-monorepo/issues/176#issuecomment-5854937535)).

**Defaults:** On my services is on for members with saved services and off otherwise. Not seen yet is on for members
and off for guests without guest progress. Guests with guest ratings get it on. For you follows the member's saved
setting and is on for guests with at least 5 guest ratings (see [Guests and members](#guests-and-members)).

### Title cards

- The existing poster card, GoodWatch score ring, streaming badges, and action buttons stay.
- **Taste-match pill:** an amber pill under the GoodWatch score with the match ("87%"). Following the calibration
  guidance, 90 and above is emphasized, 75 to 89 is plain, and below 60 is muted. No pill when the title has no
  fingerprint or the person has no taste yet.
- **Reasons:** a tooltip or long-press on the pill lists the two reasons from `Taste.reasons` as small colored chips
  in the fingerprint's colors ("slow burn", "dry humor").
- Guests without taste see no pill. Where a surface depends on taste, they see the sign-up prompt instead
  ([Guests and members](#guests-and-members)).

### Watch next

Watch next is the top of the Wishlist under the chosen sort and moods. The page shows the whole Wishlist in that order.

**Layout, desktop:** a glass strip docked on the hero's top edge holds the mood control, On my services, and the sort;
it pins under the header once scrolled past. Below it: the start hero (the first title, large, with its backdrop,
match, score, services, and actions) with its **Then** column (the next three titles), followed by the stepped grid.

**Layout, mobile:** the hero and Then stack; the controls sit in the slab at the bottom, and each of its three buttons
opens its own drawer: Moods, Services, Sort.

**Moods control:** the selected moods show as poster chips with a ×. Clicking opens a grid dropdown of the 11 moods as
tiles (the mood's picture, name, one-line description, and how many Wishlist titles fit under the current services
choice), with "k of 3", Clear, and Done. A fourth pick is refused with "Three is the most. Remove one to add X." A
mood's picture is the backdrop of its first title in Best match order that no other mood already uses.

**Sorts** (every value comes from populated data; coverage over the owner's 349 Wishlist titles):

| Sort | Value, descending | Coverage |
|---|---|---|
| Best match (default for members) | Taste match | 99.4% |
| Waiting longest | Oldest `created_at` first | 100% |
| Last added (default for guests and members without taste) | Newest `created_at` first | 100% |
| Newest release | Release day, future dates count as missing | 99.1% |
| Top rated | GoodWatch score | 99.7% |
| Popular now | TMDB popularity, 0 counts as missing | 100% |

Titles with a missing value go last. Ties break by newest added, then by key. There is no manual order, no dragging,
and no "leaving soon" or other simulated sort.

**Tiers** (the stepped grid gets smaller further out):

- A title **fits** when it passes On my services (when on) and belongs to at least one picked mood (when any).
- With no filter active: Up next 4 (extra large), Soon 8 (large), Later 20 (medium), Someday the rest (small).
- With any filter active (the default, because On my services is on): Up next 4, Soon 12, Later the rest of the titles
  that fit; then Close (one condition short: "Other moods" or "Elsewhere"), then Not tonight (fails both).
- The hero and Then can hold titles that don't fit only when nothing fits; the eyebrow then says "Closest to your
  moods" or "Nothing on your services; closest".
- Medium tiers show up to 40 posters and small tiers up to 30, then a "+N" button.

**Actions:**

- **I watched it** on the hero records the watch (`user_watch_history`), removes the title from Want to See (owner,
  [#193](https://github.com/alp82/goodwatch-monorepo/issues/193)), and opens the existing score prompt. "Rate later"
  skips the rating. The next title rises into the hero, and a toast says "Watch next: <title>" with Undo. Undo removes
  the watch and restores Want to See with its original `created_at`, so the title keeps its place in Waiting longest.
- **Not tonight** moves the title to the end of the current view for this visit only. It writes nothing.
- Want to See and Seen on every card behave as everywhere else.

**Empty and small Wishlists:**

- Empty: the hero says "Your Wishlist is empty" and offers "Start with this?", the best worthwhile suggestion for the
  chosen moods and services, with Want to See.
- Under 12 titles: a "Worth adding" row of 18 suggestions under the grid.
- Hundreds of titles: tiers and caps keep the page short; nothing loads all posters at once.

**Data:** `getWatchNext` works on the viewer's Wishlist keys from the viewer context, facts and moods from the
snapshot, services from the availability index, and match from `Taste`. It sorts and tiers in memory, then reads display
fields for the hero, Then, and the first two tiers only; later tiers load as they scroll into view. Mood counts count
Wishlist titles per mood under the current services choice, independent of the other picked moods.

**Guests:** the Wishlist comes from guest progress. With at least 5 guest ratings, Best match works from their guest
taste, as for members, with a sign-up prompt to keep it ("Sign up to keep your taste"). With fewer, Best match shows
the sign-up prompt ("Sign up so Best match can learn your taste") and the default sort is Last added. Moods need no
taste, so they work for every guest (default, not yet confirmed by the owner: moods are fixed rules over the
fingerprint, so the earlier "moods show the sign-up prompt" had no reason to hold). On my services works when the guest
chose services.

### Tonight's pick

`getTonightsPick` returns, for a member with a Wishlist, the first title of Watch next under the default sort, On my
services, and no moods. For a member with an empty Wishlist, it returns the best worthwhile suggestion. For guests it
returns the first title of their guest Wishlist by Last added, else null (the dock then shows a Wishlist icon). The
navigation dock and the Living room's TV both call it.

### Taste

Three tabs under `/taste`. The page never shows an unlock ladder. Every view is computed by `getTastePortrait` from the
viewer's ratings, the snapshot, and the catalog statistics, and cached in Redis per person for 10 minutes (key
`taste-portrait:v1:<user_id>:<tab>`), cleared by `markTasteChanged`.

**Shared math.** Titles are compared as z-scores against the catalog statistics' reference pool (movies with at least
3,000 votes and shows with at least 1,000, the 3,000 most voted, with poster, backdrop, and fingerprint). Craft keys
(direction, acting, cinematography, editing, music_composition, dialogue_quality, narrative_structure, rewatchability)
are left out of clustering and cosine math. The person's usual rating `μ` and its spread `σ` come from their scores.
Loved titles are those rated at least `max(8, round(μ + 0.6σ))`, or all titles rated at least `μ` when fewer than 6
qualify.

**Sides of you** (the layout the owner picked):

- **Sides** are k-means clusters (cosine, 20 iterations, farthest-first seeding from the title closest to the taste)
  of the loved titles: k is 4 with at least 60 loved titles, else 3, and at most `floor(n / 2.5)`. Clusters with
  fewer than 3 members (at least 30 loved titles) or 2 members (otherwise) are dropped.
- Each side has a name from its distinctive attributes (`center - 0.5 * lovedMean`): an adjective from the second key
  and a noun from the first, from a fixed word table with one adjective, noun, and persona per non-craft key (no LLM).
  It shows the top four attributes as chips, its share of loved titles, and its average rating.
- **Headline:** the pair of sides whose centers are least alike: "You love {a}, and just as much {b}." Hidden with
  fewer than 2 sides.
- **Picker:** poster chips, one per side, with "{share}% of what you love". The side with the highest average rating
  opens first.
- **You're here:** the side's titles rated 7 or more (all of them when fewer than 2), best first, four posters, with
  the first loved backdrop behind.
- **Just past it (edges):** places the person has barely tried but rates above their usual when they go: a language,
  an origin country (not US or GB), an attribute they rarely pick, or a decade. Each needs at least four unseen
  suggestions with match at least 56. Candidates are scored `(avg - μ) * sqrt(n) + mean(top 4 match) / 40`, at most two
  per kind and six in total, skipping one that shares three suggestions with a chosen one. Each side first claims its
  closest unclaimed edge by genre profile, then the rest go to their closest side. The copy reads "You've barely been
  to Korea" or "You rarely go back to the 1940s", then "When you go, you rate it 8.1. Usually you give 6.9." The
  average comes from the edge's data, not from parsing a sentence.
- **More of this:** unseen titles ranked by `cosine(title, 0.45 * sideCenter + 0.55 * taste) + 0.8 * (score - 72) /
  100`, kept at match 65 or more, at most 12, filtered by On my services with a one-tap Everywhere.

**You vs everyone** ("everyone" is the GoodWatch score, not other members):

- Counts rated titles with a GoodWatch score and at least 1,000 votes. `delta = mine * 10 - score - offset`, where
  `offset` is the person's mean gap (their generosity).
- Lists "You rate higher" and "You rate lower", each sorted by `delta ± 5 * log10(max(1000, votes))`, 8 shown, 8 more
  per Show more, up to 30, with a Films, Shows, Everything filter.
- Headline from the Pearson correlation of the person's scores with the GoodWatch score: above 0.6 "You mostly agree
  with everyone", above 0.35 "You agree about as often as you don't", else "You don't take the crowd's word for much".
- Gap bars for attributes (titles with z above 1) and genres, at least `max(4, 4% of counted titles)` titles each; the
  top and bottom four attributes and three genres, drawn only at a gap of 2 or more.

**Fingerprint:**

- **Families** follow the fingerprint's own groups in `CoreScores`, by key, not by position: Feel ("How it makes you
  feel", the 13 emotional keys), Humor (7), World ("What it's about", 20), Story ("How it's told", 19), Craft ("How it
  looks and sounds", 15). The family the prototype called "Mood" is named Feel, so it doesn't collide with Mood (owner,
  [#193](https://github.com/alp82/goodwatch-monorepo/issues/193)); its identifier is `feel`.
- **Edge per attribute:** `0.5 * (sel - everyone) / rms + 0.5 * pref / rms`, where `sel` is the mean z of chosen titles
  and `pref` the rating-weighted preference. Tiers at ±0.35, ±0.8, ±1.6 map to "Defining", "You seek it", "You lean
  toward it", "Neither here nor there", "You lean away", "You avoid it", "You steer clear".
- **Header:** a named identity ("The dreamlike novelty hunter", from the word table) and one line: "Show you {top three
  sought phrases}, and you're in. {Top two avoided} rarely get a look." The identity comes from the family edges shown
  below it, not from the taste vector as in the prototype (owner,
  [#193](https://github.com/alp82/goodwatch-monorepo/issues/193)): the noun comes from the attribute with the largest
  positive edge across all families, and the adjective from the largest positive edge in a different family. With
  fewer than two attributes at "You lean toward it" or above, the header shows the line without an identity (default,
  not yet confirmed by the owner).
- **Family rows:** name, line, a small shape of up and down bars (one per attribute), "Drawn to …, not …", and three
  posters carrying the lead attribute. Rows have a pointer cursor and hover states.
- **Opened family:** every attribute with its edge bar. Picking one shows its meaning (`FINGERPRINT_META`), the
  person's stance ("3.2 times as often as everyone; you rate them 0.8 above your usual"), up to six titles that carry
  it (or, for an avoided attribute, the ones rated low), and one exception (an avoided attribute's title rated at least
  `max(8, μ + σ)`, or a sought attribute's title rated at most `min(5, μ - σ)`).
- **The titles that are most you:** two rows of eight, round-robin over the sought attributes' carriers.
- The copy "Five families, 74 attributes" comes from the key table, not a literal.

**Minimum ratings:** Sides need about six loved titles (two sides of two or more), edges need two rated titles in a
group, Crowd needs four per bar. Below those, each tab shows its own empty state ("Rate a few more titles you love")
with a rating shortcut. A member with zero ratings sees an empty state, not an error (the prototype threw).

**Guests** (owner, [#193](https://github.com/alp82/goodwatch-monorepo/issues/193)): with at least 5 guest ratings, the
tabs compute from the guest's ratings, with a sign-up prompt to keep them; a tab whose own minimum isn't met shows its
empty state. Below 5 guest ratings, the tabs show a sample taste, labeled "Sample taste" on every tab, with a prompt to
rate titles and see their own. The sample is a fixed set of ratings shipped with the code (the prototype's
`DEMO_RATINGS` from `ui/prototype-rec-taste/model.ts`, moved under a behavior name such as
`app/server/taste-portrait/sample-ratings.ts`), computed like any other person's ratings and cached for 6 hours
(default, not yet confirmed by the owner: the source of the sample).

**Performance:** the prototype loaded two identical 3,000-title pools, a 2,800-title gem pool, cast and directors for
every rated title (a join that took over a minute and caused cold-load 500s), and data no tab shows. Production reads
only the person's rows and the snapshot. It has no person or credit queries.

### Discover and Search

One page at `/discover`. Browsing and searching share the heading, the filter bar, and the grid.

- **Heading:** while browsing it names the list ("Discover"). Tapping it turns it into the search field (the heading
  and field share one plate that morphs in 240 ms). Typing commits after 800 ms or on Enter. The query becomes the
  heading, with a clear button. Clearing returns to browsing and to the sort used before the search.
- **Sort:** Best match, Popular (the default), Top rated, Newest. **Relevance** appears only while searching and is
  the search default. **Best match** orders the whole filtered list by taste match; without taste the results fall
  back to Popular (Relevance on a search) and the control shows that sort.
- **For you:** an on/off switch before the sort control, on by default and saved per member (see
  the For you setting in [Routes and API](#routes-and-api)), with an amber glow when on, a
  fingerprint icon inside it (hovering or focusing the icon explains it), and "↑N moved" after it changes the order.
  It applies to whichever sort is chosen: browsing, the higher a title's taste match the further it rises, and the
  best matches go to the top; on a search it moves results at most 5 places
  ([Title filter](#title-filter-appservertitle-filter)). Per-card up and down marks show for 2.6 s after the switch
  flips. Under Best match the switch shows on without a moved count, whatever the saved setting, which choosing Best
  match doesn't change. Flipping it there turns it off for the moment and opens the sorts: picking another sort
  applies it with For you off; closing them without picking turns it back on.
- **Explanation chips** (top right, small colored chips):
  - Browsing with For you on: "Your taste leans to" and three chips from `Taste.leanings(3)`, in fingerprint colors,
    plus "from N ratings".
  - Searching: "Read as" and one chip per interpreted concept from the reading's `ReadingChip` list (kinds `want` and
    `attribute`, up to four; `avoid` and `excluded` chips render struck through). It replaces the taste chips.
- **Cards:** the grid of [title cards](#title-cards). No large result count.
- **Transition (glide):** the grid is never replaced. Titles in both lists glide to their new places in 260 ms on a
  slightly overshooting ease (cubic-bezier 0.3, 1.35, 0.55, 1); new titles scale in from 0.9 over 180 ms; leaving titles
  fade and scale to 0.96 over 100 ms; text swaps nudge 10 px over 200 ms. Poster boxes reserve their 2:3 space so cards
  don't collapse while images load. With reduced motion, only short opacity fades run.

**Browse data:** `getDiscoverResults` filters and sorts the catalog in memory, applies For you, and reads display fields
for one page (40 titles). Pages load by infinite scroll, as today.

**Search data:** the existing `combinedSearch` pipeline is unchanged up to its ranked list, except that the list is
100 titles long. The filter bar's Type, Genre, Released, and service choices keep going into the ranking as eligibility
(`SearchFilters`), as today. Not seen yet, moods, legacy filters, and the counts and recoveries run in memory over the
top 100 ranked results, so they count what the search found, not the catalog (owner,
[#193](https://github.com/alp82/goodwatch-monorepo/issues/193)). For you reorders the ranked list after the ranker.
Match per row comes from `Taste.match`. The NDJSON stream gains `match` and `moved` per row.

**Search ranking limits.** The ranker returns 100 titles instead of 50:

| Constant | File | Today | New |
|---|---|---|---|
| `RESULT_LENGTH` (the returned list) | `server/search-ranking/ranking.server.ts` | 50 | 100 |
| `BLEND_LENGTH` (the title-lookup blend) | `server/search-ranking/title-blend.server.ts` | 100 | 100, unchanged |
| `MAIN_DEPTH`, `PART_DEPTH`, `NON_ENGLISH_UNION_DEPTH` (candidate pools) | `server/search-ranking/ranking.server.ts` | 500, 300, 2,000 | unchanged |
| `RANKER_VERSION` | `server/search-ranking/ranking.server.ts` | `hybrid-v1` | `hybrid-v2` |

The scoring runs over the candidate pool (up to 500 titles per list) with z-scores over that pool, so returning 100
leaves the order of the first 50 as it is; only `topIds` and the final slice take the longer length. The version still
changes, because `search_history` compares served lists by `ranker_version` and the lists are now longer. The basic
search fallback keeps its own length.

Budget impact: the ranking stage's Qdrant queries and scoring are unchanged. The display step reads catalog metadata
(`metadataFor`) and display fields for up to 100 titles instead of 50, one primary-key read per media type (100 titles
by id measured 44 to 110 ms), which adds an estimated 20 to 40 ms; the batch line of the stream roughly doubles. The
search stays within the owner's under-1-second target and map #100's p95 under 1.5 s, and the combined-search budget
above allows for it (+40 ms). The ranking ticket measures p50 and p95 of the display stage from `stage_ms` before and
after. The grid renders the first 40 cards and the rest by scroll, as in browse mode.

**Guests** (owner, [#193](https://github.com/alp82/goodwatch-monorepo/issues/193)): with at least 5 guest ratings,
For you works from the guest taste, with a sign-up prompt beside it to keep it. With fewer, the sign-up prompt takes the
switch's place. Taste chips show only when the guest has taste.

**Without taste yet:** a member or a guest with 5 or more ratings but fewer than 5 liked titles sees the For you switch
disabled with "Rate a few more titles you love" and a rating shortcut; the order is the plain sort (default, not yet
confirmed by the owner).

### Explorer

A full-viewport map at `/explorer`. The page never scrolls; nothing sits below the map. Controls are always visible and
at least 44 px.

**Groupings**, chosen up front in a segmented control: Mood (the default), Theme, Style, Occasion, Decade, Country,
Your taste.

| Grouping | Islands | Membership |
|---|---|---|
| Mood | Up to 14 islands for how a title feels, such as "Funny" or "Tense" | Several; a title that fits none sits on no island |
| Theme | Up to 14 islands for what a title is about, such as "True stories" or "Growing up" | Several, or none |
| Style | 10 islands for how a title looks, sounds, and is told, such as "Spectacle" or "Slow burn", with Animated and Documentary by TMDB genre | Several, or none |
| Occasion | Up to 12 islands for who and what a title suits, such as "Date night" or "Comfort" | Several, or none |
| Decade | 7 bands | One |
| Country | Origin countries with at least 50 pool titles, at most 13, plus "Rest of world" (owner) | One |
| Your taste | Match bands 90+, 80 to 89, 65 to 79, below 65 | One; hidden without taste |

**Pool:** the presentable snapshot titles with a backdrop, up to 9,000 movies with at least 800 votes and 3,000 shows
with at least 200 votes (about 12,000 titles). Islands with fewer than 3 titles are dropped.

**Grouping rules** (owner, 2026-10-03; they replace the rules of
[#193](https://github.com/alp82/goodwatch-monorepo/issues/193) for Mood and Streaming):

- **Mood, Theme, and Style** are Explorer's own islands, each a rule over the fingerprint
  (`app/server/explorer/islands.server.ts`, the one file that holds every grouping's islands and rules). They are not the 11 moods of the moods module, which stay as they are
  for Watch next: most of those restate a genre. Each island stands on a score of its own and no score feeds two islands,
  so combining two shows something worth finding; names are one or two plain words (owner, 2026-10-03). An island's threshold moves up while it holds more than a quarter of
  the pool, and one step down when it holds less than 1 percent. The thresholds haven't been tuned against the real
  pool yet; each build logs the island sizes and the share of the pool that sits on an island.
- **Occasion** uses the title analysis's suitability and viewing-context flags. The snapshot doesn't hold them, so the
  pool reads them from Crate with its display fields, once per snapshot version. An occasion that more than half the
  pool has is left out.
- **Genre** is gone as a grouping (owner, 2026-10-03): Mood, Theme, and Occasion hold what its islands held, and
  Animated and Documentary moved to Style. Westerns have no island. A link to `grouping=genre` opens Mood.
- **Streaming** is gone as a grouping: On my services already covers it, and combining two services says nothing.
  A link to `grouping=streaming` opens Mood.
- **Country** buckets come from the pool's origins: each origin country with at least 50 pool titles gets an island,
  and the rest join "Rest of world". The bucket list is computed per snapshot version. When more than 13 countries
  qualify, the 13 largest keep islands and the others also join "Rest of world", which keeps the grouping within the
  renderer's island limit (default, not yet confirmed by the owner).

**Server:** `getExplorerMap` computes islands from snapshot facts, positions them by a two-component PCA of their mean
descriptive vectors (the craft keys and homage and reference left out), and returns per island: id, name, color, count,
median match, the three match bands, position, a "what sets it apart" phrase, and the top 12 titles by quality plus the
top 5 of each match band. Non-personal groupings are cached per grouping for 6 hours in memory; the
personal part (match, Seen, Want to See, on my services) is added per request.

- `getIsland` returns an island's tree: its first 2 to 5 posters, then each title's closest titles in the island by
  cosine plus `0.2 * quality`, generation by generation.
- `getBridge(a, b)` returns titles on both islands for multi-membership groupings when at least 6 exist ("both"),
  sorted by quality. Otherwise ("between") it scores each candidate from the chosen islands by its smallest cosine to
  the islands' mean vectors and interleaves the best from each island.
- `getIslandPairs` returns, for every pair, the shared count (Ochiai for "both", cosine between means for "between").
- `getNearCard` returns a title's why line (the top two reasons plus "like X", the closest title the person rated 8 or
  more), match, services, and actions.
- All of these run in memory over the snapshot. There is no Crate or Qdrant call per request besides display fields.

**Client:**

- **Islands** render on the sea canvas (glowing shorelines, backdrop-collage surfaces, drifting fog). Posters, dots,
  names, and glows render on a second, Canvas 2D layer, at most 240 posters at once. Cards and captions are DOM
  overlays positioned with transforms.
- **Lit posters:** a warm pool of light follows the pointer (the viewport center on touch). Size, detail, and
  brightness depend on zoom and on distance from that focus, with crossfades and no popping. Titles below about 16 px
  draw as dots.
- **Proximity card:** the nearest title opens as a card over the live map: match, why, services, Want to See, Seen it.
  Two wheel notches from the overview reach a title's card.
- **Combining islands:** tapping an island lights it and relabels every other island with what they share ("570 in
  both"). Hovering another previews the bridge and its count; a tap raises it. The bridge forms between the joined
  islands and grows to the main thing on screen; the joined islands stay medium; the rest shrink, grey, dim, and
  simplify. The bridge shows 3 to 5 posters at map level. The view zooms out slightly when a bridge layout spills over
  the edges. Let go, Separate, Escape, and the browser's back button spring the map back.
- **A bridge rises at once:** combining shows the bridge immediately, pulsing until its titles arrive (owner,
  2026-10-03); it doesn't wait for the request.
- **Order on an island:** where titles sit on several islands, an island's titles are ordered by how well they fit it
  (`FIT_WEIGHT`) together with quality, so one well-known title doesn't lead every island it sits on.
- **History:** every grouping change, island entry, and bridge is a history entry (`history.pushState`), so the
  browser's back and forward buttons work. The top bar has one icon button that opens the steps (owner, 2026-10-03).
- **Filters:** On my services and Not seen yet hide titles (never dim them).
- **Minimap**, keyboard, pinch, and wheel as in [Accessibility](#accessibility-and-reduced-motion).
- **Level of detail and budget:** device pixel ratio capped at 1.5 for WebGL and 2 for Canvas 2D; posters load at
  w92 to w500 by on-screen size; an image cache with a size limit (the prototype's never evicted); the frame loop stops
  when nothing moves (the prototype's never stopped, which breaks the rendering-budget rule of
  [#190](https://github.com/alp82/goodwatch-monorepo/issues/190)).

**Guests:** the map works for everyone. Your taste, match bands, and the why line need taste: guests with taste
(5 liked titles among their guest ratings) get them from their guest taste; guests without it get the groupings without
Your taste and a sign-up prompt in the card.

### Navigation

**Mobile dock** (below the large breakpoint), replacing `ui/nav/BottomNav.tsx`:

- Left: Tonight's pick as a small poster; one tap opens Watch next. Its label reads "Tonight" for members and
  "Wishlist" for guests; `aria-label` is "Watch next: <title>".
- Center: the round hub key (64 px, raised), showing the GoodWatch mark and the current page's name. It shrinks to 56 px
  when a filter strip sits above it.
- Right: Search, which opens the command palette.
- The dock merges with the page's filter strip on Discover and Watch next (the slab). On Explorer it floats over the
  map, and the map reserves its height.

**Hub sheet:** a search entry; four tiles in a 2 by 2 well like the remote's feature well: Watch next (subtitle "<title>
tonight", or for guests "N on your Wishlist"), Discover ("Browse and search"), Taste ("Sides of you"), Explorer
("Islands map"); a secondary row with Movies and Shows; the Living room key (Home, `/`); and the account row (avatar, Wishlist, Lists, Settings for members;
"Sign up to keep your Wishlist and let Best match learn your taste" for guests).

**Desktop header**, replacing the link row in `ui/main/Header.tsx`: the wordmark, a Browse button (showing the current
page's name away from Home) whose panel mirrors the hub sheet (580 px, below the header), the omnibox, Tonight's pick,
and the account slot (Sign up for guests).

**Omnibox and command palette:**

- The omnibox looks like an input with its shortcut shown (⌘K on Apple platforms, Ctrl K elsewhere, and "/" when focus
  isn't in a text field). Clicking it or pressing the shortcut opens the palette.
- The palette (640 px, centered, on mobile a full-width sheet) lists, as soon as anything is typed, "Search for …"
  first (it opens `/discover?q=…`), then up to five matching titles (each opens its title page), then matching
  destinations ("Go to Taste"), then Sign up for guests. Empty, it shows destinations and recent searches.
- Up and Down move, Enter runs, Escape closes and returns focus to the omnibox.
- Title matches come from a prefix lookup over titles, cached per prefix in Redis. The ticket picks the source (the
  existing header search suggestions endpoint, if its latency fits the 120 ms budget).

**Where Movies and Shows go:** `/movies` and `/shows` stay, because they are important landing pages for search
engines, and the hub sheet links to them (owner, [#193](https://github.com/alp82/goodwatch-monorepo/issues/193)). They
sit in a secondary row under the four tiles, "Movies" and "Shows", and the desktop Browse panel mirrors it (default,
not yet confirmed by the owner: the placement within the sheet).

## Guests and members

| Surface | Member | Guest |
|---|---|---|
| Filter bar | On my services on with saved services; Not seen yet on | On my services only with services chosen in the Living room or settings; Not seen yet on with guest progress |
| Title cards | Taste-match pill and reasons | Pill only with guest taste |
| Discover | For you from the saved setting, on by default | 5+ guest ratings: For you works, with a sign-up prompt to keep it; fewer: sign-up prompt in place of For you |
| Search | For you moves results at most 5 places | 5+ guest ratings: as members, with the prompt; fewer: Relevance only and the prompt |
| Watch next | Best match default, moods, tiers | Guest Wishlist; 5+ guest ratings: Best match works, with the prompt; fewer: Last added default and the prompt on Best match; moods work |
| Taste | All three tabs | 5+ guest ratings: tabs from their ratings, with the prompt; fewer: a labeled sample taste and a prompt to rate |
| Explorer | All groupings | Your taste and match with guest taste; otherwise the card shows the prompt in place of match |
| Navigation | Avatar, Tonight's pick | Sign up, Wishlist thumb |

Guests with at least 5 guest ratings get For you and Best match working, with a sign-up prompt to keep them (owner,
[#193](https://github.com/alp82/goodwatch-monorepo/issues/193)). The taste match itself follows the same minimum as
for members, 5 liked titles.

The sign-up prompt is one component in three sizes (inline next to a control, a chip in a menu, a card in a sheet),
with one message per feature, for example "Sign up so Best match can learn your taste" before the threshold and "Sign up
to keep your taste" after it. It opens the existing sign-up flow and keeps the current URL as the return target. Guest
progress transfers as today.

## Performance budgets

These are release criteria. Each surface ticket measures them on a production build against production data before
its flag goes on.

| What | Budget | How it's met |
|---|---|---|
| Taste match for 100 titles | Under 50 ms end to end on the server, p95 | One Redis `GET` (1 ms p50) and an in-memory dot product (0.07 ms p50) |
| Member taste rebuild | Under 60 ms p95, off the request path; inline only when stale | One Crate read of the person's rows, in-memory math |
| Guest taste per request | Under 20 ms p95 | In memory; quantiles cached per body hash |
| Snapshot load | Under 3 s after boot, off the request path; under 40 MB | Binary columns from Redis |
| Discover results page | Under 250 ms server p95 | In-memory filter and counts (under 30 ms for the catalog), one display read |
| Watch next | Under 250 ms p95 for a 1,000-title Wishlist | In memory; display fields for the visible tiers only |
| Taste portrait | Under 400 ms uncached, 50 ms cached | Person's rows plus snapshot; no credit joins |
| Explorer map | Under 300 ms cold, 80 ms warm | Cached per country and grouping |
| Any Crate statement on a request path | Under 1 s p99, logged when over 300 ms | Primary-key reads and one page of ids only |
| Qdrant per request | No new calls | Only search ranking (unchanged) and one vector query for Recommended for you, which replaces today's recommend call |
| Filter toggle in the browser | Under 200 ms interaction to next paint | Count updates from the server response; optimistic chips |
| Explorer frames | 60 fps target, main-thread work under 10 ms per frame | Two canvases, level of detail, capped posters |
| Explorer idle | Under 5% CPU (10% with software rendering); nothing animates at idle | Frame loop stops; fog drift pauses after 10 s idle |
| Discover transition | 200 to 280 ms | Layout animation on cards; no full re-render |

No request waits on a statement near the 10-second `CRATE_TIMEOUT_MS`. The heavy reads (availability per country,
the snapshot) run in the background, and requests during their load degrade as described in [Storage](#storage).

## Explorer rendering fallbacks

- **Order:** WebGL2, then WebGL1, then Canvas 2D. Creating a context, compiling the shader, and linking the program
  must all succeed; any failure falls through to the next adapter.
- **WebGL1** sizes its island array to `MAX_FRAGMENT_UNIFORM_VECTORS` and uses `mediump` when `highp` is missing.
- **Canvas 2D** draws real island shapes, shorelines, and backdrop textures, without shaders or animation. It redraws
  only when the camera or islands change.
- **Context loss:** listen for `webglcontextlost` (prevent default) and `webglcontextrestored`, then rebuild the
  program and the atlas. Two losses within a minute switch to Canvas 2D for the visit. The prototype set a flag and
  never recovered.
- **Limits:** the atlas holds 16 island tiles and the shader 24 islands; groupings have at most 14 islands plus a
  bridge, and the renderer asserts it.
- **Blur:** the backdrop collages were blurred with canvas `filter`, which Safari may not support. The ticket checks
  Safari and pre-blurs tiles in a small shader pass, or ships pre-blurred images, when it isn't supported.
- **Debugging:** `?gl=webgl2|webgl1|canvas` forces an adapter outside production only.
- **No list view:** the map has no list mode (owner, 2026-10-03); a keyboard and screen-reader alternative to the
  canvas is open.
- **Without JavaScript and for search engines:** the server renders the grouping's islands as a list of headings with
  their top titles as links. The canvas replaces it after hydration.

## Accessibility and reduced motion

**Everywhere:**

- One global `<MotionConfig reducedMotion="user">` for framer-motion, and CSS that honors `prefers-reduced-motion`.
  The prototypes had none. With reduced motion, transforms and layout animations are off and only short opacity fades
  run.
- Sheets, drawers, the hub sheet, the Browse panel, and the palette are dialogs with a label, `aria-modal`, a focus
  trap, Escape to close, and focus returned to the control that opened them. The prototypes had no focus trap and
  unlabeled dialogs.
- Switches use `role="switch"` (Not seen yet, For you); the services control and sorts are radio groups with arrow-key
  movement; menus are `menu` and `menuitemradio` with arrow keys.
- The hub key has `aria-expanded`. The palette is a combobox with a listbox and `aria-activedescendant`.
- The taste-match pill has a text label ("87% taste match"); color is never the only signal. The fingerprint icon's
  explanation is a tooltip reachable by focus.
- Targets are at least 44 px on touch.
- `navigator.vibrate` isn't used.

**Watch next:** mood tiles are checkboxes; a refused fourth pick is announced through a polite live region.

**Taste:** tabs are links with `aria-current`. The side picker is a tab list with arrow keys. Family rows are buttons
with `aria-expanded`; attributes use `aria-pressed`.

**Explorer:**

- The map canvas is focusable with `role="application"` and a label naming the grouping and island count.
- Keyboard: arrows move to the neighboring poster or pan; `+` and `-` zoom one step; `0` returns to the overview;
  Enter enters the lit island or pins the nearest poster; Escape undoes one layer (card, lit island, bridge, zoom).
- **List view:** a "List" toggle in the top bar shows the same islands and titles as headings and links, with the same
  combine action ("Combine with…"). Screen-reader users and anyone who prefers it get full parity; the canvas itself
  has no per-poster accessible objects. The prototype had nothing here.
- Cards and the top bar announce changes through a polite live region.
- Reduced motion snaps springs, the lens, and camera flights, and freezes the sea's time. Fog doesn't drift.

## Rollout

### Feature flags

A small module, `app/server/features.server.ts`, reads one environment variable per feature (set in Coolify):

| Variable | Values | Controls |
|---|---|---|
| `REC_TASTE_MATCH` | `off`, `shadow`, `on` | Stored taste vectors and match on cards |
| `REC_FILTER_BAR` | `off`, `preview`, `on` | New filter bar and Discover page |
| `REC_WATCH_NEXT` | `off`, `preview`, `on` | `/watch-next` and the Wishlist redirect |
| `REC_TASTE_PAGE` | `off`, `preview`, `on` | New Taste tabs |
| `REC_EXPLORER` | `off`, `preview`, `on` | `/explorer` |
| `REC_NAVIGATION` | `off`, `preview`, `on` | Dock, hub sheet, Browse panel, palette |
| `REC_TRACKING` | `off`, `preview`, `on` | The movie watch log: Seen opens the log once a movie is Seen, and `/api/watch-log` ([data model, section 10](../tracking/data-model.md#the-movie-watch-log-383)) |

`preview` shows the feature only to the members listed in `REC_PREVIEW_USERS` (user ids), so the owner can use it in
production before everyone. With `off`, the old page serves. Flags are read per request, so a change needs only a
restart of the container, not a build.

### Cache keys and versions

Stored keys outlive the code: `title-snapshot:<version>` and its manifest `format`, `taste:v1:`, and
`taste-portrait:v1:`. A change to the snapshot layout bumps `format`; a change to the taste formula or calibration
bumps `taste:v1` to `v2`, which rebuilds every vector on first read. Mood keys (`funny`, `crime`, and so on) appear
in URLs and never change.

### Order

1. **Foundations, no visible change:** snapshot publisher and loader, taste vectors in `shadow`, availability index,
   viewer context, flags. Shadow mode builds and stores vectors on every write and logs, for "Recommended for you",
   the overlap between the stored vector's top 50 and the recommend API's list. The #174 research expects about 0.62
   overlap with the recommended formula.
2. **Recommended for you** moves to one vector query with the stored vector (flag `REC_TASTE_MATCH=on`). This cuts
   Qdrant load: one query instead of a points read plus a recommend call.
3. **Filter bar and Discover and Search** in `preview`, then `on`.
4. **Watch next** in `preview`, then `on`; `/wishlist` redirects.
5. **Taste page** in `preview`, then `on`.
6. **Navigation** in `preview`, then `on`. It needs Watch next on, because Tonight's pick opens it.
7. **Explorer** in `preview`, then `on`.

Each `preview` period lasts until the owner accepts the surface. Each surface stays `on` for at least 7 days with no
new errors before its old code is removed.

### Switch-over checks per surface

- The budgets in [Performance budgets](#performance-budgets), measured on the production host.
- No new errors in the webapp logs for the surface's endpoints; container memory stable (the snapshot and availability
  index add about 35 MB plus about 10 MB per loaded country).
- Qdrant request rate not higher than before the switch.
- For taste match: vectors present for every member with at least the minimum signal
  (`SCAN taste:v1:*` count against members with ratings), and no inline rebuild slower than 100 ms.

## Cleanup of replaced code

Removed after each surface has been `on` for 7 days. Each removal is its own commit so it can be reverted.

- **Filter bar:** `ui/filter/` (22 files, 3,451 lines), including the dead `FilterSelection.tsx` and `SectionDNA.tsx`,
  `server/types/discover-types.tsx`'s filter definitions, `utils/discover.ts:buildDiscoverParams` once legacy
  parameters are rewritten by the redirect, the old SQL paths in `server/discover.server.ts` except the conditions the
  legacy filters resolve through, and Search's separate chips (`JourneyFilters` in `ui/search/SearchJourney.tsx`).
  `FilterCountries.tsx` stays: settings and onboarding use it.
- **Taste:** the unlock ladder (`components/NextUnlockCard`, `UnlockModal`, `UnlockCelebration`,
  `features/*Feature.tsx`, `TasteProfile.tsx`), the `api.taste-profile.*` routes and `server/taste-profile.server.ts`.
  `/taste/quiz` stays for now (owner, [#193](https://github.com/alp82/goodwatch-monorepo/issues/193)), and so do
  `server/interest-discovery.server.ts` and everything the quiz imports: `ui/taste/TasteQuiz.tsx` uses
  `ui/taste/features.ts` (`GUEST_LIMITS`, `FEATURES`), `hooks/useFeatureActivation`, `hooks/useFeatureModals`, and
  `components/modals/FeatureTooltip`, so those stay until the quiz's own ticket
  ([#220](https://github.com/alp82/goodwatch-monorepo/issues/220)) decides its future. The cleanup removes only what
  nothing else imports.
- **Wishlist:** `routes/wishlist.tsx` with its sorts (`most_recently_added`, `least_recently_added`, `highest_score`,
  and the unimplemented `most_popular`), `ui/filter/WishlistFilter.tsx`, `/api/wishlist-titles`, and the header's
  Want to See and Already Watched links to Discover.
- **Recommendations:** the recommend-API paths in `server/user-recommendations.server.ts` and
  `server/guest-recommendations.server.ts`, replaced by the vector query.
- **Navigation:** `ui/nav/BottomNav.tsx` and the link row and mobile hamburger menu in `ui/main/Header.tsx` (the
  about and legal links move to the footer).
- **Prototypes:** the `prototype.rec-*` routes and `ui/prototype-rec-*` folders are not merged to main; they stay on
  their branch.

## Production verification

After each switch to `on`, the ticket that switches it records these checks in its closing comment:

1. **Snapshot:** `GET title-snapshot:current` shows a version from the last day and `count` within 1% of the Crate
   count of titles with fingerprints. The webapp log shows the loaded version.
2. **Taste match:** for three members (the owner and two heavy raters), the match of 10 titles computed offline from
   Crate equals the match on their cards. After rating a title, the card match changes on the next page load.
3. **Filter bar:** for one country and one member, the "hidden" and recovery counts equal counts from a Crate query over
   the same filters (within the snapshot's freshness).
4. **Watch next:** each sort's order matches its field on the owner's Wishlist; mood counts equal the round 7 audit's
   rules applied in a script.
5. **Latency:** p50 and p95 of each endpoint from the logs over the first day, against the budgets.
6. **Qdrant:** request counts per minute before and after, from Qdrant's metrics.
7. **Browser:** Chrome with devtools on a phone profile and a desktop profile, with and without reduced motion; Safari
   for the Explorer blur and WebGL; a browser without WebGL2 for the fallbacks. Lighthouse on Discover and Taste stays
   at or above today's scores.

Per the repository's instructions, no automated tests are written; verification is manual in the browser, plus the
measurements above.

## Owner answers

The owner answered the draft's open questions on September 27, 2026, when approving the spec
([#193](https://github.com/alp82/goodwatch-monorepo/issues/193)). The spec above applies them.

| # | Question | Decision |
|---|---|---|
| 1 | Guests and For you or Best match | Guests with at least 5 guest ratings get For you and Best match working, with a sign-up prompt to keep them. |
| 2 | Minimum signal for taste match | Taste match shows from 5 liked titles. |
| 3 | Not seen yet and skipped titles | Not seen yet also hides titles marked Not interested (skipped). |
| 4 | The Wishlist page | `/watch-next` replaces `/wishlist` with a 301 redirect. |
| 5 | Legacy Discover filters | Keywords, age rating, language, fingerprint pillars and conditions, suitability, and context keep working from old URLs but aren't shown in the new sheet. |
| 6 | Movies and Shows | `/movies` and `/shows` stay as search-engine landing pages, linked from the hub sheet. |
| 7 | "Mood" as a fingerprint family name | The family is renamed Feel. |
| 8 | Identity title source | The Fingerprint tab's identity title comes from the family results shown below it. |
| 9 | For you persistence | Saved as a member setting and also reflected in the URL. |
| 10 | Search counts | Counts and recoveries on a search cover the top 100 ranked results; the ranker returns 100 (see [Discover and Search](#discover-and-search)). |
| 11 | The prototype branch | `prototype/recommendation-experience` is pushed to origin; implementers read it there. |
| 12 | Snapshot cadence | Nightly, plus after each fingerprint batch. |
| 13, 14, 16 | Explorer groupings | Mood uses the 11 Watch next moods; countries with fewer than 50 titles group into "Rest of world"; guests without services fall back to Genre instead of Streaming. |
| 15 | Finishing a title from Watch next | "I watched it" removes the title from Want to See. |
| 17 | The Living room exit transition | Not part of this spec; it's decided on [#191](https://github.com/alp82/goodwatch-monorepo/issues/191), and the routes here work with either answer. |
| 18 | Guests on Taste | Guests see their guest ratings' taste, or a sample taste below 5 ratings. |
| 19 | The taste quiz | `/taste/quiz` stays for now. What it becomes is explored in [#220](https://github.com/alp82/goodwatch-monorepo/issues/220); the cleanup doesn't remove it. |

**Defaults, not yet confirmed by the owner.** Where the answers left a detail open, the spec picks a default, marked
where it applies:

- The snapshot publisher runs after each vector copy but publishes only when fingerprints were added or changed.
- Liked titles are ratings of 6 or more; Want to See doesn't count toward the 5-liked-title threshold.
- A member, or a guest with 5 or more ratings, with fewer than 5 liked titles sees For you disabled with "Rate a few
  more titles you love", and Best match isn't the default sort.
- Guests' moods on Watch next work without taste (moods are fixed rules).
- Legacy filters show as removable chips in the sub-bar and resolve through today's SQL conditions to one id set.
- The URL writes `foryou=0|1` when the state differs from on; a URL value wins for that view without changing the saved
  setting; guests keep For you in the URL only.
- Undo after "I watched it" restores Want to See with its original `created_at`.
- The identity noun and adjective come from the two largest positive edges in different families; with fewer than two,
  no identity shows.
- The guest sample taste is the prototype's demo ratings, shipped as a fixture and labeled "Sample taste".
- Titles in no mood sit on no Mood island; the Country grouping keeps at most 13 country islands plus "Rest of world".
- Members without saved services also get Genre in place of Streaming in Explorer.
- Movies and Shows sit in a secondary row under the hub sheet's four tiles, mirrored in the Browse panel.
- `RANKER_VERSION` becomes `hybrid-v2` with the longer list.

Found while writing this spec, filed separately as bugs: favorites post to a route that doesn't exist
([#221](https://github.com/alp82/goodwatch-monorepo/issues/221)), and "Recommended for you" excludes titles by
TMDB id without media type ([#222](https://github.com/alp82/goodwatch-monorepo/issues/222)).

## Issue breakdown

Each issue is sized for one agent session, labeled `wayfinder:task`, `ready-for-agent`, and `enhancement`, is a
sub-issue of map [#172](https://github.com/alp82/goodwatch-monorepo/issues/172), and is blocked natively by the issues
listed. Issues marked "needs owner to apply" change production data or infrastructure and wait for the owner. The
numbers in this section (1 to 25) are the breakdown's; the GitHub column links each issue.

| # | GitHub | Title | Blocked by | Area |
|---|---|---|---|---|
| 1 | [#195](https://github.com/alp82/goodwatch-monorepo/issues/195) | Publish the title snapshot to Redis from Windmill | 5 | Windmill |
| 2 | [#196](https://github.com/alp82/goodwatch-monorepo/issues/196) | Load the title snapshot and catalog statistics in the webapp | | webapp |
| 3 | [#197](https://github.com/alp82/goodwatch-monorepo/issues/197) | Store taste vectors per member and compute taste match | 2 | webapp |
| 4 | [#198](https://github.com/alp82/goodwatch-monorepo/issues/198) | Add the viewer context and the per-country availability index | | webapp |
| 5 | [#199](https://github.com/alp82/goodwatch-monorepo/issues/199) | Declare the user tables' timestamps and confirm Redis capacity (needs owner to apply) | | Crate, Redis |
| 6 | [#200](https://github.com/alp82/goodwatch-monorepo/issues/200) | Add feature flags and the preview list | | webapp |
| 7 | [#201](https://github.com/alp82/goodwatch-monorepo/issues/201) | Serve "Recommended for you" and guest recommendations from one vector query | 3, 6 | webapp, Qdrant |
| 8 | [#202](https://github.com/alp82/goodwatch-monorepo/issues/202) | Build the in-memory title filter with counts, recoveries, and For you | 2, 3, 4 | webapp |
| 9 | [#203](https://github.com/alp82/goodwatch-monorepo/issues/203) | Build the shared filter bar: desktop row and sheet, mobile slab | 8 | webapp UI |
| 10 | [#204](https://github.com/alp82/goodwatch-monorepo/issues/204) | Add the taste-match pill, reasons, and the sign-up prompt to title cards | 3 | webapp UI |
| 11 | [#205](https://github.com/alp82/goodwatch-monorepo/issues/205) | Build Discover browse mode on the new filter bar with For you | 6, 9, 10 | webapp |
| 12 | [#206](https://github.com/alp82/goodwatch-monorepo/issues/206) | Merge Search into Discover: search mode, Read as chips, glide transition | 11 | webapp |
| 13 | [#207](https://github.com/alp82/goodwatch-monorepo/issues/207) | Build the moods module and the Watch next server | 2, 3, 4 | webapp |
| 14 | [#208](https://github.com/alp82/goodwatch-monorepo/issues/208) | Build the Watch next page for desktop | 6, 10, 13 | webapp UI |
| 15 | [#209](https://github.com/alp82/goodwatch-monorepo/issues/209) | Build Watch next on mobile and redirect the Wishlist | 9, 14 | webapp UI |
| 16 | [#210](https://github.com/alp82/goodwatch-monorepo/issues/210) | Build the Taste portrait server: sides, edges, everyone, and fingerprint families | 2, 3, 4 | webapp |
| 17 | [#211](https://github.com/alp82/goodwatch-monorepo/issues/211) | Build the Taste page's three tabs and remove the unlock ladder from the route | 6, 10, 16 | webapp UI |
| 18 | [#212](https://github.com/alp82/goodwatch-monorepo/issues/212) | Build the Explorer server: groupings, islands, trees, bridges, pairs, and cards | 2, 3, 4 | webapp |
| 19 | [#213](https://github.com/alp82/goodwatch-monorepo/issues/213) | Build the Explorer sea renderer with WebGL2, WebGL1, and Canvas 2D adapters | | webapp UI |
| 20 | [#214](https://github.com/alp82/goodwatch-monorepo/issues/214) | Build the Explorer map: camera, lit posters, proximity cards, and filters | 18, 19 | webapp UI |
| 21 | [#215](https://github.com/alp82/goodwatch-monorepo/issues/215) | Add combining, history, minimap, keyboard, and the list view to Explorer | 20 | webapp UI |
| 22 | [#216](https://github.com/alp82/goodwatch-monorepo/issues/216) | Build the mobile dock, hub sheet, and desktop Browse panel with Tonight's pick | 6, 13 | webapp UI |
| 23 | [#217](https://github.com/alp82/goodwatch-monorepo/issues/217) | Add the omnibox and command palette | 22 | webapp UI |
| 24 | [#218](https://github.com/alp82/goodwatch-monorepo/issues/218) | Switch each surface on and verify it in production (needs owner to apply) | 7, 12, 15, 17, 21, 23 | release |
| 25 | [#219](https://github.com/alp82/goodwatch-monorepo/issues/219) | Remove the replaced filter bar, unlock ladder, Wishlist page, and old navigation | 24 | webapp |

**Parallel tracks.** Issues 2, 4, 5, 6, and 19 can start at once. Issue 1 follows the owner's go on 5. After 2 and 3:
7, 10, 13, 16, and 18 can run in parallel; then the surface tracks (Discover 8 to 12, Watch next 13 to 15, Taste 16 and
17, Explorer 18 to 21, navigation 22 and 23) run in parallel with each other. Issue 24 runs once per surface as each
track finishes; the owner works through it surface by surface.

**Scope of each issue:**

1. **Publish the title snapshot to Redis from Windmill.** A new Windmill script (next to `f/sync/copy/vector_data.py`)
   builds the binary snapshot in [Title snapshot](#title-snapshot-new-redis-written-by-windmill): ids, `uint8`
   fingerprints in `CoreScores` order, genre bits, release day, score, votes, popularity, origin, and flags, with the
   genre and origin tables in the manifest. It measures the Qdrant-scroll and Crate-paged sources and uses the faster,
   writes chunks under a new version with a binary Redis client, swaps the manifest, and prunes old versions. It adds a
   nightly schedule and a run after each vector copy that publishes only when fingerprints were added or changed. Deploying the Windmill script and schedule is part of the issue; the first publish
   waits for issue 5's capacity check.
2. **Load the title snapshot and catalog statistics in the webapp.** `app/server/title-snapshot/` with the
   `TitleSnapshot` interface: load at boot and on version change, verify checksum and key order, build the id map,
   inverse norms, mood bits (using the moods module's rules, which this issue adds as `app/domain/moods.ts` with only
   the definitions and `moodsOf`), and catalog statistics. Includes a local script that writes a snapshot from a
   sample for development before issue 1 lands. Measures load time and memory.
3. **Store taste vectors per member and compute taste match.** `app/server/taste/`: the formula, quantiles, the Redis
   key, rebuild after writes (hooked into `updateScores`, `updateWishList`, and the guest import), stale detection,
   the 5-liked-title minimum, the guest path (For you and Best match from 5 guest ratings), `match`, `reasons`,
   `leanings`, and `GET/POST /api/taste/match`. Shadow logging of overlap with
   the recommend API behind `REC_TASTE_MATCH=shadow`. Measures the budgets.
4. **Add the viewer context and the per-country availability index.** `app/server/viewer.server.ts` (extending
   `getUserData` with the Wishlist's `created_at`, skipped titles, and the `for_you` setting) and `app/server/availability-index.server.ts` with background
   loads, refresh, preloading, and the fallback while loading.
5. **Declare the user tables' timestamps and confirm Redis capacity (needs owner to apply).** Adds
   `created_at` and `updated_at` to the user tables in `crate_schemas.py`, a read-only check that no Wishlist row lacks
   `created_at` (and an `UPDATE` from `updated_at` for any that do, run by the owner), and a capacity check of the
   Redis nodes for two snapshot versions (about 50 MB) and one taste key per member. No DDL runs against live tables
   because the columns exist.
6. **Add feature flags and the preview list.** `app/server/features.server.ts`, the environment variables, a loader
   helper for routes and a hook for the browser, and documentation of the Coolify variables.
7. **Serve "Recommended for you" and guest recommendations from one vector query.** Replaces the recommend call in
   `user-recommendations.server.ts` and `guest-recommendations.server.ts` with one Qdrant vector query using the stored
   (or per-request guest) vector and the same filters and exclusions, excludes by title key (media type and id, see
   [#222](https://github.com/alp82/goodwatch-monorepo/issues/222)), and shows the calibrated match on the row.
8. **Build the in-memory title filter with counts, recoveries, and For you.** `app/server/title-filter/` and
   `app/domain/for-you.ts`: the filter state, one-pass fail masks, per-option counts, recoveries, sorts, the For you
   blend for browse and search, id-set filters for Similar to, cast and crew, and the legacy filters, Not seen yet
   with skipped titles, and `GET/POST /api/discover/results`. Measures the counts over the whole catalog against the 30 ms budget.
9. **Build the shared filter bar.** `app/ui/filter-bar/`: the desktop row, sub-bar with the hidden-titles insight, the
   Filters side sheet with search and live counts, and the mobile slab with fold-on-scroll, the sort menu, and the
   snapping sheet; `useFilterState` bound to the URL, including the legacy-parameter redirect.
10. **Add the taste-match pill, reasons, and the sign-up prompt to title cards.** The pill on the existing card, the
    reasons tooltip with colored chips, and `app/ui/sign-up-prompt/` in three sizes.
11. **Build Discover browse mode on the new filter bar with For you.** The `/discover` route behind `REC_FILTER_BAR`:
    heading, sort with the For you switch saved as a member setting and in the URL, the guest and no-taste states,
    the taste explanation chips, infinite scroll, per-card movement marks.
12. **Merge Search into Discover.** Search mode on the same page: heading-to-field morph, Relevance, the ranker's
    list raised to 100 titles (`RESULT_LENGTH`, `RANKER_VERSION` `hybrid-v2`) with the display stage measured before
    and after, the ranked list through the filter bar and For you (at most 5 places), Read as chips, the glide
    transition, `/search` redirecting to `/discover?q=`.
13. **Build the moods module and the Watch next server.** The full moods module (names, descriptions, hues, rules in
    words), `getWatchNext` with sorts, fits, tiers, mood counts and pictures, the empty and small states' suggestions,
    `getTonightsPick`, and the `/api/watch-next` and `/api/tonight` endpoints.
14. **Build the Watch next page for desktop.** `/watch-next` behind `REC_WATCH_NEXT`: the docked strip, the mood grid
    dropdown, the hero with Then, the stepped grid with caps, I watched it (removing Want to See) with the score prompt
    and Undo, Not tonight, and the guest states.
15. **Build Watch next on mobile and redirect the Wishlist.** The slab with three drawers (Moods, Services, Sort),
    and the `/wishlist` redirect and header links when the flag is on.
16. **Build the Taste portrait server.** `app/server/taste-portrait/`: sides, headline, edges, More of this, You vs
    everyone, fingerprint families with edges, tiers, carriers, exceptions, identity, and most-you titles; the word
    table; the Feel family name; the identity from the family edges; the guest sample taste; caching and invalidation;
    `/api/taste/portrait`. Handles zero and few ratings without errors.
17. **Build the Taste page's three tabs.** `/taste`, `/taste/everyone`, `/taste/fingerprint` behind `REC_TASTE_PAGE`,
    with the Sides layout the owner picked, empty states, guest behavior, and accessibility.
18. **Build the Explorer server.** `app/server/explorer/`: the pool, six groupings (Mood from the moods module,
    Country with "Rest of world", Genre in place of Streaming without services), PCA positions, island payloads,
    trees, bridges (both and between), pair counts, near cards, caching per country and grouping, and the endpoints.
19. **Build the Explorer sea renderer.** `app/ui/explorer/sea/` with the `SeaRenderer` interface and its WebGL2,
    WebGL1, and Canvas 2D adapters, the backdrop atlas, context-loss recovery, idle stop, reduced motion, and the
    Safari blur check. Develops against fixture islands.
20. **Build the Explorer map.** `/explorer` behind `REC_EXPLORER`: camera and zoom stops, layout, lit posters with
    level of detail, proximity cards with actions, the filters, the poster cache, the frame budget, and the
    server-rendered list for no JavaScript.
21. **Add combining, history, minimap, keyboard, and the list view to Explorer.** Preview combining with pair counts,
    the bridge focus layout, undo gestures, `pushState` history with the two-step bar and dropdown, the minimap, all
    keyboard controls, and the accessible list view.
22. **Build the mobile dock, hub sheet, and desktop Browse panel.** `app/ui/navigation/` behind `REC_NAVIGATION`:
    the dock with Tonight's pick, the hub key and sheet with Movies and Shows, the Browse panel, the account slot, and
    the slab merge.
23. **Add the omnibox and command palette.** The omnibox with shortcuts, the palette with "Search for …" first, title
    matches, destinations, and `/api/command-palette`.
24. **Switch each surface on and verify it in production (needs owner to apply).** Per surface: `preview`, the owner's
    acceptance, `on`, the switch-over checks, and the [production verification](#production-verification) record, in
    the order of [Rollout](#rollout).
25. **Remove the replaced code.** The list in [Cleanup of replaced code](#cleanup-of-replaced-code), one commit per
    area, after each surface has been on for 7 days. `/taste/quiz` and what it imports stay.
