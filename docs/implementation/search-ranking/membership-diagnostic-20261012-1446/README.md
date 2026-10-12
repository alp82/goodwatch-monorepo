# Membership diagnostic stopped on a disappearing member

For [map #100](https://github.com/alp82/goodwatch-monorepo/issues/100), the once-only 180-second diagnostic planned for 14:46:16–14:49:16 UTC on 12 October 2026 stopped at 14:46:46.065594 UTC. It retained 15 samples (0–14) and failed with the unchanged `source_changed` guard, trigger `sample_membership`, phase `after_sample`. This is failed/UNKNOWN observation coverage, not a completed backup window or a capacity/latency result.

The new bounded diagnostic ledger captured two members before the sample and one afterward. Qdrant PID 3411704, start ticks 2673362807, appears in both. The extra PID 1349446, start ticks 2826873317, was classified `other` with birth verified in the before ledger and is absent afterward. Both retained ledger sides report complete and not truncated. These bracketed membership records are not atomic. A fixed comm class proves neither executable nor process purpose; this record does not establish that the member was a health check, nor that it caused the earlier 14:12 failure.

The reader PID 1347722, start ticks 2826869015, exited with code 1 and was proven gone. No TERM or KILL was sent. The receipt reports zero remote host files; the recorder retained one local journal and also exited 1. Reader disappearance is proven, while clean reader exit is false. The [exact journal](membership-diagnostic-actual-20261012-v3.jsonl) contains 19 frames and 70,921 B, SHA `40566c81bc79370b3c2bd223e2dddcab1e7e50b64b9ae4b927c00cc1488980a5`.

Both frozen offline auditors preserve UNKNOWN coverage. Their existing checks require start/complete events and clean lifecycle proof; the retained failure record therefore also produces structural problems such as missing terminal/start proof and event order. These audit problems do not identify additional runtime causes. See [strict combined audit](strict-combined-audit.json), [numeric audit](strict-numeric-audit.json) and [failure summary](failure-summary.json).

Root executed the reader once after the retained [fresh source fence](fresh-source-fence-20261012-v3.jsonl), using the ledger source merged in PR #495. The source-code digest `17e692…` differs from source configuration identity `921098…`. Exact inputs, fresh-fence hash and the proposed duration remain in the [execution descriptor](root-execution-actual-20261012-v3.json) and [plan](SHORT-DIAGNOSTIC-PLAN-v3.json). The preflight explicitly does not independently establish the next scheduled backup; this short diagnostic was not a full backup measurement.

No guard was relaxed and no automatic retry occurred. This step includes no ordinary searches, provider/model calls, Crate writes, pinning, cache advice or source resource changes. It establishes no future headroom ceiling or production acceptance. Issue #406 remains closed as an issue status; #407 and map #100 still require the agreed rollout and seven-day evidence.

## Reproduction and provenance

[Provenance](provenance.json) pins exact actual artifacts and byte-identical transport/auditor sources. The six copied source/fixture files are under `goodwatch-qdrant/diagnostics/resource-window-membership-v3`. They retain the original frozen local source/transport path bindings; transport files are historical execution evidence, not instructions to rerun. No private source contract, credentials, model data, query packets or raw process argv are included. The execution descriptor contains only public preparation paths and fixed reviewed invocation inputs.

Run the strict combined audit locally from the repository root:

```sh
python3 -I -B goodwatch-qdrant/diagnostics/resource-window-membership-v3/audit_transport_membership_v3.py docs/implementation/search-ranking/membership-diagnostic-20261012-1446/membership-diagnostic-actual-20261012-v3.jsonl
```

The numeric report was derived by passing the four numeric event types to the frozen numeric auditor with the final external reader-exit receipt. All eleven existing local fixtures cover transport and audit behavior; this documentation step adds no runtime code change or new host action.
