# GoodWatch ChatGPT directory submission

Prepared 2026-10-20. **Server changes deployed and live protocol checks passed; package validated; hosted/owner steps remain. Nothing uploaded, submitted, approved or published by this task.** Public discovery and fresh-user installation have not been tested.

The review ZIP is [goodwatch-1.0.0.zip](goodwatch-1.0.0.zip). Package sources are in [plugins/goodwatch-chatgpt](../../plugins/goodwatch-chatgpt). [Package validation](evidence/package-validation.json) records its SHA-256. The ZIP contains root `plugin.json`, `mcp.json` and the existing 512×512 GoodWatch PNG only. No credentials, account data, runtime dependencies, hooks or registered-app references are bundled. The adjacent Claude package is separate and unchanged.

## Scope

Three conversational workflows reuse the existing integration:

1. Choose what to watch: title/name or descriptive search, Discover filters, scores, streaming availability, similar titles and cast/crew.
2. Continue personal viewing: Tonight, Wishlist/My library, taste, My shows and next-episode progress.
3. Maintain viewing records: Want to See, ratings and watch logging; related settings, status and share-list tools retain the product's existing behavior and limits.

The server already exposes 15 read tools and 10 write tools. We retain its existing contract rather than introduce another server, auth system, database or hosting stack. [Inventory](tool-inventory.md) lists every tool and its annotations. [Listing](listing.md) limits claims to this integration; importing histories, playback, payments and account deletion are unsupported.

Required work: resolve the hosted and owner blockers below, test hosted installation/login/approvals and all tools, and finish portal scans. Optional improvements: workflow skills (not needed for this initial package), screenshots from an actual ChatGPT session, translated listings and a distinct UI origin if a hosted scan requires it. The existing poster-grid UI provides useful comparisons and is retained with its narrow CSP; no new interactive interface is introduced.

## Remaining owner steps and completed checks

- **Privacy:** The existing owner-approved connected-app policy was reconciled with the current tool set. The shared consent/privacy capability summary now includes title language and public/unlisted share-list access and changes. Existing disconnect/deletion disclosures remain applicable. **Terms resolved:** the owner authorized a minimal page; `https://goodwatch.app/terms` is live (HTTP 200), linked from Support, and verified after deployment of `1946e00c`. See [deployment evidence](evidence/terms-deployment.json).
- **Identity and availability:** `GoodWatch` is a provisional brand label, not verified legal/business identity. The owner confirmed worldwide availability; `publication.countries=[]` explicitly removes country restrictions, subject to platform eligibility. The owner has a personal ChatGPT subscription and has not confirmed an OpenAI Platform organization. Individual/business verification and the portal category (draft: Entertainment) still need completion.
- **Reviewer account:** The owner and Google & SEO session confirmed an existing populated reviewer account and root-only credentials/verification records. Reuse it; do not create a duplicate. See the existing `docs/implementation/mcp-directory-listing.md` through a trusted checkout for its protected location. Fresh direct HTTP login and all 15 reads passed with a new session; ChatGPT-hosted testing remains. Put credentials only in secure platform fields.
- **Recording:** record the reviewer walkthrough and provide a reviewer-accessible URL. `review.demo_recording_url` is deliberately absent, rather than a fabricated link. Add the real URL to `extensions.com.openai.review` and rebuild before submission.
- **Deployment:** server metadata and consent/privacy summaries were released in `a8975af9`. See deployment and authenticated protocol evidence for actual live verification.
- **Hosted acceptance:** install from a fresh ChatGPT account, complete OAuth and refresh, check read-only access and all 25 tools, inspect poster rendering and confirmation behavior, then run the five positive and three negative cases. No ChatGPT portal or browser session was available here. The OAuth scope mirror must be recognized by the scanner. Any Complete MCP setup, scope, UI or connection warning remains blocking until investigated.
- **Portal:** verification, organization permissions, domain challenge, authenticated scanning, review and publication are owner actions. No clean portal scan is claimed.

## Setup and deployment

Use Node 24+ and the existing `goodwatch-webapp` install. Do not replace production secrets or deploy a second OAuth issuer. Existing deployment documentation remains authoritative: [MCP authorization](../implementation/mcp-authorization.md), [search-role deployment](../search-role-deploy.md), [auth maintenance](../implementation/auth-maintenance.md), [search role ADR](../adr/0011-search-runs-as-a-role-of-the-webapp-image.md).

The stable external endpoint is `https://goodwatch.app/mcp`. Set `MCP_RESOURCE_URL` to that exact URL, `BETTER_AUTH_URL=https://goodwatch.app`, and enable the existing Better Auth runtime. Keep the existing Better Auth secret, independent CrateDB lookup/encryption secret and versioned payload key ring stable. Use deployed secret management; never add values to this bundle. Reuse the existing CrateDB auth tables, member-data grants, search roles, Valkey limits and maintenance jobs. No schema migration or firewall change is required by this change.

The endpoint uses the pinned MCP SDK's Streamable HTTP handler, with legacy stateless compatibility. It rejects foreign origins and untrusted host addressing, bounds bodies, checks bearer issuer/audience/type/expiry/member/client/grant on every call, returns private/no-store responses and rate-limits members. The auth issuer is `https://goodwatch.app/api/auth`. Public discovery advertises DCR, CIMD, S256 PKCE, authorization-code and refresh grants, JWKS and revocation. Refresh tokens expire after 90 days; access tokens after 300 seconds. Connected-app disconnection invalidates the grant, including existing bound JWTs; ordinary site sign-out does not revoke offline permissions.

Request only `mcp:read`, optional `mcp:write` and `offline_access`; do not request identity scopes. Read-only consent remains available. Tool schemas accept no account selector; handlers derive identity from the verified token. Share-list reads/edits check owner identity. Feature flags are checked on listing/call paths. Existing per-member limits are 60 requests/minute and 1,000/hour; smarter descriptive search has 20 uncached attempts per UTC day plus shared admission/cost limits. No new paid plan is invented.

`mcp.json` intentionally uses the schema-valid portable HTTP entry and OAuth discovery instead of client credentials or endpoint overrides. The current canonical MCP schema rejects an `extensions` key even though OpenAI documents advanced OAuth extensions. Discovery is sufficient for the existing server; confirm the portal detects OAuth and requests read/write/offline scopes. If it does not, stop and reconcile the documented OpenAI auth extension with portal validation before changing the package. DCR callbacks must use the exact registered ChatGPT connection redirect, with no wildcard and no consent bypass. Do not guess a callback from old Apps SDK instructions. Test the actual portal flow.

The metadata fixes and matching contract tests are committed on main in `a8975af9`, preserving the factual tool-description cleanup and newer product schemas. Use the normal webapp/search-role release procedure for future changes, then rerun the public probe and authenticated checks in [tests.md](tests.md). Route `/mcp` and its OAuth/metadata routes through the existing TLS ingress. Do not cache responses or strip `WWW-Authenticate`, `Authorization`, protocol, content-type or accept headers. Verify whichever role actually serves `/mcp` runs the intended commit.

## Rebuild and validate

From the repository root:

```sh
node scripts/chatgpt-plugin/export-tools.mjs
python scripts/chatgpt-plugin/probe-public.py
python scripts/chatgpt-plugin/validate.py --zip
```

The validator requires Python's `jsonschema` module (tested with 4.26.0). Schema snapshots were fetched from the exact `$schema` URLs on 2026-10-20. Validation checks both published schemas, OpenAI listing/asset limits, review counts, referenced paths, the three-file allowlist, credential markers and ZIP round trip. It does not authenticate to production or replace OpenAI's proprietary scanner. `--submission` fails while any check in `readiness.json` remains outstanding or the recording URL is missing. Update each check with actual evidence only after independent verification; passing this gate still does not authorize an upload or submission.

See [tests.md](tests.md) for results and reproduction, [reviewer.md](reviewer.md) for secure access and the recording, and [submission.md](submission.md) for exact portal and post-publication steps.

## Maintenance

Keep signing-key rollover, encrypted payload-key rotation, expiry cleanup and action-receipt maintenance running under the existing auth jobs. Monitor 401/403/429/5xx, tool failures, search budget exhaustion, unavailable results and MCP latency without logging raw prompts, tokens or account data. Recheck consent revocation and fresh login after auth changes. Preserve the public HTTPS origin: changing it requires a new plugin; official pages differ on whether a path-only change needs a new version or support, so use support before changing the submitted endpoint.

Hosted MCP definitions are checked continuously/daily and eligible changes can go live automatically after checks; inspect held/live definitions after deployment and Rescan. Maintain compatibility while updates are held. Listing, assets or skills changes need a complete versioned ZIP and another review/publication flow. Preserve the current published version while an approved replacement is prepared. Record deployment SHA, ZIP hash, portal ID, scan IDs, reviewer evidence and state transitions without credentials.
