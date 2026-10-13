# Item 001: durable pack and census

You are the builder for item 001 of the GoodWatch taste research loop. Work in the git worktree
`/home/alper/projects/goodwatch-monorepo/.claude/worktrees/taste-loop` (branch `research/taste-loop`). Paths below
are relative to it unless absolute.

## The question

Build the one data file ("pack") every later experiment reads, from a read-only pull of production, plus a census
of what it holds. Nothing is modelled in this item.

## Read first

- `docs/research/taste-loop/PLAN.md`: sections 2.1, 2.3 and 2.6 are your specification. Section 2.2 tells you what
  the tasks will need from the pack.
- `docs/research/taste-prediction/lab/build_pack.py`, `add_scores.py`, `gw.py`, `load.py`: the first loop's pull.
  Reuse their queries and their read-only helper (it reads credentials from
  `/home/alper/projects/goodwatch-monorepo/goodwatch-webapp/.env`; the worktree has no `.env`).
- `goodwatch-flows/windmill/f/sync/models/crate_schemas.py`: column names. Check actual columns with
  `information_schema.columns` before relying on them.
- `goodwatch-webapp/app/server/taste/pool.server.ts`: the reference pool rule the product uses.
- `CONTEXT.md`: terms.

## What to build

`docs/research/taste-loop/lab/pull.py`, run as `python3 pull.py --until <ISO time> --out <dir>`, plus
`lab/crate.py` (the read-only helper: refuses anything but `select`/`with`/`show`) and `lab/pack.py` (a loader
class other code imports).

1. **Member data, rows written up to `--until`** (filter on `created_at` where the table has it):
   `user_score` (user, title key, score, created_at, updated_at, has-review flag, no review text);
   `user_wishlist`, `user_skipped`, `user_not_interested`, `user_favorite` (user, title key, created_at,
   updated_at); `user_watch_state` (state, state_changed_at, pass, dates); `user_watch_log` (title and episode
   keys, watched_at, watched_at_precision, origin, import_id, pass); `user_import` (id, source, status, created_at,
   finished_at); `user_import_item` (import_id, title key, raw rating, source score, date rated, prior score,
   applied score, applied_at, outcome, kind; no titles as typed, no payload); `user_setting` (country and
   streaming services only). Not pulled: search history, lists, accounts, emails, handles.
2. **Titles.** The title universe is (a) every title any member touched in any table above and (b) the reference
   pool: every movie and show with a poster, a GoodWatch score and 1,000 or more votes. For each: the columns of
   the old `build_pack.py` and `add_scores.py` (fingerprint, public scores with counts, genres, keywords, tropes,
   essence text and tags, facts, flags, recommendation and similar ids, people as before for touched titles only),
   plus `movie_series_id` and release date. Per-season scores for shows any member touched. A boolean per title:
   in the reference pool. Text embeddings from Qdrant only for titles any member touched (the machine has 16 GB
   shared with other sessions; do not load embeddings for the whole pool). Titles without a fingerprint stay in,
   flagged.
3. **Provenance on every rating:** `import` (matches an applied import item for that member and title), `bulk`
   (5 or more of the member's ratings within 2 seconds), `typed` (the rest); `edited` when created_at and
   updated_at differ; sitting number (a new sitting starts after a gap of 6 hours or more in write time); position
   in the member's entry order. Use `created_at` as write time where it exists and say in the census how often it
   differs from `updated_at`. The same sitting and bulk marking for Want to See adds.
4. **Privacy.** Member ids are replaced by a keyed hash (HMAC-SHA256, first 16 hex characters) at pull time. The
   key is generated once and stored at `~/goodwatch-research/taste/key` (mode 600); it is never written into the
   pack or the repository. The owner (user id in the old `build_pack.py`) is flagged `is_owner`, not named.
5. **Tiers.** A seeded split of members (seed 20261013) into tier A (65%) and tier B (35%), stratified by number
   of ratings (0, 1 to 4, 5 to 19, 20 to 59, 60 or more). The owner is always in tier A. Write two packs:
   - `~/goodwatch-research/taste/packs/<date>/pack.pkl`: all titles; all members' non-rating rows; ratings of
     tier A members only; a list of tier B member hashes without their ratings.
   - `~/goodwatch-research/taste/gate/<date>/gate.pkl`: the ratings of tier B members. Nothing else reads it.
   Ratings and signals of tier B members other than their ratings (Want to See and so on) stay in the pack: T2b has
   no gate. Document this in the manifest.
6. **Manifest and census.** `MANIFEST.json` in the pack folder and copied to `docs/research/taste-loop/`:
   `--until`, pull start and end time, git commit, sha256 of each data file, row counts per table, members per
   tier, the reference pool rule and its size, the split seed. `docs/research/taste-loop/CENSUS.md`, counts only:
   members and rows per table; members by number of ratings (the strata above); ratings by provenance; members
   with one sitting, with two or more; members with 10 or more dated Want to See adds, with 10 or more Skips, with
   10 or more of each; Want to See titles later rated; Not interested rows; import pairs where a prior score and
   an applied score both exist (and how many differ); titles Seen but not rated; members with watch logs and with
   show statuses; share of rated titles with a fingerprint, with each public score; reference pool size; how many
   rated titles fall outside the reference pool.
7. **Determinism.** Every query is ordered and paged; a second run with the same `--until` must give the same
   sha256 for every data file. Serialize with sorted keys and fixed dtypes; no timestamps inside the data files.

Run it once with `--until` set to the current time, rounded down to the minute. That time is T0.

## Forbidden

- Any write to production. Any query other than a read.
- Member rows, ids or the key in the repository. Committed files hold counts only.
- Reading or copying anything from `~/goodwatch-research/taste/packs/old/taste/locked.pkl`.
- Installing packages (available: numpy, scipy, sklearn, requests). Background jobs, sleep or polling loops.
- More than 2 threads or about 4 GB of memory. Check `free -m` before the pull.

## Hand back

- Code in `docs/research/taste-loop/lab/`; `MANIFEST.json` and `CENSUS.md` in `docs/research/taste-loop/`. Do not
  commit; the orchestrator verifies and commits.
- Your final message is the report, at most 60 lines: what was pulled (counts), T0, anything in production that
  differs from the specification (missing columns, empty tables) and what you did about it, how you checked
  determinism and privacy, and anything the next items should know. If a table in the specification does not
  exist or is empty, say so; do not invent data.

## Acceptance (the orchestrator runs these, not you)

- The pack is under `~/goodwatch-research/taste/packs/<date>/` with mode 700; the gate file is outside it.
- `MANIFEST.json` and `CENSUS.md` exist in the repository folder and hold no member ids.
- Rating and member counts in the manifest match an independent `count(*)` with the same `--until`.
- Every rating has both dates and a provenance value.
- A search of the pack for a raw member id (UUID pattern) finds none.
- A second run with the same `--until` gives the same hashes.
