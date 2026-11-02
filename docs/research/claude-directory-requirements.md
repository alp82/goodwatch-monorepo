# Claude directory requirements

Verified against official documentation on 2026-10-20. This records requirements, not evidence that GoodWatch has passed them. No submission or publication was performed.

## Routes and eligibility

Submit at [claude.ai/directory/manage](https://claude.ai/directory/manage). Pro and Max account holders qualify; Team requires an Owner; Enterprise requires an Owner or a custom role with Directory permission. The submitting organization owns the listing. The first organization submitting a repository folder reserves it.

A connector submission uses its remote HTTPS endpoint, without requiring a repository. A plugin submission uses a GitHub folder, public before publication. For a product with both, submit the server separately first, then the plugin. Submit both from the same organization, reference the identical server URL, and pair the listings; the identical URL prevents duplicate tools. Skills need a bundle rather than a standalone submission. New local MCPB directory listings are deprecated.

Connector submissions receive automated policy scans and ordinarily Community listings; Anthropic may escalate to Verified review. Plugin versions undergo validation and security scanning, with human review for a new listing. There is no separate Verified application or fixed review deadline. [Source: Publish to the directory](https://claude.com/docs/directory/publish).

## Connector tool contract

Each tool needs a title, an accurate narrow description, a name of at most 64 characters, and appropriate annotations: `readOnlyHint: true` for reads; `destructiveHint: true` for modifying/deleting data. Separate safe and unsafe operations; a catch-all tool combining HTTP read/write methods is rejected. Freeform API-query tools must identify/link their target API; fixed-purpose tools need not.

Reject invalid inputs with useful errors, keep results proportionate, and make every valid tool call succeed. Avoid behavioral instructions or promotion in tool descriptions, and do not collect unnecessary conversation data or access Claude history/memory/files. Use first-party or legitimately proxied APIs, with a service-matching server domain. Money transfers and AI image/video/audio generation are excluded.

The checklist requires populated reviewer credentials, public documentation by publication, and exercising every tool through **both MCP Inspector and a Claude custom connection**. This is stricter than the submission page's confirmation wording, which says either. Follow the checklist's stronger requirement. [Source: Connector pre-submission checklist](https://claude.com/docs/connectors/building/review-criteria).

## Authentication

Public-only servers may use `none`; individual account access uses OAuth. DCR and CIMD work by default. CIMD metadata must advertise `client_id_metadata_document_supported: true` and token authentication `none`, otherwise Claude falls back to DCR. Support S256 PKCE and advertise it.

Return HTTP 401 with `WWW-Authenticate: Bearer resource_metadata="…"`; a header on 200 does not initiate login. Resource metadata must match the exact MCP URL and list the primary issuer first; Claude ignores subsequent issuers. Serve reachable authorization-server discovery metadata.

Accept hosted callback `https://claude.ai/api/mcp/auth_callback`. Claude Code also needs `http://localhost/callback` and `http://127.0.0.1/callback` with arbitrary ports. Display redirect hostnames on consent screens.

Token exchange/refresh accept form-urlencoded bodies; DCR accepts JSON. Rotate or sender-constrain public-client refresh tokens; return replacement tokens during rotation and `invalid_grant` for invalid refresh tokens. Claude refreshes on 401 and up to five minutes before expiry. Discovery, registration, and initial token endpoints have 10-second limits; refresh has 30 seconds. Enforce individual product permissions server-side. Machine-to-machine `client_credentials` is unsupported. Anthropic-held credentials require review-team coordination; never email the secret. [Source: Authentication for connectors](https://claude.com/docs/connectors/building/authentication).

## Plugin packaging checks

The plugin folder contains `.claude-plugin/plugin.json`; all component paths and dependencies must stay inside it. Use ordinary committed files, not symlinks, submodules, or LFS pointers. Avoid system files, unsafe/case-colliding filenames and archive-rewriting `.gitattributes` attributes.

Repository limits: GitHub archive under 50 MiB, unpacked under 256 MiB, fewer than 10,000 entries; plugin files under 5 MiB. More than 512 plugin files, non-image/font files over 256 KiB, or unsupported binaries trigger reviewer holds.

Use a distinctive lowercase ASCII name, ideally `goodwatch`, at most 64 characters. Include description, author, version, README with at least 40 non-code words, and a license file or manifest license. Keep `.mcp.json` valid with remote `type: "http"` and absolute HTTPS URL. Never distribute credentials. Pin launcher packages exactly; pinned launchers still trigger review holds. Skills require correctly named `skills/<name>/SKILL.md` with valid YAML and textual description.

`claude plugin validate` checks syntax/schema only; portal Validate performs directory checks. Fix Blocking findings and revalidate the new commit. Policy holds need reviewer clearance; warnings remain visible. [Source: Plugin pre-submission checklist](https://claude.com/docs/plugins/pre-submission-checklist).

## Plugin behavior and testing

Use `.claude-plugin/plugin.json`, root `.mcp.json`, and `skills/<name>/SKILL.md`. Put workflow order, defaults and intended output in skills. Keep secrets out of distributable configuration. A top-level `bin/` prevents installation in chat and Cowork.

Skills work across chat, Cowork and Claude Code. Remote MCP entries appear in the plugin's Connectors tab in chat/Cowork, where users must connect; Claude Code connects directly. Team/Enterprise Owners add the connector, then members connect their individual accounts.

Test Claude Code using `claude --plugin-dir ./<folder>` and inspect `/mcp`. Test chat/Cowork by zipping the plugin folder, uploading via Customize → Plugins → Add → Upload plugin, checking loaded skills, then connecting its connector. Compare representative outputs with and without skills; consider `claude plugin eval`. Run local validation and portal validation separately. [Source: Plugin structure and testing](https://claude.com/docs/plugins/build).

## Submission materials and portal

Prepare documentation and privacy URLs, support contact, icon, company website and review contact, populated reviewer credentials, account/setup prerequisites, and data-handling answers. Listing fields: name ≤100 characters, one-liner ≤200, description ≤2,000, one to five categories, and permanent public slug. MCP Apps additionally require three to five PNG screenshots, ≥1000px wide, cropped to app responses with separate prompt text; plain tool connectors do not have this screenshot requirement.

Connector portal steps: Connection → Tools → Listing → Use cases → Company → Authentication → Data handling → Test & launch → Compliance → Review and submit. Tool definitions sync from the server. All seven compliance acknowledgements are required. Reviewer credentials go through the portal, not repository files. Monitor portal feedback after submission. Connector submission may automatically lead to a Community listing, so **do not press Submit until publication is authorized as well**. [Source: Submit a connector](https://claude.com/docs/connectors/building/submission).

## Plugin release handoff

Connect GitHub within the submitting Claude organization using an account with repository push access. Enter repository, plugin path and tracked branch/tag, then Validate. Complete listing, data handling and compliance; select the update mechanism and submit only when authorized. A public repository can validate before GitHub ownership checks, so validation does not establish submission eligibility.

Private repositories can validate/submit if authorized source upload and Claude GitHub App access are configured, but must become public before publication. Repository/folder identity cannot change after submission.

A passing version is not necessarily published. Default publication requires selecting Publish and an Anthropic reviewer publishing it. Anthropic may grant other publish settings; inspect the portal's actual setting. Disable auto-publication until explicitly authorized. Raise version for releases and inspect new-commit scans/holds. Last published versions remain served while an update is held. [Source: Submit your plugin](https://claude.com/docs/plugins/submit).

## Evidence and owner checks still needed

- Confirm actual paid plan, organization role and long-term listing owner in the portal.
- Check actual monorepo archive size/entry count before selecting its plugin subfolder; a tiny folder does not bypass repository limits. A separate public plugin repository may be necessary.
- Establish exact endpoint, real account requirements and permissions from GoodWatch implementation; do not infer OAuth is necessary for public tools.
- Record every MCP Inspector and real-Claude tool/auth/permission/rate-limit check; unrun tests stay pending.
- Supply reviewer access securely if required, and confirm support/privacy/documentation links are public.
- Keep submitted, accepted, published, publicly discoverable and successfully tested as separate recorded states.
- After authorized publication, record exact public listing name/URL, install using a fresh eligible account, verify tool discovery, intended permissions and account isolation, run representative reads and authorized disposable writes, and verify paired plugin skills without duplicate tools. Record unresolved warnings/failures.
