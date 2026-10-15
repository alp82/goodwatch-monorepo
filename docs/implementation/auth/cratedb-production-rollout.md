# Production CrateDB password enforcement — #562 / #599

Prepared from direct, read-only SSH inspection beginning **2026-10-15 22:14 UTC** (October 16 in Berlin).
[Evidence](cratedb-production/20261015-password-preflight/), [original lab and privilege analysis](cratedb-credentials.md),
[#644](https://github.com/alp82/goodwatch-monorepo/issues/644),
[#547 execution record](https://github.com/alp82/goodwatch-monorepo/blob/098a6d431376cdcad99d9a5d0a63ff6b52e33816/docs/implementation/auth/cratedb-prereqs.md).
This supersedes the old document's production inventory/order and its statement that crate-01 still needs upgrading.

## Credential staging outcome — 2026-10-15 22:45 UTC

**Owner restored the original backup crontab at 22:49 UTC and authorized resumption.** Read-only verification
confirmed an exact match with the protected original. The failure was a typo in the operator updater: after a
successful install it called `crontab -` again instead of `crontab -l`. Inherited EOF silently installed an empty
schedule. This was reproduced with real crontab in a disposable local container; it was not an Ansible or stdin
transport failure. See the [staging record](cratedb-production/20261015-credential-stage/) for historical receipts.

The corrected, tested `goodwatch-crate/configure_backup_cron.py` installs a protected named file, lists with
`crontab -l`, verifies exact readback, preserves unrelated entries and refuses changed/duplicate/missing backup
jobs. Ansible keeps the provisioned role/file in `host_vars/db1.yml`, validates file ownership/mode, backs up cron
and verifies the installed entry. **Do not touch production cron until the restored 23:05 UTC run succeeds.**
No restart, KILL or HBA change is authorized pending the owner's stale-context answer.

The owner separately authorized credential-only staging before stale-context resolution: six users/secrets/grants
now exist; search-a then search-b were rolled and checked; Windmill variables and Kuma 16–18 were configured and
checked; the backup helper was patched and read-tested. Scripts and worker-container/job checks were not completed.
No Coolify setting, Crate restart, HBA enforcement or KILL was performed. The webapp secret is now on crate-01 at
`/root/.config/goodwatch/crate-credentials/goodwatch_webapp` (root, 0600).

The following inventory and preparation commands retain the original preflight baseline. **Do not rerun user/secret
creation or repeat completed staging steps.** Use the execution record for current client state and remaining work.

## Authorization and preflight stop (historical)

Q35 authorizes the operator to execute this rollout **after this runbook and every pre-check pass**, credentials first,
then one restart at a time and GREEN between nodes. Stop/report the first unexpected result. No KILL of member queries
without another owner decision. The subsequent owner constraint reserves **all Coolify settings, variables and secrets
to the owner's Coolify UI**. Never write to coolify-db or the Coolify API. Read-only DB inspection is allowed.
Merging #599 to main is authorized only **after a successful rollout and passing tests**.

**Original preparation stop, superseded for credential staging only by the owner’s later go.** Two enforcement gates remain unresolved:

1. Crate-02 has 13 old operation entries across seven job IDs; crate-03 has 33 across eleven. They persisted across repeated
   observations and were reported identically by all coordinators. Crate-01 had none older
   than one hour. No matching IDs were present in the final full `sys.jobs` samples. Age/zero bytes/absence from jobs are evidence of possible orphan contexts,
   not proof of safe cancellation or of the internal shutdown counter. Q34's 69 KILLs returned rowcount 0 and did **not**
   remove its old operation rows; normal SIGTERM required separate approval. Do not repeat that workaround by inference.
2. Page credentials require the owner's Coolify UI action below. The original read-only preparation made no production
   changes; later authorized staging and its operational stop are recorded above.

## Observed cluster and restart gates

All three retain the pinned `crate:5.10.16@sha256:5d7cd92eb84d56d538e2222a436e432164b853fdf186aebb17c446787f23a307` image.
All endpoints report **96 GREEN health rows, 962 STARTED/STARTED shard copies, 21 passing node checks**, allocation `all`,
graceful timeout `2h`, minimum availability `PRIMARIES`, force `false`. Master is crate-02. At initial preflight, users were `crate` (superuser)
and `admin` (not superuser), with no `goodwatch_*` users or auth tables. Six client users now exist; no auth tables were created. HBA is off; command still contains the folded
comment that causes later flags to be ignored. Published 4200/4300/5432 remain bound only to each host's private address.
Latest sampled snapshot `hourly_20261015_220501` is SUCCESS. This is a point-in-time observation, not a rollout gate waiver.

| Node | Private host | Existing ID | Old operations / job IDs | Started UTC |
| --- | --- | --- | --- | --- |
| crate-01 | 10.0.0.11 | xlclgwGeSHe18p5J4WvfFA | 0 / 0 | Oct 15 20:37:27 |
| crate-02 (master) | 10.0.0.12 | r0IgCe17SPOgudkQIGsRQA | 13 / 7 | Oct 14 21:06:05 |
| crate-03 | 10.0.0.13 | ch8EXZwrQVmCls79_T_vUg | 33 / 11 | Oct 15 04:01:48 |

Crate-02's old entries started Oct 15 **04:01:09 UTC**, around the prior crate-03 restart. Crate-03's started
**20:37:12 UTC**, around the prior crate-01 stop. Causality remains unproven. The complete candidate IDs are in
`operations-final.json`; re-query before proposing any individual cancellation. **No KILL ALL, automatic KILL,
forced stop, shortened grace, or changing force=true.** Unresolved stale contexts block starting the rollout even
though data health is GREEN. No cleanup proposal is authorized by this document.

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
| Uptime Kuma, hq .10 | Active JSON GET monitors **16 CrateDB (#1), 17 CrateDB (#2), 18 CrateDB (#3)** hit .11/.12/.13 root endpoints without headers or authentication | Set HTTP Basic Authentication in each monitor to `goodwatch_monitoring` and its own server-generated password; no SQL grants required | **All three break with HTTP 401 under HBA.** Local 5.10.16 proof: missing/wrong 401; correct no-grant user 200. Configure through Kuma UI, not backing SQLite. |
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

## Owner checklist before the operator resumes

1. Resolve the **46 persistent operation entries / 18 job IDs** under #644. Approve a specific revalidated remediation
   if required; no inherited Q34 KILL or SIGTERM approval. Require empty stale-context results before rollout.
2. Six role secrets/users/grants are now created. Do not regenerate them. Files are mode 0600 under
   `/root/.config/goodwatch/crate-credentials/` on crate-01. Transfer the webapp secret to owner custody through a
   secure channel; never put values in chat, logs, shell arguments or issues. Confirm the restored 23:05 UTC backup succeeds, then apply the corrected credential schedule.
3. In **Coolify UI only**, application **Goodwatch Webapp / gk4owk8**, production environment, covering **abio .21 and
   vector1 .20**: set runtime **CRATE_USER=goodwatch_webapp** and secret runtime **CRATE_PASS** from
   `/root/.config/goodwatch/crate-credentials/goodwatch_webapp` on crate-01. Preserve `CRATE_HOSTS` and `CRATE_PORT` above.
   Review the existing preview values: no preview deployment may keep a bypass/obsolete identity against production.
   Select the reviewed #599 build through the UI and redeploy both page destinations. Do not merge main to obtain a
   build before the rollout: Q35 permits that merge afterwards. Kuma monitors 16/17/18 have now been configured and their fresh heartbeats verified UP through the supported API, separately from Coolify. Record the exact image SHA and verify runtime values
   by username/presence only. The operator must stop here until this UI action is confirmed and runtime reads pass.
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
passing, zero old operations after owner-approved resolution, no active drain/snapshot job, and baseline settings above.
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

**STOP for Coolify owner UI before enforcement.** The owner authorized non-Coolify credential staging first, now partially
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
Observe a successful scheduled run and one full day of ordinary jobs before enforcement. Exercise infrequent job
classes through approved non-destructive canaries or their normal schedules. Do not invoke cleanup_legacy as a test.

From each actual page/search container, stream the Node verifier (no Python needed):

```bash
ssh root@10.0.0.20 docker exec -i -e CRATE_VERIFY_MODE=credentials goodwatch-search-a \
  node --input-type=module < docs/implementation/auth/verify_crate_endpoints.mjs
# Repeat for search-b and the current gk4owk8-* page container on .20 and .21.
```

Require `actual=goodwatch_search` or `goodwatch_webapp` as appropriate, through all three coordinators. Run equivalent
`SELECT current_user` with supplied credentials through `CrateConnector` on every eligible worker host and via the
backup helper (read only, never call backup.main as a probe). Confirm no active jobs still use `admin`/`crate` except
explicit operator checks. **HBA off accepts wrong passwords**: these checks establish identity/grants and credential
plumbing, not enforcement. The first enforcing node must immediately pass both positive and negative checks.

## Rolling switch: crate-01, crate-03, crate-02 (master last)

Re-evaluate the elected master before starting; if changed, stop and update the order. Preflight stale-context clearance
is required on **all** nodes before starting, including the last node. Keep observers on independent sessions and retain
sanitized logs across app container replacements. One node only; no next node until full GREEN/STARTED and client gates.

1. Take a fresh named safety snapshot, serialized with `/var/lock/backup_crate.lock` on .11, using the admin route and
   a 1,800-second HTTP timeout. Use `pre_hba_562_YYYYMMDDHHMMSS`, outside automated retention prefixes. Example on .11:

   ```bash
   stamp=$(date -u +%Y%m%d%H%M%S)
   python3 -c 'import json,sys; print(json.dumps({"stmt":"CREATE SNAPSHOT \"goodwatch-db-backup-v2\".\"pre_hba_562_"+sys.argv[1]+"\" ALL WITH (wait_for_completion=true)"}))' "$stamp" |
     flock -w 1800 /var/lock/backup_crate.lock docker exec -i crate-01 \
       curl -fsS --max-time 1800 -H 'Content-Type:application/json' --data-binary @- http://127.0.0.1:4200/_sql
   ```

   Verify named snapshot SUCCESS independently before continuing. Timeout is an uncertain outcome, **not permission to
   retry**. Preserve current BLOB artifacts separately and verify SHA1 against the current search manifests; snapshot
   excludes BLOBs. Retain secret/config backups protected on each host, never in git.

2. On the selected host, back up `.env`, compose, runtime and image IDs securely. Stage only the reviewed Compose file,
   then set `CRATE_HBA_ENABLED=true` in this node's `.env` (never all three at once). Preserve file ownership/mode and
   pinned `CRATE_VERSION`. Example for first node, using already-staged reviewed `docker-compose.yml.reviewed`:

   ```bash
   cd /root/goodwatch/goodwatch-monorepo/goodwatch-crate
   umask 077
   record=/root/cratedb-maintenance/562-$(date -u +%Y%m%dT%H%M%SZ)
   mkdir -p "$record"
   cp -p .env docker-compose.yml "$record/"
   docker inspect crate-01 > "$record/runtime.json"
   install -m 644 docker-compose.yml.reviewed docker-compose.yml
   python3 - <<'PY'
   from pathlib import Path
   p=Path('.env'); lines=p.read_text().splitlines()
   assert sum(x.startswith('CRATE_HBA_ENABLED=') for x in lines)<=1
   lines=[x for x in lines if not x.startswith('CRATE_HBA_ENABLED=')]
   p.write_text('\n'.join(lines+['CRATE_HBA_ENABLED=true'])+'\n')
   PY
   docker compose -f docker-compose.yml -p goodwatch-crate config --format json > "$record/rendered.json"
   ```

   Compare protected render to baseline: only removing comment argv and explicitly enabling HBA may change command;
   validate loopback crate trust followed by password rule, image digest, private binds, existing named volume, snapshot
   mount, heap/limits/logging and restart always unchanged. Never print full env/render. Wrong diff = STOP.

3. Suppress restart on **only the target**: `docker update --restart=no crate-01` (substitute the selected node).
   From a different healthy coordinator, issue these individually; first target .11 uses .12:

   ```bash
   crate_sql 10.0.0.12 crate-02 "SET GLOBAL TRANSIENT \"cluster.routing.allocation.enable\" = 'primaries'"
   crate_sql 10.0.0.12 crate-02 "ALTER CLUSTER DECOMMISSION 'xlclgwGeSHe18p5J4WvfFA'" 7500
   ```

   For .13 use its recorded/revalidated ID through .11; for .12 use its ID through .11. Revalidate IDs from sys.nodes
   immediately before issuing. Allow outer SSH at least 7,530 seconds; do not use an app/30-second HTTP timeout.
   Independently watch node membership, missing primaries, operations, checks and client errors. Expected transient
   underreplication during one absent node is allowed; missing primaries, authentication failures, stuck contexts,
   stalled/unexpected health or failed drain means STOP/report. Do not interpret a timeout as cancellation.

4. Require the original process to **actually exit normally**, independently of decommission SQL acknowledgement:

   ```bash
   ssh root@10.0.0.11 docker inspect crate-01 --format '{{.State.Status}} {{.State.ExitCode}} {{.State.OOMKilled}}'
   ```

   If it remains running, stop and ask; no KILL or Docker-stop fallback is authorized here. Only after exit:

   ```bash
   ssh root@10.0.0.11 'cd /root/goodwatch/goodwatch-monorepo/goodwatch-crate && docker compose -f docker-compose.yml -p goodwatch-crate up -d --no-deps --force-recreate cratedb'
   ```

   Verify original node ID rejoined on the same version, admin loopback `SELECT current_user=crate` works, actual runtime
   command includes `-Cauth.host_based.enabled=true` before rules, private bindings/mounts unchanged, restart always.
   Keep readiness probes until users/metadata have arrived (the lab observed roughly two seconds of initial HBA refusal).
   A client auth failure after readiness is unexpected: stop/report; do not advance.

5. Restore recorded effective allocation after rejoin:

   ```bash
   crate_sql 10.0.0.12 crate-02 "SET GLOBAL TRANSIENT \"cluster.routing.allocation.enable\" = 'all'"
   ```

   Use .11 for later targets. Require **three nodes, all current health rows GREEN, every copy STARTED/STARTED,
   zero missing/underreplicated copies, all checks passed**, then repeat from every endpoint. No fixed table-count gate.

6. Probe the newly enforced node from each real client host with correct, wrong and missing credentials. The Node
   verifier defaults to enforcement mode; restrict it to the newly enabled node during the mixed phase:

   ```bash
   ssh root@10.0.0.20 docker exec -i -e CRATE_VERIFY_HOSTS=10.0.0.11 goodwatch-search-a \
     node --input-type=module < docs/implementation/auth/verify_crate_endpoints.mjs
   # Repeat for search-b and both page containers, then .13 and .12 after their respective steps.
   ```

   Python verifier accepts host:port lists for workers and `CRATE_PASSWORD_FILE` for host scripts. Resolve workspace
   variables in-process; never print/export their values in tool output. Positive SELECT returns the dedicated identity;
   missing, wrong-client and wrong-crate passwords must all return HTTP 401 on the enforcing node. Repeat via PostgreSQL
   protocol 5432 using a password prompt/client-library argument (no password argv), since it is also published. A trusted
   container-loopback crate probe must still pass. Do not run negative checks against unenforced nodes as though they were
   a passing enforcement test. Exercise representative catalog, monitoring and authorized writes; never mutate real member
   rows as a maintenance canary. Observe organic traffic and approved disposable canaries with cleanup receipts.

7. Proceed only after all gates; final verification selects all three endpoints from all client hosts, waits for a new
   successful scheduled backup and ordinary Windmill jobs, confirms page/search readiness and no new terminal Crate/auth
   failures. Record versions, runtime SHA, grants, snapshots, timings and evidence. Post #562 outcome. Merge #599 only after
   successful rollout, passing tests and required adversarial review; leave #562 open if any criterion is unmet.

## Rollback / abort

At the first unexpected result **stop advancing and report**. Record whether a drain is still in progress; no automated
retries. Q35 does not authorize improvising KILLs or normal-stop fallbacks. Keep the owner informed if restart=no or
allocation=primaries remains while awaiting a decision.

- **Before drain:** restore this host's saved `.env` and Compose file using `cp -p`, validate its protected render, and
  restore original restart policy if changed. No service recreation is needed when the original container still serves.
- **Drain submitted but daemon alive:** no new node and no force. Observe through another coordinator; a timed-out HTTP
  call may still be running. Get an explicit recovery decision if it will not exit. Prior Q34 SIGTERM was node-specific.
- **HBA node started but clients fail:** keep its container-loopback admin route. Repair client config only within approved
  scope; Coolify remains owner-UI-only. If rollback is approved, set this node's HBA false (or restore its saved files),
  use the same decommission/actual-exit/same-volume recreation procedure, then restore allocation all and full health.
  Keep the 5.10.16 image: **no binary downgrade, volume deletion or snapshot restore** for an HBA rollback.
- **Mixed cluster:** revert only already-changed nodes, one at a time, GREEN between; never disable all at once. Retain
  dedicated credentials/users: they work while HBA is off. If permissions are wrong, any return to previous `admin`
  credentials on pages is another owner UI action; do not drop users/erase secrets during incident response.
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
