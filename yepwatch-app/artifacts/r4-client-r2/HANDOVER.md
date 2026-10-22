# Corrected R4 client handover

Accepted and committed by root as `932d14c0`. No activation or device operation is included. The corrected immutable source pin is `.expo/review-pins/r4-client-r2/manifest.json`:135files, SHA256 `ffeedc36a22eade4a8c8a7f35759fac61ebe661d9417f514616ab038cee2189e`.

## Hosting inputs

- Static web directory: `/home/alp/dev/projects/goodwatch/goodwatch-monorepo/yepwatch-app/.expo/exports/beta-web-r3`. Copy directory contents into the static document root; preserve all frozen older exports/assets.
- Index SHA256: `fdcc379d6891bd5e45de72af9ce53deed295375242440daee5dccc7804d45570`.
- Export tree SHA256: `a75d41fc31014d7bc4130d41e7bb5704d610ea496f4628d41580b71ba3fe19e6`. Exact32file hashes: `web-export.json`.
- Separate download input: `/home/alp/dev/projects/goodwatch/goodwatch-monorepo/yepwatch-app/.expo/release/preview-download-r3`. Copy `downloads/` into the static document root; `INSTALL.md` is operator guidance. The frozen web directory is not modified by this companion.
- Filename: `yepwatch-preview-r3.apk`, plus `.sha256` sidecar. Intended URL after owner deployment: `https://yepwatch.com/downloads/yepwatch-preview-r3.apk`.
- APK SHA256: `eac3f80e64c5afe0eb7edc18af0e4acb4c558126c5b8c69a3a16f42d985f7061`; size56,900,675bytes.
- Original APK: `/home/alp/dev/projects/goodwatch/goodwatch-monorepo/yepwatch-app/.expo/release/preview-r3/yepwatch-app/android/app/build/outputs/apk/release/app-release.apk`.

Public configuration remains API/app `https://yepwatch.com`, WS `wss://yepwatch.com`, proposal contract3 paths, guest-only and fixtures disabled. Preview Android association uses only the actual `com.yepwatch.preview` certificate; AASA remains absent/404 pending an actual Apple team/application ID. No signing secrets are in any hosting input.

## Compatibility and verification

Every create/join attempt must successfully persist the exact saved bootstrap before calling admission, including after repeated initial/catch storage write failures. Retryable429/503 preserve the bootstrap or exact command envelope across reload; old bare command storage is readable. Manual retry waits for bounded integer Retry-After1..21600seconds (invalid/missing =>2seconds). Deadline expiry only enables Retry. No automatic replay, new answer or proposal agreement occurs;401/403/404/410 precedence remains.

The first R4 pin `r4-client-r1`, code2 APK and `beta-web-r2` are superseded and preserved unchanged. The baseline storage failure was reproduced RED; corrected create/join browser regressions make zero admission calls until persistence succeeds, then send the unchanged original bootstrap. Native SecureStore adapter exception propagation is unit-tested with injected writes; that is not device execution. Ten-file delta from that pin: `changes-from-r1.json` / `incremental.patch`.

Owner verification:54unit tests,40browser tests, typecheck, lint0errors with one existing legacy unused-View warning; six focused retry unit/seven browser regressions pass. Root independently verified135source/32export hashes, APK/download identity and staged APK source, and reran six units/seven actual beta-web-r3 browser regressions. Actual Android ARM64+x86_64 release build passed in2m53s; bundled JS and original preview certificate verified. Native/web source-map resolution is isolated, with no webapp/server imports (`resolution.json`).

Package `com.yepwatch.preview`, version0.1.0/code3, same dedicated private preview signing identity for upgrades. Cert SHA256 `7A:4B:9F:AA:19:4C:06:82:22:94:0E:BE:16:61:AB:6F:8F:D3:D7:14:78:5A:15:BF:76:D2:33:52:A9:75:2D:1D`. This is not a production/store ownership key. This code3 APK was not installed/launched; no physical phone, retained runtime or room was modified.

Readiness/guest-beta/R4 source pins remain intact. Retained8133 index is still `a1cc7879a95f3cd1d634eb8c7621be097b6b90df35addc6e82e3b439bd4ba93c`; CI Metro8141 health is running (`retained-state.json`). No auth/refresh changes, commits by this thread, push, deployment, account creation or store submission occurred. Public/physical/iOS validation remains separate. Hosting owns the authorized isolated corrected R4 rehearsal and its eventual evidence; no rehearsal outcome is claimed here.
