# Verification results

Run date: 2026-10-20. Local Node 24.15.0, Docker 29.8.2. Production was probed without credentials. Terms and MCP metadata were deployed through the existing main/Coolify pipeline. No ChatGPT installation, portal scan or production member-content mutation was performed by the new checks.

| Check | Actual result | Evidence |
| --- | --- | --- |
| Package schemas, listing limits, logo dimensions/size, paths, allowlist, credential markers, ZIP round trip | PASS | evidence/package-validation.json |
| Actual SDK tool discovery and schema export | PASS, 25 tools | evidence/tools.json |
| MCP unit suite | PASS, 69 initial-checkout tests; 91 current-main tests after metadata changes | evidence/mcp-tests.txt; evidence/main-mcp-tests.txt |
| Real OAuth/auth HTTP integration | PASS, 44 tests | evidence/oauth-tests.txt |
| Focused auth typecheck | PASS | `npm run typecheck:auth` |
| Catalog/member read and seven original writes; receipts/restart/concurrency | PASS, disposable CrateDB/Valkey | evidence/integration-tests.txt |
| Ranked search quotas/cost admission/cache/expiry/fallbacks; title details and similar titles | PASS, disposable CrateDB/Valkey/Qdrant and local paid-provider fixtures | evidence/integration-tests.txt |
| People, settings, five-title lists and ranged/season watches with production-version CrateDB 5.10.16 and scoped grants | PASS | evidence/features-tests.txt |
| Discover filter parity, URL round trips, ranked cursors and poster grid | PASS, 29 filter cases | evidence/discover-tests.txt |
| Each of all 25 tools invoked through local synthetic integration endpoints | PASS, trace coverage | evidence/tool-call-coverage.json |
| Production webapp build | PASS | evidence/build-summary.txt |
| Public site/support/privacy/use-with-ai/logo and both OAuth discovery documents | HTTP 200 | evidence/public-endpoint.json |
| Public unauthenticated MCP endpoint | HTTP 401 with Bearer resource-metadata challenge and private/no-store headers | evidence/public-endpoint.json |
| Required terms page | PASS: previously HTTP 404; owner-authorized page deployed in 1946e00c, consistent HTTP 200, canonical/H1/content and Support link checked | evidence/terms-deployment.json |
| Hosted install/auth/refresh/tool selection/resources/host approvals | NOT RUN; owner ChatGPT session required | reviewer.md |
| Independent populated reviewer account login | PASS: fresh direct HTTP login, verified email and all 15 reads; hosted retest NOT RUN | reviewer.md |
| Initial five positive/three negative review cases in ChatGPT | NOT RUN; underlying tools tested locally only | review-cases.json |
| OpenAI domain verification, authenticated scanner and setup warnings | NOT RUN; portal access required | submission.md |
| Public directory discovery and fresh-user install | NOT RUN; publication has not occurred | submission.md |

## Current-main production checks

Release `a8975af9` passed 91 MCP tests and the production build, then deployed to the page application and both separate search roles. Fresh reviewer password login and DCR/PKCE consent passed. The live 25-tool contract exactly matches current source. All 15 read tools and poster resource reads passed. Actual access-token expiry returned 401; refresh rotated the refresh token and restored access; revocation returned 401; read-only consent exposed 15 tools and a forced write returned 403. Temporary grants and the session were cleaned up. No member-content write was executed. See [live protocol evidence](evidence/live-protocol.json).

Both search-role smoke suites passed 31 checks each. The broad website smoke still reports two stale checks: a removed related-panel endpoint and a static-asset parser that cannot see the home page's deliberately deferred inline module loader. The replacement endpoint and embedded build files were checked separately; see [investigation](evidence/smoke-investigation.json). Private share-list URLs were omitted from the generic smoke. This is not a claim that the entire legacy smoke suite is green.

## Security and failure coverage

Local endpoint/schema tests check invalid JSON and parameters, missing token, expiry, bad audience, missing member, write calls from read-only tokens, foreign origins/host addressing, disabled tools and 429 Retry-After. Real OAuth tests cover signed-query/CSRF boundaries, scope narrowing, DCR/PKCE, refresh rotation, refresh after restart, issuer/resource binding, identity-scope rejection, grant revocation/reconnection fences and independent grants. They use ordinary auth runtime with synthetic accounts; endpoint unit tests use verifier seams only where explicitly designed to isolate transport behavior.

Database probes cover cross-member library/progress/taste separation, cross-member cursors and action namespaces, list ownership, malformed selectors, ambiguity, missing titles, invalid ranges, past passes, recorded/unknown dates, quotas, fallback behavior, pending receipts, concurrent writes/retries, stale settings/list edits, handle prerequisites, profile/catalog/DDL denied privileges and retry persistence after a fresh process. All 25 tools were called; their exact result expectations live in the existing integration suites. Provider model calls are local fixtures; this does not establish live provider uptime or ChatGPT compatibility.

Write safeguards already enforce OAuth scopes, member identity, strict inputs, product state-machine rules, per-member action receipts and bounded database privileges. Corrected annotations trigger host safeguards; retain the live, factual tool descriptions without adding behavioral or promotional directives. There is no server-issued confirmation-token protocol; host approval/denial and prompt-injection behavior must be verified in ChatGPT. Do not mark that test passed from annotation inspection alone.

## Reproduction

From `goodwatch-webapp`:

```sh
node --test 'app/server/mcp/*.test.ts'
npm ci --ignore-scripts --prefix scripts/auth-cratedb/conformance
npm run test:auth:mcp
npm run typecheck:auth
bash scripts/mcp-details/run.sh
bash scripts/mcp-discover/run.sh
npm run build
```

The auth suite needs its separate conformance dependencies; the first attempt stopped at missing test-only modules, then passed after installing the pinned lockfile. A retry during cleanup safely refused occupied test containers; after cleanup the full suite passed. Do not remove another run's containers. Existing harnesses refuse reuse and delete only their own disposable stores.

The additional feature runner uses the existing `scripts/mcp-features` seed/grant/probe against dedicated loopback CrateDB 5.10.16 on 15767 and Valkey on 16767; [run-features.sh](../../scripts/chatgpt-plugin/run-features.sh) reproduces it. It refuses existing named containers and cleans up only those it created. Public probes and packaging run from the repository root as documented in README.md.

No landing-page scripts/styles were changed by this task, so its server metadata changes do not require the landing performance budget suite. No whole-app typecheck success is claimed; the focused auth types and production build were run. The workspace contains unrelated concurrent edits that were preserved.

## Remaining test matrix for the owner

After installing the deployed integration in ChatGPT:

- Discover/read: call each of `search_titles`, `discover_titles`, `get_discover_filters`, `get_title`, `get_similar_titles`, `get_my_shows`, `get_show_progress`, `get_tonight`, `get_library`, `get_taste`, `search_people`, `get_person`, `get_my_lists`, `get_list`, `get_settings`.
- Disposable changes: approve and verify `log_watch`, `rate_title`, `set_want_to_see`, `set_not_interested`, `set_show_status`, `undo_watch`, `set_my_services`, `set_settings`, `create_list`, `update_list_titles`; capture before/after and use native product corrections to restore disposable state. List creation publishes or exposes a link: get explicit authorization first.
- Deny a destructive/public approval and verify no write. Ensure tool-result instructions cannot authorize another change. Repeat an action ID and verify no duplicate, then simulate an uncertain response and reread before retrying.
- Reconnect with read-only consent, attempt a write, let an access token expire, verify refresh, disconnect the grant, verify it stays revoked, reconnect and verify the old grant remains invalid. Never include tokens in results.
- Send invalid selectors/ranges and peer-list IDs; verify no mutation or data leak. Exercise 429 in a controlled test environment or disposable account, not by flooding production. Inspect actual unknown/stale availability and quota fallback responses.

Record actual results, timestamps and unresolved warnings. No screenshot, recording, tool discovery or approval is a substitute for a real representative tool call and matching account state.

## ChatGPT signed-client token-exchange regression

A real ChatGPT connection exposed a 503 in the `private_key_jwt` path that the original public-client harness did not exercise. The isolated signed-client reproduction and root cause are documented in [OAuth connection fix](oauth-connection-fix.md). After the fix, all 47 current auth integration tests, focused types, Biome and the production build passed. The new test verifies assertion replay rejection and fresh-assertion refresh rotation. Track production rollout and actual ChatGPT reconnect separately in [evidence](evidence/oauth-signed-client.json).
