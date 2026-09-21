# Regeneration after highlight validation fix

Both affected production records have been regenerated and independently verified. The original invalid highlight keys are gone. This supersedes the original acceptance report's statement that The Matrix and Preacher still contain invalid highlights.

The owner requested regeneration after [Repair unknown DNA highlight keys before saving](https://github.com/alp82/goodwatch-monorepo/pull/46) merged and deployed. Read-back of deployed fetch hash `9fdf144252872980` matched the reviewed fix.

Both titles used normal premium routing to `openrouter:qwen/qwen3.8-flash@alibaba`, with no failure injection. Each successful generation was valid on its first response; no repair was needed on these runs. Immediate repair behavior is covered by the regression tests in the merged fix.

| Title | Verified stored highlights |
| --- | --- |
| The Matrix | `futuristic`, `technology_and_humanity`, `visual_stylization`, `cinematography`, `philosophical`, `spectacle`, `intrigue`, `pop_culture` |
| Preacher | `spiritual`, `dark_humor`, `absurdist_humor`, `violence`, `eccentricity`, `novelty`, `dialogue_quality`, `surrealism` |

[Stored-record verification](regen-verified-job.json) checked the exact 74 integer scores in range, 4–8 unique valid highlight keys, 8–10 distinct tags, schema validity, finite 768-dimensional essence vectors, fingerprint vectors matching scores in schema order, provenance, cleared failure fields and unselected state. Both stored records passed. The generation schedule remains disabled and no spend pause is active.

## Costs and execution evidence

- Successful generation responses logged **$0.001377894** in total.
- The first Matrix attempt received an actual upstream **429 rate-limit error**, with no generation ID, no choices and no usage.cost. Its full **$0.009492840** reservation remains retained, not recorded as a measured charge or assumed zero. [Captured error](regen-matrix-evidence.json).
- The harness initially stopped on missing usage. It was adjusted to pass HTTP errors to the deployed retry/pause handling while retaining their reservations; successful responses missing cost still stop the run. This changed only the operational preview harness, not production code.
- Conservative new embedding bound: **$0.000342000**, using UTF-8 bytes plus framing and the previously verified $0.20/million-token text rate. It is not a billing measurement.
- Regeneration accounting including the retained reservation and embedding estimate: **$0.011212734**. Combined with the original acceptance bound, this remains below the original $0.05 ceiling.

[Matrix generation and embedding](regen-matrix-retry-evidence.json), [Preacher generation and embedding](regen-preacher-evidence.json), [machine-readable summary](regen-summary.json). The pre-run snapshot retains both prior records, including vectors, in [regen-before-job.json](regen-before-job.json).

The original failed acceptance evidence remains intact. Actual monthly guardrail wording and the earlier unlogged fallback charge remain unresolved; this regeneration does not close acceptance or waive those gates.
