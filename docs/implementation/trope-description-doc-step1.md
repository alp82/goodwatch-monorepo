# Step 1 implementation report

Implemented against the approved `trope-description-doc.md` spec on `feat/trope-description-doc`.
No production services, source sites, credentials, or `.env` files were accessed. No sample content is committed.

## Files and design

- `goodwatch-flows/windmill/f/tvtropes_catalog/descriptions.py`: live HTML, archive fragment, and full archived
  document adapters now return `description_doc` beside `description` (null on rejection). One DOM walk per
  paragraph event supplies text, inline annotations, and list membership. Both outputs use the existing sanitizer,
  paragraph guards, intro boundaries, continuation guards, minimum length, and complete-paragraph UTF-8 byte cap.
  Nested lists remain part of their parent legacy plain-text paragraph, so the cap accepts or rejects that entire
  group. Document list items have their own text and depth; text after a nested list becomes a continuation item
  at the parent's depth. Distinct adjacent source lists remain distinct document blocks.
- `description_docs.py` and its Windmill YAML/lock: pure v1 validation, wiki target filtering, UTF-16 length, and
  deterministic JSON serialization. Validates object shape, version/source, text, nonnegative list depths, sorted
  nonempty ranges within character boundaries, and non-overlap within each kind. Different kinds may overlap.
  Links allow wiki namespaces (including work pages), exclude Administrivia, and normalize to HTTPS without query
  or fragment. External/unsafe targets retain text without a link. Relative wiki targets are supported.
- `catalog.py`, `pages.py`: nullable JSON TEXT field travels with the description under existing conflict,
  provenance, source priority, replacement, and concurrency guards. Catalog imports validate documents even when
  called directly with normalized rows. Archive catalog readback includes the document; URI page full-document
  readback already covers every declared field.
- `windmill/f/sync/models/crate_schemas.py`: both description tables declare `description_doc TEXT INDEX OFF
  STORAGE WITH (columnstore = false)`. The standard initializer's existing additive column loop creates it on new
  tables and adds it on existing tables, just as its object-column loop adds missing archive children. No separate
  migration runner is needed. Apply this schema addition before importing to existing tables.
- `scripts/populate_trope_catalog.py`, `populate_trope_pages.py`, `stage_trope_catalog_archive.py`: retain the
  extracted document instead of discarding it. Archive duplicate detection now compares the document too; equal
  plain text with different links/formatting is a conflict to review.
- Tests: new `test_trope_description_docs.py`; updated archive result-key assertions, initializer assertions,
  populate caller assertions, and archive staging assertions/conflict coverage.

The sanitizer already drops `notelabel`, `inlinefolder`, `notetext`, `footnote`, `footnotes`, and `reference`.
The document and plain text therefore both drop these notes; plain-text extraction was not changed to keep or
remove additional footnotes. `em`/`i` and `span.spoiler` produce ranges. Headings retain their existing role as intro
boundaries: the validator accepts heading blocks, but these extractors do not start including headings or prose
past them. Generated sources are `crawl` and `archive`; validation also accepts `plain` for the later backfill.

## Description writer inventory

Repository search found these writes and producers:

| Writer or producer | Decision |
| --- | --- |
| `catalog.import_records` UPSERT, called by its Windmill `main`, `scripts/import_trope_catalog.py`, and `LabelCatalog.write` | Store the validated JSON string in the same guarded update as text. Explicit replacement with a legacy plain-only record clears any old document, avoiding stale formatting. Missing-only imports preserve the entire existing description bundle. |
| `populate_trope_catalog.LabelCatalog.record` | Carry the crawl extractor document into normalization/staging. |
| `stage_trope_catalog_archive.stage_archive` | Carry the archive document into reviewed records, preserving archive evidence and rejecting differing documents as conflicts. This stages files; the catalog importer does the database write. |
| `pages._write_sql`, executed by `pages.import_document` (single inserts, guarded updates, and fresh bulk inserts) | Include the document in `PAGE_FIELDS`, so writes, concurrency guards, receipts, and full-document verification all cover it. Preserve existing source priority and same-capture rules; this step does not enrich old rows automatically. |
| `populate_trope_pages.PageCatalog.record` | Carry the document into the page import bundle. References have no description and need no document column. |
| `scripts/import_trope_pages.py` | Uses the updated page normalizer/importer, so supplied documents survive without wrapper changes. |
| `scripts/recover_trope_descriptions.py` legacy short-description producer | Leave its distinct two-paragraph/four-sentence extraction unchanged. It stages a legacy `{text,url}` map without formatting. The importer accepts it with a null document; assigning a full-intro document to that shorter text would be incorrect. Plain fallback/backfill belongs to step 2. |
| Legacy seed/name maps and metadata-only imports | Continue accepting null documents. Metadata-only rows cannot attach a document and cannot erase an existing description bundle. |

No other production description write paths to either catalog table were found. Webapp catalog code reads them;
per-title `trope` excerpt writers target a different table and are outside this step.

## Local verification

Command, from `goodwatch-flows` using its supplied `.venv`:

```sh
.venv/bin/python -m unittest discover -s tests -p 'test_*trope*.py'
```

- Before: **204 tests, 184 passed, 16 errors, 4 skipped**, no assertion failures.
- After: **228 tests, 208 passed, 16 errors, 4 skipped**, no assertion failures.
- New independent document module: **24 tests passed**. Covers list nesting/wrappers/continuations, distinct lists,
  inline whitespace, emoji offsets, all range kinds, note cleanup, link filtering, shared selection and byte cap,
  all archive adapters, validation failures, JSON round trips, import guards/readback, and schema additions.
- The same 16 pre-existing errors remain: missing `requests`, `mongomock`, and `bson` (`pymongo`). Installing these
  into the supplied environment failed because PyPI DNS is unavailable. Tests in those blocked modules, including
  the new populate/staging assertions, could not execute. Four integration tests remain skipped.
- `git diff --check` passes. No live database integration was attempted.

Local archive samples were compared with both stored descriptions and the original HEAD extractor:

| Sample | Stored plain text equality | Document link ranges |
| --- | --- | ---: |
| Chekhov's Gunman | Exact | 30 |
| Red Herring | Exact | 21 |
| Chekhov's Gun | Different already at baseline: stored 437 characters, extraction 1,618; stored text is a substring with 130 preceding and 1,051 following characters | 11 |
| Foreshadowing | Exact | 28 |
| Jerkass | Exact | 33 |
| Mary Sue | Exact | 71 |
| The Worf Barrage | Exact | 29 |
| Don't Go Into the Woods | Strict name check rejects it, already at baseline; archived heading is “Don't Go in the Woods”. Existing linked mode accepts it and produces exact stored text | 26 in linked mode |

All eight records have the same plain-text result or rejection as the original extractor. All produced sample
JSON documents validate. Jerkass's `schadenfreude` links to `Main/ComedicSociopathy`. Red Herring has one list block;
Mary Sue has two. The index also includes Anti-Hero with no sample file; it could not be checked.

## Remaining scope

No backfill, name-matched links, URL-wide source selection, webapp rendering, production migration/apply, or push.
Those belong to later steps. No product decisions remain open for step 1. Before applying later work, resolve the
missing test dependencies and review the existing sample identity/text differences; identity guards were kept.
