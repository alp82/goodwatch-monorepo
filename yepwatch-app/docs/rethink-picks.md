# YepWatch picks quality: implementation plan

Written 2026-11-15 from an investigation of the production deck path on `feat/yepwatch-rethink` (origin/main plus
`rethink.md`). The owner reports that picks are "often irrelevant or bad" (`rethink.md`, Why 3). This plan says why,
then lists the work in the order to build it. `rethink.md` says to implement every item here.

Paths are relative to the repository root. `yw/` means `goodwatch-webapp/app/server/yepwatch/`.

Each work item is marked:

- **Backend**: server, contracts, projection and Crate work. Codex implements these.
- **App UI**: `yepwatch-app` screens. These follow the `rethink.md` rules (copy style, zero layout shift, 60 fps,
  e2e rules in `yepwatch-app/e2e/lib/rules.mjs`).

Sizes: S is up to a day, M is 2 to 3 days, L is 4 to 5 days.

## Current pipeline

### Which code runs in production

The release API (`yw/proposal-release-main.ts`) serves every room. It passes `guestProposalCatalog()` as the catalog
and `guestProposalCatalog` as the member catalog (`yw/proposal-release-main.ts:82-83`). So members and people without
GoodWatch get the same ranking. The only member input is their seen titles.

`blendPrivateRanks` (`yw/continuous-member-ranking.ts:2-21`), the only code that reads a member's taste, runs in
`continuousGoodwatchCatalog` (`yw/continuous-runtime.server.ts:52-106`). Production doesn't use it. It's on the old
webapp route (`yw/proposal-runtime.server.ts:63`) and the local servers. Even there it sorts by popularity, uses taste
only when the member has For you switched on (`:95`), and keeps only titles that are in every member's list
(`continuous-member-ranking.ts:15`).

### How a deck is built

1. **Base ranking** (`yw/goodwatch.server.ts:128-149`). `baseKeys` runs `filterTitles` over the whole title snapshot
   (200k+ titles) with a guest viewer that has no services, seen titles or taste (`:140`) and
   `defaultFilterState`, so `minScore` is 0 (`app/domain/filter-state.ts:251-263`). The `keep` predicate keeps titles
   that are presentable (poster and a known score, `app/server/title-snapshot/format.server.ts:131-139`) and not adult
   (`:141`). The comment at `:143` says the full snapshot is used on purpose, to avoid "Discover's separate
   minimum-vote catalog gate" (`MIN_VOTES = 1000`, `app/server/title-filter/order.server.ts:19`). Titles are sorted
   by TMDB popularity (`order.server.ts:49`). The only room filters are kinds and moods. The result is cached per
   snapshot version, country, kind and moods (`:136`).
2. **Rotation** (`yw/goodwatch.server.ts:167`). `rankedKeys` rotates by `roundVersion * 20`, but `catalogRoom` always
   passes `roundVersion: 0` (`yw/continuous-catalog.ts:24`), so it never rotates.
3. **Room order** (`yw/proposal-guest-catalog.server.ts:40-62`). Linked members with `showSeen` off have their seen
   titles removed. `roomIntentKeys` (`yw/proposal-intent.ts:124-175`) then builds one lane per idea that's on. A lane
   is the idea's `rankedKeys` in search order, then the base popularity order. Lanes are interleaved round robin.
   Without ideas, the deck is the popularity order.
4. **Ideas** come from the GoodWatch described search (`app/server/combined-search/yepwatch.server.ts:53-91`):
   500 rows, `lesserKnown: false`, no adult, filtered to the room's services at the time of interpretation.
   `rankedKeys` is the search order. `attributes` is the reading (want, avoid, attribute, phrase chips). The deck only
   reads `rankedKeys`; `attributes` is shown to people but never used for ranking.
5. **Scan** (`yw/catalog-adapter.ts:31-201`). The adapter walks the room order in windows of 40 (`:76`), at most 1200
   titles (`:52`) and 12 s (`:35`). It keeps titles that every occupied screen can watch (`:141-148`). Since
   `refreshServices` (`yw/proposal-redesign.ts:23-49`) folds everyone's services into one screen, "every screen" means
   "on any service someone in the room picked". A show card is its first episode (`:159-162`). The first 20 that pass
   become the page (`LIMITS.deck`, `yw/types.ts:2`).
6. **Attribution and details** (`yw/proposal-guest-catalog.server.ts:77-96`). Each card gets the ids of the ideas
   whose `rankedKeys` contain it (`yw/proposal-redesign.ts:246-253`), then scores, essence, effects and Not for lines
   (`yw/continuous-presentation.server.ts:112-126`).
7. **Prepared decks** (`yw/proposal-prepared-decks.ts`). Each committed setup change schedules a background build keyed
   by `deckInputs` (`:35-81`). People without GoodWatch count only by their screen (`isGuest`, `:84-85`). Start
   (`yw/proposal-service.server.ts:1327-1365`) uses the prepared page, drops members' seen titles from stored copies
   (`yw/continuous-members.server.ts:29-36`, at most 30 s old), and builds again only when the page comes back empty.
   Refills reuse a page built for the same `refillInputs` (`:56-61`), which leave out votes.
8. **Votes** (`yw/proposal-machine.ts:589-614`) are stored per participant. `retire` (`:648-653`) deletes the votes of
   cards everyone answered. Nothing reads votes to shape later cards.

### Speed today

`4853fbe10` keeps offers (10 minutes), episodes (6 hours) and extras in process (`yw/read-cache.ts`, `yw/goodwatch.server.ts:37-57`) and reads the next window ahead. `8a1a529db` added `scan`, `intent` and `seen` marks. Warm builds take 45 to 230 ms; their read marks sum to 20 to 60 ms. Most Starts use a prepared deck. Any new ranking must fit inside the `intent` mark's budget (a few ms) or move into the prepared build.

## Problems found

The note from 2026-11-13 is still accurate, with one correction: `blendPrivateRanks` doesn't run in production at
all, so even members get no taste ranking.

### Top causes of bad picks

1. **The deck is TMDB popularity with no quality floor.** No score floor and no vote floor
   (`yw/goodwatch.server.ts:137-147`). TMDB popularity rewards what's trending this week: new releases with poor
   reviews, talk shows, soaps, reality and news (TMDB marks these as popular every day), and obscure regional titles
   that spike. "Leave it empty for well-liked picks" (`rethink.md`) promises something the code doesn't do.
2. **Nobody's taste is used.** Production passes the guest catalog for members (`yw/proposal-release-main.ts:82-83`),
   people without GoodWatch have no profile, and votes never feed back. Every room with the same country, kinds and
   services gets the same deck, and the same group gets the same first cards every evening (rotation is dead, see
   step 2).
3. **Ideas replace ranking instead of steering it.** With an idea on, cards come in search relevance order with no
   quality or taste weight, and each idea gets an equal round robin share however weak it is. When an idea's titles
   run out on the room's services (500 rows filtered by availability), the lane falls back to the popularity order of
   cause 1. The reading's `want` and `avoid` chips are ignored.

### Other problems

- **Scan waste.** The popularity order isn't filtered by the room's services, so the 1200-title scan spends most of
  its reads on titles nobody can watch. Small service sets hit `scan_limit` and the `catalog_unavailable` error.
  GoodWatch keeps a per-country service index in memory (`app/server/availability-index.server.ts:173`) that the
  release doesn't use.
- **Unreleased and stale titles.** Movies with a future release date pass: the YepWatch base ranking never checks the
  release day (Discover at least drops unknown ones). A show's release day is its last air date, so long-dead shows
  and shows with one aired episode look the same.
- **No genre sense.** Talk, News, Reality and Soap (`app/domain/themes-styles.ts:194` already groups the first three)
  are dealt as "show_start" cards.
- **No diversity.** Popular titles cluster (four superhero films, then three sequels of one franchise). Nothing spreads
  the deck across kinds or fingerprint regions.
- **Members' Not interested and dropped shows** aren't excluded, only seen titles.
- **No measurement.** Votes of retired cards are deleted (`yw/proposal-machine.ts:648-653`), vote records have no wall
  clock time, and `CONTINUOUS.md:76` forbids raw vote analytics. Nobody can say today whether a change helps.
- **Stale idea readings after a service change.** An idea is read with the services at that time
  (`yw/proposal-intent.ts:68`). Adding a service later doesn't widen its titles.

## Target design in one paragraph

Each room ranks a **candidate pool** (the snapshot's titles that pass a quality floor and are on the room's services,
from the in-memory service index) with one pure scoring function: least misery over everyone's taste percentiles
(GoodWatch taste for members, Taste mode answers for everyone else), plus idea fit, quality, Want to See, shared
availability and a diversity pass, with a per-room seed so repeat evenings differ. Every card carries one reason
derived from the strongest signal. During a round, cards nobody has reached yet are reordered from the room's Yeps and
Nopes. Taste answers and next-day ratings live in a YepWatch profile on the server, never in GoodWatch. An aggregate
outcome log and an offline replay measure every change.

## Work items

Build in this order. Items 1 and 2 give most of the gain for people without GoodWatch and need no new data. Later
items depend on earlier ones as noted.

### 1. Measure first: outcome log and offline replay (Backend, M)

Without a baseline, nothing below can be judged. Ship this before any ranking change and collect at least a week (or
50 rounds, whichever is later).

**Owner decision needed.** `CONTINUOUS.md:76` says "No raw vote/pick/history/taste payload analytics." This item logs
aggregates only (no participant ids, profile ids, names or title keys). Ask the owner to confirm this reading, and
update `CONTINUOUS.md` with the allowlist below.

Server:

- New `yw/proposal-outcome.ts` (pure). `roundOutcome(room)` returns, per round: ranker version, people count, people
  with taste (member, profile, none), kinds, ideas on, cards dealt, and per dealt card: position, reason code, score
  components bucketed to tenths (taste minimum, idea fit, quality), Yep count, Nope count, unanswered count, and
  whether it matched. Room level: matches, position of the first match, time from Start to first match, time from
  Start to decision, whether a decision happened.
- Track `startedAt` and `firstMatchAt` on the room (stored, not projected; set in `proposalTransition` for `start` and
  the first `vote` that makes a match). Keep per-card tallies in a stored `outcome` array on the room, updated in the
  vote transition before `retire` deletes the votes (`yw/proposal-machine.ts:648`). Tallies hold counts only.
- Emit `yepwatch_round_outcome` (one JSON log line, same pipeline as `yepwatch_deck_build`) when a round ends:
  `restart`, decision, or room expiry in `yw/proposal-room-retention.ts`.
- Extend `yepwatch_deck_build` with aggregate deck quality: median GoodWatch score, median votes, share of cards with
  a taste signal, reason code counts, pool size after the floor, and the `taste` and `rank` marks from item 3.

Offline replay:

- `yw/eval/replay-baseline.ts` (read-only, operator run, local). Reads the vote records still in Crate (rooms are kept
  30 days after expiry, `yw/proposal-room-retention.ts:6`). `SCHEMA.md:52` warns that a raw scan includes superseded
  records, so the script orders by `revision` and keeps each participant's last record per card. It prints aggregates
  only: Yep rate by card position, match rate per round, cards to first match. Check first with a count query whether
  retired cards' vote records survive in Crate; if they don't, the baseline comes from the outcome log alone.
- `yw/eval/group-sim.ts`, a simulation that needs no YepWatch data: sample groups of 2 to 4 GoodWatch members with at
  least 40 ratings, hide 30% of each member's ratings, build their taste from the rest, run the deck ranker for a fixed
  country and service set, and score each deck by how many cards every member rated 7 or higher among the hidden
  ratings (group precision at 20), how many any member rated 4 or lower (misery at 20), and coverage. Run it locally
  against a read-only Crate copy; output aggregates only. This is the main tuning tool for items 3 and 7, because
  production volume is too small for A/B tests.

Tests: `proposal-outcome.test.ts` (tallies survive `retire`, first match time, no ids or keys in the output, a log line
schema test), a test that the outcome array isn't in `proposalSnapshot`.

Before and after plan: record the baseline week, then ship items 2, 7 and 11 one at a time with at least 30 rounds
between them, comparing Yep rate per card, match rate, cards to first match and decision rate. The simulation gates
each ranker change before it ships (no regression in group precision at 20, misery at 20 down).

Crate DDL: `startedAt`, `firstMatchAt` and `outcome` as additive room columns in `yw/proposal-storage-schema.ts` plus
a migration in `yw/migrations/`. Not projected.

### 2. Quality floor, candidate pool and diversity (Backend, M)

Replace the popularity base with a quality-gated pool. No new data.

Server:

- New `yw/proposal-pool.ts` with tunable constants in one object:

  ```ts
  export const QUALITY = {
    movie: { minVotes: 5000, minScore: 60 },
    show: { minVotes: 1500, minScore: 65 },
    // Steps tried in order while the room's pool has fewer than POOL_TARGET titles.
    relax: [
      { movie: { minVotes: 2000, minScore: 55 }, show: { minVotes: 700, minScore: 60 } },
      { movie: { minVotes: 1000, minScore: 50 }, show: { minVotes: 300, minScore: 55 } },
    ],
    excludedGenres: ["Talk", "News", "Reality", "Soap"],
    needBackdrop: false,
  } as const
  export const POOL_TARGET = 300
  ```

  Values are a starting point, to tune with the simulation and the score and vote distribution of the snapshot
  (votes are `goodwatch_overall_score_voting_count`, scores are 0 to 100). Shows get lower vote floors because they
  collect fewer votes.
- `basePool(snapshot, kinds, moods)`: snapshot rows that are presentable (`presentableAt`), not adult, not in an
  excluded genre (genre bitmask), released (movie release day at or before today; show first air year from the facts
  sidecar at or before this year, and a show needs at least one aired episode, which the scan already checks), and
  pass the strictest quality step. Sorted by a quality prior (below). Cached per snapshot version, kinds and moods,
  built slice by slice like `baseKeys` today (`yw/goodwatch.server.ts:144`) so it never holds the event loop. It
  replaces `baseKeys` and the 200k-key ranking; the pool is a few tens of thousands of keys.
- Quality prior: `q = 0.7 * scorePercentile + 0.3 * log(votes) percentile`, both within the title's kind in the pool,
  plus a small recency term (`+0.05` for titles released in the last 3 years). TMDB popularity becomes a tie breaker
  only.
- `roomPool(room)`: the base pool filtered to titles on at least one of the room's services, using
  `countryServices(country)` (`app/server/availability-index.server.ts:173`). The release loads the room's country on
  first use (the index already loads in the background and refreshes every 6 hours). While a country isn't loaded,
  skip the filter (the scan's evidence check stays authoritative). If the pool is under `POOL_TARGET`, retry with the
  next relax step. Memory: about 20 bytes per title per country.
- Ideas loosen the floor by one relax step for their own `rankedKeys` and lift the genre exclusion for keys the search
  returned (someone who asks for "reality dating shows" gets them). Ideas never lift the adult filter.
- Diversity in the final order (applies to every deck, used again by item 3): a greedy pass over the top 200 scored
  titles. Each pick lowers the score of remaining titles by `max(0, cos(fp_a, fp_b) - 0.85)` (at most 0.15)
  against the last 5 picks, plus a fixed penalty for the same collection (TMDB collection id if the snapshot facts carry it;
  otherwise skip). When kinds include both movies and shows, no more than 3 of one kind in a row.
- Per-room seed: add `jitter = 0.03 * hash(room.id, key)` (uniform 0 to 1) to the score, so two rooms with identical
  inputs differ slightly and a group's second couch doesn't start with the same cards. Stable within a room, so
  prepared decks and refills stay deterministic.
- Delete the dead rotation (`yw/goodwatch.server.ts:167`) and `warmRankings`'s popularity combos; warm the base pool
  for `US`, `DE`, `GB` instead (`yw/proposal-release-main.ts:98`).

Performance: the pool and the service filter are in-memory array work. Measure the new `pool` mark; target under 5 ms
warm. The scan now finds watchable titles in its first window in nearly every room, so the `scan` mark should drop.

Tests: `proposal-pool.test.ts` on a fixture snapshot (floors per kind, relax ladder, genre exclusion, idea exemption,
unreleased movie dropped, adult never), diversity (no 4 near-duplicates in a row; kind alternation), seed stability.
Update `goodwatch-ranking.test.ts` and `proposal-catalog-paging.test.ts` expectations. Add a speed test next to
`proposal-create-speed.test.ts` that builds a pool from a 200k-row synthetic snapshot within the budget.

Risks: a floor too strict for small catalogs (one niche service in a small country) leaves short decks. The relax
ladder and a `yepwatch_deck_build` field for the step used make this visible.

### 3. Deck ranker: one scoring function (Backend, M)

A pure ranker that later items plug signals into. Ship it with only quality, ideas and diversity (items 7 to 11 add terms).

Server:

- New `yw/proposal-ranker.ts`, pure, no I/O:

  ```ts
  interface RankInput {
    pool: readonly number[]          // roomPool keys
    snapshot: TitleSnapshot          // fingerprints, scores, votes, facts
    people: PersonSignal[]           // item 7
    ideas: { id: string; rankedKeys: number[]; wants: string[]; avoids: string[] }[]  // item 8 (on ideas only)
    wishlist: ReadonlyMap<number, number>  // key -> how many members list it (item 10)
    sharedServiceKeys?: ReadonlySet<number> // item 10
    excluded: ReadonlySet<number>    // seen and hidden (item 9)
    feedback?: RoundFeedback         // item 11
    seed: string                     // room id
  }
  interface Ranked { key: number; score: number; parts: ScoreParts; reason: ReasonCode }
  export function rankDeck(input: RankInput, limit: number): Ranked[]
  ```

  Score: `S = wT * T + wI * I + wQ * Q + wW * W + wA * A + jitter`, then the diversity pass. Starting weights:
  `wT = 0.45`, `wI = 0.35` (0 when no idea is on), `wQ = 0.25`, `wW = 0.08`, `wA = 0.04`. Weights live in one
  `RANK_WEIGHTS` object and the ranker version string goes into the deck log and the outcome log.
- Plug it into `guestProposalCatalog` in place of `roomIntentKeys` (`yw/proposal-guest-catalog.server.ts:56-60`):
  `rank(room, base, limit)` returns `rankDeck(...)` keys. Pass `Ranked.reason` and `parts` through to the page for
  items 1 and 12 (the scan keeps order; the candidate gets its reason after the scan).
- Fairness across ideas stays: the top of the deck interleaves ideas (each on idea gets its best remaining title by
  `S` in turn for the first `2 * ideas` cards), then everything follows `S`. This keeps the "every idea shows up early"
  property of today's lanes while letting quality and taste order the rest.
- Score only the top 3000 of the room pool by quality prior. At 12 people and 74 dimensions that's about 2.7 M
  multiply-adds: 2 to 4 ms. Time it as `rank`.
- The production member catalog gets the same ranker; `continuousGoodwatchCatalog`'s `blendPrivateRanks` path goes
  away with it (delete `continuous-member-ranking.ts` once nothing imports it, or keep it only for the local
  continuous server if its tests still need it).

Tests: `proposal-ranker.test.ts` with a tiny synthetic snapshot: weights add up as documented, idea interleave at the
top, excluded keys never returned, deterministic for the same seed, different for different seeds. A snapshot of the
full ranking for one fixture room to catch accidental changes.

### 4. Taste profiles for people without GoodWatch (Backend, L)

Server-side storage of Taste mode answers per device profile. Members keep their GoodWatch taste (item 5) and also get
a profile, which holds their next-day ratings (item 13).

Data model (Crate, new table in `yw/proposal-storage-schema.ts`, migration in `yw/migrations/`):

```sql
CREATE TABLE doc.yepwatch_taste_profile (
  id TEXT PRIMARY KEY,           -- HMAC-SHA256(room secret key, profile secret), base64url
  answers OBJECT(STRICT) AS (    -- latest answer per title, at most 500
    items ARRAY(OBJECT(STRICT) AS (key BIGINT, answer TEXT, source TEXT, at BIGINT))
  ),
  followups ARRAY(OBJECT(STRICT) AS (key BIGINT, decided_at BIGINT, state TEXT)),  -- item 13, at most 20
  dealt ARRAY(BIGINT),           -- legacy, unused
  nopes ARRAY(OBJECT(STRICT) AS (key BIGINT, at BIGINT)), -- up to 300 explicit Nopes, retained for 30 days
  revision BIGINT,
  updated_at BIGINT,
  expires_at BIGINT              -- updated_at + 180 days
) CLUSTERED INTO 4 SHARDS WITH (number_of_replicas = 1);
```

`answer` is `loved`, `not_for_me` or `unseen`. `source` is `taste` or `followup`. `key` is the snapshot point id
(movie 1e12 + tmdb id, show 2e12 + tmdb id). No name, avatar, account id or room id is stored.

Identity: the app creates a 32-byte random profile secret on first use and keeps it beside the creator id
(`yepwatch-app/src/core/continuous/creator.ts` uses SecureStore; web uses the same storage helper). The server only
sees it in an `x-yepwatch-profile` header over HTTPS and stores its HMAC. Losing the device loses the profile; that's
acceptable for v1 and noted in the risks.

API (new public paths in `packages/yepwatch-contracts/proposal.ts` `paths`, the realtime release `Caddyfile`
(`yepwatch-realtime/release/Caddyfile`) and `yw/proposal-http.server.ts`):

| Path | Method | Body | Returns |
| --- | --- | --- | --- |
| `/profile` | `GET` | none | `{ answered, loved, notForMe, unseen, revision, followups[] }` (counts, plus pending follow-ups with title display fields) |
| `/profile/answers` | `POST` | `{ revision, items: [{ key, answer, at }] }` (1 to 50 items; `answer: null` removes, for undo) | `{ revision, answered }` |
| `/profile/taste-deck` | `GET` | `?count=10` | calibration cards (item 6) |
| `/profile` | `DELETE` | none | `204`; the row is gone |

- Writes are idempotent by `(key, at)`; a stale `revision` returns `409` with the current counts so the app retries.
- Rate limits: 120 answer writes per profile per hour and the existing per-IP budget (`yw/proposal-command-budget.ts`).
- A process-memory cache of profiles (LRU, 5000, 10 minutes) keyed by id holds answers and the built taste (item 6).
  A write updates the cache and schedules `decks.schedule(roomId)` for every room in setup the profile is in.

Linking a profile to a room: `create`, `join` and `resumeOrJoin` read the header and store `profileId` (the HMAC) on
the participant record. Not projected, not in `PARTICIPANT_NOISE`, so it changes `deckInputs` (correct: a profile is
a deck input). `isGuest` (`yw/proposal-prepared-decks.ts:84-85`) treats a participant with a `profileId` as a deck
input. Add a `tasteRevision` per participant to the digest from the profile cache so an answer written during setup
rebuilds the prepared deck.

Retention and privacy:

- Rows expire 180 days after the last write or room use (a join touches `updated_at`, at most once a day). The room
  retention job deletes expired profiles in the same run.
- `DELETE /profile` and the app's "Reset my taste" (App UI, item 6) remove the row at once.
- Answers are never projected and never leave the API. Reasons (item 12) only use group-level wording. Taste answers
  are never written to GoodWatch, and no GoodWatch endpoint reads this table.
- Update `SCHEMA.md` (new table, roles) and `CONTINUOUS.md` (profile privacy).

Tests: `proposal-taste-profile.test.ts` (HMAC identity, 500-answer cap keeps the latest, undo by `null`, stale
revision, rate limit, delete), a Crate integration test next to `proposal-relational-crate.test.ts`, a prepared-deck
test that a profile write during setup rebuilds the deck and a write by someone not in the room doesn't.

App (App UI, M, part of `rethink.md` screen 3): send answers in batches of up to 10 (and on leaving Taste mode) through
the existing retrying send (Q16b); keep unsent answers locally until acknowledged; the Setup chip's "10 rated" reads
`answered` from `GET /profile`.

### 5. Member taste, Want to See and hidden titles from GoodWatch (Backend, M)

Server:

- Add a `taste` view to the member resource (`yw/member-resource.server.ts:33`, route `app/routes/api.yepwatch.account.ts`).
  It returns `{ vector: number[74] | null, liked: number, version: string, wishlist: TitleKey[] (at most 500, newest
  first), hidden: TitleKey[] }`. GoodWatch builds it with `loadTaste` (`app/server/taste/index.server.ts:15`) and
  `getUserData` (`user_wishlist`, `user_not_interested`, dropped shows via `seenAndHidden` in
  `app/server/viewer.server.ts:47`). The vector is the member's unit taste vector, rounded to 3 decimals. No ratings
  or titles leave GoodWatch except the Want to See and hidden keys, which the deck needs.
- `proposal-release-members.ts:240` gains `taste(userId, token)`, parsed with zod.
- `ContinuousMembers` keeps a taste copy per link, like seen copies (`yw/continuous-members.server.ts:29-36`): read
  at sign-in and on join, refreshed in setup by `ExclusionKeepAlive` (`yw/proposal-member-exclusions.ts:31`), at most
  10 minutes old for deck builds (taste changes slowly; seen stays at 30 s). A failed read leaves the member as "no
  taste" for that build and logs `yepwatch_member_taste_skipped`.
- The member's `version` goes into the deck digest like `tasteRevision`.
- Members' hidden keys join the exclusions (item 9).

Tests: member resource view test (shape, caps, refused grant), release member read parse test, copy age and refresh
tests mirroring `continuous-members-seen.test.ts`, a deck test that a member's Not interested title never appears.

Risks: a member without enough ratings (`MIN_LIKED`) gets `vector: null`; item 6 then treats them like a profile
with their YepWatch answers, or as neutral.

### 6. Taste deck and the profile taste vector (Backend, M; App UI, S)

This item turns answers into a taste vector and picks the calibration cards.

Taste vector from answers (`yw/proposal-taste.ts`, pure, uses the snapshot):

- Reuse GoodWatch's math, not a copy of it: `tasteVector(snapshot, signals)` (`app/server/taste/formula.server.ts:84`)
  with `Loved it` as a rating of 9 and `Not for me` as a rating of 3 (`TasteSignals`, `:48`). `Haven't seen` adds
  nothing. `tasteVector` returns null below `MIN_LIKED` (5) liked titles, which is too strict for 10 calibration
  cards. Export the weighted 2P minus N core of `tasteVector` as `tasteVectorFrom(snapshot, signals, { minLiked })`
  and call it with `minLiked: 1` from YepWatch; GoodWatch keeps 5. A profile with only Not for me answers gets the
  vector `-N` (it still steers away).
- Confidence `c = min(1, (loved + 0.5 * notForMe) / 8)`. Item 7 shrinks the person's percentile toward neutral by
  `1 - c`.
- Calibration to percentiles: `quantileTable(poolCosines(tastePool(snapshot), vector))` (`formula.server.ts:140`),
  about 6 ms. Build it when answers are written (profile cache) and when a member's taste copy is read, never during
  Start. Cache by profile revision and snapshot version.
- Members: `v = normalize(v_goodwatch + λ * v_yepwatch)`, `λ = n_yepwatch / (n_yepwatch + 20)`, where `v_yepwatch`
  comes from their next-day ratings (item 13). Members' Taste mode answers aren't asked for ("Using your GoodWatch
  taste", `rethink.md`), but if a member answers anyway, they count the same way.

Calibration deck (`GET /profile/taste-deck`):

- Source: `referencePool` (`app/server/title-snapshot/catalog-stats.server.ts:32-45`), the 2200 most-voted movies
  (3000+ votes) and 800 most-voted shows (1000+ votes) with a backdrop.
- Per snapshot version, precompute 12 clusters over the pool's unit fingerprints (k-means, fixed seed, 20
  iterations, about 50 ms once per snapshot, in the background slice runner). Within each cluster, order titles by
  "likely seen": `log(votes)` plus a bonus for titles released in the last 15 years.
- First run (10 cards): one title per cluster, round robin over the 10 clusters with the most votes, 6 movies and 4
  shows, the most-likely-seen title of each. This is the "well-known, diverse, high-information" set: well known so
  most people answer Loved it or Not for me, one per cluster so every answer tells something new.
- Later runs: pick the cluster with the least information first (no Loved it or Not for me yet, or answers that
  disagree), skip titles the profile already answered, and after a `Haven't seen` in a cluster prefer that cluster's
  next most-voted title. When a room is set up and the profile has under 5 Loved it or Not for me answers, the app
  can offer 5 quick cards from the clusters with no answer yet (the prototype's `THIN_TITLES` idea); optional.
- Country doesn't matter for calibration (people know films they saw anywhere); kinds don't either.
- Returns display fields from `getDisplayFields` (cached) plus the snapshot key. Cache the per-snapshot clusters; a
  request is a few ms.

How answers improve picks: Loved it and Not for me build the vector (item 7 ranks with it); both also mark the title
seen for that person (item 9); Haven't seen marks a well-known title the person hasn't watched, which item 7 boosts by
`+0.05` when the person's percentile for it is above 0.7 ("candidate for the Tonight deck later").

Tests: `proposal-taste.test.ts` (vector direction for a synthetic pool, confidence, null below one signal, member
blend), calibration tests (10 cards, 10 clusters, 6 and 4 split, no repeats, deterministic per snapshot), a guard test
that GoodWatch's `tasteVector` still returns null below 5 liked.

App (App UI, S): Taste mode reads `GET /profile/taste-deck` instead of fixtures; "That's enough" ends early;
"Reset my taste" in the profile calls `DELETE /profile` with a confirmation.

### 7. Group ranking by least misery (Backend, M)

Depends on items 3, 5 and 6.

Server (`yw/proposal-ranker.ts`, `PersonSignal = { vector, quantiles, confidence, unseen: Set<key> }`):

- Per person `i` and title `t`: `p_i(t) = percentileOf(cos(t, v_i), quantiles_i)` (`formula.server.ts:158`, via
  `snapshot.cosine`, `app/server/title-snapshot/snapshot.server.ts:294`), then shrunk:
  `p'_i = c_i * p_i + (1 - c_i) * 0.5`. People without any signal are left out of `T`.
- Group taste: `T = 0.65 * min_i p'_i + 0.35 * mean_i p'_i`. The minimum is the least misery part: one person who
  would hate a title pulls it down even when the others love it. The mean keeps ties ordered by overall enthusiasm.
  With nobody's taste known, `T` is 0 and `wT` moves to `Q`.
- A hard veto: a title any person with `c_i >= 0.5` scores below percentile 0.15 drops out of the first page (stays
  in the pool for refills, in case the deck runs short).
- Titles with no fingerprint get `p = 0.5` for everyone (neutral, not excluded).
- Group fit to ideas and kinds stays in `I` (item 8) and the pool (kinds); taste never overrides an idea's kind.

Performance: percentiles are a binary search in a 119-entry table per person per title; inside the 3000-title budget
of item 3. The prepared build does this; Start doesn't wait for it.

Tests: least misery beats average (a title one person hates ranks below a title everyone likes moderately), the veto,
confidence shrink, neutral people ignored, a 12-person speed test under 10 ms for 3000 titles.

Risks: a single strong profile in a room of empty profiles dominates. The `mean` term and confidence shrink limit
this; the simulation checks it.

### 8. Ideas as steering, not replacement (Backend, S)

Server:

- Idea fit `I(t) = max over on ideas of fit_k(t)`, with `fit_k(t) = 1 - rank_k(t) / len_k` for titles in the idea's
  `rankedKeys`, else 0. Add the reading: titles whose fingerprint scores 7 or more on any `want:<key>` chip get
  `+0.1` (capped at 1), and titles with 7 or more on an `avoid:<key>` chip get `-0.3`. The chips are already stored as
  `attributes` with `kind` and `key` (`yw/proposal-intent.ts:8-16`).
- Ideas switched off contribute nothing (already true for lanes and attribution, `yw/proposal-redesign.ts:231`).
- Replaced ideas: `edit_idea` already clears `rankedKeys` and `attributes`, retires untouched cards that only matched
  the old text and counts one interpretation (`yw/proposal-redesign.ts:166-202`). Keep that, and `rethink.md`'s
  change that `edit_idea` switches the idea back on.
- Re-read an idea when the room's services change and the idea's last reading had fewer than 100 keys on the room's
  services, if the interpretation budget (24) allows. This costs one interpretation and runs in the background like
  any other.
- The deck stays useful while an idea is pending: rank without it, then the landed reading reschedules the prepared
  deck (already true).

Tests: extend `proposal-intent.test.ts` (want and avoid chips move titles, off ideas ignored, edit resets and re-reads,
service change re-read within budget only).

### 9. Seen and hidden titles (Backend, S; App UI, S)

Depends on items 4 and 5.

Server:

- `memberExclusions` (`yw/proposal-member-exclusions.ts:9-22`) becomes `roomExclusions`: for each present
  participant with `showSeen` off, the union of their GoodWatch seen titles (members), their GoodWatch hidden titles
  (members, item 5, always excluded whatever `showSeen` says), and their profile's Loved it and Not for me titles
  (everyone with a profile). Profiles are in process memory, so this adds no read on Start.
- `set_show_seen` (`yw/proposal-redesign.ts:96-103`) is allowed for anyone with a profile, not only linked members.
- The ranker gets the union as `excluded`. The scan's existing seen filtering at Start
  (`yw/proposal-service.server.ts:1351-1362`) stays as the last guard.
- Repeat avoidance: each profile's `nopes` stores up to 300 explicit Nopes with timestamps, retained for 30 days.
  Committed Nope votes add entries; Yep and undo remove them. Titles dealt but unanswered get nothing.
  After the taste/least-misery combination, add the score-level term `-0.1 * nopers / peopleCount`, where
  `peopleCount` is all active participants with a linked profile (including skipped Taste or zero confidence)
  and `nopers` counts those profiles whose recent `nopes` include the title. Everyone Noping subtracts the full 0.1.
  `parts.repeat` reports this term; taste percentiles and vetoes are unchanged. Participants without taste
  confidence still do not enter group taste or least misery.

Tests: exclusions per source, `showSeen` on keeps seen but still removes hidden, a profile participant can switch
`showSeen`, repeat avoidance applies to Nopes only.

App (App UI, S): show the existing "Show titles I've seen" switch to people with taste answers, not only members.

### 10. Want to See boost and shared availability (Backend, S)

Depends on items 3 and 5.

Server:

- `W(t) = min(1, members listing t / 2)`. Only members have Want to See lists. The boost makes a listed title likely
  to land in the first page without overriding the veto in item 7.
- Shared availability: `A(t) = 1` when the title is on a service that every present participant who picked services
  has (`p.serviceIds`), else 0. People without services don't count. Computed from the in-memory service index
  (`countryServices(country).rowOf(key)` and the service runs). Everything in the deck is still watchable on a
  service someone in the room has (item 2 pool plus the scan's evidence check, unchanged).
- Both values feed the reason (item 12).

Tests: boost order, no boost for profiles, `A` with mixed service picks and with someone who picked none.

Risk: in a couch of two, "On someone's Want to See list" tells one person it's the other's list. The owner asked for
the anonymous line; confirm it's fine for two people, or show it only with three or more.

### 11. In-session learning from votes (Backend, M)

Depends on item 3. The shared deck stays shared: everyone sees the same cards in the same order. Learning only moves
cards nobody has reached yet.

Server:

- `RoundFeedback` (pure, `yw/proposal-feedback.ts`): from the room's current votes, the unit fingerprints of cards
  with a group Nope (at least 2 answers and Nopes at least half) and a group Yep (at least 2 Yeps and Yeps at least
  half). A single person's votes count too, at half weight, so a couch of two learns after the first few cards.
  Adjustment for a title: `F(t) = 0.12 * maxCos(t, yeps) - 0.15 * maxCos(t, nopes)`, only above a cosine of 0.8 so
  only close neighbors move.
- Tail reorder, in `applyCommand` after a `vote` transition (`yw/proposal-service.server.ts`, next to the existing
  `reconcile` call): the movable tail is the cards that no present participant has answered and that sit at least 3rd
  among every participant's unanswered cards (the app shows the next unanswered card and the one under it,
  `yepwatch-app/src/features/room/vote/match.ts:83` and `VoteStage.tsx:243`, so the first two never move). Reorder
  the tail by `S + F`. Cards are never removed by learning. Uses the snapshot in memory; about 0.1 ms for 20 cards.
- Refills: `refillInputs` (`yw/proposal-prepared-decks.ts:56-61`) gets a coarse feedback digest: the sorted list of
  group Yep and group Nope card ids. It changes only when a card crosses a threshold, so the prepared refill is still
  reused between most votes. The refill page is ranked with `F`.
- The ranker version and whether a card moved go into the outcome log (item 1), so the before and after compares
  Yep rate on moved cards.

App: no change if the app renders `shared.candidates` in order and picks the next unanswered card (it does). Add an
e2e check that a reorder in a live update never changes the live card or the card under it, and that CLS stays 0.

Tests: `proposal-feedback.test.ts` (thresholds, half weight for one voter, cosine cutoff), tail rules (never moves a
card someone answered or the next two of anyone), refill digest changes only on threshold crossings, prepared refill
reuse still holds in `proposal-refill-lane.test.ts`.

Risks: reorders arriving while someone is mid-drag. The two-card guard covers the visible cards; the live update
already merges by id.

### 12. "Why this" reason per card (Backend, M; App UI, S)

Depends on items 3, 7, 8 and 10.

Contract: `Candidate.reason?: { code: ReasonCode; text: string } | null` in
`goodwatch-webapp/packages/yepwatch-contracts/proposal.ts:34-58`, with

```ts
type ReasonCode = "fits_everyone" | "close_to_your_taste" | "fits_idea" | "want_to_see" | "on_service_for_everyone"
  | "short_episodes" | "well_liked" | "popular_now"
```

Which signal produces which reason, first match wins:

| Order | Code | When | Text |
| --- | --- | --- | --- |
| 1 | `want_to_see` | `W > 0` | "On someone's Want to See list" |
| 2 | `fits_everyone` | 2+ people with taste and every `p'_i >= 0.7` | "Fits all 3 of you" (people with taste; "Fits both of you" for 2) |
| 3 | `fits_idea` | `I >= 0.5` from one idea | "Fits Mia's idea" (the idea author's room nickname; the card is shared, so it always names the author) |
| 4 | `close_to_your_taste` | exactly one person with taste and `p' >= 0.75` | "Close to your taste" |
| 5 | `short_episodes` | show, first episode runtime 30 min or less (facts `lengths`) | "Short episodes, easy to start" |
| 6 | `on_service_for_everyone` | `A = 1`, one service name | "On Prime Video for everyone" |
| 7 | `well_liked` | GoodWatch score 80+ | "Well liked on GoodWatch" |
| 8 | `popular_now` | otherwise | "Popular right now" |

"Loved by people with your taste" (a prototype fixture line) implies collaborative filtering, which this plan doesn't
build; fingerprint similarity is "close to" taste, not what similar people loved. Recommend `fits_everyone` and
`close_to_your_taste` instead; owner to confirm. The server sends `text` so the copy can change without an app
release; the app falls back to a local string per `code`.

A reason never names whose taste or list it came from, except an idea (ideas are already public in the room).

Server: the ranker returns `reason` per key; the catalog page sets it on the candidate after the scan
(`yw/proposal-guest-catalog.server.ts:79-85`, next to `ideaIds`). Store it on the candidate record
(`yw/proposal-relational-repository.ts:90`, `:216`, `:968`) and project it in `proposalSnapshot`
(`yw/proposal-machine.ts:213`). After a tail reorder the reason stays.

Projection: add `reason: z.strictObject({ code: z.enum([...]), text: z.string().min(1).max(80) }).nullable().optional()`
to the candidate element in `yepwatch-realtime/src/proposal-projection.ts:13-28`. The schema is strict, so the
projection must ship before or with the server change. Add it to the app wire schema
(`yepwatch-app/src/core/continuous/wire.ts:68`) as non-strict optional. Run `npm ci --install-links` in
`yepwatch-app` after the contract change.

Crate DDL: additive `reason OBJECT` column on the candidate table (`yw/proposal-storage-schema.ts:330-350`) and a
migration.

App (App UI, S): Tonight question column shows "Why this" then the reason text (`rethink.md` screen 5,
desktop); phones show it in the details area of `yepwatch-app/src/features/room/TitleDetails.tsx` under the title.
Fixed height of one line (two on phones), ellipsis, so no layout shift between cards. Update
`tests/glow-browser/room-fake.ts` with reasons.

Tests: reason precedence table test, nickname in `fits_idea`, no reason text ever contains another participant's name
except for ideas, projection accepts and rejects (`reason` too long, unknown code), wire parse, Crate round trip.

### 13. Next-day rating follow-up (Backend, M; App UI, M)

Depends on item 4.

There are no push notifications in the app (no `expo-notifications`, no push tokens, no web push anywhere in
`yepwatch-app`, `yepwatch-realtime` or the contracts). Delivery is in-app on the next open. Adding push is a separate
project and isn't in this plan.

Server:

- When a room is decided (`decision` committed), add `{ key, decided_at, state: "pending" }` to the `followups` of
  every present participant's profile (members included, in their YepWatch profile). Done in the same place that
  copies decisions to history (`yw/proposal-history-sync.ts`), after commit, best effort, idempotent by
  `(profile, key, decided_at)`.
- `GET /profile` returns pending follow-ups older than 10 hours and younger than 7 days, with title display fields.
- `POST /profile/answers` with `source: "followup"` answers one: `loved` or `not_for_me` become taste answers (they
  also mark the title seen); "Didn't watch it" sets `state: "dismissed"` and adds nothing. Unanswered follow-ups are
  dropped after 7 days.
- Members: the rating stays in YepWatch (owner decision). It feeds their taste through the member blend in item 6.
  Nothing is written to GoodWatch.

App (App UI, M): on app open (start page or Your couches), if `GET /profile` has a pending follow-up, show one card
above the content: poster, "Last night's pick", the title, "How was it?", Loved it, Not for me, "Didn't watch it".
One at a time, newest first; dismissible; never blocks Join or New couch. Same Taste card look and exits as Taste mode
(`rethink.md` screen 3), reserved space so nothing shifts when it appears (render the slot after `GET /profile`
answers, with the slot's height fixed from first paint).

Tests: follow-up created once per decision, members included, window (10 hours to 7 days), answer writes taste, didn't
watch writes nothing, expiry; e2e for the card (CLS 0, 48 px targets, axe).

Risks: a couch that picked but didn't watch gets asked anyway; "Didn't watch it" handles that. A shared device (one
phone per couch) asks only the device's profile.

### 14. Tuning pass and documentation (Backend, S)

- Run the simulation (item 1) over a grid of `RANK_WEIGHTS`, the least misery mix and the quality floors; pick the
  best by group precision at 20 with misery at 20 no worse than baseline.
- Compare the production before and after windows from the outcome log.
- Update `yw/PROPOSAL-RUNBOOK.md` and `yw/CONTINUOUS.md` with the ranker, the profile table and the outcome log; update
  the stale POC bounds line in `yw/README.md:116` ("Personal taste/Seen prefilling, stronger diverse/fair ranking ...
  remain follow-up").

## Summary of contract, projection and DDL changes

| Change | Contract | Projection | Crate DDL | Item |
| --- | --- | --- | --- | --- |
| Room `startedAt`, `firstMatchAt`, `outcome` | no | no | additive room columns | 1 |
| Participant `profileId` | no | no | additive participant column | 4 |
| `yepwatch_taste_profile` table | profile API types | no | new table | 4, 13 |
| Profile paths | `paths` | no (HTTP only; add to release Caddyfile) | no | 4, 6, 13 |
| Member resource `taste` view | no (server to server) | no | no | 5 |
| `Candidate.reason` | yes | yes (strict) | additive candidate column | 12 |

The orchestrator applies DDL after a snapshot (`rethink.md`, Server).

## Performance budget

| Step | Where | Target warm |
| --- | --- | --- |
| Base pool (per snapshot, kinds, moods) | background, cached | built slice by slice, not on Start |
| Room pool (service index filter) | deck build | under 5 ms |
| Taste vectors and quantile tables | answer write, member read | never on Start |
| `rankDeck` for 3000 titles, 12 people | deck build | under 10 ms |
| Tail reorder per vote | vote command | under 1 ms |

Start still uses the prepared deck. No new GoodWatch read sits on Start: member taste copies are kept like seen copies,
and profiles are in process memory (a restart reads the room's profiles once at the first build, one Crate query by
id list). No new LLM calls: ideas keep the 24-interpretation budget, and item 8's re-read spends from it.

## Risks and open questions for the owner

1. Outcome logging versus `CONTINUOUS.md:76` (item 1): confirm aggregate-only logging is allowed.
2. "Loved by people with your taste" (item 12): replace with "Fits all 3 of you" and "Close to your taste", or build
   collaborative signals later.
3. Want to See reason in a couch of two (item 10).
4. Profiles are per device (item 4): a person on two devices has two profiles, and a lost phone loses the profile.
   Members could later key profiles by account instead.
5. Quality floors may starve niche service sets in small countries (item 2); the relax ladder and logs cover it, but
   the starting numbers need the simulation.
