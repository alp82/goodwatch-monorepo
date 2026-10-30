# Step 2 implementation report

Implemented on `feat/trope-description-backfill`; changes remain uncommitted. No network connections,
credentials, `.env` files, Windmill profiles, or production services were accessed.

## Files and design

- `goodwatch-flows/scripts/backfill_trope_description_docs.py`: separate `plan` and `apply` commands.
  Plan reads all catalog names with keyset pagination, groups described rows by canonical URL, and selects
  the longest verified, extractable archive record only when it is at least as long as the longest stored
  description. Every archive candidate is tried in strict mode, then linked mode with the known URL if needed.
  Otherwise it selects the longest stored description with a plain document; name order breaks equal-length ties. Each described variant gets the chosen text and document. Every document passes the step 1
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
  source kinds and provenance fields. It cannot insert rows or change names or URLs. Existing callers retain their
  behavior. Apply checks current hashes before importing too; concurrent changes are counted as stale.
- `goodwatch-flows/windmill/f/sync/init/cratedb.py`: shares the existing additive column loop as
  `add_missing_columns` and constructs the connector lazily. Apply uses this helper and the existing schema
  definition for just `trope_catalog.description_doc`, before importing. Other tables are not initialized.
- `goodwatch-flows/tests/test_backfill_trope_description_docs.py`: 56 offline tests with fake Crate and HTTP.
  Covers source selection/fallbacks, plain rules, UTF-16, ranges/slicing, cache corruption/resume, retries,
  fatal statuses, staging/seal, schema addition, stale/concurrent guards, verification failure, tampering,
  partial-write resume, and idempotence.
- `docs/implementation/trope-description-doc-step2.md`: this report and runbook.

Plan emits `changes.jsonl`: name, URL, old hash, selected text/hash/document/source, notes, and selected
archive evidence, selected row name, and explicit provenance updates (empty for unchanged provenance). `report.json` includes source counts, text-change/hash-mismatch counts, skipped rows and
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

434 tests: 430 passed, 4 skipped; no failures or errors. Includes 56 backfill tests.
`git diff --check` passes. Verification used local files and fakes.

## Decisions and remaining work

- Step 2 authorizes text changes when unifying a URL group, refining the earlier spec's statement about
  preserving current values. These changes are counted and sampled.
- Archive identity/hash/extraction failures use plain fallback as requested in step 2. Another verified
  candidate in the group can still win.
- Per-row provenance stays unchanged when the text is unchanged. Text copied from another row carries that
  source's provenance as described below; document `source` describes document construction.
- Boilerplate removal can leave no paragraphs. The v1 validator requires nonempty documents, so those rows
  are skipped with a reason. Invalid URLs/importer inputs are reported; absent locators and unsupported
  archive payload kinds use plain fallback when possible.
- Owner approval is operational: run apply only after review. There is no approval-token service. The
  manifest detects changed/incomplete staging, not deliberate replacement of both files and the manifest.
- No live plan, downloads, production schema changes, apply, deployment, or webapp changes were performed.
  Live source availability, production counts, and actual Crate execution remain for the owner's run.

## Review fixes

- URL selection compares the extraction of **every** verified archive row with **every** stored description.
  The longest archive wins only when its length is at least the longest stored length (archive wins ties).
  Otherwise the longest stored text wins with a `plain` document. Name order breaks ties within each source
  kind. Both change construction and plan generation fail if a new text is shorter than that row's stored
  text, except when the sole difference is removal of whole recognized boilerplate paragraphs.
- One-word name links require `_identity(run)` or `_identity(singular)` to match the target page slug's
  identity. Multi-word matching retains its existing behavior. Self-links are stripped from all backfill
  paragraph/list items and from the shared step 1 extractor using the verified canonical URL. Their text
  and other annotations remain intact.
- A colon heading still meets the existing short-line limit, and now must contain at most six words,
  start with a capital letter, and avoid the specified conjunction/discourse prefixes (Or, And, But,
  However, Well, So, Also, Here, These, This, Some, Examples). Rejected headings remain paragraphs and
  can still introduce lists.
- Staging records `selected_name` and `new_provenance`. When changed text comes from another row's archive,
  apply writes the selected archive and clears `source_hash` and `fetched_at`. When it comes from another
  row's stored text, apply copies `source`, `source_hash`, `fetched_at`, and `source_archive`. Unchanged
  text keeps its own provenance. Guarded writes still require the old description hash and URL, and
  readback now verifies all four provenance fields as well as content. A provenance-only readback failure
  raises a verification error. Plans without the new provenance field are rejected before database access;
  regenerate the existing production plan into a fresh staging directory before review/apply.
- Superscript investigation used the verified local cached record for **Doomy Dooms of Doom**: its HTML
  contains `*d<sup>h</sup>oh<sub>1</sub>mos`, while the stored text contains `*dʰoh₁mos`. The original
  numeric-script implementation (`24c3b0227`) and the pre-step-1 extractor (`9bcda2e5b`) only map digits
  and operators and do not convert `h`. The stored modifier therefore came from another source/path;
  the provided text-only snapshot does not establish which. Per the review instruction, the tables
  remain unchanged. A regression test preserves the legacy `*dhoh₁mos` extraction behavior.
- Regression coverage includes longest archive selection after the first candidate, archive/stored/name
  ties, no shortening and its boilerplate exception, all six reported false link matches, self-links in
  paragraphs/lists, heading/list-intro boundaries, copied crawl/archive provenance, unchanged-text
  provenance, idempotence, missing staged provenance, and provenance readback failures.

This fix round used only local files and test fakes. The existing plan/review outputs and archive cache
were read without modification. No production access, network requests, credentials, `.env` files,
Windmill profiles, or commits were used.

Intended commit message: `fix(tropes): preserve description text and provenance during backfill`
