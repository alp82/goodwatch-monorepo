# CrateDB adapter for #548 (checkpoint)

Work in progress. Better Auth is pinned to 1.7.7. Production auth is unchanged.

The adapter lives in `crate-adapter.server.ts`; `call-shapes.server.ts` transcribes
#531's allowlist, including hook expansion and gated optional DB modes. Rows use
deterministic lookup keys, key/version CAS, atomic operation receipts and logical
deletion. Unreadable write outcomes throw an indeterminate error. There are no
transaction or native join claims.

Run `npm ci --ignore-scripts` in the webapp, then
`npm ci --ignore-scripts --prefix scripts/auth-cratedb/conformance` and
`npm run test:auth`. This creates a disposable three-node CrateDB 5.10.12 cluster
and cleans up its containers, network and volumes. The same runner is wired into
`.github/workflows/auth-cratedb.yml`.

Observed before this checkpoint: unrefreshed member lookup, 24-way code
consumption, 24-way rotation/revocation, strict OR rejection, email claims,
consent upsert and the inventoried shape checks passed against local CrateDB.
The first complete upstream conformance run had 199 passes and 39 failures;
projection, additional models, dates and email changes have since been addressed.
The complete rerun, fault harness and focused typecheck remain to be completed.

Current deliberate limitations: email claims remain reserved after address
changes/deletion; tombstones and receipts await coordinated physical cleanup;
default-limit enumeration fails closed rather than silently truncating. Receipt
capacity and enumeration are bounded. The final report will replace this
checkpoint with exact results and remaining risks.
