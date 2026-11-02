# Reviewer guide

## Existing reviewer account

The owner confirmed an existing GoodWatch reviewer member on 2026-10-20. The saved Google & SEO account record is in `docs/implementation/mcp-directory-listing.md` on `origin/main` (inspected at commit `9f9a695f`), corroborated by `docs/chatgpt-plugin/reviewer.md`. Reuse this populated production account; do not create a duplicate. Its account identifier, alias, handle, sample share URL, internal host and protected credential paths belong in secure reviewer notes, not this public packet. The original record identifies the root-only credential and verification-record locations. Retrieve through the existing trusted owner process and transfer credentials only into secure portal fields; the protected credential source was used in memory for fresh production Inspector/Claude Code tests. No credentials were written to distributed files.

The 2026-10-17 record reports real signup/email delivery/verification, successful password sign-in, seeded-state readback, all 25 tools through DCR + S256 PKCE with temporary writes reverted, poster-resource reads and refresh rotation. That is historical evidence; fresh Inspector and Claude Code results are in [tests](tests.md). Hosted Claude is still pending. It is an ordinary production member: its activity may affect statistics/recommendations, so keep authorized changes minimal and restore only explicitly approved disposable state. No supported test-account exclusion flag was established.

Before handoff, compare its current state with the prompts: at least five liked ratings, several Want to See movies/shows, a Watching show with an aired next episode, saved country/services, a website-created handle and a five-title share list. Use its existing fixtures rather than resetting them to an invented template. Keep dates unknown unless supplied. A distinct disposable peer account is still needed for isolation checks if no suitable existing one is available. Record baselines privately and verify normal password sign-in from a clean browser profile/external network without inherited owner cookies, MFA workarounds or a reviewer bypass.

Provide the reviewer username/password through the portal's secure test-credential fields. Keep email confirmation/reset access available during review, and avoid an uncoordinated 2FA or password rotation that blocks reviewers. Never put credentials, OAuth codes/tokens, member exports or private screenshots in GitHub or email. Revoke reviewer grants and rotate the test password when the review no longer needs them.

## Example prompts and expected behavior

These are live-data prompts, not permanent assertions about streaming offers. The first three were exercised with the populated account through Claude Code on 2026-10-20; observed results and caveats are in [tests](tests.md). Repeat on hosted Claude before submission.

| Prompt | Expected result / tools |
| --- | --- |
| “Find three unseen movies under two hours on my saved services. Explain my taste match and where each streams.” | `get_settings`, `get_taste`, filter options and `discover_titles` with native unseen/runtime/service filters; at most three linked picks, truthful match/availability, or an explicit no-match/unknown explanation. No settings change. |
| “Find Arrival (2016), show its scores and where I can watch it, then find three similar movies I haven't seen.” | `search_titles`, resolve namesakes if needed, `get_title`, `get_similar_titles`; distinguish provider scales, similarity and taste; real GoodWatch links. |
| “What should I watch next, and where am I in my current show? Use only GoodWatch-returned streaming availability; say unknown if none is returned.” | `get_tonight`, `get_my_shows` / `get_show_progress`; next aired episode consistent with the member's current pass. Unknown dates remain unknown. |
| “Add Arrival (2016) to my Wishlist.” | Resolve exact movie, approval for the scoped write, `set_want_to_see` with a fresh action ID, then `get_library` verifies membership. Use only an authorized disposable account. |
| “Show my share lists and open the first one.” | `get_my_lists` / `get_list`; exactly five ranked titles and the actual share link. No other member's unlisted lists. |

## Every-tool execution ledger

For each of the 25 tools in [tools.md](tools.md), record Inspector result, real hosted Claude result, parameters (sanitized), expected effect, actual effect, timestamp/client version, and cleanup. Use [input schemas](tool-schemas.json). Pending tools stay pending; protocol unit tests do not replace these calls. Include each optional include/paging variant that is relevant, ambiguous names and a valid empty result.

Write scenarios cover log one movie, one aired episode, an episode range and a whole season; rate/clear; Want to See add/remove; Not interested and its Wishlist effect; show status and pass behavior; undo an exact watch; country/services replacement; language-only settings change; create exactly five titles with explicit visibility; paired title replacement in an owned list. Reuse exact action IDs to test retries, and read back state. The server has no MCP delete-list tool: remove demonstration lists through the website when finished.

Test read-only authorization (15 tools before account flags), read/write (25 before flags), forced write with read-only token, foreign list IDs, disabled tools, invalid parameters, missing handle, stale/conflicting action and changed action-ID payload, request 429/Retry-After, and descriptive-search daily quota. Drive quotas against the isolated local fixture, not by flooding the public service.

OAuth cases: hosted callback, Code loopback callback, DCR/CIMD registration, state/S256 mismatch, denial, scope narrowing, code replay, token expiry/refresh/rotation/retry, invalid refresh, disconnect then access/refresh rejection, reconnect fencing, and separate device grants. Verify errors reveal no other member's state. Stop and report any unexpected change; avoid repeating an uncertain action with a new ID.

## Demo outline (about three minutes)

1. Show public setup documentation and exact server URL; connect a disposable account through the real GoodWatch consent screen. Show the chosen permissions without exposing codes or tokens.
2. Run the discovery prompt and open a returned title; show scores, taste match and availability limitations.
3. Show current progress, approve one requested disposable watch, and verify the next episode. Explain unknown dates and retry behavior.
4. With the optional plugin installed, invoke watch-tonight and track-watching, confirm both use the same connector without duplicate tools.
5. Disconnect in GoodWatch and demonstrate that the next account request fails.

No recording was made. Three actual hosted Claude App screenshots, each at least 1,000 pixels wide and clipped to the App result, are prepared in [screenshots](screenshots/README.md), with exact prompts separately recorded. Never substitute the public setup page's explicitly labeled illustration for a real result. Declare app open-link origins accurately; external streaming destinations should retain confirmation unless specifically reviewed. If no App is submitted, say tools-only and verify the actual listing configuration reflects it.
