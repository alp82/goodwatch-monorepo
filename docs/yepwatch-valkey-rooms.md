# YepWatch live rooms in Valkey

Owner decision Q60 (2026-11-13): live rooms live in Valkey. CrateDB keeps the durable history copy, written right
after each commit. Q59 (capacity cache) is folded in: no cache is needed.

## Why

YepWatch shares CrateDB with GoodWatch, so GoodWatch load sets YepWatch's tail latency. Production command marks
before this change (p50/p95 ms): read 11.7/95.6, records 16.3/117.1, head 14.4/34.2, capacity 6.5/71.4,
auth 0.9/47.7, deletion 5.8/69.4. vote→peer p95 314–380 ms (budget 250), create p95 ~650 ms (budget 500).

**Scope.** Room persistence, capacity, admissions and the account checks (logout, deletion) leave Crate. Catalog
reads are unchanged: country/service lists are cached, Start uses the deck prepared during setup, and an agreement
still rechecks availability. The revision publish to the shared bus (the gateway path, 4cb48e648) stays.

## Step 0: the shared Valkey cluster can't hold rooms

Read-only `CONFIG GET` / `INFO` through the API container's client (2026-11-13):

| nodes | maxmemory | policy | used | evicted keys | persistence |
|---|---|---|---|---|---|
| 10.0.0.14-16 (3 masters, no replicas) | 7 GB each | `volatile-lfu` | 7.00 GB (full) | 1.5-1.9 M each | AOF everysec + RDB |

It is GoodWatch's page cache (`cached-*`, `title-card`, `og-card`, ...): about 1.1 M keys per node, nearly all with a
TTL, at maxmemory and evicting all the time. A room key with a TTL could be evicted; one without could make writes fail
with OOM once memory fills with keys that can't be evicted. A lost master also loses its slots (no replicas).

So rooms go to a **dedicated YepWatch Valkey**, the `valkey` service in `yepwatch-app/compose.yaml`:

- `valkey/valkey:8.1.10` (the version the shared cluster runs), standalone, `maxmemory 512mb`,
  `maxmemory-policy noeviction`, `appendonly yes`, `appendfsync everysec`, RDB snapshots off.
- Named volume `valkey-data` on `/data`. Coolify creates and keeps `<uuid>_valkey-data` across deploys, as for other
  compose apps on abio. Runs as the image's `valkey` user (999), read-only root, no capabilities.
- No published port. A password derived from the room key (`sha256("yepwatch-rooms-valkey:" + key)`), computed by the
  container at start and by the api, so no new secret is needed. `front` and `gateway` share the compose network
  but don't have the password. The api waits for the Valkey health check.
- Without `YEPWATCH_PROPOSAL_ROOMS_VALKEY_URL` (the older `yepwatch-realtime/release` route) rooms stay in Crate.
- No Coolify UI step is needed. Checked locally: auth required, policy and fsync as configured, data kept across a
  container recreate on the same volume.

The revision bus (pub/sub to the gateway) stays on the shared cluster; the gateway is unchanged. Realtime tickets
and the command budget move to the dedicated Valkey (tickets carry TTLs and were evictable on the shared cluster).

## Data model

All keys share the hash tag `{yw}` (one slot, so the scripts would stay valid on a cluster too).

| key | type | what |
|---|---|---|
| `{yw}:room:<id>` | hash | `v` version (+1 per commit), `i` incarnation, `r` revision, `e` expiry, `p` pending revision, `a` agreement checking, `b` the room, `s` version copied to Crate, `cs`/`ct` that Crate head's `_seq_no`/`_primary_term`, `w`/`wf` Crate writes not yet fenced out (newest version; `version:fingerprint` of each), `x` reconcile requested |
| `{yw}:pending` | zset | rooms with an unpublished revision or a running agreement check (repair loop) |
| `{yw}:jobs`, `{yw}:jobs:tries` | zset, hash | the history outbox: member = job, score = when due; failures in a row |
| `{yw}:invite:<hash>` | string | `roomId expiresAt`, kept as long as Crate keeps the mapping (retention + 7 days) |
| `{yw}:quota:c:<creator>` | zset | the creator's live rooms by expiry (10 per person) |
| `{yw}:quota:r:<room>` | hash | the room's capacity proof: creator, admission digest, expiry |
| `{yw}:adm:<minute>` | set | admission ops granted this minute (create, join; 20/min) |
| `{yw}:acct:<key>` | zset | an account's rooms by expiry (the Crate index stays the long copy) |
| `{yw}:revoked:<key>` | string | a logged-out session, until it expires |
| `{yw}:del` | hash | deletion markers (account, guest) by Crate id |
| `{yw}:mirror` | hash | which Crate tables are imported: `sessions`, `quotas`, `invites`, `deletions`, `rooms` |

`b` is the room's JSON sealed with AES-256-GCM (a key derived from the room key, AAD = room id): it holds GoodWatch
grants and sign-in verifiers. An unsynced room never expires; a synced room is kept until a week after its expiry, so
it still answers "expired". At ~45 rooms a day and ~160 KB a room, memory use is tens of MB.

## Commands (hot path: Valkey only)

`ValkeyRoomRepository` implements the existing `ProposalRepository`, so the service's read → transition → CAS loops,
receipts, retries and the in-process per-room lane stay as they are (the lane now waits on ~1 ms writes).

- **read** (`ywRead`): `seq` = `v`, `term` = `i`. A missing room is read through from Crate only until the live Crate
  rooms are imported (`{yw}:mirror` rooms); after that a miss is "not found" without touching Crate.
- **insert** (`ywInsert`): refuses an existing key or `now >= expiresAt`; `v=1`, a random incarnation, pending =
  revision, outbox `room:<id>`.
- **compareAndSwap** (`ywCas`): only if `v` and `i` still match (an imported or replaced room is a new incarnation,
  so no stale CAS lands). Pending revision as Crate computed it (`notify` ? max(previous, revision) : previous),
  `a` from the room, repair-set membership, `PERSIST`, outbox `ZADD NX room:<id>`.
- **pending / acknowledge** (`ywPending`, `ywAck`): acknowledging clears `p` without moving `v`, so it no longer
  makes the next queued write retry. Rooms whose key is gone drop out of the repair set.
- Every write is first planned by the Crate repository (`validate`: size cap, column schemas, relations), so Valkey
  never accepts a room the history copy would refuse.
- The rooms connection never resends a command. An answer lost after sending is `IndeterminateWrite` (the service
  re-reads; receipts make the retry idempotent); a refused script or a failed read is a retryable 503.

**Capacity and admissions** (`ValkeyReleaseControl`):

- `create` (`ywAdmit`): an exact retry finds its proof and expiry; a changed retry conflicts; a full creator is
  refused before anything is charged; then the minute's admission budget is charged (idempotent per op) and the
  creator's zset and the room's proof are written, with the fixed expiry the room then gets.
- `join`: the room's proof must exist and be live, then the admission budget is charged.
- `active` (every read, vote, realtime view): one `HGET` of the proof (the `capacity` mark), expiry on the API clock.
- `command`: reuses `active`'s proof; the command budget is the existing script on the dedicated Valkey.
- Legacy shared-cap reservations in `doc.yepwatch_control` are no longer read: none were added after the cap was
  removed (2026-11-12 ~09:00 UTC) and rooms live 6 h. The control row is no longer written.

**Account checks** (same semantics, fail closed):

- `sessionActive`: `EXISTS {yw}:revoked:<key>`. Log out sets that marker first, then writes Crate.
- Deletion checks: `HGET {yw}:del <id>`. schedule writes the marker first, then Crate, then the marker with Crate's
  state; restore and purge remove it only after Crate did (restore only the marker it saw, then a 10-minute tombstone
  keeps an import that read Crate earlier from writing it back). The minute import adds markers Crate has and removes a
  marker only when a primary-key read confirms the row is gone and the marker is older than 5 minutes.
- While a mirror isn't imported (a fresh or wiped Valkey), these reads use Crate, as before.
- `accounts.remember` (member create/join): the account's zset + an `acct` outbox job, in one `MULTI`. `rooms()`
  (account home, not a room command) merges the zset with the Crate index.
- `accounts.publish` (decisions, inline on `restart` and in `notify`): an outbox job per decision. `history()` reads
  Crate; a decision shows there once its job ran (milliseconds).

## History copy (outbox)

One zset, `{yw}:jobs`: `room:<id>` and JSON jobs `{k:"acct"|"hist"}`; the score is when the job is due.

- Commits add `room:<id>` with `ZADD NX`, so a burst of votes becomes one or two Crate writes. The worker runs in the
  API: kicked after each commit, and every second over due jobs. `ywClaim` leases due jobs (score = now + 30 s, the
  fencing token); `ywDone`/`ywRetry` act only while the lease is still the caller's. Failures back off
  `min(1 s × 2^tries, 5 min)`.
- **Room copy.** Read the room (`v`, body). If `s >= v`, done. Before its first head (`cs` empty) copy the room's
  invite mapping and capacity reservation (with its fixed expiry, merged by CAS into the creator's row), so a Crate
  head never names a room Crate-only code couldn't serve. Mark the write (`w`, `wf` = fingerprint of the head row it
  writes, `wl`; only in the incarnation read), then
  `archive(room, base = cs/ct)`: an `UPDATE … WHERE _seq_no AND _primary_term … RETURNING` (or an `INSERT … RETURNING`
  for the first head, without the live clock fence, so a room expired during a Crate outage is still copied).
  `ywSynced` records the new `cs`/`ct` and `s` (only if newer and in the same incarnation), then drops the job, or
  makes it due again when a newer version arrived meanwhile.
- **Ordering.** Every write is a CAS on the head this store last recorded, and records only move forward, so an older
  state can never land over a newer one, including from a worker whose lease ran out. Equal revisions don't matter:
  the fence is the Crate head itself, not the revision.
- **Refused or unknown.** Markers stay until a write succeeds: a write with a lost answer may still land later, but
  only on the head it was based on, so any later successful write fences it out (and clears the markers). Until then
  a head whose fingerprint is one of the marked writes is adopted (`s` = that write's version), never replaced.
- **Reconcile** runs only inside the room's copy job (holding its lease), with a primary-key head read: head where this
  store left it → consistent (a marker is cleared). Head moved and its fingerprint equals `wf` (the head row names every
  record by content, so equal fingerprints mean equal content) → this store's own write landed unrecorded → adopted.
  Anything else moved it (a
  rollback to Crate-only code, a write Valkey lost) → **Crate wins**: its room replaces the live copy as a new
  incarnation, its revision raised above both (and pending) so phones and the gateway take it, then copied back. The
  replacement is refused if the room or its copy bookkeeping (`v`, `i`, `cs`, `ct`, `w`) changed since it was read.
- Every minute: Crate's live heads (`REFRESH` + search, paged by id) are compared with the live copies (missing →
  imported, different → `x` set and the room's job queued), and every room with `s < v` is queued again.
- Deletion purge runs only while the outbox is empty, so no queued or running copy can bring erased data back.
- History reads (archive, past rooms, account history, retention, deletion purge, `stalePendingIdeas`) keep
  reading Crate. `stalePendingIdeas` only finds candidates; rooms are then read from Valkey.
- Logged: `yepwatch_history_retry` (once per job per 10 minutes), `yepwatch_history_replaced`.

## Failure modes

| failure | effect |
|---|---|
| Crate slow or down | commands unaffected; jobs back off and catch up; account home and history lag; readiness stays green once started (history and catalog checks are exempt after start; a cold start still needs Crate) |
| Valkey down | room commands fail with a retryable 503; readiness red; apps show Reconnecting |
| Valkey restarted (every deploy) | clean stop: nothing lost; AOF reload in ms |
| Valkey crash | up to ~1 s of commits lost from Valkey; those already copied come back via reconcile (Crate wins) |
| Valkey volume lost | rooms read through from Crate until re-imported; commits not yet copied (normally milliseconds) are lost; tickets, budgets reset |
| Valkey full (`noeviction`) | writes fail with OOM → 503; 512 MB is ~3,000 live rooms |
| API crash mid-copy | the lease runs out after 30 s; the next attempt reconciles its marker, then writes the newest state |
| Rollback to Crate-only code | Crate is current to the last copied commit (milliseconds); old code serves it |
| Forward again after a rollback | heads moved by old code are reconciled: Crate wins, revisions raised |

Accepted (owner: losing a few seconds is fine): commits acknowledged but lost before their copy can leave a phone
ahead of the server (its newer revision or command sequence), until the room changes again or the app reloads. A
member's link and unlink inside the copy lag (milliseconds) may never reach Crate's participant rows, so a later
account deletion would not find that seat (it was already turned into a guest seat on logout).

## Migration (no DDL)

- **First start** (`ensureMirrors` before the API answers): imports live revoked sessions, live reservations, every
  invite mapping, deletion markers, and every Crate head live or expired within a day (full read, `ywImport`:
  synced, `cs`/`ct` = that head, pending kept), then sets `{yw}:mirror`. A mirror is marked only when every write of
  its import succeeded; the rooms mirror only when every head was imported (until then misses read through). Rooms open at deploy keep working; their
  next commit lands in Valkey and is copied back.
- Every 5 s the API checks the mirror flags (a wiped Valkey re-imports); every minute it re-imports and reconciles.
- Writes use the existing Crate tables and columns (rooms and records, invitation, account index and history,
  creation quota and reservation, revoked sessions, deletion).
