# Jev scoring experiment

Run date: September 17, 2026. Model: `jev-1.13.0` (TypeSafe System One). Total spend: about $0.17 at $0.042 per million input tokens. Output tokens are free.

This experiment tests whether Jev can produce the 74 fingerprint scores for the ten frozen benchmark titles. Jev doesn't generate text, so `essence_text` and `essence_tags` are out of scope. Qwen baselines come from the recorded first pass and repeat runs. No Qwen requests were made.

**Conclusion: Jev is fast and batch-stable, but its scores are not usable as a Qwen replacement with synopsis-only input.** Jev reads the state literally and shows no title knowledge. Cost is about the same as Qwen3.8 Flash, not lower.

## Arms

- `l10`: one Score question per trait, a shared ten-level ladder, mapped to 0-10 with `round(score * 10 / 9)`.
- `l6`: the same with a six-level ladder, mapped with `round(score * 2)`.
- `pres`: one Noul presence question per trait. `mean_gated` forces 0 when presence is under 0.5.
- `l10-blind`: `l10` with the title and year removed from the state.
- Batch sweep: `l10` with 1, 2, 5, 10, 20, 37, and 74 questions per request, then 148 and 222 questions per request.
- `fanout16`: small batches sent 16 at a time. `parallel-titles`: ten titles at once.

## Scoring differences

All rows compare 740 cells (10 titles x 74 traits) against the reviewed Qwen3.8 Flash (F) first pass.

| Comparison | Mean abs delta | Deltas of 3 or more | Median rank correlation | Highlight overlap |
|---|---:|---:|---:|---:|
| F repeat vs. F (noise floor) | 0.51 | 10 | 0.96 | 0.70 |
| D (Qwen3.7) vs. F | 0.82 | 36 | 0.94 | 0.66 |
| Jev `l10` vs. F | 2.65 | 341 | 0.79 | 0.49 |
| Jev `l6` vs. F | 2.65 | 326 | 0.77 | 0.46 |
| Jev `l10-blind` vs. F | 2.40 | 295 | 0.78 | 0.41 |
| Jev `l10` gated vs. F | 4.25 | 451 | 0.40 | 0.41 |

- Jev scores average 2.5 points lower than F. The gap is largest for traits that a synopsis can't show: `editing` (-7.1), `music_composition` (-6.7), `dialogue_quality` (-6.5), `acting` (-6.2), and `cinematography` (-5.7).
- Removing the title changes scores by only 0.73 on average and doesn't hurt agreement with F. Jev judges the synopsis text, not the title.
- Traits that the synopsis states come out well. For The Matrix, `futuristic`, `technology_and_humanity`, `spectacle`, and `adrenaline` are within one point of F.
- Using the most likely level in place of the probability-weighted mean is worse. The presence gate is much worse.
- Median confidence is 0.48, and 51% of answers are under 0.5.

## Batch size

Answers don't depend on the batch size. Every batch size differs from the 74-question request by about 0.09 levels on average, which equals the difference between two identical 74-question runs. Jev is close to deterministic but not exactly.

| Questions per request | Requests per title | Median seconds per title | USD per 1,000 titles |
|---:|---:|---:|---:|
| 1 | 74 | 22.3 (2.1 with fan-out) | 1.90 |
| 2 | 37 | 11.6 | 1.34 |
| 5 | 15 | 4.7 (0.9 with fan-out) | 1.00 |
| 10 | 8 | 2.4 (0.8 with fan-out) | 0.90 |
| 20 | 4 | 2.3 | 0.84 |
| 37 | 2 | 1.9 | 0.81 |
| 74 | 1 | 0.8 to 1.4 | 0.79 |
| 148 (`l10` + `pres`) | 1 | 0.8 | 1.05 |
| 222 (`l10` + `pres` + `l6`) | 1 | 1.5 | 1.58 |

Larger batches are cheaper because each request repeats the state and fixed overhead. Most of the cost is the question text itself, so the saving levels off after about 20 questions. No request failed or needed a retry across about 2,000 requests.

## Speed and cost against the baseline

| Config | USD per 1,000 titles | Median seconds per title | Output |
|---|---:|---:|---|
| F: Qwen3.8 Flash | 0.85 | 19.2 | Full fingerprint |
| D: Qwen3.7 Flash | 0.34 | 12.8 | Full fingerprint |
| Jev `l10`, 74 per request | 0.79 | 0.8 to 1.4 | Scores only |
| Jev `l6`, 74 per request | 0.55 | 0.7 | Scores only |

Ten titles sent in parallel finished in 2.0 seconds.

## Limits of this experiment

- Ten titles, one question wording per design. Different instructions or trait-specific levels could shift the results.
- Enriched state (reviews, keywords, long plot summaries) was not tested. The blind result suggests that enriched state is the only path to better Jev scores.
- Qwen is a reference, not ground truth. The owner's review rated F strongest, so large disagreement with F is treated as a defect.

## Reproduce

The scripts read the frozen benchmark inputs and the Qwen baselines under `docs/benchmarks/fingerprint/`. Those files live on the `validation/fingerprint-repeat-cost` branch and aren't on `main`, so run the scripts from a checkout that includes that branch.

```bash
python goodwatch-flows/windmill/f/dna/prototype_comparison/jev_run.py --stage sweep
python goodwatch-flows/windmill/f/dna/prototype_comparison/jev_report.py
```

Stages: `sweep`, `designs`, `mega`, `repeat`, `fanout`, `throughput`. The key lives in `private/experiment.env`, which git ignores together with the raw captures. `results.json` holds every metric and `scores.json` holds the mapped scores.
