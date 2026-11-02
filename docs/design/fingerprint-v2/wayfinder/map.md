## Destination

Choose an evidence-backed design for a richer GoodWatch fingerprint and discovery system through reproducible benchmarks and bounded prototypes: establish movie/show knowledge versus evidence extraction, the useful output representations and scales, the treatment of essence and companion data, and the quality/cost/time tradeoffs needed for an implementation handoff.

## Notes

- Owner preference: Keep grilling bounded: ask at most three consequential questions in an initial round, with recommended defaults. Ask a followup only if an answer blocks the next benchmark/prototype or materially changes cost, quality, or scope. Use provisional defaults for reversible details; defer refinements until results reveal a need. Stop once the next experiment can run responsibly. Do not require an exhaustive taxonomy, final architecture, or every attribute decision before a first useful comparison.

- Execution exception for this effort: bounded benchmark runs and throwaway prototypes are in scope to resolve decisions. Production rollout is a separate effort.
- Read the evidence index before proposing an experiment. It distinguishes accepted decisions, measurements, generated/catalog evidence, illustrative examples, and untested hypotheses. Qwen is a comparator, not ground truth.
- Existing ADR 0001 keeps Jev out of synopsis-only production scoring. This map can test the unmeasured enriched-evidence designs it explicitly leaves open; it does not overturn the ADR by starting a benchmark.
- Separate title knowledge, evidence extraction, query interpretation, and retrieval/ranking. Compare costs for equivalent complete outputs, including enrichment, retries, prose, embeddings/index updates, and cached/uncached query work.
- The 547-attribute JSON and gap recommendations are proposals. Treat core numeric scores, sparse concepts, presentation facts, scope/polarity, advisories, and human-facing summaries as separate representation choices.
- Preserve all existing evidence, including rejected approaches, missing captures, waivers, bad catalog identities, malformed trope URLs, and unrun ideas. Raw essence/trope data is not a gold standard.
- Skills: wayfinder; grilling and domain-modeling for human decisions; research for external facts; prototype for concrete comparisons. Research assets use a research/<name> branch with a context pointer from the ticket. Prototype tickets require live human review.
- GitHub native child issues and blocking relationships define the frontier. Claim a ticket by assigning it before work. Use the five standard triage labels, plus the relevant wayfinder type label.
- Agree on this program's budget, request limits, concurrency, review effort, and stop rules before paid calls. Earlier experiment budgets do not authorize new spend. Keep current production stores read-only during experiments.
- Stored TV Tropes material may be read locally. Follow docs/tvtropes.md: agents do not fetch TV Tropes pages with their own web tools. No new crawling is authorized by this map.

- All inventories, analyses, ideas, earlier benchmarks, prototype results, and limitations are indexed in [Fingerprint and discovery evidence](https://github.com/alp82/goodwatch-monorepo/blob/planning/fingerprint-discovery-v2-20261019/docs/design/fingerprint-v2/wayfinder/evidence-index.md); zoom into its source links when the ticket needs them.
- Predecessor work: [Optimize Windmill fingerprint quality and cost](https://github.com/alp82/goodwatch-monorepo/issues/27), [Implement the Windmill fingerprinting strategy](https://github.com/alp82/goodwatch-monorepo/issues/35), and the discovery/search lineage linked from the evidence index. Their resolutions retain their historical scope; do not infer current pricing, universal model quality, or V2 approval from them.

## Decisions so far

<!-- Empty for this new map. Earlier decisions and measurements are linked as source evidence, not silently re-resolved here. -->

## Not yet specified

- Which additional experiment branches will be justified by observed failures after the first controlled comparisons: finer evidence selection, selective escalation, learned mappings, model specialization, or different scopes.
- Which rare concepts deserve reliable structured extraction versus searchable evidence text once reviewed retrieval cases expose the useful boundary.
- Which parts of the eventual migration, monitoring, and user experience need a separate implementation map after the strategy is chosen.

## Out of scope

- Production provider switches, catalog-wide regeneration/backfills, schema/index rollout, merging or deploying prototypes, and changes to people's saved ratings or watch progress.
- New TV Tropes crawling or unapproved purchases, paid judges, inference, service provisioning, or account-policy changes.
- Declaring a provider winner from Qwen agreement, generated tags, synthetic query mappings, or a public general-purpose model benchmark alone.
