# Discover counts, deeper search, and reading details

The refreshed Discover page now counts and filters a frozen ranked candidate set, instead of only its first 100 results. Cards still load in pages of 40, including after result 100. The existing first 100 ranking positions are preserved when the longer tail is blended.

Search counts say **About N matches** and round larger numbers. This estimates the extent of a search from its retrieved candidates; it is not an extrapolated or exhaustive catalog count. The filter popout identifies candidate matches and explains the scope. Counts and recoveries cover the whole candidate set, not just the cards loaded. Candidate retrieval depths are unchanged; the retained set is bounded at 5,000. Basic-search fallback behavior is retained.

The search role stores title keys under an opaque token in shared Redis for one hour. The page role serves the same order through that token. The browser also retains the candidate keys: a cache outage or expired token can continue through POST without reranking or placing thousands of keys in a URL. Search text and personal taste are not written to this snapshot. Pagination errors pause automatic loading and offer Retry.

Any active status chip outside Ready to watch caps Ready and For you + Sort at the medium presentation. They can shrink further for space. The sizing measurement reruns when the search reading arrives or chip labels change.

The reading preview opens a portal outside the scrolling chip row. Hover and focus reveal it; tap or click pins it; Escape, close, or an outside press dismisses it. Every supplied interpretation gets one row in aligned chip, role, and definition columns, with the search phrase first. The popout grows to fit its contents and scrolls within narrow viewports. It has no close icon. Definitions come from the actual fingerprint and attribute metadata. The UI does not invent explanations for why a quality was inferred. The preview code loads with a search, and details load on intent.

## Local verification

- 117 relevant tests passed across ranking, combined-search streaming, snapshot storage, panel facets, guest/member filtering, transport, counts, and controls.
- Both the ordinary production build and the isolated local preview build succeeded.
- Repository-wide TypeScript checking remains blocked by the existing baseline diagnostics; these changes introduce no new diagnostics.
- A real `gru` search produced 1,022 candidates and displayed **About 1,000 matches**. Browser verification loaded 160 cards, preserved the initial prefix, and reported no page errors.
- Deleting only that search's snapshot in the isolated local Redis produced 410 responses followed by successful POST fallback; scrolling still reached 160 cards without reranking.
- Desktop (1440 × 1000) and touch/mobile (390 × 844) reading details worked, including all seven interpretations, Escape dismissal, and no horizontal page overflow.
- The local preview uses read-only proxies for catalog SQL and Qdrant. Background writers are disabled. Search accounting tables and Redis are isolated locally.

Screenshots are in `/home/alp/.cache/goodwatch/discover-depth-20261030/`. The running preview is `http://127.0.0.1:3172/discover?q=gru`.

## Discover performance budget

The existing refreshed page, before this change, already failed the old HTML, request, script, and total-byte limits. A clean HEAD build was measured with the same local production setup. Only those stale limits were recalibrated; timing, layout, image, font, and blocking-request limits were retained.

| Metric | Existing refreshed page, 1 run | Updated page, median of 3 |
| --- | ---: | ---: |
| Compressed HTML | 35.6 KiB | 35.6 KiB |
| Host requests | 54 | 52 |
| Scripts | 43 | 41 |
| Script bytes | 451.5 KiB | 450.0 KiB |
| Total bytes | 832.8 KiB | 831.4 KiB |
| LCP | 5,442 ms | 5,142 ms |
| TBT | 26 ms | 28 ms |
| CLS | 0.003 | 0.003 |
| Performance score | 71 | 72 |

`./bench.sh budget` passes all Discover checks. The run used a temporary budget file containing only the unchanged Discover entry from `urls/budget.json`, with the local preview as its target. Run evidence is in `goodwatch-benchmark/results/20261030T114730Z-lighthouse-discover-before` and `goodwatch-benchmark/results/20261030T115058Z-lighthouse-discover-depth-final`.


## MCP filter parity and release validation

The shared MCP schema now exposes Similar to, More like, Less like, people, production countries, streaming-country overrides, stable taste-group picks, and unrestricted episodes in addition to the existing filter groups. `get_discover_filters` describes every argument, supplies industry/region arguments and current member group keys, and includes fourteen validated use-case examples. All paths share the native filter model, URL codec and group resolver. A viewing-country override never changes saved settings or library marks.

Release checks: 210 focused unit tests passed; the isolated real SDK rehearsal passed 59 filter cases with Discover-engine parity, URL round trips, ranked cursor checks and poster resources. The ordinary production build and precompression passed. The repository-wide TypeScript diagnostic set is unchanged from the 178 baseline diagnostics. The compact tooltip's desktop/mobile checks and the Discover performance budget passed after the final UI revision.
