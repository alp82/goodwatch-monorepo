# Search evaluation baseline — throwaway, human review pending

Question: can a repeatable artifact make the accepted D4+ baseline reviewable, and what quality floor should each request require?

Open `review.html` directly. It contains all 30 requests, the top 10 results, evidence where the module returns it, catalog metadata, known violations, timings, and pending relevance judgments. Grade each result strong / acceptable / wrong, then decide each request's minimum strong-or-acceptable count. Export before closing; nothing persists automatically. Import restores judgments for the same capture. Exported reviews belong to the user only when the user actually supplies those judgments.

The fixtures are proposed, not yet approved in full. No user judgments or quality floors have been invented. There are 289 reviewable result slots: the misspelled lookup has no results and Spirited Away returns nine. Exact requested title identity is checked first; semantic exclusions still require review. Four correctly spelled title requests found the intended title first.

## Capture

From the repository root, with the existing development server at localhost:3003:

```sh
python docs/prototypes/search-evaluation/run.py
python docs/prototypes/search-evaluation/enrich.py
python docs/prototypes/search-evaluation/run.py --render-only
```

Capture overwrites baseline.json and review.html; preserve a previous capture first. `run.py --previous path/to/previous-review.json` also records changed ordering, new result IDs, previous judgments and previous floors per request. These comparison fields are in baseline.json; comparisons do not automatically accept old judgments for changed intent or fixtures. There is no aggregate pass claim. The raw JSON retains all returned results beyond the displayed top ten.

The title path is the existing combined-search prototype's TMDB multi-search. The description path is its `runCombinedDescription`, D4+ corrected with routing disabled. Results are **separate paths**, not browser rank fusion or the future production search. Metadata enrichment uses the existing search-journey prototype's read-only endpoint. No production database writes.

## Measured findings

- All 30 requests completed without endpoint errors. “Incepton” returned zero results, a title failure.
- Eight description requests contain a result below the 2,000-vote floor: tense but not bleak; with my parents; cozy; bleak; funny; something short to watch after work; the long German request; the short German request. These remain failures, not weakened fixtures.
- Median description HTTP time: 1,402 ms. Reported Jev estimate for 25 descriptions: $0.008563758. The preliminary single-request probe cost is additional. Costs exclude infrastructure and TMDB; timing includes local development overhead, excludes browser debounce/rendering, and is one sample per request, not a latency percentile benchmark.
- Existing stored classification reconfirmed for Between Walls, movie 132381: adult=true, zero votes. This does **not** identify the earlier user-reported adult example, which remains unresolved.
- Model alias is `jev-latest`, not pinned. Catalog and external title results are live. Source hashes, fixture hash, revision, request strings and raw responses are preserved, but these facts prevent exact replay guarantees. The development checkout is dirty; exact invoked source snapshots are under `source/`.

## Hygiene acceptance still pending

| Acceptance case | Current evidence / remaining review |
| --- | --- |
| Default discovery vote floor | Read-only metadata shows violations in eight requests |
| Title search below discovery floor | Endpoint has no vote restriction; low-vote candidates are visible; final blending still unverified |
| No-minimum discovery option | Not exercised by this fixed-default endpoint; needs integrated-path coverage |
| Adult default and opt-in | Title endpoint hardcodes adult=false; description baseline has no explicit adult predicate. Final opt-in behavior remains unverified |
| Missing adult classification | No synthetic fixture injected into live catalog; unknown classification remains an acceptance case |
| Duplicate identities versus remakes | Metadata records IMDb identities; full merged-source collapse and distinct-work cases remain unverified |
| Previously reported adult example | Exact identity still needed; known flagged title is not assumed to be it |

The baseline should expose these gaps before follow-up comparisons. It does not resolve production acceptance or imply that result hygiene is implemented.

## Verification

Opened the standalone review in Chromium: 30 requests and 289 judgment controls rendered, judgment/floor export and import round-tripped, no JavaScript errors, and no horizontal overflow at 390px. Temporary verification judgments were discarded and are not part of the artifact.
