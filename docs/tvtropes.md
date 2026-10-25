# TV Tropes

GoodWatch shows the tropes TV Tropes lists for a title (Mongo `tv_tropes_{movie,tv}_tags`, copied to Crate
`movie/show.tropes` and `trope` by `f/sync/copy/tvtropes`). Research: `docs/research/tvtropes-rebuild.md`; earlier
repair evidence: [tvtropes-repair/](research/tvtropes-repair/README.md), issues #118–#120 and #123.

Owner decisions (2026-09-21 and 2026-09-26), all binding:

- Don't email TV Tropes for permission.
- Never solve or work around a Cloudflare challenge, and never rotate proxies.
- Production is challenged by IP address, so it doesn't crawl TV Tropes (see [the flag](#production-crawl_tvtropes-flag)).
- Tropes are recovered from the dev machine in small, supervised batches that a person reviews before import. A
  scheduled crawler on the dev machine was rejected, because it would route around the IP block.
  On 2026-10-25 the owner explicitly authorized a one-off run to scrape and store all missing general definitions,
  across the global catalog rather than one profile. The full-catalog runner below implements that exception;
  the source block rules and prohibition on scheduled crawling still apply.
- TV Tropes' robots.txt disallows `Claude*` and other AI agents. Agents never read TV Tropes pages with their own
  web tools; only the runner below fetches pages, under its own user agent.

## General trope catalog

The Crate `trope_catalog` table is the source of truth for general trope definitions, separate from the `trope`
table's per-title excerpts. Each exact name has an optional known Main-page URL and an optional description. Names with
unresolved URL mappings have null URLs and remain queued for review. Direct HTTP descriptions retain the raw response's
SHA256, the exact text's SHA256, actual fetch time, source, and import/update times. Unknown provenance stays null.

Archived HTML fragments use nullable `source_archive` metadata instead of claiming a direct HTTP capture. This small
object records the public Hugging Face dataset, full pinned revision and immutable file URL, verified file SHA256,
exact JSONL-record SHA256, literal article-string UTF-8 SHA256, `payload_kind: article_html_fragment`, and the actual
archive retrieval time. A byte offset/length pair can locate the exact record slice. Raw HTML stays in the local
verified archive, never in this object. Archived descriptions keep both `source_hash` and `fetched_at` null: a
repository revision, dataset year or archive download date is not evidence of when TV Tropes served that page.
Their `source` remains `tvtropes`; `description_hash` still identifies the extracted text. Existing populated
HTTP rows are preserved by the normal missing-only import guard, including their capture provenance.

Declare `source_archive OBJECT(DYNAMIC)` through the standard Crate initializer before using the extended importer
against an existing database. The importer's create-if-missing check does not migrate an existing table's columns.

On 2026-10-25 the original 100 descriptions were imported from the earlier prototype's saved responses and verified
byte for byte, including URLs and provenance. The runtime JSON file was removed after verification. The app reads
current catalog entries independently of cached profile calculations, so additions require no code deployment once
the database reader is deployed. The first page reads only its first 30 names.

The initial catalog import contains 21,747 exact names/URLs and 120 descriptions: the original 100 plus 20
source-verified additions reviewed by subagents. All 30 leading tropes of @alperortac's captured profile have a
description. Of the prototype inventory, 222 ambiguous Main-URL mappings and seven invalid URLs were held out.
The two bounded recovery batches and review evidence are saved under
`~/.cache/goodwatch/trope-catalog/2026-10-25-{first20,next10}/`; the first batch stopped after ten responses on
extraction failures, which were corrected by offline review without refetching. All 120 descriptions have actual
source hashes and fetch timestamps. This count records the 2026-10-25 import, not a live coverage counter.

`f/tvtropes_catalog/catalog` imports reviewed records in Windmill. The local CLI uses the existing Windmill CLI
profile's Crate variables or `CRATE_HOSTS`, `CRATE_USER`, `CRATE_PASS`. Importing performs no TV Tropes requests.
Input is a record array, `{records:[...]}`, or a name map; each record has `name`, `url`, and optionally `description`
(or `text`), `source_hash`, `fetched_at`. The source is `tvtropes`. A captured recovery log can supply hash/date evidence.

```sh
# Inspect the exact insert/update/unchanged counts, then apply the same reviewed batch.
python goodwatch-flows/scripts/import_trope_catalog.py REVIEWED.json --evidence-log RUN/run.json --expect-count N
python goodwatch-flows/scripts/import_trope_catalog.py REVIEWED.json --evidence-log RUN/run.json --expect-count N --apply
```

Imports create the catalog if needed, check every bulk result, and are idempotent. Metadata-only rows preserve
existing descriptions and attribution. Existing text is replaced only with explicit `--replace-descriptions`.

For expansion, subagents may divide inventory and review saved source pages; the owner authorized this review path
for general descriptions on 2026-10-25. One supervised local runner fetches the batch, using known Main URLs and the
existing recovery client's identifying user agent and saved block state. The defaults are 20 requests, six seconds
apart, with a hard stop on a block or three consecutive failures. It makes no database writes. Source archives and
run evidence stay in the chosen output directory. General-definition extraction is a review candidate: quotes,
footnotes, ellipses and setup-only paragraphs need checking against the saved introduction before import.

```sh
python goodwatch-flows/scripts/recover_trope_descriptions.py QUEUE.json RUN --max-requests 20 --delay 6
```

Use a queue of `{name,url}` entries from existing catalog/title metadata, prioritize missing definitions on visible
profile bands, and review canonical URL and exact subject against every saved page. The crawler restrictions above
continue to apply. A scheduled network crawler is not part of this pipeline.

### One-off full-catalog population, 2026-10-25

The global inventory reads all 3,829,905 per-title `trope` associations, not a profile or the prototype's 694 titles.
It expanded `trope_catalog` to 38,029 exact names, with 220 descriptions already stored and 37,809 initially missing.
Of those names, 356 still have no unambiguous known URL. Those and source identity/extraction failures go to review;
the runner never guesses URLs or substitutes generated descriptions.
Offline review subsequently selected known fetch candidates for 353 of those 356 names, mostly case-only URL
variants. These selections are not claims of canonical identity: each fetched page must still pass the heading and
canonical checks. The three remaining labels are contextual or gender-swapped names without a unique subject.
A subsequent audit of excluded URLs recovered eight more names from duplicated site prefixes and the known
`Main/Time_Slip` route, bringing the inventory to 38,038 names. The exact underscore path is retained, never guessed.
Non-Main links to creators, works and other namespaces remain outside the general-definition catalog; the URL audit
and original grouped pairs are saved in the run's `inventory/` directory.

`goodwatch-flows/scripts/populate_trope_catalog.py run --all` queues every catalog row whose description is null.
It uses the existing recovery client's identifying user agent, a single worker lock and persistent pacing of at
least six seconds. It stores validated introductions directly in Crate, preserving existing definitions and recording
the source hash, exact text hash and original fetch time. Canonical URL and page heading must identify the subject.
A renamed subject is also accepted when its exact old name matches the requested known URL and the source
response explicitly redirects from that same URL to a validated canonical page. Contextual labels that merely link
to a differently named trope do not meet that rule. Reviewed redirect evidence stays beside the run journals.
Raw responses, the immutable queue, request/outcome journals and `progress.json` stay in the output directory.
Saved pages are reused without fetching them again; a database interruption leaves a replayable record.

The one-off user service is `goodwatch-trope-catalog-full.service`, with no recurring crawl schedule.
Its output is `~/.cache/goodwatch/trope-catalog/full-2026-10-25/`; `inventory/` there holds the global inventory and
URL review evidence. The run has no request-count cap with `--all`. Allow roughly 2½ days for the known URLs at
the minimum pace, plus review. A 403, 429 or challenge records a shared cooldown and stops; three consecutive
network/server failures or a database error stop the current pass. On the owner's explicit instruction to continue
until the catalog is populated, `--until-complete` waits through recorded source cooldowns on the same network and
backs off before retrying transient failures. Code/configuration errors and unresolved review entries require
inspection; they are not retried in a loop. Never move the run to another network to bypass a block. The user
service is enabled for reboot resumption, with user lingering enabled so logout does not stop it.

```sh
# Monitor the active service and its local checkpoint.
systemctl --user status goodwatch-trope-catalog-full.service
python goodwatch-flows/scripts/populate_trope_catalog.py status \
  --output ~/.cache/goodwatch/trope-catalog/full-2026-10-25 --with-database

# Resume the same queue after inspecting the stop reason and respecting any source cooldown.
python goodwatch-flows/scripts/populate_trope_catalog.py run --all --until-complete \
  --output ~/.cache/goodwatch/trope-catalog/full-2026-10-25 \
  --state /home/alp/dev/projects/goodwatch/goodwatch-monorepo/docs/research/tvtropes-repair/runner-state.json
```

Use an environment with the recovery runner's dependencies and `html5lib`. The active service uses the flows venv
and `PYTHONPATH=~/.cache/goodwatch/trope-catalog/deps` for the isolated parser dependencies. `--refresh-queue`
merges newly imported metadata into the saved queue; `--retry-review` rechecks rejected entries against saved
sources and the same block state. Neither flag clears a source block. Stop the worker with
`systemctl --user stop goodwatch-trope-catalog-full.service`; its journals allow resuming without losing imported text.

## Production: `crawl_tvtropes` flag

`f/priority/crawl_all` has a `crawl_tvtropes` input, default `false`, like `crawl_imdb`. While it is off, both TV Tropes
modules (`tvtropes_init_tags/update` and `crawl_all_by_id`) are skipped, no title is selected, and publish and the
priority lease release run as usual. Before the flag, the TV Tropes branch took about 445 s of a 459 s run and was
challenged for about 94% of titles. Busy runs took a median of 442 s (455 runs, 2026-09-24 to 2026-09-26 08:05 UTC);
the first runs after the flag took 45–155 s.

To turn it back on, set `crawl_tvtropes: true` in the args of the `f/priority/crawl_all` schedule. The per-title fetch
(`f/tvtropes_web/tv_tropes_crawl_tags/fetch`) then fails fast:

- It uses only the stored `tvtropes_url` and never guesses a slug. A title without a stored URL costs no request.
- It uses the strict identity rule only, because production writes without review.
- It uses plain HTTP through `f/critic_sites/polite_http` under site key `tvtropes`: one request every 6 s shared by
  every worker, and user agent `GoodWatchBot/0.1 (+https://goodwatch.app; hello@goodwatch.app) tvtropes`.
- A 403, a 429 or a challenge stops the site (`critic_site_state._id: tvtropes`, logged in `critic_site_blocks`).
  Until the deadline, every title is skipped without a request.
- Blocks, errors, missing pages and rejected pages are recorded on the document (`failed_at`, `error_message`) and
  returned, never raised, so the flow does not retry through them. Existing URLs and tropes are kept.
- A title crawled or failed in the past day is skipped.

## Local recovery runner

`goodwatch-flows/scripts/recover_tvtropes.py` rebuilds the local recovery on the Rotten Tomatoes and Metacritic design
([critic-scores.md](critic-scores.md)). The crawl itself lives in Windmill library modules, so production and the runner
share it:

- `f/tvtropes_web/pages.py` parses a page with html5lib, which splits elements the way a browser does, and checks
  identity. On the 96 titles recovered in #120 it reproduces the Playwright crawler's trope lists byte for byte.
- `f/tvtropes_web/crawl.py` runs `crawl_title(get, …)` over the known URLs.

| | |
|---|---|
| Transport | Plain HTTP (`requests`), no browser. User agent `GoodWatchBot/0.1 (+https://goodwatch.app; hello@goodwatch.app) tvtropes-recovery`. |
| URLs | Known URLs only, in this order: the stored URL, Wikidata `P6839`, then the CC0 [adorkin/tvtropes2imdb](https://huggingface.co/datasets/adorkin/tvtropes2imdb) mapping (films only; `scripts/data/tvtropes2imdb.csv`, 9,262 pages, 2023-02, through the title's effective IMDb id). No slug is guessed: the research found that guessing costs about 3× the requests and doesn't pay off. `Main/`, `Franchise/`, `WebVideo/` and the other medium's namespace are rejected without a request. |
| Identity | A page passes the strict #129 rule (`identifies_work`). If it doesn't, the runner also accepts `matches_known_url`: the title in the page name or introduction, the page name's year or the introduction's first year within a year of the release, and the medium from `Film/` or `Series/`. Shared namespaces (`WesternAnimation/`, `Anime/`) must name the medium. The strict rule wants a medium word in the dated sentence, and TV Tropes intros often say "Dom Com" or "Cop Show" instead. Each result records which rule passed. |
| Pace | One request every 6 s (`--delay`, at least 2 s), for the whole site. |
| Blocks | A 403, a 429, `cf-mitigated: challenge`, a 202 with an empty body or a challenge page title stops the run. The block is logged, and every later run refuses to start until the deadline (429: `Retry-After`, 1 h to 7 days; otherwise 24 h). Nothing is retried through a block. Three failures in a row (5xx, timeouts, broken subpages) also stop the run. |
| Negative cache | A 404 or a rejected page is skipped for 90 days. A rejection by the identity rules expires early when `IDENTITY_RULES` changes. |
| Order | Most popular first (TMDB popularity). |
| Resume | A run directory keeps `results.jsonl`, and a new run in the same directory skips finished titles. A title cut off by the request budget starts again. The directory is tied to one queue file by its hash. |
| State | `docs/research/tvtropes-repair/runner-state.json` holds the negative cache and the block log. Commit it with the run. |
| Evidence | Every response is saved under `sources/` (gzip), with its status, URL and hash in `results.jsonl`. `summary.json` and `attempts.jsonl` record each run. |
| Writes | None. The runner never connects to a database for writing; `queue` only reads. |

### Run it

From the repository root, with a Python environment that has `requests beautifulsoup4 html5lib pymongo mongoengine
pydantic`. Mongo credentials come from the goodwatch Windmill CLI profile, as for the importer, and are never printed.

```bash
# 1. Queue: the 10k most popular movies and 10k shows without tropes that have a known URL (read-only).
python goodwatch-flows/scripts/recover_tvtropes.py queue docs/research/tvtropes-repair/queue-YYYY-MM-DD.json --top 10000

# 2. Crawl a bounded batch. Run it again to continue; it stops on its own at a block.
python goodwatch-flows/scripts/recover_tvtropes.py run docs/research/tvtropes-repair/queue-YYYY-MM-DD.json \
  docs/research/tvtropes-repair/run-YYYY-MM-DD --max-requests 500 --delay 6

# 3. Review table.
python goodwatch-flows/scripts/recover_tvtropes.py review docs/research/tvtropes-repair/run-YYYY-MM-DD
```

A run that stops with `stop_reason` naming a block must not be retried before the deadline. It must never be retried
from another machine or network.

### Size of the work

Queue of 2026-09-26 (`research/tvtropes-repair/queue-2026-09-26.json`), top 10k movies and top 10k shows:

| | |
|---|---:|
| Titles | 19,999 |
| With tropes already | 10,660 |
| Without tropes and without a known URL (never requested) | 8,490 |
| Without tropes, with a known URL (queued) | 849 (546 movies, 303 shows) |
| Candidate URLs: stored / Wikidata / tvtropes2imdb | 566 / 233 / 164 |
| Candidates that need a request | 826 |

At most 826 first-page requests plus subpages: about 1.15 requests per movie and about 2 per show, so roughly 1,100
requests. At 6 s per request that is about 1 h 50 min, in batches. The live batch below averaged 5.8 s per request,
including parsing.

The importer fills documents that have no tropes. A title that already has tropes is replaced only through a reviewed
re-check (below), one listed title at a time; there is no bulk refresh of the 10,660 titles with (mostly 2025) tropes.
The research estimates about 16,600 requests for all known URLs in the top 10k: about 28 h at 6 s, or 9 h at 2 s.

### Review and import

Publishing goes through the reviewed path from #120 (`goodwatch-flows/scripts/import_tvtropes_recovered.py`):

1. In `run-…/review.md`, check each recovered row against its page: same work, year and medium. Change `review` to `ok`
   for the rows to publish. Give `known_url` rows the closest look.
2. Build the allow-list. It refuses unless the count, URLs and trope counts match the review:
   `import_tvtropes_recovered.py build-manifest RUN_DIR --report RUN_DIR/review.md --output RUN_DIR/import-manifest.json --expect N`.
3. Dry run (read-only): `import_tvtropes_recovered.py RUN_DIR --allow-file RUN_DIR/import-manifest.json`.
4. Apply: add `--apply --expect-count N`. This writes a rollback file first. It never creates documents and never
   replaces existing tropes, and each write is guarded by the document's previous URL and `updated_at`.
5. The next `f/sync/copy/tvtropes` run copies the documents to Crate (it picks up `updated_at` from the past 48 h).
   Undo with `--rollback <file>`.

### Re-check and correct titles that have tropes (#123)

For a reviewed list of suspicious matches only. Default `queue`, `run` and import behavior is unchanged.

- `recover_tvtropes.py queue QUEUE --recheck FILE` queues only the titles in `FILE` (`media_type:tmdb_id` per line),
  with or without tropes. It tries the Wikidata and tvtropes2imdb pages before the stored one, and each row records the
  page and trope count it would replace. A reviewer may edit the queue's candidates, for example to add a link from a
  disambiguation page (source `page_link`), which is a known URL, not a guessed slug.
- `run … --saved RUN_DIR` (repeatable) answers from pages an earlier run saved: no request, no pause, no budget. Blocks
  are never replayed.
- A queue entry may carry `accept: [{url, reason}]` for a page the reviewer has read and accepted, although the
  identity rules reject its wording ("the third film in the Alien film series") or a festival year. The runner marks it
  rule `reviewed`, and the negative cache doesn't hide it. Production never passes accepted URLs.
- Replacements use the normal review, `build-manifest` and import path. A re-checked row's manifest entry names the
  page and trope count it replaces; `--apply` replaces only a document that still holds exactly those, and
  `--backup-collection NAME` (required) copies the whole document first.
- Removals: `import_tvtropes_recovered.py remove removals.json --rollback-out FILE`, then `--apply --expect-count N
  --backup-collection NAME`. The list names each document's reviewed URL, trope count and a reason. A document is
  cleared (`tropes: []`, URL unset, `updated_at` now) only while it still holds them. `--rollback FILE` restores it.
- Crate: `f/sync/copy/tvtropes` only upserts, so afterwards delete the title's `trope` rows whose names are no longer in
  its Mongo tropes, scoped by media type and TMDB id. The Qdrant publish (`f/sync/copy/vector_data`) follows the
  changed `updated_at` within 48 h.

### Audit of the 45 suspicious matches, 2026-09-27

`research/tvtropes-repair/audit-2026-09-27` ([review](research/tvtropes-repair/audit-2026-09-27/review.md)): 30
requests from the dev machine at 6 s, all HTTP 200, no 403, 429 or challenge. Many stored pages have become
disambiguation pages (Film/TheHangover, Film/Taken, Film/EvilDead, Film/PlanetOfTheApes, Main/IronMan, Film/Godzilla).

| Outcome | Titles |
|---|---:|
| Correct, kept | 6 |
| Wrong, replaced with the right page | 17 |
| Wrong, tropes and URL removed | 22 |

Mongo documents were backed up to `_backup_20260927_tvtropes_123` (39 documents) before the writes
(`import-rollback.json`, `remove-rollback.json`). A manual `f/sync/copy/tvtropes` run and a scoped delete of 6,363
stale `trope` rows left Crate matching Mongo for all 36 titles that have Crate rows. `queue-followup.json` lists
8 right pages that were seen as links but not fetched within the budget: Hangover Part II and III, Taken 2, the three
Austin Powers films, Planet of the Apes (1968) and Cube.

Follow-up the same day (`run-followup`, `run-followup-accept`): 8 requests, all HTTP 200, no block. All 8 pages were
the right films (Cube through a reviewed accept: Film/Cube1997, TMDB dates the 1998 release) and were imported into
the emptied documents, then synced to Crate. The Qdrant publish had not yet picked up the audit's changes, so a
targeted `f/sync/copy/vector_data` run (`movie_ids`, `show_ids`) published all 36 audit titles that have a point;
their payload tropes now match Mongo.

### Live batch, 2026-09-26

`research/tvtropes-repair/run-2026-09-26`, from the dev machine, 30-request budget at 6 s, strict rule only (the
known-URL rule came after this batch):

| | |
|---|---:|
| Requests | 30, all HTTP 200, in 174 s. No 403, 429 or challenge. |
| Titles | 32: 4 recovered (Tatort 104 tropes, Legends of Tomorrow 285, Will & Grace 201, Poirot 252 over 3 subpages), 27 rejected, 1 without a release year |
| Rejected without a request | 5 (`Main/`, `WebVideo/`, `Wrestling/` URLs) |

The strict rule rejected 22 titles after fetching their pages. Re-checked offline from the saved pages, the known-URL rule accepts 13 of them:
Law & Order, The Office (US), Miraculous, 24, 9-1-1, Salatut elämät, 30 Rock, Agents of S.H.I.E.L.D., Rizzoli & Isles,
2 Broke Girls, Caméra Café, Everybody Loves Raymond and The Avengers (2012). It still rejects SVU and Strange New
Worlds, whose intros have no year, and The Chosen, which the wiki dates 2017 and TMDB dates 2019. Those 13 URLs are
open again for the next run, because their rejections were made under the old rules. The 4 recovered rows were
reviewed (title, year, Wikidata IMDb and TMDB ids) and imported on 2026-09-26 (`run-2026-09-26/import-rollback.json`).

### Full batch, 2026-09-26

`research/tvtropes-repair/run-2026-09-26b` over `queue-2026-09-26b.json` (the queue re-exported after the 4 imports:
845 titles), 1,300-request budget at 6 s, both identity rules:

| | |
|---|---:|
| Requests | 779 in 78 min: 769 HTTP 200, 10 HTTP 404. No 403, 429 or challenge; the run finished the queue. |
| Recovered | 418 (271 movies, 147 shows); 13 of them are the titles re-opened from the first batch |
| Rejected | 350: 276 by identity after fetching, 74 by namespace or 404 without a new request |
| Other | 53 without a usable URL, 12 without a release year, 9 not found, 3 identified without tropes |

Review: every recovered row was checked offline against its saved page (page title, catalog title and year, intro)
and against Wikidata (`P6839` to IMDb `P345` and TMDB ids). 146 rows match Wikidata's IMDb and TMDB ids and none
contradicts them; 101 come from the IMDb-keyed tvtropes2imdb mapping. All 186 `known_url` rows were read by hand;
no false match was found. Stub pages with 3–9 tropes (47) were kept: the pages are short, not mis-parsed.

Imported 415 (`run-2026-09-26b/import-rollback.json`; 79 stale stored URLs replaced). After a manual run of
`f/sync/copy/tvtropes`, all 419 titles imported on 2026-09-26 have their tropes in Mongo and in Crate
`movie/show.tropes`.

Three rows waited for the owner, who approved them the same day:

- The Illusionist (movie 1491, `Film/TheIllusionist2006`, 61 tropes) and House of Cards (show 1425,
  `Series/HouseOfCardsUS`, 228 tropes). Both pages match Wikidata. The importer's built-in deny list from #120 named
  these two titles because #120 had matched them to the wrong pages; it is removed, and `--deny` remains for one-off
  exclusions.
- Che: Part One (movie 8881) and Che: Part Two (movie 8880): `Film/Che` covers both parts, so both get its 14 tropes.
  Part Two has no known URL of its own (no Wikidata `P6839`, not in tvtropes2imdb), so `run-2026-09-26c` ran the
  runner for it against the page saved in `run-2026-09-26b` (candidate source `shared_page`), without a new request.
  The strict rule passed.

Imported with `run-2026-09-26b/import-manifest-owner.json` (418 entries; 415 skipped as already imported) and
`run-2026-09-26c/import-manifest.json`. Rollback files: `run-2026-09-26b/import-rollback-owner.json` and
`run-2026-09-26c/import-rollback.json`. A manual `f/sync/copy/tvtropes` run copied them to Crate. 17 titles have a few fewer `trope` rows than tropes, exactly the number of repeated
trope names, which collapse on the table's primary key (this also explains the ten short titles in #120).

Page bodies under `sources/` stay local.

## Tests

`goodwatch-flows/tests/test_tvtropes_crawl.py` covers parsing, identity and known URLs with saved pages in
`tests/fixtures/tvtropes`. `test_tvtropes_recover.py` covers the runner: pace, budget, blocks, negative cache, resume,
and a review table that the importer accepts. `test_tvtropes_fetch.py` covers the production fetch, and
`test_priority_publish.py` the flag.
