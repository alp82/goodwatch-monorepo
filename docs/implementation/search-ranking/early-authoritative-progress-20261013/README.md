# Earlier authoritative title and person progress

Strong existing title and person matches can be delivered before language/reading and the original hybrid ranking finish. Both clients preserve same-request streamed chips, label partial results honestly, and update the acknowledged provisional packet with the original full ranking. Description-only approximate ranking is outside this change.

The original 1,500 ms rank deadline and original promise remain. Only after a provisional packet is acknowledged can a missed deadline finish that same promise within a separate 15-second completion cap. The cap includes final display/catalog/reblend computation; the final taste and delivery paths retain their own existing bounds. Successful recovered completion does not claim a basic fallback. No extra reading or ranking request is added.

## Review and validation

All implementation, design and frontend/UX edits were authored through actual Claude Code Opus 5.5 medium with local Read/Edit/Write tools only. The immutable initial design report identified seven blockers. The final tools-disabled Opus review accepted the 52-file frozen V3 source with no mandatory blocker. This is a source-paper review: the model did not run tests or inspect production. The raw review JSON and provenance record the actual model, effort, CLI exit, duration and prompt/source hashes.

- Full affected cohort: 139 tests pass in 57.875 seconds.
- Production Remix/Vite build and precompression: exit 0.
- Exact TypeScript comparison against clean `7aba68aac4494ef1162474c2c363e0b3553a14df`: 212 existing diagnostics on each side, none added or removed; both commands exit 2 because those pre-existing errors remain.
- The V2 verification initially found 10 introduced fixture-only type errors. V3 changes only a typed test accessor, with no runtime/assertion/timing changes; the affected real ranking-progress test passes. Production source bytes equal the V2 full-cohort/build source.
- Independent backend follow-up verified all 52 bindings and found no new concrete blocker, with the scoped ownership limits below.

`manifest.json` binds the supplied frozen code to repository webapp-relative paths. `validation.json` binds the complete locally retained test/build/typecheck outputs; those full local logs and the 824 KB exact review prompt are retained outside Git. This evidence publishes the final report/raw model result/provenance, original design verdict, exact diagnostic-set comparison and the narrow test correction. It does not claim that absent local logs are reproduced by reading their hashes.

## Scope and rollout limits

Delivery acknowledgement controls first-results/history accounting. Late display and actual per-table catalog reads retain the admission slot through tracked sibling settlement. Initial people enrichment is held or prevented on early refusal. This does not establish drainage of pre-late catalog type-query siblings, process-shared credit-cache sibling loads after the awaited people step settles, or physical SQL continuing after HTTP abort. Late failure ranker diagnostics retain existing naming; completion-failed/aborted fields distinguish them.

Journey and Discover both render actionable people-only partials; allTitles does not hide those people. Final order can differ from the initial named list, and existing alternate-cut folding, taste, watchability and results-fetch behavior remain. Existing tabs with the old UI can mask streamed chips until final, retain a checking-title label during ranking, or show an older empty cue after a people-only partial failure. PAGE-first rollout helps fresh clients but does not force old tabs to refresh.

No production latency target or traffic coverage is established by this source change. Rollout and the landing-page budget check remain subsequent root-owned steps. Tracked in #100 and #407; #406 stays closed.
