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
