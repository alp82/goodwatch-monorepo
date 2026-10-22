# Shared services and GoodWatch signup

Implemented from clean `8333a21b` in `/tmp/yepwatch-shared-release-20261022`, isolated from the main checkout's unrelated changes and frozen, unreviewed refresh implementation. No production deployment, account/client registration, Redis ACL change, table provisioning, retained-service restart or phone action was performed.

## Changes

- Production Compose contains front, API and gateway. API and gateway use the existing Redis cluster through a separate named messaging credential. Source catalog credentials remain API-only.
- First-release tables use stable names: `doc.yepwatch_room`, `doc.yepwatch_runtime`, `doc.yepwatch_control`. Historical development runtimes keep their own schemas. Internal format and protocol identifiers remain unchanged.
- GoodWatch's existing signup, email verification, login, issuer and consent are reused. A new GoodWatch read endpoint supplies the verified member's preferences/progress to the standalone YepWatch API. No account database credentials or issuer runtime enter the release bundle.
- Account linking preserves the guest actor and room. Guest use remains available. Native callback selection distinguishes the production and preview app schemes.
- Refresh remains excluded. An expired grant requires reconnecting GoodWatch.

Full deployment/configuration instructions: [shared services](../../yepwatch-realtime/release/SHARED-SERVICES.md). Exact database DDL and payload explanation: [schema](../../goodwatch-webapp/app/server/yepwatch/SCHEMA.md).

## Validation on 2026-10-22

| Check | Result and scope |
|---|---|
| Backend release/proposal/member suites | 34 passed |
| Actual disposable Crate control test | Passed: stable tables, two API instances, capacity/budgets, lost acknowledgements, restart and expiry recovery |
| Existing GoodWatch issuer signup integration | Passed with disposable local account, captured verification email, actual issuer/consent/token exchange and browser/preview-native protocol return to the same guest. Preferences/progress readers used fixtures. No email was sent externally. |
| Shared cluster | Passed with an actual disposable three-node Redis-compatible Valkey cluster, named messaging ACL, release API publisher and gateway subscriber. Existing three-master transport regression also passed. Production Redis ACL/version remains an operator check. |
| App units | 55 passed |
| Browser state/layout cases | 39 passed initially; one existing test hardcoded the old test-server port. Corrected that assertion to use the running origin, then that case passed separately. 40 cases pass across the two runs. |
| App typecheck/lint | Typecheck passed; lint has zero errors and one existing legacy unused-import warning |
| Gateway typecheck | Passed |
| Backend broader typecheck | Existing unrelated country/discovery/explore diagnostics remain; no diagnostics in owned changes |
| Build/export | Standalone API bundle, GoodWatch resource route bundle, member-enabled web export and Android/iOS Hermes exports passed. Release bundle still excludes issuer/runtime/refresh modules. |
| Compose | Configuration resolves to exactly three services, shared cluster nodes and no host ports |
| Patch | `git diff --check` passed |

The cluster check caught the required `CLIENT SETNAME` permission. It also exposed an initial ioredis connection promise that could remain pending through recovery. Startup now opens the HTTP listener while readiness stays red until the existing dependency probes succeed.

## Reproduction entry points

- `goodwatch-webapp/app/server/yepwatch/proposal-release-members.test.ts`: remote member adapter and account resource tests.
- `goodwatch-webapp/app/server/yepwatch/proposal-release-control-crate.test.ts`: opt-in disposable Crate test, `YEPWATCH_TEST_CONTROL_CRATE=1`.
- `goodwatch-webapp/app/server/auth/yepwatch-signup.integration.ts`: executable fixture integration. It requires explicit `YEPWATCH_TEST_AUTH_DISPOSABLE=1` and its documented loopback Crate/Redis configuration. Bundle with esbuild as Node ESM before running, as for the existing issuer integration. Use new disposable stores only.
- `yepwatch-realtime/test/proposal-release-cluster.test.ts`: opt-in three-node cluster test via `YEPWATCH_TEST_VALKEY_IMAGE`; owns and removes its container.
- `yepwatch-app/playwright.shared.config.ts`: isolated browser suite on port 18149; never reuses a retained server.

## Remaining deployment checks

This is local implementation evidence, not public activation or independent review. The owner must deploy the GoodWatch resource route, configure/register the existing issuer's YepWatch client and callback, provision stable tables and the messaging ACL, and rebuild release images/APK. APK3 and all retained phone/runtime artifacts are unchanged. Public email delivery, public HTTPS callbacks, physical Android browser return, actual device audio and iOS compilation were not tested. Retention cleanup, full key rotation and comprehensive HTTP/read protection remain separate release work.
