# First similarity-only Qwen test

2026-10-24. *Thank You for Smoking* (2005), unchanged title input and scope. Qwen3.8 Flash, explicit `alibaba/us-east-1`, reasoning disabled, strict JSON, 8,192-token output cap. Request: 70,612 bytes. Generation packet SHA256: `549441c57bd06b7364b1b79285bc6abc40483f297b13948bac626e715090e51b`.

| Selected similarity dimensions | Numeric | Zero | Positive | Null/missing |
|---|---:|---:|---:|---:|
| Original combined request, projected | 114 | 0 | 114 | 144 |
| Previous split requests, projected | 249 | 85 | 164 | 9 |
| New similarity-only request | **258** | **37** | **221** | **0** |

The first attempt succeeded; no retries or repair. The response and exported ordered score array pass their contracts. This establishes complete numeric output for this title and attempt, not factual quality or a deployed retrieval configuration.

- Attributed cost: **$0.002523**.
- Generation POST: **49.486 seconds**. Elapsed including billing reconciliation: **115.107 seconds**.
- Native usage: **8,266 input / 2,730 output**, zero cached/reasoning tokens.
- Against the 114 numeric selected fields in the original response: 62 changed, mean absolute change **0.667**, maximum 3.
- Against the 249 numeric selected fields in the split response: 152 changed, mean absolute change **0.815**, maximum 4.

These are score changes, not reference errors. The new recipe changes prompt, grouping, field count and envelope together. The prior complete split request cost $0.00815920 for all 554 scores and presence metadata; the new cheaper request delivers a smaller output. Combined similarity-plus-metadata cost remains unmeasured.

## Quality observations

All nine previously missing selected action fields received scores; no nulls were imputed. Useful anchors include satire 10, social critique 9, business 8 and parent–child centrality 6. Some low positive values need scrutiny: advanced technology 1 and dystopian society 2 could reflect overinterpretation. Larger shifts include adversaries cooperating 0→4, science 1→4 and fourth-wall breaking 8→5 versus the split response. None is automatically corrected or declared an improvement.

The number of selected zeros fell from 85 to 37, while positive scores increased. Completion alone should therefore not be treated as proof of better calibration. No metadata-generation request was made, and this response has no presence sidecar for a fresh cross-output consistency check.

Private evidence directory: `/home/alp/.local/share/goodwatch-benchmarks/tyfs-similarity-258-v1/results-v1/`, containing `REPORT.md`, `fingerprint.md`, `ordered-vector.json`, `selected258-before-after.csv`, `comparison.json` and `accounting.json`. The root independently checked coverage, overlapping-score arithmetic and the exported vector schema.

No production code, existing vectors or historical predictions were changed. All earlier unresolved charge holds remain preserved.
