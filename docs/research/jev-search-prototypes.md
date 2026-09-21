# Jev discovery-search prototypes: preserved findings

Recorded 2026-09-20 for [Preserve the search prototypes and record the findings](https://github.com/alp82/goodwatch-monorepo/issues/101), part of [Free-text and title search with Jev, deployed in production](https://github.com/alp82/goodwatch-monorepo/issues/100).

## Preserved assets and evidence limits

Branch: `prototype/jev-discovery-search`. Base: `030e680` on `prototype/connected-exploration`.

The four files are preserved byte for byte, with checksums in [snapshot.json](jev-search/snapshot.json):

- [Fit comparison page](../../goodwatch-webapp/app/routes/prototype.jev-search.tsx), at `/prototype/jev-search`.
- [Fit comparison server](../../goodwatch-webapp/app/server/prototype-jev-search.server.ts).
- [Vector and text comparison page](../../goodwatch-webapp/app/routes/prototype.jev-vector.tsx), at `/prototype/jev-vector`.
- [Vector and text comparison server](../../goodwatch-webapp/app/server/prototype-jev-vector.server.ts).

[Historical reports](jev-search/historical-reports.json) preserve 14 relevant reports from the original local session, including their message identifiers, tables, example results, and limitations. They are historical assistant reports of experiments, not raw API answers or independently reproduced measurements. No experiment was rerun for this preservation task. The reports include proposed variations as well as implemented ones; a proposal does not establish user approval or a test result.

The snapshot is the final code, not every intermediate revision. Some variants are hidden, some earlier implementations were replaced, and only two D4+ variants are visible by default. The historical reports preserve the missing comparison history. In particular, historical C and D names were reused: **C ideal profile** differs from **C1/C2 kinds of title**, and **D groups first** differs from **D1–D5 text evidence**.

Historical costs use the code's rate of $0.042 per million input tokens and `jev-latest`. This is a record of the experiments, not a current pricing assertion. Early strategy costs omit the shared attribute reading; later whole-search totals include it. Do not compare the two as if they measured the same scope. The final page runs readings and variants sequentially for comparison and computes a hypothetical parallel total; those totals are not production endpoint latency measurements. A separate benchmark did actually run the two Jev calls in parallel.

## Starting point: per-title fit judgments

The first page reads a request, retrieves fingerprint and trope candidates, and has Jev judge request text against each title's supplied evidence. Jev does not supply world knowledge about titles. The evidence must contain the relevant fact.

For `unreliable narrator`, 36 candidates and a 14,278-token interpretation:

| Fit variant | Fit requests | Fit tokens | Whole search $/1,000 | Fit time |
| --- | ---: | ---: | ---: | ---: |
| No tropes | 36 | 37,291 | 2.17 | 1.2 s |
| Baseline with tropes | 36 | 44,844 | 2.48 | 0.9 s |
| No per-trope questions | 36 | 41,440 | 2.34 | 0.9 s |
| Lean title state | 36 | 35,569 | 2.09 | 0.8 s |
| Short fit levels | 36 | 42,684 | 2.39 | 0.9 s |
| Trope names only | 36 | 37,854 | 2.19 | 0.8 s |
| Batch eight titles | 5 | 33,136 | 1.99 | 0.5 s |
| All cuts | 5 | 21,701 | 1.51 | 0.3 s |

The top six of each trope variant stayed in the baseline top ten on this single request. That does not establish general quality. A short interpretation saved tokens (9,066 versus 14,278), but replaced `meta_narrative` with `pop_culture` on this request. Later work eliminated fit calls from the baseline rather than optimizing them further.

## Original request-to-vector approaches A–E

All shared a separate attribute reading: 2,944 tokens, reported 270–730 ms. A/B/D/E initially retrieved 300 candidates, then ranked by weighted sum. Figures below are for the strategy reading alone, from `tense but not bleak`.

| Approach | Reading and retrieval | Tokens | $/1,000 | Jev time | Outcome |
| --- | --- | ---: | ---: | ---: | --- |
| A: wanted level | 74 five-level Score questions; up to eight strongest deviations from neutral | 11,604 | 0.49 | 943 ms | Focused, relatively stable; mood requests still surface game shows |
| B: want and avoid | 148 yes/no questions; weights from probability differences | 7,028 | 0.30 | 657 ms | Faster and cheaper; too many weak avoids |
| C: ideal profile | 74 ten-level Score questions; full profile, cosine order | 18,560 | 0.78 | 1,232 ms | Obscure results; cannot represent avoidance as negative weights |
| D: groups first | Five group questions, then A only for selected groups | 3,931–5,925 | 0.17–0.25 | 690–1,047 ms | Misses dimensions; two round trips erase latency benefit |
| E: pick three | Primary, secondary, avoided Choice questions | 4,973 | 0.21 | 297 ms | Too little information; avoided ambiguity for `unreliable narrator`, returning PAW Patrol |

A subsequent comparison ran 12 requests twice, with 2,000 candidates, linear weights, and tropes off:

| Approach | Repeated top-20 overlap | Overlap with A | Dimensions / negative dimensions | Mean Jev time |
| --- | ---: | ---: | --- | ---: |
| A | 19.1 | — | 7.5 / 3.6 | 995 ms |
| B | 17.7 | 12.4 | 13.2 / 9.1 | 545 ms |
| C | 18.4 | 1.5 | 8.7 / 0 | 1,240 ms |
| D | 19.2 | 17.9 | 7.1 / 3.3 | 1,044 ms |
| E | 19.7 | 4.8 | 2.3 / 0.9 | 362 ms |

This measures stability and agreement, not correctness. D skipped useful groups on four requests; E overlapped A on zero titles for four requests. B's weak negative weights motivated asymmetric thresholds. The final B2 keeps weights >= 0.6 or <= -1.2; earlier B2 used +0.8/-1.5. Its weight is `2 * (want - avoid)`.

## Kinds of title: the replacement C1/C2

Cluster roughly 20,000 popular titles into 48 kinds; describe each kind by genres and distinctive qualities; ask Jev 48 fit questions. Use a weighted profile of the best kinds for retrieval. C1 retains cosine order; C2 retrieves 2,000 titles and applies A2's strong weights within the pool.

- C2 returned Parasite, Swept Away, BEEF, and SKY Castle for `dark comedy about rich people`, while A/B returned generic satire.
- C2 returned The Night Manager and The Taking of Pelham for `tense but not bleak`, removing the game shows by changing the candidate pool.
- C1 chose plausible kinds but obscure titles: useful pool selection, weak ranking.
- Kinds reading: 15,705 tokens, $0.66/1,000, about 590–1,200 ms. C2 plus A: 27,309 tokens, $1.15/1,000, excluding shared attributes. A proposed B pairing was estimated, not tested in that report.
- Genre bonuses changed results but had no clear quality advantage; they favored mecha anime on a science-fiction battle request.

The cosine problem is independently visible in `scifi sunglasses`: The Matrix had weighted sum 49.4 but cosine rank 1,094, outside a 300-title pool. Blade Runner ranked 914; The Matrix Revolutions ranked 1,653. Cosine normalizes by the full vector length; a sparse preference vector can therefore retrieve a different pool from the weighted sum the code ultimately wants. Expanding to 2,000 is a workaround. A raw-score dot-product vector remains a map decision, not part of this snapshot.

## Why text evidence changed the direction

For `super tense high octane car chases`, Jev correctly found intensity dimensions, but no fingerprint dimension expresses **car**. Hand-to-hand action beat car films. Existing `essence_text` and `essence_tags` already contained facts such as Bullitt's iconic car chase and Ronin's legendary car chases.

Coverage reported during that diagnosis:

- About 126,000 titles with essence text, versus about 72,000 with tropes (approximate counts at that time).
- In the reference car-chase list, `Car Chase` appeared on 4 of 36 titles; 10 of 36 had no tropes.
- 18 of 33 checked titles had a car/chase keyword, spread across `chase`, `police chase`, `high-speed chase`, `car race`, `street race`, and `getaway driver`. Only one popular movie had the exact keyword `car chase`.
- A tag filter found 47 popular car-chase movies in 0.7 s. Weight ranking returned Baby Driver, Lost Bullet, Bullitt, Ronin, and others; six of the top 20 overlapped the reference list. The reference list was not an exhaustive correctness oracle.

Whole-request trope matching also matched unwanted words and generic names (for example `super` matched Super-Soldier rather than car chases). Negation stripping, concrete-word selection, and name/phrase evidence were investigated to reduce this noise.

## Text approaches D1–D5

| Variant | Candidate selection | Ranking and result |
| --- | --- | --- |
| D1 | Whole positive request, any-word search over essence and synopsis | Text score; car request starts with 2 Fast 2 Furious, Knight Rider, Gone in Sixty Seconds |
| D2 | Same search, up to 300 titles per media type | B2 plus normalized text score; Death Race, Fast X, Fast Five, Baby Driver |
| D3 | Jev marks concrete words; require every word, with singular/plural variants | B2 plus text; all top results on the car request were car films |
| D4 | One Choice picks from code-generated words and adjacent pairs; try fallback phrases if too few matches | Strong results for car chases, cozy mystery, and clever dialogue |
| D5 | Ask which words an ideal description would mention; required and optional terms | Direction-aware but broader; My Dinner with Andre for dialogue, slower common-word search |

The car-chase comparison reported:

| Variant | Reference-list overlap / 20 | Reading $/1,000, excluding attributes | Jev time | Database time |
| --- | ---: | ---: | ---: | ---: |
| A1 | 3 | 0.49 | 1,016 ms | 330 ms |
| B2 | 3 | 0.30 | 346 ms | 276 ms |
| C2 | 4 | 1.15 | 1,016 ms | 296 ms |
| D1 | 5 | 0 | 0 ms | 2,395 ms |
| D2 | 2 | 0.30 | 346 ms | 1,743 ms |
| D3 | 6 | 0.30 | 346 ms | 354 ms |

D3 found The Usual Suspects and Fight Club for `unreliable narrator`. It failed on synonyms (`rich` versus `wealthy`, `elite`, `upper class`) and misleading literal matches (`rich visuals`). Mood-only requests fell back to B2, retaining game shows.

D4 selected `cozy mystery` and returned Miss Marple, Aurora Teagarden Mysteries, and Midsomer Murders. For `clever dialogue, little action`, code removed the avoided `little action` clause from text retrieval while Jev still saw it for negative weights. Longer phrase candidates were abandoned because Jev picked long combinations that matched almost nothing. The final candidates are words and adjacent pairs, not arbitrary generated text.

## D4 family and the selected baseline

| Layer | Observed outcome | Additional Jev cost |
| --- | --- | --- |
| D4b: second phrase at >=15% | Searches both; multiple-facet evidence affects rank. Rich-people pool grew from 710 to 859; quality not clearly better | None |
| D4f: mood gate | Single non-concrete winning word skips text search; B2 game-show problem remains | None |
| D4d: wider evidence | Below 20 text matches, searches concrete words in keywords and trope names | None |
| D4c: tag feedback | Generic frequent tags; none accepted in two of five requests, wrong `Sherlock Holmes` match for dialogue | About $0.11/1,000 |
| D4j: judge top 30 | Mixed: improved rich-people list, little car-chase gain, weak Mentalist dialogue result | Four parallel fit requests; about $0.49/1,000 and 300–350 ms |
| D4+ | Two phrases + mood gate + wider evidence | None beyond interpretation |

Wider evidence added eight keyword titles and 129 trope-name titles for `scifi sunglasses`, returning They Live, Doctor Who, Men in Black, Gintama, and Austin Powers. It took about 1.1 s in that run. Exact keyword lookup replaced an 8.8 s substring scan.

The wider-evidence trigger still misses a facet when another phrase already finds 20 titles: `vampire sunglasses` found plenty for `vampire` and did not find Blade through sunglasses evidence. Doctor Who appeared as three separate catalog entries. These are unresolved quality/hygiene questions.

D4a (both phrases mandatory), D4e (new combined evidence document), and D4g (kinds fallback) were proposed; the reports do not establish completed comparisons for them. Feedback and judge code remains available inside the final module, but neither is enabled in the visible baseline variants.

## Wording, speed, and whole-search cost

A standalone Jev benchmark reported:

| Experiment | Tokens | Median time |
| --- | ---: | ---: |
| Original attribute request | 7,137 | 733 ms |
| Lean attributes, remove questions unused by D4+ | 3,939 | 358 ms |
| Full B2 wording | 7,031 | 532 ms |
| Lean attributes + B2, actually parallel | 10,970 | 646 ms |
| Merged request | 10,697 | 1,017 ms |

Two medium requests in parallel beat one merged request. Moving repeated B2 instructions into the state saved about 37% of B2 tokens. This changed interpretation: full wording agreed with its repeat on 95% of used dimensions; short versus full agreed on 75%. Omitting descriptions or moving them all into a glossary fell to 60–64% agreement and was not faster.

Eight-request means, including attributes (parallel totals modeled by the comparison page):

| Snapshot | Tokens/search | $/1,000 | Parallel total |
| --- | ---: | ---: | ---: |
| Full B2 wording | 10,453 | 0.44 | 965 ms |
| Short B2 wording | 7,836 | 0.33 | 850 ms |
| Final short B2, full attributes | 7,967 | 0.33 | 704 ms |
| Final short B2, short attributes | 6,635 | 0.28 | 643 ms |

Full versus short B2 shared 16.8/20 titles on average; mood-only shared only 11/20. Final full versus short **attributes** returned the same 20 titles on seven of eight requests. The exception dropped a required Adults filter on a gritty-crime request; the report preferred the resulting list, but this is not an agreed evaluation-set verdict.

The dedicated attribute test had 14 requests / 308 decisions: 99.4% repeat agreement versus 97.7% short/full agreement; 2,945 versus 1,568 tokens, 305 versus 302 ms median. Savings were about $0.06/1,000 with no clear latency gain. Seven decisions changed versus two on a normal repeat. Movie requirements sometimes appeared or disappeared near the 60% threshold. Both variants remain visible for human review.

Other measured findings:

- Fetching whole fingerprint objects to overlap retrieval with interpretation cost 370 versus 177 ms for car chases and 2,028 versus 1,150 ms for a common word. Short B2 was already finishing before attributes, leaving only 20–50 ms overlap to gain. An IDs-first alternative added 193 ms. Not adopted.
- Display query: 398 ms with essence and whole fingerprint, 177 ms without fingerprint, 44 ms for title/year/poster/genres/tags only. The lean display fetch was applied; used dimension values come from the pool. End-to-end rerun means remained noisy (943/923 ms versus earlier 965/850 ms).
- Redis reading-cache probe: 25 ms read, 23 ms write. Cache-hit Jev cost would be zero; 0.3–0.5 s total was an estimate based on database time, not a shipped cache result. Cache hit rate is unknown. Reading-cache implementation remains a production architecture decision.
- Network round-trip observations varied from 85 to 24 ms. These small development-machine samples establish neither a production percentile target nor an SLA.

## Later research supersedes early explanations

Consult the resolution tickets for authoritative detail; this document preserves their implications for the prototype rather than duplicating their full results.

- [Crate evidence column: analyzers, indexes, and rollout facts](https://github.com/alp82/goodwatch-monorepo/issues/103): the slow common-word query was incorrectly blamed on `match`. `fingerprint_scores IS NOT NULL` checked 74 child columns. Replacing it with `essence_text IS NOT NULL` measured 76 ms versus 460–1,120 ms, while `match` itself took 11–15 ms. The snapshot retains the old query. A synonym filter does exist; earlier claims of not finding one are obsolete. Separate indexed columns, analyzers, and rollout remain future work.
- [TV Tropes coverage gaps for well-known titles](https://github.com/alp82/goodwatch-monorepo/issues/110): missing tropes affect 56.8% of movies and 47.7% of shows with >=20,000 votes, and 12.1% / 15.0% at >=200,000. Crawls ran; all 30 sampled famous titles had pages. URL/disambiguation/parser bugs explain the sample. The Matrix franchise-level Cool Shades entry is not collected as a film trope. The trope table has no exact primary-key duplicates; earlier apparent duplicates must not be treated as established duplicate rows. Media-type joins and repeated arrays need separate care.
- [Language independence: requests that aren't in English](https://github.com/alp82/goodwatch-monorepo/issues/106): native-language Jev readings mostly hold up; English candidate generation and evidence retrieval do not. Translation is a follow-up prototype, absent from this snapshot.
- [TypeSafe in production: limits, failures, and data handling](https://github.com/alp82/goodwatch-monorepo/issues/112): production must decide timeout/retry/fallback policy and pin a model version. The preserved prototype still uses `jev-latest`.

## Using the snapshot

Use this branch in an isolated checkout with the webapp's normal dependencies and configured Crate/Qdrant access. Supply `TYPESAFE_API_KEY` in the environment; the unchanged prototype also has an author-specific fallback path. No credential file is included. The pages perform paid Jev calls on searches; the fit comparison runs many variants per request.

This is single-user experimental code: shared mutable options, sequential comparison orchestration, hidden variants, unbounded request latency, and no production reading cache. It ignores the eventual country/provider integration. It is evidence for the map, not a deployable combined search. Earlier reports of typechecks and runs belong to the original session. Preservation validation checks byte identity, artifact contents, and Git isolation only; no UI behavior changed and no new model/database tests were run.

The next map decisions already cover evaluation requests, combined title/description interaction, literal matching, mood-only results, result hygiene, evidence-column prototyping, and production architecture. Preservation introduces no additional decision ticket.
