# Independent YepWatch continuous implementation review

2026-10-22. **Gateway/simulator stage only.** Base HEAD `39b3927d97ec724b3d1da56c5684ed55223e41c4`. Reviewed immutable gateway source against the settled continuous state spec and portable contract2. Prior foundation/simulator reports remain unchanged. Backend runtime below is an explicitly pinned test dependency with member endpoints disabled, not a final backend/member-auth review. App/auth owners have not supplied ready review pins to this stage; no whole-implementation sign-off is given.

## Disposition and actionable finding

**No unresolved must-fix gateway/simulator code finding remains on the fixed pin.** One P2 local simulator correctness defect was independently reproduced, sent immediately to its owner/root, corrected by the owner and independently verified closed. No actual private vote/current-card/pick-owner disclosure or gateway command-authority bypass was observed.

**P2, closed on source: concurrent late admission and fresh-demo replacement mix room identities.** Original `yepwatch-realtime/simulator-continuous/engine.ts:135` checked starting/actor busy/pending but omitted an in-flight `adding`; `ui.js:12` left Create enabled then. At `engine.ts:169` a delayed join could append its old-room actor after Fresh replaced the room. Actual isolated reproduction: hold an already-successful late-join HTTP response; wait for existing actors to become idle; request Fresh. It creates a replacement host/setup, then fails “Another guest admission is in progress.” Releasing the join appends the old actor and throws “Projection room mismatch,” leaving mixed-room controller state. This is a devtool correctness/isolation failure; it did not demonstrate access to arbitrary retained user rooms.

The fixed `engine.ts:139` checks admission activity and reserves startup before its first await; `engine.ts:166` separates public late admission from internal fresh setup; `engine.ts:180` checks closed/generation/room before actor insertion. Connection setup also fences delayed tickets; UI disables Create/Add while admission is active. Independent identical held-successful-join replay now rejects Fresh **before any replacement create POST**, retains the original room, and admits the delayed actor into the correct roster. Original and fixed reproductions are preserved. The owner's extra close-during-held-join regression was inspected; that variant was not separately repeated by this reviewer.

## Independently exercised evidence

- Original default suite: **26 pass, 5 explicit opt-in skips**. Fixed: **26 pass, 6 skips**; both build/typecheck pass. The added live admission regression is deliberately opt-in. Owner full suites (32 originally, 33 after correction, zero skips) remain attributed results.
- Created unique disposable **Crate5.10.16 and Valkey8.1 containers**, loopback ports32773/32772, independent random room/service secrets, isolated tablev2 and synthetic catalog. Started the copied actual API plus **two actual gateways**, three independent authenticated identities and additional device sessions. No retained API/app/gateway/broker/controller was used, restarted or mutated. All review processes and both review-created containers were stopped/removed; `cleanup.json` records ownership.
- Actual API ticket replay and wrong-room use reject without snapshots. Authorized room snapshot precedes activity-session acknowledgment. Reconnect requires a different server session; using the previous session closes the new socket. A second device of the same actor receives no own-actor activity; disconnecting one session leaves the other live and preserves required membership. Legacy WebSocket path rejects and legacy health path is absent on the v2 gateway.
- Strict nested projections accept immediate matches and anonymous `candidateId,pickCount` only. Actual unanimous votes produce a match; aggregate picks and automatic checked decision reach all remaining subscribers. No completion/proposal/host-finalize command is used. These transport checks exercise the API dependency's behavior without constituting independent backend/CAS/auth sign-off.
- Cross-gateway activity has server actor/room/session/time, view TTL bounded by6s, no target/value/direction/coordinates. Duplicate sequence is suppressed; burst input accepts/coalesces only the first eight session frames. Client extras/forged actor/time close the socket with a code-only error; canary values never reach observers. Broker-side TTL probes reject expired views and strip pulses older than1.5s; these are controlled trusted-broker payload probes, not claims that unauthenticated clients can publish activity.
- Dropping one gateway's revision listener verifies periodic authorized audit repair of a missed hint over the real broker. Killing only the review broker's Pub/Sub connections causes degradation, recovery and an authorized resnapshot; pre-outage activity is not replayed. Fixture tests separately cover authority revocation, expired leases, initial authorization gaps, invalid nested metadata, backpressure and1012 drain. Full network partitions/clock skew and distributed capacity were not independently proved.
- Actual continuous simulator uses fresh separate guest credentials; host/arbitrary actor IDs cannot issue bot actions. Injected lost acknowledgement **after committed vote** retries the identical ID/sequence/body and yields one own answer; another bot's card/answers remain independent. View-only activity has no answer pulse; Pause/Resume invent no actions; an acknowledged artificial vote emits only a neutral release/answer beat. Separate ephemeral controller processes retain different port-qualified HttpOnly/Strict control cookies, reject each other's cookie/Origin, and protect SSE. Neither controller attaches retained rooms.

## Source, reproducibility and drift

Review workspace: `/tmp/yepwatch-continuous-review-20261022/`. Source manifests exclude dependencies/build artifacts; dependency links used for execution point to installed packages, while each gateway copy resolves the portable contract to its own pinned package. API support has its own manifest and was never reviewed as final auth/catalog implementation.

| Snapshot | Exact manifest SHA-256 |
| --- | --- |
| Original35-file gateway pin, `manifest.json` | `bdc6c7dfcbf68bb74f1df319fbd14a1c26626f30d9089130c1a7c4a7af2ad84a` |
| Original portable contract companion, `contracts-manifest.json` | `bd0c9e8791963b1772e716554eccead13d37aaf06022d27429729f9fa05decb7` |
| Fixed41-file gateway/contract pin, `fixed-manifest.json` | `08d071f1fabc221ac38c5ea7b975c20b6dbc4f6f348c46f6bc271c0399d99398` |
| Exact original/fixed deltas, `changed-manifest.json` | `64cb6557dcf932a9d8486f0df3414e686d3b4291a248b1947dbac89c9640692d` |
| API fixture dependency, `api-support/MANIFEST.sha256` | `edb92fb8afa24a2ca19c644ecc44626b7b86b578e454587e09790383d22cfd17` |

Original/fixed code is in `gateway-source/` and `gateway-fixed-source/`; fixed simulator engine SHA-256 `e4c3bff08898f7cc8b94623f887ff6800c72cc332baf7a75419c640c3cce5de8`. Gateway core (`src/`) is unchanged by the P2 correction. Other fixed-pin deltas are UI/regression/runbook and the standalone/manual proof helpers, inspected as source and not run against retained services.

Scripts/results: `independent-baseline.ts`, `independent-baseline-result.json`, `original-race-result.json`, `independent-fixed.ts`, `independent-fixed-result.json`; safe suite/build logs and `source-recheck.json`. Run the source script using the installed realtime `tsx`; `start-stores.mjs` creates only uniquely named new stores. Scripts intentionally require their own `owned-stores.json`; the recorded ports no longer have those review stores after cleanup. The fixture scripts synthesize their own credentials and do not need a real env file. Recreating stores changes the dynamically assigned ports.

Final checkout recheck confirms the reviewed gateway/activity/simulator implementation remains exact. Only three later paths differ from the fixed pin: `test/continuous-live-smoke.ts`, package `README.md`, and `README-continuous.md`; they were copied separately under `later-doc-helper-evidence/`. Owner describes the helper delta as configurable real-sample provider/mode and an optional-activity assertion correction. These changes are not substituted for the executed pin.

Source/check archive: `gateway-review-sources-and-checks.tar.gz`, SHA-256 `044481033d60596b1e550157644f9b941b0408512a039c05370c541aa9c00f1a`. It preserves both source pins, API support, independent scripts/logs/results and sanitized owner evidence, without dependencies/build output or runtime secrets. This note is the reviewer's only repository write; no implementation edits, commits or pushes.

## Limits and readiness

Owner visible Glow proof (fixed32 shared/17 activity frames, zero JS errors) and later finite-real-catalog protocol proof (seven real cards/six trailers) were reported separately, not independently rerun here. The reviewer did not run any retained proof script, opted-in hardcoded live tests, real user room, GoodWatch account flow, native device or production infrastructure. Single-instance Valkey was exercised independently; three-master/compiled-service cluster evidence remains owner-attributed/fixture-scoped.

Backend/member auth/catalog and the Glow app require their own immutable ready pins and review. This stage does not establish saved-history continuation, progressive-retention/CAS race safety, protected reload recovery, account linking or real-client activity TTL rendering. Gateway source validation cannot prove how an unreviewed client renders or repairs state. No synthetic actors belong in the real product; only the isolated operator simulator created them here.

At owner handover, retained8122 remains the pre-fix simulator; owner reports separately starting fixed8124. Neither was accessed by this reviewer. Source verification is not a statement about every retained process. Prior security/cookie/private-repair baseline checks passed in the safe suite; no speculative production hardening or cosmetic rewrite is proposed.


## Narrow real-simulator configuration companion (2026-10-22)

**Passed; no new finding.** Reviewed the separate final-source companion without replacing either original/fixed pin. Every gateway executable `src/` hash is identical to the passed fixed pin. Simulator changes add a validated optional positive safe-integer service ID (default1), explicit `synthetic|real-sample` label (default synthetic), and server-only environment wiring. The setup uses exactly that provider; no extra API/account/storage authority or service fallback is introduced. Existing fresh/admission/generation/close fences remain intact.

Independent checks on the companion: **26 tests pass, 6 opt-in skips; build/typecheck pass.** A focused independent harness rejects14 malformed constructor configurations and verifies defaults/valid IDs. Four malformed server environment configurations exit before any API request. Actual temporary controller processes against a copied memory API/gateway with synthetic doubles exercise both default1/synthetic and explicit8/real-sample: setup retains DE, the exact provider, confirmed screen and guest kinds; request-body provider337/catalog extras cannot override the server environment. Session notices carry the configured label. These checks establish configuration behavior; the `real-sample` label is descriptive configuration, not independent attestation that the API returned real catalog data. All temporary processes are closed; no retained stack was accessed.

The browser helper's candidate-count parameterization and separate `continuous-simulator-real-*` artifacts were inspected. The manual protocol helper correctly makes gesture/beat optional while retaining its allowed-field list. Neither helper was run against retained services. A later helper-only change permits the real app's “Inspect N matches” label alongside “Inspect N shared matches”; it was read and separately pinned, not substituted for the frozen source or claimed as a browser run. Owner real seven-card/six-trailer proof remains attributed.

Companion workspace `/tmp/yepwatch-continuous-review-20261022/real-simulator-companion/` preserves:

- `manifest.json`: final41-file source/contract pin, SHA-256 `2dd3acd664de401b473138b3f36fc99c44bd7946fee3c80ea336478c4edada35`.
- `changed-manifest.json`: exact before/after deltas from the reviewed fixed pin, SHA-256 `c09f26ff1a835d33e6a0d50cd873d6a561e283db153fecd80d800a24aaa6a344`.
- `independent-config.ts`, `independent-config-result.json`, safe test/build logs and `source-recheck.json`. At cutoff all final-pin paths match checkout except the separately preserved selector-only proof helper (`later-proof-helper/`, SHA-256 `4170cab4fd3dd279d029166c89acca21357f8af1033eb05f5c1d0655bcf7bc21`).
- Dependency/build-free `companion-sources-and-checks.tar.gz`, SHA-256 `ea26881ab36f6c6b74ebe3d2c27a562f316fffd7c1fba2f68e661336be6c8ccc`.

This companion does not change the pending backend/member-auth/app review scope or establish native-device, real-client or real-catalog readiness. No implementation edits or commits were made by the reviewer.
