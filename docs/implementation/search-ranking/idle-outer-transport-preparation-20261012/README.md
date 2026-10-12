# Inactive idle-trial outer transport preparation

The new entry and transport prepare a bound direct-file CLI with durable birth/GO and result receipts. `run_reviewed_stage` still refuses before fork; no host staging, pinning, query, configuration change or service activation follows from this PR. Map 100 remains open. Issue 406 remains closed as requested.

The nine merged API/core modules are byte unchanged. Their exact hashes and equality against merged `1a8da52` and frozen V2 are retained in [V3 provenance](v3-opus-provenance.json). Final source matches the 17-file [V3 manifest](v3-manifest.json). The full final cohort passed **76 tests in 78.805 seconds**, and actual Claude Code Opus 5.5 medium accepted inactive preparation. Root independently ran 39 transport fixtures and checked all source bindings. These are local fixture/review results, not production placement, headroom or latency proof.

V1 and V2 actual NOT READY reviews are retained. Original V1 packaging omitted a public fixture dependency: 24 entries passed and two import entries failed; the complete same-source 51-test packet passed. V2’s complete 70-test packet passed but review found two binding gaps and missing branch coverage. V3 closes those findings, binds expected identities before reads/creation, requires observed root-controller absence before N/A, and distinguishes exception exit 5 from committed helper non-pass exit 4.

The first V3 targeted run had 39 methods: 38 passed and one mutation method had six stale subcase assertions expecting exit 4. Those assertions were corrected to exit 5; the two targeted final tests and frozen 76-test cohort passed. The reviewer prompt incorrectly said “all other 33”; final provenance explicitly corrects that count. Historical artifacts remain unchanged.

To reproduce from the repository:

```sh
cd goodwatch-qdrant/diagnostics/pinning-prototype
python -B -m unittest test_idle_transport test_idle_journal test_idle_lease test_idle_launcher -v
```

Run these fixture tests as an unprivileged user. Patched root context and manifest-rejected stand-ins exercise local schemas and OS seams, not the production root branch. Unknown early children and holder absence remain explicitly unproven by the outer. No production source/pin budgets, seven-day acceptance window or capacity permission are established. Future enabling requires separately reviewed source/configuration and stronger causal/resource evidence; the newer population observation’s false admission fields cannot satisfy the standing eligibility gate.
