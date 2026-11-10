# Account identity release

The API, browser app and native app must deploy together. Account identity supersedes the device-local room index: one GoodWatch account has one participant per room, with separate device credentials and command receipts. Leave applies to the participant on every device; logout revokes just that login. Host rights follow the current host participant. Server decision history survives room expiry and new rounds. Guests can still participate locally; signing in claims their remembered live guest rooms, preserving answers or resuming an established account place. An existing account place wins conflicting guest answers; merging never invents an approval. Expired anonymous history is not imported from unverified device records.

The owner confirmed that all existing room entries are tests and may be removed. Runtime marker 3 requires the new strict schema; there is no automatic upgrade. The reset affects YepWatch rooms, invitations, device sessions, account indexes, history and capacity bookkeeping. It does not delete GoodWatch accounts, saved progress, ratings or watches.

1. Build the API/operator bundle with `node app/server/yepwatch/build-release.mjs` from `goodwatch-webapp`. Export the browser and native JS bundles using the established release environment. No native dependency was added.
2. Stop all YepWatch API writers. Keep the old client unavailable while replacing storage and the API.
3. With the established operator connection and secret environment, run `node operator.mjs reset-test-data --apply --writers-stopped`. Production retains two replicas. `--disposable-single-node` is accepted only for a loopback test database.
4. Reapply the runtime role's DQL/DML table grants from [DEPLOY.md](../../yepwatch-realtime/release/DEPLOY.md), including the new history/index/revocation tables. Dropping tables can remove their old grants. Keep the operator credentials separate from the API role.
5. Run `node operator.mjs check`, start the new API, and verify readiness before publishing the new browser/native bundles. The gateway protocol is unchanged; leases now bind to a login session as well as a participant.
6. Sign in to the same GoodWatch account in two independent browsers or on browser/native. Create a room on one, discover it on the other without an invitation, verify a single roster entry and shared votes/host permissions, then decide and verify both histories. Log out on one and verify the other remains usable. Leave on one and verify both show Left; explicit Return restores the same place without taking hosting back from its current holder.

Normal `purge-expired --apply --writers-stopped` first copies committed decisions to durable history and then deletes expired room versions. It does not delete account history or logout revocations. Backup includes the new account tables; these contain private account relationships and must remain private.

No production reset or deployment is performed merely by building, running unit tests or running the isolated CrateDB integration test.
