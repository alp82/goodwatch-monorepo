# Prepared CPU0 clone variant

This local implementation is uninstalled and unexecuted. Its complete staging and
consumer/auditor bindings still require review. Previous CPU2 files and actual
results remain immutable; V5 has one valid red baseline and no passing pair.

The variant uses `daemon_cpu0.py`, `runtime_cpu0.py`, `controller_cpu0.py` and
`cpu0_guards.py`. Original daemon/runtime/controller, production entrypoints and
idle-service digests stay unchanged. `pin_cpu0.py` retains exact453 pin bytes. `runtime_cpu0.py` derives from exact453
runtime with only the explicitly owned clone name and versioned pin import changed. The daemon requires a new schema, integer CPU0, and the same
6 GiB memory/swap. This is a new combined helper, not exact453 core. Fresh staging
must retain the versioned sibling files referenced by imports and code hashes;
canonical copies, if needed by existing adapters, need separate frozen provenance.

Root creates a new uniquely named `gw-qdrant-cpu0-100-20261012` container using the
same reviewed image and exact existing owned mount tuples and loopback publication,
without quota options. Preserve the old owned clone stopped and its evidence; never
run both. No Docker state edits or unverified zero-update command. No setup or
source-resource writes occur during phases. Creation, source/stager review,
metadata census and renewed zero-pin turnover gates remain root operations.

Source checks require actual Docker NanoCpus/CpuQuota/CpuPeriod integer zero,
actual `cpu.max` equal to the frozen `max` period, and unchanged frozen cpuset/weight.
Template cpuset/weight/period values require comparison to retained V5 source
metadata before freeze; their presence here is no host attestation.

The [Linux 6.8 CPU interface](https://www.kernel.org/doc/html/v6.8/admin-guide/cgroup-v2.html#cpu-interface-files)
defines cpu.max for non-root cgroups. Root is explicitly not applicable, with null
quota/throttle fields and required actual usage/user/system metrics. Every non-root
ancestor requires actual quota/throttle metrics: missing data or finite quota
refuses execution. There is no broad missing-field exception or fabricated zero.
Source and ancestor throttle evidence must be retained across each phase. Source
quota0 counters cannot demonstrate absence of host CPU contention.

`cpu0_preflight.py` is the read-only admission entrypoint before fresh stage creation
or packet selection. Stage creation remains a separate reviewed root script and
must call this gate; no launcher is provided here. Host load1 and load5 must each
be at most half online CPUs, and CPU PSI some.avg10 at most 10 percent. Missing,
nonfinite metrics refuse, without waiting. Repeat that admission before each cold
phase. All existing memory/storage/emergency floors remain unchanged.

`limits()` reuses its existing accounting inputs and retains numeric before/after,
signed deltas, effective pressure flag, fixed scope and completion time when it
throws the original `phase_resource_failed`. Scopes overlap and are non-additive.
All twelve controller sites are named; numeric hierarchy rows also bind each
canonical group/device/inode hash, and failed phases retain before/after snapshots
where available plus a typed unavailable reason without manufactured deltas. the separate CPU0 turnover gate uses the
compatible explicit default `turnover-join` scope. Child runtime checks and reclaim
fences retain their existing reasons outside this ledger. Cleanup stays separate.
No failure is retroactively upgraded and no extra accounting reads/sleeps/retries
are introduced into the limits pass path.

Keep nine exact materialized slots/native anchor, eighteen writers, single libc
reclaim attempt, all preparation waits and resource/dirty gates, initial180,
steady30, query30, lease60, pressure180, ready1200 and outer7200 unchanged. Never
pair a CPU2 baseline with a CPU0 candidate. Native red still requires server1500ms,
64 MiB missing pages and faults; candidate completion requires clean counters,
locks/residency, same range cohort and per-ID score parity. Ordered ties remain
separate. No blind rerun, cap increase, added wait or query/history/Jev writes.
The clone remains historical mechanism evidence, not production acceptance.

## Plan supplement and setup gates

The actual Opus plan report 83032905c5b27d1802f34b1811321bc7c24fe76a282c9fa12e5ebe0628c18ecd
passed review only. Its twelve binding conditions and root's load ceiling are
implementation requirements, not a benchmark verdict. Ancestor finite quota is
a hard refusal pending a separate root review; no confound bypass exists here.
Every non-root relevant quota/throttle metric must exist before fresh stage
creation and before private packet selection. The preflight uses reviewed public
input code and frozen public helper/control configurations outside the absent
fresh control stage, so it does not require that stage to already exist.

CPU0 setup uses new container recreation, not `docker update --cpus=0`: a historical
[Docker issue](https://github.com/docker/for-linux/issues/558) reports zero-update
behavior, which is not an attestation of this host's Docker version. Root must
inspect and freeze creation argv, stopped-original ownership, exact new name,
mounts/image/memory/swap/loopback, unset legacy quota fields and actual cgroup
state. New and old containers cannot run concurrently. No ancestor or production
limit is changed. Staging and comparison/consumer/auditor source bindings are a
separate next reviewed packet; this module set provides no benchmark launcher.

The retained metadata-only old CPU2 context at 14:29:49 proves only then-current
load1 0.06/load5 0.04/PSI0 on four online CPUs; source weight100/cpuset empty and
period100000 support template values, not future setup facts or phase admission.
Source-only CPU0 counters do not prove uncontended host scheduling. Source+ancestor
ledgers overlap and remain non-additive, including pin-parent and query checks.
Child runtime and reclaim reason paths remain explicitly outside this attachment.
A failed hierarchy sample is retained as unavailable; it cannot make clean proof.

Local verification: `python3 -B -m unittest discover -s
goodwatch-qdrant/diagnostics/pinning-prototype -p 'test_cpu0*.py'`. The caller fixtures exercise held-pin ledger scopes directly and query/postinventory
failures through stage(), preserving their original numeric failures when cleanup
also fails. They separately assert failed CPU snapshot status; fixture execution
is not a physical lifecycle proof. These fixtures perform no
Docker, clone or production I/O and are not physical benchmark evidence.
