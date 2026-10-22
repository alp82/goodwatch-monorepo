# Automatic lobby readiness: immutable review handoff

Source pin: `.expo/review-pins/auto-ready-r1/manifest.json` (120 files), SHA256 `417f73179ce97fb201cb79646fee0b797dfa6ea2efb3cf9354b0042bf8c05c10`.
Staged export: `.expo/exports/ready-r1`; index SHA256 `a1cc7879a95f3cd1d634eb8c7621be097b6b90df35addc6e82e3b439bd4ba93c`.
Exact file hashes and public configuration: `staged-export.json`.

Fresh isolated browser contexts loaded staged static JS/assets over the existing real loopback document. API15992 and WS4324 were unmocked. Four identities completed ordinary create/join, automatic couch assignment/readiness, Start, voting, proposal/withdraw/replacement, reload Undo, late join, and fresh unanimous Done. Result: `connected-browser.json`, 95 shared frames, 66 activity frames, zero JS errors. Catalog remains a finite real local sample in isolated durable Crate.

Focused recovery tests cover explicit multi-screen selection, missing context, same-screen no-op, context/roster changes, failed read/write and lost-response exact-envelope retry. 46 unit tests, 8 focused browser tests, previous full 31-browser run, typecheck and lint pass (existing legacy unused View warning only).

## Activation after root checks this pin

1. Preserve `.expo/exports/hybrid-r2` and the old index. Copy the new export's hashed assets into that currently served directory without deleting ANY old assets. Copy non-index files first. Atomically replace only its `index.html` last. Server8133 need not restart. Old open tabs retain old bundles/chunks; a normal future navigation/reload gets the new index. Rollback atomically restores the old index; old assets remain available.
2. For Metro8141, preserve its current isolated source. Copy ONLY these pinned runtime files into `.expo/native-build/hybrid-r1/yepwatch-app/`: `src/core/continuous/lobby-entry.ts`, `src/features/glow/useLobbyEntry.ts`, `src/features/glow/Lobby.tsx`, `src/features/glow/Room.tsx`. Preserve the isolated native app configuration and package. Restart only its CI Metro listener with the existing15992/4324/8133 configuration and cleared transform cache, without launching an app, sending a reload, enabling Fast Refresh, or issuing any adb action. New code becomes available on the user's next normal dev-app open/reload. This is a JS-only update; existing APK stays installed.
3. Verify HTTP index/bundle hashes and the Metro health endpoint read-only. Record activation separately. Do not mutate any room or physical device.

Nothing above has been activated. Retained8133 index still SHA256 `7c315a2ddbce3f3ef9dcf91a7bccd8f2323c6c3ae674c8f667f841e2c5fc577a`; retained8141 source/process and the user's room are unchanged. Release packaging starts only after this pin and is separate.
