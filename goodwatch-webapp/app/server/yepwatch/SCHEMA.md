# YepWatch first-release storage

The production release uses three stable table names. Format numbers remain in data so incompatible clients/storage are rejected; they are not public release numbers. Existing development runtimes keep their historical tables. This is an empty-store installation, not a migration of an existing legacy `doc.yepwatch_room` table. The operator must stop on an incompatible existing schema.

The explicit operator provisions these tables with two replicas on the three-node cluster. Application startup never creates tables. Equivalent DDL:

```sql
CREATE TABLE IF NOT EXISTS doc.yepwatch_room (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL INDEX OFF STORAGE WITH (columnstore=false),
  expires_at BIGINT NOT NULL,
  pending_revision BIGINT NOT NULL,
  pending_agreement BOOLEAN NOT NULL
) CLUSTERED INTO 4 SHARDS WITH (
  number_of_replicas=2,
  "write.wait_for_active_shards"='3',
  refresh_interval=1000
);

CREATE TABLE IF NOT EXISTS doc.yepwatch_runtime (
  id TEXT PRIMARY KEY,
  format_version INTEGER NOT NULL,
  key_id TEXT NOT NULL,
  key_check TEXT NOT NULL,
  room_ttl_ms BIGINT NOT NULL
) CLUSTERED INTO 1 SHARDS WITH (
  number_of_replicas=2,
  "write.wait_for_active_shards"='3'
);

CREATE TABLE IF NOT EXISTS doc.yepwatch_control (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL INDEX OFF STORAGE WITH (columnstore=false)
) CLUSTERED INTO 1 SHARDS WITH (
  number_of_replicas=2,
  "write.wait_for_active_shards"='3'
);
```

## Room

One encrypted JSON aggregate per room. The typed source is [ProposalRoom](proposal-types.ts), extending [ContinuousRoom](continuous-types.ts). It contains:

- Identity, revision, six-hour expiry, host and hashed invitation.
- Roster, viewing screens, country/services and constraints.
- Candidate deck, already-seen titles, private votes and active-exposure measurements.
- Current proposal/version, each participant's agreement, final decision and interrupted final-check state.
- Retry receipts, credential epochs, hashed tickets and admission credentials.
- Optional linked GoodWatch subject, encrypted access grant and pending OAuth intents. No account password is stored here.

Only `payload` contains these fields. The clear columns support expiry and interrupted-work discovery. `pending_revision` marks a notification awaiting acknowledgement; `pending_agreement` marks a final decision check awaiting repair. Full-primary-key reads and Crate's system `_seq_no`/`_primary_term` columns implement compare-and-swap.

Expiry makes rooms inaccessible; it does not physically delete ciphertext. Retention cleanup remains separate work.

## Runtime

One compatibility row (`id='proposal3'`, an internal format identifier): format version `3`, operator key ID, a keyed check value (not the key), and `room_ttl_ms=21600000`. Startup refuses mismatched settings. The encryption/signing key stays in a private secret file.

## Control

One JSON control record (`id='proposal3'`), not encrypted because it contains no votes, account data or bearer secrets:

```ts
{
  format: 1;
  fingerprint: string; // hash of immutable capacity/window configuration
  window: number;     // fixed window derived from database time
  rooms: [roomId: string, admissionDigest: string, expiresAtMs: number][];
  admissions: string[]; // granted operation digests in this window
  commands: [commandDigest: string, actorDigest: string][];
}
```

Defaults: 20 active room reservations, 20 admissions/minute, 600 commands/minute globally and 60/actor/minute. Failed/uncertain creation conservatively retains its reservation until expiry. Exact retries do not consume a second grant. The control table is initialized only with an empty room store and quiesced writers.

## Database permissions

```sql
GRANT DQL,DML ON TABLE doc.yepwatch_room TO yepwatch_runtime;
GRANT DQL ON TABLE doc.yepwatch_runtime TO yepwatch_runtime;
GRANT DQL,DML ON TABLE doc.yepwatch_control TO yepwatch_runtime;
```

GoodWatch account tables remain owned by GoodWatch. Signup does not add another YepWatch account table.
