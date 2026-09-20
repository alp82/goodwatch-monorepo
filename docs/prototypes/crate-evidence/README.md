# PROTOTYPE: Crate search evidence comparison

Prepared for [Scratch-table prototype of the evidence column in Crate](https://github.com/alp82/goodwatch-monorepo/issues/104). **Production scratch writes approved by the user on 2026-09-20. Experiment executed; human quality review is pending.**

Question: does combining tags, keywords and trope names into strong evidence, alongside description text, improve retrieval over D4+ while reducing query work?

## Proposed production writes

- Create only `doc.prototype_search_evidence_104_v1`, using the accompanying `setup.sql`. One primary shard and no replicas; this disposable copy can be recreated.
- Insert at most 5,000 distinct titles: up to 2,500 movies and 2,500 shows with essence text and at least 2,000 votes, ordered by `goodwatch_overall_score_voting_count DESC, tmdb_id ASC`. Record actual counts and reject missing fingerprint scores in the loader.
- Read title, synopsis, essence text/tags, keywords and fingerprint scores from the catalog. Read trope names by `(media_type, media_tmdb_id)` in bounded batches. No catalog updates, schema changes to existing tables, or sync-flow changes.
- Populate `strong_evidence` from deduplicated essence tags, keywords and trope names, joined by newlines. Populate `text_evidence` from essence text and synopsis. Keep original fields for an apples-to-apples control.
- Refresh the scratch table after loading. No automatic cleanup before human review; drop only this named table when the ticket closes, with `cleanup.sql`.

No custom cluster analyzer is needed for this first experiment. Compare `standard` and built-in `english` over identical evidence first. A lighter custom analyzer is a possible later experiment, not part of this write proposal.

## Comparison protocol

Freeze the sample IDs and capture existing D4+ interpretation outputs once per request. Reuse those outputs across retrieval variants so Jev variability cannot masquerade as an index improvement. Do not change Jev questions in this experiment.

Compare on the same sample:

1. Existing D4+ query shapes, restricted to the frozen IDs, with the original fingerprint-object null check.
2. The same queries with the research-recommended essence-text check. Validate that the eligible sample is unchanged. This isolates the known predicate cost.
3. Consolidated strong/text evidence with `standard` indexing (control columns in the scratch table).
4. The same consolidated evidence with `english` indexing.

For the consolidated variants begin with equal column boosts; separately report a strong-evidence boost of 2.0 as an exploratory setting, not a chosen ranking weight. Reuse D4+ fingerprint weighting and its mood-only gate. Report candidate retrieval before any vector fill, and distinguish the end-to-end result after fill. Full-catalog vector results must not be mixed into the sample-only comparison.

Record warm-up separately, then five measured repetitions in alternating variant order. Report server duration and client wall time separately, returned candidates, candidate overlap, top-10 changes, and evidence behind each match. Same-sample timing is not a forecast of full-catalog latency: the source and scratch tables differ in shard count, size, and layout.

Exercise the agreed examples: `car chases`, `sunglasses`, `unreliable narrator`, `dark comedy about rich people`, `tense but not bleak`, `no anime, gritty crime show`, and `with my parents`, plus the agreed long requests. Check plural/singular pairs, phrase ordering, and whether stemming/stop-word removal produces unwanted matches. The text index is not an exclusion engine.

The full reviewed fixture set and quality floors belong to [Establish and review the search evaluation baseline](https://github.com/alp82/goodwatch-monorepo/issues/116), which remains open. Retrieval/timing probes can proceed before it finishes; no quality acceptance or ticket resolution may be claimed from unjudged results. Any comparison uses the same frozen fixture inputs, and new top-10 results are marked **needs review**.

## Run and review

Open [review.html](review.html) directly in a browser. It embeds the measured comparisons and source evidence, needs no server, and lets you export your judgments. No judgments are prefilled.

The throwaway runner lives in `goodwatch-webapp/scripts/prototype-crate-evidence/`. From `goodwatch-webapp`, with its normal Node dependencies and Python `requests`/`python-dotenv` available:

```sh
node_modules/.bin/esbuild scripts/prototype-crate-evidence/capture.ts --bundle --platform=node --format=esm --target=es2022 --packages=external --alias:~=./app --outfile=scripts/prototype-crate-evidence/capture.mjs
node scripts/prototype-crate-evidence/capture.mjs scripts/prototype-crate-evidence/private/interpretations.json
python scripts/prototype-crate-evidence/experiment.py --env /path/to/webapp/.env load
python scripts/prototype-crate-evidence/experiment.py --env /path/to/webapp/.env probes
python scripts/prototype-crate-evidence/experiment.py --env /path/to/webapp/.env compare
python scripts/prototype-crate-evidence/report.py
```

The loader refuses to overwrite an existing scratch table. Do not rerun `load` while this experiment's table exists. Captured interpretations are reused on subsequent runs; remove the private capture only when a deliberate new interpretation is wanted. No Jev question wording was changed. The inherited prototype uses `jev-latest`; replay uses saved readings, not an assumption that this alias stays unchanged.

The loader uses parameterized batches of 100 titles. `setup.sql` was executed as written. `cleanup.sql` remains pending until review and ticket closure. Raw catalog snapshots and repeated results stay in the ignored `private/` directory. The published sample manifest records the exact IDs and snapshot hash; interpretations, compact results, per-query timings, and analyzer probes accompany the review page.

## Measurement boundaries

- This is an adaptation of D4+ retrieval, not an end-to-end run of the existing page. It preserves interpretation, phrase selection, fallback thresholds, fingerprint weights, normalized weighted-sum ranking, and text blending. Fingerprint scores and display evidence are loaded from the frozen snapshot rather than repeatedly fetched in each timed query.
- Attribute eligibility is determined from source catalog fields before timing and supplied to all variants as the same allowed IDs. Source baselines retain their original eligibility predicates. Timings exclude that precomputation, Jev, page rendering, and vector fill.
- The original fallback has no SQL order and truncates a full-catalog trope search. Here fallback queries are limited to the frozen sample and ordered deterministically before applying the per-type cap. This prevents unrelated titles and nondeterministic truncation from influencing the sample comparison.
- The baseline keeps phrase-prefix plus all-word queries and handwritten plural forms. Consolidated retrieval uses one all-word query over two evidence columns per media type, without the separate phrase bonus or keyword/trope fallback. Standard-versus-English isolates stemming within that consolidated design; baseline-versus-consolidated changes both evidence and retrieval shape.
- Popularity and fixed sample size bias the experiment toward popular titles. The source tables have different size and shard layouts from the one-shard scratch table. These timings do not establish production cost or latency at full catalog scale.
- Mood-gated requests have zero text candidates by design. The full product would use Qdrant fill; the experiment does not label an empty text panel as a failed search or manufacture a replacement ranking.

The source prototype is preserved on `prototype/jev-discovery-search`; this experiment is isolated on `prototype/crate-evidence-column`. No runtime routes or production catalog data have been changed.
