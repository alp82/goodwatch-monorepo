**Verdict: PASS, no concrete blockers, with the material limitations below.**

I reviewed only the three pasted files by reading; nothing was run. My environment reports the model as `claude-opus-5-5`; I can't observe the effort setting. I had no pre-patch image, so "every old guard kept" is judged from the post-patch file alone. The 43 passing fixtures and the red-on-original result are taken as you reported them.

## Checked against scope

| Requirement | Finding |
|---|---|
| At most 16 members, from existing lists | Holds. `membership_ledger` takes `sorted(pids)[:16]` from the list `group_read` already parsed and does not re-read `cgroup.procs`. `ledger_evidence` re-enforces the cap. |
| Numeric PID, birth and fixed class only | Holds. Rows carry exactly `pid`, `startTicks`, `commClass`, `birthVerified`. Raw `comm` stays in memory, and oversized or non-UTF-8 `comm` falls to `unavailable`. |
| No argv, exe, path or env reads | Holds. The ledger reads only `stat` and `comm`, and starts no subprocess or query. |
| Original `source_changed` retained | Holds. `membership_failure` builds the `GuardFailure` first with the same counts and hashes, then each side's ledger is validated in its own `try`. The fallback is an empty, incomplete ledger, and the fallback expression cannot raise. `group_read` also swallows collector exceptions. |
| Old guards | Hold as far as the file shows. The 64-member, duplicate and source-PID checks, the VmLck sum, the membership-before-VmLck ordering, both fences, the reader proof, the census bounds and the `Output` caps are all present. The ledger is not in `result`, so normal rows are unchanged. |
| Birth race | Holds. Start ticks are read on both sides of the `comm` read; mismatch, zero, disappearance or parse error gives `unavailable` with the PID still retained. |
| Truncation | Holds. `truncated` is set when the list exceeds 16 and forces `complete` false. `membership_failure` cross-checks row count and the truncation flag against `processCount`. |
| 250 ms per side | Holds as a cooperative budget: checked before each member and again after its reads, and a late row is discarded. |
| Worst 8192 B frame | Holds. By my hand count a maximal verified row is 104 bytes compact, so 32 rows plus the fixed fields come to about 4 KB. The fixture measures with default separators, which is conservative. |

## Material limitations

1. **A short-lived member may still give no attribution.** The ledger runs after the VmLck, memory, CPU and PSI reads.
   - If the member exits before its `status` read, the existing path raises `sample_failed` with no ledger at all.
   - If it exits after that but before the ledger, you get its PID with `unavailable`.
   - Only a member that outlives the whole `group_read` gets a birth and class.

2. **The class has low discriminating power.** Anything outside the eight matched names is `other`, including `curl`, `wget`, `runc:[2:INIT]` and `python3.11`. `uv` is labelled `python`. Because `comm` changes on exec without changing start ticks, a member caught at join time can be classed `other` and become a shell a moment later. The numeric birth (new versus long-lived) is the more reliable signal.

3. **The 250 ms budget is not preemptive.** A single blocked `/proc` read cannot be interrupted, so the overrun is bounded by one member's three reads. The ledger runs on every `group_read`, not only on failure, so each sample can gain up to about 0.5 s. That makes `continuousCoverage` false more likely, never less.

4. **Lowest-PID selection favours old members.** Above 16 members, a newcomer with a high PID is the one most likely cut. This is irrelevant for the 1→2 case and is flagged by `truncated`.

5. **The six ledger keys bypass the `GuardFailure` allowlist.** They are added by mutating `error.diagnostic` after construction, so `EVIDENCE_KEYS` no longer describes the full failure schema and `ledger_evidence` is the only validator. Any strict downstream parser of `failed.v1` needs to accept the new keys; I could not see one.

6. **The ledger reaches `sample` and `finish` through `self._membership_ledger`.** This is correct today because `group_read` either raises or overwrites it before returning, but it is fragile to any future extra `group_read` call.

7. **Fixture gaps, none blocking.**
   - No case where the budget expires mid-list with earlier rows kept.
   - No non-UTF-8 `comm` case.
   - No assertion that other triggers carry no ledger keys.
   - `test_private_comm_and_argv_are_never_read_or_emitted` does read `comm`; only the "never emitted" half of the name is accurate.

Already disclosed in the doc and not counted against the patch: PID reuse before the first birth read, and non-atomic membership and birth reads.
