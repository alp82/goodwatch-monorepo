# Native OpenRouter overflow benchmark

[Measured comparison and decision](../../../docs/benchmarks/search-interpretation-openrouter-2026-11-12.md). [Full protocol and evidence](overflow-2026-11-12/README.md).

This compares ten hosted native decision models with the production JEV control. The owner receives $5 of free TypeSafe usage per cycle renewing on the 17th; paid model costs describe overflow after that allowance. Quality and speed have equal weight, with explicit quality/exclusion/deadline gates before a recommendation. No production routing changes are included.

## Offline checks

From the repository root with Node 24 and webapp dependencies installed:

```sh
node --test goodwatch-webapp/scripts/interpretation-bench/{bench,overflow-run}.test.mjs
node goodwatch-webapp/scripts/interpretation-bench/overflow-run.mjs \
  --config=goodwatch-webapp/scripts/interpretation-bench/overflow-2026-11-12/admitted-config.json
node goodwatch-webapp/scripts/interpretation-bench/overflow-report.mjs
```

The first command uses local fixtures. The second prints a plan only. The third regenerates the retained comparison from compressed raw records without inference or databases. Neither plan nor report generation loads `.env` or uses API credentials.

## A new paid run

`overflow-run.mjs --execute --config=... --out=/a/new/directory` uses explicitly supplied `OPENROUTER_API_KEY` and `TYPESAFE_API_KEY`. It reserves locally before dispatch, records every actual charge/unknown exposure durably, disables fallback/retries, validates canonical model identity and native answers, and separately confirms gated finalists at concurrency one and four. Read and choose the budget in the configuration before execution. The local guard is not a provider-enforced per-run cap, and must not change a shared production key's limit. Direct JEV control usage consumes the existing allowance rather than additional cash while covered.

`admitted-config.json` contains the ten models and the adapter profiles established by the measured compatibility probes. The retained `config.json`, `adapted-config.json` and `remainder-config.json` preserve earlier profiles/failures; use the admitted configuration for a fresh comparison. Do not silently overwrite an existing output directory or assume a future provider/version has unchanged question limits. Finalist selection is conditional on the new run's observations, so it may differ from the archived experiment.

The dated experiment was staged to diagnose provider limitations. Its original/adapted/serial runs, manifests and exact executed source snapshots are retained. `overflow-confirm.mjs` performed additional repeats for the two materially cheaper candidates after the first phase's diagnostic repeats; the comparison merges only matching successful serving profiles. Blinded inputs and independent AI-assisted intent reviews supplement the partial author-written assertions. They are not human or ranked-result acceptance.

The common contract/scorer and regression fixtures came from the earlier `bench/jev-local-models` work. Historical chat configuration exists only for inherited offline regression tests and requires explicit legacy execution in the old runner. All paid challengers in this experiment used the native Decisions API. `export-replay.mjs` can prepare matched reading captures for a separate frozen-catalog relevance experiment; it performs no inference or database reads.
