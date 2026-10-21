# Visible room creation and membership recovery

Reproduced on **http://127.0.0.1:8099/**, served bundle API **http://127.0.0.1:15997**, WS **ws://127.0.0.1:4317**. Every room in this regression was created through landing-page controls, not a scripted API admission. Local synthetic room storage only; no existing user room or production data was changed.

## Before the fix

The visible journey Continue as guest → nickname → Create a room returned HTTP 200. Creating a second room in that same browser also returned 200. Reopening the first room's invitation then admitted another participant with a new bootstrap, returned join 200 and replaced the browser's same-name room cookie. The original host controls disappeared. This was a membership replacement failure, not a failed clean create request.

The red-capable command was `node scripts/repro-create.cjs`. [Before report](../artifacts/create-before.json), [failed reopened view](../artifacts/create-before-failure.png), [landing](../artifacts/create-before-landing.png). Invite capabilities and room paths are redacted from diagnostic JSON/screenshots. No auth headers, admission secrets or ticket frames are recorded.

## Client fix and actual regression

Entrance resolves the invite and checks the authenticated room snapshot before generating a new participant admission. It restores the server's participant identity, host capability and current state using the existing HttpOnly cookie or native credential. Manual codes use the same guard. A new browser tab can recover from its cookie even without sessionStorage. An uncertain recovery blocks readmission until retried. The backend owner separately added cookie/bearer recovery as defense in depth; the client regression was proven against the **unchanged older API**, independently of that server fix.

`REPRO_PHASE=after node scripts/repro-create.cjs` passes clean create, second create with an existing cookie, direct invite resume with **no POST join**, and a fresh invitation join from a separate browser. [After report](../artifacts/create-after.json), [creation controls](../artifacts/create-after-controls.png), [recovered host](../artifacts/create-after-reopened.png), [fresh join](../artifacts/create-after-fresh-join.png). An independent reviewer also verified new-tab cookie-only recovery and manual-code recovery: [independent UI report](../artifacts/independent-create-ui.json).

## Export configuration collision

During checks, the component-test command was found exporting into the same `dist/` used by the retained 8099 server. A test build could temporarily replace its local API configuration with the default target origin. Tests now export to `dist-test/` and serve only that folder on 8097. Real-adapter work uses `dist-real/` on 8100, keeping the retained synthetic demo separate.

The [isolation check](../artifacts/test-export-isolation.json) verifies the retained export hash is unchanged across the three browser tests. Independent testing in a separate source copy also verified all 40 retained export files and the HTTP HTML/three JS asset hashes were unchanged and retained API15997/WS4317 throughout. The user's exact original create incident cannot be attributed to this timing/configuration issue without their URL/time; that question was returned to the orchestrator, not assumed answered.

## Related confirmed corrections

- Own HTTP freshness is tracked independently of shared push revision and command sequence. Another actor's new round can clear own votes/completion without changing this participant's sequence; older equal-sequence responses cannot restore them.
- Shared updates arriving during a private HTTP repair leave a dirty flag and trigger a follow-up read.
- The request deadline now covers headers **and JSON body**, and composes caller cancellation with the internal deadline. A real loopback server flushing headers then stalling its body is a regression test.
- Private repair failure remains visible while the WS transport is connected. Commands pause until manual Refresh succeeds. [Independent fault/recovery report](../artifacts/independent-private-repair-ui.json).

All four new regression tests were run red before correction and green after correction. Current unit/state/API/reconnect total: **15 passing**. No commits, deployments or unrelated source changes.
