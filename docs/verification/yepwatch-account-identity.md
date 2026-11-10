# YepWatch account identity verification

2026-11-10. Shipped to [yepwatch.com](https://yepwatch.com) and both installed beta update channels. Implementation commit `5c778eb198a945d2d6feb050cf4337785baaed27`; public-proxy correction `0466866906fe17c8569ca155e9bb5f63d5277edb`. Based on fetched `origin/main` `884dbdcc5`; fetched again before both pushes. The rollout evidence below supersedes the original implementation-only verification.

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

### Production activation, 2026-11-10 UTC

- Paused YepWatch automatic deployment and stopped its three containers at 11:32:23. Other applications remained running.
- Backed up all 15 previous YepWatch tables (124 room heads) to `goodwatch-db-backup-v2.yepwatch_pre_account_identity_20261110_5c778eb19`; snapshot state `SUCCESS` before reset.
- Ran the committed operator's explicit `reset-test-data --apply --writers-stopped`. Reapplied the runtime role's table grants, with runtime metadata restricted to DQL. All 19 replacement tables were `GREEN`; runtime marker was `format_version=3`, `room_ttl_ms=21600000`, with two replicas. Operator `check` passed with both operator and runtime connections.
- Preserved the existing room key, key ID, passwords and admission/command limits. The reset affected only YepWatch test storage; GoodWatch accounts, watches, ratings, progress and catalog storage were retained.
- Coolify deployment `78a8a831-732c-4c2e-b2ad-287472e7fd7e` activated the implementation at 11:40:42. The public account smoke exposed missing proxy routes for account home, room resume and archive. Corrected the explicit Caddy allowlist and added `test-public-routes.py` to CI. Its actual Caddy HTTP test reproduces the old `/account/home` 404, verifies the new routes reach an isolated API, and verifies internal/unknown/wrong-method routes remain blocked.
- Coolify deployment `ab5cad93-a4a8-4acb-9e6e-93eee3d9f140` finished at 11:46:45 with commit `0466866906fe17c8569ca155e9bb5f63d5277edb`. All three containers were healthy and their image tags matched that commit. Public readiness returned HTTP 200 with snapshot/catalog/rooms/control/realtime checks all true, contract version 3, member mode. The existing readiness `sourceCommit` field reports `unknown`; deployed source was verified using Coolify metadata and each container's image tag.
- [Implementation CI](https://github.com/alp82/goodwatch-monorepo/actions/runs/42807277205) and [final proxy CI](https://github.com/alp82/goodwatch-monorepo/actions/runs/42809909055) both passed, including disposable Crate integrations and all three repository Docker targets.

### Native delivery

Published compatible JS/assets at 11:41:35; build number remains 16. Native fingerprints matched the installed builds. No new binary or production-store-channel update was created. The proxy correction changes no native JS.

| Install/channel | Update group | Update ID | Runtime fingerprint |
|---|---|---|---|
| iPhone TestFlight / `beta` | `f71c0892-0c5e-4d55-9252-f6bd6e484726` | `01a1c543-7889-7fa5-8fc7-bdd94270123d` | `d170fdc5c8fc2b6651fbf0c52f6f90fded747495` |
| Android Beta / `beta-preview` | `69fe4cf5-a5ca-408d-8d4f-ccbba8cbdfeb` | `01a1c543-7642-782e-98e9-656a69fe67d8` | `e602b9da0532d0b6553acc72b771132638acce70` |

Both channel mappings and the public Expo update endpoint were checked. Each platform received the expected update ID and runtime. Downloaded each launch asset using the manifest's asset request headers and verified its SHA-256 against both the manifest and the local exported bundle. iOS hash: `kxdvpKrM7VV4SN_Ld1HGbFLiOBVTwqaQfcWxpiRfgpE`; Android: `SeXqLbkKGwGSZ01mLCA8J1beq_2q2gCP5fhpq8nNGa4`.

### Live verification and limits

- Fresh public API requests: unauthenticated and forged-login account home, room resume and archive returned HTTP 403 `member_required`; internal realtime attach remained HTTP 404. Account sign-in returned the GoodWatch authorize URL with S256 PKCE and the existing YepWatch callback.
- Ran `YEPWATCH_E2E_ORIGIN=https://yepwatch.com node scripts/room-redesign-multiplayer.cjs` against the final deployment with three independent browser contexts and real catalog/API/gateway. Passed room creation, guest joins, service/idea updates, voting, proposal/agreement, confirmed Tonight decision, watch link and a second round. Received 32/27/25 live room frames. The script also logged four snapshot HTTP 401 responses (`Room credential required`); the joined participants completed every flow assertion.
- Rechecked the backup state, all 19 tables' health, runtime marker, runtime-role operator check and public readiness after activation.
- Cross-device account behavior was covered by the server, browser and real-Crate checks above. This release did not perform a new authenticated production login on two physical devices. Native publication and delivery were verified; physical-device cold-launch execution remains a tester check.

To receive the OTA update, open the beta app online, allow its background download, fully close it and reopen. Sign in to GoodWatch again: previous test rooms and old sealed test logins were intentionally invalidated by the coordinated reset.
