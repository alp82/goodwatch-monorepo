# Local CrateDB failover proof

See [GRACEFUL-PROOF.md](GRACEFUL-PROOF.md) for the fixture, fault and write-safety assertions,
and [the title deadline investigation](../../../docs/implementation/crate-title-deadline.md)
for #774's measured failure and rejected timeout candidate.

From `goodwatch-webapp/`, install with `npm ci --include=dev`. No `.env` is needed.
Check `docker ps` and reserve a project name and unused loopback port for your thread:

```sh
export TMPDIR="$HOME/.cache/gw-work/774"
mkdir -p "$TMPDIR"
CRATE_PROOF_PROJECT=gw774-title-503 CRATE_PROOF_PORT=17774 \
CRATE_PROOF_GRACEFUL=1 CRATE_PROOF_PAGES=1 CRATE_PROOF_TRACE=1 \
CRATE_PROOF_OUTPUT="$TMPDIR/graceful.json" bash scripts/crate-failover/run.sh
```

The project owns its container names, network and volumes. The script refuses existing containers
in that project and removes only that project's resources. SQL uses three loopback addresses at
the selected port, with fixture credentials. Never use a production environment file.
Defaults remain project `goodwatch-client-588` and port `17430` for existing callers.

`CRATE_PROOF_TRACE=1` adds paired `proof.sql_started` / `proof.sql_finished` events to the `.log`
next to the report. Each event has its request ID, coordinator, redacted SQL shape, elapsed time
and (on success) server duration. It records no parameters or result rows. Instrumentation wraps
the real client's transport in this process only; its private-method coupling is confined to the proof.

`CRATE_PROOF_SURVIVORS_ONLY=1` is a diagnostic control: application queries use node2/node3
while node1 still participates in the cluster and is decommissioned/restarted normally.
It does not demonstrate that the normal three-coordinator configuration is fixed.

A title 503 makes the ordinary graceful proof fail. Do not raise the page deadline or remove the
page assertion to make a run pass. The retained #774 baseline is expected to remain red.
