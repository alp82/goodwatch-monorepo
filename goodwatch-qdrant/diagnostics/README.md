# Offline backup-cycle diagnostics

Summarize the two sanitized journals retained by the reviewed backup-cycle observer and its memory-only Qdrant consumer. This utility reads local files only: no network access, queries, consumer signals, service changes or production file-path defaults. It is not installed in production.

```sh
python3 goodwatch-qdrant/diagnostics/report.py observer.jsonl consumer.jsonl > cycle-report.json
python3 -m unittest discover -s goodwatch-qdrant/diagnostics -v
```

Default output is descriptive: filesystem-reported data-extent changes, baseline/post/warm timings, ordered and sorted per-ID score comparisons, and fault/read/reclaim deltas. Direct Qdrant batches at or above 1,500 ms are flagged as remaining direct-batch tails. Lower values do not establish application first-results latency or seven-day acceptance; `productionAcceptance` is always false. Score-set changes require review for concurrent data updates, rather than proving a backup regression. Ordered changes remain separately visible.

An optional `--policy policy.json` accepts caller-selected nonnegative `maxResidentLossPages` and `maxKswapdStealPages` integers plus numeric `maxServerMs`. No policy is supplied by default. Exit 0 means complete descriptive evidence or within the selected policy; 1 means incomplete/incomparable evidence or policy failure; 2 means invalid input. A diagnostic policy is not a calibrated warm band or acceptance criterion.

Complete evidence requires successful media/reference phases, accepted advice, observed execution and consecutive backup absence, post-snapshot references, matching consumer waiting gates, post/warm controls, actual Qdrant PID continuity and complete baseline/post/warm batches for all three cycles. Missing controls fail closed. Changed file identities or data-extent page counts are incomparable. Matching file-identity hashes and page counts permit only a coarse comparison: the sampler does not retain SEEK_DATA/HOLE ranges or file contents, so concurrent range/content changes are not excluded. Raw changes remain visible without attributing loss; whole-file sparse-hole residency is excluded from comparisons.

Counter brackets include background work, organic traffic, signal delay and ten-second grace. Record timestamps are fences, not exact proc-read instants. The controller emits its control event after signal receipt, so consumer query-start timestamps may precede it. First post starts are fenced by post extent residency and the awaiting-post gate; warm starts by post-batch counters and awaiting-warm gate. No arbitrary clock tolerance is used. Kernel scan/steal/refault keys are reported individually, never summed across overlapping categories.

[Source audit](source-audit.json) pins the reviewed controller and report hashes. Splitting `/proc/PID/stat` after the final `)` gives state at index 0 (field 3), minor faults at index 7 (field 10), major faults at index 9 (field 12), and RSS pages at index 21 (field 24). RSS is multiplied by host page size. `read_bytes` is storage-layer I/O, not all logical reads. PID changes or counter resets invalidate deltas; RSS changes may be negative.

Nine behavioral fixtures cover golden numeric deltas, sparse-hole inflation, data-page loss, a 2.123-second tail, sorted score changes, ordered tie changes, changed identities/counts, missing controls, resets, incomplete runs, signal receipt races and privacy/error stripping. They validate reporting, not production remedy efficacy. No raw queries, IDs, vectors, credentials or unknown input fields are emitted.
