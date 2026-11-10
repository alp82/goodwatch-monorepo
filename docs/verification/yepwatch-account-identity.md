# YepWatch account identity verification

2026-11-10. Implemented on `feat/yepwatch-account-identity`, based on fetched `origin/main` `884dbdcc5`. No production database reset, account change, native publication or Coolify activation was performed.

## Behavior verified

- Independent browser logins and native account headers resolve one participant per GoodWatch account per room. Concurrent joins through separate API/repository instances allocate one place.
- Each device has a separate credential and command sequence/receipts. Votes and approvals belong to the participant; stale concurrent votes conflict, and exact retries remain idempotent.
- Another device lists and resumes hosted rooms without an invitation or saved device credential. Archive metadata and current host rights are shared. History remains visible with no active room or display name.
- Explicit Leave affects all sessions. Listing/signing in does not rejoin; Return is explicit and preserves the participant without taking back hosting from its current holder.
- Logout revokes one login and its realtime leases while retaining membership and other devices. Replaying its sealed login cannot mint new access. Lapsed-login logout needs no issuer refresh.
- Guest upgrades retain answers and host rights. A conflicting temporary guest place resolves to the established account place without combining votes or approvals; the original account device remains authorized. Lost upgrade acknowledgements recover the same place.
- The server publishes confirmed decision snapshots independently of client observation. Pending projection survives process interruption and room expiry; history survives a new round, expired-room removal and a real CrateDB restart. Unpublished room versions are not a history source.
- Late responses after an account switch cannot repopulate the earlier account's cache/session. Pending commands use a credential-specific storage namespace.

## Checks

| Check | Result |
|---|---|
| `node --test goodwatch-webapp/app/server/yepwatch/*.test.ts` | 163 passed, 7 optional integrations skipped |
| `YEPWATCH_TEST_RELATIONAL_CRATE=1 node --test goodwatch-webapp/app/server/yepwatch/proposal-relational-crate.test.ts` | Passed with a fresh loopback CrateDB 5.10.16 container, including database restart; container removed afterward |
| `npm --prefix yepwatch-app test` | 187 passed |
| `npm --prefix yepwatch-app run typecheck` | Passed |
| `npm --prefix yepwatch-app run lint` | Passed; existing unused `View` warning in `src/features/Voting.tsx` |
| Browser `account-rooms.spec.ts` + `member-return.spec.ts` | 11 passed on the final source/export |
| Full browser suite during implementation | 161 passed, 2 viewport overflow failures |
| Clean-main viewport comparison | Same overflow reproduced on unmodified `884dbdcc5` (5/6 repetitions passed; desktop overflow 540px), confirming an existing intermittent layout failure |
| Backend YepWatch typecheck | Output identical to clean-main baseline; existing errors include country/discovery JSON typing and `Object.hasOwn` library target |
| Gateway tests/typecheck | 41 tests passed, 9 optional integrations skipped; typecheck passed |
| `node goodwatch-webapp/app/server/yepwatch/build-release.mjs` | API/operator bundle and snapshot worker built |
| `npm --prefix yepwatch-app run export:native` | iOS and Android JS bundles exported; no physical-device or store publication claim |
| `git diff --check` | Passed |

API/browser tests use controlled issuer/catalog doubles. No local GoodWatch webapp using the production `.env` was started. The isolated SQL test checks account locators, private decision entitlement filtering, independent sessions and durable logout against the actual typed schema.

## Rollout

The accepted model is recorded in [ADR 0015](../adr/0015-yepwatch-account-identity.md). Follow [the coordinated reset and deployment procedure](../../yepwatch-app/docs/account-identity-deployment.md): stop writers, explicitly reset only YepWatch test tables, reapply runtime grants, check the new API, and publish the browser/native clients together. Runtime marker 3 rejects the previous test schema. Keep existing room keys, database passwords, GoodWatch accounts and saved tracking intact.
