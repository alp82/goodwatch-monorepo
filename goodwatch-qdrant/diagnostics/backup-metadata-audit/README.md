# Offline backup metadata audit

This utility reads two explicitly supplied sanitized journals. It performs no network or host operations. Run from this directory:

```sh
python3 -B audit_paired.py --metadata /path/to/metadata.jsonl --supplemental /path/to/supplemental.jsonl
python3 -B -m unittest test_audit_paired.py
```

The scheduled window is the historical 2026-10-12 07:09–07:29 UTC window. Timing, same-sample archive/copy peaks and interval counters are descriptive. An empty or truncated existing-segment baseline invalidates growth coverage even when a producer summary reports complete. Raw incomparable deltas remain separate from valid peaks. The utility never establishes a future ceiling, latency result or production acceptance. Counter names are whitelisted; unrecognized private fields are dropped.

The eight fixtures cover missing/cohort-truncated evidence, generation changes, live readers, unknown private fields and independent maxima that never overlapped. Executed source hashes and exact input hashes are retained in the accompanying implementation evidence.
