# Evidence-search experiment loop

This is a disposable benchmark, not a production search implementation. The frozen sample contains 50,000 titles. Review artifacts live in [`docs/prototypes/crate-evidence/`](../../../docs/prototypes/crate-evidence/); raw inputs, model responses, caches, and intermediate rounds live in the ignored `private/` directory beside these scripts.

## Final pipeline configuration

The final candidate uses the unchanged D4+ Jev interpretation alongside a **Gemini 3.1 Flash Lite planner**, a 24-candidate union of semantic and existing retrieval sources, and **Gemini 3 Flash Preview ranking with packing v3 and IDs-only v3 output**. The IDs-only completion cap is **4096 tokens**, with explicit **minimal reasoning**; this is a shared allowance, not a claim that thinking is disabled. Returned reasons and scores are `null`; independent assistant assessments are separate from model output.

**CLI defaults retain earlier experiments.** Always specify the model, packing, round, and IDs-only flags shown below. `model_pipeline.plan_request()` also retains its historical 2.5 Lite default; call it with `model="google/gemini-3.1-flash-lite"` when reproducing the final planner. The validation/confirmation runner selects this planner explicitly.

Run commands from `goodwatch-webapp/`. Python needs the existing `requests` and `python-dotenv` dependencies; Node capture uses the normal webapp dependencies. `--env` points to the existing webapp dotenv containing Crate connection settings. OpenRouter reads `OPENROUTER_API_KEY` from the environment or `MODEL_PIPELINE_ENV`; the prototype also supports the existing local root dotenv fallback. Never publish these files or key values.

### Capture unchanged interpretation inputs

Capture only deliberately frozen request files. This invokes the existing Jev implementation without changing its questions and reuses already captured entries.

```sh
node_modules/.bin/esbuild scripts/prototype-crate-evidence/loop-capture.ts --bundle --platform=node --format=esm --target=es2022 --packages=external --alias:~=./app --outfile=scripts/prototype-crate-evidence/loop-capture.mjs
node scripts/prototype-crate-evidence/loop-capture.mjs ../docs/prototypes/crate-evidence/loop-confirmation.json scripts/prototype-crate-evidence/private/loop-confirmation-interpretations.json
```

### Reproduce the development configuration

Use a new output path to preserve frozen comparisons. This reuses the final 3.1 planner artifact and existing development Jev captures, performs current retrieval, and uses cached identical model calls when available.

```sh
python scripts/prototype-crate-evidence/loop_runner.py --env /path/to/webapp/.env --round 3 --plans scripts/prototype-crate-evidence/private/model_pipeline/development13-plans-v7-model31-validated.json --rerank-model google/gemini-3-flash-preview --packing-version 3 --ids-only --minimal-reasoning --planned-only --limit 13 --output scripts/prototype-crate-evidence/private/reproduction-development.json
```

### Run the frozen confirmation configuration

Keep confirmation requests fixed. Once a set informs tuning, it is no longer untouched validation.

```sh
python scripts/prototype-crate-evidence/loop_runner.py --env /path/to/webapp/.env --round 3 --challenge --interpretations scripts/prototype-crate-evidence/private/loop-confirmation-interpretations.json --split confirmation --rerank-model google/gemini-3-flash-preview --packing-version 3 --ids-only --minimal-reasoning --planned-only --limit 12 --output scripts/prototype-crate-evidence/private/reproduction-confirmation.json
```

The additional fresh eight-request set uses `loop-final-validation.json` and `private/loop-final-validation-interpretations.json`; substitute that interpretation path and `--limit 8`, keeping a distinct output path.

For a model-only comparison, `--replay-source` accepts existing round-3 report paths. It reuses saved plans and candidate pools, applies the shared validated media/format gate, and records any exclusions. Supply the same explicit model/packing/IDs/minimal-reasoning flags. A changed gate can change a historical pool: inspect recorded provenance rather than assuming the candidate set is identical. `--resume` skips successful cases; `--no-cache` deliberately incurs fresh model calls. Neither is an automatic retry policy.

## Data and evidence boundaries

Loop runners and retrieval variants read the approved scratch table, **`doc.prototype_search_evidence_104_v1`**, and source catalog data used by controls. They do not write catalog data, alter production search routes, or run cleanup. The earlier `experiment.py load/expand` and documented setup/expansion SQL are the write paths; do not rerun them merely to benchmark. Cleanup drops only the named scratch table when separately authorized. The original write scope and snapshot provenance are documented in the main prototype README.

Packing v3 retains bounded essence/synopsis prefixes, at most 500 characters of deduplicated compact tags, and requested fingerprint dimensions or a compact neutral panel. Omitted evidence is unknown, never proof that unwanted content is absent. Omission diagnostics live outside the model payload. Shared media/format checks apply to imported candidate sources too; unknown format remains flagged rather than guessed. Semantic exclusions and ending suitability still require evidence assessment. Mood-only retrieval over the local fingerprint snapshot is not Qdrant or full-catalog vector search.

## Timing, caching, failures, and spend

- **Startup:** sample loading and index initialization are separate from per-request measurements.
- **Captured Jev:** attributes and reading run concurrently. Their recorded maximum stage duration is a reconstruction, not a newly measured whole-page latency.
- **Cold search projection:** combines recorded planner/Jev work, measured retrieval, and original uncached reranker time along the reported critical path. It excludes UI rendering and full-product vector fill.
- **Current execution:** cached calls may take milliseconds. `cache_hit`, `original_wall_ms`, and `original_cost_usd` prevent those lookups being mistaken for fresh inference.
- **Actual new spend:** a cache hit costs zero new model spend. Per-search projected costs reuse upstream measurements across variants and must not be summed as the experiment bill.

Every received OpenRouter response is preserved as a private `model_pipeline/attempt-*.json`, including paid invalid outputs and superseded experiments. `PipelineError` carries observed failed-call metrics and the artifact path. Unknown transport billing stays unknown; failed model-stage timing does not establish full-search timing. The 300-token IDs-v1 and 900-token IDs-v2 failures remain historical evidence. IDs-v3 requests `reasoning.effort=minimal` and a 4096-token allowance, with no silent fallback. Google may still use reasoning at minimal effort.

`audit_loop_metrics.py` audits local artifacts without provider calls. `--apply` updates explicitly supplied reports and their raw case copies; run only after those writers finish. The public `spend-summary.json` deduplicates saved attempts by generation ID, includes failures/superseded calls, and states its Jev coverage and refresh time. Refresh it after the final provider call before reporting total spend.
