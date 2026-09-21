# Cheap ranking research: reuse the existing Jev interpretation

Research date: 2026-09-20. This is a proposal for a budget-preserving loop, not a measured winner. No provider calls or database operations were performed for this research. Keep the original 13 requests as the primary matched comparison; the 28 assistant-added stress requests are supplemental. The previous expensive candidate cost 16.39 times the baseline model cost on those same 13 requests and did not establish an overall quality win. See [matched measurements](matched-comparison-metrics.json).

## What we already have

The frozen [interpretations](interpretations.json) and [server implementation](../../../goodwatch-webapp/app/server/prototype-jev-vector.server.ts) provide useful features without another model call:

| Existing feature | Cheap use | Boundary |
| --- | --- | --- |
| `attributes.phrases[].phrase/probability` | Query alternatives and phrase confidence | Alternatives are not automatically separate required concepts. |
| `attributes.split[].word/concrete/isConcrete/mention` | Concrete-token coverage and evidence search eligibility | Concreteness does not resolve synonymy, negation scope or semantic roles. |
| `attributes.flags`, `genres`, existing `filters` | Preserve the exact baseline eligibility decisions | Do not silently invent a stricter genre, medium or family filter. |
| `reading.details` and selected signed `weights` | Mood/tone tie-breaking and a separate fingerprint recall arm | Negative weights are preferences, not proof that an excluded event is absent. |
| `attributes.shape` and `lean` | Existing routing context | Inspect their actual consuming code before adding new routing thresholds. |
| Captured `usage` | Reuse baseline interpretation cost and timing | Cached execution is not a new live interpretation measurement. |

The catalog sample retains essence, synopsis, essence tags, keywords, trope names and fingerprints separately. Preserve these sources: `strong_evidence` concatenates tags/keywords/tropes and cannot distinguish a central premise from an incidental trope. A term occurring in multiple repeated metadata fields should not count as multiple independent confirmations.

The [current experiment](../../../goodwatch-webapp/scripts/prototype-crate-evidence/experiment.py) uses phrase-prefix matching plus independent word matching, capped pools, score normalization and fingerprint blending. Its fingerprint normalization depends on the candidate pool, and repeated retrieval paths can contribute repeated text bonuses. A ranking experiment can change these cheaply. It cannot recover documents absent from the saved pool. Gated lexical branches and missing production vector fill must remain visible as coverage differences, not exceptionally fast successful searches.

## Crate capabilities and limits

Crate supports boosted full-text fields, `best_fields`, `cross_fields`, phrase and phrase-prefix matching; the latter expands the last token. Phrase `slop` controls proximity. `operator='and'`, `minimum_should_match` and `tie_breaker` expose useful matching controls. `tie_breaker` rewards other fields under `best_fields`/phrase modes. Full-text indexes are required; selecting a different query analyzer does not substitute for indexing with it. `MATCH` belongs in `WHERE`, and `_score` is not comparable across searches. Validate options against the deployed version before running SQL. [Crate reference](https://cratedb.com/docs/crate/reference/en/latest/general/dql/fulltext.html)

Crate's first-party example identifies `MATCH` as BM25 and demonstrates reciprocal rank fusion using SQL. We can instead fuse small result lists in Python without adding a service. [Crate hybrid-search example](https://cratedb.com/blog/hybrid-search-explained)

Do not label ordinary field boosts or a sum of independent BM25 scores “BM25F.” BM25F combines field-level term-frequency/length information before nonlinear scoring; the Microsoft paper distinguishes it from linear combinations of BM25 field scores. Native Crate controls are the pragmatic first experiment, not a verified BM25F implementation. [Microsoft Research, section 4](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/02/LearningBM25MSRTechReport.pdf)

## Six bounded experiments

These are hypotheses, with fixed generic settings and no title/query exception tables. Run single changes before combinations; retain all failures and regressions.

| Experiment | Concrete change | Where it can run | Main failure risk |
| --- | --- | --- | --- |
| 1. Source-aware centrality | Score phrase/token support separately in essence, synopsis, essence tags, keywords and tropes. Start with the existing generic centrality ordering in `search_variants.py`; count each normalized evidence item once. Cap incidental-tag contribution. | Offline on saved candidate IDs joined to sample. Native boosted-field retrieval requires Crate indexes for those fields. | Sparse essence can hide real matches; a trope can occasionally be the exact object requested. Keep support visible, not a universal hard cutoff. |
| 2. Finished phrase and proximity | Compare exact normalized phrase, then a small same-field token window, then unordered coverage. Preserve word boundaries and evidence-item boundaries. Replace prefix completion only in a separately measured retrieval arm. | Offline reranking is an approximation. Actual `USING phrase WITH (slop=...)` vs current prefix query requires Crate. | Exact phrases lose inflections/paraphrases; proximity across unrelated clauses can still create false conjunctions. Python normalization does not reproduce Lucene analysis. |
| 3. Distinct-concept coverage | Use the existing high-probability phrase and concrete words. Count distinct covered terms, not occurrences; reward same-source complete support over scattered partial support. Treat alternative phrases as alternatives. Keep missing support as unknown and retain existing filters. | Offline within saved pools; new AND/cross-field recall requires Crate. | Jev may omit indirect concepts or include a negated token. Do not require every raw request word or pretend this supplies a semantic parser. |
| 4. Bounded mood influence | For a concrete lexical request, rank evidence tiers first and use the existing signed fingerprint score only within a tier, or test one small fixed blend. Keep the existing mood-only route separate. | Offline. No additional interpretation cost. | Strict tiers can overvalue a literal incidental mention; fingerprints contain useful mood information and should not be discarded for mood-led requests. |
| 5. Rank fusion | Compare a fixed lexical ranking and a fingerprint ranking with `sum(1/(60+rank))`, absent items contributing zero. Keep source arms fixed, tie-break deterministically and do not add another vote for each correlated lexical variant. | Offline if ordered arm lists are available; candidate-ID-only snapshots require reconstructing and labeling surrogate ranks. New retrieval lists require Crate or existing vector service. | Fusion can promote broad mood matches or reward duplicated arms. It does not enforce conjunctions or repair missing recall. |
| 6. Bounded recall expansion | First add top-N exact signed-fingerprint matches from the same filtered 50k sample to the lexical pool. Separately, test at most a few low-weight catalog-derived term associations, retaining the original query. Keep origins explicit and rerank with the same evidence scorer. | Offline sample-wide scan/index is possible; production-vector parity needs Qdrant, and lexical expanded retrieval needs Crate. No DB writes are needed for the offline test. | Fingerprints retrieve mood rather than specific premises; co-occurrence confuses related topics with synonyms. Never turn an associated term into a required condition. |

RRF's original authors specify the reciprocal-rank formula and use `k=60`; their benchmark gains are not evidence of gains on these movie requests. Experiment 5 is our application of that method. [Cormack, Clarke and Büttcher, SIGIR 2009](https://cormack.uwaterloo.ca/cormacksigir09-rrf.pdf)

For experiment 6, catalog associations should be computed globally from deduplicated documents, with a minimum document support and common-term suppression, never from hand-picked results for an individual benchmark request. Freeze the association table before evaluation. Query expansion with lower-weight added terms and corpus-derived associations is an established approach, but does not guarantee precision. [Stanford IR textbook: query expansion](https://nlp.stanford.edu/IR-book/html/htmledition/query-expansion-1.html)

## Recall and Jev design boundaries

The existing server's `retrieve()` already queries Qdrant's `fingerprint_v1`, applies `qdrantFilter(flags)`, and can rerank a wider pool with the signed weighted sum. Its D4 evidence path fills short results from that vector route. Thus a weak fixed-pool result is not proof that cheap retrieval is exhausted. An offline exact weighted sum over the sample tests the usefulness of existing dimensions; it is not a measurement of Qdrant latency, collection coverage, configured distance or approximate-search recall. Preserve null-score behavior explicitly. The sample lacks some original flag fields: obtain an eligibility-key cache using the exact frozen source filters before any full-sample arm; treating absent fields as false or dropping those filters would invalidate the comparison.

The repository collection specification explicitly selects 74-dimensional **Cosine**, not raw Dot, in [qdrant_schemas.py](../../../goodwatch-flows/windmill/f/sync/models/qdrant_schemas.py). [vector_data.py](../../../goodwatch-flows/windmill/f/sync/copy/vector_data.py) publishes `vector_fingerprint` separately from raw fingerprint scores. Qdrant implements cosine using normalized vectors and normalizes on upload. [Qdrant collections reference](https://qdrant.tech/documentation/manage-data/collections/) Therefore a raw signed-score dot product is an alternative recall strategy, not a faithful reproduction of existing retrieval. No live configuration was checked.

Before claiming parity for the vector/graph search, record query-vector construction and dimension order, actual stored vector transformation, live collection distance, ANN/exact settings and candidate limit, filter payload coverage, and snapshot membership. These are provenance unknowns until verified; corpus cosine itself can be computed offline only once the saved vector representation is known.

Existing Jev choices can select among predetermined phrases/attributes; the saved output is not a free-text synonym planner. This research proposes no prompt or schema change. A same-budget Jev design experiment remains a separate possible path, but requires the relevant Jev/typesafe design instructions and controlled recapture; no local typesafe skill was found in the inspected skill directory. Do not infer that such a change is authorized or that it would be free merely because the current capture is cached.

## Evaluation contract

Start with experiments 1–4 on exactly the original baseline candidate pools, then one fixed combination. Assess top-5/top-10 directly against saved evidence: central premise, requested conjunction, explicit contradiction, unknown requirement. Report per-request improvements and regressions, not a self-generated model grade. Compare the original 13 first and retain the exact baseline filters and interpretation outputs. Supplemental stress sets remain separately labeled; previously inspected requests are not fresh holdouts.

For a recall experiment, publish both fixed-pool and expanded-pool results, candidate counts/origins and which added documents changed the top results. Keep media/format eligibility identical across every arm. Report incremental ranking CPU time separately from sample/index startup, captured Jev time and any database/network time. Additional model cost is zero; projected total model cost remains the captured baseline cost, not zero. Do not claim production end-to-end latency from an offline scan.

Native BM25/analyzer/proximity behavior needs a live indexed table. The old scratch table was cleaned up; restoring it is a separate setup action, outside this read-only research. Until then, offline results demonstrate ranking behavior and possible recall gains, not Crate execution speed or exact Lucene score equivalence.

## Follow-up: bounded WordNet synonym experiment

WordNet groups words by **sense** in synsets; synonymy differs from hypernymy, meronymy and adjective similarity. A nearby graph node is not necessarily substitutable. Princeton WordNet is no longer developed. [Princeton WordNet](https://wordnet.princeton.edu/) NLTK exposes `synsets(word, pos=...)`, lemma names and separate sense groups; its own `car` example includes road vehicle, railway and elevator senses. [NLTK WordNet interface](https://www.nltk.org/howto/wordnet.html)

Neither `nltk` nor `wn` is installed in the inspected Python interpreter. A prototype could use an isolated private virtual environment plus a pinned dictionary download, with package/dictionary versions and startup recorded. The later authorized offline experiment installed NLTK3.9.2 only in `private/wordnet-venv` and downloaded WordNet3.0 into `private/nltk_data`. The generated private table records the dictionary SHA256; runtime table consumption uses only the standard library.

A bounded next ablation would retain original Jev phrases, expand only positive source words, preserve multiword compounds, and cap dictionary synonyms per token. Restrict to same-synset lemmas, not arbitrary one-hop relations; a first-sense heuristic must be labeled heuristic, not contextual disambiguation. Keep expansion evidence below exact source support and count each original concept once even if several synonyms match. Freeze limits before evaluation. Explicitly inspect ambiguous mood words and noun/verb collisions. Pure synonyms will miss derivational pairs and related social concepts; expanding hypernyms or derivations is a separate hypothesis, not an invisible fallback. This may improve lexical recall, but cannot establish who performs an action, negation entailment or a non-miserable ending.

Observed dictionary inspection across all41 frozen requests: first-sense-per-POS expands `drama` to `play`, `warm` to `warm up`, `tense` to `strain`, and `real` to `real number`/`very`. `rich` only adds `rich people`, not `wealthy`; a rich-food context receives the same output because this method has no context disambiguation. These are counterexamples to enabling the dictionary by default, not reasons to add request-specific exceptions. `cheap_wordnet.py` preserves two explicit policies and sense/gloss provenance for an optional measured ablation. No ranking improvement is claimed.

## Same-budget Jev design path: examined, still unmeasured

The required skill was found outside the Codex catalog at `/home/alp/.claude/plugins/cache/typesafe-ai/typesafe/0.5.7/skills/typesafe-ai/SKILL.md` and read. Thus the earlier missing-skill limitation is resolved. User authorization permits evolution; this addendum does not alter production prompts or make provider calls. Live official Markdown documentation was successfully retrieved over HTTPS after the browser tool failed to open it.

Official guidance says independent questions run together, cannot consume one another's answers, and still incur token cost. Choice selects among supplied options; a no-match option is appropriate when coverage is incomplete. Consequently “same call count” is feasible for several changes below, but is not proof of equal token cost. [Building guide](https://docs.typesafe.ai/concepts/how-to-build-with-system-one.md), [Choice](https://docs.typesafe.ai/primitives/choice.md), [candidate extraction cookbook](https://docs.typesafe.ai/cookbooks/pre_parsed_value_extraction_cookbook.md)

Source audit of `prototype-jev-vector.server.ts` found:

- `phraseCandidates()` splits on comma, semicolon and `but`, then removes a clause only when its **start** matches `NEGATIONS`. A clause starting “I don't want…” does not match. Curly apostrophes and sentence boundaries also need explicit handling. Stopword removal then creates adjacent pairs that were not adjacent source spans. There is a hard first20 cap.
- The phrase Choice has no no-match option and asks for the best available phrase. With at most one candidate it makes no phrase judgment and assigns probability1. A fluent answer therefore does not establish that a useful search concept was available.
- Flags already distinguish `suitability_family` from `suitability_intergenerational`, but required/excluded criteria allow clear implication. The short fingerprint task also permits clear implication. Companion context can influence family/wholesome dimensions even when child suitability was never requested.
- The lean capture omits per-word `mention` questions, which otherwise distinguish wanted content from viewing context. Adding those back would consume more tokens unless other questions were replaced. Existing concreteness scores are not a substitute for wanted-content polarity.

Three concrete hypotheses can be explored without adding calls:

1. **Repair candidate generation before inference.** Respect sentence/clause boundaries and contractions; remove only clearly negated spans, not entire mixed clauses. Preserve source offsets and spread the existing maximum20 slots across clauses rather than only the first20 candidates. This is a deterministic correctness experiment, not semantic translation. Candidate count can stay fixed or shrink, but different strings still require a token-budget check. It may remove forbidden candidates and late-clause starvation without solving indirect narrator wording.
2. **Replace the forced best phrase with a shorter, polarity-aware choice.** For example: “Which option names wanted story content in `request`, excluding rejected content and viewing circumstances? Choose none if none fits.” Reserve one of the existing20 slots for `none`; shorten the original instruction to offset that option. Keep the same question count, and handle the single-candidate branch explicitly without adding a question if strict question parity is required. This can prevent false lexical confidence, but `none` requires an honestly measured fallback and does not create missing concepts. Token parity remains an acceptance condition, not an assertion based on character count.
3. **Clarify companion versus content meaning in existing judgments.** Replace the current family suitability description with a concise child-inclusion definition, preserving the existing distinct intergenerational label. Replace permissive fingerprint task wording with a concise rule that companion context alone does not imply children's content. This reuses the existing questions and outputs; it must be evaluated across all original13 plus separately labeled stress cases because stricter implication rules can lose useful indirect preferences. Do not implement a special case for the literal word “parents.”

The long narrator request exposes a different limitation: `unreliable narrator` is absent from source-only candidates. Rewording the same Choice cannot select an omitted concept. Catalog-derived concept options could replace some existing slots within a fixed budget, rather than adding a new generative call, but that introduces a candidate-coverage problem of its own. A principled catalog vocabulary and deterministic shortlist must be demonstrated; a hand-added narrator label for this benchmark is not a general solution. Existing74 fingerprints provide indirect narrative qualities, not arbitrary topical labels.

Therefore the cheap option space is **not exhausted**. A bounded candidate/polarity correction and wording-only capture comparison remain justified. Freeze the proposed strings/options first, verify serialized question counts and token accounting, then compare actual provider-reported tokens/cost to the unchanged captures before accepting any “same-budget” claim. Additional semantic labels do not inherently require an extra call, but their coverage and token budget are presently unproven.

Paired original13 attribute captures were subsequently authorized and run using pinned `jev-1.13.0` (26 calls; $0.004046322; shared frozen fingerprint reading charged in both full-runtime projections). Revised input tokens were no greater in every case, totaling97 fewer. This is a budget result, not a quality result. In the long tense request the revised best phrase becomes nonconcrete `tense`, which can activate the existing mood gate and remove lexical retrieval; in the getaway request the phrase priority shifts toward broad car chases. Native result comparison must judge these regressions. Control/revised SQL filters stayed identical across all13, although unchanged flag/concreteness probabilities varied between calls.

## Completed budget-preserving loop: final addendum

This section supersedes the earlier **pending/unmeasured** descriptions. The original13 remained the primary matched set throughout; supplemental28 results are separate and were inspected during development, so they are not untouched holdouts now.

The cheap loop subsequently measured source-aware fields, phrase/conjunction coverage, mood balancing, exact fingerprint and local lexical recall from50k, WordNet expansion, native Crate query variants, full-score lexical/RRF/blend ranking, bounded32/64/128 local shortlists, source-only hygiene, same-budget Jev interpretation changes, pre-cap conjunction retrieval, and English Snowball normalization. None established an overall cheap/fast winner across the original13 plus separately reviewed supplemental evidence.

The same-budget Jev phase made **39 attribute calls, costing $0.006069252**:13 pinned fresh controls,13 candidate-plus-question revisions,13 candidate-only revisions. All used `jev-1.13.0`; frozen fingerprint captures were reused and charged in projected full-runtime comparisons. Both revisions used no more input tokens than their paired control for every original request (97 fewer tokens in aggregate for the first revision;54 fewer for candidate-only). The first revision could trigger the wrong mood gate or weaken relative role priority. Candidate-only preserved the long-tense/getaway phrase priorities but did not recover the missing indirect narrator concept. Token success was not evidence of search success. Current official pricing and pinned model naming are documented by [TypeSafe models](https://docs.typesafe.ai/models.md).

Native pre-cap conjunction initially improved the rich-dark-comedy and getaway pools with fewer retrieval calls. The same frozen guard on supplemental requests admitted broad alien-related records and incurred fallback work on sparse conjunctions. Anti64 improved the two original activated lists but failed to establish requested communication centrality in the alien case. The native fallback repair and attempted-versus-adopted guard are recorded; local reranking only runs when conjunction is adopted, not merely attempted. This is a failed generalization result, not a reason to add exceptions for those request strings.

The final normalization experiment compared **41 general English-pool fields2/top64 cases plus4 adopted-conjunction anti64 cases**, with unchanged pools, caps and scoring formulas. NLTK3.9.2 English Snowball maps both `communicating` and `communication` to `communic`. Original polarity eligibility was retained in both arms and selected phrase identities were asserted equal; an earlier artifact that also affected control-marker normalization remains separately labeled. No top10 changed after that control fix. This is stem consistency, not a claim of exact Lucene analyzer equivalence.

Snowball moved Arrival to first in the general alien-communication case, demonstrating a real lexical false negative. It did not fix the conjunction anti64 list: Buzz Lightyear remained first, Arrival moved second, and PAW Patrol remained third. Other changes were mixed, including a driver-pursuit list drifting toward unrelated literal escape/driver matches. On11 available original English pools, four top-fives changed; median fresh local work rose8.38→16.07ms, with40.85ms maximum measured trial. On27 available supplemental pools, nine top-fives changed; medians rose10.05→15.75ms, with164.64ms maximum trial. Empty/gated pools are excluded from these timing summaries, not counted as successful near-zero searches. The conjunction alien stemmed path took85.75ms median. Every timing includes fresh per-trial normalization and one disclosed warmup plus three measured trials; startup is separate.

The hygiene change has narrower positive evidence: it removes explicit attraction/nonreleased-pilot records while preserving ordinary adaptations and ambiguous records. In the separate1040-comparison audit it changed only the car-chase and narrator requests; median lazy filtering cost was0.73ms. That cleanup is not a semantic relevance winner.

**Recommendation: stop this bounded prototype loop without selecting an overall winner.** We now have evidence against simply adding synonyms, stems, mood weights, smaller lexical caps or a conjunction gate as a general cure. Catalog-derived semantic label generation, relationship-aware matching and revised eligibility definitions remain possible research, but there is no demonstrated same-budget, low-latency next experiment to justify continuing on these already-inspected requests. This is practical exhaustion of the tested prototype directions, not proof that affordable search improvement is impossible.

### Reproducing the final bounded paths

Source files are under `goodwatch-webapp/scripts/prototype-crate-evidence/`. All outputs below remain private and contain captured text/evidence; no credentials are written into them.

- `cheap_recall.py`: frozen50k full-corpus lexical/fingerprint recall using the exact eligibility cache.
- `cheap_wordnet.py`: dictionary-table generation and standard-library table consumption; inspect the saved dictionary hash and first-sense limitations.
- `cheap_shortlist.py`: native full-score ranking and fresh-normalization shortlist measurements.
- `cheap_conjunction_rank.py --input <native-artifact> --output <private-output>`: frozen anti64/RRF/mix only on adopted conjunction pools, plus separate hygiene results.
- `cheap_stem_ablation.py`:45 paired comparisons, with polarity selection fixed to the original normalizer. Run in the isolated private NLTK environment. It does not download anything or call a service.
- `cheap_jev_capture.ts`: exact three-arm attribute-capture reproduction. It uses the original source to construct unchanged questions, intercepts only the named experimental changes, reuses frozen fingerprints, pins the model, caches each result and preserves each provider attempt. Existing credentials stay server-side. `control`, `revised`, and `candidates_only` are the only accepted modes. The explicit `--execute` argument distinguishes paid capture from compilation; it is not an approval requirement.

From `goodwatch-webapp/`, compile the reproducible capture source without calling the provider:

```sh
node_modules/.bin/esbuild scripts/prototype-crate-evidence/cheap_jev_capture.ts --bundle --platform=node --format=esm --target=es2022 --packages=external --alias:~=./app --outfile=scripts/prototype-crate-evidence/private/cheap_jev_capture.mjs
```

For an intentionally authorized recapture, invoke each mode in order using the same private output directory (default: `private/cheap-loop/jev-paired`). Existing matching per-case files are reused; a different empty directory makes new paid calls:

```sh
node scripts/prototype-crate-evidence/private/cheap_jev_capture.mjs control --execute
node scripts/prototype-crate-evidence/private/cheap_jev_capture.mjs revised --execute
node scripts/prototype-crate-evidence/private/cheap_jev_capture.mjs candidates_only --execute
```

The saved `*-attempt.json` files contain exact outgoing bodies, raw responses, status and measured time; the per-mode reproduction manifests compare actual input tokens with the paired control. The historical experiment has39 unique attempts and must not be counted again when replayed from cache. Fingerprint reuse reduces experimental spend, while runtime projections still include that original stage. No production prompts or application integration were changed.
