# Explore rethink: ship spec

This spec turns the Explore lab (twelve owner-reviewed rounds, November 18 to 22, 2026) into production. It's the brief
for every builder. The owner's decisions are fixed. Questions a builder can't answer from this file go to the
orchestrator, not into a guess.

- **Design source:** the lab defaults on branch `prototype/explore-r12` (local, worktree
  `~/.cache/gw-explore-r4/wt`), code under `goodwatch-webapp/app/prototype/explore/`. Each part's shipped variant is the
  `fallback` in `concepts/lab/slots/<part>/slot.ts`. `README.md` there documents the kit. Run the lab with
  `.harness/serve-explore.sh` (read-only gateway, never the production `.env`).
- **Production base:** `origin/main` at `103ecbfc5`, build branch `explore-ship`.
- **Never merge the prototype branch.** It carries round 2 and 3 prototypes (`app/ui/prototype-mnav-*`,
  `app/ui/prototype-movies-nav/*`) and a harness change to `app/utils/auth-session.ts`. Port code file by file.

## Owner decisions (2026-11-22)

| Decision | Effect |
|---|---|
| One release | Everything ships together. No feature flags (standing rule: ship to everyone). |
| Mixer, themes, and styles stay out | Mixer isn't built. Theme and style pages aren't in any nav, index, or sitemap. They still resolve as blend parts (`?with=theme:crime`, `/movies/themes/crime`) so blends don't break. |
| Only the lab defaults ship | No variants, no lab panel, no `?lab=`, no Round 4 concepts. Where the owner liked two variants, the orchestrator's accepted pick ships (see the target surface). |
| Lab is recorded in `docs/prototypes` | Follow the convention of `docs/prototypes/explorer-world/`: a README with the rounds and verdicts, plus key screenshots. |
| Permanent redirects | Every old Explore and category address answers 301 to its new address: "otherwise SEO would do a nosedive". |
| Indexing | Single places and two-part path blends with enough titles are indexable. Three-part blends, `?with=` blends, and `/all` pages are `noindex, follow` and stay out of the sitemap. State parameters canonicalize to the path. |
| Data before launch | Mood-rule accuracy pass, and the *You Can See Everything* (2026) ratings anomaly fixed at its source. |
| TV Tropes excerpts | Allowed, with attribution and a link to the TV Tropes page (CC BY-NC-SA). |
| Precompute | Request-time aggregation (tropes, streaming numbers, defining tropes) moves to precomputed data. |
| Best becomes Top | In nav, titles, headings, meta, and copy. URLs move to `/<kind>/top` with a 301 from `/<kind>/best`. |

## 1. Current production surface

### Routes in scope (`goodwatch-webapp/app/routes/`)

| Route file | Answers | Notes |
|---|---|---|
| `$type._index.tsx` | `/movies`, `/shows` | Hub of the old category pages. `presentCatalogLoader`. |
| `$type.$category._index.tsx` | `/movies/moods`, `/movies/genres`, `/movies/streaming` (and `/shows/...`) | Category index (`MovieTvList`). |
| `$type.$category.$page.tsx` | `/movies/moods/<slug>`, `/movies/genres/<slug>`, `/movies/streaming/<slug>` | Category page (`MovieTvGrid`, `FAQ`, `requireCategoryPage`). Title "<Page> <Type>: Where to Stream Them". |
| `$type.best.tsx` | `/movies/best`, `/shows/best`, `?page=N` | Ranked list (`~/server/best-lists.server`, `~/ui/best-lists/*`). Each page has its own canonical. A page past the last is 404. |
| `explore.$type.$category.$text.tsx` | `/explore/<type>/<category>/<text>` | 301 via `formerExplorePath`, else 404. |
| `tv-shows.$.tsx`, `tv-shows._index.tsx`, `tv-shows.$category._index.tsx`, `tv-shows.$category.$page.tsx` | `/tv-shows/...` | 301 to `/shows/...` (`~/server/former-tv-shows.server`). |
| `discover.($type).tsx` | `/discover` | Already `noindex, follow`. Out of scope, but it's the target of "More filters in Discover". |
| `new.$country.$service.tsx`, `new.$where.tsx`, `new._index.tsx` | `/new/...` | Kept. The service page links to it ("New on Netflix"). |
| `sitemaps.$file.tsx`, `sitemap[.]xml.ts` | Removed sitemap files answer 410 | Sitemaps are static files in `public/sitemaps/`. |

The address rules live in `app/ui/explore/address.ts` (`exploreAddressExists`, `formerExplorePath`,
`formerTvShowsPath`), `config.ts` (`validUrlParams.type = ["movies","shows"]`), and `main-nav.ts` (`mainHierarchy` =
moods, streaming, genres; other categories are commented out).

### Current category pages

From `app/ui/explore/category/*.ts`:
- **Moods:** 20 slugs, all for both kinds: scary, feel-good, suspense, motivational, funny, psychological, nostalgic,
  melancholic, bittersweet, whimsical, peaceful, adrenaline, epic, romantic, gritty, mind-bending, morally-complex,
  atmospheric, visually-stunning, educational. These are the old emoji moods, not the 16 moods in `domain/moods.ts`.
- **Streaming:** netflix, amazon-prime, disney-plus.
- **Genres:** 27 slugs, filtered per kind: action-and-adventure, action, adventure, animation, comedy, crime,
  documentary, drama, family, fantasy, history, horror, kids, music, mystery, news, reality, romance, scifi-and-fantasy,
  science-fiction, soap, talk, thriller, tv-movie, war-and-politics, war, western.

### Navigation

- **Explore row:** `app/ui/navigation/areas.ts`, `EXPLORE_TABS`: Discover, New, Hot, Best (`/movies/best`), Awards,
  Movies (`/movies`), Shows (`/shows`), People, Map. `bestSwitch()` is Best's Movies | Shows row. `EXPLORE_PREFIXES`
  decides which paths light Explore.
- **Phone:** `app/ui/navigation/phone-bar.ts`, `PhoneBar.tsx`, `MobileDock.tsx`, `SubNav.tsx`, `AreaTabs.tsx`.
- **Command palette:** `app/ui/navigation/palette-pages.ts`, `app/server/command-palette/groups.server.ts`.

### Sitemaps (what Google may know)

`scripts/create_sitemaps.py`, run by Windmill `f/seo/regenerate_sitemaps.py`:
- `public/sitemaps/sitemap_static.xml` lists `/movies`, `/movies/best`, `/shows`, `/shows/best`, `/people`,
  `/awards`, `/discover`, `/map`, `/hot`, and static pages.
- `public/sitemaps/sitemap_categories.xml` has 87 URLs: `/movies/genres` (20), `/movies/moods` (21),
  `/movies/streaming` (4), `/shows/genres` (17), `/shows/moods` (21), `/shows/streaming` (4). That's each index plus
  the slugs above.
- Older history: `/explore/...`, `/tv-shows/...`, and `/tv/...` addresses already redirect. Point them straight at the
  new targets so there's no redirect chain.

### Internal links to the old pages

Update all of these (found with `git grep`):

```
app/domain/best-lists.ts                 app/ui/footer/links.tsx
app/domain/member-paths.ts               app/ui/how-it-works/features.ts
app/server/title-breadcrumb.server.ts    app/ui/fingerprint/fingerprintText.ts
app/server/command-palette/groups.server.ts   app/ui/living-room/BelowRoom.tsx
app/server/genre-row/row-genre.ts        app/ui/feedback/areas.ts
app/server/discord/profile-cards.ts      app/ui/navigation/{areas,destinations,palette-pages}.ts
app/server/start-page/browse.server.ts   app/ui/nav/breadcrumb-trail.ts
app/ui/explore/page-copy.ts              app/ui/og-image/copy.ts
app/ui/profile/header/VisitorView.tsx    app/ui/start/browse/browse-data.ts (+ its test-support files)
app/navigation/route-code-warmup.test-support.ts
goodwatch-webapp/DESIGN.md
goodwatch-benchmark/{smoke/urls.json, pages/pages.json, navigation/*.mjs, html-weight/*.json, html-equivalence/*}
```

## 2. Target surface

### Address tree

The pure model ports from the lab's `kit/address.ts`.

- **Kinds:** `/movies`, `/shows`, `/all` (movies and shows together). `all` merges three genre pairs into
  `action-adventure` (Action & Adventure, Action, Adventure), `sci-fi-fantasy` (Sci-Fi & Fantasy, Science Fiction,
  Fantasy), and `war-politics` (War & Politics, War). A part's own slug under `/all` leads to its merged place.
- **Families and segments:** mood `moods`, genre `genres`, decade `decades`, country `countries`, service
  `streaming/<country>`, trope `tropes`, plus theme `themes` and style `styles`, which resolve but aren't listed.
- **Pages:**
  - Hub: `/<kind>`.
  - Family index: `/<kind>/moods`, `/genres`, `/decades`, `/countries`, `/streaming/<country>`, `/tropes`.
  - Place: `/<kind>/<family>/<slug>`, and `/<kind>/streaming/<country>/<service>`.
  - Path blend, a lead plus its pair family: mood→genre `/moods/cozy/comedy`, genre→decade `/genres/comedy/1990s`,
    country→genre, service→mood, theme→decade, trope→decade `/tropes/final-girl/1980s`.
  - Any further part goes in `?with=family:slug,...`, for example `?with=trope:butt-monkey,country:south-korea`.
  - Top: `/<kind>/top`, with `?page=N` and filters `?with=` and `?year=`.
- **Slugs:**
  - Moods: `coming-of-age`, `cozy`, `crime-mystery`, `dark`, `deep`, `funny`, `history`, `magical`, `other-worlds`,
    `quirky`, `romantic`, `sad`, `scary`, `tense`, `thrilling`, `trippy`, from the labels of `domain/moods.ts`.
  - Genres: the ASCII slug of the TMDB name (`asciiSlug` in `kit/rows.server.ts`).
  - Decades: `1930s` to `2020s`.
  - Countries: the ASCII slug of the English name, with `turkiye` and `hong-kong-sar-china` as written. That's 76
    countries above the page minimum, and every production country resolves.
  - Services: `netflix`, `amazon-prime`, `disney-plus`, `hbo-max`, `hulu`, `paramount-plus`, `peacock`, and so on.
    Tiers fold into the brand (`domain/new-on-services`).
  - Tropes: the TV Tropes page slug (`final-girl`, `chekhovs-gun`).
- **State parameters:**
  - List state: `sort`, `page` (Top only), `at` (the grid's offset), `mine`, `unseen`.
  - Dials: one parameter per dial id, holding its nearest named stop, plus `fine=<id>:<percent>` for a knob between
    stops.
  - The lab's `?when=` and `?from=` forms redirect into the path or `?with=` (see the redirect map).
- **Page minimum:** a place is a page when it has at least `MIN_PAGE = 24` well-known titles. A well-known title has
  1,000 or more ratings and is presentable and not adult (`MIN_VOTES` in the counts module).

### Pages and their shipped parts

| Page | Shipped design (lab part = variant) | Parts and notes |
|---|---|---|
| Frame, every page | Explore row tab **Browse** (replaces the Movies and Shows tabs); **Top** tab between Hot and Awards; Browse subnav row; `kind` = **Ampersand** | Subnav row: Movies & Shows control on the left, with its lighter track running to the screen's left edge, then Overview · Moods · Genres · Eras · Places · Streaming · Tropes on the right. Top pages show no subnav row; their Movies \| Shows control sits in the Top header. The amber dot glides to the lit room. On a blend, `blend-room` = **Every part's room** lights each family the blend contains. Visible breadcrumbs are gone; BreadcrumbList stays as invisible structured data. |
| Hub `/<kind>` | `hub` = **Miniatures** | Tiles: moods (mini lattice, feel words, "Known for" tropes, poster fan), eras (draggable decade ribbon, fixed height), Top (auto-switching lists, title-as-row with the key word as progress and next button, about 20 lists per kind, pause on hover), "For the night you're having" (occasion blends), places (flag-filled map with zoom and pan, eased wheel zoom, full-width flag rail with arrows, flags hinted at rest), genres (full row, fixed height, no colored words on the list), streaming (full row, logo grid). Plain facts as tile subtitles ("16 moods"). |
| Moods index | `moods` = **Faint still + type** | Lattice (lighter↔darker × calmer↔intense). Cards: large name, rule, mood-color gradient over a barely visible still. A fit strip follows the dials only; "Fits", "Fits best", or "Doesn't fit". Dials use the empty state. |
| Mood, genre, theme, style, and every blend | `mood`/`genre`/`other`/`blend` = **Grid first**; `mood-steer` = **Steer rows**; `blend-entry` = **Add after the title**; `grid-out` = **Like the mood page** | The title is the blend: each part underlined in its color, swappable and removable, **+ Add**. **About this selection** has the lattice glyph and one card per part (trope one-liner + link). Steering column: **Blended in** (set parts with ×), How it feels (dials), Narrow it down (decade, country with flags), Blend one in (genre, mood, trope), For you (services, not seen). The steering column and grid are one screen tall. The grid fills it exactly. Prev and Next step by the visible count, the footer shows a compact range and a Discover link, and the last page shows "Keep going in Discover". Sort sits on the right. "More filters in Discover ↗" is a way out. Sections below: essentials, Goes well with (fills its row), people, awards. Hover word cards render in a portal and use plain words. |
| Genres index | `genres` = **List beside** on desktop, **Chip row** on phone (orchestrator's accepted pick; the lab fallback is Tiles) | The opened genre card (words, line, "All 29k dramas", defining titles, kinds as linked poster fans) and the "Beyond the obvious" picks row (Hidden gem, Recent standout, Still holds up, Off the main road, Everyone's watching). |
| Eras index | `eras` = **Scrub** | Draggable ribbon with momentum and snap, lens on nearby frames, standout posters. |
| Era page `/decades/<d>` | `era` = **Year dial** (on the room page) | Dial across the top, the year in rolling numerals, lead title large. On phones the dial comes before the shift panel. Decades in order on one line with similar ones lit. Flag-filled country cards. |
| Places index | `places` = **Dials on the map** | Full-width map: flags hinted at rest, warm fit scale with numbers when dials are set, scale-fade names. "Most titles" / "Best fits" cards under the map, then **Every country** with search and region chips. |
| Country page | `country` = **Next door** | Zoomed map head and curated copy, Next door band under the head, "Where to go from here" under the list (no duplicates). "Countries like …" takes the full width when there are no pairings. No `/map` links. |
| Streaming index `/<kind>/streaming/<country>` | `streaming` = **Directory** | "Streaming in [flag] Country ▾" picker (search, top 8, by region). All / Subscription / Free filters. Sorts: **Most popular** (default; share of the country's 1,000 most popular titles), Most titles, Most scored 80+, Most new this month, A to Z. Rows: library, "+1k new · −2k gone" (green and red), G 80+ chip in score color, fan (falls back to popular titles). One FLIP motion on re-sort. |
| Service page | `service` = the round 4 room page (rename it) | Full-width "What's new on X" teaser row, colored mood links for strong on and thinner on, Goes well with fills its row, people strip with shared arrows. |
| Tropes index | `tropes` = **Trope cards** | "In the spotlight" card with a fixed height (only tropes whose text fits); **Surprise me** swaps it in place. 113 hand-written tropes in 11 indexes as rows of cards (fan, one-liner, teaser). |
| Trope page | `trope` = **Built from parts**; `trope-body` = **Casebook**; `trope-spoiler` = **Specks**; `trope-below` = **Full rows** | Header (name, one-liner, "Usually played straight", TV Tropes excerpt + link, feel words) and sidebar (Often seen with, Rarely seen with). Casebook: three large cases, then compact rows, eight per page, Prev and Next. Twist tags in plain words. Specks spoilers: canvas, non-repeating, the text keeps its exact space; click reveals, the revealed text keeps a faint mark, click again hides. Page switch with a fixed width. Ending and Death tropes hide whole write-ups. Below: How it grew (tall decade row), Blend it (cards), Who keeps using it. **+ Add**. |
| Top `/<kind>/top` | `best` = **Poster ranking** | Dials as pills in the filter row; production poster cards; aligned source score cells; the number is the place on this page, with "No. N overall" when the dials re-sort. Keep production's `?page=N` paging (25 per page) and its 404 past the last page. `/all/top` merges both rankings. |

**Shared kit pieces that ship:**
- Dials (`concepts/dials/Dial.tsx`, `Tuner.tsx`, `tune.ts`): empty state with no knob until touched, 6 to 10 resting
  places, drag that follows every frame and settles on the previewed stop, reserved width, neighbor jump and "Keep
  going".
- Place cards: `card` = **Peek**.
- `FlagShape` with its `state` prop.
- `CountryShape` and the world map geometry.
- `count()` for Discover's compact counts.
- Shared row arrows: `~/ui/row-arrows`.
- Motion constants (`QUICK_T`, `GLIDE_T`, `MOVE_T`, including translate, rotate, and scale).
- Copy decks (`kit/copy/*`) and hand-written kind names (`kit/kind-names.ts`).

**Dropped:**
- Mixer, Round 4 hub, and all non-default variants.
- The lab panel, `?lab=`, the `gw-lab` cookie, Copy picks, and "Lab · stages".
- The Round 4 concepts (`concepts/{rooms,dials,blend,guide}` as concepts; only their parts that the shipped pages
  import are ported) and the `_kit` gallery and bench.
- The tray and Venn.
- Themes and styles in any index or nav.
- The `trait` family as a page (`/traits/<slug>` redirects; trait fingerprints stay as dial and blend internals).

## 3. Redirect map (all 301, query preserved unless stated)

Point straight at the final target. Never chain through an intermediate redirect.

| Old | New |
|---|---|
| `/<kind>/best` (+ `?page=N`) | `/<kind>/top` (+ `?page=N`) |
| `/<kind>/moods/<old slug>` | `/<kind>/moods/<new slug>` using the table below |
| `/<kind>/genres/action-and-adventure` | `/<kind>/genres/action-adventure` |
| `/<kind>/genres/scifi-and-fantasy` | `/<kind>/genres/sci-fi-fantasy` |
| `/<kind>/genres/war-and-politics` | `/<kind>/genres/war-politics` |
| `/<kind>/genres/<same slug>` | No redirect (same address, new page) |
| `/<kind>/streaming` | `/<kind>/streaming/us` (stable for crawlers; in-app links use the viewer's country) |
| `/<kind>/streaming/<service slug>` (`netflix`, `amazon-prime`, `disney-plus`; any slug that's a service, not a country) | `/<kind>/streaming/us/<service>` |
| `/<kind>/traits` | `/<kind>/tropes` |
| `/<kind>/traits/<slug>` | 301 to the trope page when a trope matches the trait (hand map in the redirect module), else to `/<kind>/tropes` only if that index is the closest page; otherwise 404. Never a soft 404. |
| `/<kind>/<blend path>?when=<decade>` / `?from=<country>` | The same blend with the decade or country as a real part (in the path when it's the pair, else in `with`) |
| `/explore/<type>/<category>/<text>`, `/tv-shows/...`, `/tv/...` | The final new address via the same tables; 404 when nothing replaces it (current rule) |
| Any old category page with pagination or filter parameters the new page doesn't read | Drop those parameters |

**Old mood slugs.** The proposed map is below. Rows marked **verify** must be confirmed by title overlap: compare the
old page's Discover query results with each new mood's titles (Jaccard) and take the best match. The builder reports
the numbers.

| Old | New | | Old | New |
|---|---|---|---|---|
| scary | scary | | whimsical | quirky |
| feel-good | cozy | | peaceful | cozy (verify) |
| suspense | tense | | adrenaline | thrilling |
| motivational | coming-of-age (verify) | | epic | other-worlds (verify) |
| funny | funny | | romantic | romantic |
| psychological | trippy (verify) | | gritty | dark |
| nostalgic | cozy (verify) | | mind-bending | trippy |
| melancholic | sad | | morally-complex | deep |
| bittersweet | sad | | atmospheric | tense (verify) |
| visually-stunning | other-worlds (verify) | | educational | history (verify) |

The lab answers 200 for `/movies/streaming/netflix`, because it reads `netflix` as a country. Production must check the
service slugs before it treats the segment as a country.

## 4. Indexing, sitemap, structured data

- **Indexable (`index, follow`, self canonical without state):**
  - The hubs `/movies` and `/shows`.
  - The family indexes for movies and shows (streaming per country: `/<kind>/streaming/<cc>`).
  - Single places with at least 24 well-known titles, for movies and shows.
  - Two-part path blends with at least 24 titles.
  - Top page 1 and its `?page=N` pages, which keep their own canonicals as today.
  - Trope pages.
- **`noindex, follow`, out of the sitemap:**
  - Everything under `/all`.
  - Any page with `?with=`.
  - Three-or-more-part blends.
  - Places and blends under the page minimum.
  - Theme and style pages.
- **State parameters canonicalize to the page without them:** `sort`, `at`, `mine`, `unseen`, dial ids, and `fine`.
  The page's own index rule still applies.
- **Sitemap:**
  - Rewrite `create_sitemaps.py` and its tests (`scripts/test_sitemap_*`) to list the indexable set above from the
    precomputed place counts. That covers `/<kind>/{moods,genres,decades,countries,tropes}` and their places, the
    two-part blends above the minimum (cap them by title count if the file grows past the 50k-URL limit), streaming
    per country and service, and `/<kind>/top`.
  - Remove the old category file's entries and replace `/movies/best` and `/shows/best` with `/top` in
    `sitemap_static.xml`.
  - Run `check_sitemap_urls.py`: every listed URL must answer 200 with `index`.
- **Structured data:** BreadcrumbList on every page, matching the subnav location (visible breadcrumbs removed). Keep
  the existing ItemList on Top. A trope page credits TV Tropes in visible text and links to the trope's page.
- **Meta:** each page's title and description come from the copy decks, not from slugs. For example: "Cozy movies |
  GoodWatch", "Top movies of all time | GoodWatch". `og-image/copy.ts` follows.

## 5. Port plan

### Where code goes

The production names follow the nav, which calls the area **Browse**. That also keeps it apart from the shipped
Explorer (`app/server/explorer`, `app/ui/explorer`).

| From the lab | To | Notes |
|---|---|---|
| `kit/address.ts` | `app/domain/browse/address.ts` | Pure. Drop `PREFIX`, `href(concept, …)`, the `kit` view, `venn`, `level`, and `k`. Add `top` and the redirect resolver (`app/domain/browse/redirects.ts`) with unit tests. |
| `kit/types.ts`, `kit/words.ts`, `kit/count.ts`, `kit/copy/*`, `kit/kind-names.ts` | `app/domain/browse/*` | Copy decks are hand-written content; keep them as is. Kind names are keyed by `kind|family:slug|leadTrait`. |
| `kit/data.server.ts`, `kit/rows.server.ts`, `ui/prototype-movies-nav/counts.server.ts` (**not on main**) | `app/server/browse/{places,rows,counts}.server.ts` | Split the 1,715-line kit into place data, lists, and kinds. Counts are computed once per snapshot version in the snapshot worker, or cached per version. |
| `kit/tropes.ts`, `kit/tropes.server.ts`, `slots/tropes/model*`, `slots/trope/*` | `app/domain/tropes/*`, `app/server/browse/tropes.server.ts` | The 113 hand-written tropes and indexes; the spoiler parser (TV Tropes `[[spoiler:…]]` and HTML marks, Ending and Death tropes hidden as a whole). |
| `concepts/dials/{Dial,Tuner,tune}` | `app/ui/browse/dials/*` | The only part of the dials concept that ships. |
| `kit/ui/*`, `kit/world-map/*` | `app/ui/browse/*`, `app/ui/browse/world-map/*` | `build-shapes.mjs` and `shapes.ts` (generated geometry) move together. |
| `concepts/rooms/{bar,place,parts,bits,decade-line,loader.server}` | `app/ui/browse/{SubnavRow,PlacePage,…}` + loaders | `bar.tsx` becomes the Browse subnav row; `place.tsx` becomes the place page frame for era, country, and service. |
| `concepts/lab/slots/<part>/<default>.tsx` (+ `.server.ts`) | One component and loader per page under `app/ui/browse/<page>/` and `app/server/browse/<page>.server.ts` | Flatten: no registry, no `Part`, no slot contract, no `useLab`. Inline each sub-slot's default (steer rows, specks, casebook, full rows, peek cards, plus entry, every part's room). |
| `shell/*` | `app/routes/*` + `areas.ts` | The Explore row and Browse tab go into `EXPLORE_TABS`. The lab's `Shell.tsx` and `load.server.ts` are not shipped. |

- **Naming:** no `lab`, `slot`, `variant`, `r4`, `round`, `rooms`, `concept`, `kit`, `PROTOTYPE`, or `throwaway` in
  production file names, identifiers, comments, CSS classes (`gw-spoil` is fine), or data attributes
  (`data-lab-*`). Each ticket's acceptance includes a grep for these.
- **Routes:**
  - Replace `$type._index.tsx`, `$type.$category._index.tsx`, `$type.$category.$page.tsx`, and `$type.best.tsx` with
    Browse routes.
  - `$type` accepts `movies`, `shows`, and `all`. Check that `/all` collides with no other route.
  - Use one splat loader per kind that parses with `parse()` and dispatches to the page, or a handful of flat routes.
    Either works, if the 404 rule holds: unknown answers 404, never a redirect to a hub.
  - The old address helpers in `app/ui/explore/address.ts` go once the redirect module covers them. Delete the old
    category UI (`app/ui/explore/{category,MovieTvGrid,MovieTvList,MovieTvSwiper,FAQ,page-copy,…}`) only when nothing
    imports it.

### Request-time work to precompute

| Today in the lab | Cost | Precompute | Where |
|---|---|---|---|
| Trope membership (`SELECT media_type, media_tmdb_id FROM trope WHERE url = ?`, 3.8M rows, about 4 s first load per process), played/twist shares, "often/rarely seen with", defining tropes per place, How it grew | CPU and memory per process, cold start | Per trope: member title keys (well-known only), twist share, co-occurrence lists, decade counts, spotlight eligibility; per place: top defining tropes | New Windmill script (for example `f/sync/copy/browse_tropes.py`) next to `f/sync/copy/title_snapshot.py`. It writes a versioned Redis sidecar the webapp loads like the title snapshot (manifest + chunks, checked once a minute). |
| Trope excerpts (`trope` content, `trope_catalog_page` description) | Per-page Crate reads | Keep request-time reads, with a short cache (they're small, per trope page) | `app/server/browse/tropes.server.ts` |
| Streaming numbers (`streaming_availability` counts per country, `availability_history` new and gone over 30 days, popular share, 80+ counts, tier folding) | Several Crate aggregations per page | Daily per country × service × kind: library, new_30d, gone_30d, popular_share, scored_80 | Windmill, after the availability sync, into Redis (`browse:streaming:<cc>`), or a small Crate table. Webapp reads one key per page. |
| Place counts and pair counts (`counts.server` over the snapshot) | Full snapshot scan | Same computation, once per snapshot version | Snapshot load worker (`title-snapshot.worker.ts`) or a memoized per-version cache |
| Kinds (clusters per place, `clustersOf`) | Per-request clustering for places with 60+ titles | Memoize per place per snapshot version (LRU) | `app/server/browse/kinds.server.ts` |
| People, awards, essence text, original language (`person_worked_on`, `person_appeared_in`, `person`, `award_title_display`, essence, original language) | Crate reads per page | Cache per place per version (page cache) | Existing page-cache pattern (`app/server/page-cache.server.ts`) |

### T1 APIs (built, for T2 to T6)

T1 kept the precompute in the webapp's shared Redis cache (`cached()` in `~/utils/cache`, deduplicated across the
fleet, served stale while it refreshes) instead of new Windmill scripts. The directory of tropes stays in one place
(`~/domain/tropes`, TypeScript), every Crate statement involved runs well under a second except the first trope load,
and nothing needs a deploy or schedule beyond the webapp. Measured in the harness: a fresh process loads all 113
tropes' members from Redis in about 20 ms (369k title-trope pairs, about 1.5 MB); the US streaming directory takes
300 ms on first call and 2 ms after.

- `~/domain/tropes/play` — `Play`, `PLAY_IDS`, `playOf(text)`, `isPlay`. T6 ports the directory (`TROPES`, groups,
  one-liners, twist tag words) next to it and imports `Play` from here instead of porting its own.
- `~/server/browse/trope-members.server` — `ensureTropeMembers(pageNames)` (call with the directory's TV Tropes page
  names, `TROPES.map((t) => t.id)`; the first call waits, later refreshes run in the background every six hours),
  `tropeMembersReady(pageNames, ms)`, `tropeMembers(pageName): TropeMembers | null` (null before the first load),
  `tropeMembersVersion()` (put it in the key of anything derived), `tropePlay(pageName, key)`, `tropeUrlOf(pageName)`.
  Cache name `browse-trope-members-v1`: a day fresh, a week stale.
- `~/server/browse/trope-members` — `TropeMembers`: `size`, `bentCount`, `twistShare`, `has(key)`, `play(key)`,
  `bent()`, `keys()`. Every title with a write-up counts; filter to well-known titles with the snapshot where a page
  needs that. Co-occurrence ("often/rarely seen with"), How it grew, spotlight eligibility and defining tropes per place
  are computed from these in memory; wrap them in a version memo keyed by `snapshot.version` + `tropeMembersVersion()`.
- `~/server/browse/version-memo` — `createVersionMemo<V>(limit)` → `get(version, key, compute)`: a new version empties
  it, LRU beyond `limit`. T2 wraps place counts and pair counts (`counts.server`) with it keyed by
  `getTitleSnapshot().version`, and T3 wraps kinds (`clustersOf` per place) the same way.
- `~/domain/browse/streaming-stats` — pure: `PLAN_TYPES`, `MIN_SERVICE_TITLES`, `serviceGroupOf`, `countPerGroup`,
  `groupsOf`, `foldTiers`, `sortServices(services, "popular" | "titles" | "great" | "new" | "name")`.
- `~/server/browse/streaming-stats.server` — `streamingDirectory({ country, kind, wellKnownRows, rowsKey?, sort? })`
  → `{ country, kind, services: StreamingService[], ready }` with each service's `key`, `name`, `logoPath`,
  `brandSlug`, `serviceIds`, `model`, `titles`, `arrived`, `left`, `popular`, `great`, `picks: TitleKey[]`. Pass the
  Browse lists' well-known rows of the kind, most popular first (T2's rows port), so "well-known" means the same as on
  every list. Also `streamingCountries()` (codes with plan offers, most first) and `streamingCounts(country)`. Cache
  names `browse-streaming-counts-v1` (six hours) and `browse-streaming-countries-v1` (twelve hours).

Left for the page tickets: trope excerpts and catalog openings (request-time with a short cache, T6), people, awards
and essence reads per place (page cache, T3/T4).

### Data fixes before launch (tracked separately, must land first)

- **Mood rules:** 16 rules in `domain/moods.ts` and the fingerprint rules behind them. Known misses: *Bride of Chucky*
  is Romantic, *Star Wars* is Cozy, *Schindler's List* is Trippy. History is the largest mood (13.7k movies).
- **The *You Can See Everything* (2026) anomaly:** number 5 on the all-time list, with about 846,000 ratings. Find the
  source of the rating count and fix it there.

## 6. Work order (tickets)

Each ticket runs on `explore-ship` (or a branch from it, merged back) and ends with:
- `npm run format` and `npm run check -- --base <ticket base>`.
- The relevant node tests.
- The type check (gated, one at a time).
- Screenshots at 1440 and 390 through the read-only harness, opened and judged.
- 200 sweeps of the ticket's pages.
- The naming grep, with commits ending in the attribution lines.

At most two builders run at a time (memory).

1. **T1, data and precompute (backend).**
   - **Scope:**
     - The trope sidecar Windmill script, plus its webapp loader.
     - The streaming stats job, plus its reader.
     - Counts per snapshot version.
     - The kinds memo.
   - **Acceptance:**
     - Python tests next to the existing `goodwatch-flows/tests/test_title_snapshot.py`, and webapp loader tests.
     - A preview job run against production data in Windmill (read-only).
     - The cold-start trope page loads in under 300 ms server time.
   - Can run in parallel with T2.
2. **T2, foundation: addresses, routes, redirects, frame, Top rename in nav.**
   - **Scope:**
     - `app/domain/browse/address.ts` and `redirects.ts`, with exhaustive tests: every row of section 3, every
       `sitemap_categories.xml` URL, `/explore` and `/tv-shows` forms, unknown → 404.
     - The new routes, answering 404 except the hub.
     - The Explore row (Browse, Top between Hot and Awards), the subnav row with the Ampersand kind control, and phone
       nav parity.
     - `EXPLORE_PREFIXES` gains `/all`, and `isBest` becomes `isTop`.
     - Kit server port: places, rows, counts, copy, kind names, count helper.
     - The old category routes switch to redirects.
   - **Acceptance:** redirect tests green, the nav at 1440 and 390 for Movies, Shows, and both.
3. **T3, place page.**
   - **Scope:**
     - Grid first with steer rows.
     - The ported dials.
     - About this selection, and the blend title with swap, remove, and + Add.
     - Every part's room, and `?when=`/`?from=` → parts.
     - The grid footer and Discover exit.
     - Sections below, Peek cards, and the portal word cards.
     - Mood, genre, theme, style, and every blend.
   - **Acceptance:**
     - Cozy, Comedy, `/movies/moods/cozy/comedy`, the four-part `/all/moods/cozy/comedy?with=trope:butt-monkey,country:south-korea`.
     - A dial set, then reload.
     - Prev and Next.
     - Screenshots.
4. **T4, index pages.**
   - **Scope:** Miniatures hub, Faint still moods, List beside genres, Scrub eras, the Year dial era page, the Dials on
     the map places page, and the Next door country page.
   - Depends on T3 (cards, dials, place frame).
5. **T5, streaming and service.**
   - **Scope:** Directory with the country picker and sorts, from T1's stats, and the service page.
   - Depends on T1 and T2.
6. **T6, tropes.**
   - **Scope:**
     - The index, with cards, the spotlight, and Surprise me.
     - The trope page: Casebook, specks with re-hide and the page switch, Full rows, and + Add.
     - The spoiler parser and its tests.
     - TV Tropes attribution.
   - Depends on T1 and T3.
7. **T7, Top.**
   - **Scope:**
     - `/<kind>/top` with poster ranking, dial pills, paging, filters, and `/all/top`.
     - Every user-visible "Best" becomes "Top": `ListHead`, meta, og copy, footer, palette, feedback areas, start
       doors, how-it-works, Discord cards.
     - Rename internal modules where it's cheap (`best-lists` → `top-lists`), keeping cache keys stable or versioning
       them on purpose.
   - Depends on T2.
8. **T8, SEO and links.**
   - **Scope:**
     - Robots and canonical per section 4.
     - BreadcrumbList.
     - The sitemap generator rewrite with tests.
     - The internal link sweep (every file in section 1), and the benchmark URL lists.
     - A crawl test: start at `/movies` and follow links two levels. No 404s, no redirects among internal links, every
       indexable page self-canonical.
   - Depends on T3 to T7.
9. **T9, record and ship.**
   - **Scope:**
     - `docs/prototypes/explore-lab/README.md`: the question, rounds 4 to 12 with the owner's verdicts, the lab's
       part/variant contract, and where the code went. Add the key screenshots from `~/.cache/gw-explore-r4/shots/`.
       The prototype source stays on branch `prototype/explore-r12`; the owner asked for the lab to be committed in
       the prototypes folder, so include the lab source as a reference copy under
       `docs/prototypes/explore-lab/source/` (not built, not imported).
     - A full sweep at both widths.
     - Final review, fetch and integrate `origin/main`, push to main.
     - Watch the Coolify deploy.

## Risks

1. **Old mood redirects are semantic guesses.** Twenty old moods fold into 16. A weak match ("nostalgic" → cozy) keeps
   the URL alive but may not keep the ranking. Confirm the **verify** rows by title overlap.
2. **Production memory and cold start.** The lab loads trope membership (3.8M rows) and does snapshot scans per
   process. Without T1, production instances pay seconds and hundreds of MB at start, and Explore pages time out under
   `OVERLOAD_SHED`.
3. **Request-time Crate load.** People, awards, essence, and availability-history reads on every place page multiply
   with blends. Cache per place per snapshot version, or precompute.
4. **Indexable surface size.** Two-part path blends × kinds can reach tens of thousands of URLs. The page minimum and a
   sitemap cap keep thin pages out; check the count before submitting.
5. **Kind names are keyed by cluster lead trait.** If re-clustering moves a lead trait, the hand-written name falls
   back to hidden. Test that the hand-named kinds still appear after a snapshot change.
6. **The streaming index at a country address.** `/movies/streaming` redirects to `/us` for crawlers, so a German
   visitor who follows an old link lands on the US list. The picker fixes it in one tap. The in-app links must carry
   the viewer's country.
7. **A hidden dependency off main.** The kit imports `app/ui/prototype-movies-nav/counts.server.ts`, which exists only
   on the prototype branch. Port it inside T2.
8. **Machine memory for builders.** Earlier rounds hit the out-of-memory killer with three or more builders. Keep two,
   gate type checks, and stop preview servers.
9. **TV Tropes.** Excerpts are CC BY-NC-SA. Credit and link on every page that shows write-ups. Crawling rules are
   unchanged: no scraping, bounded requests, stop on a challenge.
