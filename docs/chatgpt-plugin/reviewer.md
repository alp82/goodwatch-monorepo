# Reviewer access and walkthrough

## Existing reviewer account — confirmed by owner

The owner and Google & SEO session confirmed a populated production reviewer account. Its protected credential and verification-record locations are documented in the existing `docs/implementation/mcp-directory-listing.md` on main. Do not copy the alias, handle, internal host, share URL or credential paths into new public files. Reuse this account with normal email/password sign-in. It must be verified before handoff and usable without a new email/SMS code, MFA, invitation, local network or additional setup. Do not disable production safeguards to create a reviewer bypass. The normal GoodWatch OAuth login and consent must work.

The existing 2026-10-17 record reports verified signup/login, seeded-data readback, all 25 tools over DCR + S256 PKCE with temporary writes reverted, poster-resource reads and refresh rotation. This is historical evidence, not a hosted ChatGPT test or a new independent retest. On 2026-10-20 a fresh independent direct HTTP login and normal DCR/PKCE consent succeeded, all 15 read tools and poster resource were called, a token was allowed to expire, refresh rotation succeeded, and revoked/read-only grants were checked. Temporary grants were revoked and the session signed out; no member content was changed. See [live protocol evidence](evidence/live-protocol.json). Hosted ChatGPT checks remain outstanding. No walkthrough exists. Its activity counts as normal production activity, so keep changes minimal and restore only explicitly authorized disposable state.

Check the fixture against the initial cases before recording; the existing account need not match these suggested seeds exactly:

- Choose a country with known streaming evidence and at least two supported services.
- Rate at least five liked titles so Taste can return actual matches; keep a separate unrated title for rating tests.
- Add multiple movies and shows to Want to See; leave Arrival (2016) out initially.
- Start a show with several already aired regular episodes. Log its first two episodes, leaving a known Next episode. Record the exact show and catalog episode numbers in the secure reviewer notes; do not depend on an unpredictable broadcast schedule.
- Create a handle on the website and a disposable five-title share list for list tests. Treat public and unlisted contents as externally accessible.
- Keep another synthetic account with visibly different state for the isolation checks. Never seed either account with real private viewing history.

Verify email/password login, consent and tool calls in a clean browser profile from an independent external network, with no inherited owner cookies. Test account access after reconnect and after access-token expiry. Record the time, host surface/version, granted scopes and pass/fail; store passwords only in platform secure review fields. Do not put passwords, tokens, verification links or cookies in this repository, ZIP, recording or chat.

## Initial MCP cases

Exactly five positive and three negative cases are in [review-cases.json](review-cases.json) and the manifest. Each has a prompt, expected tool use and observable result. Cases that change data require the disposable account and an explicit approval. The log-watch case intentionally pauses for the reviewer's confirmation; no write should occur during its initial turn.

The eight cases have not been executed in hosted ChatGPT. Local tests exercise their underlying capabilities with synthetic data, but do not establish ChatGPT tool selection or approval behavior. Record hosted actual results alongside each case. Reset fixture state before repeating Wishlist and episode cases; use a new action ID only for a genuinely new action. Preserve the same ID after uncertain delivery.

## Required recording script

Produce a continuous, reviewer-accessible video walkthrough (the official requirement is a video URL; no fixed duration was established). Keep the account login details off screen and do not record consent codes or bearer tokens.

1. Show the exact GoodWatch plugin and production endpoint in a fresh eligible ChatGPT account. Install through the supported test mechanism and complete normal OAuth on goodwatch.app.
2. Show the requested permissions and the read-only choice; connect with read/write for the mutation demonstrations. Do not consent to identity scopes.
3. Run positive cases 1–3: Tonight, Arrival details/similar titles, and the seeded show's next episode. Show links, freshness limitations, taste and posters. Demonstrate the same account's website state for comparison.
4. Run positive case 4 on disposable state: add Arrival to Wishlist, inspect the receipt and reread the library.
5. Run positive case 5: identify the exact next episode, visibly stop for approval, then log one watch and reread progress. Demonstrate retry deduplication if the client exposes the same action ID.
6. Run the three negative cases. Show that unsupported payment/playback causes no writes, private peer data is not exposed and the read-only request changes nothing.
7. Briefly demonstrate a disposable share-list publish/edit approval and a destructive removal approval, with before/after state. Test the remaining tools using the matrix in tests.md; these are implementation checks, not extra initial review cases.
8. Reconnect with read-only access and show writes are unavailable. Revoke the grant in GoodWatch Connected apps and show further use requires reconnecting.

Upload the video to an owner-approved reviewer-accessible location. Test its URL without owner cookies. Add its URL to `extensions.com.openai.review.demo_recording_url`, rebuild the ZIP and supply any secure account notes in the portal. If the recording lacks required behavior, fix and rerecord rather than claim success.

See [official MCP review access requirements](https://developers.openai.com/plugins/deploy/app-review) and [submission review fields](https://developers.openai.com/plugins/deploy/submission#configure-onboarding-review-and-publication).
