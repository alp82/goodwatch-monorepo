# GoodWatch — Claude Connectors Directory submission kit

Prepared on **2026-10-17**. Owner decisions: Claude members first, technical users next, ChatGPT later; listings belong to the owner's personal accounts and the owner submits; use a populated reviewer account; free listings only, with no proxy. **Nothing has been submitted.** This kit does not change the MCP server.

Rechecked against Anthropic's [submission instructions](https://claude.com/docs/connectors/building/submission), [review checklist](https://claude.com/docs/connectors/building/review-criteria), [Software Directory Policy](https://support.claude.com/en/articles/13145358-anthropic-software-directory-policy) (April 15, 2026), [Directory Terms](https://support.claude.com/en/articles/13145338-anthropic-software-directory-terms) (March 16, 2026), [publisher eligibility](https://claude.com/docs/directory/publish), and [authentication requirements](https://claude.com/docs/connectors/building/authentication). The starting research is on `origin/research/mcp-distribution`, in `docs/implementation/mcp-distribution-research.md`, sections “Anthropic: submission kit and interactive status” and “Prioritized action list”.

## Listing copy

| Field | Value |
| --- | --- |
| Name | GoodWatch |
| One-liner | Find movies and shows for your taste, see where to stream them, and keep your Wishlist, ratings, and episode progress together in Claude. |
| Permanent slug proposal | `goodwatch` — owner checks availability before publication; the published slug cannot change. |
| Categories | Propose **Entertainment** and **Lifestyle**, if those exact choices exist; use the nearest available entertainment/personal-use category. The public instructions specify 1–5 categories but do not publish the live picker taxonomy. |
| Website | `https://goodwatch.app` |
| Server URL | `https://goodwatch.app/mcp` — one universal URL, directly operated by GoodWatch. |
| Documentation | `https://goodwatch.app/connect` |
| Privacy | `https://goodwatch.app/privacy` |
| Support / security contact | `hello@goodwatch.app` / `mailto:hello@goodwatch.app` |
| Publisher | GoodWatch; owned and maintained through the owner's personal paid Claude account. The owner supplies the truthful legal/publisher name and primary review contact. |
| Access | A free, verified GoodWatch account. Individual OAuth sign-in and consent; no API key or local proxy. |
| Capabilities | Reads and writes. Read-only consent remains available; write tools require `mcp:write`. |
| Authentication | Prefer `oauth_cimd`; DCR (`oauth_dcr`) is also implemented. No Anthropic-held secret is needed. |
| Icon to upload | `goodwatch-webapp/public/mcp-icons/goodwatch-512.png` (512×512 PNG); reuse the compatibility thread’s GoodWatch artwork. |
| Allowed link URIs | `https://goodwatch.app` only. Do not list TMDB, streaming services, or other third-party origins as owned link targets. |

Name: 9 characters. One-liner: 137 characters. Description: 1,206 characters (including paragraph breaks), within the current 100 / 200 / 2,000 limits.

Paste this description:

<!-- listing-description:start -->
GoodWatch helps you choose a movie or show and keep track of what you watch, using your own ratings, Wishlist, country, and streaming services.

Ask Claude to explore movies and shows, find more like a title you enjoy, compare GoodWatch taste matches, check streaming availability, or look through a person's filmography. Supported responses include poster cards with links back to GoodWatch. Availability depends on the country and the catalog's latest information; missing or stale availability stays unknown.

Connect your free GoodWatch account to browse your Wishlist and ratings, see the next episode of a show you're watching, and read your share lists. With your permission, Claude can add or remove Want to See titles, rate a title, log or undo a watch, update show status, change your country and streaming services, and create or edit a five-title share list. Creating a share list requires a GoodWatch handle.

Choose read-only access or read and change access when connecting. You can revoke access at any time in GoodWatch Settings → Connected apps. GoodWatch does not play movies or shows; it helps you decide what to watch and takes you back to the relevant title and streaming information.
<!-- listing-description:end -->

Use cases: choose something to watch; explore similar titles and filmographies; manage Wishlist and ratings; continue a show; share five ranked favorites. Do not advertise automatic playback, guaranteed availability, an Anthropic endorsement, or universal client compatibility.

## Production reviewer account

| Item | Provisioned value |
| --- | --- |
| Email | `hello+directory-reviewer@goodwatch.app` |
| Display name | GoodWatch Directory Reviewer |
| Account ID | `582df554-4bad-42bc-a805-bc9450a9af16` |
| Handle | `goodwatch_reviewer` |
| Password | Generated on crate-01 (`root@10.0.0.11`); stored only in `/root/.config/goodwatch/directory-reviewer/credentials`, JSON with `email` and `password`. Root-owned, mode `0600`, parent directory `0700`. Never add it to Git, screenshots, chat, logs, or public documentation. |
| Verification | Actual production Better Auth email sign-up, real Purelymail delivery to the alias, and the delivered verification link consumed through `/api/auth/verify-email`; subsequent password sign-in reported `emailVerified: true`. No auth-table SQL inserts or verification-flag updates. |
| Watching from / title language | Germany (`DE`) / English (`en`). |
| Streaming services | Netflix (`8`), Amazon Prime Video (`9`), Disney+ (`337`). These are saved preferences; the reviewer needs no paid streaming subscription to use GoodWatch. |
| Onboarding | Country, streaming and ratings steps complete; personalized ordering on; cookie consent set to no. |
| Show to continue | Severance (`show:95396`), Watching, pass 1. Season 1 episodes 1–3 logged on October 10, 12 and 15, 2026. Next episode: S1E4, “The You You Are”. |
| Share list | “Five stories worth a second look”, five ranked titles, unlisted. [Open sample list](https://goodwatch.app/u/goodwatch_reviewer/lists/VA4ld6Q0eS). Unlisted still means anyone with its URL can open it. |

The alias delivers to the owner's `hello@goodwatch.app` Purelymail mailbox; delivery and verification were tested, so no owner verification click remains. Only messages addressed to the exact reviewer alias were fetched, without marking them read. SMTP acceptance alone was not treated as proof of delivery.

Provisioning used the public authenticated app routes and their existing write functions: `/api/update-scores` → `updateScores`, `/api/update-wishlist` → `updateWishList`, `/api/user-settings/set` → native settings/preferences writers, `/api/tracking/show` → `applyShowTrackingAction`, `/api/handle` → `claimHandle`, and `/api/share-lists` → `createList`.

**Stats limitation:** no supported test/reviewer-account exclusion flag was found in the auth model, settings schema, or application statistics paths. This is a normal production member and its ratings/activity may contribute to member counts, aggregates, and recommendation training. Cookie consent “no” is not an aggregate-statistics exclusion. No invented flag or unrelated code change was added.

### Seeded data

Wishlist: **20 titles**, 14 movies and six shows.

- Movies: Dune; Dune: Part Two; Blade Runner 2049; Ex Machina; Barbie; Oppenheimer; Green Book; Jojo Rabbit; Alita: Battle Angel; Elemental; It; Spider-Man: Into the Spider-Verse; Soul; Good Will Hunting.
- Shows: The Bear; Chernobyl; The Last of Us; One Piece (2023); Arcane; From.

Ratings: **30 titles**, 20 movies and ten shows, on GoodWatch's 1–10 scale.

| Score | Movies | Shows |
| --- | --- | --- |
| 10 | Arrival; Spirited Away | Breaking Bad |
| 9 | The Matrix; Interstellar; The Shawshank Redemption; The Dark Knight; The Fellowship of the Ring; The Return of the King; Back to the Future; Parasite; Everything Everywhere All at Once | Severance; Better Call Saul; The Office; Dark |
| 8 | Inception; Forrest Gump; Pulp Fiction; The Godfather; Toy Story; Mad Max: Fury Road | Stranger Things; Black Mirror; Demon Slayer; Attack on Titan |
| 7 | Fight Club; La La Land | — |
| 6 | Dilwale Dulhania Le Jayenge | How I Met Your Mother |

The sample share list contains The Matrix, Arrival, Spirited Away, Parasite and Severance, in that order. Ratings on shows do not invent episode watches or set those shows to Seen; Severance alone has seeded episode progress.

### Reviewer connection instructions

1. Open [GoodWatch sign-in](https://goodwatch.app/sign-in) and use the reviewer email and password supplied in the portal's private test-credentials field. Email is already verified; use password sign-in rather than Google.
2. In Claude's custom-connector setup, name it GoodWatch and enter `https://goodwatch.app/mcp`. Connect, sign in as this reviewer, choose **Read and change my GoodWatch**, and allow. Read-only access is available for read-only review, but does not expose the write tool set.
3. Start a conversation with GoodWatch enabled and run the examples below. No local software, proxy, streaming payment, MFA, or owner email click is required.
4. Review changes in [My library](https://goodwatch.app/my-library), [My shows](https://goodwatch.app/my-shows), [Lists](https://goodwatch.app/lists/mine), and [Settings](https://goodwatch.app/settings). Revoke access in [Connected apps](https://goodwatch.app/settings/connected-apps).

The owner transfers the password securely from the root-only file into the portal's private reviewer field. This document deliberately contains no credential-retrieval command that prints the password.

## Working prompt examples and screenshot shot list

The prompts below are literal text for the owner to run in **Claude.ai**, after connecting the reviewer account. Backend tool checks establish the fixtures and responses; they do not establish how Claude selects tools or renders them. Capture genuine responses, not a reconstruction. Re-run after the compatibility thread's production deployment if tool/resource behavior changes.

For the carousel, use 3–5 **PNG** files, each **at least 1000 pixels wide after cropping**, containing only the app response, with no prompt in the image. Any aspect ratio is accepted; one batch covers desktop and mobile; no video/GIF. Supply each exact prompt separately. Capture at a large viewport/device scale, keep poster text legible, and verify final PNG dimensions. Do not stretch a smaller image to satisfy the width rule.

| PNG filename proposal | Exact Claude.ai prompt | Expected tool call / visual to capture |
| --- | --- | --- |
| `01-wishlist.png` | “Show six movies from my GoodWatch Wishlist with the highest GoodWatch taste match, with poster cards.” | `get_library` with `filter=want_to_see`, `kind=movie`, `sort=match`, `limit=6`; six saved movie posters with actual match values and title links. |
| `02-more-like-arrival.png` | “Show six movies like Arrival (2016) that I haven't seen, using GoodWatch's More like this and poster cards.” | `get_similar_titles` with `title_id=movie:329865`, `kind=movie`, `exclude_seen=true`, `limit=6`; similar-title poster cards. Availability is not implied. |
| `03-villeneuve.png` | “Show six movies directed by Denis Villeneuve, ordered by my GoodWatch taste, with poster cards.” | `search_people` for the name if needed, then `get_person` with `person_id=137427`, `role=directing`, `sort=for_you`, `limit=6`; filmography posters and accurate person/title links. |
| `04-share-list.png` | “Open my GoodWatch share list ‘Five stories worth a second look’ and show its five titles in order with poster cards.” | `get_my_lists`, then `get_list` with `list_id=VA4ld6Q0eS`; five ranked sample posters and the actual share link. |
| `05-discover.png` | “Use GoodWatch to discover six movies I haven't seen on my saved streaming services in Germany, with poster cards.” | `discover_titles` with `type=movie`, `on_my_services=true`, `exclude_seen=true`, `limit=6`; country/service-filtered results. Capture only when offers are present and clearly described. |

Additional core examples for review:

- “What episode of Severance should I watch next on GoodWatch?” → `get_show_progress` (`show:95396`), three watched episodes and S1E4 next. This tool is text/structured output, so it is not a poster-carousel shot.
- “What country, title language, and streaming services have I saved in GoodWatch?” → `get_settings`, DE / en / 8, 9, 337.
- “Add Dune (2021) to my GoodWatch Wishlist.” → `set_want_to_see` (`movie:438631`, `want_to_see=true`, fresh action ID); it is already present and must not duplicate it.
- “Keep my GoodWatch rating for Arrival (2016) at 10 out of 10.” → `rate_title` (`movie:329865`, `score=10`, fresh action ID), retaining the rating.

The first five read prompts are suitable carousel candidates; the latter examples demonstrate progress, preferences, and explicit writes without needing new personal data. Read calls never require write consent. Do not claim these are end-to-end Claude.ai prompt tests until the owner has actually run them.

## Live URLs, artwork, and owner TODOs

| Asset | Checked state on 2026-10-17 | Action |
| --- | --- | --- |
| `https://goodwatch.app/privacy` | HTTP 200, “Privacy \| GoodWatch”; October 17 account/connected-app policy is present. | Owner confirms legal identity, applicable third-party policies, retention and poster/data rights remain accurate. Reachability does not constitute legal approval. |
| `https://goodwatch.app/connect` | HTTP 200; real setup instructions, permissions, disconnect help and `hello@goodwatch.app`. | Use as docs URL and support-help fallback. Another thread is updating client instructions; recheck after release. |
| `mailto:hello@goodwatch.app` | Existing support address on `/connect`; the same Purelymail mailbox received the verification message. | Use the email contact; verify incoming product/security requests continue to be monitored. |
| `/terms`, `/terms-of-service` | Both HTTP 404. | Missing: owner supplies or approves a public GoodWatch Terms page, proposed `https://goodwatch.app/terms`. GoodWatch Terms is not a listed mandatory field in the current Claude portal; Anthropic's own Directory Terms are a required acknowledgment. |
| `/support`, `/help`, `/docs` | All HTTP 404. | Do not enter these as working URLs. `/connect` and the support mailbox cover the present portal fields. A dedicated support page is an optional owner follow-up. |
| `goodwatch-webapp/public/apple-touch-icon.png` | Existing 180×180 PNG; `https://goodwatch.app/apple-touch-icon.png` returned 200. | Existing brand-image fallback; use the 512px MCP icon above for this listing. |
| `goodwatch-webapp/public/favicon-32x32.png`, `favicon-16x16.png`, `favicon.ico` | Existing favicon assets. | Small browser icons; use the larger MCP icon above. |
| `goodwatch-webapp/public/mcp-icons/goodwatch-512.png`, `goodwatch-128.png`, `goodwatch-48.png` in the same directory | Added on main by compatibility commit `b0b81294`; all three live `/mcp-icons/` URLs returned 200 `image/png` with exact 512×512 / 128×128 / 48×48 dimensions. | Upload the 512px file; retain 128px/48px alternatives. Do not use `tmdb-logo.svg` as the GoodWatch icon. |
| Carousel images | Shot list supplied; no actual Claude.ai screenshots captured in this task. | Owner captures 3–5 real PNGs using the exact prompts above, checks dimensions and confirms rights to redistributed posters. |

## Tool annotation and policy check

Production inspection initially used webapp image commit `037b93963eee3cd289b09637f4a019752bcc84b5`, matching fetched main. The authenticated `tools/list` exposed **25 tools: 15 reads and ten writes**. The server identity at that point was `goodwatch`, version `1.0.0`; the requested listing name remains **GoodWatch**. Compatibility commit `b0b81294` subsequently reached main and supplies display title, description, website and the three PNG icons; live icon URLs were checked. The final authenticated initialize response also confirmed the new identity. Tool hints described below are unchanged by that commit. See [the compatibility record](mcp-compatibility-registry.md).

| Checklist item | Observed result / gap |
| --- | --- |
| Short tool names and titles | All 25 have nonempty top-level `title`, a description, and names at most 64 characters. Longest: `get_discover_filters` / `update_list_titles`, 20 / 18 characters respectively. |
| Read/write separation | Separate fixed-purpose tools; no freeform HTTP method/path executor. Reads use `readOnlyHint=true`, `destructiveHint=false`; writes use `readOnlyHint=false`. |
| Destructive write hints | `rate_title`, `set_want_to_see`, `set_not_interested`, `set_show_status`, `undo_watch`, `set_my_services`, `set_settings`, `update_list_titles` use `destructiveHint=true`. **Gap:** `log_watch` and `create_list` use `false`, reflecting additive operations. Anthropic's current checklist asks for `true` on modifying tools too. Raise this with the MCP thread/reviewer; this task does not silently relabel truthful hints. |
| Other hints | All expose `idempotentHint=true` and `openWorldHint=false`. Write requests use stable action IDs for retry receipts. Confirm these semantics with reviewers if questioned; hints are not authorization. |
| API documentation rule | Purpose-built tools use fixed GoodWatch operations, so the custom-query API-doc-link requirement is not applicable. |
| Tool descriptions / instructions | Shared descriptions prescribe title/provider links, matching scores, bullets, and a GoodWatch footer. They relate to presenting tool data; no hidden instructions, external instruction loader, or instruction to invoke unrelated tools was observed. The strong formatting/footer directives merit owner review against Anthropic's narrow-description and promotion rules. Do not certify policy acceptance in advance. |
| Errors and response size | Invalid inputs produced specific schema-validation messages. Queries are paged and title details can omit optional sections. Success of sampled calls is not coverage of every possible argument or failure mode. |
| OAuth and permissions | Canonical HTTPS resource metadata, CIMD and DCR, S256, account consent and refresh grant are present. Writes require the extra scope. Actual reviewer DCR + PKCE sign-in/consent/code exchange was exercised; no static account-wide credential is shared with members. |
| MCP App | `ui://goodwatch/posters-v3.html`, `text/html;profile=mcp-app`, tool UI metadata and resource CSP. Resource domains include TMDB images and GoodWatch; fetch destinations are empty. Resource loading is separate from actual Claude rendering. |
| Conversation-data minimization | The MCP request logger records method/tool names, client/protocol and UI support, not tool arguments/results or conversation history. Tools operate on submitted arguments and the authorized member. Owner still confirms operational logging/privacy outside this narrow code inspection. |
| Ownership and external resources | Endpoint is first-party `goodwatch.app`. Poster assets come from `image.tmdb.org`; catalog/provider links remain external resources. Owner must confirm licensing/permission for catalog content, images and screenshots, and applicable third-party privacy disclosures. Do not declare ownership of TMDB. |
| Restricted use cases | No money-transfer or AI-media-generation tools are exposed. Owner must confirm no sponsored content/paid placements are returned and accurately complete the data-handling acknowledgments. “Free listings” does not answer that separate policy question. |
| Eligibility / cost | A personal Pro or Max Claude account can submit. Free Claude accounts cannot. There is no paid promotion/proxy in this kit; do not purchase a plan/listing from this task. |

**Read tools:** `search_titles`, `discover_titles`, `get_discover_filters`, `get_title`, `get_similar_titles`, `get_my_shows`, `get_show_progress`, `get_tonight`, `get_library`, `get_taste`, `search_people`, `get_person`, `get_my_lists`, `get_list`, `get_settings`.

**Write tools:** `log_watch`, `rate_title`, `set_want_to_see`, `set_not_interested`, `set_show_status`, `undo_watch`, `set_my_services`, `set_settings`, `create_list`, `update_list_titles`.

The **Interactive** badge indicates embedded app capability; it is distinct from Community/Verified review. A `ui://` resource alone does not establish that the badge will be awarded. Supply real carousel images and demonstrate the app. See [interactive connectors](https://support.claude.com/en/articles/13454812-use-interactive-connectors-in-claude) and [connector verification](https://claude.com/docs/connectors/verification).

## Owner submission steps — current portal

Use the owner's personal paid Claude account, not an agent/service account. The following follows the current public portal instructions; the authenticated portal has not been opened or filled in this task. Exact live category choices and any unpublished icon-validation constraints remain an owner check.

Before submitting, resolve the annotation discrepancy, confirm rights/legal/contact answers, capture screenshots, and test **every exposed tool** in Claude and MCP Inspector. Backend HTTP checks below support this work but do not replace Anthropic's requested client checks. Do not tick the testing acknowledgment until it is true.

Open [the developer portal](https://claude.ai/directory/manage), select **Submit new → MCP connector**, and complete its ten steps:

1. **Connection:** enter the universal endpoint `https://goodwatch.app/mcp`, or select the already connected GoodWatch custom connector. Authenticate the sample account for review.
2. **Tools:** inspect the synced tools/resources; resolve warnings with the MCP thread. Ensure all 25 intended tools appear under read/write consent as appropriate.
3. **Listing:** paste the copy, docs/privacy/support values, icon and available categories. Check permanent `goodwatch` slug; attach the carousel images and paired prompts where requested.
4. **Use cases:** describe discovery, Wishlist/ratings, progress and sharing; state the free verified account prerequisite, optional handle for lists, and reads plus consented writes.
5. **Company:** enter truthful GoodWatch publisher details, website and the owner's review contact. Retain personal-account ownership.
6. **Authentication:** choose CIMD (`oauth_cimd`), with DCR as the implemented fallback if needed. Use ordinary individual OAuth, not Anthropic-held credentials, static headers or customer URLs.
7. **Data handling:** identify the GoodWatch API as first-party; disclose third-party catalog/poster resources and permission accurately. Answer health-data/sponsored-content questions truthfully.
8. **Test & launch:** provide the private account credentials and connection instructions above, the examples, and any still-relevant limitations. Confirm tool testing only after actually performing it.
9. **Compliance:** review all seven acknowledgments: directory policy, first-party APIs, financial transactions, AI media generation, prompt injection, conversation data, and public documentation. The owner accepts the terms.
10. **Review and submit:** inspect warnings, copy, ownership, permanent slug and attachments, then submit personally. No agent submission is authorized by this kit.

After submission, track status and feedback in the same portal. Community screening and any later Verified review are separate from the Interactive capability badge; no review deadline or approval is guaranteed. The current connector escalation contact is `mcp-review@anthropic.com`. Keep the sample account working throughout review; avoid resetting its password without updating the private portal credentials.

## Verification record

Production checks on 2026-10-17. The detailed synthetic-account responses and check results are retained root-only at `crate-01:/root/.config/goodwatch/directory-reviewer/verification.json` (0600), separate from the credential file; neither tokens nor passwords are in that receipt.

Checked:

- Better Auth sign-up → real verification email → verification API → password sign-in with `emailVerified=true`; root ownership and credential-file/directory modes checked independently.
- Authenticated app readback confirms **20 Wishlist entries, 30 ratings, three Severance episode watches**, DE/en/8,9,337, a handle and one unlisted five-title list. Read-only tool pagination returned 20 then 10 rated titles. `get_taste` reported 30 rated titles, 20 Wishlist titles and 30 liked titles with fingerprints (`signal=some`).
- Actual Streamable HTTP calls over a DCR/public-client S256 authorization-code grant with explicit read/write app consent: all **15 distinct read tools and ten distinct write tools** returned success. The write check used 12 calls to cover temporary status/Not interested changes and reversals. This is a direct HTTP protocol harness, not a claim that MCP Inspector or Claude.ai was exercised.
- Temporary fourth episode was logged then undone; On hold was returned to Watching; temporary Not interested was cleared. A temporary unlisted list was created, edited, then soft-deleted through the app route. The retained sample list is the original. Action receipts and the native soft-deleted test-list record remain normal internal audit data.
- `resources/list` and `resources/read` succeeded for the 22,809-character poster resource. Refresh succeeded and rotated the refresh token. Preparation grants were revoked and temporary member sessions were cleaned up after checks.
- All five screenshot backend scenarios succeeded with **6 / 6 / 6 / 5 / 6 cards**. Observed Wishlist top six: Dune: Part Two (82), It (82), Blade Runner 2049 (77), Dune (74), Spider-Man: Into the Spider-Verse (72), Alita: Battle Angel (68). Matches are GoodWatch percentages, not ratings. Similar-to-Arrival results included Contact, Swan Song, Ad Astra, A.I. Artificial Intelligence, After Yang and I Origins. Results and streaming offers can change.
- Early harness mistakes (`limit>20` on library; `kind` instead of discovery's `type`) returned specific validation errors; corrected calls passed. One later read encountered a transient transport failure; a fresh run passed. DCR was sent without member cookies, as an external client would send it; registration is not a member-administration operation.
- Public docs/privacy and three MCP icon URLs checked; missing routes recorded above. Listing copy length and Markdown/diff checks passed. No application test suite was run for this documentation-only change.

**Still requires the owner:** authenticated portal use; the Claude.ai and MCP Inspector every-tool checks; actual screenshot capture and appearance/links/interactions; client-managed refresh after more than five minutes; rights/legal/publisher declarations; final submission and review. Immediate refresh rotation in the protocol harness is not a five-minute client persistence test. No directory submission, paid listing, proxy, owner-account login, or MCP code change was performed by this task.
