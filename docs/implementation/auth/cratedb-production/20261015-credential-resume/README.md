# Credential staging resumed; first Q37 KILL did not clear contexts

**Stopped at 23:13:33 UTC on October 15, 2026.** On crate-02 (`10.0.0.12`), ID
`073377a6-6825-8e6c-49db-ded701488ab3` had **zero matching `sys.jobs` rows** immediately before its authorized
individual KILL. The check completed at **23:13:03.116969 UTC** and KILL completed at **23:13:03.250022 UTC**.
KILL returned **rowcount 0**. Both operation entries remained immediately, after 5 seconds and after 30 seconds.
[Exact receipt](kill-one-result.jsonl), [operator script](kill-one-stale.py), [all candidate IDs and disposition](stale-ids.md).

Under Q35's stop rule, **no further KILL, Crate restart, forced stop, allocation change or HBA enablement followed**.
Q37 allowed only individual orphan-ID KILLs and did not waive the uncleared-context gate. The owner must decide the
next remediation. At **23:14 UTC**, all three coordinators still reported **13 old entries / 7 IDs on crate-02 and
33 / 11 on crate-03**, while data health remained **96 GREEN rows, 962 STARTED/STARTED copies, 21 passing checks**.
[Operations after stop](operations-after-kill.jsonl), [health](final-health.jsonl).

## Backup incident diagnosed and fixed before touching cron

The owner restored the preserved crontab at **22:49 UTC**. A subsequent read-only check matched it exactly.
The operator's old updater contained:

```python
# Correct installation, followed by a destructive typo in the supposed readback:
subprocess.run(['crontab', '-'], input=desired, text=True, capture_output=True)
subprocess.check_output(['crontab', '-'], text=True)  # WRONG: installs inherited EOF
# Readback must be ['crontab', '-l'].
```

The second call emptied cron; this was **not an Ansible bug or a broken stdin transport**. A disposable, network-disabled
container with real crontab reproduced the empty schedule and verified the corrected method. [Integration receipt](cron-integration.txt).
The corrected helper `goodwatch-crate/configure_backup_cron.py` defaults to dry run, validates the existing named job,
retains protected rollback/staged files, installs a **named file**, lists with **`crontab -l`**, and checks exact readback.
It refuses changed/duplicate/missing jobs and stops on mismatch without retry or automatic rollback.

The restored **23:05 UTC** run was allowed to finish **before any cron modification**:

- **23:05:01:** Started `hourly_20261015_230501` with the installed backup code.
- **23:05:12:** Snapshot created successfully.
- **23:05:31:** No expired snapshots to delete; verification began.
- **23:05:47:** Snapshot verified SUCCESS; backup run finished.

[Observed log events](backup-2305-observation.jsonl). This run used the restored original invocation while HBA was off;
it is proof of the installed code and scheduler, **not a credential-bearing scheduled snapshot**.

After success, deployed reviewed cron helper/Ansible files, passed the helper dry run, applied the credential schedule
once and read it back twice. The installed entry is:

```cron
5 * * * * CRATE_BACKUP_USER=goodwatch_backup CRATE_BACKUP_PASSWORD_FILE=/root/.config/goodwatch/crate-backup-password /root/.local/bin/uv run /root/goodwatch/goodwatch-monorepo/goodwatch-crate/backup.py >> /var/log/backup_crate.log 2>&1
```

[Install](cron-apply.txt), [second readback](cron-readback.txt), [source hashes](cron-source-deploy.jsonl).
The role/file now persist in `goodwatch-hq/ansible/host_vars/db1.yml`. The play validates the root-only secret, keeps
cron backups and verifies exactly one intended entry. Both scoped check and normal idempotence runs on hq passed:

```bash
cd /root/goodwatch/goodwatch-monorepo/goodwatch-hq/ansible
ansible-playbook -i hosts.ini cron.yml --limit db1 --tags crate-backup-cron --check
ansible-playbook -i hosts.ini cron.yml --limit db1 --tags crate-backup-cron
```

[Normal result](ansible-production-verify.txt): **ok=8, changed=0, failed=0**. No other cron play ran.
The next ordinary scheduled run after credential installation is **2026-10-16 00:05 UTC**; not observed in this session.
An independent read using the **actual installed cron variables** returned `goodwatch_backup` and confirmed
`hourly_20261015_230501` is SUCCESS at 23:19 UTC. [Receipt](backup-final-verification.jsonl).
The prior staging's backup-helper probes verified `goodwatch_backup` against all three coordinators and `sys.snapshots`.
Manual `cleanup_legacy.py` must use the same two backup variables/file on crate-01; it was not run as a probe.

## Expanded client inventory and verification

The first inventory missed default workers on additional private hosts. The complete current default-worker host set is
**10.0.0.10–10.0.0.21 inclusive, plus 10.0.0.30, .31 and .32**: hq, crate-01/02/03, cache1/2/3, mongo1/2/3,
vector1, abio and worker1/2/3. Every host has one default-worker container. Hq and vector1 also have a highperf
container each; hq has two native-worker containers (each runs multiple worker processes).

| Client | Identity/configuration | Verified result |
| --- | --- | --- |
| All **19 worker containers on 15 hosts** | `goodwatch` workspace variables remain `u/Alp/CRATE_USER=goodwatch_windmill`, secret `CRATE_PASS`, hosts .11/.12/.13:4200 | Retrieved values back from Windmill, compared secret with the canonical crate-01 file in memory, then tested from each actual container. **57 coordinator checks**, each identity + sys.nodes + catalog read, passed. [Receipts](worker-container-probes.jsonl). No worker restart or environment mutation. |
| Default-worker real canary | Actual crate-python driver and deployed `f/db/cratedb.CrateConnector`, credentials read by the job from Windmill | Success on a default worker; all three coordinators, monitoring read, movie/show sitemap field reads and authenticated HEAD of an existing search BLOB. [Result](canary-default-v2-result.json). |
| Highperf real canary | Same source and variable lookup, tag `highperf` | Success with the same checks. [Result](canary-highperf-result.json). |
| Ordinary Windmill jobs | New jobs use workspace credentials | Successful monitoring, social ingestion, all-ratings/catalog/streaming/TvTropes/vector/DNA sync and personal-order sync after the variable change. [Metadata](windmill-scheduled-results.txt). Periodic episode-sync failures had identical error-message hashes before and after the change and no auth markers; its 23:00 scheduled sync also succeeded. Other agents' #653 probes are identified separately in the metadata, not counted as this operator's canaries. |
| Manual read tools on all **15 hosts** | Root-only `/root/.config/goodwatch/crate-readonly.env` and `crate-readonly-password`; launcher `/usr/local/bin/gw-crate-readonly`; identity `goodwatch_readonly` | Each host passed identity/catalog reads on .11/.12/.13 and a query using deployed `readonly_stores.py`. [Install and verification](readonly-install-and-verify.jsonl). Password matches the canonical role file; no secret printed. |
| Buzz benchmark on abio | Same readonly profile; coordinator .11 | Actual tool completed **50 reads**. [Result](bench-buzz-readonly.json). A Python 3.8 compatibility bug in password-file loading was fixed and tested first; see below. |
| Pages, abio .21 and vector1 .20 | **Retained `admin` under Q37**, with existing env/secret; current observed image `c1d2376619fbb922f6c90cba9fbb66a911171b53` | Actual installed node-crate driver received exact username/password bytes and returned `admin` through all three coordinators on both hosts. [Abio](page-21-probe.jsonl), [vector1](page-20-probe.jsonl). Runtime changed through an external deployment during this turn; this operator made no Coolify writes. |
| Search-a/b .20 | `goodwatch_search`; same image `3b52c297d2c04b6332cc6379709b03cc425ec4b4` | Remain healthy, models ready, zero restarts since the earlier credential roll. [Final status](search-final.txt). Reviewed old catalog source does send Basic auth for the hex secret; do not assume it omits the header. PR startup-refusal/failover improvements are still not in this runtime. |
| Kuma 16–18 .10 | Basic / `goodwatch_monitoring` | All fresh heartbeats UP at 23:13:49–52 UTC. [Final receipt](kuma-final.jsonl). |

HBA remains off. These checks prove credential plumbing, selected identities and granted access; **they cannot prove
password rejection or that the existing admin password matches the server's masked stored value**. Admin has a password
set, but the system table masks it. The first enforcing node must immediately pass positive tests for every role,
including `admin` from both app hosts, and negative missing/wrong-password tests. Stop on any failure.

The first default-worker preview failed in **the operator's probe** after its direct-driver checks: the query's
unaliased current-user column label did not match the assumed dict key. An explicit `AS role` alias fixed it; both
subsequent canaries passed. [Original failure metadata](canary-default-result.json), [final canary source](worker-canary.py).
No production data writes, BLOB PUT, full sitemap publication or new table were used as a canary.

## Manual script usage and source changes

The profiles are deliberately readonly. Examples on any listed host:

```bash
# A script that reads environment variables:
gw-crate-readonly python3 /root/goodwatch/goodwatch-monorepo/goodwatch-flows/tools/bench_buzz.py
# A script whose CLI requires a dotenv path:
gw-crate-readonly python3 /path/to/read-tool.py --env /root/.config/goodwatch/crate-readonly.env
```

Do not invoke the benchmark on all hosts to load-test production; it was run only on abio. Manual sitemap scripts
receive the same profile but were not run to generate bulk artifacts. Deployed auth-compatible source files on all
15 root checkouts: `bench_buzz.py`, `create_sitemaps.py`, `sitemap_crate.py`, `export_tvtropes_cohort.py` and
`docs/prototypes/search-arena/scripts/readonly_stores.py`. Root-only originals are retained under
`/root/.config/goodwatch/crate-rollout-562/` (relative names flattened with `__`). The exporter now accepts
`--env-file` / `CRATE_ENV_FILE` and environment overrides; the prototype no longer requires a workstation-specific path.

Archived/ad-hoc **writers or destructive maintenance tools must not use the readonly profile**. Windmill writers use
the configured workspace variables; manually approved writers must explicitly obtain their scoped maintenance
credential at invocation. No blanket writer privilege was added to the readonly role and no dormant writer was run.
Operator/local environments outside these 15 hosts are not automatically configured by this server rollout.

The first Buzz invocation exposed `str.removesuffix` being unavailable in abio's **Python 3.8.10** before any SQL request.
The fix removes only one trailing newline from password-file content, preserving environment values verbatim.
Three fixture cases passed on that actual interpreter; the real authenticated benchmark then passed.
[Compatibility test](bench-python38-compatibility.json), [fixed-source deployment hashes](bench-fix-deploy.jsonl).

## Changes, tests and remaining enforcement work

- `9da9e220`: Safe cron helper, regression tests, Ansible validation/readback, persistent db1 credential settings and runbook root cause.
- `12074486`: Manual readonly launcher and configurable script profiles.
- `1691b69c`: Production Python 3.8 compatibility for the benchmark credential loader.
- Crate suite: **38 passed**; real-crontab integration passed; Ansible syntax passed; actual scoped Ansible run **changed=0 / failed=0**.
- Manual profile/environment precedence check and Python compilation/shell syntax passed. Webapp code did not change in this resumed stage; its previously reported suites were not rerun. The owner's Qdrant baseline-failure waiver remains recorded.

All commits stay on **auth/crate-credentials / draft PR #599**. #599 was not merged into main. Next actions are:

1. Owner decision on the **KILL-resistant stale contexts**. No restart with that unresolved gate, and no inference that Q37 authorizes the prior Q34 forced-stop workaround.
2. After resolution, rerun the runbook's live preflight, freeze deployment SHAs, verify runtime startup-refusal compatibility and remaining recovery/maintenance checks, then Q35's one-node-at-a-time enforcement with GREEN between nodes.
3. Observe the first credential-bearing scheduled backup and retain the normal-job evidence. Full sitemap/BLOB publication was not triggered by this operator.
4. Webapp role separation is **optional**, not an enforcement gate. Dedicated `goodwatch_webapp` limits application grants and separates credential rotation from other clients; it is not required just to turn on password checks. If chosen later, its root-only secret remains on crate-01 at `/root/.config/goodwatch/crate-credentials/goodwatch_webapp`; only the owner may change Coolify UI settings.
5. Only after successful enforcement and required tests: merge #599 under Q35. No main merge before then.
