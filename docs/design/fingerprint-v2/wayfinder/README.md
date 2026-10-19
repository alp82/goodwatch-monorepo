# Benchmark a richer fingerprint and discovery system

This is the complete review packet for a new GitHub wayfinder map. Its destination includes bounded benchmarks and prototypes that inform decisions, followed by a strategy/implementation handoff. It does not authorize production rollout or new paid calls before experiment limits are agreed.

The owner approved this breakdown and publication, with an explicit preference for bounded grilling. The canonical map is published as a GitHub issue; its URL is recorded in the publication manifest once created. [Exact map body](map.md), [publication manifest](manifest.json), and every child body below are prepared now. All current inventories, analyses, ideas and measured/historical results are reachable through [the evidence index](evidence-index.md). The model/scale/output choices remain open questions, not implied selections.

## Proposed decision tickets

| Ticket | Type / participation | Blocked by |
|---|---|---|
| [Choose the benchmark goals, quality gates, and experiment limits](tickets/goals.md) | grilling / HITL | Unblocked |
| [Capture the current baseline and audited evidence bundle](tickets/baseline.md) | task / AFK | Unblocked |
| [Research current Jev alternatives and their knowledge and output contracts](tickets/providers.md) | research / AFK | Unblocked |
| [Choose the title corpus, evidence arms, and reference judgments](tickets/corpus.md) | grilling / HITL | Choose the benchmark goals, quality gates, and experiment limits; Capture the current baseline and audited evidence bundle |
| [Choose attribute representations and scoring scales to compare](tickets/representations.md) | grilling / HITL | Choose the benchmark goals, quality gates, and experiment limits; Capture the current baseline and audited evidence bundle |
| [Choose what happens to essence text, tags, highlights, and other outputs](tickets/extras.md) | grilling / HITL | Choose the benchmark goals, quality gates, and experiment limits; Capture the current baseline and audited evidence bundle |
| [Prototype movie knowledge and evidence extraction against Qwen](tickets/knowledge-prototype.md) | prototype / HITL | Research current Jev alternatives and their knowledge and output contracts; Choose the title corpus, evidence arms, and reference judgments; Choose attribute representations and scoring scales to compare; Choose what happens to essence text, tags, highlights, and other outputs |
| [Prototype mixed-scale and sparse fingerprints](tickets/scale-prototype.md) | prototype / HITL | Research current Jev alternatives and their knowledge and output contracts; Choose the title corpus, evidence arms, and reference judgments; Choose attribute representations and scoring scales to compare |
| [Prototype extra-output generation, derivation, and reuse](tickets/extras-prototype.md) | prototype / HITL | Research current Jev alternatives and their knowledge and output contracts; Choose the title corpus, evidence arms, and reference judgments; Choose what happens to essence text, tags, highlights, and other outputs |
| [Prototype discovery retrieval and query interpretation](tickets/discovery-prototype.md) | prototype / HITL | Prototype movie knowledge and evidence extraction against Qwen; Prototype mixed-scale and sparse fingerprints; Prototype extra-output generation, derivation, and reuse |
| [Prototype fingerprint and exploration displays with the new representations](tickets/display-prototype.md) | prototype / HITL | Prototype mixed-scale and sparse fingerprints; Prototype extra-output generation, derivation, and reuse |
| [Run a frozen holdout comparison of the selected approaches](tickets/holdout.md) | task / AFK | Prototype movie knowledge and evidence extraction against Qwen; Prototype mixed-scale and sparse fingerprints; Prototype extra-output generation, derivation, and reuse; Prototype discovery retrieval and query interpretation; Prototype fingerprint and exploration displays with the new representations |
| [Choose the fingerprint and discovery strategy and implementation handoff](tickets/strategy.md) | grilling / HITL | Run a frozen holdout comparison of the selected approaches |

## Initial frontier

The first independent work is choosing goals/limits, capturing the current baseline, and researching current candidate contracts. The remaining dependencies are explicit in the manifest and will be represented by native GitHub blocking edges. Prototype tickets require live human review; AFK execution runs only their already selected protocols.

## Publication

The intended asset branch is `planning/fingerprint-discovery-v2-20261019`. Local source files will be committed on an isolated branch for durable GitHub links when publication is approved. A new parent issue and 13 native child issues will be created, then their blocking edges wired in a second pass. The map lists decisions only after they resolve; its open children are queried through GitHub.

Repository rule: [issue tracker](../../../agents/issue-tracker.md) says, “Do not publish until the ticket breakdown is approved.” The owner approved this packet. No new paid experiment is authorized by publication.

## Bounded grilling

Keep grilling bounded: ask at most three consequential questions in an initial round, with recommended defaults. Ask a followup only if an answer blocks the next benchmark/prototype or materially changes cost, quality, or scope. Use provisional defaults for reversible details; defer refinements until results reveal a need. Stop once the next experiment can run responsibly. Do not require an exhaustive taxonomy, final architecture, or every attribute decision before a first useful comparison.
