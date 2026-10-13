# CPU0 consumer source preparation

This adds a separate consumer, strict comparison contract, offline auditor, and direct HTTP transport for the owned-lifecycle CPU0 clone packet. It preserves the merged fourteen-file backend freeze and prior CPU2 sources. The default consumer entry reports prepared-only. No host stage, queries, model capture, production helper, or latency experiment ran as part of this publication.

The real paired-row builder now retains both observed controller exits and socket-close facts. The consumer requires fresh entry preflight before reading private input, authenticates the predecessor handoff, checks its own birth, and waits for committed handoff, release, unpin completion, and controller exit before advancing. Failure projection retains validated failed-stop endpoints, resource endpoints and signed deltas, and original fixed producer reasons without raw errors. The external pipe must independently confirm and durably register the admitted consumer birth before private producer capture.

V1 passed its 25 local fixtures but its actual Claude Code Opus 5.5 medium source review returned NOT READY: the real paired row omitted the baseline exit that its auditor required. V2 closes that mismatch using shared real row builders and composed audit tests. Its frozen 34-fixture run passed, including the actual unchanged 30-second HTTP timeout. Root independently passed eleven new or changed fixtures and verified all 32 source/dependency bindings. The actual V2 Opus review accepted inactive publication; root independently closed its fixture-result and fixed-reason-enum conditions. The exact invocation includes `--model claude-opus-5-5 --effort medium`, disabled tools and MCP, and no private inputs. Reports, validation results, manifests, provenance, and both original and supplemental root receipts are retained here. V1 evidence remains historical and superseded by V2.

## Reproduce locally

From the repository root:

```sh
python docs/implementation/search-ranking/cpu0-consumer-preparation-20261012/verify.py
cd goodwatch-qdrant/diagnostics/pinning-prototype
node --test test_abi_cpu0.mjs test_audit_cpu0.mjs test_consumer_cpu0.mjs test_consumer_birth_cpu0.mjs test_contract_cpu0.mjs test_source_freeze_cpu0.mjs test_transport_cpu0.mjs
```

The tests use owned local subprocesses, temporary metadata fixtures, and loopback HTTP fixtures. They do not run the clone controller or ordinary search API. The source manifest records the original frozen review layout; `verify.py` resolves those entries to their merged repository locations and checks every byte binding.

## Remaining integration limits

The auditor reports `consumerPass` only, with `experimentPass:false`, `externalCleanupRequired:true`, and `productionAcceptance:false`. External setup, producer exit, Node/provenance pins, client census, and writer/holder disappearance require their own authenticated audit. A fresh stage is mandatory: phase-created lock and writer evidence files invalidate entry inventory on reuse. After any refusal or timeout the outer must re-read the on-disk handoff; a committed handoff can otherwise be unreported to the consumer.

The accepted review retains nonblocking, fail-closed limitations: some cleanup uncertainty fields are omitted; certain preflight/birth refusals collapse to a generic fixed reason; very large inode numbers can cause JavaScript/Python exe-hash disagreement; a symlinked auditor entry can produce no output; malformed non-object frames can lose projected exit facts; nested evidence rejection is not promoted; oversize responses lack their own fixture. These do not establish cleanup or successful execution.

The 15-second post-ack cleanup, 5-second reap, 30-second HTTP timeout, and 131,072-byte controller-frame bound remain unchanged and unproven for real CPU0 execution. Timeout is terminal. The composed nine-pair fixture emits a maximum paired row of 120,328 bytes including newline and a total of 1,630,976 bytes. Those are measured fixture sizes, not a production maximum; aggregate rows embed both frame sets. The offline audit allows 2 MiB per line and 32 MiB total. Any stricter external bound must reject excess truthfully rather than imply this fixture proves every valid row fits.

Map #100 tracks the remaining latency work and #407 remains open. #406 remains closed as instructed. This source preparation establishes neither production latency nor a fresh seven-day acceptance window.
