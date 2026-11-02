# Listing copy — owner review required

## Connector

Name: **GoodWatch**

Proposed slug: `goodwatch` (availability unverified; portal choice is permanent).

One-liner: **Find movies and shows for your taste and streaming services, and track what you watch.**

Description:

> GoodWatch is a free site for choosing a movie or show. It combines IMDb, Rotten Tomatoes, Metacritic and TMDB scores into one score, shows which of 325 streaming services in 139 countries has each title, and picks titles for your taste from a few ratings. You can search by mood, track your Wishlist and show progress, and import your history from Letterboxd, Trakt, IMDb, Plex and more.
>
> Connect your free GoodWatch account to Claude to find something to watch, check your next episode, explore similar titles and cast or crew, and read your ratings, Wishlist and share lists. With your permission, Claude can log watches, rate titles, change Wishlist and show status, adjust preferences, and create or edit five-title share lists. Imports happen on the website, not through this connector. GoodWatch does not play video. Streaming availability and taste matches can be unknown.

The first paragraph is the owner-specified medium description from the local listings kit, retrieved 2026-10-20. Service/country counts are supported by the current homepage; recheck before submitting. This description is below the official 2,000-character limit; the one-liner is below 200 characters. The live portal category **Media & Entertainment** was selected in the draft.

## Required links and branding

| Field | Value / status |
| --- | --- |
| Server | https://goodwatch.app/mcp |
| Website | https://goodwatch.app |
| Usage documentation | https://goodwatch.app/use-with-ai |
| Support | https://goodwatch.app/support |
| Support email | hello@goodwatch.app (existing public address; use for public support and proposed review contact) |
| Privacy | https://goodwatch.app/privacy |
| Status | https://status.goodwatch.app |
| Source | https://github.com/alp82/goodwatch-monorepo |
| Icon | https://goodwatch.app/mcp-icons/goodwatch-white-512.png (white G, 512px; live bytes and custom directory preview verified) |
| Submission owner | Owner's existing personal Claude Max account, confirmed 2026-10-20; private login address omitted from public files |
| Legal/company name and review contact | Draft: organization GoodWatch; contact Alper Ortac, from the public Impressum; hello@goodwatch.app. Owner must confirm before submission. |
| Terms | Owner must identify applicable terms; do not label `/disclaimer` as Terms of Service without checking its contents |
| Reviewer account | Existing populated GoodWatch member confirmed by owner and saved Google & SEO record; fresh production access verified; enter credentials only in secure portal fields |

Use the existing GoodWatch mark; avoid third-party marks as the connector icon and avoid any claim of Anthropic endorsement. Owner must verify all company, rights and legal acknowledgements.

## Plugin listing

Name: **GoodWatch**; version `1.0.1`; short description: **Guided movie and show discovery, plus careful watch tracking with your GoodWatch account.**

> Choose something to watch using your taste, country and streaming services, or update your watching progress in a guided workflow. Includes watch-tonight and track-watching skills and the GoodWatch remote connector. Requires a free GoodWatch account. Read-only access supports discovery; changes require write consent and applicable tool approval. No local dependencies or API keys.

Repository: https://github.com/alp82/goodwatch-claude-plugin, root folder, `main` branch. Currently private; public release requires owner authorization. Pair with the connector in the same organization, using **https://goodwatch.app/mcp** exactly. README, support, privacy and icon can reuse the connector values. Do not invent a repository URL in the portal.

## Data-handling answers to review

Inputs are requested title/person searches, IDs, filters, saved-preference changes and explicit watch/rating/list actions. The connector does not request Claude conversation history, memory, files, or unrelated personal data. GoodWatch stores existing member library/preferences and durable mutation receipts; auth tokens/grants use the existing encrypted auth store. It uses first-party catalog/member services with third-party catalog, scores, artwork and availability sources. Account-bound responses are private/no-store. Verify actual telemetry retention, subprocessors, deletion policy and third-party rights against the current privacy policy before completing portal attestations; do not infer “no data stored” from a small tool payload.
