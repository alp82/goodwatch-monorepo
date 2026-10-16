# Auth preparation stopped at firewall review — #547

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
