# Tool inventory and annotation rationale

Verified against authenticated production `tools/list` after release `a8975af9`, exactly matching the current-main local SDK contract. All 25 tools have strict validated input schemas; write tools require `action_id`. The connected OAuth subject supplies the member ID; callers cannot choose an account or workspace. GoodWatch has member accounts rather than workspace tenancy.

The current guidelines say annotation justifications are no longer mandatory. They are provided here for auditability. `idempotentHint=true` means reads can be repeated and writes use durable, member-scoped action receipts. It does not make a new action ID safe to retry.

| Tool | Read only | Destructive | Open world | Reason |
| --- | --- | --- | --- | --- |
| search_titles | true | false | false | Retrieves bounded GoodWatch catalog or connected-member data; no public web search or arbitrary destination. Cache, metrics and search budget bookkeeping are internal operational effects. |
| discover_titles | true | false | false | Retrieves bounded GoodWatch catalog or connected-member data; no public web search or arbitrary destination. Cache, metrics and search budget bookkeeping are internal operational effects. |
| get_discover_filters | true | false | false | Retrieves bounded GoodWatch catalog or connected-member data; no public web search or arbitrary destination. Cache, metrics and search budget bookkeeping are internal operational effects. |
| get_title | true | false | false | Retrieves bounded GoodWatch catalog or connected-member data; no public web search or arbitrary destination. Cache, metrics and search budget bookkeeping are internal operational effects. |
| get_similar_titles | true | false | false | Retrieves bounded GoodWatch catalog or connected-member data; no public web search or arbitrary destination. Cache, metrics and search budget bookkeeping are internal operational effects. |
| get_my_shows | true | false | false | Retrieves bounded GoodWatch catalog or connected-member data; no public web search or arbitrary destination. Cache, metrics and search budget bookkeeping are internal operational effects. |
| get_show_progress | true | false | false | Retrieves bounded GoodWatch catalog or connected-member data; no public web search or arbitrary destination. Cache, metrics and search budget bookkeeping are internal operational effects. |
| get_tonight | true | false | false | Retrieves bounded GoodWatch catalog or connected-member data; no public web search or arbitrary destination. Cache, metrics and search budget bookkeeping are internal operational effects. |
| get_library | true | false | false | Retrieves bounded GoodWatch catalog or connected-member data; no public web search or arbitrary destination. Cache, metrics and search budget bookkeeping are internal operational effects. |
| get_taste | true | false | false | Retrieves bounded GoodWatch catalog or connected-member data; no public web search or arbitrary destination. Cache, metrics and search budget bookkeeping are internal operational effects. |
| search_people | true | false | false | Retrieves bounded GoodWatch catalog or connected-member data; no public web search or arbitrary destination. Cache, metrics and search budget bookkeeping are internal operational effects. |
| get_person | true | false | false | Retrieves bounded GoodWatch catalog or connected-member data; no public web search or arbitrary destination. Cache, metrics and search budget bookkeeping are internal operational effects. |
| get_my_lists | true | false | false | Retrieves bounded GoodWatch catalog or connected-member data; no public web search or arbitrary destination. Cache, metrics and search budget bookkeeping are internal operational effects. |
| get_list | true | false | false | Retrieves bounded GoodWatch catalog or connected-member data; no public web search or arbitrary destination. Cache, metrics and search budget bookkeeping are internal operational effects. |
| get_settings | true | false | false | Retrieves bounded GoodWatch catalog or connected-member data; no public web search or arbitrary destination. Cache, metrics and search budget bookkeeping are internal operational effects. |
| log_watch | false | true | false | Adds watches without deleting existing records; action receipts deduplicate retries. |
| rate_title | false | true | false | Replaces or clears a rating and may change its implicit movie watch. |
| set_want_to_see | false | true | false | Can remove Wishlist membership; adding a Seen title requests a rewatch. |
| set_not_interested | false | true | false | May remove Want to See while changing the private mark. |
| set_show_status | false | true | false | May bulk mark aired episodes, drop a show or start another pass. |
| undo_watch | false | true | false | Deletes the selected watch; retry cannot delete a different watch. |
| set_my_services | false | true | false | Replaces saved country/services, including removals. |
| set_settings | false | true | false | Overwrites selected account preferences; omitted fields are preserved. |
| create_list | false | true | true | Publishes a new five-title list. Unlisted also exposes content to link holders. |
| update_list_titles | false | true | true | Overwrites titles/ranks in a publicly reachable or unlisted share list. |

All read tools advertise `mcp:read`; all writes advertise `mcp:read` and `mcp:write` in `_meta.securitySchemes`, the documented compatibility location supported by the pinned SDK. HTTP bearer challenges remain authoritative: anonymous/expired requests return 401; forced writes without write scope return 403 with an insufficient-scope challenge. This server requires OAuth at connection time, rather than permitting anonymous discovery and tool-level login. Verify the scanner imports the scopes; do not claim hosted linking was tested.

Read annotations describe retrieval/computation. Optional smarter search queries the existing bounded catalog and consumes the existing member search allowance; it does not search arbitrary public sites. Provider links are returned from stored availability evidence; the tool does not follow those links.

The poster resource uses `ui://goodwatch/posters-v3.html`, a stable data contract, with `ui.domain` and `openai/widgetDomain` set to the MCP site origin. CSP permits resources only from `https://image.tmdb.org` and `https://goodwatch.app`, no connect or nested-frame domains. No third-party iframe justification is needed because it embeds no frames. Authenticated production resource reads passed; actual ChatGPT resource rendering remains an owner test.

Confirmation relies on host approvals and accurate annotations; it is not a server-issued approval-token protocol. OAuth write consent alone must never be treated as permission for an unrequested action. Preserve host confirmation and verify actual ChatGPT behavior on disposable data before submission.
