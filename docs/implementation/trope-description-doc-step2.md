# Step 2 implementation report

Implemented on `feat/trope-description-backfill`; changes remain uncommitted. No network connections,
credentials, `.env` files, Windmill profiles, or production services were accessed.

## Files and design

- `goodwatch-flows/scripts/backfill_trope_description_docs.py`: separate `plan` and `apply` commands.
  Plan reads all catalog names with keyset pagination, groups described rows by canonical URL, and selects
  the first verified, extractable archive record in deterministic name order. Extraction tries strict mode,
  then linked mode with the known URL. Otherwise it selects the longest stored description; name order
  breaks ties. Each described variant gets the chosen text and document. Every document passes the step 1
  validator. Plain parsing ports the prototype's paragraph, boilerplate, heading, list, and name-link rules,
  including UTF-16 ranges, first mentions, and the distinct plural/possessive range behavior.
  Fetches sorted, merged HTTP ranges: gaps below 256 KiB, merged spans capped at 32 MiB, default concurrency
  2. Flags `--concurrency`, `--range-gap`, and `--pace` configure fetching. Responses require HTTP 206,
  exact Content-Range and length. Cache entries have identities and checksums; incomplete downloads never
  become complete entries. `progress.json` records completed ranges; cache bytes/metadata are rechecked on
  resume. Default cache: `~/.cache/trope-doc/archive-cache/`. Bounded retries honor numeric/date Retry-After
  on 429/5xx and back off on transport failures. HTTP 401/403/404 stop planning. Redirects are restricted to
  HTTPS Hugging Face infrastructure. No TV Tropes requests are made.
- `goodwatch-flows/scripts/stage_trope_catalog_archive.py`: extracts shared `verified_record`, now used by
  existing archive staging and this script. Verifies exact JSONL record bytes, Main/article shape, and
  decoded article UTF-8 hashes. Backfill also reuses `normalize_archive`, the existing extractor, atomic
  writes, and `import_trope_catalog.Crate`/`settings`. It verifies record/article hashes without downloading
  complete files to reverify file hashes.
- `goodwatch-flows/windmill/f/tvtropes_catalog/catalog.py`: optional `expected_hashes` import mode performs
  atomic hash-and-URL-guarded UPDATEs, batches writes, refreshes, and verifies stored documents for all
  source kinds. It cannot insert rows or change names, URLs, or provenance. Existing callers retain their
  behavior. Apply checks current hashes before importing too; concurrent changes are counted as stale.
- `goodwatch-flows/windmill/f/sync/init/cratedb.py`: shares the existing additive column loop as
  `add_missing_columns` and constructs the connector lazily. Apply uses this helper and the existing schema
  definition for just `trope_catalog.description_doc`, before importing. Other tables are not initialized.
- `goodwatch-flows/tests/test_backfill_trope_description_docs.py`: 45 offline tests with fake Crate and HTTP.
  Covers source selection/fallbacks, plain rules, UTF-16, ranges/slicing, cache corruption/resume, retries,
  fatal statuses, staging/seal, schema addition, stale/concurrent guards, verification failure, tampering,
  partial-write resume, and idempotence.
- `docs/implementation/trope-description-doc-step2.md`: this report and runbook.

Plan emits `changes.jsonl`: name, URL, old hash, selected text/hash/document/source, notes, and selected
archive evidence. `report.json` includes source counts, text-change/hash-mismatch counts, skipped rows and
reasons, links per changed row, and byte sizes. Seeded `samples.md` shows about 30 openings and readable
links, covering available sources, lists/headings, differing URL-group texts, hash mismatches, and
extraction/fetch failures. `manifest.json`, written last, seals all three files with SHA256 hashes.
Apply validates completeness and hashes before database or credential access, then uses those verified
bytes. It writes `apply-progress.json` after each batch and `apply-report.json` on completion; receipts
are outside the plan seal. Reruns inspect current database state rather than trusting receipts.

## Exact commands

Supply `CRATE_HOSTS`, `CRATE_USER`, and `CRATE_PASS` in the environment before running. The existing settings
helper otherwise uses its normal Windmill profile fallback. These commands were not run against services.

```sh
cd /home/alp/.cache/trope-doc/step2/goodwatch-flows
.venv/bin/python scripts/backfill_trope_description_docs.py plan --staging "$HOME/.cache/trope-doc/description-plan" --concurrency 2 --pace 0.25 --seed 82
```

Review `report.json`, `samples.md`, and `changes.jsonl`. After owner approval:

```sh
cd /home/alp/.cache/trope-doc/step2/goodwatch-flows
.venv/bin/python scripts/backfill_trope_description_docs.py apply --staging "$HOME/.cache/trope-doc/description-plan" --batch-size 200
```

Repeat apply to resume. A new plan needs a fresh, empty staging directory and reuses the default archive
cache. Never edit sealed files; corrections require a new plan.

## Verification

```sh
cd /home/alp/.cache/trope-doc/step2/goodwatch-flows
.venv/bin/python -m unittest discover -s tests -p 'test_*trope*.py'
```

421 tests: 417 passed, 4 skipped; no failures or errors. Includes 45 new backfill tests.
`git diff --check` passes. Verification used local files and fakes.

## Decisions and remaining work

- Step 2 authorizes text changes when unifying a URL group, refining the earlier spec's statement about
  preserving current values. These changes are counted and sampled.
- Archive identity/hash/extraction failures use plain fallback as requested in step 2. Another verified
  candidate in the group can still win.
- Existing per-row provenance stays unchanged when another variant supplies the selected archive. Selected
  evidence is stored separately in staging; document `source` describes document construction.
- Boilerplate removal can leave no paragraphs. The v1 validator requires nonempty documents, so those rows
  are skipped with a reason. Invalid URLs/importer inputs are reported; absent locators and unsupported
  archive payload kinds use plain fallback when possible.
- Owner approval is operational: run apply only after review. There is no approval-token service. The
  manifest detects changed/incomplete staging, not deliberate replacement of both files and the manifest.
- No live plan, downloads, production schema changes, apply, deployment, or webapp changes were performed.
  Live source availability, production counts, and actual Crate execution remain for the owner's run.

Intended commit message: `feat(tropes): stage and apply resumable description document backfill`
