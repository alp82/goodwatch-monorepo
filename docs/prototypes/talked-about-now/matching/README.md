# Title matching spike — throwaway, issue 544

Question: how reliably can public discovery items be linked to the production movie/show catalog?

This is a data experiment, not an application feature. Production access is restricted in the script to Crate SELECTs and Qdrant point queries/retrieval. It does not import webapp search, Windmill connectors, Redis, or any cache-writing code. Never run the webapp to reproduce this experiment.

## Round two: renderer handover

The improved foreground/context matcher and its **fresh 200-item benchmark** are in [results-round2.md](results-round2.md). [matches.json](matches.json) is the data input for the separate title-page prototype; this branch builds no review page. [matches.schema.json](matches.schema.json) specifies title IDs, source posts, lanes, confidence, discovery provenance and manual right/wrong/unsure labels. Dates and acquisition limits are embedded in the JSON.

For the committed evidence, run `python round2_publish.py metrics` and `python round2_verify.py` offline. Rebuilding the Markdown report uses `python round2_publish.py report`. Export metadata hydration uses read-only production SELECTs.

For a **new** experiment, use a separate snapshot directory and freeze new rules before collecting/selecting/annotating a new holdout. `round2_collect.py collect` obtains dated channel/RSS/public Bluesky search history; `sample` selects a disjoint, date-stratified holdout. Author `round2/label-intents.json` independently, resolve identities with `round2_labels.py prepare`/`resolve`, then run `round2_matcher.py extract`, `candidates`, `vector_fallback`, `run` sequentially and `round2_publish.py metrics`, `export`, `report`. Round-two API calls require a usable existing `OPENROUTER_API_KEY`; no key or call failure stops that stage rather than generating fake output. Candidate caches and per-stage snapshots resume the **same fixed corpus** only; never reuse them for changed inputs. Frozen rules and labels have separate pre-decision commits.

Round-two source coverage is bounded historical search rather than Jetstream: see the report before interpreting counts as activity. Its fresh YouTube cohort is Netflix-only. Original round-one fixtures and measurements below are preserved.

## Run

```bash
python -m venv .venv
.venv/bin/pip install -r requirements.txt
export MATCHING_ENV_FILE=/path/to/existing/goodwatch-webapp/.env
.venv/bin/python spike.py feeds
.venv/bin/python spike.py jetstream --hours 3
.venv/bin/python spike.py catalog
.venv/bin/python index_catalog.py
.venv/bin/python spike.py sample
.venv/bin/python match.py
.venv/bin/python verify.py
.venv/bin/python evaluate.py
```

A new collection produces a **new** sample: annotate that sample manually before running the matcher. The checked-in `annotations.json` and `labels.json` are valid only for the checked-in `sample.json`. Do not reuse labels by ordinal ID on newly collected data. Remove local prediction/verification files before running a new sample; the script resumes by item ID within the fixed sample only.

For the checked-in experiment, `python evaluate.py` is offline and uses only the committed sample, labels, predictions, and verifier responses. It does not require credentials or the full catalog snapshot. `python evaluate.py --gold` resolves the human annotations against the local catalog index and is only for rebuilding labels, not normal evaluation.

`match.py` uses the production fp32 Xenova multilingual-e5-small model pinned to the webapp revision and checks both model and tokenizer SHA-256 hashes. The 470 MB model and 1.5-million-title local snapshot/index are ignored. The small union of matcher candidates and the hand-checked label identities are committed for review. OpenRouter uses the repo's `OPENROUTER_API_KEY` convention and `openai/gpt-4.1-mini`, temperature 0, constrained catalog IDs plus `none`. Without a key, the LLM step records a skip.

## Files

- `spike.py`: feed/Jetstream collection, read-only production adapters, deterministic sample.
- `index_catalog.py`: disposable local SQLite index.
- `match.py`: official video crosswalk, lexical title/year candidates, vector candidates, waterfall LLM fallback.
- `verify.py`: diagnostic alternative that asks the same LLM to verify early accepts, keeping exact official video crosswalks.
- `evaluate.py`: precision, item recall, candidate recall, Wilson intervals, observed inference charges.
- `data/annotations.json`: independently authored manual title/version notes, including ambiguity reasons.
- `data/labels.json`: resolved reference IDs, catalog misses, annotations.
- `data/sample.json`: the fixed 170-item evaluation sample, with canonical URLs and bounded source context.
- `data/predictions.json`, `data/verified.json`: per-stage decisions, candidates, model responses, usage and costs.
- `data/feeds-audit.json`, `data/jetstream-audit.json`: acquisition evidence and window limitations.
- `results.md`: measured answer and recommendation.

RSS feeds are rolling windows, not archives. Deduplication is by canonical item URL across overlapping feed categories. The feed window is the trailing 24 hours at collection. YouTube RSS exposes recent uploads, not a 24-hour archive; the sample is the 50 newest from the collected eight-per-channel pool. Bluesky uses post creates/updates and removes observed deletions, filters post publication time to the requested window and event time to the replay window, excludes explicitly tagged languages other than English/German and `!no-unauthenticated`, and retains untagged posts. Keyword filtering is deliberately broad and is measured as part of the noise. Replay gaps are recorded, not treated as a complete firehose census.

The linked issue and primary inputs are documented in results.md. This branch is an evidence snapshot; do not merge the spike into production.
