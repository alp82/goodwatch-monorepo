# Prepared resource population measurement

This separately versioned observer is local preparation only. No observation,
scheduling, pinning, source cap change or new production search has run. It does
not change the original strict reader, auditor, tests, idle gates or failed journals.

The outcome table was written before source review. Its exact required metric
set includes all original meminfo, vmstat, cgroup memory/events.local/cpu/swap/PSI,
host PSI and main stat/io/VmLck fields. `SwapTotal != 0`, missing required fields,
changed main/container/cgroup/config/limits, or changed/locked reader remain fatal.
The internal emitted process field `readBytes` represents the required proc IO
`read_bytes`; the input name has not changed. Cgroup directory device/inode is
captured at construction and fenced before/after samples and at final; mismatches
include identity hashes, not paths.

Auxiliary membership can change independently of required cgroup aggregates.
A complete unique list lacking the main PID refuses. Duplicate, truncated or
unreadable lists retain a partial/unavailable auxiliary census while the main
PID/startticks/executable/cgroup fences remain required. Each known zero VmLck
needs list, birth, status, birth and proc-cgroup checks. A positive read refuses
immediately with numeric evidence even if a later read would vanish. Missing
VmLck (including a zombie), disappear/reuse and unfinished brackets are unknown.
Host Mlocked or cgroup unevictable never proves an unknown member unlocked.
The final main and reader lock fields remain required.

SSH/backup and direct-parent sibling censuses retain only known observed sums
when an allowlisted race occurs. Their sums are not totals and RSS is not exact
capacity accounting. An unclassified error remains fatal. Reader identity and
exactly-one reader exclusion remain fatal even during an optional partial census.
Comm classes are point labels, not birth identity or purpose. The original Docker
`top` check still requires exactly one qdrant comm and can refuse an auxiliary
with that comm; this is a documented population-dependent config refusal.

The new namespace is `resource-population.*` and schema
`resource-population.measurement.v1`; the auditor uses
`resource-population.audit.v1`. There is no `coverage` key or PASS result.
Capacity permission, idle admission, production acceptance and future ceiling
are always false. Foreign or failed journals are not applicable; valid required
samples can have explicitly partial auxiliary dimensions. Neither endpoint zeros
nor bounded observations prove continuous helper/lock absence. Aggregates include
auxiliary consumption, and observed minima/maxima are not a capacity ceiling.
The old strict auditor returns UNKNOWN on this new namespace.

The original 2 s cadence, 3 s gap, 2 s sample ceiling, 1 s drift, 1,500 samples,
8,192-byte row and 16 MiB output bounds are retained. Each endpoint ledger holds
at most 16 members within its original 0.25 s metadata budget. Row overflow removes
only ledger tuples, counts each removal and downgrades auxiliary locks to unknown;
required aggregates are never dropped. Two maximal ledgers and maximum numeric
magnitudes are exercised. Overlong metadata work marks sampling incomplete;
there is no retry. Docker inspection still runs on the original 10 s cadence,
with original command and shutdown bounds.

Placement is supported by actual process inheritance, not an assertion that an
external administrator cannot move a process. The reader stays outside the source
and records its group/birth/zero VmLck bracket. Its ordinary subprocess Docker
inspect/top commands inherit that reader placement; they request no Docker exec,
container start or cgroup move. The eventual SSH transport must bind this source
and prove its own child placement/exit before execution is authorized. A local
real subprocess fixture verifies inheritance. External administrative movement
is outside that proof and is caught only by the next reader placement fence.

Consumer review: `idle_trial.py` imports production/runtime and calls its own
fresh `_sample`/`sample` and pressure checks before admission; its input is not a
resource journal. `idle_lease.py` reads its separately pinned cron/process/backup
phase proof. `idle_launcher.py` binds its fixed nine-file idle packet and journals
`qdrant.idle-lock-trial.v1` via `idle_journal.py`, whose sanitizer requires that
exact event. Those unchanged modules do not import this observer/auditor or read
`resource-population.*`. Reading these entry points establishes separation;
a repository search alone is not the proof. Their reviewed hashes are recorded
in provenance. No new observer result can admit an idle trial.

Run local fixtures:

```sh
PYTHONDONTWRITEBYTECODE=1 python3 -B -m unittest discover \
  -s goodwatch-qdrant/diagnostics/resource-population-v1 -p 'test_*.py'
```

The CLI defaults to prepared-only. Execution and its transport remain subject to
root source/Opus review and a fresh transport freeze. Offline audit accepts only
bounded local journal/receipt files and an explicit frozen source SHA; the receipt
requires the disjoint reader-exit event, positive readerPid/readerStartTicks,
exit 0, clean/gone proof and no TERM/KILL. An offline hash argument is provenance
binding, not automatic trust or authorization.

Successor corrections preserve the original blocked source and report. The auditor
independently validates nested SSH/backup/sibling evidence and exactly-one reader
exclusion, rather than trusting dimension labels. Partial/unavailable states retain
per-sample counts/reasons; a refused combined proof never labels its dimensions as
established. Reader exclusion is proven before the bounded optional scan so stopping
early has one typed census-bound outcome. Typed bytes/hash evidence accompanies
main/reader locks, reader movement, SwapTotal and source limit changes.

Sampling end is timestamped before final metadata fences. Final metadata latency
is not wall-clock drift; both final populations are validated without short-circuit.
The real full row, including optional censuses, is inflated in the output fixture;
its ledger removal must be nonzero and counted while required metrics stay intact.
Freeze verification runs outside its generation (the manifest does not hash itself)
and checks old reader/auditor/original test/idle module bytes. Foreign/malformed
input fails with a typed result. No pycache or unlisted file belongs in a transport.

The successor table distinguishes per-entry unreadability (partial known census)
from whole sibling-root unreadability (unavailable), and missing mandatory reader
enumeration/exclusion (fatal). Decoded PID-prefix counts are bounded to 4,096;
known omitted tuples remain counted. A byte-truncated unknown suffix contributes
one explicitly marked sentinel, not an invented population count. Endpoint main
ledger birth must equal the separately required main startticks.
