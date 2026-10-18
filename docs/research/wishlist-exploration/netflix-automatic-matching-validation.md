# Automatic Netflix wishlist matching: measured feasibility

Investigated 2026-10-18 against checkout `a3954d76`, the authorized local 77-entry Netflix wishlist export, its earlier saved page, and read-only GoodWatch catalog queries. Private titles, native IDs, account data and query results are omitted. No library changes or external metadata requests containing the user's titles were made. This is research, not a deployed matcher.

## Result

**75 of 77 source entries have a candidate corroborated by the exact Netflix ID in an existing GoodWatch streaming link.** All 75 distinct proposed targets exist in the local movie/show catalog, and none is marked adult. Two entries lack this corroboration in the tested retrieval lanes.

These are candidate proposals, not 75 independently verified correct matches. Candidate-scoped retrieval cannot establish catalog-wide uniqueness. A provider-link error, stale association, scope mismatch, or unqueried conflicting mapping can still exist. No member acceptance or production import was performed.

| Experiment | Observed result | Interpretation |
| --- | --- | --- |
| Current indexed title/original-title search, top ten per media type | 27 entries have one normalized exact-name candidate, 29 have several, 21 have none; all have some search results | Ranking alone is insufficient. The bounds do not establish global uniqueness. |
| Exact canonical Netflix URL equality in availability | 0/77 hits | Literal URL equality misses stored wrappers and other representations. |
| Parse Netflix IDs from offers for title-retrieved candidates | 59/77 have one corroborated target within the retrieved set | Existing streaming links supply useful identity evidence. Seven of these lack an exact canonical/original-name match. |
| Exact translation/alternative-title retrieval for the remaining 18, then offer-ID corroboration | 16 additional entries have one corroborated target | Localized names are essential. Ten entries had one distinct alias target, seven several, one none before ID corroboration. |
| Combined candidate-target validation | 75 source IDs, 75 distinct targets, 75 existing catalog rows, zero adult rows | Proposed identities can use the existing resolver's canonical validation. |
| Saved-page metadata compared with corroborated proposals | 24/24 agree on movie/show type and release year | Additional corroboration for this subset only; 53 exported entries lack metadata in the saved cache. |

No tested retrieval batch reached its configured row limit. Zero candidate-set ID conflicts were observed; this is not a global collision audit. Name normalization used NFKC/case/punctuation folding for the initial experiment and can merge distinct names. Alias retrieval instead used indexed phrase matching plus case-insensitive whole-name equality. Neither is an identity guarantee.

## Reproducible bounds

The experiment used the existing indexed catalog predicates and schema, not broad substring scans. See [backend inspection](automatic-matching-backend.md) for exact source references and reuse boundaries.

- Initial retrieval: 154 SELECTs, ten results per type per input, about 7.6 seconds sequential wall time in this run.
- Direct URL experiment: eight SELECTs, ten input IDs per batch, maximum 3,000 offer rows per batch; zero returned.
- Candidate offer lookup: 35 SELECTs, at most 40 typed catalog IDs per batch, maximum 5,000 offer rows per batch. Returned 9,346 rows; 9,265 parsed as strict Netflix detail URLs directly or through one JustWatch `r` wrapper. About 11.4 seconds in this run.
- Remaining-entry alias experiment: two indexed alias lanes per remaining input, maximum 101 rows per lane, then candidate-scoped offers capped at 5,000. About four seconds in this run.
- Final catalog validation: batched typed ID equality queries for the 75 proposed targets.

URLs were parsed locally, never fetched or followed. The experiment recognizes HTTPS `www.netflix.com/title/{positive-id}` with optional trailing slash, directly or through one `https://click.justwatch.com/a` wrapper with exactly one `r` parameter. Production parsing must retain the stricter hostile-input, wrapper, length, credential, port and scope checks documented in the [crosswalk investigation](netflix-identity-crosswalk.md). Uploaded IDs are evidence, never SQL or URLs to request.

The sequential measurements are feasibility observations, not service latency targets or a benchmark. A production implementation needs batched offer reuse, bounded concurrency, cancellation, per-lane overflow detection, real timeouts and incomplete-result states. It must not issue this experiment's complete query sequence for every page render.

Scratch scripts in `/home/alp/dev/projects/goodwatch/wishlist-browser-validation/`:

- `measure-netflix-candidates.mjs`
- `measure-netflix-direct-crosswalk.mjs`
- `measure-netflix-candidate-crosswalk.mjs`
- `measure-netflix-aliases.mjs`
- `validate-netflix-proposals.mjs`

Private outputs are mode 0600 and stay outside the repository. Aggregate outputs contain counts/timings only. Scripts use configured connection variables without printing credentials. No raw export or saved HTML belongs in fixtures or published research.

## Recommended next implementation

1. Add a bounded suggestion reader over owned import previews. Retrieve typed candidates from canonical/original names and indexed translations/alternative titles, then corroborate Netflix IDs against candidate offer links. Keep failure, truncation, ambiguity and no-result states distinct.
2. Keep suggestions separate from accepted resolutions and immutable source evidence. An unknown source type remains unknown even after resolution; only the effective catalog target gains a validated movie/show type. Do not fabricate source metadata. A sole ID-backed candidate is initially a reviewable suggestion, not an authoritative automatic resolution.
3. Use the existing member-choice resolver to accept suggestions in bulk and generate a child preview. Preserve existing explicit choices, deduplication, Seen/rewatch behavior, confirmation, receipt and Undo. The current 100-choice limit accommodates this 77-entry list.
4. Apply Opus's [review design](automatic-matching-ux.md), with the observed 75 proposals and two exceptions as evidence rather than a promised population-wide rate. Every proposed title remains inspectable and changeable.
5. Validate collision cases, aliases, remakes, missing metadata, malformed links, partial backend failures and target disappearance through the public preview/resolution/confirm/Undo seams. Independently review real proposed matches before measuring precision or enabling stronger automatic treatment.

A persistent normalized provider-ID map is a later improvement for recall and cost. It must retain all conflicting typed targets, record provenance/last observation, distinguish source identity from current availability, and not erase identity simply because an offer disappears. A global conflict audit is necessary before treating an ID-backed result as authoritative.

The already exported file is sufficient for the measured proposal route: the user does not need to export again. [Extension metadata enrichment](netflix-matching-metadata.md) can improve future evidence, but later-page metadata access is not yet validated and is not a prerequisite here. [External resolver research](netflix-identity-crosswalk.md) explains why TMDB find-by-ID and Simkl should not be assumed to provide a drop-in Netflix resolver. TMDB does document searching original, translated and alternative names, which supports a future bounded external fallback if needed; it was not used with this private sample. [TMDB finding-data documentation](https://developer.themoviedb.org/docs/finding-data).
