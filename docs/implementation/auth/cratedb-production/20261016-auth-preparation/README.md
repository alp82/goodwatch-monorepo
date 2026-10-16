# Production auth account preparation — #547

## Completed after owner clarification

The owner explicitly accepted **private destination binding plus live password enforcement**
as #547's network boundary. The earlier firewall stop below is historical and no longer
blocks this ticket. Source filtering and durable generated-rule comments are tracked separately
in [#669](https://github.com/alp82/goodwatch-monorepo/issues/669), with no map/project membership
or wayfinder label (only `needs-triage`). No firewall semantics or comments were changed.

On 2026-10-16, created `goodwatch_auth` through trusted container-loopback administration,
using the #562 method: server-side `secrets.token_hex(32)`, exclusive creation of a root-owned
0600 file in the existing root0700 directory, and a bound password argument to CREATE USER.
No password appeared in command arguments, output, issues or repository files. Secret location:

`crate-01:/root/.config/goodwatch/crate-credentials/goodwatch_auth`

The account is not a superuser and has **zero privilege entries** before and after verification.
No grants, schema/table changes, application changes or Coolify writes were performed.

[Completion evidence](completion.json) records:

- Correct credentials return `current_user = goodwatch_auth` through each of .11/.12/.13.
- Missing and incorrect passwords return HTTP 401 through each coordinator (six checks).
- Admin inventory contains 69 existing `doc` base tables and no auth tables.
- All 69 tables reject both SELECT and DELETE through every coordinator: **414 denials**.
  SELECT uses LIMIT 0, DELETE uses WHERE false, so even an unexpected privilege would not
  expose member rows or delete data. Every result is HTTP404 / code4045,
  `SchemaUnknownException[Schema 'doc' unknown]`: the zero-grant account cannot see the schema.
  This is not a missing-schema assumption: the privileged inventory confirms the tables exist.
- The initial probe expected HTTP401/403 privilege errors and stopped at the first hidden-schema
  response. A read-only diagnostic identified CrateDB's actual denial shape; the corrected
  verification reused the existing secret/account without rotation and passed every endpoint/table.

The original done criteria now hold: all nodes on 5.10.16 (independently checked through every
coordinator in `database.json`), dedicated auth user created, accepted firewall boundary documented.
The completed #562 enforcement record and rolling-upgrade/rehearsal evidence remain linked by
`cratedb-production-rollout.md` and #547. The former stop did not require a firewall change.

The #595 checklist step 1.4 reuses this identity, creates the approved auth tables at cutover,
sets replicas=2 / write.wait_for_active_shards=1 / translog.durability=REQUEST, and grants only
explicit table-scoped DQL/DML to `goodwatch_auth`. The owner copies the protected password into
Coolify UI only as `AUTH_CRATEDB_PASSWORD`, with `AUTH_CRATEDB_USERNAME=goodwatch_auth`;
the agent never writes to Coolify's DB or API. Table grants and the UI handoff remain cutover work,
not #547 completion requirements. External/provider reachability was not tested.

## Historical inspection and stop (superseded)

Observed 2026-10-16 around 00:34–00:35 UTC, directly over private SSH as root.
No production mutation was made. The operator stopped under the instruction to report
any firewall work beyond comment-only changes. #547 remains open.

## Verified

Every coordinator independently reports all three nodes on 5.10.16, no `goodwatch_auth`
user and no `doc.auth_*` tables (`database.json`). The credential directory on crate-01
is root-owned mode 0700; the six existing role files are root-owned mode 0600.
No credential contents were read or printed.

The completed password-enforcement record is PR #599, merge
`5e3ac3a575bf5f44a19969d0ff02f9d62bcb90ca`; this inspection did not repeat its client tests.

## Firewall findings and stop

Collected `iptables-save`, `ip6tables-save`, `ufw status verbose` and Docker
`HostConfig.PortBindings` on each host. The committed extracts include only Crate
ports and UFW status/defaults; public addresses and unrelated rules are omitted.

- Each of 4200 (HTTP), 4300 (transport), 5432 (PostgreSQL) is published exclusively
  on its host's 10.0.0.11/12/13 address. Docker DNAT has the matching private destination.
- UFW is active with incoming/routed deny and outgoing allow. The private SQL allowance
  has `Crate SQL - private clients`; local worker HTTP has `gw-worker:windmill_default:4200`.
  These comments are visible in UFW metadata, but not in the active iptables rules.
- Docker forwarding ACCEPT rules for all three container ports have no source restriction.
  DOCKER-USER contains individual address DROP rules, not a general private-source allowlist.
  UFW INPUT is not the enforcement boundary for these forwarded paths.
- There are 268/242/237 active IPv4+IPv6 rules without `--comment` on .11/.12/.13,
  including generated Docker/UFW chains. These counts include unrelated rules, and
  do not mean every UFW configuration entry lacks metadata comments.

Private destination binding is verified; a firewall-enforced private-source boundary
is not. Installing such a boundary changes semantics and is outside this authorization.
Blindly annotating generated rules also risks breaking exact-match cleanup/reconciliation;
a durable fix must account for their generators rather than claim a one-off annotation
satisfies persistence. No rule was changed or reloaded. Internet/provider reachability
and alternate routing paths were not tested; no public-exposure claim is made.

## Remaining work

Resolve the intended firewall acceptance boundary and authorize any necessary semantics
or generator changes. Then create `goodwatch_auth` using the #562 method:
`secrets.token_hex(32)` generated on crate-01, exclusive root0600 file
`/root/.config/goodwatch/crate-credentials/goodwatch_auth`, bound password argument
through trusted container-loopback SQL, and zero grants. Stop if either user/file exists.
The user/secret were **not created** in this stopped run. Three-coordinator correct,
missing/wrong password and existing-table read/write denial checks remain unperformed.

At cutover, step 1.4 must reuse the prepared identity and apply table-scoped DQL/DML
only after creating the approved auth tables and verifying replicas=2,
write.wait_for_active_shards=1, translog.durability=REQUEST. Owner transfers the secret
into Coolify through its UI only. No Coolify DB/API writes are authorized.
