# Item 006 report

Builder: Sol 6.1 (gpt-6.1-sol, high effort) through codex exec. Saved by the orchestrator.

- **Frozen source:** predictors, references and harness are copied and hash-checked. Source-edit, hash-mismatch and strict-resume tests pass.
- **“Both” counts:** tables show retained titles/members by band and T2b `both_under_min`. Same-sample comparison tests pass.
- **Fold table:** both columns now use the same 10 members; verified against the report.
- **Wording:** matching “reduces popularity’s part without removing it”; rebuilt text verified. `PROTOCOL.md` updated.

New harness hash: `4560b41019627a29c12431582c4e7ee9bb66269d2bf1cc39f0bffed2c0f25ae1`

T1 is byte-for-byte unchanged; T2b values are unchanged. All 3,464 checked T2a values reproduced exactly. Only the fold table’s main comparison changed to the correct cohort.

One supplemental ladder run completed; the ledger’s original prefix is unchanged.

Rebuilt: [T1](ladder-T1.md), [T2a](ladder-T2a.md), [T2b](ladder-T2b.md).

**Validation limitation:** 91 permitted tests pass. Four tests that execute `gate.py` were excluded because the brief forbids it.
Orchestrator checks: the full suite including the four gate tests passes (95); the three tables rebuild from the ledger; against item 004 only the fold table's main-fold column changed (now the same 10 members); the ledger only grew.
