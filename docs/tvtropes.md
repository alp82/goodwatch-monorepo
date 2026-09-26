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
- TV Tropes' robots.txt disallows `Claude*` and other AI agents. Agents never read TV Tropes pages with their own
  web tools; only the runner below fetches pages, under its own user agent.

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

The importer only fills documents that have no tropes, so refreshing the 10,660 titles that already have (mostly
2025) tropes isn't possible yet. The research estimates about 16,600 requests for all known URLs in the top 10k: about
28 h at 6 s, or 9 h at 2 s.

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

Imported 415 (`run-2026-09-26b/import-rollback.json`; 79 stale stored URLs replaced). Kept out for the owner:

- The Illusionist (movie 1491) and House of Cards (show 1425): the pages are now the right ones
  (`Film/TheIllusionist2006`, `Series/HouseOfCardsUS`, both matching Wikidata), but the importer's built-in deny
  list from #120 blocks them.
- Che: Part One (movie 8881): `Film/Che` covers both parts of the film.

After a manual run of `f/sync/copy/tvtropes`, all 419 titles imported on 2026-09-26 have their tropes in Mongo and
in Crate `movie/show.tropes`. 17 titles have a few fewer `trope` rows than tropes, exactly the number of repeated
trope names, which collapse on the table's primary key (this also explains the ten short titles in #120).

Page bodies under `sources/` stay local.

## Tests

`goodwatch-flows/tests/test_tvtropes_crawl.py` covers parsing, identity and known URLs with saved pages in
`tests/fixtures/tvtropes`. `test_tvtropes_recover.py` covers the runner: pace, budget, blocks, negative cache, resume,
and a review table that the importer accepts. `test_tvtropes_fetch.py` covers the production fetch, and
`test_priority_publish.py` the flag.
