# Submission and publication handoff

Official requirements checked 2026-10-20: [publish overview](https://claude.com/docs/directory/publish), [connector checklist](https://claude.com/docs/connectors/building/review-criteria), [authentication](https://claude.com/docs/connectors/building/authentication), [connector submission](https://claude.com/docs/connectors/building/submission), [plugin build](https://claude.com/docs/plugins/build), [plugin checklist](https://claude.com/docs/plugins/pre-submission-checklist), [plugin submission](https://claude.com/docs/plugins/submit). Recheck these before the owner submits because the portal and policies can change.

## Current browser draft

The connector is at **Review and submit**, all seven factual compliance acknowledgements checked, 25 tools and zero tool-metadata suggestions. The sole nonblocking advisory is that review contact `hello@goodwatch.app` differs from the owner's Gmail login. The existing populated review account was placed in the private Test setup instructions field; never copy that field into screenshots/public materials. The draft exists only in its browser tab, not as a server-side submission. **Keep the draft tab open. Submit for review has not been clicked.**

Production release `5faa8365` is healthy. All 25 tools were exercised through Inspector, Claude Code and hosted Claude; both optional skills passed private ZIP installation against the existing connection. A fresh hosted Wishlist change was verified and undone. All eight App tools rendered after refreshing cached metadata, and three actual screenshots are in [screenshots](screenshots/README.md). See [tests](tests.md) for limits, especially unobserved hosted natural token refresh and untested Cowork/Desktop/public installation.

The optional plugin is staged at https://github.com/alp82/goodwatch-claude-plugin (private), version **1.0.1**, commit `803901e`. GitHub reauthentication and reconnecting the existing installation resolved the access failure. Portal validation passed seven checks, with four informational directory-field warnings requiring no action. The plugin draft is also at Review and submit. Auto-publish is **off**, scheduled checks selected. No submission button has been clicked and the repository remains private.

Both listings explicitly use the **white G**. Connector custom icon URL: https://goodwatch.app/mcp-icons/goodwatch-white-512.png. Plugin manifest icon: `./assets/goodwatch-white-512.png`. The website favicon is not the selected directory branding. The live asset was verified byte-for-byte and the connector preview loads the white URL. Latest icon release: `e453628c`.

## Before submission

- [x] Existing personal Claude Max account is eligible; no organization administrator role is required for this plan.
- [x] Name/slug, legal contact, public links and hello@goodwatch.app review contact populated.
- [x] Existing reviewer credentials entered privately, never in public files.
- [x] Both drafts reached final review; live tool tests, plugin skills and screenshots are recorded.
- [x] Plugin portal validation passed, seven checks and four informational directory-only field warnings.
- [x] White G selected in the connector custom-icon field and plugin manifest.
- [ ] Explicit owner authorization for connector submission and possible Community publication.
- [ ] Explicit owner authorization for plugin submission and making its source repository public before publication.

## Connector route

1. Open [directory management](https://claude.ai/directory/manage) in the intended organization. Start a remote connector submission using `https://goodwatch.app/mcp`; no repository URL substitutes for the server endpoint.
2. Follow Connection → Tools → Listing → Use cases → Company → Authentication → Data handling → Test & launch → Compliance → Review and submit. Sync actual tools, inspect scope-restricted discovery, and ensure the inventory matches what reviewers will receive. Supply at least the first three verified example prompts from the reviewer guide, with observed outcomes.
3. Select OAuth and inspect discovery/client registration/callback/refresh compatibility. Enter test-account access securely, not in listing prose. Supply public usage/privacy/support URLs. Declare the poster-grid App accurately and upload genuine required screenshots if included.
4. Run portal checks; save finding IDs/text, commit/deployment, timestamp and resolution. Complete all seven compliance acknowledgements truthfully. A pending tool/surface test cannot be checked off as complete.
5. Review the exact final listing and any publication behavior. Once owner authorization covers submission/publication, submit. Record submission ID, organization, endpoint, timestamp and actual status.
6. Monitor validation/reviewer feedback in directory management. Fix and retest issues, then update the submission as instructed. Do not claim a fixed review time, approval or a Verified label. Community publication and potential Verified review are different events.

## Plugin route

1. Submit the remote connector separately first. Use the **same organization and exact MCP URL** for the plugin so the portal can pair listings and avoid duplicate tools.
2. In directory management, submit the GitHub repository/folder. For the exported standalone repository use its root. Connect GitHub with push access under the chosen organization, and authorize the required Claude GitHub App repository access. Folder/repository identity cannot be changed after submission.
3. Select tracked branch/tag and update settings. Keep automatic publication disabled unless specifically authorized. Ensure the repository is public by publication. Private validation/source upload does not establish final publication eligibility.
4. Run the portal's Validate action. Fix Blocking findings in a new commit and revalidate; policy holds need reviewer clearance. Record residual warnings and any packaging limits. Local CLI validation is insufficient.
5. Complete listing, data handling and compliance, pair the connector, and submit only with authorization. Track acceptance separately. Publication normally requires selecting Publish and an Anthropic reviewer publishing; inspect the actual organization's available publish setting before any action.
6. Increment version for later releases. Validate/retest new commits and inspect scans/holds. A prior published version may remain installed while a new version is held; record the exact published version.

## State ledger

| State | Evidence required | Current evidence |
| --- | --- | --- |
| Prepared | Code, bundle, docs, known test gaps | This packet; see tests |
| Submitted | Portal ID and timestamp | Not performed |
| Accepted | Explicit portal/reviewer acceptance | Not established |
| Published | Publication event and version | Not established |
| Publicly discoverable | Exact public name and direct listing URL, fresh-user access | Not tested |
| Successfully tested after publication | Fresh eligible account, OAuth, real calls, isolation and disposable write results | Not tested |

## After authorized publication

- [ ] Search the public directory for exact name **GoodWatch**. Record the direct connector listing URL and, if present, plugin listing URL and version. Do not substitute the developer portal or GoodWatch homepage.
- [ ] Using a fresh eligible Claude user account with permission to install, open the direct listing and install/connect. Record plan, surface and client version; avoid relying on the submitting owner's existing custom connection.
- [ ] Complete actual OAuth through GoodWatch. Verify requested/granted scopes and read-only versus read/write selection. Confirm appropriate account identity on GoodWatch before Allow.
- [ ] Discover tools, compare names/schemas/annotations with the deployed reference, and inspect any flag-limited inventory. Run representative title discovery, personal library, show progress and settings reads.
- [ ] Prove private data belongs to the newly connected GoodWatch account: use distinct disposable marks/lists and verify foreign private/unlisted list IDs are unavailable. No real member data is needed.
- [ ] With explicit authorization on disposable data, approve one Wishlist/rating/watch change, inspect receipt and website state, retry safely with the same action ID, and clean up. Verify write tools remain unavailable to a read-only grant.
- [ ] Test refresh after expiry, disconnect in Connected apps, confirm subsequent requests fail, and reconnect without reviving old grants.
- [ ] Install the paired plugin on each intended supported surface. Confirm both skills load, use the intended connector, and expose no duplicate tools. Run discovery and tracking end to end, including approval UI and truthful availability.
- [ ] Record timestamp, exact listing URL/version, client, sanitized results, remaining warnings/failures and cleanup. If any step fails, report the specific failed state; approval/publication alone does not establish working integration.
- [ ] Monitor errors, support reports, policy changes and review feedback; maintain public docs and stable endpoint. Repeat these checks after material auth/tool/plugin changes.
