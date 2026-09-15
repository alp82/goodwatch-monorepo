# Provider identity repair: implementation and rollout handoff

2026-09-15. Implementation only: no production mutation, schedule changes or deployment performed.

## Changes

- `goodwatch-flows/scripts/provider_identity_repair.py`: deterministic whole-title plans, complete source hashes, BSON Extended JSON archives with live published rows, fsync/readback, replica-set transactions, atomic completion receipts, idempotent replay, guarded structural rollback, persistent maintenance gate, server-enforced source write freeze, final identity validator/full unique index, full verification with pending/failure counts.
- `goodwatch-flows/windmill/f/tmdb_web/country_state.py`: a successful fenced scrape clears `identity_repair_pending`; failed scrape retains it. Runtime index setup recognizes and checks the final full index. Priority initialization refreshes mutable URL metadata on the existing country identity.
- `goodwatch-flows/windmill/f/tmdb_web/tmdb_init_providers/main.py`: bulk initialization updates URL metadata and normalization in the same conditional operation, including legacy singleton records. This matters for unordered bulk writes.
- `goodwatch-flows/windmill/f/sync/copy/tmdb_streaming.py`: pending repair countries freeze both API and scrape contributions; previous published availability survives until fresh verification. Publication acquisition and ownership checks honor persistent maintenance.
- `goodwatch-flows/tests/test_provider_identity_repair.py`: ten tests exercising a real MongoDB 6 replica set and actual shared initialization/state/reconciliation functions.

Every duplicate group receives a deterministic identity survivor, preferring an existing validated record, otherwise the lowest ObjectId. Its old snapshot is not treated as a new truth. All source documents, including the survivor, are archived. No offer lists are combined. Duplicate survivors receive a numeric TMDB watch URL, a pending marker and a fetch deadline which retains future failure backoff from every duplicate. Source `updated_at` remains unchanged until successful fetching. Existing verified singleton records only require normalization, not forced recrawling.

## Validation

A dedicated local MongoDB 6 container uses a single-member replica set. It is unrelated to the preexisting local `mongodb` container or production. All test databases are UUID-named and deleted after each test; the dedicated container remains available for the next reviewer.

```bash
PROVIDER_REPAIR_TEST_URI='mongodb://127.0.0.1:27129/?directConnection=true&replicaSet=repair' goodwatch-flows/.venv/bin/python -m unittest discover -s goodwatch-flows/tests -p test_provider_identity_repair.py -v
goodwatch-flows/.venv/bin/python -m unittest discover -s goodwatch-flows/tests -p 'test_streaming_*.py'
goodwatch-flows/.venv/bin/python -m unittest discover -s goodwatch-flows/tests -p test_priority_publish.py
```

Ten integration tests, 49 streaming tests and 20 priority publication/acknowledgment tests passed. Coverage includes conflicting empty/nonempty snapshots, binary/decimal archive fidelity, receipt-write failure rolling back source deletion, restart, corruption rejection, partial maintenance completion restart, source/publication leases and write freezes, failure-preserving publication, successful-empty removal, backoff, concurrent initialization, changed slugs and movie/TV ID overlap.

The audit's actual five-title snapshots were replanned from live read-only queries, then replayed into isolated MongoDB. The actual `identity_map` reported **244 errors before and zero after**. Result: 166 active records, zero invalid/unready/duplicate identities, and **122 pending countries**. Final index and validator installed successfully on this replay. This proves structural repair of the original fixtures, not live freshness.

Private evidence root: `/home/alp/.local/state/goodwatch/provider-identity-repair`.

- `sample-plans/summary.json`: exact counts and manifest hashes for all five titles.
- `sample-plans/movie-526028.json`: 58 originals, 29 duplicate groups; manifest `444b1673a1bc7b4c2d31a5a5ccdb3b91c2afcbcae88c8d9a57dee6b082d3e876`.
- `sample-plans/tv-69283.json`: 91 originals, 33 duplicate groups and 25 singleton normalizations; manifest `bee494ec7453cfe492bff9b97a789f65ed46ca48a69dc967e412598c8fbdc7f1`.
- `replay-result.json`, `local-replay-archives/`: isolated replay output. Published rows in these local test archives are empty test inputs, **not production publication backups**.
- `plan_samples.py`: read-only refresh of sample plans using the existing private Windmill profile helper.
- `replay_samples.py`: repeatable original-fixture regression on the dedicated local MongoDB.
- `audit.py` / `inventory.sqlite`: full live inventory continues independently. Do not run a second scanner while PID 553776 remains active. No invalid identities had appeared in the partial scan during implementation; full totals are still required.

## Controlled rollout sequence

1. Independently review these changes and rerun the test commands. Preserve unrelated dirty documentation.
2. Capture current deployment metadata/content and schedule states privately. Deploy **only** the three changed Windmill Python paths above. Existing Python imports/signatures did not change, so local script YAML schemas and pip lock files need no dependency additions. Preserve the deployed schema, lock and runtime fields. Use the existing authenticated Windmill profile and its script create/update API; GET each `scripts/get/p/<path>` before and after. Set `parent_hash` to the captured deployed hash and verify returned content byte-for-byte. Do not use a broad `wmill sync push` in this dirty workspace. The CLI is not installed here; the audit's private profile helper already accesses the API.
3. Also verify transitive import resolution for deployed `f/tmdb_web/tmdb_crawl_providers/fetch`, `f/tmdb_web/tmdb_init_providers/update`, and the sync/priority callers. Existing jobs started before deployment must drain: old executable code does not honor the new publication gate.
4. Enumerate and pause affected scheduled init/crawl/publication entrypoints, preserving exact original enabled states in a private durable manifest. Drain running old-code parents/children. The persistent gate blocks new/manual publishers; Mongo validators block old or manual source writers even if they bypass application checks. Reversible schedule capture/pause/restore is rollout-agent work, not performed by the implementation tool.
5. Load connection settings in memory from existing private profiles. The command reads `PROVIDER_REPAIR_MONGO_URI`, `PROVIDER_REPAIR_MONGO_DB`; apply/rollback additionally read `PROVIDER_REPAIR_CRATE_SQL_URL` and optional `PROVIDER_REPAIR_CRATE_USER`/`PROVIDER_REPAIR_CRATE_PASSWORD`. Never put credentials in command arguments, repository files or logs. The Python functions also accept existing clients and a `read_published(media, tmdb_id)` callback to the existing Crate connector.
6. Run `begin`. It persists the gate and original Mongo validators with majority write concern, freezes both source collections using strict reject-all validators, and refuses to proceed until existing source and publication leases expire/release. An error saying to wait is expected while draining; it deliberately leaves the gate closed. Repeat `begin` after draining. There is no automatic TTL reopening after a crash. `finish` restores the original validators and opens the gate; schedules need their separately recorded restoration.
7. Replan the small live batch **inside the frozen window**, because earlier dry runs can become stale. Apply one title per transaction; start with movie 526028 and TV 69283. Each apply reads all current published title rows from Crate, writes/verifies their archive together with every original source record, then conditionally rechecks the entire title and mutates source/receipt atomically. No HTTP fetch occurs inside the Mongo transaction. Add the live movie/TV overlapping-ID case for end-to-end testing.
8. `finish` the small window; restore schedules to previous states. Use the existing deployed fetch entrypoint with canonical country `_id`s, preserving shared upstream backoff and bounded concurrency. Run representative priority processing through publication and durable acknowledgment. Verify real source timestamps, fresh-empty removal, successful offers, and explicit pending/failure/retry outcomes. A source row with a pending marker must not replace any existing country availability from either source.
9. For full structural batches, use the inventory to enumerate distinct duplicate/unready titles, then make fresh manifests under maintenance. Archive and checkpoint each title independently. Rerunning an applied manifest returns its atomic receipt without another mutation. A source mismatch requires replanning; it is never silently accepted. Normalization of valid singleton records is included in each title plan. If the full scan reveals ambiguous identities, classify them explicitly; the tool refuses to guess/quarantine/delete them. Such rows must be resolved before final activation, with originals archived through a separately reviewed policy.
10. `finalize` only after full structural cleanup. It performs a full scan and refuses if any duplicate, invalid or unready records remain. It builds unique nonpartial `(tmdb_id, country_code)` indexes in both separate media collections, and installs strict validators requiring positive integer IDs, uppercase two-letter countries, readiness true and string URLs. It then opens the gate. If interrupted between collections, rerunning `finalize` refreezes and completes safely. Existing partial indexes may remain; they no longer provide the sole protection.
11. Run `verify` after reopening and during refresh. It reports structural invalid/duplicate/unready counts separately from pending and pending-failed countries, regardless of upstream blocking. Keep these reports as operator monitoring evidence. The existing scheduled backlog excludes backoff and shared upstream blocks intentionally; it must not be treated as proof of zero pending repair work. Full freshness is distinct from structural completion.

### Command forms

Run from the repository root after loading credentials in the environment. `--output` is a file for plan/audit/verify, an archive directory for apply, and required but unused for begin/finish/finalize/rollback.

```bash
goodwatch-flows/.venv/bin/python goodwatch-flows/scripts/provider_identity_repair.py begin --output /private/repair
goodwatch-flows/.venv/bin/python goodwatch-flows/scripts/provider_identity_repair.py plan --media movie --tmdb-id 526028 --output /private/repair/movie-526028.json
goodwatch-flows/.venv/bin/python goodwatch-flows/scripts/provider_identity_repair.py apply --manifest /private/repair/movie-526028.json --output /private/repair/archives
goodwatch-flows/.venv/bin/python goodwatch-flows/scripts/provider_identity_repair.py finish --output /private/repair
goodwatch-flows/.venv/bin/python goodwatch-flows/scripts/provider_identity_repair.py verify --output /private/repair/verification.json
```

For bounded full batches, a private adapter can call `plan_title`/`durable`/`apply_title` for inventory-selected titles, then record each returned receipt before advancing. Use `finalize` instead of `finish` only at final invariant activation. Do not expose maintenance bypass privileges to new application writers.

## Recovery boundaries

`rollback --plan-id <hash>` requires maintenance, unchanged post-repair source hash, unchanged published rows, intact archive hash, and absence of the final full index. It restores all original source records transactionally and marks the receipt rolled back. It never overwrites fresh source or publication data. Once successful refresh/publication has happened, rolling back is a new migration decision; the archived original data remains recoverable, but automatic stale restoration is refused.

No standalone fallback is implemented because production uses a replica set. A failure during structural mutation aborts the transaction; a failure after commit is recognized by the receipt. A failure during maintenance leaves the gate closed for explicit operator recovery. This fail-closed behavior intentionally prioritizes source preservation over continuing writes during an interrupted repair.
