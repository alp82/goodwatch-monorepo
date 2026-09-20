# Reproduce the cheap review

Open [cheap-loop-review.html](cheap-loop-review.html) locally. Original 13 requests default to corrected D4+ versus combined English; promising candidates are selectable. Search variants by name or family. Round history retains full variant families, including all 75 shortlist arms and 80 hygiene comparisons. Posters load from TMDB; click to view original-size imagery and Escape to close. User judgments export separately.

From the repository root:

```sh
bash goodwatch-webapp/scripts/prototype-crate-evidence/render-cheap-loop-review.sh
```

This reads existing private frozen runs and creates compact `cheap-loop-results.json`, standalone HTML and the current cheap-loop spend ledger. It performs no database or model calls. Private inputs must already exist; public display data is sufficient to use the HTML without those files.

`cheap_loop_adapters.py` adapts native SQL, shortlist, cleanup and paired-interpretation captures. `cheap_loop_report.py` preserves all 78 original ranking orders and deduplicates source/evidence dictionaries. Use `--review ROUND JSON` for additional independent review files. Original controls are never replaced by later fresh controls. No winner is inferred from recency or ranking scores.

Current findings document a practical stop after structural conjunction, supplemental, paired-input and normalization reviews; no global winner is accepted. See [the evaluation protocol](cheap-loop-protocol.md) and [findings](cheap-loop-findings.md).
