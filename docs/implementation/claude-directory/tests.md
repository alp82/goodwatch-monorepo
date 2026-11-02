> **Branding and plugin follow-up:** white G release `e453628c` is healthy on the page host and both MCP instances. The identity/PNG test passed and the live icon SHA-256 matches the local asset. The connector preview uses the explicit white custom-icon URL. Plugin 1.0.1 (`803901e`) passed local strict validation and all seven portal checks. Four portal warnings concern directory-only fields and explicitly require no action. GitHub App reconnection resolved private-source access; existing permissions were preserved. Both drafts reached final review, with plugin automatic publication off. Nothing submitted or published.

> **Latest verification, 2026-10-20:** release `5faa8365` is live. All 91 MCP tests and both 31-check MCP-instance smoke suites passed. Fresh Inspector verified 25 tool titles, authenticated access and the v4 App resource. Hosted Claude exercised all 15 reads and all 10 write tools; a fresh Wishlist add/read/remove/read test passed with cleanup. Both uploaded plugin skills ran against the existing connection without duplicate tools. All eight Apps rendered after connection refresh and a full tab reload. Three actual App screenshots are prepared. Connector draft reached Review and submit with one nonblocking contact-domain advisory. Nothing has been submitted or published.

## Latest hosted evidence and limits

- Actual expanded tool panels confirm calls. Nine replay flags are directly visible; the long `update_list_titles` response is truncated in Claude's panel, so its replay flag is independently established by the earlier Inspector/Code run, not claimed as visible in hosted UI.
- Haiku initially misread historical replay receipts as fresh changes. Current reads confirmed the disposable list remains deleted and the test title has no watch/rating/marks. The tracking skill's fresh Wishlist test correctly verified both changes and restoration. Do not use model prose as sole evidence.
- The original App rendering failure was traced to a site URL in host-specific `ui.domain`. Removed the unnecessary override, preserved ChatGPT metadata and bumped resource URI to v4. Eight real App renders passed after refreshing tools and reloading the tab. Older tabs retained cached v3 metadata and failed until reloaded.
- Name search orders matches alphabetically; limiting “Arrival” or “The Matrix” to three results may omit the expected feature. Use canonical ID or title/year resolution for deterministic demos. This is a ranking limitation, not a transport failure.
- Hosted disconnect removed tool access and displayed the installed plugin dependency. Reconnecting completed OAuth after verifying the reviewer identity; a new hosted `get_settings` call returned Germany/English successfully. This checks the hosted UI/callback lifecycle; raw rejected-token revocation evidence comes from Inspector, not this UI check.
- Hosted natural token expiry/refresh has not been observed. Actual 60-second expiry/refresh passed in the isolated Inspector and Claude Code harness; production Inspector revoke/rejection passed. Cowork/Desktop and a fresh public-directory user remain untested. No claim is made for these surfaces or post-publication behavior.
- Fresh Inspector grant for this release was revoked after verification. The hosted reviewer connection remains active intentionally for portal checks. Private raw transcripts/credentials remain outside the repository.

The earlier chronology below preserves original test scopes; statements that were pending at that time are superseded by the latest results above.

# Actual verification record

Date: 2026-10-20. Working tree has unrelated concurrent changes; initial preparation made no monorepo commit, deployment, submission or publication; the later authorized deployment is recorded above. A six-file standalone plugin was committed and pushed to a private repository. Local results below establish their stated scope only. Historical evidence in older implementation notes is not counted as a new run.

## Completed

| Check | Actual result |
| --- | --- |
| Production unauthenticated `GET https://goodwatch.app/mcp` | 401; Bearer resource-metadata challenge; private/no-store/no-transform |
| Protected-resource discovery | 200; exact resource `https://goodwatch.app/mcp`; issuer `https://goodwatch.app/api/auth`; read/write scopes; public documentation/icon |
| Authorization-server discovery | 200; CIMD true, DCR, `none` token auth, S256 PKCE, code/refresh grants and revocation endpoints advertised. Real-client checks are recorded below. |
| Public website/setup/support/privacy/icon | Reachable; canonical setup `/use-with-ai`; `/connect` returns 404, so it is not used in submission materials. Public support email confirmed on `/support`. |
| MCP unit suite after annotation changes | `node --test 'app/server/mcp/*.test.ts'`: **69 passed**, zero failures/skips. Covers tool discovery/schema/annotations, scopes, invalid JSON/body limits, member policies, request rate-limit response and origin handling. |
| Auth protocol and wiring | `bash scripts/auth-mcp/run.sh`: auth typecheck passed; **44 passed**, zero failures. Disposable CrateDB/Valkey/Mailpit only. Includes OAuth scope/consent, grant identity, refresh/revocation and account boundary cases. |
| Data-backed endpoint suites | `bash scripts/mcp-details/run.sh`: passed read, scoped write, fresh-process replay, ranked quota/cache/paging, native search, personal taste/service links, rich details and real local Qdrant similarity probes. Synthetic loopback data; no production writes. |
| Discovery | `bash scripts/mcp-discover/run.sh`: passed **29 filter cases**, real Discover engine/URL parity, ranked cursor and poster hooks. |
| People/lists/settings/ranges | `mcp-features` seed + scoped grants + local integration + fresh-process replay: passed. Eight allowed member-table DML grants; catalog/profile/handle/Favorite/DDL denied. Verified people filtering, list ownership, five-title constraints, settings, episode ranges, scopes and durable retry receipts. |
| Tool reference generation | **25** names within limits, required metadata, input JSON schemas and confirmation hints validated; generated tools.md/tool-schemas.json. Runtime cross-field refinements also remain in Zod. |
| Plugin manifest | `claude plugin validate --strict --json plugins/goodwatch`: success, no errors/warnings. Nonblocking advice requests a marketplace installation line; no marketplace is included in this direct-directory bundle, so no fabricated install command is included. |
| Plugin skill directory | `claude plugin validate --strict --json plugins/goodwatch/skills`: success. This CLI report returned an empty contents array; it does not prove skill execution. The export validator independently checks both SKILL.md frontmatters/paths. |
| Bundle safety/export | `python3 scripts/claude-directory/package-plugin.py /tmp/goodwatch-claude-plugin.zip`: passed; six ordinary files, about 5.4 KB zipped, HTTPS URL match, bounded sizes, license, skill paths, no symlinks/dependencies/obvious embedded credentials. Archive not uploaded. Latest private standalone commit: `aee5677`; final six-file export is 5,501 bytes. |
| Monorepo packaging feasibility | `git ls-tree -rl HEAD`: 9,728 blobs totaling **490,690,479 bytes**, exceeding 256 MiB unpacked; exact GitHub compressed archive not measured. Standalone plugin repository is required for this source layout. |

Commands run from `goodwatch-webapp` unless they begin `python3 scripts/claude-directory/` or use `plugins/goodwatch`, which run from repository root. Regenerate tool docs with `node_modules/.bin/vite-node --config scripts/mcp-personal/vite.config.mjs scripts/claude-directory-tools.ts`.

Local logs are in `/tmp/gw-directory-*.log`; OAuth harness evidence and synthetic credentials stay in ignored `goodwatch-webapp/scripts/auth-mcp/results/`. Do not commit these directories. Test containers owned by completed runners are removed by their cleanup traps.

## Inspector and real Claude

Local client harness passed with MCP Inspector 2.11.0, Playwright 1.61.1 and Claude Code 2.1.304: Inspector DCR and strict 25-tool discovery, seven Inspector reads, Claude CIMD and three reads, then both clients called tools after the synthetic 60-second token lifetime with refresh 200 observed. Earlier attempts exposed absent pinned dependencies, browser navigation/error-reporting timeouts and a stale server-log path. Installed pinned dependencies, bounded browser navigation/error capture, and allowed the live server-log path. The final run passed.

Production: the existing populated reviewer member signed in and consented successfully. Inspector discovered 25 tools and successfully called all 15 reads and 10 writes. Production already reports `destructiveHint: true` for every write; deployment is not required solely for the annotation adjustment. Settings, services, rating and show-status calls retained existing values. Wishlist/hidden flags used a clean title. An undated watch and unlisted five-title list were created, exercised and removed; title marks were checked after cleanup. Durable replay succeeded.

Claude Code authenticated a separate custom connection with the reviewer account and successfully called all 15 reads. The first `get_list` fixture referred to the temporary list after deletion and correctly returned an error; a rerun with the existing populated sample list passed. The runner now checks tool-result errors as well as model completion. Claude Code also successfully called all 10 writes with exact completed action IDs and received replayed receipts: this proves client invocation and retry behavior, not fresh write approval UI. Temporary Code connections were logged out and removed. Both test-created Inspector grants were revoked through the reviewer account; a subsequent stored-auth-only call failed with `invalid_grant` / `auth_required` (exit 3). An authenticated Inspector read after the initial test interval also succeeded; production refresh rotation was not independently instrumented. Unrelated grants were preserved. Protected evidence contains actual arguments/results; do not distribute it.

Both plugin skills were invoked through Claude Code's Skill tool with MCP disabled. They loaded and gave setup guidance without claiming an action or known account state. The tracking instruction was tightened after the initial output implied an unknown title state. This checks skill loading and unavailable-connection behavior, not a connected end-to-end workflow.

Hosted follow-up: Ghostex MCP continued to time out, but direct connection to the embedded browser's local CDP endpoint succeeded. The owner's manually added GoodWatch connection was disconnected and removed at their request; its absence was verified in the connector list. The official submission form requires a custom connection before submission, so a distinct **GoodWatch directory review** connection was created and retained for that prerequisite. Its GoodWatch session was switched to the existing reviewer account, whose identity was checked before consent. Hosted OAuth/CIMD completed and the portal discovered all 25 tools.

In hosted Claude (Haiku 5.5 Medium), `get_settings` and `get_my_shows` completed successfully. A `set_want_to_see` call using an exact already-completed reviewer action ID displayed the real approval dialog. Allow once was selected; the expanded tool response reported **Replayed: Yes**, **Outcome: unchanged**, with unchanged before/after marks. No new production mutation was introduced. This validates one hosted write approval and replay, not every write variant or a new mutation.

Portal Tools displayed **25 suggestions**, all: “Missing title annotation. Add annotations.title, a human-readable name for the directory listing.” Added `annotations.title` to both source registration paths. General response-format instructions and cross-tool workflow instructions now live in server instructions, not repeated tool descriptions; factual descriptions and schemas remain. Reran **69 MCP tests: all passed**, including initialization guidance and endpoint metadata. Regenerated the tool reference. These changes were later deployed from the isolated release; all 25 portal suggestions cleared. Production already contains newer batch capabilities from concurrent work; never deploy the dirty shared checkout wholesale or treat the earlier single-operation ledger as exhaustive batch testing.

The official form is populated through Test & launch, with Media & Entertainment, GoodWatch name/slug, public links, three examples, company/contact and detected OAuth/CIMD. Contact name came from GoodWatch's public Impressum. No secrets were put into the draft; credentials remain to be transferred at authorized submission. Compliance acknowledgements remain unchecked. Save and exit reported **“Draft kept in this tab until you close it”**; directory management still has **0 submissions**. Keep that original browser tab open. No server-side submission ID or listing URL exists.

Remaining: remaining hosted tool calls, hosted refresh/revocation, fresh-user installation, connected plugin workflows/pairing, App screenshots, and final compliance/owner review. Inspector warned its temporary secret store was unencrypted (0600 inside 0700); those Inspector grants were revoked. The hosted reviewer connection remains active deliberately for draft validation. Do not distribute protected evidence.


## Reviewer example quality checks

The three read-only prompts were run through a new production Claude Code custom connection with the existing reviewer member. No tool permission denials occurred.

1. Unseen movies under two hours on saved services: returned Isle of Dogs (101 minutes), Nimona (102) and Howl's Moving Castle (119), with taste matches and catalog streaming offers. It also supplied two optional extra suggestions. Tool calls succeeded.
2. Arrival scores/availability/similar unseen movies: returned the feature film's source scores, reported no current catalog offers in the saved country and recommended Contact, Midnight Special and After Yang. Two initial name/year calls returned `ambiguous_title` because a short has the same name/year; the model then resolved the feature's canonical ID and completed successfully. For a deterministic demo, specify Denis Villeneuve's feature or the canonical title URL. Similarity and taste were distinguished.
3. Next episode/progress: correctly identified the populated show and next episode. The initial answer added an Apple TV+ availability claim from model knowledge after the catalog returned no offer. This is a response-quality warning, not a server offer. The reviewer prompt now explicitly requires returned availability only; the focused rerun passed with no tool errors, explicitly reported unknown availability for the current show, and fetched actual offers for two alternatives. The plugin already instructs against invented availability. Retest this on hosted Claude.

## Every-tool client ledger

All Inspector calls below were against production. Claude Code writes used completed receipt replays; hosted results were completed on 2026-10-20. The corrected list read passed separately. Local endpoint tests do not replace these client calls.

| Tool | MCP Inspector | Claude Code custom connection | Hosted Claude |
| --- | --- | --- | --- |
| search_titles | Pass | Pass | Pass |
| discover_titles | Pass | Pass | Pass |
| get_discover_filters | Pass | Pass | Pass |
| get_title | Pass | Pass | Pass |
| get_similar_titles | Pass | Pass | Pass |
| get_my_shows | Pass | Pass | Pass |
| get_show_progress | Pass | Pass | Pass |
| get_tonight | Pass | Pass | Pass |
| get_library | Pass | Pass | Pass |
| get_taste | Pass | Pass | Pass |
| search_people | Pass | Pass | Pass |
| get_person | Pass | Pass | Pass |
| get_my_lists | Pass | Pass | Pass |
| get_list | Pass | Pass | Pass |
| get_settings | Pass | Pass | Pass |
| log_watch | Pass | Pass | Pass |
| rate_title | Pass | Pass | Pass |
| set_want_to_see | Pass | Pass | Pass: approved replay |
| set_not_interested | Pass | Pass | Pass |
| set_show_status | Pass | Pass | Pass |
| undo_watch | Pass | Pass | Pass |
| set_my_services | Pass | Pass | Pass |
| set_settings | Pass | Pass | Pass |
| create_list | Pass | Pass | Pass |
| update_list_titles | Pass | Pass | Pass |

## Remaining gates

1. Owner authorization for connector submission and its possible Community publication; final draft contact is hello@goodwatch.app, with a nonblocking mismatch advisory against the owner's Gmail login.
2. Optional plugin repository remains private. Private portal validation now passed after owner reauthentication and repair of the existing GitHub App link. Seven checks passed; four informational directory-field warnings are documented. Publication remains separately unauthorized. Private ZIP installation and both hosted skills passed; no public pairing claim is made.
3. Observe hosted token expiry/refresh and test any additional claimed surfaces. Existing isolated protocol tests are evidence only for their clients/environment.
4. Fresh eligible-user installation, public discoverability and post-publication checks require actual authorized publication. Follow handoff.md; no listing URL or submission ID exists yet.

Whole-app build/typecheck were not run locally for these narrow changes; the normal production image build completed. Existing page smoke fixture failures remain documented separately from both passing search-role suites. Do not deploy the dirty shared checkout.
