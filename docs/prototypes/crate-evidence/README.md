# PROTOTYPE: Crate search evidence comparison

Prepared for [Scratch-table prototype of the evidence column in Crate](https://github.com/alp82/goodwatch-monorepo/issues/104). **Not executed. Production writes await the user's go-ahead.**

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

## Prepared assets and remaining work

`setup.sql` and `cleanup.sql` specify the proposed database mutations for review. They have not been validated against the cluster. Before executing, check schema names and existing scratch objects read-only; abort if the name is already in use rather than reusing or replacing it. Use parameterized, bounded inserts. After approval, build the loader and D4+ comparison adapter in this throwaway worktree, execute the experiment, and present the actual comparison for review.

The source prototype is preserved on `prototype/jev-discovery-search`; this experiment is isolated on `prototype/crate-evidence-column`. No runtime routes have been changed.
