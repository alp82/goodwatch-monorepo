# Arena log

## Round 1 (2026-09-23): breadth

11 rankers, 1,581 dev pairs graded (A/B quadratic weighted kappa 0.898, 19 pairs
settled by assessor C).

| ranker | ndcg10 | good10 | bad5 | anchor10 |
|---|---|---|---|---|
| hyb-lin+prior | 0.746 | 7.59 | 16 | 0.333 |
| hyb-lin | 0.723 | 7.81 | 10 | 0.190 |
| hyb-rrf | 0.674 | 6.97 | 29 | 0.171 |
| prod | 0.628 | 6.65 | 30 | 0.190 |
| nojev-knn | 0.501 | 5.70 | 40 | 0.029 |
| pure embeddings | 0.44-0.48 | | 49-62 | |

Learned:
- Hybrid (embedding + fingerprint weighted sum + text evidence) is the core.
- Jev stays: dropping it loses 0.12-0.25.
- The popularity prior helps anchors and ndcg but adds grade-0 titles.

Failure patterns in the leader:
1. Typos read as mood ("Incepton" returns mind-bending shows above Inception).
2. Negations flip ("comedy without romance" → The Shining #1).
3. Multi-facet queries lose a facet ("slow burn space horror" → earth horror).
4. Lexical title-word leaks ("Funny Princes").
5. Mood queries skew toward what's popular.

## Round 2 plan

- Negation: strip negated clauses before embedding, penalize similarity to the
  negated text.
- Facets: embed Jev's concrete phrases separately, reward covering all of them.
- Prior: gate by relevance (multiplicative or only among the top candidates).
- Title leakage: title blend only for near-full title matches, plus fuzzy
  catalog title matching for typos.
- Latency: a variant without the Crate text pool (embedding only for lexical).
- Model: bge-base without title in the text.

## Round 2 (2026-09-23): fixes on hyb-lin+prior

10 rankers, each hyb-lin+prior with one change, plus combinations. Swept on dev with a proxy (graded titles
only, see `round2/sweeps.md`), then 292 new dev pairs graded (A/B quadratic weighted kappa 0.894, 5 pairs
settled by assessor C). Adding grades raised the ideal DCG, so round-1 numbers dropped by about 0.04
(hyb-lin+prior 0.746 → 0.700). Compare within this table only.

| ranker | ndcg10 | good10 | bad5 | anchor10 | est. p50 after reading |
|---|---|---|---|---|---|
| r2-combo-bgeb-strict | 0.783 | 8.05 | 8 | 0.347 | 156 ms |
| r2-combo-bgeb | 0.759 | 7.89 | 7 | 0.302 | 156 ms |
| r2-combo-strict | 0.752 | 7.84 | 13 | 0.338 | 156 ms |
| r2-combo | 0.734 | 7.81 | 11 | 0.313 | 156 ms |
| title-strict | 0.728 | 7.62 | 17 | 0.357 | 156 ms |
| neg | 0.722 | 7.84 | 12 | 0.323 | 154 ms |
| bgeb-notitle | 0.708 | 7.54 | 11 | 0.298 | 154 ms |
| facet | 0.704 | 7.65 | 14 | 0.323 | 154 ms |
| prior-gated | 0.703 | 7.86 | 13 | 0.190 | 154 ms |
| hyb-lin+prior (r1) | 0.700 | 7.59 | 16 | 0.333 | 154 ms |
| notext | 0.671 | 7.11 | 25 | 0.264 | 27 ms |
| prod | 0.585 | 6.65 | 30 | 0.190 | 235 ms |

Leader `r2-combo-bgeb-strict` is hyb-lin+prior (a 0.4, b 0.42, c 0.18, prior 0.1/0.1) with these changes:
bge-base no-title embeddings (me5s still used for non-English), negation lambda 0.1, facets 0.1 from Jev
phrases, and the title-strict blend (similarity ≥ 0.9, fuzzy 0.88).

What each change did:
- neg (+0.022, bad5 16 → 12): the embedding uses the positive part, and a penalty applies to the negated
  clause. "comedy without romance" no longer puts The Shining at #1. Lambda above 0.2 hurts: the penalty
  pushes out titles that are merely near the topic ("tense but not bleak" drops thrillers). The explicit
  avoid-dimension penalty didn't help, because Jev's weights already carry the avoided dimensions.
- facet (+0.004): noise. Jev's phrases often overlap ("fantasy dragons" and "dragons"). Splitting the query
  into chunks wasn't better.
- prior-gated (+0.003, bad5 −3): the gain is small and anchor10 falls back to hyb-lin's level. The additive
  prior stays.
- title-strict (+0.028): drops title-word leaks ("Funny Princes", "Warm and Cozy", "Time Loop" clones) and
  fixes "Incepton" (Inception moves from #7 to #1). The fuzzy match takes about 2-3 ms and runs only for
  short queries with a word that isn't in the catalog vocabulary. It hurt "tarkovsky" and "sunglasses",
  where titles that contain the word were good hits. The proxy misjudged it (0.69), because it skips
  ungraded titles.
- bgeb-notitle (+0.008 alone, +0.025 in the combination, lowest bad5): a stronger embedding helps once the
  other fixes are in place. It costs about 7 ms more query-embedding CPU than e5-small.
- notext (−0.029, bad5 25): dropping the Crate pool cuts the added latency from about 154 to about 27 ms,
  but it's the only change that loses to the baseline. Possible later, as a fast first page.

Guardrails: 4/4 dev title lookups at #1, and Incepton → Inception at #1. The holdout title check wasn't used
for any choice. "hunter x hunter" is still #2 in every ranker. Two exact titles tie there, a blend
tie-break issue carried over from round 1.

Failure patterns left in the leader:
1. Subject words that are also title words: without the title bonus, "sunglasses" (−0.13 vs prod) and
   "tarkovsky" lose their documentary and title hits. A title-word bonus is still needed when the query
   is a concrete noun.
2. Genre-remix and family queries lose against hyb-lin+prior: "like The Matrix but anime" −0.22, "dessin
   animé … famille" −0.19. bge-base drifts from the anime or animation facet, and non-English queries still
   route to me5s.
3. Unresolved typo "craty" (−0.39 vs prod): nothing is at 0.88 similarity, and production's mood guess was
   better.
4. Era constraints: "80s sci-fi action" puts Star Trek Into Darkness (2013) at #3. There's no year signal.
5. Graded 0 near the top: Texhnolyze (space horror), Jack Frost (groundhog day), Shutter Island ("don't
   finish miserable").

## Round 3 plan

- Title bonus by query kind: keep strict matching for mood and adjective queries, and allow a
  title-word bonus when Jev marks the word concrete (`concreteWords.isConcrete`) or the query names a creator.
- Era and year parsing ("80s", "90s", "recent") as a soft year prior, or a filter when the query states it.
- Non-English: embed Jev's English phrases with bge-base too, alongside me5s on the native text.
- Typos: a vocabulary spell-correct before the embedding (for "craty" and "psycological thriler"), not
  only a title match.
- Weights: re-sweep a/b/c with bge-base (the round-1 weights were tuned for e5).
- Latency option: notext plus the round-2 fixes, to see how much of the text pool's value they recover.
- Then pick 2-3 finalists for the holdout grading.

## Round 3 (2026-09-23): round-3 plan, local sparse index

10 rankers: r2-combo-bgeb-strict with one change each, plus two combinations. Swept on dev with the proxy
(`round3/sweeps.md`), then 129 new dev pairs graded (A/B quadratic weighted kappa 0.874, no pair apart by 2 or
more, so assessor C wasn't needed). Round-2 numbers moved by about 0.005 with the new grades (the leader went from
0.783 to 0.777).

| ranker | ndcg10 | good10 | bad5 | anchor10 | est. p50 after reading |
|---|---|---|---|---|---|
| r3-combo | 0.830 | 8.54 | 4 | 0.371 | 156 ms |
| r3-combo-fast | 0.828 | 8.54 | 5 | 0.361 | 52 ms |
| sparse | 0.804 | 8.30 | 6 | 0.363 | 46 ms |
| sparse-fast | 0.804 | 8.30 | 6 | 0.363 | 51 ms |
| notext-r2 | 0.789 | 8.16 | 9 | 0.351 | 46 ms |
| spell | 0.787 | 8.08 | 8 | 0.347 | 156 ms |
| nonen | 0.785 | 8.11 | 8 | 0.356 | 156 ms |
| era | 0.781 | 8.11 | 7 | 0.354 | 156 ms |
| title-kind | 0.780 | 8.19 | 8 | 0.329 | 156 ms |
| reweight | 0.777 | 8.16 | 9 | 0.327 | 156 ms |
| r2-combo-bgeb-strict (r2) | 0.777 | 8.05 | 8 | 0.347 | 156 ms |
| prod | 0.583 | 6.65 | 30 | 0.190 | 235 ms |

Configs (changes to r2-combo-bgeb-strict; `harness/run3.py` FINAL, `rankers3.py`, `blend3.py`, `sparse.py`):
- `r3-combo`: era filter, spell, nonen (mix 0.5), title-kind (cap 0.65), text = Crate and sparse (mean of the two
  z-scores), a 0.4 / b 0.48 / c 0.12.
- `r3-combo-fast`: the same without Crate: text = sparse only, and every signal truncated to what one Qdrant batch
  request returns (dense top 500, facet and negation top 200, sparse top 300; a title outside a list gets that list's
  floor).
- `sparse` / `sparse-fast`: text = sparse, a 0.4 / b 0.48 / c 0.12; exact scores vs truncated lists.

What each idea did:
- sparse (+0.027, bad5 8 → 6): a local BM25F index over title, essence tags, keywords, trope names, essence text,
  directors or show creators, and top-5 cast (stemmed unigrams plus bigrams, k1 1.2, b 0.75) replaces the Crate
  text pool and beats it. The biggest gains are on queries where production's mood gate or the Crate phrase search
  returned nothing: "funny", "cozy", "nonlinear storytelling", "grubby crime show", "tarkovsky". The losses are small
  (at most −0.10, "slow burn space horror"). Both together (Crate and sparse) are only +0.002 over sparse alone in
  the combination.
- sparse-fast: the Qdrant-shaped truncation changes no top 10 (identical lists). Tighter lists (dense 200, sparse
  100) cost about 0.01 on the proxy.
- Creator queries: `tarkovsky` now lists Nostalgia, Solaris, Stalker, Mirror, Andrei Rublev, and The Sacrifice
  under the four "Tarkovsky" documentaries (sparse 0.728, prod 0.377). The combination's title-kind rule brings two
  more documentaries back in at #9 and #10 (0.641).
- spell (+0.010): "craty" → "crazy" before the embedding and the sparse query. Edit distance 1 (2 for words of 8+
  letters) against about 8k words with document frequency ≥ 20, most frequent wins, about 0.2 ms per unknown word.
  It skips non-English text. "Incepton" stays with the fuzzy title match.
- nonen (+0.008): non-English queries (production's flag, or 2+ fr/de/es function words; the second catches the
  French "dessin animé" query, which production reads as English) also embed Jev's English chips with bge-base.
  me5s and bge-base are mixed 50/50 after z-scoring. new-21 went from 0.25 to 0.75. Avoid chips join the negation
  penalty.
- era (+0.004): "80s sci-fi action" filters to 1980–1989 (Star Trek Into Darkness is gone, 0.84 → 0.95). The soft
  prior gave the same result. Only one dev query has an era.
- title-kind (+0.003): the title-word bonus returns when a matched word is Jev-concrete or the query names a
  creator, capped at lexical 0.65. "sunglasses" gets its title hits back, at #6 to #8. Without the cap, bad5 drops
  to 6, but the bonus pushes aside better discovery hits.
- reweight (±0): with bge-base the round-1 weights are close to the best; a 0.5 / c 0.12 wins only on the proxy.
  Inside the sparse combination, c 0.12 beats 0.18.
- notext-r2 (+0.012 over the leader, 46 ms): with the round-2 fixes, dropping Crate no longer loses. The round-2
  `notext` was −0.029.

Latency and storage (app-server estimates, `round3/metrics.md`):
- r3-combo-fast is query embedding (bge-base 15 ms, extra texts batched +10 ms) + one Qdrant batch request (about
  20 ms, ids and scores only) + fingerprint scan (4 ms) + fuzzy title and spell (3 ms) ≈ 52 ms after the reading,
  against production's ≈ 235 ms. Nothing calls Crate, and there's no LLM call and no added cost.
- A new Qdrant collection with a dense `bge-base-notitle` vector (768d) and a sparse `bm25f` vector
  (`modifier: idf`; document values are the saturated BM25F term weights, so IDF stays current):
  - dense float32: 3 KB per point. 50k eligible ≈ 155 MB, all 191k ≈ 590 MB (int8 quantization: 39 / 147 MB in
    RAM).
  - sparse: 214 non-zeros per eligible title (10.7M, 57% unigrams). About 86 MB raw, or about 170 MB with the
    inverted index, for 50k. All 191k (about 100 terms per ineligible title) ≈ 26M non-zeros, about 420 MB with the
    index. Unigrams only cut that by about 40%.
  - people: directors or show creators for 47.8k of the 50.3k eligible titles and cast for 49.2k
    (`data/people.jsonl.gz`, from Crate `person_worked_on` / `person_appeared_in` / `person`). Shows rarely have a
    `Creator` credit, so they use the top Executive Producer or Writer by episode count.

Failure patterns left in r3-combo:
1. Grade 0 in the top 5: Texhnolyze (space horror), Blue Velvet (sunglasses at night), Stranger Things (Incepton
   #4), Sin City (sunglasses).
2. Losses against prod are small: "tense heist thriller, not bleak" −0.06, "craty" −0.04, the German puzzle
   query −0.03.
3. The fast variant loses "sunglasses" (−0.14): without Crate's keyword pool the sunglasses documentaries stay
   out.

## Finalists

Take these to the holdout grading:
1. `r3-combo-fast` (dev 0.828, est. 52 ms after the reading, no Crate): the recommended ship candidate. It is
   within 0.002 of the best, drops production's slowest stage, and fits one Qdrant request.
2. `r3-combo` (dev 0.830, est. 156 ms): the best overall. It checks whether the Crate text pool still earns its
   ~100 ms on unseen queries.

Also possible as a third: `sparse-fast` (0.804, 51 ms), the smallest change (the leader with only Crate swapped
for the sparse vector). It isolates the value of the sparse index from spell, era, nonen and title-kind.

## Holdout (2026-09-23): finalists on the holdout split

Frozen round-3 configs, no code or config changed, no crash (`harness/holdout.py`; lists identical to the holdout entries
`run3.py final` wrote). 551 new holdout pairs graded (A/B quadratic weighted kappa 0.918, 4 pairs settled by a blind
assessor C), merged add-only into `grades.json`. Details: `holdout/metrics.md`.

| ranker | ndcg10 | good10 | bad5 | anchor10 | anchor50 | avoid5 | title@1 | est. p50 after reading | est. p95 whole search |
|---|---|---|---|---|---|---|---|---|---|
| r3-combo | 0.756 | 7.50 | 15 | 0.385 | 0.632 | 2 | 1/2 | 156 ms | ~0.95 s |
| r3-combo-fast | 0.735 | 7.42 | 17 | 0.365 | 0.623 | 2 | 1/2 | 52 ms | ~0.55 s |
| r2-combo-bgeb-strict (ref) | 0.733 | 7.12 | 20 | 0.285 | 0.537 | 2 | 1/2 | 156 ms | ~0.95 s |
| sparse-fast | 0.722 | 7.27 | 19 | 0.343 | 0.609 | 2 | 1/2 | 51 ms | ~0.55 s |
| prod | 0.461 | 4.54 | 40 | 0.124 | 0.209 | 0 | 1/2 | 235 ms | ~0.90 s |

Verdict: **no finalist wins under the contract.** Every finalist clears production by far more than 0.05, has a lower
bad5 and adds no cost, but every finalist loses more than 0.15 NDCG on at least two holdout queries, and production's
grades on those queries are correct, so the exception doesn't apply:
- new-01 "heist on a train" (−0.69 r3-combo, −0.89 both fast variants): generic heists (Money Heist twice, Fast Five,
  Baby Driver) replace production's train robberies. The r2 leader lost only 0.25, so the round-3 sparse text signal
  and the title-kind bonus for "heist" drop the train facet; Crate keeps two train robberies in r3-combo.
- new-08 "like Breaking Bad but a comedy" (−0.23 / −0.25): Breaking Bad itself at #1 (grade 0), likely the sparse
  title field matching the title bigram; the r2 leader didn't do this.
- core-18 "Brain's fried …" (−0.151 r3-combo, −0.22 fast): mostly 2s against production's 3s, no grade-0 titles.
Also: r3-combo-fast beats sparse-fast by only 0.013 (needs 0.02 across families). r3-combo − r3-combo-fast = 0.0207, just
over 0.02, so the Notes latency rule is not triggered. Guardrails: Spirited Away #1 everywhere; "hunter x hunter" #2
everywhere, production included.

What it means (not a contract outcome): the finalists are much better than production on average (+0.26 to +0.30), and
the holdout failures come from two specific round-3 regressions (sparse/title signals overriding a concrete facet and
returning the "like X" title itself), both visible in the grades.

## Round 4 (2026-09-23): fixes for the holdout failures, tuned on dev+

Tuned on dev+ (`dev` + `holdout`, per the contract Notes); `holdout2` was not read, run or scored. Code:
`harness/rankers4.py` (hyb4), `blend4.py`, `run4.py`, `grade4.py`. 122 new dev+ pairs graded (A/B quadratic weighted
kappa 0.866 and 1.0, no pair 2+ apart, no assessor C), merged add-only (2,553 → 2,675). Details: `round4/metrics.md`.

| ranker | dev+ ndcg10 | dev | holdout | bad5 | anchor10 | queries < prod − 0.15 | est. p50 after reading |
|---|---|---|---|---|---|---|---|
| r4-combo | 0.811 | 0.831 | 0.781 | 17 | 0.356 | none | 156 ms |
| r4-combo-fast | 0.796 | 0.821 | 0.761 | 15 | 0.347 | none | 57 ms |
| r3-combo (ref) | 0.793 | 0.830 | 0.740 | 19 | 0.377 | new-01 −0.63, new-08 −0.22 | 156 ms |
| r3-combo-fast (ref) | 0.783 | 0.828 | 0.720 | 22 | 0.363 | new-01 −0.81, new-08 −0.23, core-18 −0.21 | 52 ms |
| prod | 0.528 | 0.583 | 0.450 | 70 | 0.162 | – | 235 ms |

What each change did (ablations on the fast finalist, dev+):
- Reference titles (`ref`): "like X" / "similar to X" / "X but Y" markers, then the longest word span that equals an
  eligible catalog title with 10k+ votes. The reference and its same-stem franchise entries (stem of 2+ words or 6+
  letters, e.g. "El Camino: A Breaking Bad Movie", the Matrix sequels, not The Animatrix) are excluded. Dense =
  0.8 z(query) + 0.2 z(cos to the reference's own passage vector), plus 0.2 × min(z dense, z fingerprint) so a
  title has to match on both. Found in exactly the 3 like-X queries. like_x_but_y 0.625 → 0.699 (−ref: 0.660);
  new-08 0.477 → 0.673 (prod 0.708), new-07 0.547 → 0.649. lab-12 drops 0.85 → 0.78 because Groundhog Day itself
  (graded 3 despite the intent calling it "a reference hit, not a discovery") is excluded by design. A larger mix
  (0.35-0.5) or embedding only the modifier ("anime", "comedy") hurt: the modifier alone loses the crime or
  cyberpunk part, and Sherlock-like fingerprint matches take over.
- Body-only sparse (`sparse_body`): the BM25F query skips the title field, which put Breaking Bad at #1 and Money
  Heist at #1 for "heist on a train". Title matches still come from the title blend. Neutral on dev+ overall.
- Facet coverage (`cov` 0.3): units = content words of Jev's phrases (collocations such as "slow burn", "sci fi"
  merged; generic words, era tokens, negated and reference words dropped), 2-4 units, only for short queries (≤ 5
  content words) with a Jev-concrete unit. Per unit: z(dense cos to the unit) + 0.5 z(BM25 over tags, keywords,
  tropes, essence text); the score adds 0.3 × z(min over units). new-01 0.05 → 0.78 (−cov: 0.05); subject_object
  0.783 → 0.837. A head-relative penalty version failed (the train robberies aren't in the head before the term),
  and weights ≥ 0.4 hurt "slow burn space horror".
- Title-kind needs every concrete word (`kind_all`): "Money Heist" no longer gets the title-word bonus for "heist on
  a train"; "sunglasses" keeps its title hits. Small on its own.
- Sparse bigram weight 2 (`sparse_bigram`): core-18. Production's advantage there was not fingerprint weight: its 3s
  (Mister Roberts, The Grump, Starstruck) rank 600-1100 on our dense and fingerprint signals and come from the text
  evidence for the phrase "warm funny". Length- or mood-adaptive weights (fingerprint up to 0.6-0.7, or text up to
  0.2-0.3 for queries without a concrete word) lifted core-18 only to −0.15 and cost core-13 0.1-0.3, so they're
  off. Doubling the bigram weight makes phrase matches count: core-18 0.486 → 0.616 (prod 0.698), dev+ +0.00 for
  the fast variant, and −bigram1 brings back the core-18 loss (−0.21).

Per query vs prod: no query of either finalist loses more than 0.15. The closest are lab-04 "tense heist thriller,
not bleak" (−0.104 / −0.144; r3 was −0.06 / −0.02: the coverage term lifts "heist + thriller" titles that are
bleaker, −nocov gives 0.772 vs 0.657 for the fast variant), new-01 (−0.075 / −0.083: Robbery, The First Great Train Robbery, Red Sun, Money Train are back in
the top 10, but Money Heist and Inception still sit at #7-10) and core-18 (−0.077 / −0.082, all 2s and 3s). Against
r3 on dev, the fast finalist gives back about 0.007 (lab-05 −0.12, lab-04 −0.12, lab-12 −0.08, core-10 −0.07), for
+0.041 on holdout.

Latency: the r4 signals ride on what the fast variant already runs: one query-by-point dense list for the reference,
a dense and a sparse list per facet unit in the same Qdrant batch (≤ 4 units, short queries only), a fingerprint
cosine in the in-process scan, and the reference lookup in the fuzzy-title index. Estimated +5 ms: r4-combo-fast
≈ 57 ms after the reading, r4-combo unchanged at ≈ 156 ms (Crate-bound). No added cost. The sparse vector no longer
needs a title field.

## Round 4 finalists (frozen before holdout2)

`harness/run4.py` FINAL, `rankers4.DEFAULTS` + these overrides:
- `r4-combo`: r3-combo (`era, spell, nonen 0.5, text "both", a 0.4 / b 0.48 / c 0.12`, blend `kind, cap 0.65`) +
  `_R4` = `ref, ref_mix 0.2, ref_text "full", ref_agree 0.2, ref_sparse "body", sparse_body, cov 0.3, cov_k 300,
  cov_mode "z", cov_beta 0.5, cov_fields "body", sparse_bigram 2.0`, blend `kind_all`.
- `r4-combo-fast`: r3-combo-fast (`era, spell, nonen 0.5, text "sparse", a 0.4 / b 0.48 / c 0.12, trunc dense 500 /
  facet 200 / neg 200 / sparse 300`, blend `kind, cap 0.65`) + `_R4`, blend `kind_all`.
- `r3-combo`: unchanged (reference, round 3).
The two r4 finalists differ only in the Crate text pool (same family; the Notes latency rule applies between them).

## Latency design note (2026-09-23)

From `holdout/latency-live.md` (local Qdrant 1.19.1, 50k eligible titles):
`rankers3._floor` is a no-op (`np.minimum`), so offline rankers score every
candidate exactly. That is the chosen production design, not a bug to fix:
the service keeps eligible bge-base embeddings in memory (about 38 MB int8)
and scores the union of candidates exactly. The fingerprint weighted sum rides
in the same Qdrant batch as a 74-dim dot-product vector with `exact: true`.
The Qdrant formula query is too slow for this path (126-242 ms). Measured
14.9 ms p50 / 35.6 ms p95 locally after the reading; estimated 30-45 ms p50
and 75-100 ms p95 in production. Top-10 overlap with the offline lists:
9.4/10 with ONNX int8, 9.9/10 with fp32.

Holdout2 finalists (frozen in round 4): `r4-combo`, `r4-combo-fast`.

## Holdout 2 (2026-09-23): round-4 finalists on the unseen split

Frozen `run4.FINAL` configs, no code or config changed, no crash (`harness/holdout2.py`). 398 new holdout2 pairs graded
(A/B quadratic weighted kappa 0.902, 5 pairs settled by a blind assessor C), merged add-only into `grades.json`
(2,675 → 3,073). Details: `holdout2/metrics.md`.

| ranker | ndcg10 | good10 | bad5 | anchor10 | anchor50 | avoid5 | title@1 | queries < prod − 0.15 | est. p50 after reading | est. p95 whole search |
|---|---|---|---|---|---|---|---|---|---|---|
| r4-combo-fast | 0.729 | 5.71 | 17 | 0.369 | 0.635 | 2 | 1/1 | ho2-09 −0.44, ho2-21 −0.20, ho2-02 −0.16, ho2-05 −0.16 | 30-45 ms | ~0.54 s |
| r4-combo | 0.710 | 5.62 | 16 | 0.353 | 0.595 | 2 | 1/1 | ho2-09 −0.43, ho2-02 −0.17 | 156 ms | ~0.95 s |
| r3-combo (ref) | 0.709 | 5.62 | 18 | 0.365 | 0.595 | 2 | 1/1 | ho2-09 −0.43, ho2-04 −0.20 | 156 ms | ~0.95 s |
| r3-combo-fast (ref) | 0.703 | 5.67 | 20 | 0.377 | 0.663 | 2 | 1/1 | ho2-09 −0.44, ho2-04 −0.43, ho2-21 −0.20 | 30-45 ms | ~0.54 s |
| prod | 0.518 | 3.95 | 31 | 0.202 | 0.325 | 1 | 1/1 | – | 235 ms | ~0.90 s |

Verdict: **no finalist wins under the contract.** Both clear production by far more than 0.05 (+0.19 / +0.21), have
a lower bad5, add no cost and stay under 1 s p95. The two finalists are within 0.02 (0.019), so under the Notes rule
the lower-latency `r4-combo-fast` is the preferred one. It fails the per-query rule, and so does `r4-combo`.
Production's grades on the losing queries are correct, so the exception doesn't apply:
- ho2-09 "space opera without aliens" (all combos about −0.44): alien-heavy space operas fill the top 10 (all 0).
  Production's one good title, Scavengers (2), is the only 2+ in the pool, so a single hit decides the query. The
  negation of a concrete noun is still unsolved.
- ho2-02 "comedy set in a prison" (r4 −0.17, r3 +0.10) and ho2-05 "war film about snipers" (r4-fast −0.16): a
  round-4 regression from facet coverage. The generic units `set` and `war` lift workplace sitcoms and generic war
  films. The existing `r4-fast-nocov` ablation scores 0.705 and 0.805 on them.
- ho2-21 "dystopain deth game series" (fast −0.20): "deth" isn't corrected, and without Crate Squid Game drops to #5
  under video-game adaptations.
Round 4 did fix ho2-04 "western with samurai" (r3 −0.20 / −0.43 → +0.06). Guardrail: The Expanse #1 everywhere.

## Round 5 (2026-09-23): cast, crew and studio matching

Tuned on `dev` (12 new `ppl-*` queries plus the earlier dev queries); `holdout` and `holdout2` used only as
regression checks. The `holdout3` split was not read, run or scored. Code: `harness/entities.py` (detection and
intent), `harness/rankers5.py` (hyb5), `harness/run5.py`. 341 new pairs graded (A/B quadratic weighted kappa 0.900
on 340, 1 more pair in agreement, no pair 2+ apart, so no assessor C), merged add-only (3,073 → 3,414). From this
round on, packets carry a `credits` field (contract note). Details: `round5/metrics-dev.md`.

| ranker | ppl-dev (12) | dev (all) | dev (pre-round-5) | holdout | holdout2 | bad5 ppl-dev | good10 ppl-dev |
|---|---|---|---|---|---|---|---|
| r5 | 0.864 | 0.833 | 0.823 | 0.761 | 0.734 | 3 | 8.50 |
| r4-combo-fast | 0.643 | 0.777 | 0.820 | 0.761 | 0.722 | 10 | 6.08 |
| prod | 0.277 | 0.508 | 0.582 | 0.450 | 0.515 | 13 | 2.58 |

Detection (`entities.detect`, local, p50 0.02 ms / p95 0.15 ms after warm-up):
- Persons: full and original names of kept people (titles ≥ 2; shared names go to the highest votes_sum), surnames
  when one person dominates the surname (lead score = votes over main-role titles, director / creator 2x; ≥ 500k and
  ≥ 3x the next person), sibling teams ("coen brothers", "wachowskis"), style suffixes (-esque, -like, -ian), fuzzy
  full names (rapidfuzz ratio ≥ 90) and surnames (edit distance 1, 7+ letters), only for short queries with a word
  outside the catalog vocabulary.
- Studios: companies and networks grouped by alias (suffixes stripped, "studio ghibli" → "ghibli", "hbo max" → "hbo"),
  ≥ 8 eligible titles.
- Guards: a single word must not be a common word (lowercase in ≥ 20 essence texts, any case in ≥ 250, or a title
  word in ≥ 15 titles, the last not for studios); a single-word studio alias that is also a word ("marvel") needs a
  big group and a film word next to it ("marvel movies"); non-English queries only match multi-word full names.
- Result on every non-holdout3 query: all 12 ppl dev queries detected with the intended entity; 3 earlier queries
  are legitimate person queries (lab-01 "tarkovsky", ho2-15 "terry gilliam", ho2-16 "jackie chan movies"); **zero
  false detections** on the other 88. Fixed on the way: "lighthouse keeper" (Lighthouse Pictures), "Des gens" (Xavier
  Gens), "Krieg" (Jim Krieg), "snipers" (fuzzy Wesley Snipes), "British" (British Screen), German "das".
- Intent: style markers (vibes, style, atmosphere, humor, like X, -esque, ...) → style; film words, other content words,
  "early"/"late", or a studio → filmography; a bare person name → both (6 credited titles first, then style).

What changed on dev (sweeps: `run5.py sweep`, all rankers identical to r4-combo-fast on non-entity queries):
- Filmography boost 4.0 × credit weight beats 2.5 (+0.009) and 1.5 (−0.05): the credited titles have to lead.
  Cast weights are flat for the first four billed (Snatch and Burn After Reading bill Brad Pitt 4th-5th).
- Style: at most 4 own titles in the top 10 (+0.013 over 3), own-title boost 0.3, centroid of 20 top titles.
- Both: head of 6 own titles (+0.016 over 4; 8 gives the same ndcg with more unjudged).
- Centroid fingerprint (0.3) matters: without it −0.03 (and 12 unjudged).
- People fields in BM25: removing them for entity queries changes nothing, so they stay (one sparse vector, no
  second index).
- "less X" as a fingerprint direction (`less_fp`) did not help (−0.01); the "less weird" clause only joins the
  negation penalty (0.3).
- Losses vs r4-combo-fast: ppl-15 "miyazaki-like" −0.23, ppl-09 "tarantino vibes" −0.20, ppl-20 "edgar wright"
  −0.10. The graders give his own films 3, so r4's lists of only his films score higher; the cap is the user's
  decision (a mix of own titles and similar titles by others), so it stays. ppl-11 "like david lynch but less weird"
  stays weak (0.44): the centroid is Lynch's surreal films, which the intent rates 0.

Latency and cost: no paid calls. Detection < 0.2 ms; the credited titles come from an in-memory person / studio →
titles map; the centroid is one more dense list in the Qdrant batch (query by vector, top 500) and one more
fingerprint cosine in the in-process scan. Estimated +3-6 ms p50 on entity queries only (≈ 0.1 ms on others);
r5 ≈ 35-50 ms after the reading, p95 of the whole search unchanged at ~0.55 s. Offline, the entity path is faster
than hyb4 (21 vs 40 ms median) because it skips facet coverage.

### r5 config (frozen before holdout3)

`run5.FINAL["r5"]` = r4-combo-fast (`run4.FINAL["r4-combo-fast"]`, blend unchanged) + `rankers5.DEFAULTS5`:
`ent True, fil_boost 4.0, sty_boost 0.3, sty_cap 4, head_style 6, head_actor 6, mix_style 0.7, mix_fil 0.3,
cen_k 20, cen_fp 0.3, cen_fp_fil 0.0, ent_sparse_people True, early_frac 0.4, era_off 0.35, ent_facet True,
cen_top 500, sty_prior 1.0, less_neg 0.3, less_fp 0.0`; entities.py constants `SURNAME_VOTES 500k,
SURNAME_DOMINANCE 3, STUDIO_MIN_TITLES 8, COMMON_LOWER_DF 20, COMMON_TITLE_DF 15, COMMON_ANY_DF 250,
RARE_LOWER_DF 2, FUZZY_NAME_CUTOFF 90, FUZZY_MAX_WORDS 5`. On entity queries the blend's title-word bonus (`kind`)
is off. No code or config changes after this point.

## Holdout 3 (2026-09-23): frozen r5 on the person and studio split

Frozen `run5.FINAL["r5"]`, no code or config changed after the freeze (`run5.py holdout3`, `holdout3-metrics`).
Detection on the 12 holdout3 queries: all 12 found the intended entity (incl. the typo "leonardo dicapro" by fuzzy
match, "coen brothers" as a team, "kubrick-esque" by surname plus suffix, A24 and HBO by studio alias). 271 new pairs
graded (A/B quadratic weighted kappa 0.854, 2 pairs 2+ apart settled by a blind assessor C: Forrest Gump for "tom hanks
war movies" 1, Quay for "christopher nolan" 2), merged add-only (3,414 → 3,685). Details: `round5/metrics.md`.

| ranker | holdout3 ndcg10 | good10 | bad5 | dev (all) | holdout | holdout2 |
|---|---|---|---|---|---|---|
| r5 | 0.831 | 7.42 | 3 | 0.833 | 0.761 | 0.734 |
| r4-combo-fast | 0.724 | 6.92 | 2 | 0.777 | 0.761 | 0.722 |
| prod | 0.388 | 4.25 | 10 | 0.508 | 0.450 | 0.515 |

Verdict: **r5 does not win under the contract.** It beats r4-combo-fast by +0.107 on holdout3 (needs +0.05) and
doesn't drop on any earlier split (dev +0.056, dev without the ppl queries +0.003, holdout ±0, holdout2 +0.012), but
its bad5 is 3 against 2. All three grade-0 top-5 titles come from style queries whose centroid pulls in popular
neighbours: "kubrick-esque" puts Apocalypse Now at #1 and Apocalypse Now Redux at #4 (neighbours of Full Metal Jacket
and 2001 in the centroid), and "tom hanks war movies" has Charlie Wilson's War at #5 (a Hanks film the graders don't
count as war). r4-combo-fast's two are The Matrix (#3, kubrick-esque) and Captain Phillips (#5).

Per query: filmography queries gain a lot (a24 horror +0.65, tom hanks war movies +0.32, keanu reeves action +0.29,
hbo prestige drama +0.29, leonardo dicapro thrillers +0.27); "both" is about even (christopher nolan +0.02, jim carrey
−0.02); style queries lose (guy ritchie −0.27, kubrick-esque −0.22, wes anderson style −0.04, coen brothers humor
±0). The same pattern showed on dev (tarantino vibes −0.20, miyazaki-like −0.23): the style centroid's non-own
neighbours are often generic popular titles (Pulp Fiction, Kill Bill, Sherlock for Guy Ritchie), while r4's text match
on the name already returns the person's own films, which the graders rate 3.

What it means (not a contract outcome): r5's filmography and studio path is a clear win (+0.29 mean on the six
holdout3 filmography queries); the style path is the weak part. A next round could keep the filmography / both path and
rethink style (e.g. drop the prior on style queries, pick neighbours that share tags or keywords with the centroid
titles rather than cosine to their mean, and let own titles fill the gaps).

## Round 6 (2026-09-23): style neighbours and alternate cuts

Tuned on the `dev` style / both queries (ppl-09, 11, 13, 15, 17, 20), with every earlier split (dev, holdout,
holdout2, holdout3) as a regression check. `holdout4` (sty-*) was not read, run or scored. Code: `harness/cuts.py`,
`harness/rankers6.py` (hyb6), `harness/run6.py`, `harness/grade6.py`, `harness/regrade_effect.py`; metrics in
`harness/metrics.py` (`graded_query6`, `own10`). Details: `round6/metrics-dev.md`.

Grading (contract note, round 6):
- `GRADER.md` has a "Style queries (round 6)" section. Packets of `person_intent` style / both queries carry
  `"rubric": "style"`.
- Re-grade: the 290 existing pairs of the dev and holdout3 style / both queries (ppl-09 to ppl-18, ppl-20, ppl-24)
  were graded again under the new rubric by two sonnet assessors (quadratic weighted kappa 0.901). One pair was 2+
  apart and went to a blind assessor C (The Man Who Wasn't There for "coen brothers humor": 2). The re-grade
  replaced those grades. 77 of 290 changed: 27 went from 2 to 3 (similar titles by others), and 20 went down to 0 or 1
  (generic or off-style titles). The old grades are in `grading/pre-r6-style-grades.json`. lab-01 and ho2-15 have no
  `person_intent` field, so they were not re-graded (strict reading of the note).
- New pairs (add-only): batch p1 had 135 pairs (kappa 0.825, none 2+ apart). Batch p2 had 19 pairs (kappa 0.609, one
  pair 2+ apart: Eddington for "vince gilligan", C: 2). grades.json went from 3,685 to 3,839.
- Cut rule, in metrics rather than in grades: a title in the top 10 that is an alternate cut of a title ranked above it
  counts as grade 0 for ndcg10, good10 and bad5. The ideal DCG keeps only the best-graded title of each set of cuts.
- own10: the number of the entity's own titles in the top 10. Own means credit weight >= 0.8: director or co-director,
  creator, Writing-department writer, top-4 billed cast, or one of the studio's first companies. A 2nd cut doesn't
  count again. The contract's mean own10 is taken over `person_intent: style` queries. For `both` queries own10 is
  reported, but the head of 6 own titles is by design.

Effect of the re-grade and the cut rule on the saved round-5 lists (`regrade_effect.py`):

| ranker | dev-style (old → re-graded → + cut rule) | holdout3 (same) | holdout3 bad5 |
|---|---|---|---|
| r5 | 0.783 → 0.765 → 0.737 | 0.831 → 0.817 → 0.815 | 3 → 1 → 2 |
| r4-combo-fast | 0.788 → 0.783 → 0.739 | 0.724 → 0.752 → 0.752 | 2 → 3 → 3 |
| prod | 0.335 → 0.295 → 0.295 | 0.388 → 0.404 → 0.404 | 10 → 11 → 11 |

(The dev-style column covers the 6 dev style / both queries. Later batches changed the ideals a little more; the
current numbers are below.)

Alternate cuts (`cuts.py`): the relation is pairwise, not a partition. Two titles are linked when:
- one is the other plus a cut suffix (Redux, Extended / "- Extended Version", Director's Cut, Final Cut, Special /
  Ultimate / Deluxe Edition, Uncut, The Whole Bloody Affair, Unrated, Re-Edit, ...) or a director's possessive prefix
  ("Zack Snyder's Justice League"), and they share a director;
- the suffix-stripped base is the other title minus a part marker (The Whole Bloody Affair links to Kill Bill Vol. 1
  and to Vol. 2, but Vol. 1 and Vol. 2 are not linked to each other);
- or they have the same normalized title, their years differ by at most 1, and they share a director (or exactly one
  of them has no director credits). This catches duplicate records such as Reservoir Dogs 1991 / 1992 and the four
  Hateful Eight Extended entries.

About 780 eligible titles are linked. `fold` keeps the first title of each set and drops later ones. r6 folds every
list after the blend, so it applies to all queries. It changes the top 10 of 4 earlier queries: ppl-09, ppl-12,
ppl-16 and ho2-22 (a duplicate Battlestar Galactica 2003 / 2004). ho2-03 +0.066. No title_lookup guardrail changes.

Style path (hyb6, only for entity queries with intent style or both; everything else is hyb5 plus folding). Every
signal is z-scored over the candidates:
- fp centroid: cosine to the log-votes-weighted fingerprint centroid of the entity's top 20 main-role titles (w 0.8);
- emb centroid: the same centroid for the bge embedding (w 0.6);
- term profile: stemmed terms and bigrams of the tags, keywords, tropes and essence text of those titles that at
  least 2 of them share, weighted by the share of titles × IDF, top 40, scored with the BM25 body index (w 0.3).
  Removing it costs about −0.08 on dev-style;
- peers: similar directors, creators or studios. Centroids are precomputed for 2,339 directors / creators (≥ 3
  eligible main-crew titles, ≥ 200k votes) and for the studio groups. The entity's 15 nearest by fingerprint centroid
  are its peers (e.g. Tarantino: Drew Goddard, Guy Ritchie, the Coens, De Palma, de la Iglesia, Kitano, Suzuki,
  Vaughn; Tarkovsky: Malick, Sokurov, Dreyer, Herzog, Angelopoulos). Their top 8 titles get the peer's similarity
  (w 0.3). Using the fingerprint only for peers beats adding the embedding: +0.01 dev-style, +0.07 ho3-style;
- agreement min(z fp, z emb, z terms) (w 0.2), name mentions in other titles' body text (w 0.1), the Jev reading's
  fingerprint sum (w 0.4), the residual query (w 0.3), negation as r5;
- popularity damping: −0.2 z(log votes) on titles that aren't the entity's own; the goodwatch-score half of the prior
  stays (0.1). Stronger damping (0.4, 0.6) hurt;
- own titles: +1.0, then 3 to 6 own titles in the top 10 (pulled up to interleaved slots if fewer than 3, the extras
  moved below rank 10), re-checked after the blend and the folding. Cuts are folded before the slots are filled.
  `both` keeps r5's head of 6 own titles.

What did not help: own_max 5 (−0.034 dev-style, −0.012 ho3-style; own10 5.0 instead of 6.0), more damping, more
profile terms (80) or more peer titles (15), mention weight 0.3, and for "like david lynch but less weird" capping
own titles at 3 or doubling the negation weight. Both cost ndcg on dev because Lynch's surreal films still rank on the
centroids, and his accessible own titles (Twin Peaks) left with the cap.

### r6 config (frozen before holdout4)

`run6.FINAL["r6"]` = `run5.FINAL["r5"]` with `rankers6.DEFAULTS6`: `s6 True, w_fp 0.8, w_emb 0.6, w_terms 0.3,
w_mention 0.1, w_peer 0.3, w_agree 0.2, w_jev 0.4, w_res 0.3, damp 0.2, gw 0.1, own_w 0.8, own_boost 1.0, own_min 3,
own_max 6, own_slots (0, 2, 4, 6, 8), cen6_k 20, terms_n 40, terms_min_df 2, peer_k 15, peer_titles 8, peer_emb 0.0,
k_cen 500, k_terms 300, fold True` (neg_own_* and neg_w unset). The blend is r5's (title-word bonus off on entity
queries). Alternate cuts are folded after the blend (`cuts.fold`), then `run6.cap_own` applies (own_max for style
queries). No code or config changes after this point.

Dev and regression numbers (round-6 metrics, current grades):

| ranker | dev-style (6) | ho3-style (6) | dev (all) | holdout | holdout2 | holdout3 | bad5 dev-style | own10 dev style |
|---|---|---|---|---|---|---|---|---|
| r6 | 0.812 | 0.884 | 0.836 | 0.761 | 0.728 | 0.893 | 4 | 6.00 |
| r5 | 0.709 | 0.675 | 0.823 | 0.761 | 0.727 | 0.788 | 5 | 3.50 |
| r4-combo-fast | 0.714 | 0.789 | 0.767 | 0.761 | 0.716 | 0.720 | 5 | 7.50 |
| prod | 0.293 | 0.473 | 0.501 | 0.450 | 0.514 | 0.392 | 12 | 3.00 |

Per query vs r5: tarantino vibes +0.31, miyazaki-like +0.23, edgar wright +0.08, villeneuve +0.06, kubrick-esque
+0.49, guy ritchie +0.43, christopher nolan +0.12, wes anderson +0.13, coen humor +0.09. Losses: terry gilliam −0.04
(Alice in Wonderland and Holy Motors, both graded 1, enter the top 10), lynch less weird −0.03, vince gilligan −0.03
(Hancock and Home Fries are own titles through writer credits and get graded 0 / 1).

Latency: no paid calls. The peer and cut indexes are built offline (about 2 s here, in memory). Per style query: two
centroid scans (bge 768-d and fingerprint 74-d) as Qdrant query-by-vector lists, one BM25 profile query (40 terms) and
one name-mention query in the same batch, plus < 5 ms in process (peers, slots, folding). Offline median 42 ms for the
style path (r5: 21 ms). Estimated +5-10 ms p50 on style queries only. Whole-search p95 stays at ~0.55 s.

Holdout4 finalists (frozen): `r6`, compared with `r4-combo-fast` and `r5` under the round-6 note's criteria.

## Holdout 4 (2026-09-23): frozen r6 on the style split

The frozen `run6.FINAL["r6"]` was run with no code or config changes after the freeze (`run6.py holdout4`,
`holdout4-metrics`). Detection found the intended entity in all 12 queries (e.g. "fincher" by surname, "aardman" and
"blumhouse" by studio alias, French "à la jean-pierre jeunet" by full name). Intent differs from the query's
`person_intent` on 3 queries: "something darren aronofsky would direct" was read as filmography, "danny boyle movies
and stuff like them" and "cartoons with matt groening humor" as style instead of both. 329 new pairs were graded by
two sonnet assessors (quadratic weighted kappa 0.878). 4 pairs were 2+ apart and went to a blind assessor C: Wild
Zero 2, Koala Man 1, Death of a Unicorn 1, Ju-on: The Beginning of the End 2. Merged add-only (3,839 → 4,168).
Details: `round6/metrics.md`.

| ranker | holdout4 ndcg10 | bad5 | own10 (9 style queries) | dev (all) | holdout | holdout2 | holdout3 |
|---|---|---|---|---|---|---|---|
| r6 | 0.837 | 2 | 6.00 | 0.836 | 0.761 | 0.728 | 0.893 |
| r5 | 0.709 | 2 | 3.78 | 0.823 | 0.761 | 0.727 | 0.788 |
| r4-combo-fast | 0.704 | 1 | 4.67 | 0.767 | 0.761 | 0.716 | 0.720 |
| prod | 0.379 | 20 | 2.56 | 0.501 | 0.450 | 0.514 | 0.392 |

Criteria (round-6 note), applied mechanically:
- ndcg10: r6 − r4-combo-fast +0.132 and r6 − r5 +0.127 (both need ≥ +0.05): pass.
- bad5: r6 has 2, against 1 for r4-combo-fast and 2 for r5 (it must not be higher than either): **FAIL**.
- mean own10: 6.00 (must be 3 to 6): pass, at the upper edge. The per-query values are 6 everywhere except fincher
  3, jeunet 5 and aronofsky 10; aronofsky was read as a filmography query, so no cap applied.
- earlier splits, r6 − r5 (no drop over 0.01): dev +0.013, holdout +0.000, holdout2 +0.001, holdout3 +0.105: pass.
- Verdict: **r6 does not win.**

Both r6 grade-0 titles in the top 5 come from "fincher vibes but a series": Love, Death & Robots (#3) and Voir (#5).
Both are Fincher's own series through a director or producer credit, and the own-title boost (+1.0) pulled them up.
r4-combo-fast's single grade-0 title is Animaniacs (#3) for "aardman humor".

Per query vs r5, r6 gains on 9 of 12: danny boyle +0.30, blumhouse +0.29, jeunet +0.27, aardman +0.24, nicolas cage
+0.15, fincher series +0.13, kaufman +0.12, mel brooks +0.09, gilliam +0.03. It loses on matt groening −0.06 (after
The Simpsons, Futurama and Disenchantment, the neighbours are kids' cartoons, all graded 0: The Weekenders, The Proud
Family and Kappa Mikey. The fingerprint and peers match "animated family comedy", not the satire) and jackie chan
−0.02. aronofsky is ±0.
Latency: holdout4 r6 median 34 ms offline, no added cost.

What it means (not a contract outcome): the style signals work. The biggest dev and holdout gains come from the
fingerprint centroid with fingerprint-only peers, the IDF term profile, and cut folding. The remaining failure is the
own-title rule: a person's weakest own credits (a producer credit on a series, an animated anthology, a
voice-cast credit) are boosted like the core filmography. A next step would rank own titles by style fit instead of a
flat boost, or require a main crew role (director / creator) for the boost and the slots. Another would add a satire
or tone term to the neighbour score for animation queries.

Playground: r6 was added as a column (`playground/serve.py`, `index.html`), but it doesn't carry the winner tag,
which stays on r4-combo-fast.

## Human calibration (2026-09-23)

The user graded 11 of the 40 calibration pairs (the rest were unknown titles).
Against the final agent grades: 7 exact, 10 within one grade, mean
human − agent −0.36. Two findings:
- "something short to watch after work": The Yogi Bear Show got 0 from the
  user and 3 from both agents. Agents read vague queries too literally.
- "like groundhog day": the user graded Groundhog Day itself 3. Round 4
  excludes the reference title in "like X" queries, which goes against this.
Too few pairs for a kappa; direction only. Grades in
`grading/human-calibration-grades.json`.

## Simplification loop, round 0 and round 1 (2026-09-23)

Branch `proto/search-simplify`, handoff in `HANDOFF.md`. Contract note added
(simplify note, S target 236).

Round 0, setup:
- `harness/evalsimp.py` scores any config or module on every split, with
  unjudged@10, condensed NDCG, and latency measured against r6 in the same
  run. It reproduces r6, r5, r4-combo-fast and prod exactly.
- `results/simplify/baseline-complexity.md` and `harness/complexity.py`:
  r6 S = 394 (tunables 187, rules 164, regexes 35, paths 8), about 1,600 to
  1,750 lines. Person and studio detection is 104 of it.
- `harness/simp.py`: flat r6, identical top-50 lists on all 127 queries,
  p50 41 ms against r6's 44 ms in the same run, proxy 277 against 306. It
  adds off switches for the 15 rules that had none and no longer reads
  other queries' capture files.
- Real production search history can't feed `holdout5` yet: 157 rows, 117
  of them local development traffic under the dev key.

Round 1, leave-one-out ablation (62 single and grouped ablations,
`results/simplify/round1-ablation.md`):
- Individually safe drops add up to S 52, but together they lose dev
  −0.009 and dev-style −0.020. A subset without the title-word bonus and
  the early/late career rule (S 39) keeps every split within −0.005.
- `ref_mix` and `ref_facet` interact on "like Breaking Bad but a comedy"; drop
  or keep them as a pair.
- Clear keeps: entity detection, the style path, facets plus coverage
  (holdout −0.053), era, BM25, negation, spell, fuzzy title.
- Conclusion: pruning reaches about 10% of S. The 40% goal needs mechanisms
  replaced, not removed. Round 2 runs four builders in parallel: entity
  detection and intent, one reference mechanism, the text rules, and fitted
  fusion weights. A fifth agent prepares the rubric overlay.
- The 139-pair ablation grading pool (`r6-simp1`) is held back and merged
  with round 2's pool.

## Simplification loop, round 2 (2026-09-23): four areas in parallel

Four builders, each on a copy of `simp.py`, plus the rubric fix. Reports are
in `results/simplify/<area>/REPORT.md`. The numbers below are before grading;
"c" is condensed NDCG, which skips ungraded titles.

| area | module, recommended variant | area S before → after | whole-ranker S | worst split vs r6 (plain / condensed) | bad5 |
|---|---|---|---|---|---|
| entity detection and intent | `simp_entity`, `entity-resolver` (`entity-lean`) | 123 → 47 (39) | 315 (304) | ho4 −0.037 / +0.037, 16 unjudged | 40 |
| reference ("like X", person and studio style) | `simp_ref`, `ref-merge` (`ref-lean`) | 109 → 77 (53) | 360 (336) | ho3 −0.027 / −0.001 | 38 |
| text rules | `simp_text`, `text-cons` | 103 → 51 | 342 | ho −0.006 / +0.007 | 36 |
| fusion, BM25, title rules | `simp_fusion`, `fusion-shared` | 59 → 34 | 358 | dsty −0.009 | 39 |

- Entity: one name index for people and studios with one ambiguity test;
  intent from 39 example phrases in the multilingual embedding; two credit
  classes. Entities match r6 on all 127 queries. Intent matches the gold
  label on 32 of 36 queries, against 30 for r6. False positives on the tag
  probes fall from 36 to 10.
- Reference: one `rank_query` for "like X", filmography and style; one
  `bound_own` step for own titles. A "like X" title may appear once, not at
  #1 (human calibration). The Fincher producer-credit problem is fixed, but
  sty-07 (Groening) drops −0.101. Without peers, `ref-lean` loses graded
  style quality.
- Text: negation from one marker-word list, no regexes; "less X" merged into
  negation; era as a filter only; facets and coverage from Jev's
  `searchedPhrases`. Regex sites fall from 35 to 21. Jev's avoid chips as
  the only negation lost ho −0.018 and were rejected. Still open: "space
  opera without aliens" and "deth".
- Fusion: one weight of 0.1 for 7 secondary signals. Fitted weights
  (5-fold CV by query) reach 0.809 against 0.804 for hand weights, not
  worth the extra tunables. Fitting on condensed NDCG pulls toward ungraded
  titles, so fitting uses plain NDCG.
- Latency: every recommended variant is at or below r6 in the same run.
- Rubric: `GRADER.md` has a "Vague and mood queries" section. 13 vague or
  mood queries were identified; 472 of their existing pairs are being
  re-graded into the overlay (`evalsimp.py --overlay`).

The area savings sum to S 199 to 234, which would give S 160 to 195 if
they compose. Round 3 merges them into `harness/simp_combo.py`, then one
grading pool covers the round 1, round 2 and round 3 candidates.

### Rubric overlay for vague and mood queries (2026-09-23)

The 472 existing pairs of the 13 vague or mood queries were re-graded under
the new `GRADER.md` section by two sonnet assessors (quadratic weighted kappa
0.829, 1 pair 2+ apart, decided by a blind third: "300" for "furious" = 3).
246 grades changed, mostly kids' shows on "wholesome" (Hey Duggee, Tweenies,
Handy Manny 3 → 0). Grades go to `results/simplify/rubric/overlay.json`, not
`grades.json`; `evalsimp.py table --overlay` applies them.

Human calibration pairs on these queries: 4 of 5 exact (was 2 of 5), all
within one grade. The Yogi Bear Show 3 → 0 (user 0), The Prisoner 3 → 2
(user 2), Return 2 → 1 (user 1), Naked Gun 33⅓ 2 → 3 (user 2).

| ranker | dev | holdout | other splits | bad5 total |
|---|---|---|---|---|
| r6 | 0.836 → 0.801 | 0.761 → 0.729 | unchanged | 40 → 51 |
| r5 | 0.823 → 0.788 | 0.761 → 0.729 | unchanged | 42 → 53 |
| r4-combo-fast | 0.767 → 0.733 | 0.761 → 0.729 | holdout2 0.716 | 47 → 58 |
| prod | 0.501 → 0.473 | 0.450 → 0.405 | holdout2 0.514 → 0.513 | 151 → 166 |

From here on, candidates are reported under both grade sets, and the win
criteria must hold under both.

## Simplification loop, round 3 (2026-09-23): combined module

`harness/simp_combo.py` ports all four round-2 areas plus the round-1 safe
drops onto `simp.py`, and deletes replaced r6 code instead of switching it
off: 1,229 lines against 1,592, one ranking function for every query, 5 to 6
regex sites against 35. Full report: `results/simplify/combo/REPORT.md`.

| variant | S | dev | ho | ho2 | ho3 | ho4 (plain / condensed, unjudged) | bad5 | p50 / p95 vs r6 |
|---|---|---|---|---|---|---|---|---|
| r6 | 394 | .836 | .761 | .728 | .893 | .837 | 40 | 44.0 / 116.8 |
| combo-safe | 213 | .833 | .764 | .747 | .887 | .800 / .886, 21 | 31 | 40.9 / 83.3 |
| combo | 198 | .831 | .763 | .754 | .892 | .805 / .887, 22 | 32 | 43.6 / 84.2 |
| combo-lean | 174 | .824 | .759 | .755 | .861 | .782 / .883 | 35 | 47.2 / 87.6 |
| combo-lean-peers | 185 | .827 | .759 | .752 | .864 | .777 / .887 | 34 | 45.5 / 83.2 |

- `combo` breaks down as 39 config tunables, 35 magic numbers, 116 rules, 5
  regexes and 3 paths (general, non-English, reference). Intent only selects
  numbers now.
- Early/late career: text dropped the era prior that ref reused. `combo`
  drops the career rule ("early spielberg" −0.174); `combo-safe` keeps a
  one-term version.
- Graded losses in `combo`: "animated movie that is not for kids" −0.193,
  "a hopeful space adventure without horror" −0.141 (both fixed in
  `combo-safe` by coverage weight 0.3 and facets from 2 phrases), and
  "something darren aronofsky would direct" −0.146 (6 own titles plus 4
  similar ones instead of 10 own, the mix the style rubric asks for).
  Fixed: "cartoons with matt groening humor" 0.542 → 0.781.
- Open before any verdict: holdout4 misses on plain NDCG only (22 unjudged
  titles), and dev-style `own10` is 6.25 because the metric still uses r6's
  credit weights (Sin City counts as a Tarantino title). The metric is not
  changed to suit the candidate.
- The lean variants fail holdout3 even condensed and are slower than r6 on
  p50; kept as references only.

Grading pool `r6-simp3`: 100 pairs over 57 queries for `combo`, `combo-safe`
and `combo-lean-peers`. `holdout5` (30 blind agent-written queries) is being
written in parallel by an agent that sees no ranker output.

### Round 3 grading

Pool `r6-simp3`: 100 pairs, kappa 0.863, 2 pairs decided by a blind third
assessor. `grades.json` 4,168 → 4,268. All variants but `combo-lean` now
have 0 unjudged titles. The new grades also move r6's ideals slightly.

| grades | ranker | S | dev | ho | ho2 | ho3 | ho4 | bad5 | own10 dsty/h3sty/ho4 |
|---|---|---|---|---|---|---|---|---|---|
| grades.json | r6 | 394 | .834 | .754 | .712 | .888 | .828 | 40 | 6.00/6.00/6.00 |
| grades.json | combo-safe | 213 | .845 | .769 | .758 | .911 | .867 | 31 | 6.25/6.00/5.33 |
| grades.json | combo | 198 | .839 | .775 | .769 | .915 | .869 | 32 | 6.25/6.00/5.33 |
| grades.json | combo-lean-peers | 185 | .840 | .771 | .768 | .885 | .871 | 34 | 6.00/6.00/5.33 |
| overlay | r6 | 394 | .799 | .722 | .711 | .888 | .828 | 51 | |
| overlay | combo-safe | 213 | .808 | .735 | .761 | .911 | .867 | 43 | |
| overlay | combo | 198 | .802 | .746 | .773 | .915 | .869 | 44 | |

`combo` and `combo-safe` beat r6 on every split under both grade sets. Open:
dev-style `own10` 6.25 (one query at 7 under the metric's r6 credit
weights), a thin p50 margin for `combo` (43.6 against 44.0 ms), and one
uncached intent encode per entity query that the benchmark hides. Round 4
addresses these three before a freeze. `combo-lean-peers` (S 185) misses
holdout3 by 0.003 and is the fallback if round 4 wants a lower S.

## Simplification loop, round 4 (2026-09-24): the three blockers

Files: `results/simplify/round4/` (explore*.txt, final-score-run1/2.txt, latency-uncached-run1/2.txt,
final-table-overlay.txt, own10-per-query.txt, complexity-combo*-v2.*). New FINAL entries in `harness/simp_combo.py`:
`combo-v2`, `combo-safe-v2` (= the round-3 variant + `bound_codirected` + `entity_dense="reuse"`).

- **own10:** the bounds now also count a person's co-directed films as own titles (the metric's definition), so
  "tarantino vibes" keeps 6 own titles (Sin City out, Freeway in: 1.000 → 0.964). Every style query is ≤ 6; means
  6.00/6.00/5.33. Rejected: co-directors as main credits everywhere (edgar wright −0.072, early spielberg −0.068),
  style max 5 (dsty −0.014, ho3 −0.021).
- **Intent encode:** no reuse keeps intent accuracy for English. Gold agreement on the 36 labelled queries: r6 30,
  me5s on the "X" query 32, bge on the same text 26 (best bge variant 29). Using the me5s vector as the dense query
  (ho3 −0.041) or dropping the entity dense signal (ho3 −0.045) costs ndcg. Kept: non-English entity queries reuse
  the intent vector (same model, one encode fewer); English entity queries still pay one me5s encode (~6 ms).
  Every variant now encodes a text once per query (`sims` memo; rankings unchanged).
- **Honest latency:** `evalsimp.py latency <specs> --uncached --reps=5` (qemb.NO_CACHE: every query encode timed).
  Load average 28–44 during the runs, so absolute uncached numbers are inflated.

| ranker | S | p50/p95 cached run1 | run2 | p50/p95 uncached run1 | run2 | encodes/query |
|---|---|---|---|---|---|---|
| r6 | 394 | 44.5/112.2 | 46.3/107.4 | 193.0/649.4 | 192.7/646.6 | 2.61 |
| combo-v2 | 200 | 41.5/92.1 | 40.8/86.1 | 192.9/562.2 | 191.5/561.6 | 2.64 |
| combo-safe-v2 | 215 | 41.0/85.5 | 39.6/84.8 | 187.1/564.8 | 184.2/560.4 | 2.43 |

ndcg10 (grades.json / overlay): combo-safe-v2 dev .845/.807, ho .769/.735, ho2 .758/.761, ho3 .911/.911,
ho4 .867/.867, bad5 31/43, 0 unjudged, title@1 6/7 (r6: .834/.799, .754/.722, .712/.711, .888/.888, .828/.828,
40/51). combo-v2 ties r6 on uncached p50 (margin 0.1 and 1.2 ms; round-3 `combo` was 0.2 ms above r6 in run 2).
Recommendation: freeze `combo-safe-v2`.

## Freeze before holdout5 (2026-09-24)

Frozen candidate: `simp_combo.FINAL["combo-safe-v2"]` (S 215). Hashes (sha256,
first 16): `simp_combo.py` f384c5e71ac87ed1, `qemb.py` 4a08e3e7a3d47452, `cuts.py` + `sparse.py` +
`catalog.py` 4b1135269e279154. No code or config changes after this point. It is
compared against r6 on `holdout5` under the simplify note's criteria;
production's captured list is scored for reference. `combo-v2` (S 200) is
not a finalist: its uncached p50 margin (0.1 to 1.2 ms) is inside noise.

## Holdout 5 (2026-09-24): frozen combo-safe-v2 against r6

Hashes checked against the freeze before any list was made. 30 blind
agent-written queries (h5-01 to h5-30). Pool of r6, `combo-safe-v2` and prod
top 10s: 570 pairs, two sonnet assessors (kappa 0.880), 12 pairs 2+ apart
decided by a blind third. `grades.json` 4,268 → 4,838. The overlay touches
no holdout5 pair, so both grade sets give the same numbers.

| ranker | S | holdout5 ndcg10 | style + both (2) | bad5 | own10, style query | p50 / p95 ms, ranking | p50 / p95 ms, uncached |
|---|---|---|---|---|---|---|---|
| r6 | 394 | 0.764 | 0.799 | 16 | 2 | 49.3 / 98.4 | 217.0 / 565.9 |
| combo-safe-v2 | 215 | 0.794 | 0.914 | 15 | 5 | 38.3 / 81.5 | 166.6 / 558.4 |
| prod | – | 0.511 | 0.109 | 42 | 0 | – | – |

own10 is computed with the corrected name "sofia coppola": the metric's
detector (r6's) doesn't resolve the typo "sofia copola", which is also why
r6 ranks only 2 of her films.

Criteria (simplify note), applied mechanically:
- S 215 ≤ 236: pass.
- ndcg10 not more than 0.01 below r6 on every split: dev .845, holdout .769,
  holdout2 .758, holdout3 .911, holdout4 .867 (r6 .834, .754, .712, .888,
  .828); overlay dev .807, holdout .735 (r6 .799, .722); holdout5 +0.030:
  pass.
- bad5: 31 against 40 (overlay 43 against 51), holdout5 15 against 16: pass.
- own10 on style queries: 6.00 / 6.00 / 5.33, holdout5 5: pass.
- title@1 6/7, unchanged: pass.
- Latency not higher than r6 in the same run, ranking only and uncached,
  on dev to holdout4 (two runs) and holdout5: pass.
- Cost: no new paid calls: pass.
- Verdict: **combo-safe-v2 wins.**

Per query: gains on "like john wick but a tv show" +0.269, "sofia copola
vibes" +0.235 (typo resolved, 5 own titles plus similar ones), "funny movie
under 90 minutes" +0.153, "adrenaline rush" +0.115, "like interstellar"
+0.095 (Interstellar itself at #2, per the human calibration). Losses:
"journalists uncovering a cover up" −0.083, "somthing to cheer me up" and
"revenge planned for years" −0.025.

Still open, shared with r6 or new:
- "harry potter but for adults" scores 0.000 for both: the franchise in "X
  but Y" still pulls in Harry Potter titles.
- "una peli romántica que no sea cursi" ≈ 0.52 for both: production routes
  the Spanish and Turkish queries as English, so negation there relies on
  the English path.
- Encodes per query: mean 3.35 against 2.41 for r6 on holdout5, max 41 on one
  query (facet phrases). p50 and p95 are still lower, but the port should
  batch those encodes or cap the phrase count.
- `holdout5` is agent-written. Real production queries should confirm it
  once there is traffic.

## Simplification loop, round 5 (2026-09-24): user review, producers as creators

The user compared the rankers in the playground (port 8766, new column
"Simplified (combo-safe-v2)") and found one failure: "funny brad pitt shows"
returned Adolescence, The OA, 3 Body Problem and 4 more Plan B dramas.

Cause: shows without a TMDB Creator credit (8,642 of about 9,200) got their
creators from `pull_credits.py`'s fallback, the top 2 Executive Producers or
Writers by episode count. Brad Pitt is executive producer on every episode of
those 7 shows. `combo-safe-v2` counts every creator as a main credit and adds
the filmography boost (4.0 × weight). r6 has the same failure (weight 0.8).

Fix (`combo-safe-v2-wcred`): `pull_credits.py --writer-creators` rebuilds
`data/credits-v2.jsonl.gz` from the raw cache. A fallback creator must have a
script credit (Writer, Teleplay, Screenplay); writer-producers come first;
pure executive producers never qualify. 4,610 shows lose a fallback creator
(most often Rebecca Eaton, Brian Grazer, Greg Berlanti, Steven Spielberg).
Counting fallback creators as minor credits instead (`fbminor`) breaks
"cartoons with matt groening humor" (0.840 → 0.165) and was rejected.
Scaling the filmography boost by fit was not needed.

Six dev regression queries were added (dev5-01 to dev5-06: "funny brad pitt
shows", "funny will ferrell shows", "lighthearted ridley scott series",
"feel-good reese witherspoon shows", "seth rogen comedy series", control
"funny ricky gervais shows"). Before grading, wcred is within 0.01 of
`combo-safe-v2` on every old split (ho4 .858, condensed .877, 5 unjudged).
`holdout5`, run again as a regression check only (it is no longer blind for
this change): 0.794, unchanged. S stays 215.

Latency finding: with the dev5 person queries included, `combo-safe-v2`'s
uncached p50 is above r6 (about 188 against 143 to 153 ms). The intent step
encodes every English person or studio query once more with
multilingual-e5-small, about 70 ms under the current machine load.
`holdout5` had only 4 person queries, so the earlier pass hid this. The
freeze's latency result therefore does not hold on the larger set. A latency
fix and the grading of pool `simp5` (108 pairs) are in progress.

## Simplification loop, round 6 (2026-09-24): latency fix, concrete negation, final candidate

- Latency (`intent_thread=1`): the intent encode runs in a worker thread with
  1 torch thread, overlapping the residual and facet encodes. Lists are
  identical; uncached p50 and p95 are at or below r6 in both runs with the
  dev5 person queries. Reusing an existing vector for intent was worse than
  r6 (bge 31 of 42, lexical 31 to 33, me5s 37, r6 35).
- Concrete negation (`neg_lex=2.0`, `label_negation`): for each negated
  clause, titles whose keyword or essence-tag labels hold all of its stems
  lose up to 2 z. No regexes, no new encodes, +3 S.
- User-reported "space opera without aliens" (ho2-09) stays at 0: Star Wars
  and Guardians of the Galaxy carry no alien keyword or tag. A trope rule
  ("Absent Aliens" as positive evidence) fixes it but no other query (only
  "aliens" has an absence trope among 38,314 trope names) and was not
  adopted; `harness/simp_trope.py`, variant `trope-abs`, +2 S.
- New dev queries dev6-01 to dev6-05 (concrete negation). Pools `simp5`
  (108 pairs, kappa 0.822) and `simp6` (63 pairs, kappa 0.934) graded;
  `grades.json` 5,009.

Final candidate `combo-safe-v3` (S 218) against r6, 0 unjudged:

| grades | ranker | dev (65) | dsty | ho | ho2 | ho3 | ho4 | bad5 |
|---|---|---|---|---|---|---|---|---|
| grades.json | r6 | .788 | .812 | .754 | .712 | .888 | .828 | 62 |
| grades.json | combo-safe-v3 | .827 | .810 | .780 | .754 | .911 | .872 | 40 |
| overlay | r6 | .760 | .812 | .722 | .711 | .888 | .828 | 73 |
| overlay | combo-safe-v3 | .796 | .810 | .746 | .758 | .911 | .872 | 52 |

holdout5 (regression check, no longer blind): 0.794 against r6 0.764.
Against `combo-safe-v2`: "lighthearted ridley scott series" +0.892, "funny
brad pitt shows" +0.732, "detective show with no murders" +0.323, "war
movie that isn't about World War II" +0.286; losses "funny will ferrell
shows" −0.163 and "seth rogen comedy series" −0.072 (shows they only
produced no longer count as theirs). The user tested the playground and
is happy with the results.

## Port fixes (2026-09-24, issue #137): term tie-break, non-English union and rescore

The benchmark (`results/bench/sparse.json`, `results/bench/replay.json`) found two places where the port can't
reproduce the prototype. Both are now in `simp_combo.py`, as config keys on `FINAL["combo-safe-v3"]`. The round-6
entry without them is kept as `combo-safe-v3-scan`.

- `terms_tiebreak=True`: the top 40 reference profile terms are sorted by (−weight, term) (`top_terms`). numpy's
  order for exact ties at the 40th weight can't be reproduced in TypeScript.
- `nonen_union_k=2000`: a non-English query's mixed dense list (z(me5s) and z(bge on Jev's English chips)) takes its
  candidates from the union of each cosine's top 2,000, scored with both, instead of scanning every filtered title.
  The z statistics still cover every filtered title (precomputed per filter in the port). This is the replay's
  `--mix=pre-rescore --mixk=2000` variant.

Effect on intermediate lists (`results/simplify/port-fixes/fixdiag.py`): the tie-break changes the term set of 4 of 51
reference profiles on the regular splits and 1 of 6 on holdout5. The union changes 1 of 10 non-English top-500 lists
(recall against the full scan: mean 0.9996, min 0.996) and none of 2 on holdout5.

Effect on the ranking: the top 10 is identical on every query, and ranks 11 to 50 differ on 5 queries (lab-12,
new-07, ho2-07, ho2-08, h5-21). No new titles reach the top 10, so no grading was needed. Scores
(`results/simplify/port-fixes/`):

| grades | ranker | dev | dsty | ho | ho2 | ho3 | ho4 | holdout5 | bad5 |
|---|---|---|---|---|---|---|---|---|---|
| grades.json | combo-safe-v3-scan | .827 | .810 | .780 | .754 | .911 | .872 | .794 | 40 (+15 ho5) |
| grades.json | combo-safe-v3 | .827 | .810 | .780 | .754 | .911 | .872 | .794 | 40 (+15 ho5) |
| overlay | combo-safe-v3-scan | .796 | .810 | .746 | .758 | .911 | .872 | | 52 |
| overlay | combo-safe-v3 | .796 | .810 | .746 | .758 | .911 | .872 | | 52 |

Uncached latency (`evalsimp.py latency ... --uncached --reps=5`, 138 queries, machine load average about 40 from other
work), p50 / p95 ms:

| run | r6 | combo-safe-v3-scan | combo-safe-v3 |
|---|---|---|---|
| 1 | 190.0 / 661.4 | 127.4 / 561.0 | 125.7 / 568.4 |
| 2 | 187.8 / 644.5 | 138.4 / 566.2 | 134.4 / 566.5 |

The fixes don't make the prototype slower. In-process, the union costs two extra partial sorts over the filtered rows;
the port's gain is the Qdrant plan, which the replay measured.
