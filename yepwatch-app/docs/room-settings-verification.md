# Shared room settings verification

Local implementation based on `445f1d83`, checked on 2026-10-23. No public deployment, account registration, production migration or physical-device actions were performed.

- 56 client unit tests and 46 browser checks passed. Browser checks include room prompt save/reload, provider/country controls, leave-to-start, existing interaction/retry/Undo flows and compact layouts.
- 43 backend tests passed; four explicitly opt-in cases skipped. Includes active-roster matching, host transfer, empty-room rejoin, exact departure recovery, prompt publication/ranking and retryable interpreter failures.
- Two actual disposable Crate tests passed: concurrent publication/restart and format-1-to-2 migration. Migration preserves existing votes/decisions/credentials, refuses a stale backup before DDL, recovers after an interrupted publication, removes screen columns/table and stores typed room intent/departure fields.
- Existing central issuer integration passed with disposable identity and captured verification mail: registration, verification, consent and browser/native protocol return. This is not public mail delivery or physical Android callback proof.
- 35 gateway tests passed; nine opt-in tests skipped. New room-description capability preserves older strict projections.
- Client/gateway typechecks and builds passed. Client lint has one pre-existing warning. The full GoodWatch typecheck retains its 181 baseline diagnostics; changed-path diagnostics were zero.
- Web export and signed ARM64/x86-64 Android preview build 6 passed. APK signature verified. No installation or launch of this build is claimed.

Local evidence and build metadata: `.expo/evidence/room-settings-r1/`. Web export: `.expo/exports/room-settings-r1/`.

APK: `.expo/release/preview-r6/yepwatch-app/android/app/build/outputs/apk/release/app-release.apk`.

SHA256: `6f98634ece2f66f558ac9110d57bde363d1c7aa4e0af6246cf7bf746efe7c40e`.

Jev integration reuses GoodWatch's interpreter/ranker. Tests prove its authenticated adapter and that returned ranking changes actual eligible cards; live public Jev execution is pending service configuration. One reading supplies a bounded result set (currently up to 100 titles), with no unrelated fallback when exhausted. Voice input uses mobile keyboard dictation.

[Deployment order and required configuration](room-settings-deployment.md) must be followed before using the new build against production. Existing runtimes and user rooms remain untouched.

## Dropped-place refinement

The later product clarification supersedes the original leave semantics: the roster keeps a visible dropped participant; answers and card position are retained; same-device return restores the same identity. Dropped votes do not constrain matches or agreement. Returning before completion restores required participation; a completed decision remains final. If everyone drops, the room stays intact until expiry. Rejoining without the saved cookie/native credential creates a different identity rather than reclaiming someone else's place.

Additional checks cover native authenticated return, repeated return without duplicate places, preserved private Nope answers, active-only matches/agreements, return after Done, durable return through a new repository instance, and the visible mobile Dropped marker. Old clients receive a compatible active-only roster; updated clients receive the full roster and status.

Preview build 6 and the first room-settings web export predate this refinement. Updated artifacts are Android preview build 7 and `.expo/exports/room-settings-r2/`; local result metadata is in `.expo/evidence/dropped-place-r1/`. No installation or public activation was performed.

Refinement results: 56 unit tests passed; browser run had 46 passes and one asynchronous fixture-read race, then all three targeted checks passed after waiting for the vote request. Backend: 46 passed/four opt-in skipped. Gateway: 36 passed/nine opt-in skipped. Actual Crate migration and same-place return passed. Client typecheck/lint passed with the existing warning; full GoodWatch diagnostics remain the same 181 unrelated errors. Android build 7 and web export passed.

APK 7 SHA256: `f50d852b5a754d7d5a016267821b93624793399e35cc5c61bac381268a1d59aa`.

## Combined saved-provider defaults

The room now exposes only the union of active linked members' saved provider IDs, without attributing providers to individual people. Initial settings preselect that union filtered by the shared country. An explicit room edit is preserved; the host can apply the current union using “Use everyone’s saved services.” Guest/unavailable/dropped accounts do not add defaults.

Focused backend: 21 passed. Gateway: 36 passed/nine opt-in skipped, including old-client projection compatibility. Client typecheck/lint passed with the pre-existing warning. Web export: `.expo/exports/room-settings-r3/`. The signed preview APK 7 predates this additional default-selection refinement and must be rebuilt before shipping these latest changes. No public configuration or runtime was changed.

Provider browser evidence: the prompt/leave/dropped checks passed, and the new default/override check passed after correcting its setup-button locator and waiting for confirmed save before reload. It verifies initial union selection, unavailable-provider filtering, manual deselection surviving reload, and explicit restoration of the union. Logs are preserved in `.expo/evidence/provider-defaults-r1/`.
