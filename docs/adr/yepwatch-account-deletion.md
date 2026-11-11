# YepWatch account deletion and recovery

Owner-approved 2026-11-11: deletion concerns YepWatch only. GoodWatch is an independent account used for optional sign-in; deleting YepWatch must never delete GoodWatch accounts, preferences, ratings or viewing records. Use soft deletion so people can change their mind.

## Decision

Deletion creates a durable lifecycle marker before leaving rooms. It blocks account admissions and history access, clears room sessions on every device, removes the participant from the active group and transfers hosting when necessary. A new sign-in does not cancel the request. The explicit Restore action removes the marker during a 30-day recovery window. Restoration preserves history and lets the person explicitly return to unexpired rooms; it never extends room expiry or takes hosting from another person.

Guests can request deletion of the rooms and history remembered on their device. Only the original guest room credential can restore that participant. Their recovery copy must remain on that device/browser. Account recovery requires fresh authentication with the same account. Local recovery copies are bound to an opaque account tag and deletion generation, to avoid restoring one account's records into another.

After the deadline, the API's minute cleanup claims requests using primary-key optimistic concurrency and a renewable lease. A purge claim cannot race restoration; failures retain the marker for retry and never silently reopen the account. Cleanup removes expired room versions, account indexes and the deleted participant's identity from shared decision history. Other participants retain their titles and their own history. No live room versions are reclaimed. The lifecycle retains participant targets independently of room expiry; the quiesced room-cleanup operator captures overlapping admissions before deleting their room versions.

The device hides its recovery copy immediately and removes it and known room credentials when next opened after expiry. A device that stays offline cannot be remotely wiped. Other signed-in devices check lifecycle status before exposing account history. Protected server backups include deletion markers; any backup restoration must replay later requests and completed erasures before re-exposing service. A pre-deletion backup is never an account-recovery mechanism after the deadline.

## Installation and operation

This is an additive table migration, not another room reset. Provision `doc.yepwatch_deletion` and its DQL/DML grant using [the migration](../../goodwatch-webapp/app/server/yepwatch/migrations/20261111-deletion.sql), or the new operator's `provision-deletion --apply`, before deploying the API. Production keeps two replicas. Preserve the existing room key, all existing tables and all account data. Readiness checks require the table.

Deploy the new API and Caddy route allowlist before distributing the browser/native UI. `purge-deletions --apply` is the manual retry path using the established operator environment. Normal expiry cleanup still requires stopped writers and a private backup. Never run the old expiry-cleanup operator after this migration: it does not preserve the lifecycle targets.

Validate with the deletion unit tests, the dedicated disposable Crate proof (restart, restoration, expiry cleanup, concurrent purge workers and peer history), and the browser account/deletion tests. The Crate proof refuses a non-loopback endpoint or a port other than its dedicated `15871`.
