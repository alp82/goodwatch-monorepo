# Submission, publication and verification

Official sources checked 2026-10-20: [package format](https://developers.openai.com/plugins/build/plugins), [upload and submit](https://developers.openai.com/plugins/deploy/submission), [remote MCP review](https://developers.openai.com/plugins/deploy/app-review), [plugin guidelines](https://developers.openai.com/plugins/plugin-guidelines), [OAuth](https://developers.openai.com/plugins/build/auth), [tool/UI reference](https://developers.openai.com/plugins/reference), [security](https://developers.openai.com/plugins/guides/security-privacy).

The current format is a portable Agent Plugins root `plugin.json`, optional `mcp.json`, assets and optional skills. We use exactly one remote Streamable HTTP server. Legacy Codex layouts remain supported, but public ZIPs cannot contain app references or lifecycle hooks. This package has neither. The initial ZIP must include the MCP server; adding it later to a skills-only plugin is not supported.

## First-time publisher setup

The owner has a personal ChatGPT subscription and has not confirmed a Platform organization. Open https://platform.openai.com/plugins using the intended owner login and complete Platform onboarding if prompted. In https://platform.openai.com/settings/organization/general complete individual verification for publication under your own name, or business verification for a business publisher. A ChatGPT subscription is not proof that this verification has occurred. Select a global-residency project. Organization owners already have the required read/write permissions; no additional teammate is needed.

The product display name remains GoodWatch. Set the publisher to the verified identity shown in the portal. Worldwide targeting is owner-approved and explicitly represented by `publication.countries=[]`. Do not invent verification status or claim worldwide ChatGPT eligibility.

## Before submission

Finish every blocker in README.md. Rebuild the final ZIP and record its hash, deployment SHA and hosted test results. Do not interpret schema validation as passing portal review. A private draft upload can be used for setup and scanning as part of preparation. Do not press Submit or Publish without the owner’s explicit authorization.

## Prepare a private draft and scan

1. Select the organization/project that will own GoodWatch in [OpenAI Platform](https://platform.openai.com/plugins). Use a global data-residency project: the MCP review page currently excludes projects with EU data residency. This restriction is about the project, not the user's nationality or the hosting server.
2. Complete [individual or business verification](https://platform.openai.com/settings/organization/general) for the intended public publisher. Organization owners have submission permissions. Other members need **Apps Management Write** (`api.apps.write`) and read access (`api.apps.read`); owners grant these through [organization roles](https://platform.openai.com/settings/organization/people/roles). Confirm the displayed identity matches website/policy ownership.
3. Choose **Upload new or existing plugin**, select the verified Developer identity, and upload the final `goodwatch-1.0.0.zip`. Save the draft/plugin ID. Do not click Submit yet.
4. Under **Metadata & Skills**, wait for checks. Verify the imported exact name, subtitle, full description, logo, publisher, category, all four HTTPS links, three prompts, review cases, recording URL and country targeting. Correct issues in source, rebuild, and choose **Upload plugin to fix issues**. No skills are included, so no skill scan should be expected for this package.
5. Under **MCPs**, select GoodWatch → **Connect**. Choose **With MCP**, universal URL `https://goodwatch.app/mcp`, OAuth. Do not use a localhost/template endpoint. Verify the saved method/scopes rather than assuming discovery chose them correctly. Normal discovery supplies issuer, registration, authorize/token/revocation and protected-resource metadata. Prefer the existing DCR flow; no client secret belongs in this ZIP. If provided-client registration becomes necessary, register the exact callback and client in GoodWatch and enter its secret only in the portal. Use [advanced auth configuration](https://developers.openai.com/plugins/build/plugins#configure-mcp-authentication); investigate any schema/config mismatch before proceeding.
6. Complete the domain-verification challenge exactly as the portal specifies. Do not invent its DNS record or HTTP filename beforehand. Deploy a challenge response only after the owner provides it and confirms domain control. Reconnect and authenticate with the dedicated reviewer account. Confirm no email/profile identity scope is needed and that the approved read/write choice is retained.
7. Wait for the MCP scan. Inspect every discovered tool, input schema, annotation and scope metadata against [tools.json](evidence/tools.json). Read-only grants expose 15 tools; read/write grants expose 25, unless account flags restrict them. Share-list mutation tools must have open-world true; destructive setters/removal true. Check the linked poster resource CSP and domain. Continuous/daily review can hold individual updates while the prior live definition remains active.
8. Open **Issues** and investigate every connection, **Complete MCP setup**, scope, resource or tool warning. For server findings, fix/deploy and **Reconnect** or **Rescan** as appropriate; for package findings, reupload a complete ZIP. Wait for completion and verify the corrected scanned definition. A scan with no findings but an incomplete status does not pass. Keep finding IDs and actual resolutions in the evidence log. Use the [submission error reference](https://developers.openai.com/plugins/deploy/submission-errors) for failures.

## Authorized submission

1. In **Metadata & Skills → Review information → Review details**, verify the imported five positive and three negative cases and video URL. Enter reviewer credentials and normal login instructions in secure fields only, then **Save details**. Do not place passwords in expected-output text or public attachments.
2. Confirm the account independently works, is populated, requires no new MFA/email/SMS code and will remain usable throughout review. Run every initial case with that account in ChatGPT and retain sanitized actual results.
3. Only with explicit owner authorization, select **Submit for review** and complete the policy attestations. Record the resulting review state and time. Submission is not approval or publication. Track **Review status** and email. Resolve rejection feedback, or reply to the rejection email to appeal with supporting evidence.
4. Only one review can be active per plugin. Cancel review before replacing a submitted version; otherwise wait for a decision. Never claim an estimated review completion time.

## Separately authorized publication

Approval leaves the plugin unpublished. Obtain the owner's explicit publication authorization, open the approved package version in [Plugins](https://platform.openai.com/plugins), and select **Publish plugin**. Record the publication status, exact public name and direct listing URL supplied by the portal. Do not guess a `plugin_...` ID or URL.

## Checks after publication

Keep this table as a record, filling actual evidence rather than checking boxes based on approval.

| Check | Status / evidence |
| --- | --- |
| Portal shows Published, exact package version and timestamp | Pending publication authorization |
| Exact-name directory search for **GoodWatch** returns the listing | Not tested |
| Portal-provided direct listing URL loads for an eligible fresh account | URL not yet assigned |
| Fresh user can install in an intended country/plan/workspace | Not tested |
| OAuth completes on goodwatch.app with intended scopes and normal callback | Not tested |
| Read-only user sees read tools and cannot force a mutation | Not tested |
| Read/write user discovers all intended 25 tools; scanner holds none unexpectedly | Not tested |
| Name search, Tonight, title details and show progress return real linked results | Not tested |
| Private ratings/Wishlist/progress match the connected account and differ from peer fixtures | Not tested |
| Expired access token refreshes; revoked grant no longer works | Not tested |
| Poster grid renders and CSP/domain/resource warnings are absent or explained | Not tested |
| Authorized disposable Wishlist/watch mutation returns receipt and reread agrees | Not tested |
| Host prompts for destructive/public actions; denial causes no changes | Not tested |
| Retry uses the same action ID and creates no duplicate watch | Not tested |
| Support/privacy/terms and recording links remain accessible | Support/privacy/terms verified HTTP 200; recording not supplied |
| Unresolved warnings/failures documented with owner and next action | See README blockers |

Use a genuinely fresh eligible account with no developer/workspace-only visibility; an owner finding their private draft does not establish public discoverability. Record surface, account eligibility, country, time, prompts, tool calls and redacted results. Run write tests only against data the owner explicitly designates disposable. Stop and report failures; do not infer successful private-data isolation from a generic catalog result.

Track these states independently: **prepared → uploaded draft → submitted → approved → published → publicly discoverable → successfully tested**. Current state: prepared locally, with outstanding submission blockers.

## Official documentation discrepancies

The MCP review page still mentions annotation justifications; the newer guidelines explicitly say they are no longer required. Server annotations govern regardless; our per-tool rationale remains available for review. The submission and review pages also differ on changing endpoint paths after publication. Keep the exact endpoint stable and consult support before changing it. Advanced OAuth extensions are documented but absent from the current portable MCP JSON schema; this package avoids the mismatch by relying on server discovery. Hosted confirmation of the saved auth configuration is still required.
