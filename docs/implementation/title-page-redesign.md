# Title page redesign

The owner locked in a new movie and show page on October 29, 2026, after 15 prototype rounds: "lets lock this in and
ship to main!" This document is the build spec for moving it into production.

- **Prototype (primary source):** local branch `prototype/title-page` (final commit `a3b6aa4db`), worktree
  `~/dev/projects/goodwatch/proto-title-page`. Code in `goodwatch-webapp/app/ui/prototype-title-page/`.
- **What was chosen:** variant FP23. It is the page I6 ("Your picks") with FP23 as its fingerprint section.
  Entry point: `app/ui/prototype-title-page/VariantFP23.tsx`.
- **Integration branch:** `feat/title-page` (this document's branch). Every ticket merges here; `feat/title-page` merges to
  `main` once, when the page is complete and reviewed.

## What ships

One page for movies and shows, replacing today's layout (`app/ui/details/Details.tsx` and the parts only it uses):

- **Opener:** backdrop band with the trailer card; every video plays in the band (the stage), cycling with ‹ ›; poster,
  title, verdict (scores), genres, meta.
- **Thin sticky title bar:** mini poster, title, year, type, seasons and episodes, age rating, GoodWatch score; a click
  goes to the top; Top button at the right edge; a split button Play / "Now playing · X".
- **Right rail on desktop:** the sticky You block (Seen + score, Want to See, Not interested as production's
  `ActionButton kind="hide"`), find in title, and "On this page" with progress lines (every section on screen is
  highlighted). Phones: a sticky section bar at the top with the index and find.
- **Find in title:** finds text on the page and every person in the cast and crew, on the server.
- **Sections:** Where to watch, Fingerprint, Story, Cast, Crew, Related (series, more like this, related map), Facts,
  Tropes, episodes for shows, questions, genre row, Talked about now. No Media section: videos live in the opener.
- **Fingerprint (FP23):** 12 dials on top, the effect rows beside the drawing (the print with its eight feelings),
  a selection of up to three effects with the titles that share it, and the member's taste card.

Everything today's page does for search engines and speed stays: server rendering of every section, meta and Open
Graph tags, canonical and hreflang, JSON-LD, breadcrumbs (`titleTrail`), `REPLAY_TAP_SCRIPT`, the below-the-fold
provider, `useTitleOpened`, `usePublishTitleSubject`, the title preview for a picked country or language
(`useTitlePreview`), and the episode tracking gate. Audit `Details.tsx`, `DetailsContent.tsx`, `DetailsHero.tsx`, and
`DetailsHeader.tsx` before deleting any of them.

## Rules for every ticket

- **No prototype names.** No `R5`, `I6`, `FP23`, `variant`, `round N`, or `prototype` in file names, identifiers, or
  comments. Name things by what they do. Comments describe behavior, not history.
- **No prototype harness.** Never commit the variant switcher, fixture loaders, `PROTOTYPE_TITLE_FIXTURES`, or the
  prototype's `api.prototype-*` routes. Production code never reads fixtures.
- **Interaction rules (owner):** no popups or floating cards for content (things open in place; the quick view is the
  one shared exception); no layout shift on hover; animate transform and opacity only, at 60 fps, with no backdrop blur
  over motion; on phones, sticky elements go at the top only; ←/→ step the quick view while it is open.
- **Words:** say "title analysis", never "DNA". Few words and numbers: no prose walls, no number soup.
- **Speed:** the title page is a landing surface. Code needed only after an interaction (quick view, grid, dialogs)
  loads on first use (`lazy` + `reloadOnStaleChunk`). Run `./bench.sh budget` in `goodwatch-benchmark/` and keep it
  passing; if a first-view script must grow, raise the limit in `urls/budget.json` in the same commit and say why.
- **Static files:** wrap imported asset URLs in `assetUrl` (see `goodwatch-webapp/AGENTS.md`).
- **Data fetching:** loaders for server-rendered data, TanStack Query for dynamic data, no custom `staleTime`.
- **Databases are production.** `goodwatch-webapp/.env` points at production Crate, Postgres, Redis, Qdrant, and
  Supabase. Never start the app with it. Read Crate only with SELECT through `~/.cache/gw-title-proto/crate/q.sh`
  (`echo "SELECT ..." | q.sh`; it never prints credentials). Never write to any database.
- **Checks before a commit:** `npx tsc --noEmit -p .` shows no new errors in touched files, `npx biome check` on touched
  files, unit tests for pure logic (`npx vitest run <files>`).
- **Commits:** on your ticket branch, in your worktree. End messages with the attribution lines in the brief.

## API contracts

These are the seams between the server tickets and the page tickets. Keep them exactly; if one must change, say so in
your report.

### People of a title

`GET /api/title-people?type=movie|show&id=<tmdb id>&kind=cast|crew&q=&group=&offset=0&limit=60[&sort=name[&letter=A]]`

The prototype's `app/routes/api.prototype-title-people.ts` is the reference implementation (it reads saved dumps; the
production route reads Crate). Response, unchanged from the prototype:

```ts
interface PeopleRow { id: number; name: string; profilePath: string | null; roles: string[]; episodes: number | null; group: string; key?: boolean }
interface PeopleGroup { key: string; label: string; count: number }
interface PeoplePage {
  kind: "cast" | "crew"; total: number; matched: number; groups: PeopleGroup[]; rows: PeopleRow[]
  offset: number; nextOffset: number | null; showEpisodes: number | null; letters?: Record<string, number>
}
```

Tiers, departments, key jobs, accent-insensitive search, family-name sort, and the letter counts work as in the
reference. Shows have no department on crew credits; the job-to-department map comes from movie credits.

### Fingerprint population

The population is the most popular released titles with a fingerprint: 3,000 movies and 2,000 shows (`ORDER BY
popularity DESC`, `fingerprint_scores IS NOT NULL`, released this year or earlier).

`GET /api/fingerprint/pairs?type=movie|show&id=<tmdb id>`

```ts
{ of: number; pairs: { a: string; b: string; both: number }[] }  // effect ids; rarest first, at most 20
```

The title's counted effects (strength reaches the threshold), its 8 strongest, every pair of them, with how many
population titles count both. Sorted by `both` ascending, then by the pair's mean strength descending. The prototype's
`baseline.pairs` in `app/ui/prototype-title-page/shared/r9/baseline.ts` is the reference. The page starts on the
rarest pair with at most one effect outside its rows.

`GET /api/fingerprint/mix?type=movie|show&effects=<id>[,<id>[,<id>]]&exclude=<tmdb id>`

```ts
{
  total: number  // population titles where every effect counts, before the franchise and poster filters
  titles: { tmdbId: number; title: string; year: number | null; poster: string; goodwatch: number | null; keys: string[] }[]
}
```

At most 64 titles where every selected effect counts, ordered by the weakest of their selected strengths (strongest
first), ties in popularity order. Never the excluded title or its franchise; one title per franchise; titles without
a poster are skipped. `keys`: the title's three strongest ingredient sub-scores of the selected effects that score 6
or more (for the quick view's chips). The prototype's `pickTitles` in `app/ui/prototype-title-page/variant-fp23/titles.ts`
is the reference, including its franchise key.

Medians of every sub-score in the population (the print's centering) ship as a generated constant in
`app/domain/fingerprint-effects/`, written by a script that reads Crate, so the drawing renders the same on the server
and the client with no request.

Effects come from `app/domain/fingerprint-effects/effects.ts` (already on this branch).

## Tickets

| Ticket | Kind | Builder | Branch |
|---|---|---|---|
| T1 People of a title | server | Codex | `feat/title-page-people` |
| T2 Fingerprint population | server | Codex | `feat/title-page-fp-data` |
| T3 Page shell | page | Opus | `feat/title-page-shell` |
| T4 Fingerprint section | page | Opus | `feat/title-page-fingerprint` |

T1 and T2 implement the contracts. T3 ports everything except the fingerprint section and renders T4's section
through one import. T4 ports the fingerprint section. Page tickets preview with the fixture harness (see "Local
preview") until the server tickets land.

### T1 People of a title

Production route `app/routes/api.title-people.ts` per the contract, reading `person_appeared_in`,
`person_worked_on`, and the person table from Crate (see how `app/routes/api.title-cast.ts` reads cast today).
Big casts must stay fast: Grey's Anatomy (show 1416) has 3,257 cast members and Game of Thrones (show 1399) 336 crew.
Cache per title on the server (memory LRU or Redis, your call) and send cache headers. Pure logic (tiers, grouping,
search folding, family-name keys, letters) in a tested module. The job-to-department map may be a checked-in table
generated once from movie credits.

### T2 Fingerprint population

A server module that loads the population once per process and refreshes it daily in the background (never on a
request's critical path after the first load), plus the two routes. Pure logic (effect sets, rarest pairs, picking,
franchise key, ingredient keys) in a tested module next to `effects.ts`. A script that writes the medians constant.
Check results against the prototype for Dune: Part Two (movie 693134: rarest pair "takes you somewhere else" + "draws
you into power games", 41 of about 3,000) and Past Lives (movie 666277: "feels like real life" + "leaves you longing").

### T3 Page shell

Port the I6 page (`shared/r5/Page.tsx` and everything it uses) into production modules under `app/ui/details/`,
replacing today's layout. Includes the round 12-15 polish: the series list keeps the chevron's room so scores line up,
the Where to watch toolbar fits one row on phones (flag + country code, services as a gear), the cast list is two
columns on phones, Not interested is production's `ActionButton kind="hide"`. Loader: the title's backdrops for the
trailer card's still (the prototype's saved titles carried 9; the loader slices to 1 today), and video names when
Crate has them. Cast and crew use `/api/title-people`. The fingerprint section is one import from T4:
`import { FingerprintSection } from "~/ui/details/fingerprint-section/FingerprintSection"` rendered as
`<FingerprintSection media={media} sides={sides} />`; until T4 lands, render today's `DetailsFingerprint` there.
The taste group line moves into the fingerprint section (T4), so the opener no longer shows `TitleSidesLine`.
Delete what the new page no longer uses. Phones and desktop are equally important.

### T4 Fingerprint section

Port FP23 (`variant-fp23/` and the modules it imports from `variant-fp2`, `fp11`, `fp12`, `fp15`, `fp16`, `fp17`,
`fp18`, `fp22`, `shared/r9`, `shared/r10`) into `app/ui/details/fingerprint-section/`, exporting
`FingerprintSection({ media, sides })`. Keep only what FP23 uses. Data: `/api/fingerprint/pairs` and
`/api/fingerprint/mix` (TanStack Query), the medians constant, `/api/title-cards` for the quick view's card (backdrop,
runtime, score, match, services; it has no story, so the quick view shows none, as the related map's does). The grid uses production's `MovieTvCard`; a click opens production's `QuickView` (lazy). Production's quick
view gets the round 14-15 changes: Previous / Next as two half-width buttons showing their arrow keys, and wrapping
around (port them from the prototype's `app/ui/quick-view/QuickView.tsx` diff). The taste card replaces
`TitleSidesLine` on the title page; keep production's words and hiding rules.

## Local preview

Never start the app with `goodwatch-webapp/.env`. The page tickets preview with the prototype's fixtures:

- `~/.cache/title-page-build/preview/preview.py on <worktree>` inserts preview-only blocks (marked `PREVIEW-ONLY`) that
  answer the title loaders and the APIs from `~/.cache/gw-title-proto/fixtures`, and `off` removes them. Run `off`
  before every commit; `git diff --cached | grep PREVIEW-ONLY` must print nothing.
- Start: `~/.cache/title-page-build/preview/serve.sh <worktree> <port>` (an `env -i` allowlist with every database
  endpoint and key blank and outbound connections blocked).
- Saved titles: movie 693134 Dune: Part Two, movie 666277 Past Lives, show 95396 Severance, show 1396 Breaking Bad,
  show 1416 Grey's Anatomy (huge cast), show 1399 Game of Thrones (huge crew).
- Known local noise: React `startAfterPaint` prop warning, 403 `/api/poster-impressions`, 404/500 prefetches of titles
  and people without fixtures.
