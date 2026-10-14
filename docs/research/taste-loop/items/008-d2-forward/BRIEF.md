# Item 008: D2 forward comparison, registered

Run by the orchestrator, no builder. One registered T1 run of rung B5 against B1 (and B0 as a second reference) on
tier A with `--others before`, as `PREREG.md` in this folder states, then one gate look on tier B with
`lab/run.sh --gate 008`. The result goes into `DECISIONS.md` under D2 as win, null or indistinguishable, and the
gate answer as replicated or not replicated.
