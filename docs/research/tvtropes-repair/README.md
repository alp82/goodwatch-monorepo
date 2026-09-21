# Bounded TV Tropes repair: implementation and blocked recovery

Work for [Implement the TV Tropes crawler repairs](https://github.com/alp82/goodwatch-monorepo/issues/118), following the approved [crawler repair scope](https://github.com/alp82/goodwatch-monorepo/issues/115#issuecomment-5752057530). Captured on 2026-09-20 around 20:00 UTC.

## Outcome

**Implementation ticket closed at the user’s request:** local code and regression validation are complete. Remaining review/integration and all live rollout work belong to the follow-up linked below. Source and evidence are now archived on the follow-up branch; they remain undeployed.

**Scope split, requested by the user on 2026-09-20:** the implementation ticket covers crawler code, regression validation, and recovery tooling. Review/integration remains in the follow-up. Live recovery, confirmation of suspicious matches, deployment/publication, and search validation moved to [Resume TV Tropes live recovery and audit after crawler implementation](https://github.com/alp82/goodwatch-monorepo/issues/120). The Cloudflare challenge does not block code completion. The follow-up archives the reviewed source and evidence; no production integration or deployment completion is claimed.

A user-requested retry at 20:31:46 UTC again received HTTP 403 with a Cloudflare managed challenge on its first request, recovered no titles, and made no production writes. The runner's `rate_limited` label combines 403 and 429; it does not establish that this challenge was triggered by rate limiting. The appended result and source response are preserved in the run directory; its summary now describes the latest attempt.

The local crawler repair is implemented and passes 15 focused Chromium fixture tests. The initial live recovery **did not complete**: TV Tropes returned a Cloudflare HTTP 403 and the runner stopped immediately. There were **zero production writes, zero recovered titles, and zero confirmed replacements**. The live-recovery follow-up remains open; no expansion decision is supported by this blocked attempt.

| Evidence | Result |
| --- | --- |
| Current movies with at least 200,000 votes | 1,371; 166 without tropes |
| Current shows with at least 200,000 votes | 131; 20 without tropes |
| Frozen initial recovery manifest | 186 identities, separately keyed by media type and TMDB ID |
| Existing Mongo tropes for that missing cohort | 0 |
| Processed entries in the bounded attempt | 2 |
| Recovered / unresolved / failed | 0 / 1 / 1 |
| Unattempted after the stop | 184 |
| Network requests in that attempt | 1 |
| Recorded run wall time | 0.343 seconds |
| Separate initial browser smoke probe | 1 request, also HTTP 403 |
| Targeted existing matches flagged for review | 45; none confirmed wrong by this run |

The first processed entry, show `284742` (宫崎骏电影合集), had no usable Latin URL candidate and needed no HTTP request. The second, movie `1412450` (Stranger Things), hit the block. These are catalog identities exactly as stored; the snapshot does not silently merge them with similarly named shows or relax the vote threshold. After this attempt, the resolver was improved to skip missing release years without making any request. There was **no further network attempt in that initial implementation pass**; subsequent retries are recorded above and in the follow-up below. The preserved run describes the code at the time of that initial attempt, not a complete execution of the final patch.

## Repair behavior

- TV Tropes-specific slug generation preserves acronyms and existing camel case, transliterates decomposable accents, replaces ampersands/plus signs, spells leading numbers, and generates subtitle/prefix alternatives. Shared application slug rules are unchanged. Initialization uses raw and selected US alternative titles; crawling also regenerates candidates from existing raw titles so lossy stored slugs are not the only input.
- Year-suffixed candidates are attempted for every dated title. HTTP 200 alone is never accepted. `Main`/`Franchise` and opposite-media namespaces cannot supply work evidence.
- Disambiguation and inexact-title pages supply candidate links. Candidates still need matching title text, an exact first release year, and the expected media type in the opening dated description. A guessed nearby year is not evidence. Shared animation namespaces use the description's media type; successful namespace resolution returns immediately.
- Shared film-series/two-part film descriptions are rejected as individual-title evidence. This intentionally leaves some short-title candidates unresolved rather than copying combined work traits.
- Subpage links are discovered outside heading/folder lists. Headingless subpage lists work; only `Main` trope links are extracted. Absolute URLs are handled correctly. Subpages must belong to the same work's recognized page namespace; unrelated/franchise subpages are excluded.
- HTTP 403/429 on any required page returns no partial trope list. Other failed, redirected, or empty required subpages raise a failure. Page resources close on every path, and crawler exceptions release the queue selection and preserve existing source data.
- Candidate and subpage budgets prevent runaway navigation. Successful persistence clears an older failure timestamp.

The resolver is deliberately conservative. It does not handle every alias or every introduction style. Exact first-year matching can miss works whose introductions first describe a different year, including some near-year release differences. The current cohort has 16 records without release years and 2 without generated slug candidates (these sets may overlap). Those require reviewed metadata/source evidence, not looser work matching. Live extraction fidelity remains unverified from this connection because the site blocks it.

## Artifacts and targeted audit

- [cohort.json](cohort.json): fixed 186-title recovery input, vote counts, before source URLs/counts, and regenerated candidates.
- [cohort-summary.json](cohort-summary.json): read-only Crate/Mongo counts.
- [suspicious-existing.json](suspicious-existing.json): 45 existing identities flagged within the same high-vote catalog only. Reasons overlap: 30 share a source URL with another catalog identity, 13 use `Main`/`Franchise`, and 4 have a URL year different from the catalog year. Numbers that belong to a title, such as Blade Runner 2049, are not treated as release-year suffixes.
- [run summary](run-2026-09-20/summary.json), [per-entry results](run-2026-09-20/results.jsonl), and the gzip response under `run-2026-09-20/sources/`: requested/final URL, HTTP status, source hash, and exact block response.

Examples to inspect when source access is available include the three Godfather films sharing one URL, the Hangover sequels sharing the first film's URL, and The Mummy pointing to a franchise page. These are **suspicions**, not confirmed replacement instructions. No existing trope data was cleared or replaced.

## Reproduce and resume

Run commands from the repository root. The temporary environment used for this work is `/tmp/goodwatch-tvtropes-repair-venv`; it includes Playwright 1.62.0 and its Chromium binary, MongoEngine, Pydantic, Windmill, Requests, and python-dotenv. Windmill dependency pins were not changed.

```bash
/tmp/goodwatch-tvtropes-repair-venv/bin/python -m unittest discover \
  -s goodwatch-flows/tests -p test_tvtropes_fetch.py

# A fresh read-only snapshot requires a NEW output directory.
/tmp/goodwatch-tvtropes-repair-venv/bin/python \
  goodwatch-flows/scripts/export_tvtropes_cohort.py /tmp/tvtropes-fresh-snapshot

# Resume only after ordinary authorized source access is working again.
/tmp/goodwatch-tvtropes-repair-venv/bin/python \
  goodwatch-flows/scripts/recover_tvtropes.py \
  docs/research/tvtropes-repair/cohort.json \
  docs/research/tvtropes-repair/run-2026-09-20
```

The export uses SELECT queries and Mongo aggregation reads only. The recovery runner does not initialize any database. It verifies the manifest hash before resuming; preserves earlier results; captures source HTML/status/URL evidence; records code hashes on future runs; permits at most 250 high-vote identities and 1,500 navigation attempts per run; waits at least four seconds between requests; and globally stops on HTTP 403/429 or a transport failure. No challenge bypass or retry storm is implemented.

## Completion and production run plan

1. Resume the local evidence-only recovery when normal TV Tropes access is restored. Review successful title/year/media attribution and completeness before staging any database changes. Resolve unknown-year/alias cases only with independent work evidence.
2. Review the 45 suspicious existing matches. Snapshot complete Mongo source documents, Crate media trope arrays/timestamps, and matching `trope` rows for **only confirmed mismatches** before replacements. Keep every identity keyed by both media type and TMDB ID.
3. Build a reviewed manifest containing the exact successful/confirmed identities, old/new source URLs, source hashes, trope additions/removals, and rollback snapshots. There is currently no publishable delta: recovered and confirmed replacement counts are both zero.
4. Obtain the standing production Crate-write/deployment go-ahead from the [search map](https://github.com/alp82/goodwatch-monorepo/issues/100) for that concrete delta. Then deploy only the changed helper/init/fetch scripts and apply the bounded accepted changes. Avoid the unfiltered initializer or the sync script's empty-ID defaults, which process broad collections. The existing sync only upserts trope rows; confirmed wrong-page replacements also need exact media-type/ID-scoped stale-row removal, verified against the before snapshot. Do not claim that a source update alone removes obsolete Crate evidence.
5. Hold D4+ (corrected) fixed and rerun relevant saved requests before/after publication, recording coverage, result differences, latency/cost, and separately labeled agent assessments. There is no measured search improvement in this attempt; the production evidence is unchanged and no after-recovery comparison is available.
6. Report completed/unresolved/failed counts and measured crawl cost before resolving this task or making the subsequent expansion decision. Keep franchise inheritance, broad cleanup, combined evidence columns, and ranking changes outside this patch.

Checks completed: 15 Chromium fixture tests, Python compilation, and `git diff --check`. No deployment was performed.


## Live-recovery follow-up: source still blocks normal access

Reviewed and archived the crawler/init/helper changes, evidence-only export and recovery tools, frozen 186-identity manifest, fixed 45-identity suspicious-match audit, and original response evidence. The archive is a review branch, not a deployment. Source scope and remaining limitations are as described above; local fixtures do not establish live extraction completeness or work attribution.

The normal-access resume at **2026-09-20 23:34:30 UTC** (2026-09-21 01:34:30 Berlin) requested `Film/StrangerThings2016` with a **one-request budget** and four-second minimum request spacing. It immediately received **HTTP 403, Cloudflare managed challenge, “Just a moment...”**. The response body hash is `3c1e842ebe267f99f2fb09fe5cc4ce3f6e283a8e0dc29abe4443e7b9fb919ce4`. This is denied source access; rate limiting is not established. The runner stopped without a bypass or another request. Wall time: **0.387 seconds**. Source retrieval cost was one navigation; no paid model calls or database writes occurred.

The latest cumulative identity status is **0 recovered, 1 unresolved, 1 failed due to access denial, 184 unattempted**. The existing audit still contains **45 suspicions and zero confirmed mismatches**. Frozen cohort hash remains `42ddd2b3075848ad184fa958efbb60c2007929197776bb71961044a6dd352d2b`. Repeated attempts on the same identity do not count as additional attempted identities.

The runner now distinguishes `source_access_blocked` (403) from `rate_limited` (429), records request budget and spacing, and appends future per-attempt summaries to [attempts.jsonl](run-2026-09-20/attempts.jsonl). The previous summary was preserved byte-for-byte as [summary-before-attempt-history.json](run-2026-09-20/summary-before-attempt-history.json). Older result records retain their original labels and hashes. They must be interpreted using their HTTP evidence, not rewritten as new findings.

Validation: **18 focused tests pass**, including real Chromium fixture extraction, failed-subpage cleanup preserving existing source data and queue release, 403/429 reporting, and rejecting a changed manifest before networking or result mutation. Python compilation and whitespace checks pass. Existing naive UTC timestamp deprecation warnings remain; they do not fail the tests.

### Exact release preparation and blocker

The source delta comprises `title_variations.py` with its Windmill metadata/empty dependency lock, `tvtropes_init_tags/main.py`, and `tv_tropes_crawl_tags/fetch.py`; their existing dependency pins remain unchanged. Local-only export/recovery tools and tests are archived alongside the evidence. The prior versions of the two modified scripts are recoverable from archive parent commit `0603be2`; the helper is new. The repository automatically deploys Windmill changes pushed to `main`, so this archive must stay on its review branch until deployment is authorized.

There is **no accepted data delta to publish and no production rollback snapshot to pretend is ready**. Complete source documents and exact Crate rows must be captured for each genuinely recovered/confirmed replacement identity when that delta exists, before the standing production go-ahead. The existing completion plan specifies stale trope removal and rollback boundaries. No deployment, broad initializer run, production writes, relevance improvement claim, or expansion is part of this attempt.

**Required human/external action:** restore ordinary authorized TV Tropes access for the crawler environment, or provide an authorized environment where the unchanged bounded runner can access the source normally. Do not send credentials or challenge tokens in an issue comment. Then resume against the same manifest and run directory using the documented command. Another same-environment retry without a change in access conditions is not useful. The follow-up ticket remains open and the expansion decision remains blocked.
