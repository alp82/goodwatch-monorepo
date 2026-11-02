# GoodWatch Claude directory preparation

Prepared and submitted with owner authorization on 2026-10-20. **Connector: in review. Plugin 1.0.1: submitted, security scan pending. Neither is live or post-publication tested.** See [submission status](submission-status.md) for direct management links and the remaining gates. Earlier preparation notes below are historical.

## Scope and deliverables

Submit the remote connector first: **GoodWatch**, `https://goodwatch.app/mcp`, Streamable HTTP, OAuth. It already supports useful workflows without a plugin: discovery for saved services and taste, finding a next episode, reading Wishlist and personal library, cast/crew exploration, and updating watches/ratings/settings/share lists. Reuse the deployed Remix endpoint, first-party server modules, Better Auth/CrateDB OAuth, Valkey limits and current ingress. No additional server or API proxy is needed.

The optional [plugin](../../../plugins/goodwatch/README.md) adds watch-tonight and track-watching skills for multi-step discovery and careful changes. It uses exactly the same endpoint and no local dependencies. Submit it separately under the same Claude organization and pair it with the connector. See [verified official requirements](../../research/claude-directory-requirements.md), [listing copy](listing.md), [reviewer guide](reviewer.md), [tool reference](tools.md), [test record](tests.md), and [publication handoff](handoff.md).

## Existing server and permissions

Entry: `goodwatch-webapp/app/routes/mcp.ts`; transport: `app/server/mcp/endpoint.server.ts`. Tools are registered in `tools.server.ts` and `write-tools.server.ts`; strict Zod schemas reject invalid parameters. Reads and writes have separate names. All names are below 64 characters. Results use structured content, bounded pagination and error outcomes. Every mutation now carries `destructiveHint: true` to preserve Claude confirmations under the current directory checklist, including additive watch logging and share-list creation. Authenticated production Inspector discovery confirmed these hints on all ten writes. Narrow metadata and MCP App compatibility fixes were deployed with authorization in releases `5140bcc4` and `5faa8365`.

Authorization is derived from the verified OAuth subject, never caller-supplied member IDs. `mcp:read` exposes up to 15 read tools; `mcp:write` adds up to 10 writes. Per-member/per-tool flags apply on discovery and execution. List reads/changes check ownership. Existing free-account restrictions, native state transitions, share-list rules and descriptive-search quota are reused; there is no paid GoodWatch tier to bypass. Every write requires a durable action ID, with member-bound receipts and idempotent retries. Native show-status and rating operations can have documented secondary effects. OAuth consent permits tool access; it does not authorize unrequested actions.

See [OAuth implementation](../mcp-authorization.md) and [maintenance](../auth-maintenance.md). Production discovery currently advertises CIMD, DCR, S256 PKCE, code and rotating-refresh grants. The protected-resource URL and audience are exactly the MCP URL; authorization-server issuer is `https://goodwatch.app/api/auth`. Bearer challenges link metadata. Callback registration must accept the exact hosted Claude callback and the registered Claude Code loopback callbacks; test the actual hosted flow before submission. Tokens are short-lived; revocation uses the live member/client/grant version check, and Connected apps disconnect fences existing tokens and refresh. Consent narrows requested scopes and withholds identity scopes. Test these runtime behaviors rather than relying on metadata alone.

## Deployment and maintenance

Use the existing webapp deployment; this preparation changes neither hosts nor firewall rules. Keep `BETTER_AUTH_ENABLED=true`, `BETTER_AUTH_URL=https://goodwatch.app`, `MCP_RESOURCE_URL=https://goodwatch.app/mcp`, stable auth signing/encryption secrets and the configured key ring in the existing secret manager. Follow the current auth deployment/migration and database grant runbooks; never run fixture seeds against production. Preserve `Cache-Control: private, no-store, no-transform`, forwarding of the canonical host, and streaming responses through ingress. Existing auth table migrations are explicit, not startup migrations.

After normal deployment, probe `/mcp` without credentials (401 plus metadata challenge), resource/issuer discovery and public docs. Complete OAuth and authenticated Inspector/Claude checks with disposable accounts. Preserve the independent auth maintenance worker, signing-key rollover and encrypted payload backups. Monitor tool errors/latency and request limits; RPC logs must exclude arguments, tokens and member data. Keep production flags enabled for reviewer tools, or declare intentionally unavailable tools accurately.

For releases, rerun protocol/OAuth/native data checks, regenerate the tool reference from source, run plugin validation and both skill workflows, and inspect portal findings. Retest existing grants and new grants after auth changes. Increment the plugin version when its files change. Keep the endpoint URL stable across both listings. Respond to feedback in the submitting organization's portal; source changes and a passing local build do not publish updates.

## Repeat client checks safely

Install pinned test clients with `npm ci --ignore-scripts --prefix scripts/auth-mcp/clients` from `goodwatch-webapp`, then install Chromium through that directory's Playwright CLI. Run `bash scripts/auth-mcp/run.sh clients` for the isolated local protocol/client suite. If keeping its server running separately with `serve`, set `MCP_LOCAL_SERVER_LOG` to the actual server log when invoking `clients/check.mjs`.

`goodwatch-webapp/scripts/claude-directory/production-clients.mjs` exercises the populated disposable reviewer through production Inspector and Claude Code. Supply `{email,password}` on standard input from the existing secret manager, never as shell arguments or a committed file. Default checks read tools; `--writes` adds reversible fixtures and exact-receipt replays. It expects the reviewer's existing shows, lists, settings and ratings. Do not substitute an ordinary member account. It retains evidence in a mode-0700 temporary directory, with files mode 0600; keep that evidence private. Check cleanup output and revoke any test grant if a process is interrupted. This script is not a substitute for hosted Claude's approval UX or portal validation.

For a focused Code rerun, `GOODWATCH_REPLAY_EVIDENCE` points to protected previous `calls.json` and `inventory.json`, and `GOODWATCH_READ_TOOLS` is a comma-separated read-tool allowlist. This reuses test inputs, not the prior OAuth grant. `GOODWATCH_EXAMPLE_PROMPTS=1` also runs the three read-only reviewer examples; inspect their protected result files for factual response quality. Do not share these raw files with the listing.

## Package a standalone plugin repository

From the monorepo root:

```sh
python3 scripts/claude-directory/package-plugin.py /tmp/goodwatch-claude-plugin.zip
claude plugin validate --strict --json plugins/goodwatch
claude --plugin-dir "$PWD/plugins/goodwatch"
```

The ZIP has the manifest, `.mcp.json`, skills, README and MIT license at its root. The standalone repository [alp82/goodwatch-claude-plugin](https://github.com/alp82/goodwatch-claude-plugin) has been staged privately on `main`; its URL is in the manifest. Making it public requires owner authorization. Validate the **entire published repository archive** against directory limits; a monorepo subfolder does not avoid them. At this checkout's HEAD, 9,728 tracked blobs total 490,690,479 bytes, already above the 256 MiB unpacked limit before archive directories; use the standalone repository. Use an empty tracked folder path for its root. Portal validation is separate from `claude plugin validate`.

## Live draft status

The connector is at **Review and submit**, with 25 tools, zero metadata suggestions, all seven factual policy acknowledgements, and private reviewer access entered. Its one nonblocking advisory is the difference between review contact hello@goodwatch.app and the owner's Gmail login. **Nothing has been submitted or published. Keep the draft tab open**: it is stored only in that browser tab.

Release `5faa8365` passes all 91 MCP unit tests and both 31-check MCP-instance smoke suites. Inspector, Claude Code and hosted Claude exercised all 25 tools. Both optional plugin skills passed private upload/installation with the existing connection and no duplicate tools. A fresh hosted Wishlist add/read/remove/read test passed and restored the original state. Eight App-producing tools render after refreshed tool metadata and a full tab reload. Three [actual App screenshots](screenshots/README.md) are ready. [Tests](tests.md) distinguish production, isolated, hosted and untested surfaces.

The shared checkout contains unrelated concurrent changes and older source than production's batch support. The isolated deployed fixes are recorded in [server-fixes.md](server-fixes.md) and the patch; do not deploy this shared checkout wholesale.

## Final preparation update

The GitHub App link was repaired after the owner's reauthentication. Its existing repository permissions were preserved. Plugin **1.0.1**, commit `803901e`, passed the portal's seven checks with four informational warnings for directory-only manifest fields (`icon`, `documentationUrl`, `privacyPolicyUrl`, `supportUrl`); each explicitly says no action is needed. Both portal drafts are at final review, not submitted. Plugin auto-publication is off; scheduled update checks are selected. The repository remains private.

The owner requested the **white G**. Release `e453628c` exports the existing white artwork at three new, cache-distinct icon URLs. Identity validation passed; page and both MCP instances are healthy on that commit. The live 512px PNG matches the local asset. The connector's **custom directory icon** and actual preview image use https://goodwatch.app/mcp-icons/goodwatch-white-512.png; the plugin packages the same image in its manifest. The ordinary website favicon can still appear in custom-connection UI; it is separate from the explicitly overridden directory listing icon.

## Specific remaining owner actions

Authorize actual connector submission, including possible automatic Community publication, when ready. Separately authorize plugin submission and eventual public repository/listing publication if desired. No GitHub reauthentication or manual form entry is outstanding. Nothing has been submitted or published.

See [portal evidence](portal-validation.json) and [handoff](handoff.md). Hosted natural token expiry/refresh and Cowork/Desktop remain unobserved; synthetic expiry/refresh and real Inspector revocation checks passed. Fresh-user marketplace tests require authorized publication. Both draft tabs must remain open until submission; the portal stores these drafts only in their tabs.
