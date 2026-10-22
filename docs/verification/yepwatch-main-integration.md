# YepWatch integration onto main — 23 October 2026

Integrated the YepWatch-owned paths from `be86322f` onto current main `6b1c1190`, without merging the feature branch's unrelated TV, scoring, imports, competitor research or fingerprint artifacts. The integration includes the app, gateway, backend/contracts, owned route/docs/evidence and the small shared issuer/verification/snapshot-reader changes.

The sole three-way conflict was two new imports in the shared auth runtime. Both were preserved. Main's account analytics, provider-supplied ID handling, DPoP rejection and discovery handling remain intact. Main's package manifests and unrelated application source are unchanged.

Deployment entry is now `yepwatch-app/compose.yaml`; its `..` build context reaches the repository root. Coolify uses main, base `/`, Docker Compose, path `/yepwatch-app/compose.yaml`, and the front domain's internal port8080. The GitHub workflow runs checks on main and does not deploy or publish images. The owner still controls Coolify.

## Verification

- All three repository Docker targets built on integrated main. The existing GoodWatch production build and precompression passed.
- App typecheck,55 unit tests and lint passed (one inherited unused-import warning).
- Gateway typecheck,33 tests passed;9 opt-in suites skipped.
-41 backend/domain/policy/disposable Crate cases passed across the initial run and targeted rerun. The initial control test lacked its local operator bundle; CI now builds that bundle before tests, and the actual control/restart/backup/cleanup test passed on rerun. The separate relational concurrency/restart test passed on the initial run.
-37 shared auth/MCP endpoint regressions passed. Shared auth typecheck passed after installing this checkout's locked dependencies and conformance dependencies.
- Actual disposable issuer signup, locally captured email verification, consent and browser/native-protocol return to the same guest/host passed. Corrected an inherited test assertion from the nonexistent `hostId` field to `hostParticipantId` and checked it against the admitted actor. No production account/permission changes or physical-device proof.
- Compose interpolation checks passed for shared and separate named Redis credentials, required secrets, no secret build arguments and no public host ports. Actionlint passed.
- Changed-source whitespace checks passed. Two inherited evidence/license files retain their original whitespace (the archived incremental patch and Gabarito license); they were not rewritten.

Owned disposable containers were removed. No retained runtime or phone actions were performed. No Coolify, production database/Redis or issuer configuration was changed. Existing source manifests describe their historical pins, not this new integration. Public deployment and physical-device checks remain after owner configuration.
