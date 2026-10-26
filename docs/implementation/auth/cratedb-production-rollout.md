# Production CrateDB password enforcement — #562 / #599

Prepared from direct, read-only SSH inspection beginning **2026-10-15 22:14 UTC** (October 16 in Berlin).
[Evidence](cratedb-production/20261015-password-preflight/), [original lab and privilege analysis](cratedb-credentials.md),
[#644](https://github.com/alp82/goodwatch-monorepo/issues/644),
[#547 execution record](https://github.com/alp82/goodwatch-monorepo/blob/098a6d431376cdcad99d9a5d0a63ff6b52e33816/docs/implementation/auth/cratedb-prereqs.md).
This supersedes the old document's production inventory/order and its statement that crate-01 still needs upgrading.

## Completed — 2026-10-16 00:29 UTC

Password enforcement is active on **crate-02 → crate-03 → crate-01**, with each approved zero-primary,
force=false drain followed by unlimited-grace normal SIGTERM. Every direct client credential gate passed;
missing/wrong passwords are rejected. Final independent checks on all three nodes: **96 GREEN health rows,
962 STARTED/STARTED shard copies, 21 passing node checks**, allocation all, trusted local administration intact.
The credentialed 00:05 backup succeeded and actual failover worked while crate-01 was stopped.

See the [completed execution record and current client inventory](cratedb-production/20261015-enforcement/).
All19 worker containers and15 script hosts were verified. Pages retain their existing `admin` credential,
verified from both hosts; no Coolify change is required. The optional dedicated webapp secret remains at
`/root/.config/goodwatch/crate-credentials/goodwatch_webapp` on crate-01. No owner action remains for enforcement.
The original stale contexts cleared, but two newer orphan entries remain on crate-02 under #644; no additional
KILL/restart was attempted. The historical sections below preserve decisions and observations at their stated times;
do not interpret their original staging warnings or pending checks as current blockers or repeat completed work.

## Current stale-context and restart advice — #644

**Updated 2026-10-26; read-only investigation, no new production action authorized.**
See the [investigation and sanitized evidence](cratedb-production/20261026-operation-contexts/README.md).
All three coordinators agree across repeated samples: **crate-01 1,460 / crate-02 112 / crate-03 2,897**
persistent operation rows older than one hour without a matching `sys.jobs` entry (4,469 rows,
1,653 distinct job IDs cluster-wide). Exclude the additional 100 old operations with matching live
Windmill jobs. The two October 16 crate-02 entries remain; almost all other candidates started during
crate-02's temporary membership loss/rejoin on October 22 at 05:55 UTC. All nodes still run 5.10.16.

The isolated follow-up reproduced missing-job operations, retained task objects and active-request
shutdown waits on 5.10.16. Relevant upstream fixes exist in 6.2.0 and 6.4.3, but a 6.4.6 lab still
retained tasks after node loss; no upgrade is established as a complete fix. Keep production unchanged.
Task-initialization cleanup and the missing-coordinator disconnect path remain relevant mechanisms. On 5.10.16 the operation statistics map is separate from active tasks; KILL targets
active tasks, and decommission waits on internal task/request counters rather than operation-row count.
Neither absent `sys.jobs` rows nor zero reported bytes prove that cancellation is safe or that these
statistics block shutdown. Exact orphan statement types/client identities have aged out of the jobs
log; the investigation records the confirmation path and relevant upstream change.

**Do not use KILL as stale-context clearance.** Both historical attempts returned rowcount 0 and left
rows behind. Any Q34/Q37 KILL instructions below are historical, superseded by this advice and the
later rollout-specific no-more-KILL decision. Do not execute the archived cancellation script.
Recommend leaving production unchanged while a separately scoped isolated reproduction/upstream
investigation establishes a remedy. No immediate restart, stats toggle or timeout change is advised.

For a future separately owner-approved necessary restart, inventory operations and jobs twice at least
one minute apart through every coordinator. Retain health/client/backup gates, `force=false`, and the
zero-primary drain. If the daemon then remains alive, use the documented host-managed normal SIGTERM
with unlimited grace, after immediately rechecking zero primaries and StopSignal. Normal TERM is not
itself a decommission. Never use KILL ALL, automatic/individual stale-ID cancellation, SIGKILL, shortened
grace or force=true as a workaround. If normal stop does not finish, leave its unlimited-grace wait in
place and report for a decision; prior rollout approval is not standing authorization for new maintenance.

Current health is 143 GREEN rows and 21 passing checks, but **two shard copies have RELOCATING routing**
(1,161 others STARTED/STARTED). The strict settled-shard restart gate is not satisfied by this snapshot.
Use fresh gates for any future maintenance; historical shard/table counts below are not current targets.

## Approved continuation — 2026-10-15, after Q37 stop

The owner explicitly approved the #547 normal-stop precedent for **this rollout**. No more KILLs.
Order is **crate-02 → crate-03 → crate-01**, even though crate-02 is initially master.
Keep `force=false`, `min_availability=PRIMARIES` and the existing 2h graceful setting. Decommission through
another coordinator, require **zero primaries on the target**, then if its daemon remains alive use
`docker stop --timeout=-1 NODE`: normal configured SIGTERM, unlimited grace, no SIGKILL or shortened timeout.
Check the container StopSignal is unset/SIGTERM/15 first. The owner approval replaces only the prior stale-context
clearance/normal-stop/order restrictions below; historical receipts remain unchanged.

Before any drain, verify the installed backup code has all three coordinators and test it with crate-01 excluded.
Keep a checked `docker exec NODE ... http://127.0.0.1:4200/_sql` admin route on both a surviving node and the target
when it rejoins. Use only the existing image/volume/settings; the sole runtime change is the reviewed HBA command.
Between nodes require all three members, GREEN, all shard copies STARTED/STARTED, allocation all and every node check.

**First-node hard gate:** directly against **10.0.0.12 only**, test admin from both actual page containers,
search-a/b, Windmill's stored credential from a worker, installed backup helper, Kuma's configured Basic credential,
and installed script profile. Correct credentials must return the expected identity/access; missing/wrong passwords
must return 401. Also verify PostgreSQL password enforcement and trusted local administration. HBA-off nodes cannot
satisfy this gate. If any client fails, **revert HBA on crate-02 using the same zero-primary/unlimited-grace procedure,
restore GREEN and stop**. This rollback is expressly authorized; do not change Coolify or attempt credential repairs.
No next node before the complete first-node gate passes. Post progress and outcome to #562.

## Historical stop — 2026-10-15 23:14 UTC (superseded by continuation above)

**Stopped after the first Q37-authorized individual KILL did not clear its stale contexts.** Crate-02 job ID
`073377a6-6825-8e6c-49db-ded701488ab3` had no matching `sys.jobs` row immediately before KILL at **23:13:03 UTC**.
KILL returned **rowcount 0**, and its two operation rows remained after 30 seconds. No further KILL or restart
followed. All coordinators still report 13 stale entries on crate-02 and 33 on crate-03, with **96 GREEN health
rows, 962 STARTED/STARTED copies and 21 passing node checks**. See the
[resumed execution record, exact KILL receipt and remaining IDs](cratedb-production/20261015-credential-resume/).

The credential-only work completed before that stop:

- Six roles, secrets and grants exist. Search-a/b use `goodwatch_search`; Windmill uses `goodwatch_windmill`;
  Kuma 16–18 use `goodwatch_monitoring`. All relevant identity/transport checks passed while HBA stayed off.
- The owner restored backup cron at 22:49 UTC. The **23:05 run succeeded at 23:05:47 UTC** with the installed code.
  Only afterwards, the corrected helper installed `goodwatch_backup` and the protected password-file path in cron.
  Two exact readbacks and scoped Ansible reconciliation passed; Ansible reported **changed=0, failed=0**.
- The cron incident was an operator typo: the would-be readback called **`crontab -` instead of `crontab -l`**,
  consuming inherited EOF and replacing the schedule with an empty one. This was reproduced in a disposable
  container and fixed with named-file installation, explicit listing, regression tests and exact readback.
- Inventory now covers **15 default-worker hosts and all 19 worker containers**. All 57 worker/coordinator checks
  passed, as did real default/highperf canaries and ordinary ingestion, sync and monitoring jobs.
- Manual readonly profiles and tested script sources are installed on all 15 hosts. The actual Buzz benchmark
  passed after a Python 3.8 compatibility fix. See the execution record for paths, usage and bounded probe scope.
- **Q37 makes the webapp role switch optional.** Both page containers retained `admin`, and their installed driver
  sent the exact credential bytes and returned that identity on all three coordinators. Actual password rejection
  and the stored admin-password match cannot be proven while HBA is off; verify immediately on the first enforcing node.

The dedicated webapp secret remains on crate-01 at
`/root/.config/goodwatch/crate-credentials/goodwatch_webapp` (root, 0600), if the owner chooses that separation later.
No Coolify setting was changed by this operator. No Crate/worker restart, HBA enablement or PR merge into main occurred.
The next credential-bearing scheduled backup is **2026-10-16 00:05 UTC**, not yet observed in this session.

Historically, Q37 permitted individually revalidated orphan-ID KILLs on crate-02/03, with a Q35 stop if they did not clear.
**Historical restriction, now superseded:** the subsequent owner decision above explicitly permits the zero-primary
unlimited-grace normal stop with these contexts still present. The inventory below is the original six-host baseline;
the execution record supplies expanded current coverage. Do not regenerate existing secrets/users or blindly
repeat completed staging steps. The [first staging record](cratedb-production/20261015-credential-stage/) is retained
as historical evidence, including the now-resolved cron incident.

## Authorization and preflight stop (historical)

Q35 authorizes the operator to execute this rollout **after this runbook and every pre-check pass**, credentials first,
then one restart at a time and GREEN between nodes. Stop/report the first unexpected result. No KILL of member queries. Q37 authorizes only individually revalidated orphan IDs on crate-02/03 as above.
The subsequent owner constraint reserves **all Coolify settings, variables and secrets to the owner's Coolify UI**. Never write to coolify-db or the Coolify API. Read-only DB inspection is allowed.
Merging #599 to main is authorized only **after a successful rollout and passing tests**.

**Original preparation stop, superseded for credential staging only by the owner’s later go.** These were the original enforcement gates; the current stop is recorded above:

1. Crate-02 has 13 old operation entries across seven job IDs; crate-03 has 33 across eleven. They persisted across repeated
   observations and were reported identically by all coordinators. Crate-01 had none older
   than one hour. No matching IDs were present in the final full `sys.jobs` samples. Age/zero bytes/absence from jobs are evidence of possible orphan contexts,
   not proof of safe cancellation or of the internal shutdown counter. Q34's 69 KILLs returned rowcount 0 and did **not**
   remove its old operation rows; normal SIGTERM required separate approval. Do not repeat that workaround by inference.
2. Page credentials must work from both app hosts. Under Q37 the existing `admin` credential may remain; the
   dedicated role is optional. Any Coolify change is still owner-UI-only. The original read-only preparation made no
   production changes; later staging and recovery are recorded above.

## Original observed cluster and restart gates (see continuation above)

All three retain the pinned `crate:5.10.16@sha256:5d7cd92eb84d56d538e2222a436e432164b853fdf186aebb17c446787f23a307` image.
All endpoints report **96 GREEN health rows, 962 STARTED/STARTED shard copies, 21 passing node checks**, allocation `all`,
graceful timeout `2h`, minimum availability `PRIMARIES`, force `false`. Master is crate-02. At initial preflight, users were `crate` (superuser)
and `admin` (not superuser), with no `goodwatch_*` users or auth tables. Six client users now exist; no auth tables were created. HBA is off; command still contains the folded
comment that causes later flags to be ignored. Published 4200/4300/5432 remain bound only to each host's private address.
Latest independently verified snapshot `hourly_20261015_230501` is SUCCESS (23:19 UTC, using the installed cron credential). This is a point-in-time observation, not a rollout gate waiver.

| Node | Private host | Existing ID | Old operations / job IDs | Started UTC |
| --- | --- | --- | --- | --- |
| crate-01 | 10.0.0.11 | xlclgwGeSHe18p5J4WvfFA | 0 / 0 | Oct 15 20:37:27 |
| crate-02 (master) | 10.0.0.12 | r0IgCe17SPOgudkQIGsRQA | 13 / 7 | Oct 14 21:06:05 |
| crate-03 | 10.0.0.13 | ch8EXZwrQVmCls79_T_vUg | 33 / 11 | Oct 15 04:01:48 |

Crate-02's old entries started Oct 15 **04:01:09 UTC**, around the prior crate-03 restart. Crate-03's started
**20:37:12 UTC**, around the prior crate-01 stop. Causality remains unproven. The complete candidate IDs are in
`operations-final.json`; re-query before proposing any individual cancellation. **No KILL ALL, automatic KILL,
forced stop, shortened grace, or changing force=true.** The original stale-context block is superseded by the explicit normal-stop continuation above; data health must still be GREEN before drain. The historical Q37 individual-ID KILL permission is superseded; do not repeat it or execute the archived cancellation script. The later continuation authorizes normal SIGTERM after zero primaries despite uncleared contexts.

## Production client inventory

All HTTP clients below use port 4200. `admin` passwords are present, but HBA-off success does not validate them.
This table is the original baseline; the execution record above identifies the identities now configured.

| Client / host | Current identity and coordinators | Credential configuration / target | What breaks or needs a gate |
| --- | --- | --- | --- |
| Coolify pages, abio 10.0.0.21 and vector1 10.0.0.20 | `admin`; .11,.12,.13; node-crate wrapper; current image 6082cadc | Owner UI: application **Goodwatch Webapp**, UUID **gk4owk8**, runtime `CRATE_USER=goodwatch_webapp`, secret `CRATE_PASS`; preserve `CRATE_HOSTS=10.0.0.11,10.0.0.12,10.0.0.13`, `CRATE_PORT=4200` | Deploy PR client fix before credentials. Verify both running containers, not just saved settings. Production and preview CRATE variables both exist; review preview inheritance too. |
| search-a / search-b, vector1 .20 | `admin`; same three coordinators; image 3b52c297; catalog and blob transports as well as wrapper | `/root/goodwatch/goodwatch-monorepo/goodwatch-search/.env`, `CRATE_USER=goodwatch_search`, `CRATE_PASS`; explicit search deploy | Do not run `copy-env` after separation: it copies the page identity. Merge repair passes credentials explicitly into catalog transport and handles transient HBA 401. Blob GET uses its own Basic header. |
| Windmill default workers .11,.12,.13,.20,.21,.10; highperf .20,.10; native workers .10 | Workspace `goodwatch`, `u/Alp/CRATE_USER=admin`; `u/Alp/CRATE_HOSTS=10.0.0.11:4200,10.0.0.12:4200,10.0.0.13:4200`; password secret present | Windmill variables `u/Alp/CRATE_USER=goodwatch_windmill`, secret `u/Alp/CRATE_PASS`; retain host list | Shared `CrateConnector` (crate-python), social direct HTTP, index-build SQL + blob PUT. New jobs read variables; running jobs retain old connections. Let old work finish; do not kill it. No worker container restart needed just to change variables. |
| Windmill monitoring .10 and eligible worker hosts | Same Windmill identity; `f/monitoring/check`, `backup_check`, store and cluster collectors use connector | Same workspace variables; DQL sys + doc monitoring writes/DDL | Test real scheduled monitoring; successful `SELECT 1` alone misses missing sys privileges. |
| Windmill scheduled sitemap / episode-language jobs | Sitemap uses all workspace hosts and credentials; nightly language runner pins **first host .11** | Same workspace variables | Sitemap source downloader now includes `sitemap_crate.py`; without it new generator import fails. Nightly writer can fail during .11 drain; pause new scheduling with owner-reviewed scope and let active work finish before maintenance. No generic write replay. |
| Hourly backup, root cron on crate-01 .11, `5 * * * *` | No credentials, formerly only .11 | `CRATE_BACKUP_USER=goodwatch_backup`, `CRATE_BACKUP_PASSWORD_FILE=/root/.config/goodwatch/crate-backup-password`; cron command explicitly supplies these | **Breaks immediately under HBA without patch + secret + cron update.** New code fails over an unsent write/read to .12/.13. An acknowledged-or-ambiguous CREATE/DROP is never blindly replayed. Existing deployed script has neither change. |
| `cleanup_legacy.py`, manual on crate hosts | No credentials through old backup helper | Same backup variables/file | Not scheduled; do not run as a rollout probe: it deletes snapshots. |
| Manual sitemap / scripts in production checkouts | Variable-dependent, usually inherited `admin` or no header; first host for manual sitemap | `CRATE_USER=goodwatch_readonly`, `CRATE_PASS`; separate driver args now tolerate URL characters | Scheduled sitemap is separate above. Do not run bulk generators merely to test authentication. |
| `bench_buzz.py` from abio; measure/benchmark/evidence/search acceptance/Qdrant diagnostics; flows backfills | Bench pinned .11 with no header; others env-dependent | Bench now accepts `CRATE_USER` plus `CRATE_PASSWORD_FILE` or `CRATE_PASS`. Read probes use readonly; approved writers use a scoped maintenance identity | Unconfigured ad-hoc scripts will fail; archived URL-userinfo scripts require hex passwords. Local operator environments cannot be completely inventoried from server snapshots. |
| `crash`, Admin UI, one-off curl/SQL / all hosts | Unauthenticated becomes `crate`; no running crash/backup/cleanup process found in sampled process lists | Prefer trusted loopback via `docker exec` on a Crate host; remote crash requires named credential via prompt, never password argv | Remote credentialless administration will fail. Never grant remote passwordless crate access. |
| Uptime Kuma, hq .10 | Active JSON GET monitors **16 CrateDB (#1), 17 CrateDB (#2), 18 CrateDB (#3)** hit .11/.12/.13 root endpoints without headers or authentication | HTTP Basic Authentication is configured in each monitor to `goodwatch_monitoring` and its own server-generated password; no SQL grants required | **All three break with HTTP 401 under HBA.** Local 5.10.16 proof: missing/wrong 401; correct no-grant user 200. Configure through Kuma UI, not backing SQLite. |
| Grafana Alloy / node-exporter, all six hosts | Live Alloy configs scrape node metrics; .20/.21 also scrape app/search metrics; no Crate SQL/4200/5432 targets found | No direct Crate credential needed for inspected configs | Windmill Crate monitoring is separate above. External Grafana datasource configuration was not independently inventoried; owner must confirm none bypasses these collectors. |
| Future auth adapter + maintenance CLI | Not deployed; no `goodwatch_auth` | `AUTH_CRATEDB_ORIGINS`, `AUTH_CRATEDB_USERNAME`, `AUTH_CRATEDB_PASSWORD` in owner UI for both page hosts | Separate #547/#548 stage after enforcement; no auth tables/user creation during this run. |

Windmill DB inspection found **zero Crate/4200 resources**: this installation uses variables. Its 73 matching current
scripts and 48 enabled schedules are retained in `windmill.txt` (matching includes import-only/non-client helpers).
No extra Crate cron found in root crontabs or `/etc/cron.d` on the six hosts. Source/script filename scan covered
production checkouts, root operational scripts and systemd units; it is not proof against dormant scripts elsewhere.

Production has two additional schemas: `backup_20260925_stale_child_rows` and `backup_20260925_deleted_titles`.
The old plan's “only doc and blob” assumption fails. Retain them unchanged; add backup DDL DENY for both. Routine
Windmill gets no grant to these retained archives; an operator wishing to access them needs explicit scoped grants.
No blanket grant on every schema. Auth-table migration must apply DENY to every new `doc.auth_*` before data enters it.

## Historical owner checklist before continuation (completed or superseded)

1. Resolve the **46 persistent operation entries / 18 job IDs** under #644. Q37 allows individual KILLs only after
   rechecking no matching `sys.jobs` row immediately before each; record ID/result on #562 and stop if they do not clear.
   This historical requirement is superseded by the subsequent explicit normal-SIGTERM approval above. No more KILLs; force remains false.
2. Six role secrets/users/grants are now created. Do not regenerate them. Files are mode 0600 under
   `/root/.config/goodwatch/crate-credentials/` on crate-01. Transfer the webapp secret to owner custody through a
   secure channel; never put values in chat, logs, shell arguments or issues. The restored 23:05 UTC backup and corrected credential schedule are now verified.
3. **Optional under Q37:** the webapp may retain its current `admin` credential if verified from both app hosts.
   Dedicated-role migration can wait. If the owner chooses it, in **Coolify UI only**, application **Goodwatch Webapp / gk4owk8**, production environment, covering **abio .21 and
   vector1 .20**: set runtime **CRATE_USER=goodwatch_webapp** and secret runtime **CRATE_PASS** from
   `/root/.config/goodwatch/crate-credentials/goodwatch_webapp` on crate-01. Preserve `CRATE_HOSTS` and `CRATE_PORT` above.
   Review the existing preview values: no preview deployment may keep a bypass/obsolete identity against production.
   Select the reviewed #599 build through the UI and redeploy both page destinations. Do not merge main to obtain a
   build before the rollout: Q35 permits that merge afterwards. Kuma monitors 16/17/18 have now been configured and their fresh heartbeats verified UP through the supported API, separately from Coolify. Record the exact image SHA and verify runtime values
   by username/presence only. A dedicated-role UI switch is no longer a gate. Runtime credentials must pass on both app hosts;
   client build compatibility and all other enforcement checks still apply.
4. Confirm scope for operator-managed search/Windmill/backup credentials, outstanding first-host job quiescence,
   external Grafana/ad-hoc clients, and the maintenance window. Q35 already supplies rollout go conditional on gates;
   it does not waive a failed gate. A critical-change adversarial review remains a shipping gate from map #529.
5. Complete #547's auth identity and #548's tables separately after #562. No auth cut-over/MCP launch here.

## Preparation commands (consult execution record before reuse)

Run from a clean checkout of the **reviewed PR SHA**. Freeze that SHA in the execution record; no `git pull` of a moving
branch on production. Stage only approved files on hosts. Keep service image digest, binds, volumes and all unrelated
environment settings unchanged. Some credential-staging steps have now been executed; see the execution record. Enforcement steps remain unexecuted.

Administrative helper, run on the operator machine. It sends SQL over SSH stdin into the trusted loopback route,
works before and after enforcement, and rejects SQL errors. Do not supply secret SQL literals as its arguments.

```bash
crate_sql() {
  local ip=$1 node=$2 stmt=$3 timeout=${4:-300}
  python3 -c 'import json,sys; print(json.dumps({"stmt":sys.argv[1]}))' "$stmt" |
    ssh -o BatchMode=yes -o ConnectTimeout=10 "root@$ip" \
      docker exec -i "$node" curl --silent --show-error --fail --max-time "$timeout" \
      -H 'Content-Type:application/json' --data-binary @- http://127.0.0.1:4200/_sql |
    python3 -c 'import json,sys; d=json.load(sys.stdin); assert "error" not in d, "SQL failed"; print(json.dumps(d))'
}
set -o pipefail
```

Run against each node separately (`.11/crate-01`, `.12/crate-02`, `.13/crate-03`). Any failure stops the run:

```bash
crate_sql 10.0.0.11 crate-01 "SELECT current_user"
crate_sql 10.0.0.11 crate-01 "SELECT id,name,version['number'] FROM sys.nodes ORDER BY name"
crate_sql 10.0.0.11 crate-01 "SELECT health,count(*),sum(missing_shards),sum(underreplicated_shards) FROM sys.health GROUP BY health"
crate_sql 10.0.0.11 crate-01 "SELECT state,routing_state,count(*) FROM sys.shards GROUP BY state,routing_state"
crate_sql 10.0.0.11 crate-01 "SELECT node_id,id,passed FROM sys.node_checks ORDER BY node_id,id"
crate_sql 10.0.0.11 crate-01 "SELECT master_node,settings['cluster']['routing']['allocation']['enable'],settings['cluster']['graceful_stop'] FROM sys.cluster"
crate_sql 10.0.0.11 crate-01 "SELECT node['name'],job_id,name,started,used_bytes FROM sys.operations WHERE started < current_timestamp - INTERVAL '1 hour' ORDER BY node['name'],started"
crate_sql 10.0.0.11 crate-01 "SELECT id,username,started FROM sys.jobs"
crate_sql 10.0.0.11 crate-01 "SELECT name,state,finished FROM sys.snapshots ORDER BY started DESC LIMIT 3"
```

Require all current health rows GREEN, every current copy STARTED/STARTED, three expected IDs on 5.10.16, all node checks
passing, existing orphan-context inventory recorded under the approved normal-stop continuation, no active drain/snapshot job, and baseline settings above.
Re-read operations twice separated by at least one minute. Inspect IDs and timestamps, never member SQL/arguments.
Capture current settings layers for rollback; never RESET GLOBAL blindly. Verify latest backup success and mounted snapshot
path on all hosts. #563's recorded restore drill must cover this cluster/repository; record its link and separate BLOB
recovery evidence. The previous patch-specific restore waiver does not automatically cover this change.

After these gates, on **crate-01**, generate and create client users without printing secrets. This is an explicit
production mutation and is conditional on the gates and Q35. Existing user/file means STOP, not rotate/reuse blindly:

```bash
ssh root@10.0.0.11 python3 - <<'PY'
import json, os, pathlib, secrets, subprocess
roles = ('goodwatch_webapp','goodwatch_search','goodwatch_windmill','goodwatch_readonly','goodwatch_backup','goodwatch_monitoring')
def sql(stmt, args=()):
    p = subprocess.run(['docker','exec','-i','crate-01','curl','-fsS','--max-time','300',
        '-H','Content-Type:application/json','--data-binary','@-','http://127.0.0.1:4200/_sql'],
        input=json.dumps({'stmt':stmt,'args':list(args)}), text=True, capture_output=True)
    if p.returncode: raise SystemExit('STOP: administrative request failed (response suppressed)')
    d=json.loads(p.stdout)
    if 'error' in d: raise SystemExit('STOP: SQL failed (response suppressed)')
    return d
existing={r[0] for r in sql('SELECT name FROM sys.users')['rows']}
assert not existing.intersection(roles), 'STOP: client user already exists'
root=pathlib.Path('/root/.config/goodwatch/crate-credentials')
root.mkdir(parents=True,exist_ok=True,mode=0o700)
assert not any((root/r).exists() for r in roles), 'STOP: credential file already exists'
for role in roles:
    password=secrets.token_hex(32)
    fd=os.open(root/role,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
    with os.fdopen(fd,'w') as f: f.write(password+'\n')
    sql('CREATE USER '+role+' WITH (password = ?)',[password])
    print(role+': created; password retained in protected file')
PY
```

Apply **one statement at a time** via `crate_sql`, checking each response. Do not execute the lab file wholesale:
its auth-table example does not exist in production.

```sql
GRANT DQL, DML ON SCHEMA doc TO goodwatch_webapp;
GRANT DQL ON SCHEMA doc TO goodwatch_search;
GRANT DML ON TABLE doc.search_interpretations, doc.search_spending, doc.search_control TO goodwatch_search;
GRANT DQL, DML, DDL ON SCHEMA doc TO goodwatch_windmill;
GRANT DQL, DML, DDL ON SCHEMA blob TO goodwatch_windmill;
GRANT DQL ON SCHEMA sys TO goodwatch_windmill;
GRANT DQL ON SCHEMA doc TO goodwatch_readonly;
GRANT DDL TO goodwatch_backup;
GRANT DQL ON SCHEMA sys TO goodwatch_backup;
DENY DDL ON SCHEMA doc TO goodwatch_backup;
DENY DDL ON SCHEMA blob TO goodwatch_backup;
DENY DDL ON SCHEMA backup_20260925_stale_child_rows TO goodwatch_backup;
DENY DDL ON SCHEMA backup_20260925_deleted_titles TO goodwatch_backup;
SELECT grantee,class,ident,type,state FROM sys.privileges WHERE grantee LIKE 'goodwatch_%';
```

**Coolify remains owner-UI-only; the role switch is optional under Q37.** The owner authorized non-Coolify credential staging first, now partially
completed as recorded above. Deploy the reviewed credential client build before enforcing passwords. Configure
search `.env` with its own secret and deploy search-a then search-b using the reviewed `goodwatch-search/deploy.sh SHA`.
Set HTTP Basic Auth on Kuma monitors 16/17/18 to `goodwatch_monitoring`, using the secret file of that name on .11; require all three green before enforcement and after each node. This identity needs no SQL grants.
Set Windmill workspace variables through its normal authenticated UI/API (never through Coolify); no secret in CLI args.
No database writes to Windmill's backing tables. Wait for old jobs to finish and verify representative ingestion,
monitoring, blob publication and scheduled sitemap jobs with the new identity. Inspect failures without raw payloads.
A single identity SELECT is necessary but does not exercise their grants.

On crate-01, deploy reviewed backup code and install its password without printing it:

```bash
install -m 600 /root/.config/goodwatch/crate-credentials/goodwatch_backup \
  /root/.config/goodwatch/crate-backup-password
```

After the restored **23:05 UTC** backup reports success, deploy the reviewed `configure_backup_cron.py` to
`/root/goodwatch/goodwatch-monorepo/goodwatch-crate/` on crate-01. Run the dry run first, then apply once:

```bash
ssh root@10.0.0.11 python3 /root/goodwatch/goodwatch-monorepo/goodwatch-crate/configure_backup_cron.py
ssh root@10.0.0.11 python3 /root/goodwatch/goodwatch-monorepo/goodwatch-crate/configure_backup_cron.py --apply
```

The helper retains root-only before/staged files under `/root/.config/goodwatch/crate-rollout-562/`, uses a named
file for installation and `crontab -l` for exact readback. **Never use `crontab -` to inspect a schedule.** Any mismatch
stops without automatic retry/rollback. It replaces only the named existing backup entry, preserving all other bytes:


```cron
5 * * * * CRATE_BACKUP_USER=goodwatch_backup CRATE_BACKUP_PASSWORD_FILE=/root/.config/goodwatch/crate-backup-password /root/.local/bin/uv run /root/goodwatch/goodwatch-monorepo/goodwatch-crate/backup.py >> /var/log/backup_crate.log 2>&1
```

The Ansible inventory now retains `crate_backup_user=goodwatch_backup` and
`crate_backup_password_file=/root/.config/goodwatch/crate-backup-password` in `goodwatch-hq/ansible/host_vars/db1.yml`.
Deploy the reviewed `cron.yml` and that inventory file on hq. For a scoped reconciliation use
`ansible-playbook -i hosts.ini cron.yml --limit db1 --tags crate-backup-cron`; never run the other cron plays as a rollout probe.
The task checks the root-only secret, keeps a cron backup and verifies exactly one intended entry using `crontab -l`.
The owner-authorized continuation uses the successful 23:05 scheduled run, credentialed helper checks, ordinary
job results and bounded representative canaries as the preflight evidence. Continue observing the next credential-bearing
scheduled run; do not represent a full day of observation as completed. Exercise infrequent classes through bounded canaries. Do not invoke cleanup_legacy as a test.

From each actual page/search container, stream the Node verifier (no Python needed):

```bash
ssh root@10.0.0.20 docker exec -i -e CRATE_VERIFY_MODE=credentials goodwatch-search-a \
  node --input-type=module < docs/implementation/auth/verify_crate_endpoints.mjs
# Repeat for search-b and the current gk4owk8-* page container on .20 and .21.
```

Require `actual=goodwatch_search` for search or `admin` for pages under Q37, through all three coordinators. Run equivalent
`SELECT current_user` with supplied credentials through `CrateConnector` on every eligible worker host and via the
backup helper (read only, never call backup.main as a probe). Review active `admin`/`crate` jobs before maintenance; Q37 explicitly permits the verified page
`admin` identity. Let older worker jobs finish or establish that their retained credentials remain valid; never kill them. **HBA off accepts wrong passwords**: these checks establish identity/grants and credential
plumbing, not enforcement. The first enforcing node must immediately pass both positive and negative checks.

## Rolling switch: crate-02, crate-03, crate-01

Use this order exactly. One node at a time; no second drain until GREEN/STARTED/all checks and client gates pass.
The fresh safety snapshot `pre_hba_562_20261015232836` is independently SUCCESS. All 18 current BLOB artifacts
(126,888,186 bytes) are protected with SHA1 verification under
`/root/cratedb-maintenance/562-enforce-20261015/blob-artifacts` on .11. #563 records successful SQL/BLOB restoration.
Before-config/runtime copies are protected in `/root/cratedb-maintenance/562-enforce-20261015/` on each target.
The staged reviewed compose SHA256 is `5fd424fe031a4f89ab269de7ffca1904b50ad293c2e9ca1fb13a48a1f6d08ccd`.

| Target | Observer/admin coordinator | Revalidated original ID |
| --- | --- | --- |
| .12 / crate-02 | .11 / crate-01 | r0IgCe17SPOgudkQIGsRQA |
| .13 / crate-03 | .11 / crate-01 | ch8EXZwrQVmCls79_T_vUg |
| .11 / crate-01 | .12 / crate-02 | xlclgwGeSHe18p5J4WvfFA |

For each target:

1. Re-run live admin, health, nodes, shard states and checks; verify the ID and `force=false`, PRIMARIES, 2h.
   Require GREEN before changing allocation. Confirm no active backup/snapshot conflicts. Verify the backed-up files
   and running container ID still match; otherwise stop. For .11, recheck backup reads with .11 excluded.
2. Atomically install the reviewed compose file and set `CRATE_HBA_ENABLED=true` only in this target's `.env`.
   Preserve ownership/mode. Protected render must differ only in HBA argv, preserving image digest, volume, mounts,
   private ports, heap, limits and logging. Current runtime still has HBA off until recreation.
3. Suppress only target restart, then decommission through the observer. First-node exact commands:

   ```bash
   ssh root@10.0.0.12 docker update --restart=no crate-02
   crate_sql 10.0.0.11 crate-01 "SET GLOBAL TRANSIENT \"cluster.routing.allocation.enable\" = 'primaries'"
   crate_sql 10.0.0.11 crate-01 "ALTER CLUSTER DECOMMISSION 'r0IgCe17SPOgudkQIGsRQA'" 7500
   ```

   Keep the request alive; a client timeout does not cancel the drain. Independent observers must show no missing
   primaries. Expected temporary underreplication while one node is absent is allowed; new unexpected failures stop advancement.
4. Require successful decommission acknowledgement and **zero target primaries** through the observer:

   ```sql
   SELECT count(*) FROM sys.shards WHERE primary = true AND node['id'] = 'r0IgCe17SPOgudkQIGsRQA';
   SELECT sum(missing_shards) FROM sys.health;
   SELECT settings['cluster']['graceful_stop']['force'] FROM sys.cluster;
   ```

   Results must be 0, 0, false. Check target StopSignal is unset/SIGTERM/15. If still running:

   ```bash
   stop_unit="gw-crate-stop-562-12-$(date -u +%H%M%S)"
   ssh root@10.0.0.12 systemd-run "--unit=$stop_unit" --property=Type=exec --property=TimeoutStopSec=infinity --property=SendSIGKILL=no /usr/bin/docker stop --timeout=-1 crate-02
   # Poll through an independent SSH session; do not stop/cancel this unit.
   ssh root@10.0.0.12 systemctl show "$stop_unit" -p ActiveState -p Result -p ExecMainStatus
   ssh root@10.0.0.12 docker inspect crate-02 --format '{{.State.Status}} {{.State.ExitCode}} {{.State.OOMKilled}}'
   ```

   Require exited, exit 0 or 143, no OOM/SIGKILL. Never wrap this stop in a finite grace/kill timeout. If it does not
   exit within 15 minutes, leave its unlimited-grace stop running and report; no further KILLs or forced stop. Original orphan-context rows alone are covered by this approval.
5. Only after exit, recreate on the same volume/image:

   ```bash
   ssh root@10.0.0.12 'cd /root/goodwatch/goodwatch-monorepo/goodwatch-crate && docker compose -f docker-compose.yml -p goodwatch-crate up -d --no-deps --force-recreate cratedb'
   ```

   Require original ID/version rejoin, exact expected HBA command, private bindings/mounts/image unchanged and
   restart always. Check container-loopback `SELECT current_user` returns crate. Initial startup readiness may
   need several seconds; begin the hard client gate only after users/metadata are available.
6. Run the hard client gate in step 7 immediately after metadata readiness, before allocating replicas back.
   On success, restore allocation through the observer. On a failed client gate, **also restore allocation all and
   wait for GREEN/STARTED/all checks before the rollback drain**. This predetermined recovery path preserves the
   strict GREEN precondition in the drain executor; it does not permit another node restart. Then set only this node
   HBA=false, disable its restart policy and repeat the same drain/zero-primary/unlimited-grace/rejoin procedure.
   Verify HBA off, restore allocation all and stop after GREEN. Exact allocation command:

   ```bash
   crate_sql 10.0.0.11 crate-01 "SET GLOBAL TRANSIENT \"cluster.routing.allocation.enable\" = 'all'"
   ```

   Wait for progressing shard recovery; require three nodes, every health row GREEN, all copies STARTED/STARTED,
   zero missing/underreplicated copies, all 21 checks passed. Recheck independently through all three local admin routes.
7. Direct first-node gate **only to .12** from both actual page containers (`admin`), search-a/b, actual Windmill
   worker using API-read workspace values, backup helper with installed cron credential, Kuma's stored Basic credential,
   and readonly script profiles. Correct password must return expected identity; missing/wrong must return 401.
   Example for search:

   ```bash
   ssh root@10.0.0.20 docker exec -i -e CRATE_VERIFY_HOSTS=10.0.0.12 goodwatch-search-a \
     node --input-type=module < docs/implementation/auth/verify_crate_endpoints.mjs
   ```

   Repeat for search-b and both current `gk4owk8-*` page containers. Test the new role files too, including optional
   webapp. Verify PostgreSQL 5432 with client-library password parameters held only in memory. Trusted local crate
   administration must still pass. Do not accept fallback success on an unenforced node. **Any client failure means
   roll back HBA on this node and stop**, not changing the client's credentials or advancing to another node.
8. Repeat only after full gates for .13 then .11, substituting observer/target/ID from the table. After all three,
   verify every endpoint, page/search readiness, Kuma UP, representative Windmill work and scheduled backup success.
   Post #562 outcome. Merge #599 only after successful enforcement and tests on current main; no merge while stopped.

## Rollback / abort

At the first unexpected result **stop advancing and report**. Record whether a drain is still in progress; no automated
retries. The continuation explicitly authorizes zero-primary `docker stop --timeout=-1`, but no additional KILL or forced-stop fallback. Keep the owner informed if restart=no or
allocation=primaries remains while awaiting a decision.

- **Before drain:** restore this host's saved `.env` and Compose file using `cp -p`, validate its protected render, and
  restore original restart policy if changed. No service recreation is needed when the original container still serves.
- **Drain submitted but daemon alive:** no new node and no force. Observe through another coordinator; a timed-out HTTP
  call may still be running. The new continuation permits normal SIGTERM with unlimited grace only after zero primaries; if that does not finish, stop and request a decision. Never escalate to SIGKILL.
- **HBA node started but clients fail:** keep its container-loopback admin route. Repair client config only within approved
  scope; Coolify remains owner-UI-only. The first-node client failure rollback is already approved: set this node's HBA false (or restore its saved files),
  use the same decommission/actual-exit/same-volume recreation procedure, then restore allocation all and full health.
  Keep the 5.10.16 image: **no binary downgrade, volume deletion or snapshot restore** for an HBA rollback.
- **Mixed cluster:** revert only already-changed nodes, one at a time, GREEN between; never disable all at once. Retain
  dedicated credentials/users: they work while HBA is off. If permissions are wrong, any return to previous `admin`
  credentials on pages is another owner UI action; do not drop users/erase secrets during incident response.
- **Node never rejoins:** verify via a surviving coordinator that it holds zero primaries and retains no new assigned shards. Use the same host-managed unlimited-grace normal stop, restore its saved HBA-off config, recreate the same volume/image and stop/report after health recovery. Never use Compose to stop a running node.
- **Recovery validation:** correct credentials work on every node, original private binds/volume/ID persist, restart always,
  allocation recorded baseline, all GREEN/STARTED, scheduled backup and monitoring pass. With HBA disabled, explicitly
  report that password enforcement remains incomplete. Do not call a reverted rollout successful.

Residual privilege risks from the lab remain: any authenticated user can read/write BLOB HTTP endpoints; backup needs
cluster DDL and can manage repositories/new schemas. Keep secrets on private hosts, preserve network restrictions and
never claim schema grants alone isolate future auth tables before their explicit DENY rules are applied.

References: [CrateDB authentication settings](https://cratedb.com/docs/crate/reference/en/5.10/config/node.html#authentication), [official rolling procedure](https://cratedb.com/docs/guide/admin/upgrade/rolling.html). Production-specific gates above retain the stricter owner instructions.

## Preparation verification (not production execution)

- Merged origin/main `6082cadc` into the PR branch as `02f508bf`, preserving #604/#607/#631 behavior.
- Local disposable three-node 5.10.16 HBA lab: **431/431**; zero read/upsert failures during restart (2,432/395
  successful) and hard-kill rehearsal (3,639/599 successful). All owned lab containers/volumes/networks removed.
- Targeted Crate/catalog: **50/50**. Backup/Compose: **33/33**, including actual loopback connection-refusal failover
  and refusal to replay ambiguous snapshot writes. Sitemap helper: **4/4**. Windmill sitemap: **14 tests + 5 subtests**.
- Python/Node endpoint verifier integration: passed; good/wrong/missing credentials, host:port support, no secret output.
- Full webapp suite with `npm ci` dependencies: **2,883 passed, 1 failed, 1 skipped, 1 TODO**. Unchanged
  `qdrant-session-listeners.test.ts` broken-connection timing fails identically on exact main `6082cadc`. The owner
  subsequently waived this pre-existing failure as a merge blocker; it was not changed by this rollout.
- Typecheck: **174 identical diagnostics** on branch and exact main, no added diagnostics. Production build passed,
  **817** files precompressed. Ansible syntax check and `git diff --check` passed.
- Four real page/search containers each supplied their existing credentials successfully to every coordinator:
  **12/12 identity reads**, all `admin`. Windmill's current workspace credential supplied from hq also returned `admin`
  through all three. These HBA-off reads do not prove the passwords are correct under enforcement.
- Kuma GET root probe on isolated local 5.10.16: no/wrong password 401, dedicated user with zero grants 200;
  fixture container and anonymous volume removed. No production member queries were cancelled or written.
- During the original read-only preparation, no production fault, client credential change, secret generation, user/table
  creation, HBA/restart, snapshot mutation, Coolify write or main merge occurred. Later credential staging is recorded
  at the top of this document. No production rollout is running in the background.

The owner’s latest decision explicitly accepts the pre-existing Qdrant timing failure reproduced on main as non-blocking
for the merge gate. It does not waive any production gate or authorize main merge before successful enforcement.
