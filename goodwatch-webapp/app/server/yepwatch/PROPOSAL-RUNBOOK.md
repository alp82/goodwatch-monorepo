# Proposal protocol 3 local build

For the standalone guest-only private-beta build from clean `779a2752`, see
[GUEST-RELEASE.md](./GUEST-RELEASE.md). The original local-stack instructions below
remain for retained development rooms; they are not the release entrypoint.

Base `f5e06a2b`; approved prototype `5c4e53cf`. Implementation isolated at `/tmp/yepwatch-hybrid-backend-f5e06a2b`, excluding frozen unreviewed refresh and unrelated auth/analytics dirt. No commits, production writes, issuer registration or deployment.

## Modules and compatibility

- Portable `proposal.ts`/`PROPOSAL.md`: additive contract 3 export; continuous contract 2 unchanged. Published additively to main for app/gateway compilation.
- `proposal-machine.ts`: proposal/approval/timing over reviewed common setup/vote/page rules; explicit shared/own projections.
- `proposal-service.server.ts`: reviewed credential/admission/ticket/lease/receipt/CAS behavior adapted to separate namespace. Six bounded command CAS attempts, three checker attempts; checking commits before fresh network evidence. Durable pending index repairs after restart.
- `repository.server.ts`: explicit v3 table with same pending-check index semantics as v2; full-PK reads, `_seq_no`/`_primary_term` CAS. Crate truth; Valkey revision/activity only.
- `proposal-http.server.ts`/`proposal-runtime.server.ts`: namespaced validation/authorization/transport, existing Remix catchall dispatch; no client DB/cache and no production auto-DDL.
- `proposal-catalog.server.ts`: delegates existing catalog/filter/watchability/saved-progress methods; adds real movie viewing duration, leaves episode duration unknown rather than show average. Finite sample is not a launch-country/service restriction.
- `proposal-local-server.ts`: independent disposable runner; no issuer/reseeding. The existing local Node adapter now supports native and Remix-compatible Headers forms while preserving browser cookies.

Storage envelope stays `format:2` for existing member-read structural compatibility, with **required `flowVersion:3`, separate table, derivation labels, lease format3, `yepwatch3_` cookie, routes and public contract 3**. Internal old pick remains null compatibility storage, never a v3 command/projection. Internal decision retains checker version; public decision exposes exact proposal version. No migration or old-room reinterpretation.

## Runtime

New API15992 / gateway4324 / app8133 / Metro8141 / simulator8126. API uses new Crate15982 (`yepwatch-proposal-crate-20261022`) and Valkey46401 (`yepwatch-proposal-valkey-20261022`). Test-only Crate15981 (`yepwatch-proposal-verify-20261022`) was actually restarted for durability. All bind loopback. Existing15993+15984 shared process/stores/keys and all old stacks unchanged.

Private config `/tmp/yepwatch-hybrid-runtime-20261022/api.env`; gateway receives **only** `/tmp/yepwatch-hybrid-runtime-20261022/gateway-bearer.env`. Both mode0600; never commit/copy to public evidence. Read-only finite36-record catalog snapshot uses existing config. New room writes only disposable15982.

From isolated `goodwatch-webapp`:

```sh
node --env-file=/tmp/yepwatch-hybrid-runtime-20261022/api.env node_modules/vite-node/vite-node.mjs app/server/yepwatch/proposal-local-server.ts
```

Runner needs independent room/gateway secrets, explicit `YEPWATCH_CRATEDB_ORIGIN`, `YEPWATCH_REVISION_REDIS_URL`, `YEPWATCH_ALLOWED_ORIGINS`, `YEPWATCH_LOCAL_PORT=15992`, `YEPWATCH_LOCAL_CATALOG=goodwatch`. `YEPWATCH_INSTALL_DISPOSABLE_TABLE=1` only installs the disposable loopback table. Private catalog configuration is distinct from room storage. Production adapter takes separate `YEPWATCH_PROPOSAL_*` settings and never installs a table.

## Member seam and rollout limits

Handler accepts existing `ContinuousMembers` over new repository/read-only catalog adapter; no second account DB/issuer and no manual history. New callback must be explicitly allowlisted by existing public PKCE client configuration before enabling it. Retained local issuer currently allowlists15993/v2; new guest runtime returns unconfigured501, without registering clients or installing frozen refresh. Existing signed-in runtime remains available. New v3 browser/native member execution is not claimed.

Inherited bounds: logical TTL6 hours,12 people/12 screens,120 active cards,2000 seen-title keys,64 receipts/person,4 tickets/person, encrypted aggregate byte cap from `LIMITS.aggregateBytes`. These are resource limits, not unlimited suggestions. Unknown scan/coverage, known empty, exhaustion and capacity stay distinct. Disconnects keep quorum; no leave/kick/transfer UI.

Physical redaction/tombstone/key lifecycle and distributed command/admission limits remain public-rollout gates. Do not hard-delete while admitted in-flight writes could recreate/commit a room: retain deadline/tombstone denial through that horizon before compaction. This separate retention stage is not implemented and logical expiry is not physical deletion or production readiness.

## Verification

From repository root:

```sh
node --test goodwatch-webapp/app/server/yepwatch/proposal.test.ts goodwatch-webapp/app/server/yepwatch/proposal-catalog.test.ts goodwatch-webapp/app/server/yepwatch/proposal-catalog-paging.test.ts
YEPWATCH_TEST_PROPOSAL_CRATE_ORIGIN=http://127.0.0.1:15981 YEPWATCH_TEST_RESTART_CONTAINER=yepwatch-proposal-verify-20261022 node --test goodwatch-webapp/app/server/yepwatch/proposal-crate.integration.test.ts
```

Second command checks exact explicitly disposable container binding before restart. Ordinary tests cover proposal replacement/withdrawal/late join/Nope/undo, held-check races, committed lost acknowledgement and receipt replay, full-roster timing/missing implied measurement, canonical continuation pages/final saved maps. No new issuer/security probes or review-restriction workaround.

Observed actual local real-data smoke: unchanged DE/Netflix8 returned 7 cards (2 movies / 5 new shows),2 movie durations; measured Yep 1500 ms → proposal → fresh per-screen CAS Done. Sanitized `/tmp/yepwatch-hybrid-runtime-20261022/ordinary-smoke.json`; capabilities retained separately private. Finite sample only; no full-catalog or individual episode-entitlement claim. Gateway owner separately passed real API/controller multiplayer integration; app/physical Android evidence remains separate.


## Picks ranker (2026-11-15)

The release and webapp proposal routes use `guestProposalCatalog` for members and device profiles alike. It builds
quality pools in slices and caches their priors per snapshot, kinds, moods and floor step. Country service runs narrow
the pool before the evidence scan; a cold country index falls back to the evidence scan. Movies must be released;
shows use their first air year where the facts sidecar exists, and the scan still requires an aired episode.
Ideas get one softer floor and can admit otherwise excluded genres, never adult titles. Mood picks retain OR semantics.
`QUALITY`, `POOL_TARGET`, `RANK_WEIGHTS`, `LEAST_MISERY` and `RANKER_VERSION` own tuning. There is no collection
penalty because the current snapshot has no collection id.

The ranker scores at most 3000 eligible titles: up to 1500 idea titles first (each idea's best in turn), then the
base pool by quality, so an idea's own titles are never the ones a large pool cuts. Taste uses confidence-shrunk percentiles, 65% minimum and 35% mean;
confident hard vetoes stay out of the first page and return for refills. Unknown fingerprints are neutral. Quality
receives the taste weight when nobody has usable taste. Ideas steer and get two early turns each. Member Want to See,
a service shared by everyone with service picks, recent explicit profile Nopes, room-seeded jitter and a top-200
diversity pass finish the order. No new model call is made for ranking. Short idea readings after a service change
use the existing background interpreter and spend the same 24-interpretation lifetime allowance, down to a reserve
of eight (`REREAD_RESERVE`): switching services back and forth never leaves a room unable to read a new idea.

Prepared decks, prestored cards and the existing offer/episode/extras read caches remain in place. Member taste is
read and calibrated in the background after sign-in/setup changes, never fetched by Start or a vote. A copy is
read again once it is five minutes old (setup changes and the 10 s keep-alive), stays in use until the new one lands
and is neutral once ten minutes old or missing. When a taste lands or changes without a room write, the catalog
tells the service (`onInputsChanged`) and the room's deck is prepared again, so Start still finds a deck. A catalog's private `inputRevision` is included in prepared and refill identities;
finished decks cannot cross a change in cached taste revision. Start's last seen/hidden guard still uses stored
copies. Warm pool service filtering targets 5 ms; rank targets 10 ms for 3000 titles and 12 tastes; tail learning
targets 1 ms. The synthetic 200k-row pool test also verifies event-loop yields and a warm cache hit under 5 ms.
Measure on the deployed snapshot and hardware before asserting those budgets in production.

`proposal-feedback.ts` freezes every card anyone answered (including an undo record) and the first four unanswered
cards of every present person (`PROTECTED_UNANSWERED`): the card they are on, the one under it, and two more because
the app answers ahead of the server (votes still on their way). Only the remaining slots reorder, by stored base score plus current round feedback.
Half-weight single answers and group thresholds are separate feedback classes; additional votes within a class
reuse a refill. Recently retired cards retain their aggregate feedback within a bounded 120-answered-card window, keeping vote work bounded. `dealtKeys` keeps positions stable when an idea or
service edit removes untouched cards from `seenKeys`; it is private and never logged or projected.

### Member/profile integration boundary

`proposal-person-signal.ts` is the shared interface for items 4, 6 and 13. `PersonSignal` contains a unit vector in
GoodWatch fingerprint order, the 119-entry GoodWatch quantile table, confidence 0..1, explicitly unseen keys,
source (`member`/`profile`) and snapshot version. Null taste means neutral. A stale snapshot version is ignored.
Build/calibrate on answer writes or member reads, and cache by revision and snapshot version. Do not calibrate in
`stored`, Start, or a vote.

Device profiles implement `RoomTasteSource` in `proposal-profile-signals.ts` (`profileTasteSource(profiles, members)`),
which the release runtime passes to `guestProposalCatalog(members, profiles)`:

- A participant with a profile and no held GoodWatch taste ranks on their YepWatch answers (source `profile`,
  confidence `(loved + 0.5 * not for me) / 8`). A linked member whose GoodWatch taste is held keeps that vector with
  the answers blended in (`profileTaste`'s bounded blend, weight `n / (n + 20)`), counted once as source `member`
  with confidence `min(1, member + answers)`. A member without answers ranks on GoodWatch taste alone.
- Loved it / Not for me titles are the person's seen set (left out unless they show seen titles); Haven't seen it
  is the unseen set. Profiles have no hidden titles or wishlist; members' come from GoodWatch.
- Taste is built when answers are written (`TasteProfiles.answers`) and by `prepare` in a deck build or setup
  refresh. `stored` only looks up `TasteProfiles.held`: no read, no calculation. Start's only profile work is
  `prepareProfiles`, which takes the held revision (one primary-key read when the held copy is over ten minutes old).
- Deck identity: the participant's `tasteRevision` is in the prepared digest and the source's revision (profile
  revision, snapshot version, own or blend) is in `inputRevision`. A changed profile rebuilds the prepared deck;
  room reads that change neither leave it alone.
- Not built: the profile Nope history for the 30-day repeat penalty (`voteCommitted`, `roundEnded`). The store has
  a `dealt` column and no writer, so `nopes` is always empty for profiles.

The interface a source implements:

- `prepare(room)` batches missing device profiles before a background build. `stored(room, participant)` returns
  a synchronous `PersonalSignals` copy: revision, taste, seen, always-hidden keys, empty profile wishlist and an
  explicit-Nope timestamp map. Loved it/Not for me populate seen; Haven't seen populates taste.unseen.
- Supply the store as `guestProposalCatalog(members, profiles)` for both the guest and member release factories.
  Keep `profileId` and `tasteRevision` on the participant private. The prepared digest treats a profile as a personal
  input. After a profile write, schedule the setup rooms containing that profile with `service.decks.schedule(id)`.
  A source revision change invalidates a previously prepared page even without a room revision change.
- If a member has YepWatch answers, build the member/profile blend on write/read, return it from the profile source
  as `taste.source = "member"`. Otherwise cached GoodWatch taste wins, then profile taste. Never count one person
  twice. Only the GoodWatch source's wishlist contributes a Want to See boost.
- `roundEnded(room)` runs best effort after a committed decision/restart/logical expiry. Make it idempotent by room
  generation; retain at most 300 dealt keys and timestamp only explicit Nopes. Resolve `room.outcome[].position`
  through `room.dealtKeys` (fallback `seenKeys` for old rooms). Counts never reconstruct individual Nopes: use
  the `voteCommitted(room, participant, key, value, at)` source hook, which runs after successful vote CAS and before a subsequent refill can retire that vote. Persist explicit Nopes and undo in that hook; use retained private votes only as a fallback.
  Unanswered cards have no repeat penalty. The profile storage/API, taste deck and next-day follow-ups belong to
  items 4, 6 and 13 and are supplied separately.

The `taste` member resource is grant checked on every request; it returns a rounded vector, liked count, version,
500 newest wishlist keys and bounded hidden keys. No ratings leave GoodWatch. Copies are bound to room, seat,
account and current grant, expire after ten minutes, and become unusable when that grant is refused.

### Reasons and rolling deployment

Apply `migrations/20261115-picks-quality.sql` explicitly after a snapshot, before deploying. It adds candidate
`reason`, room timing, count-only outcomes, stable dealt positions and emission state. `schema.sql` is regenerated
for empty-store installation only. No migration is run on startup. Retained immutable candidate records accept
hashes from before the nullable reason addition.

Deploy the strict realtime projection and capability gate with/before the API. Existing app bundles use a strict
Candidate schema and reject a reason. HTTP only includes it for `?candidateReasons=1`; internal gateway reads and
committed hints retain it. Realtime only includes it for authentication with `candidateReasons: true`; this flag is
part of the frame serialization cache key. The app engineer must add the optional non-strict reason object to the
wire schema and only then declare both capabilities. No app source was changed by the backend work.

Copy uses "Close to your taste" and "Fits all N of you". Want to See remains anonymous and only gets a reason in
couches of at least three; the numerical boost also works for two. Only public ideas can name their author. Reasons
persist through tail reorders. Availability claims use a single service in everyone's picks, ignoring people who
picked none. A show's short-episode reason uses the first-episode runtime sidecar, never a show-average guess.

### Outcome baseline and tuning

`yepwatch_round_outcome` emits once per ended round attempt after commit: decision, restart, or the bounded minute
logical-expiry sweep (`proposal-expired-outcomes.ts`), independently of 30-day physical retention. Decisions and
expiry mark `outcomeEmittedAt` in the durable CAS before logging. Logging is best effort: a process crash between
commit and stdout can lose a line; stdout has no transactional exactly-once guarantee. Retention has a fallback
for older heads without an emission marker. No room, person, profile, title key, name, idea text or raw vector leaves
through these logs. Per-position counts and bucketed components survive vote retirement; build logs add pool size,
floor step, median score/votes, taste share, reasons, ranker version, and pool/taste/rank timings.

Use only an isolated read-only Crate copy. Evaluation scripts never load the application's .env and accept SELECT
only. Set `YEPWATCH_EVAL_READ_ONLY_COPY=1`, `YEPWATCH_EVAL_CRATE_ORIGIN`, `YEPWATCH_EVAL_CRATE_USERNAME`, and
`YEPWATCH_EVAL_CRATE_PASSWORD`. From `goodwatch-webapp`, run with a local `tsx` installation:

```sh
node --import tsx app/server/yepwatch/eval/replay-baseline.ts
YEPWATCH_EVAL_COUNTRY=DE YEPWATCH_EVAL_SERVICES=8,9 node --import tsx app/server/yepwatch/eval/group-sim.ts
```

Replay first counts retained versus currently referenced votes, deduplicates immutable votes by latest own revision
per room/generation/person/card, rejects ambiguous same-revision writes, and prints aggregates. Superseded rows also
contribute to the count: it cannot prove retired-card coverage without a controlled audit. Previous-generation and
departed rosters can be incomplete, so the outcome log is the authoritative baseline.

The simulation samples groups of 2..4 from members with at least 40 ratings, holds out a fixed-seed 30%, uses the
actual GoodWatch formula and calibration, and compares popularity against a 27-configuration grid of taste weights,
least-misery mix and floor steps. It reports group precision at 20, misery at 20, coverage and short-deck rate. It can
also consume `--fixture=/absolute/path.json` (see `EvalData`), without database access. Synthetic fixtures validate the
pipeline only. A deterministic 8-member/120-title smoke grid ran locally; no production data or baseline window was
available, so the approved starting weights/floors remain unchanged. Do not infer a production gain from that grid.
Collect at least one week and 50 rounds, then stage floors, taste and learning with at least 30 rounds between stages.
Compare Yep/card, match/round, cards to first match and decision rate; accept tuning only when precision does not
regress, misery improves and coverage is sufficient. Real-copy tuning and production before/after comparison remain
operator work after the baseline exists.
