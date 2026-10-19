# Checked organization, identity and cosmetics against pinned main

Audit/access date: **2026-10-19**. Goodwatch source pin: [`97eb3179844c4f68a70ccbd997bab4f2a735516d`](https://github.com/alp82/goodwatch-monorepo/tree/97eb3179844c4f68a70ccbd997bab4f2a735516d). This is a documentary source-code assessment, not deployment verification or a fresh competitor pricing survey. Source author/update dates are not inferred from this access date. Vendor requirements, platforms, limits and conflicts below are inherited explicitly from the cited opportunity records and four vendor dossiers; their primary links are retained beside each comparison. No accounts, purchases, production requests or entitlement tests were used.

**All 16 assigned feature groups and 79 contributing records are assessed.** Feature states: 8 Missing, 8 Partial. Record states: 55 Missing, 24 Partial. There are no generic Not checked/unknown replacements and no externally blocked record. Partial means the named concrete subset works in source or the capacity statement needs a narrower boundary; it never means a blanket parity claim.

The practical boundary is the object being compared. Goodwatch has a single movie/show Wishlist and derived status library, plus named share lists of exactly five titles. It does not thereby have arbitrary-length private custom collections. Remix, drag ordering, generated card designs, localized posters and batch Wishlist writes are real, scoped positives. They do not establish private catalog publication, app themes, profile uploads, category favorites or unlimited capacity. [E01] [E05] [E09] [E15] [E17]

## Method, instructions and snapshot changes

Instructions read at the pin: root AGENTS.md, CONTEXT.md, docs/agents issue-tracker/triage-labels/domain guidance, goodwatch-webapp/AGENTS.md, and ADR 0008/0009/0012. CONTEXT-MAP.md is absent at this pin. The research skill primary-source standard was applied directly; the task explicitly prohibits spawning another agent. Source inspection used a private /tmp archive and git show. Worktree HEAD was ed6fdefae78806255b047e7d9bd36addce14e339, so it was deliberately not used as current-main evidence.

The earlier Goodwatch audit used `b15b6cbe6f8dd8aa4fc861b5e7c8443c37d39768`. `git diff --name-only b15b6cbe6f8dd8aa4fc861b5e7c8443c37d39768 97eb3179844c4f68a70ccbd997bab4f2a735516d -- goodwatch-webapp/app CONTEXT.md docs/adr` identifies 17 changed app files, all in import adapters, matching/evidence resolution, import tests or recognition UI. The new TV Time path adds source parsing and identity resolution, not custom-list objects or profile/appearance controls. Existing movie/show Wishlist matching still resolves into title intentions; imported season/episode wishes are not custom-list entries. The list, library, tracking core, public-profile, preferences and card modules cited here are unchanged across these two pins, but were independently traced. The changes are not a reason to inherit an old generic label.

Changed-source inventory: `domain/imports.ts`, `domain/wishlist-match-copy.ts`, `server/imports/{episode-resolver-data.server,episode-resolver.server,files.server,import-db.test-support,preview.server,store.server,tvdb-lookup.server.test,tvdb-lookup.server,tvtime-catalog.server,tvtime-service.server.test,tvtime.server.test,tvtime.server,wishlist-evidence.server,wishlist-resolution.server}.ts`, and `ui/imports/ImportFileRecognition.ts`. [Pinned TV Time source type change](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/domain/imports.ts#L1-L100), [Wishlist resolution](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/imports/wishlist-resolution.server.ts#L69-L105).

Scoped absence was checked by following the consumer routes, validated inputs, writers, readers and visible controls described in the evidence ledger. Additional production-app source searches covered barcode/ISBN/owned-edition/scan-credit, profile/avatar/banner/achievement/supporter, app-icon/theme-preference/textless-poster, archive and collection-placement terms. The barcode hit is decorative card art; maintenance archive flags are account maintenance; auth/provider avatars appear in account chrome; genre badges are catalog metadata. Prototype routes, static SVGs and generic CRUD helpers were not accepted as connected capability proof.

## Capacity and access boundaries that apply across records

| Object | Actual inspected boundary | Consequence |
|---|---|---|
| Share-list items | Exactly 5 unique resolvable movie/show title keys; title max 80 characters | Missing general variable-length lists; neither regular-list nor total-library vendor capacity can be inferred. [E01] |
| Share-list count/read | No create-time count check; owner/public readers each LIMIT 200; MCP paginates the returned set. Account claim/deletion cache invalidation reads at most 1,000 IDs. | Do not market unlimited lists; these are distinct read/invalidation boundaries, not a published storage allowance. [E02] |
| Member Wishlist and tracking titles | Single-title keyed writer; no total/concurrent-title entitlement branch inspected. Wishlist/state/group readers have no explicit total-title SQL LIMIT; query helper returns one database response. | Concrete multi-title support, but no unbounded result/storage guarantee. No infinite-capacity load test required; assess Partial with this boundary. [E05] [E08] |
| Library visible cards |60 per step; next offsets, infinite-query consumer and Show more. Missing catalog cards omitted. |60 is a page size, not an account allowance; no fixed 25/50/100-title pay gate was found. [E06] |
| Watch next / My movies | Six sorts over returned Wishlist; cards 60/request; md 40/sm 30 initial display then expansion. | Rendering batches do not establish total capacity or impose a corresponding storage cap. [E07] |
| My shows / log history | Next-episode enrichment first 30 Continue/Pick-up rows by default; Start 30 and Pick up 5 initial expandable display. Log reads 200/movie and 20,000/show; show catalog episode query 100,000. | Do not promise every show gets an enriched next episode or unlimited occurrence history. Distinguish title count, history count and display detail. [E08] |
| MCP bulk operations | Up to 50 explicit title items/call; one batch/request;300 item writes/min and 2,000/hour;60 requests/min and 1,000/hour. OAuth/resource/tool gates. | Have only the narrowed batch operation. This is not web add-all-visible or a season/episode custom-list destination. [E09] [E23] |
| Guests | Browser-shared title interactions;20 distinct score limit; localStorage/memory fallback; no full tracked watchState. | Member capacity and cloud behavior do not transfer automatically to guests. Wishlist item allowance is not the score allowance. [E22] |
| Publication | Session-owned personal data; share-list public/unlisted only; public profile. | Unlisted links are readable by link. Cache-Control private/no-store does not restrict readers. [E11] |

## Sixteen-feature completeness checklist and display recommendation

| Checked feature ID | Records | State | Short user-facing summary |
|---|---:|---|---|
| [x] `list-capacity` | 3 | **Missing** | Share lists contain exactly five titles; general custom-list capacities are missing. |
| [x] `wishlist-capacity` | 2 | **Partial** | Wishlist writes and paged reads are present; unlimited end-to-end capacity is not verified. |
| [x] `clone-lists` | 4 | **Partial** | Remix copies own or others’ five-title lists; general list clone/update is missing. |
| [x] `organize-lists` | 4 | **Partial** | Wishlist sorting and five-title drag order work; pinning and collection placement are missing. |
| [x] `bulk-lists` | 3 | **Partial** | MCP supports batches of up to 50 title changes; web add-all and general-list bulk tools are missing. |
| [x] `tracked-capacity` | 8 | **Partial** | Movie/show tracking has no inspected account-count gate; reader/display bounds qualify capacity claims. |
| [x] `diary-tools` | 2 | **Missing** | Per-title watch logs exist; a filtered cross-title diary and watchlist archive are missing. |
| [x] `privacy` | 4 | **Missing** | Personal data is session-owned; profile privacy and private published catalogs are missing. |
| [x] `usernames` | 4 | **Partial** | Public handles can be claimed once with 3–30 characters; renaming and exact 1–24 allowance differ. |
| [x] `collection-search` | 3 | **Missing** | Catalog/library search exists; owned-collection saved filters, scans and reports are missing. |
| [x] `artwork` | 13 | **Partial** | Generated list cards and localized posters work; custom title, episode, person and owned-cover overrides are missing. |
| [x] `themes` | 14 | **Missing** | App theme, layout, icon-accent, widget and video-preference controls are missing. |
| [x] `icons` | 4 | **Missing** | Fixed PWA/icon assets exist; selectable alternate app icons are missing. |
| [x] `profile-style` | 7 | **Partial** | Profiles derive accents and artwork from the newest list; dedicated styling, uploads and pins are missing. |
| [x] `recognition` | 3 | **Missing** | Public profiles have no tier badges, achievements or supporter marker. |
| [x] `favorites` | 1 | **Missing** | Legacy title-favorite flags do not provide public categorized favorites. |

Group states are navigation summaries only. In particular, artwork/profile-style have narrow supported subsets while most individual records remain Missing. Never stamp a group’s Partial onto every vendor row. The machine handoff carries each record state separately.

## Record-by-record comparisons

The free → paid difference column preserves source wording/unknowns; absence of a disclosed vendor free number does not become zero. Nearby official URLs are the primary references already captured by the vendor research. The Goodwatch conclusion is new at the pin above.

### list-capacity — Missing

Share lists contain exactly five titles; general custom-list capacities are missing.

Proposed display splits: General variable-length lists: Missing; Five-title share-list creation: Have; Per-list item allowance and aggregate allowance: separate Missing comparisons.

| Record / competitor | Exact source free → paid difference | Goodwatch state and exact scoped conclusion | Evidence |
|---|---|---|---|
| OP-096 · SIMKL | Not applicable → PRO2000(current) vs1000(older comparison); VIP10000 [Official1](https://simkl.com/vip/), [Official2](https://docs.simkl.org/how-to-use-simkl/account-and-billing/subscription-plans/features-comparison) | **Missing**. Regular custom lists are a different domain from top 5 sharing; no list can reach the documented 2,000/10,000 item allowance. Supported: Named ordered five-title share lists. Missing: Variable-length regular lists and their per-list capacity. Boundary: SIMKL live 2,000 vs older 1,000 PRO conflict preserved; Goodwatch exactly 5, not a competing aggregate allowance. | [E01] [E02] |
| OP-097 · SIMKL | Not applicable → PRO60000/VIP500000 [Official1](https://simkl.com/vip/), [Official2](https://docs.simkl.org/how-to-use-simkl/account-and-billing/subscription-plans/features-comparison) | **Missing**. No regular-list aggregate item domain or enforced/account-visible allowance corresponds to 60,000/500,000. Supported: Multiple five-title share lists can be created. Missing: Aggregate regular-list item capacity. Boundary: Owner/public list readers stop 200; at most 1,000 item slots represented by those 200 full lists is derived display arithmetic, not storage entitlement. | [E01] [E02] |
| OP-499 · MDBList / Reeel | Free: 10000. → Basic: 30000; Standard: 40000; Plus: 50000; VIP5: 70000; VIP10: 100000; VIP15: 150000; VIP20: 150000. Separate object-specific caps; no aggregate conflation. [Official1](https://docs.mdblist.com/docs/supporter), [Official2](https://mdblist.memberful.com/join?splash=1), [Official3](https://docs.mdblist.com/docs/api) | **Missing**. MDBList automated/general lists and 10,000–150,000 per-list allowances have no equivalent arbitrary-list model. Supported: Five-title sharing and separate Wishlist. Missing: General/generated lists with vendor per-list capacities. Boundary: Free 10,000; Basic 30,000; Standard 40,000; Plus 50,000; VIP 5 70,000; VIP 10 100,000; VIP 15/20 150,000; none should be compared with total Wishlist size. | [E01] [E05] |


### wishlist-capacity — Partial

Wishlist writes and paged reads are present; unlimited end-to-end capacity is not verified.

Proposed display splits: Member movie/show Wishlist add/remove and continuation: Have; Unlimited allowance promise: Partial with reader/storage qualifier.

| Record / competitor | Exact source free → paid difference | Goodwatch state and exact scoped conclusion | Evidence |
|---|---|---|---|
| OP-390 · StreamGuide (Christian Krueger) | Free watchlist; item cap unknown. → Premium explicitly unlimited watchlist; separate-list count unknown. [Official1](https://streamguide.app/faq), [Official2](https://streamguide.app/resources/getting-started-with-streamguide) | **Partial**. Wishlist add/remove and paged reading are connected; code has no title-count paywall, but does not establish an unlimited service guarantee. Supported: Movie/show Wishlist, 60-item library pages with continuation; Watch next progressive cards. Missing: Explicitly verified unlimited end-to-end item allowance. Boundary: Member data query has no explicit LIMIT but returns one DB response; backend result-size/storage behavior not established. Guest 20-score ceiling is distinct from Wishlist item count; no free competitor cap invented. | [E05] [E06] [E07] [E22] |
| OP-618 · Flickz | Free cap unknown. → Premium explicitly unlimited. [Official1](https://flickz.app/) | **Partial**. Wishlist add/remove and paged reading are connected; code has no title-count paywall, but does not establish an unlimited service guarantee. Supported: Movie/show Wishlist, 60-item library pages with continuation; Watch next progressive cards. Missing: Explicitly verified unlimited end-to-end item allowance. Boundary: Member data query has no explicit LIMIT but returns one DB response; backend result-size/storage behavior not established. Guest 20-score ceiling is distinct from Wishlist item count; no free competitor cap invented. | [E05] [E06] [E07] [E22] |


### clone-lists — Partial

Remix copies own or others’ five-title lists; general list clone/update is missing.

Proposed display splits: Remix a five-title share list: Have; Clone arbitrary-length lists: Missing; Keep clone updated from source: Missing.

| Record / competitor | Exact source free → paid difference | Goodwatch state and exact scoped conclusion | Evidence |
|---|---|---|---|
| OP-040 · Letterboxd | Own ordinary editing → Clone own/others lists [Official1](https://letterboxd.com/about/pro/) | **Partial**. Remix independently copies own or another accessible top 5 list; general arbitrary-length list cloning is absent. Supported: Copy source title/prompt/entries/design/theme into a new five-title share list. Missing: General variable-length list cloning. Boundary: Publication requires account and permanent handle; source must still resolve. Source unlisted link is accessible, not private authorization. Visible Remix button is for others; own-source copying works through the loader query, without a dedicated own-copy button. | [E01] [E03] |
| OP-520 · MDBList / Reeel | No free/Basic allocation. → Standard and above. [Official1](https://docs.mdblist.com/docs/supporter), [Official2](https://mdblist.com/new-features/) | **Partial**. Remix provides a one-time five-title copy; updating an owned copy is ordinary editing, not MDBList source clone/update parity. Supported: One-time Remix and independent five-title editor. Missing: General/generated list clone plus source-driven update/refresh. Boundary: No linked refresh/synchronization operation; Standard+ vendor entitlement, Free/Basic none in supplied evidence. | [E01] [E03] [E04] |
| OP-548 · Bingebase | Own-list duplication free. → PRO copying others’ lists. [Official1](https://bingebase.com/pro), [Official2](https://bingebase.com/roadmap/shipped) | **Partial**. Remix independently copies own or another accessible top 5 list; general arbitrary-length list cloning is absent. Supported: Copy source title/prompt/entries/design/theme into a new five-title share list. Missing: General variable-length list cloning. Boundary: Publication requires account and permanent handle; source must still resolve. Source unlisted link is accessible, not private authorization. Visible Remix button is for others; own-source copying works through the loader query, without a dedicated own-copy button. | [E01] [E03] |
| OP-587 · WerStreamt.es | Ordinary lists. → Pro cloning. [Official1](https://www.werstreamt.es/pro/), [Official2](https://www.werstreamt.es/) | **Partial**. Remix independently copies own or another accessible top 5 list; general arbitrary-length list cloning is absent. Supported: Copy source title/prompt/entries/design/theme into a new five-title share list. Missing: General variable-length list cloning. Boundary: Publication requires account and permanent handle; source must still resolve. Source unlisted link is accessible, not private authorization. Visible Remix button is for others; own-source copying works through the loader query, without a dedicated own-copy button. | [E01] [E03] |


### organize-lists — Partial

Wishlist sorting and five-title drag order work; pinning and collection placement are missing.

Proposed display splits: Choose six Wishlist orders: Have; Drag five title ranks: Have; Pin lists/items: Missing; Reposition collections or profile lists: Missing.

| Record / competitor | Exact source free → paid difference | Goodwatch state and exact scoped conclusion | Evidence |
|---|---|---|---|
| OP-045 · Ryot | Ordinary collections → Custom placement/personalization [Official1](https://ryot.io/features/) | **Missing**. Share-list rank changes positions of titles within one five-title list; it does not customize collection placement. Supported: Five-title rank order. Missing: User-defined placement/personalization of collections. Boundary: Library statuses and profile list order are fixed/computed; no placement field in list/profile writer. | [E01] [E02] [E04] |
| OP-047 · Sofa | Unlimited ordinary lists/groups → Pinned lists/items [Official1](https://www.sofahq.com/pricing) | **Missing**. Owner list controls and stored model expose no list/item pin; rank 1 is not a persistent pin. Supported: Top 5 title drag order. Missing: Pinned lists and pinned items. Boundary: No pin field or pin/unpin action in inspected editor/owner API. | [E01] [E04] |
| OP-077 · Hobi | Ordinary ordering → Advanced sorting [Official1](https://hobiapp.com/help/what-hobi-premium-includes) | **Partial**. Six concrete Wishlist sorts are present; vendor advanced-sort set is unspecified, so full same-controls parity cannot be asserted. Supported: Best match, Waiting longest, Last added, Newest, Top rated, Popular; library status-specific title/date/score sorts. Missing: Any additional Hobi advanced comparator/control beyond the enumerated Goodwatch sorts. Boundary: Best match depends on taste; fallback/availability rules apply. Narrow assessed variant: choose one of six documented Wishlist orders = Have. | [E06] [E07] |
| OP-583 · WerStreamt.es | Ordinary lists. → Pro ordering/pinning. [Official1](https://www.werstreamt.es/pro/), [Official2](https://www.werstreamt.es/) | **Partial**. Manual order exists inside a five-title list, while ordering lists themselves and pinning are absent. Supported: Drag and persist five title ranks. Missing: General list/item ordering beyond top 5, list pinning. Boundary: Profile lists use newest-first; owner list reader updated-first. Neither is user placement. | [E01] [E02] [E04] |


### bulk-lists — Partial

MCP supports batches of up to 50 title changes; web add-all and general-list bulk tools are missing.

Proposed display splits: MCP explicit-title Wishlist batch add/remove: Have, gated; Web add all currently visible films: Missing; Season/episode custom-list entries: Missing.

| Record / competitor | Exact source free → paid difference | Goodwatch state and exact scoped conclusion | Evidence |
|---|---|---|---|
| OP-042 · Letterboxd | Normal editing → Web add-all to list/Watchlist [Official1](https://letterboxd.com/about/pro-apps/) | **Partial**. MCP can batch explicit Wishlist titles, but the web cannot add all films currently visible to arbitrary list or Watchlist. Supported: MCP add up to 50 explicit movie/show Wishlist selectors per call. Missing: Web add-all-visible selection and general-list destination. Boundary: Authenticated configured MCP with write scope/tool policy;50/call,300 item-writes/min,2,000/hour; one batch/request. | [E01] [E09] [E23] |
| OP-043 · SIMKL | Ordinary editing → Bulk deletion [Official1](https://docs.simkl.org/how-to-use-simkl/account-and-billing/subscription-plans/pro) | **Partial**. Batch removal is implemented for explicit Wishlist titles; no bulk deletion of arbitrary custom-list entries or multi-select web workflow. Supported: MCP Wishlist remove up to 50 titles per call. Missing: General-list item bulk deletion and web selection controls. Boundary: Per-movie removeAll removes watches of one movie, not a generic multi-title list operation; same MCP budgets. | [E01] [E09] [E23] |
| OP-062 · Trakt | Personal/community lists → October season/episode entries and batch add [Official1](https://roadmap.trakt.tv/changelog/rocket-trakt-product-update-october-2026) | **Partial**. MCP batches title additions and marks episode ranges/seasons as watched; episodes/seasons cannot be stored as custom-list entries. Supported: Batch title Wishlist additions; independent season/episode tracking actions. Missing: Season/episode list-entry identities and bulk additions to arbitrary personal/community lists. Boundary: Share-list parser movie/show only, exactly 5. Watch-log episode identity is not list-entry support. | [E01] [E09] |


### tracked-capacity — Partial

Movie/show tracking has no inspected account-count gate; reader/display bounds qualify capacity claims.

Proposed display splits: Member multi-title tracking with paged library: Have; Unlimited title/history/view allowance: Partial; My shows next-episode enrichment: first 30, not all returned shows; Sofa other-media modes and EpisodeCalendar archive policy: Missing.

| Record / competitor | Exact source free → paid difference | Goodwatch state and exact scoped conclusion | Evidence |
|---|---|---|---|
| OP-069 · Sofa | 2 concurrent; lists unlimited → Unlimited concurrent tracking advertised [Official1](https://www.sofahq.com/pricing) | **Partial**. Concurrent tracking of multiple movie/show titles exists without a two-title gate; Sofa also tracks other media and its unlimited claim is broader. Supported: Independent title watch states/logs, member library and next-episode groups. Missing: Verified unbounded concurrent tracking and Sofa non-film/TV object modes. Boundary: No total-title guard in inspected writer. First 30 next-episode enrichment; history 200/movie and 20,000/show, not concurrent title caps. | [E05] [E06] [E08] [E22] |
| OP-070 · Hobi | Free cap exists; number unknown → Unlimited movies advertised [Official1](https://hobiapp.com/help/track-movies) | **Partial**. Movie watch/score/Wishlist writes do not impose a visible free movie quota; unlimited end-to-end movie capacity is not proven. Supported: Independent movie tracking and paged library. Missing: Verified unlimited movie allowance. Boundary: Hobi free number unknown; do not invent it or equate per-movie 200 log-read rows with number of tracked movies. | [E05] [E06] [E08] [E22] |
| OP-071 · Next Episode | 50 shows at once; Watchlist total uncapped → Removes view bound [Official1](https://forum.next-episode.net/viewtopic.php?pid=190046) | **Partial**. Goodwatch can show all returned tracked-show groups with expandable sections, but this is not an uncapped full Episodes screen. Supported: My shows groups, full status library and per-show episode matrix. Missing: Full multi-show episode-detail display equivalent to removing Next Episode 50-show Episodes-screen bound. Boundary: Next Episode total Watchlist is already uncapped. Goodwatch next-episode enrichment first 30 Continue/Pick-up; Start 30 and Pick up 5 initial display, expandable. | [E06] [E08] |
| OP-072 · Next Episode | 25 movies → Removes My Movies bound [Official1](https://forum.next-episode.net/viewtopic.php?pid=190046) | **Partial**. My movies is a progressive Wishlist-movie view without a 25-title branch; uncapped My Movies allowance is not established. Supported: Movie Wishlist plan, card batches 60, paged Want-to-see movie library. Missing: Verified unbounded movie view/service capacity. Boundary: No 25 gate; per-request 60 is not total capacity. Titles missing catalog data may not render; all-returned-data qualifier applies. | [E05] [E06] [E07] |
| OP-456 · Television Time | New free users5 shows; grandfathered previous features retained. → Plus explicitly unlimited shows; other caps unknown. [Official1](https://apps.apple.com/us/app/television-time/id969714962), [Official2](https://televisiontime.app/changelog/) | **Partial**. No five-show member entitlement guard; per-show tracking and library exist, but unlimited service capacity is not established. Supported: Independent movie/show states, show groups and 60-item library pages. Missing: Verified unlimited tracked-show allowance. Boundary: Vendor grandfathering does not describe Goodwatch. No local paid/grandfathered 5-show split; history and enrichment bounds retained. | [E05] [E06] [E08] |
| OP-464 · Movie Tracker — Simone Montalto | Free5 titles. → Pro unlimited items. [Official1](https://apps.apple.com/us/app/id6443877426) | **Partial**. No five-title member entitlement guard; tracking spans catalog movies/shows, without verified unlimited capacity. Supported: Independent titles and paged library. Missing: Verified unlimited item allowance. Boundary: Guest scores 20; member title counts distinct from movie 200/show 20,000 per-title log-reader bounds. | [E05] [E06] [E08] [E22] |
| OP-485 · TV Episode Calendar / EpisodeCalendar | 20 Active/Ended/Watch Later shows; archive excluded; existing users retain prior shows. → Premium unlimited shows. [Official1](https://episodecalendar.com/en/pages/features), [Official2](https://episodecalendar.com/en/pages/premium) | **Partial**. Goodwatch tracks many independent shows without a 20-show check; archive-excluded counting cannot match because no archive state exists. Supported: Show states, Want to see and expandable library. Missing: Verified unlimited shows and archive-excluded allowance semantics. Boundary: EpisodeCalendar 20 Active/Ended/Watch Later excludes Archived and has grandfathering; Goodwatch On hold/Dropped are not Archive. | [E05] [E06] [E08] [E10] |
| OP-748 · WatchNext.app | Free50 shows+50 movies. → Premium100+100; Unlimited uncapped tracking. Homepage calls unlimited Premium; FAQ/terms distinguish tiers. [Official1](https://watchnext.app/faq), [Official2](https://watchnext.app/terms) | **Partial**. Movie/show keys and type filters exist, with no 50/100 per-kind gate. No explicit per-kind allowance guarantee or unbounded-capacity proof. Supported: Separate movie/show library filters/counts and multi-title tracking. Missing: Verified end-to-end ability/allowance for the documented 100+100 boundary and an unlimited-tier equivalent; no claim that Goodwatch should impose those vendor paid caps. Boundary: Counts derived from returned maps; WatchNext Free 50+50/Premium 100+100/Unlimited unbounded. Homepage Premium wording conflicts with FAQ/terms; retain conflict. | [E05] [E06] [E08] |


### diary-tools — Missing

Per-title watch logs exist; a filtered cross-title diary and watchlist archive are missing.

Proposed display splits: Per-title dated movie watch history/editing: Have; Global advanced diary filters: Missing; Separate watchlist archive: Missing.

| Record / competitor | Exact source free → paid difference | Goodwatch state and exact scoped conclusion | Evidence |
|---|---|---|---|
| OP-074 · Sofa | Logbook/date editing free → Advanced filters [Official1](https://www.sofahq.com/pricing) | **Missing**. Editable per-title logs and last-watched title sorting are present; no global chronological logbook/filter surface. Supported: Per-title watch/date edit/delete and status/title library filters. Missing: Cross-title chronological logbook with advanced occurrence filters. Boundary: Library deliberately does not read log;200 movie log read limit not a global diary allowance. | [E06] [E10] |
| OP-076 · Hobi | Ordinary watchlist → Archive [Official1](https://hobiapp.com/help/what-hobi-premium-includes) | **Missing**. Library On hold/Dropped provide show-state selection but no separate watchlist archive action or preserved archive membership. Supported: On hold/Dropped states and hidden-title controls for different jobs. Missing: Watchlist Archive domain, action and view. Boundary: Not interested is filtering/exclusion, not Archive; account maintenance archival flags are unrelated. | [E06] [E10] |


### privacy — Missing

Personal data is session-owned; profile privacy and private published catalogs are missing.

Proposed display splits: Session-owned personal records: Have; Public/unlisted share links: Have; Private restricted-reader published list/catalog: Missing; Hide profile/social fields/favorites visibility: Missing.

| Record / competitor | Exact source free → paid difference | Goodwatch state and exact scoped conclusion | Evidence |
|---|---|---|---|
| OP-038 · SIMKL | Public profile/favorites → Public/unlisted/private [Official1](https://docs.simkl.org/how-to-use-simkl/account-and-billing/subscription-plans/pro) | **Missing**. Private session-owned personal data and unlisted top 5 links do not implement this vendor publication/privacy control. Supported: Session ownership for personal records; public/unlisted share-list links.  Missing: Profile/favorites public–unlisted–private controls. Boundary: Unlisted URLs still render for anyone with link; private,no-store is cache policy. Public handle/profile has no hide switch; absent social fields are not hide controls. | [E11] [E12] [E14] |
| OP-039 · MyShows | Ordinary public presentation → Hide profile/social links/awards/friend list [Official1](https://en.myshows.me/about/pro/) | **Missing**. Private session-owned personal data and unlisted top 5 links do not implement this vendor publication/privacy control. Supported: Session ownership for personal records; public/unlisted share-list links.  Missing: Hide profile/social links/awards/friend-list controls. Boundary: Unlisted URLs still render for anyone with link; private,no-store is cache policy. Public handle/profile has no hide switch; absent social fields are not hide controls. | [E11] [E12] [E14] |
| OP-642 · iCollect Movies / iCollect Everything | Cloud sync is not a private-web switch. → Pro private-web visibility control. [Official1](https://www.icollecteverything.com/2024/10/26/heres-the-price-differences-and-breakdown-of-our-product-offerings/), [Official2](https://www.icollecteverything.com/support/) | **Missing**. Private session-owned personal data and unlisted top 5 links do not implement this vendor publication/privacy control. Supported: Session ownership for personal records; public/unlisted share-list links.  Missing: Owned catalog private-web publication switch. Boundary: Unlisted URLs still render for anyone with link; private,no-store is cache policy. Public handle/profile has no hide switch; absent social fields are not hide controls. | [E11] [E12] [E14] |
| OP-653 · Libib | Basic media catalog. → Pro private/interactive publication. [Official1](https://www.libib.com/pricing), [Official2](https://support.libib.com/faqs.html), [Official3](https://support.libib.com/rest-api/introduction.html) | **Missing**. Private session-owned personal data and unlisted top 5 links do not implement this vendor publication/privacy control. Supported: Session ownership for personal records; public/unlisted share-list links.  Missing: Private and interactive published owned catalog. Boundary: Unlisted URLs still render for anyone with link; private,no-store is cache policy. Public handle/profile has no hide switch; absent social fields are not hide controls. | [E11] [E12] [E14] |


### usernames — Partial

Public handles can be claimed once with 3–30 characters; renaming and exact 1–24 allowance differ.

Proposed display splits: Initial valid public-handle claim: Have; Username change: Missing; iCollect 1–24 exact validation range: Partial.

| Record / competitor | Exact source free → paid difference | Goodwatch state and exact scoped conclusion | Evidence |
|---|---|---|---|
| OP-180 · Letterboxd | Free cadence unknown → Web30 days/app help90 days [Official1](https://letterboxd.com/about/pro/), [Official2](https://letterboxd.com/about/pro-apps/) | **Missing**. The connected UI explicitly says permanent; the writer rejects attempts to rename an existing handle. Supported: Initial public-handle claim. Missing: Public username change. Boundary: Letterboxd 30-day web vs 90-day app wording preserved for OP-180; Goodwatch has no cooldown because rename is refused. | [E12] [E13] |
| OP-233 · MyShows | Ordinary profile → Change username [Official1](https://en.myshows.me/about/pro/) | **Missing**. The connected UI explicitly says permanent; the writer rejects attempts to rename an existing handle. Supported: Initial public-handle claim. Missing: Public username change. Boundary: Letterboxd 30-day web vs 90-day app wording preserved for OP-180; Goodwatch has no cooldown because rename is refused. | [E12] [E13] |
| OP-573 · Flickchart | Baseline identity. → FAQ names VIP username change. [Official1](https://www.flickchart.com/vip), [Official2](https://www.flickchart.com/faq) | **Missing**. The connected UI explicitly says permanent; the writer rejects attempts to rename an existing handle. Supported: Initial public-handle claim. Missing: Public username change. Boundary: Letterboxd 30-day web vs 90-day app wording preserved for OP-180; Goodwatch has no cooldown because rename is refused. | [E12] [E13] |
| OP-641 · iCollect Movies / iCollect Everything | Baseline identity. → Pro1–24character public username. [Official1](https://www.icollecteverything.com/2024/10/26/heres-the-price-differences-and-breakdown-of-our-product-offerings/), [Official2](https://www.icollecteverything.com/support/) | **Partial**. Initial public-handle claim is connected, but valid strings and length differ from iCollect 1–24. Supported: Eligible lowercase public handles 3–24 characters within Goodwatch 3–30 rules. Missing: 1–2-character usernames and exact iCollect validation/rename semantics. Boundary: Letter-first alnum/underscore and reserved-name exclusions; permanent claim, no paid guard. Do not label every 1–24 username supported. | [E12] [E13] |


### collection-search — Missing

Catalog/library search exists; owned-collection saved filters, scans and reports are missing.

Proposed display splits: Catalog/library title search: Have; Saved owned-collection filters: Missing; Cross-owned-collection reports/search: Missing; AI media scanning and scan credits: Missing.

| Record / competitor | Exact source free → paid difference | Goodwatch state and exact scoped conclusion | Evidence |
|---|---|---|---|
| OP-637 · iCollect Movies / iCollect Everything | Baseline search/filter. → Pro saved filters. [Official1](https://www.icollecteverything.com/2024/10/26/heres-the-price-differences-and-breakdown-of-our-product-offerings/), [Official2](https://www.icollecteverything.com/support/) | **Missing**. URL filters over catalog title status/type/query cannot save an owned-collection filter object. Supported: Ephemeral/reloadable library query/sort/type URLs. Missing: Named saved owned-collection filters. Boundary: Library q at most 100 chars; no saved-filter storage/list/manage API in inspected collection/library domain. | [E06] [E14] |
| OP-645 · iCollect Movies / iCollect Everything | 15free credits; replenishment unspecified. → Pro100included; extra50/250/500credit packs separately purchased, prices unknown. [Official1](https://www.icollecteverything.com/2024/10/26/heres-the-price-differences-and-breakdown-of-our-product-offerings/), [Official2](https://www.icollecteverything.com/support/) | **Missing**. Catalog descriptive search/import matching is not scanning a media item/photo; no scanning workflow or credit ledger. Supported: Catalog title lookup and structured file imports are separate jobs. Missing: AI collection scan input and metered credits/packs. Boundary: Vendor 15 free/100 Pro and 50/250/500 packs; replenishment unspecified. These are scan credits, not recommendation/search requests. | [E14] |
| OP-652 · Libib | Basic collection tools/stats. → Pro cross-collection search/reports. [Official1](https://www.libib.com/pricing), [Official2](https://support.libib.com/faqs.html), [Official3](https://support.libib.com/rest-api/introduction.html) | **Missing**. Catalog franchise lookup and status/type title search are not search/reporting across user-owned collections. Supported: Catalog collections and title library search. Missing: Cross-owned-collection search/reports. Boundary: No owned edition/collection model, report parameters or result domain in inspected consumer paths. | [E06] [E14] |


### artwork — Partial

Generated list cards and localized posters work; custom title, episode, person and owned-cover overrides are missing.

Proposed display splits: Generated top 5 card design/color: Have; Language-selected catalog poster: Have; Independent poster text preference: Missing; Uploaded/selected title/backdrop/person/episode/owned-cover artwork: Missing.

| Record / competitor | Exact source free → paid difference | Goodwatch state and exact scoped conclusion | Evidence |
|---|---|---|---|
| OP-173 · Letterboxd | Default; Pro no custom entitlement → Poster per title/profile/favorites/diary/review/list [Official1](https://letterboxd.com/about/pro/) | **Missing**. The inspected title/list/profile inputs consume catalog images and contain no user artwork override or upload path for this object. Supported: Catalog artwork; localized poster selection is separately supported.  Missing: User-selected title posters across title/profile/favorites/diary/review/list contexts. Boundary: Catalog/localized posters are automatic; no per-viewer title image override or profile/diary/review/list poster selector is stored. | [E01] [E14] [E16] [E17] |
| OP-174 · Letterboxd | Default → Backdrop choices [Official1](https://letterboxd.com/about/pro/) | **Missing**. The inspected title/list/profile inputs consume catalog images and contain no user artwork override or upload path for this object. Supported: Catalog artwork; localized poster selection is separately supported.  Missing: User-selected backdrops. Boundary: Hero backdrop reads catalog backdrop_path; no preferred backdrop image ID/path in user or list inputs. | [E01] [E14] [E16] [E17] |
| OP-175 · Letterboxd | Default → Preferred person image [Official1](https://letterboxd.com/about/pro-apps/) | **Missing**. The person query supplies one catalog portrait to the connected Portrait renderer; no member preferred-image selection is stored or offered. Supported: Catalog artwork; localized poster selection is separately supported.  Missing: Preferred cast/crew portrait. Boundary: Person portrait reads person.profile_path, with an initial fallback; no preferred-person-image writer. | [E01] [E14] [E16] [E17] |
| OP-176 · BingeBoxd | Default → Choose episode image [Official1](https://apps.apple.com/us/app/id6749491360) | **Missing**. The episode reader supplies its canonical catalog still and the connected episode panel renders/reveals it; no replacement-image choice is stored or offered. Supported: Catalog artwork; localized poster selection is separately supported.  Missing: Chosen episode image. Boundary: EpisodeList renders the catalog still supplied by show tracking. Reveal spoiler image shows that still; it does not choose a replacement. | [E01] [E14] [E16] [E17] |
| OP-177 · Showly | Default → Custom artwork [Official1](https://github.com/trakt/showly/blob/master/ui-premium/src/main/res/values/strings.xml), [Official2](https://github.com/trakt/showly/blob/e08cb90ba0205ed9401a11265b912b0302f253b5/ui-premium/src/main/res/values/strings.xml) | **Missing**. The inspected title/list/profile inputs consume catalog images and contain no user artwork override or upload path for this object. Supported: Catalog artwork; localized poster selection is separately supported.  Missing: Gallery/URL posters and fanart. Boundary: List and user inputs have no gallery file or external artwork URL. Language-localized posters do not provide arbitrary gallery/URL fanart. | [E01] [E14] [E16] [E17] |
| OP-178 · Sofa | Ordinary lists → Custom covers/layouts [Official1](https://www.sofahq.com/pricing) | **Partial**. Custom presentation exists for a five-title share card, not a user-uploaded cover or general Sofa list layout. Supported: Choose 15 card designs and 7 colors; public list tiles use selected design. Missing: Arbitrary list cover upload/selection and layouts for variable-length/private collections. Boundary: Narrow Have: choose generated top 5 card design/color. Covers use catalog artwork; no custom image URL stored. | [E01] [E15] [E16] |
| OP-179 · SIMKL | Ordinary public favorites → Background customization [Official1](https://docs.simkl.org/how-to-use-simkl/account-and-billing/subscription-plans/pro) | **Missing**. Public favorites background customization has no destination: profile renders share lists and a derived catalog backdrop, without a public favorites view. Supported: Catalog artwork; localized poster selection is separately supported.  Missing: Public favorites background customization. Boundary: Public profile has share lists, not a favorites-background configuration or categorized favorites renderer. | [E01] [E14] [E16] [E17] |
| OP-235 · Suite TV | Functional core free → Custom posters [Official1](https://www.suitetv.app/en/about) | **Missing**. The inspected title/list/profile inputs consume catalog images and contain no user artwork override or upload path for this object. Supported: Catalog artwork; localized poster selection is separately supported.  Missing: Custom title poster override. Boundary: Suite TV custom title poster requires a selected override; Goodwatch supplies catalog/localized poster without an override field. | [E01] [E14] [E16] [E17] |
| OP-240 · CLZ Movies | Trial; no permanent free editable tier → Front/back covers [Official1](https://clz.com/movies/mobile), [Official2](https://clz.com/movies/web), [Official3](https://club.clz.com/t/feature-request-add-links-to-export-options/1662) | **Missing**. The inspected title/list/profile inputs consume catalog images and contain no user artwork override or upload path for this object. Supported: Catalog artwork; localized poster selection is separately supported.  Missing: Owned item front/back cover images. Boundary: No owned edition, front-cover/back-cover pair or upload storage exists in the inspected movie/show title library. | [E01] [E14] [E16] [E17] |
| OP-546 · Bingebase | Free own-view poster swaps; not public list artwork. → PRO backdrops. [Official1](https://bingebase.com/pro), [Official2](https://bingebase.com/roadmap/shipped) | **Missing**. The inspected title/list/profile inputs consume catalog images and contain no user artwork override or upload path for this object. Supported: Catalog artwork; localized poster selection is separately supported.  Missing: Custom backdrop override. Boundary: Catalog backdrop and derived profile backdrop are automatic, without a user-selected backdrop override. | [E01] [E14] [E16] [E17] |
| OP-547 · Bingebase | Own-view poster swaps free. → PRO publicly visible list artwork. [Official1](https://bingebase.com/pro), [Official2](https://bingebase.com/roadmap/shipped) | **Partial**. A public five-title list has a customizable generated image/design; this differs from public per-title poster/backdrop overrides. Supported: Public share-list card design/color seen by viewers. Missing: Public custom source artwork for list items and arbitrary list artwork override. Boundary: Bingebase own-view poster swap is free; public artwork is PRO. Do not use Goodwatch localized posters to claim shared override parity. | [E01] [E15] [E16] |
| OP-567 · Flickchart | Baseline posters. → VIP preferences. [Official1](https://www.flickchart.com/vip), [Official2](https://www.flickchart.com/faq) | **Partial**. Language-selected catalog posters exist through Show titles in; no independent with-text/textless preference. Supported: Localized poster language via saved/browser media-language preference. Missing: Independent poster text preference and per-user preferred artwork choice. Boundary: Fallback canonical poster when suitable translation absent; source wording language/text combines two jobs. Narrow poster-language preference = Have. | [E16] [E17] |
| OP-634 · iCollect Movies / iCollect Everything | Baseline image allowance unspecified. → Pro up to10images/item; images not exportable. [Official1](https://www.icollecteverything.com/2024/10/26/heres-the-price-differences-and-breakdown-of-our-product-offerings/), [Official2](https://www.icollecteverything.com/support/) | **Missing**. The inspected title/list/profile inputs consume catalog images and contain no user artwork override or upload path for this object. Supported: Catalog artwork; localized poster selection is separately supported.  Missing: Up to 10 stored user images per collection item. Boundary: No per-item image collection exists. Vendor Pro allows up to 10 images/item and says images are not exportable; that limitation is retained, not mapped to Goodwatch catalog-image URLs. | [E01] [E14] [E16] [E17] |


### themes — Missing

App theme, layout, icon-accent, widget and video-preference controls are missing.

Proposed display splits: Share-card color themes: Have in separate scope; Selectable app light/dark/AMOLED/theme: Missing; Detail section reorder/library layout/widget tint/video controls: Missing.

| Record / competitor | Exact source free → paid difference | Goodwatch state and exact scoped conclusion | Evidence |
|---|---|---|---|
| OP-184 · MyAnimeList | Default → Custom colors [Official1](https://myanimelist.net/membership) | **Missing**. No corresponding app/profile/widget/detail/video appearance preference is connected in the inspected settings/rendering domain. Supported: Fixed site styling and separate selectable share-card designs/colors.  Missing: MAL profile-list status-bar color choices. Boundary: Profile has no MAL-style favorite/status list bars or status-bar color setting; shared-list accent is a different presentation object. | [E15] [E18] [E19] |
| OP-186 · Sofa | Default → 100+ themes [Official1](https://www.sofahq.com/pricing) | **Missing**. No corresponding app/profile/widget/detail/video appearance preference is connected in the inspected settings/rendering domain. Supported: Fixed site styling and separate selectable share-card designs/colors.  Missing: 100+ app themes. Boundary: Seven share-card colors are not 100+ app themes; there is no app theme chooser in validated settings. | [E15] [E18] [E19] |
| OP-189 · Showly; Next Episode | Base theme → Showly light; Next Episode dark [Official1](https://play.google.com/store/apps/details?hl=en&id=com.michaldrabik.showly2), [Official2](https://next-episode.net/premium), [Official3](https://github.com/trakt/showly/blob/e08cb90ba0205ed9401a11265b912b0302f253b5/ui-premium/src/main/res/values/strings.xml) | **Missing**. No corresponding app/profile/widget/detail/video appearance preference is connected in the inspected settings/rendering domain. Supported: Fixed site styling and separate selectable share-card designs/colors.  Missing: Showly light and Next Episode dark user-selectable modes. Boundary: Showly light and Next Episode dark require selectable controls. A fixed dark site does not fulfill either mode-switch entitlement. | [E15] [E18] [E19] |
| OP-190 · Showly | Ordinary collection → Compact/grid source strings [Official1](https://github.com/trakt/showly/blob/master/ui-premium/src/main/res/values/strings.xml), [Official2](https://github.com/trakt/showly/blob/e08cb90ba0205ed9401a11265b912b0302f253b5/ui-premium/src/main/res/values/strings.xml) | **Missing**. No corresponding app/profile/widget/detail/video appearance preference is connected in the inspected settings/rendering domain. Supported: Fixed site styling and separate selectable share-card designs/colors.  Missing: Showly compact/grid collection layout choice. Boundary: My library uses fixed status/type/search/sort controls and row rendering, without a user-selected compact/grid collection layout. | [E15] [E18] [E19] |
| OP-191 · Cinexplore | Default detail layout → Reorder movie/show/season/episode detail sections [Official1](https://play.google.com/store/apps/details?hl=en_SG&id=com.fidloo.cinexplore) | **Missing**. No corresponding app/profile/widget/detail/video appearance preference is connected in the inspected settings/rendering domain. Supported: Fixed site styling and separate selectable share-card designs/colors.  Missing: Reordering detail-page rating/synopsis sections. Boundary: Detail-content sections are in fixed source order; no user section-order preference or reorder action. | [E15] [E18] [E19] |
| OP-236 · Suite TV | Functional core free → Themes/accent colors/icons [Official1](https://www.suitetv.app/en/about) | **Missing**. No corresponding app/profile/widget/detail/video appearance preference is connected in the inspected settings/rendering domain. Supported: Fixed site styling and separate selectable share-card designs/colors.  Missing: Suite TV app themes/accent colors/icon choices. Boundary: Card colors do not change app accent/theme and static PWA assets do not provide selectable app icons; all three subcontrols Missing. | [E15] [E18] [E19] |
| OP-349 · CineTrak | Base theme access unspecified. → One-time Premium theme access confirmed by attributable developer announcement. Complete cosmetic set unknown. [Official1](https://www.reddit.com/r/cinetrak/comments/1wfkver/cinetrak_is_back/) | **Missing**. No corresponding app/profile/widget/detail/video appearance preference is connected in the inspected settings/rendering domain. Supported: Fixed site styling and separate selectable share-card designs/colors.  Missing: CineTrak Premium color/AMOLED Black theme selection. Boundary: No app palette or AMOLED Black selector. The vendor one-time Premium theme evidence does not establish a complete theme inventory. | [E15] [E18] [E19] |
| OP-395 · StreamGuide (Christian Krueger) | Free cosmetic set unknown. → Older guide explicitly Premium themes; current FAQ omits benefit. [Official1](https://streamguide.app/faq), [Official2](https://streamguide.app/resources/getting-started-with-streamguide) | **Missing**. No corresponding app/profile/widget/detail/video appearance preference is connected in the inspected settings/rendering domain. Supported: Fixed site styling and separate selectable share-card designs/colors.  Missing: StreamGuide Premium theme selector. Boundary: Older StreamGuide guide names Premium themes; current FAQ omits the benefit. That contradiction remains; narrowed Goodwatch theme-selector control is absent. | [E15] [E18] [E19] |
| OP-442 · Stremio | Baseline customization unspecified. → Supporter appearance choices; precise app-platform equivalence unverified. [Official1](https://www.stremio.com/plans) | **Missing**. No corresponding app/profile/widget/detail/video appearance preference is connected in the inspected settings/rendering domain. Supported: Fixed site styling and separate selectable share-card designs/colors.  Missing: Stremio supporter appearance controls. Boundary: Vendor appearance controls/platform equivalence remain unspecified. Narrow assessed variant: selectable app appearance setting is Missing in this code; do not infer the vendor full hidden control set. | [E15] [E18] [E19] |
| OP-462 · Television Time | Widgets generally advertised. → Changelog Plus custom tint. [Official1](https://apps.apple.com/us/app/television-time/id969714962), [Official2](https://televisiontime.app/changelog/) | **Missing**. No corresponding app/profile/widget/detail/video appearance preference is connected in the inspected settings/rendering domain. Supported: Fixed site styling and separate selectable share-card designs/colors.  Missing: Television Time widget tint setting. Boundary: No home-screen widget implementation/tint preference in this web consumer. Card accent colors do not customize a system widget. | [E15] [E18] [E19] |
| OP-482 · TV Show & Movie Tracker / TVST (Jonathan ANTOINE) | Default UI free. → Explicit Customize UI SKU; exact controls unknown. [Official1](https://apps.apple.com/us/app/id1228141510), [Official2](https://apps.apple.com/fr/app/tv-shows-movies-tracker/id1228141510) | **Missing**. No corresponding app/profile/widget/detail/video appearance preference is connected in the inspected settings/rendering domain. Supported: Fixed site styling and separate selectable share-card designs/colors.  Missing: TVST Customize UI SKU controls. Boundary: TVST Customize UI SKU is documented but exact controls unknown. Narrow assessed variant: saved user-controlled app appearance/layout is Missing. | [E15] [E18] [E19] |
| OP-549 · Bingebase | Six colors plus Noir free. → PRO additional themes. [Official1](https://bingebase.com/pro), [Official2](https://bingebase.com/roadmap/shipped) | **Missing**. No corresponding app/profile/widget/detail/video appearance preference is connected in the inspected settings/rendering domain. Supported: Fixed site styling and separate selectable share-card designs/colors.  Missing: Bingebase additional app theme set. Boundary: Vendor six free colors plus Noir and additional PRO themes are app appearance. Goodwatch seven card themes have a different scope. | [E15] [E18] [E19] |
| OP-597 · AlloCiné | Base preferences unspecified. → Premium video preferences. [Official1](https://apps.apple.com/fr/app/allocin%C3%A9-cin%C3%A9ma-s%C3%A9ries-vod/id351184863) | **Missing**. No corresponding app/profile/widget/detail/video appearance preference is connected in the inspected settings/rendering domain. Supported: Fixed site styling and separate selectable share-card designs/colors.  Missing: AlloCiné video preferences. Boundary: Clip/type selection and click-to-play are transient component state; no saved video-preference control. Vendor exact preference controls are unspecified. | [E15] [E18] [E19] |
| OP-644 · iCollect Movies / iCollect Everything | Baseline themes. → Pro26additional themes per publisher and manual dark/light. [Official1](https://www.icollecteverything.com/2024/10/26/heres-the-price-differences-and-breakdown-of-our-product-offerings/), [Official2](https://www.icollecteverything.com/support/) | **Missing**. No corresponding app/profile/widget/detail/video appearance preference is connected in the inspected settings/rendering domain. Supported: Fixed site styling and separate selectable share-card designs/colors.  Missing: iCollect 26 additional themes and manual light/dark. Boundary: No manual light/dark switch or additional app theme inventory; vendor 26 additional themes does not describe card design count. | [E15] [E18] [E19] |


### icons — Missing

Fixed PWA/icon assets exist; selectable alternate app icons are missing.

Proposed display splits: Static PWA and favicon installation assets: Have; Alternate app icon chooser: Missing.

| Record / competitor | Exact source free → paid difference | Goodwatch state and exact scoped conclusion | Evidence |
|---|---|---|---|
| OP-187 · Sofa | Default → 70+ icons [Official1](https://www.sofahq.com/pricing) | **Missing**. The installation icon assets are fixed; no alternate-icon selection/persistence or native platform switch. Supported: Static favicon/apple-touch/PWA icon assets. Missing: User-selectable alternate app icons. Boundary: Sofa advertises 70+ icons; Goodwatch fixed PWA/favicon files expose no user-selectable alternatives. | [E18] |
| OP-188 · Sequel; FilmNoir; Letterboxd | Default → Alternate icons; Letterboxd iOS,Android coming soon [Official1](https://apps.apple.com/us/app/sequel-media-tracker/id1630746993), [Official2](https://www.filmnoir.app/), [Official3](https://letterboxd.com/about/pro-apps/) | **Missing**. The installation icon assets are fixed; no alternate-icon selection/persistence or native platform switch. Supported: Static favicon/apple-touch/PWA icon assets. Missing: User-selectable alternate app icons. Boundary: All three vendor subvariants Missing. Letterboxd cited entitlement is iOS with Android coming soon; no platform availability assumption carried into Goodwatch. | [E18] |
| OP-460 · Television Time | Base icon choices unspecified. → Plus additional icons. [Official1](https://apps.apple.com/us/app/television-time/id969714962), [Official2](https://televisiontime.app/changelog/) | **Missing**. The installation icon assets are fixed; no alternate-icon selection/persistence or native platform switch. Supported: Static favicon/apple-touch/PWA icon assets. Missing: User-selectable alternate app icons. Boundary: Television Time Plus extra icons require a chooser; Goodwatch static installation assets are not that chooser. | [E18] |
| OP-598 · AlloCiné | Default icon. → Premium icon choice. [Official1](https://apps.apple.com/fr/app/allocin%C3%A9-cin%C3%A9ma-s%C3%A9ries-vod/id351184863) | **Missing**. The installation icon assets are fixed; no alternate-icon selection/persistence or native platform switch. Supported: Static favicon/apple-touch/PWA icon assets. Missing: User-selectable alternate app icons. Boundary: AlloCiné Premium icon choice requires a chooser; Goodwatch static installation assets are not that chooser. | [E18] |


### profile-style — Partial

Profiles derive accents and artwork from the newest list; dedicated styling, uploads and pins are missing.

Proposed display splits: Derived profile accent/initial/backdrop: Have; Dedicated avatar/frame/banner/name/About Me/block controls: Missing; Profile content/review pins: Missing.

| Record / competitor | Exact source free → paid difference | Goodwatch state and exact scoped conclusion | Evidence |
|---|---|---|---|
| OP-181 · Letterboxd | Ordinary profile → Pin content(web)/reviews(app wording) [Official1](https://letterboxd.com/about/pro/), [Official2](https://letterboxd.com/about/pro-apps/) | **Missing**. Profile lists are newest-first and have no pin field/action; reviews have no profile pinning surface. Supported: Public share lists ordered by creation. Missing: Profile content/review pins. Boundary: Pinning a title in a five-title ranking is not profile content pinning. | [E02] [E04] [E19] |
| OP-183 · MyAnimeList | Basic profile → Font/colors/background [Official1](https://myanimelist.net/membership) | **Missing**. Profile writer/renderer has no About Me content field/editor or font/color/background controls for it. Supported: Derived share-list colors in profile header. Missing: Custom styled About Me content. Boundary: Profile-wide derived accent is not About Me formatting. | [E12] [E19] |
| OP-231 · MyShows | Ordinary profile → Banner min2560x1440,max1.8MB JPG [Official1](https://en.myshows.me/about/pro/) | **Missing**. Profile backdrop is derived from newest list catalog artwork; no uploaded avatar/banner input or storage. Supported: Automatic initial/avatar gradient and catalog backdrop. Missing: Custom avatar/banner upload satisfying MyShows dimensions/file format. Boundary: Vendor banner minimum 2560×1440, maximum 1.8 MB JPG; no Goodwatch upload pipeline to compare file allowance. | [E12] [E16] [E19] |
| OP-232 · MyShows | Ordinary profile → Reorder blocks [Official1](https://en.myshows.me/about/pro/) | **Missing**. Public profile has fixed header/list-grid structure, not reorderable user blocks. Supported: Newest-first share-list grid. Missing: Profile block reordering. Boundary: No profile block/order field or action; five-title drag order is a different object. | [E02] [E19] |
| OP-237 · Suite TV | Functional core free → Avatar ring/animated avatar/name font/text colors/stickers/badge [Official1](https://www.suitetv.app/en/about) | **Missing**. Generated initial and provider account avatar do not expose ring/animation/name typography/stickers/badge controls. Supported: Derived public initial/gradient; provider avatar may appear in private account menu. Missing: Avatar ring/animated upload/name font/text colors/stickers/profile badge controls. Boundary: Card fonts do not style profile name by user choice; no profile configuration fields. | [E12] [E19] [E20] |
| OP-566 · Flickchart | Baseline profile. → VIP customization/stylized avatar. [Official1](https://www.flickchart.com/vip), [Official2](https://www.flickchart.com/faq) | **Partial**. A list-theme choice indirectly changes public profile accents and generated initial avatar; no dedicated avatar/profile customization editor. Supported: Derived profile accent/gradient and newest-list catalog backdrop. Missing: Independent profile styling/selected avatar controls. Boundary: Vendor stylized avatar details unspecified. Narrow Have: changing newest shared-list theme changes profile accent; do not claim Flickchart full customization. | [E15] [E19] |
| OP-608 · Anime-Planet | Baseline profile. → Bronze+; higher tier support roles and community differences. [Official1](https://www.anime-planet.com/about), [Official2](https://www.patreon.com/animeplanet/membership) | **Missing**. No avatar frame or independently selected/uploaded profile banner. Supported: Automatic initial/gradient and newest-list backdrop. Missing: Avatar frame and profile-banner customization. Boundary: Anime-Planet Bronze+ entitlement remains separate from human community roles. | [E16] [E19] |


### recognition — Missing

Public profiles have no tier badges, achievements or supporter marker.

Proposed display splits: Ordinary handle/list signature: Have; Software tier badges/achievements/forum-title/optional-badge controls: Missing.

| Record / competitor | Exact source free → paid difference | Goodwatch state and exact scoped conclusion | Evidence |
|---|---|---|---|
| OP-244 · Serializd; SIMKL; TVmaze; MyAnimeList; Trakt | Ordinary identity → Tier recognition,not functional capacity [Official1](https://www.patreon.com/Serializd/membership), [Official2](https://docs.simkl.org/how-to-use-simkl/account-and-billing/special-plans/supporter-role-usd1-month.md), [Official3](https://www.tvmaze.com/premium), [Official4](https://myanimelist.net/membership), [Official5](https://apps.apple.com/us/app/trakt-tv-time-to-watch/id1514873602) | **Missing**. Public/member identity contains no tier badge, achievement or optional supporter marker. Supported: Ordinary handle and signed share-list byline. Missing: Software membership recognition/achievement/profile badge. Boundary: Each Serializd/SIMKL/TVmaze/MAL/Trakt subvariant is Missing. No member badge/achievement/forum-title field or renderer; genre/rank/share graphics are different objects. | [E12] [E19] [E20] |
| OP-488 · TV Episode Calendar / EpisodeCalendar | Baseline achievement allocation unspecified. → Premium achievements. [Official1](https://episodecalendar.com/en/pages/features), [Official2](https://episodecalendar.com/en/pages/premium) | **Missing**. Public/member identity contains no tier badge, achievement or optional supporter marker. Supported: Ordinary handle and signed share-list byline. Missing: Software membership recognition/achievement/profile badge. Boundary: No user achievement state/renderer in the inspected identity/library consumer; watch counts and ordinary onboarding feedback do not implement EpisodeCalendar achievements. | [E12] [E19] [E20] |
| OP-613 · Annict / アニクト | Free profile. → Supporter optional badge. [Official1](https://annict.com/supporters), [Official2](https://annict.com/legal) | **Missing**. Public/member identity contains no tier badge, achievement or optional supporter marker. Supported: Ordinary handle and signed share-list byline. Missing: Software membership recognition/achievement/profile badge. Boundary: No optional supporter-badge field, profile renderer or toggle. Permanent handle/list signature is ordinary identity. | [E12] [E19] [E20] |


### favorites — Missing

Legacy title-favorite flags do not provide public categorized favorites.

Proposed display splits: Legacy favorite API/storage: Present without mounted FavoriteButton consumer; Public favorite categories and per-category allowance: Missing.

| Record / competitor | Exact source free → paid difference | Goodwatch state and exact scoped conclusion | Evidence |
|---|---|---|---|
| OP-185 · MyAnimeList | 10/category → 20/category; excess removed14 days after expiry [Official1](https://myanimelist.net/membership/faq) | **Missing**. Legacy title-favorite storage has no connected production FavoriteButton consumer and no public category sections/capacity controls. Supported: Legacy movie/show favorite API and stored flags only; public top 5 lists are separate. Missing: Categorized public-profile favorites including 10→20 per-category capacity. Boundary: MAL extra entries removed 14 days after lapse; Goodwatch has neither category allowance nor equivalent expiry behavior. Do not infer unlimited favorites from upsert. | [E19] [E21] |

## Pinned source evidence and negative inspection bounds

Each evidence ID below is a trace across a specific object and its consumer paths. A Missing conclusion applies only to the named behavior within these bounds; it is not an assertion that every source string or future route has been disproved. Links are immutable main-snapshot citations.

### E01: Five-title share-list model and validated writes

Share-list input, create/update/visibility writers and model: named ranked lists, exactly five unique resolvable movie/show keys; no variable-length custom-list domain or aggregate item allowance. No account list-count check in createList.

[ui/share-card/model.ts:38–41](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/share-card/model.ts#L38-L41); [server/share-lists/store.server.ts:19–44](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/share-lists/store.server.ts#L19-L44); [server/share-lists/store.server.ts:93–180](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/share-lists/store.server.ts#L93-L180); [routes/api.share-lists.ts:20–85](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/api.share-lists.ts#L20-L85).

### E02: Share-list readers stop at 200

Owner reader and anonymous profile reader each LIMIT 200 with no continuation in these readers; MCP pagination occurs after owner retrieval, so does not remove the underlying 200-list bound. Claim/deletion cache invalidation separately reads at most 1,000 IDs, not a 1,000-list product allowance.

[server/share-lists/store.server.ts:123–148](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/share-lists/store.server.ts#L123-L148); [server/share-lists/view.server.ts:122–139](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/share-lists/view.server.ts#L122-L139); [server/mcp/lists.server.ts:59–83](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/lists.server.ts#L59-L83); [server/share-lists/store.server.ts:270–316](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/share-lists/store.server.ts#L270-L316).

### E03: Connected Remix copy flow

New-list loader resolves any available source list (no owner-only restriction), copies prompt, title, five entries, design/theme and lineage into a new draft; saved create validates source. Public list links expose Remix. No scheduled source-to-copy update/merge operation. The visible Remix button appears for other owners; an owner can load their own source through the same ?remix= route, but their list page exposes Edit rather than an own-copy button.

[routes/lists.new.tsx:65–100](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/lists.new.tsx#L65-L100); [server/share-lists/store.server.ts:130–148](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/share-lists/store.server.ts#L130-L148); [routes/u.$handle.lists.$id.tsx:187–203](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/u.$handle.lists.$id.tsx#L187-L203).

### E04: Manual rank editing, not list pinning

Production editor Ranking and list-state implement drag ordering/add/remove of the five positions. Persistence is the list items array. Owner controls expose visibility/delete/restore; their API/input contains no pin or collection-position field. Wishlist order is a chosen sort, not drag order.

[ui/share-list-editor/Ranking.tsx:1–95](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/share-list-editor/Ranking.tsx#L1-L95); [ui/share-list-editor/list-state.ts:1–119](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/share-list-editor/list-state.ts#L1-L119); [ui/share-lists/OwnerListControls.tsx:1–150](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/share-lists/OwnerListControls.tsx#L1-L150); [server/share-lists/store.server.ts:36–44](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/share-lists/store.server.ts#L36-L44); [CONTEXT.md:65–67](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/CONTEXT.md#L65-L67).

### E05: Wishlist title writes and member read

Authenticated route calls the per-title movie/show upsert/delete. Composite identity user_id/tmdb_id/media_type; no per-account/title-count entitlement guard in this writer. Member reader queries all matching Wishlist rows without an explicit SQL LIMIT and maps them all. This query wrapper returns one response, with no server cursor/drain proving arbitrary database result sizes.

[routes/api.update-wishlist.tsx:5–22](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/api.update-wishlist.tsx#L5-L22); [server/wishList.server.ts:24–79](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/wishList.server.ts#L24-L79); [server/userData.server.ts:98–163](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/userData.server.ts#L98-L163); [utils/crate.ts:424–442](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/utils/crate.ts#L424-L442); [utils/crate.ts:475–483](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/utils/crate.ts#L475-L483).

### E06: Library pagination and search

Fixed status-derived views (Want to see, Seen, Watching, On hold, Dropped, Not rated), title query, movie/show filter and built-in sorts. Cards are 60 per step, next offsets continue over all keys returned by member data; frontend useInfiniteQuery and Show more consume next. Query text limited to 100 characters. Not arbitrary saved collections or edition search. Titles absent from catalog are omitted from visible cards.

[domain/my-library.ts:1–110](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/domain/my-library.ts#L1-L110); [domain/my-library.ts:140–209](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/domain/my-library.ts#L140-L209); [server/my-library.server.ts:151–232](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/my-library.server.ts#L151-L232); [ui/my-library/MyLibraryPage.tsx:470–492](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/my-library/MyLibraryPage.tsx#L470-L492); [ui/my-library/MyLibraryPage.tsx:632–650](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/my-library/MyLibraryPage.tsx#L632-L650); [routes/my-library.$list.tsx:1–110](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/my-library.$list.tsx#L1-L110).

### E07: Wishlist sorting and progressive cards

Watch next supports six named sorts: match/waiting/added/newest/top/popular. Plan iterates all returned Wishlist keys; My movies restricts the same plan to movies. Later tiers load progressively; md initially 40/sm 30 before +N, cards fetched 60/request. These are rendering/read-batch bounds, not stored-item caps. No user-defined comparator, drag/pin order or saved arbitrary collection.

[domain/watch-next.ts:12–25](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/domain/watch-next.ts#L12-L25); [domain/watch-next.ts:103–110](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/domain/watch-next.ts#L103-L110); [server/watch-next.server.ts:340–427](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/watch-next.server.ts#L340-L427); [server/watch-next.server.ts:835–889](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/watch-next.server.ts#L835-L889); [server/watch-next.server.ts:1066–1080](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/watch-next.server.ts#L1066-L1080); [ui/watch-next/useWatchNext.ts:1–27](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/watch-next/useWatchNext.ts#L1-L27); [routes/my-movies.tsx:45–65](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/my-movies.tsx#L45-L65); [server/title-cards.server.ts:84–96](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/title-cards.server.ts#L84-L96).

### E08: Tracked-title writer, aggregate reader and show display bounds

Tracking writes are scoped to one canonical title/state/log, with no total/concurrent-title entitlement guard in the inspected writer paths. Member grouped history/state SQL has no explicit total-title LIMIT. Per-title history reads ARE bounded: movie 200 rows and show 20,000 rows. My shows returns all planned groups; default next-episode enrichment covers first 30 Continue/Pick-up rows, independent of total storage. Catalog episode read LIMIT 100000; UI Start expands 30 at a time and Pick up 5. This is neither unlimited-history proof nor a full Episodes-screen substitute.

[server/tracking.server.ts:698–734](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/tracking.server.ts#L698-L734); [server/tracking-sql.ts:4–47](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/tracking-sql.ts#L4-L47); [server/tracking-sql.ts:82–91](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/tracking-sql.ts#L82-L91); [server/my-shows.server.ts:140–164](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/my-shows.server.ts#L140-L164); [server/my-shows.server.ts:392–464](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/my-shows.server.ts#L392-L464); [ui/my-shows/MyShowsPage.tsx:56–59](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/my-shows/MyShowsPage.tsx#L56-L59); [ui/my-shows/MyShowsPage.tsx:530–537](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/my-shows/MyShowsPage.tsx#L530-L537); [server/userData.server.ts:98–163](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/userData.server.ts#L98-L163).

### E09: Real MCP batch title operations

Registered set_want_to_see/rate_title/log_watch/set_show_status tools accept up to 50 items; batch writer delegates Wishlist additions/removals to multi-row writer. Rate budgets 300 title writes/minute and 2000/hour; request 60/minute 1000/hour, at most one batch write per request. OAuth read/write scopes, configured MCP resource, per-member tool flags apply. No web add-all-visible UI, arbitrary-list bulk deletion, or season/episode custom-list entries. Existing focused test documents 50 adds but was read, not run.

[server/mcp/write-tools.server.ts:69–95](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/write-tools.server.ts#L69-L95); [server/mcp/write-tools.server.ts:143–157](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/write-tools.server.ts#L143-L157); [server/mcp/write-tools.server.ts:180–204](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/write-tools.server.ts#L180-L204); [server/mcp/batch.server.ts:21–35](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/batch.server.ts#L21-L35); [server/mcp/batch.server.ts:350–380](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/batch.server.ts#L350-L380); [server/mcp/writes.server.ts:1–70](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/writes.server.ts#L1-L70); [server/library-many.server.ts:40–93](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/library-many.server.ts#L40-L93); [server/mcp/endpoint.server.ts:33–39](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/endpoint.server.ts#L33-L39); [server/mcp/endpoint.server.ts:95–104](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/endpoint.server.ts#L95-L104); [server/mcp/endpoint.server.ts:125–185](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/endpoint.server.ts#L125-L185); [server/mcp/batch.test.ts:481–508](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/batch.test.ts#L481-L508).

### E10: Per-title watch logs and statuses, not diary/archive

Movie log endpoint requires one tmdb_id and session identity; UI supports dated/undated per-title watches, edit/delete/restore. Library shows last-watched title summaries without reading the occurrence log. State machine has Not started/Watching/On hold/Dropped/Seen, no archive state or archive flag in library selection. Inspected routes/domain/server/UI provide no cross-title chronological diary with advanced occurrence filters or archive action.

[routes/api.watch-log.ts:14–37](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/api.watch-log.ts#L14-L37); [server/watch-log.server.ts:22–86](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/watch-log.server.ts#L22-L86); [ui/watch-log/WatchLog.tsx:1–150](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/watch-log/WatchLog.tsx#L1-L150); [domain/tracking/machine.ts:1–100](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/domain/tracking/machine.ts#L1-L100); [domain/my-library.ts:1–64](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/domain/my-library.ts#L1-L64); [server/my-library.server.ts:1–7](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/my-library.server.ts#L1-L7).

### E11: Personal-data ownership and public/unlisted publication

Personal records and log endpoints are session-owned. Share-list visibility enum and writer accept public or unlisted only; list loader reads the public-by-id view before viewer identity and renders unlisted lists by link. Public profile selection excludes unlisted for visitors but has no hide-profile/privacy selector. private,no-store is HTTP cache policy, not access-control. Discover/privacy setting controls For you and links to privacy policy, not visibility. No owned catalog publication domain.

[server/share-lists/store.server.ts:19–44](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/share-lists/store.server.ts#L19-L44); [server/share-lists/store.server.ts:181–196](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/share-lists/store.server.ts#L181-L196); [server/share-lists/page-loaders.server.ts:34–98](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/share-lists/page-loaders.server.ts#L34-L98); [server/share-lists/view.server.ts:122–139](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/share-lists/view.server.ts#L122-L139); [routes/settings.discover-privacy.tsx:1–65](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/settings.discover-privacy.tsx#L1-L65); [routes/api.watch-log.ts:83–105](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/api.watch-log.ts#L83-L105).

### E12: Public handle chosen once

Profile settings presents permanent handle; claimHandle returns 409 for a changed existing handle. Profile insert stores user_id/handle/timestamps; reserved claim survives deletion. Account provider name/image is distinct and does not rename the public handle. No cooldown-based renaming operation.

[routes/settings.profile.tsx:1–71](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/settings.profile.tsx#L1-L71); [server/share-lists/store.server.ts:234–299](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/share-lists/store.server.ts#L234-L299); [routes/settings.account.tsx:1–205](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/settings.account.tsx#L1-L205).

### E13: Public handle validation

Normalized public handles have 3–30 characters, letter-first lowercase letters/digits/underscores, reserved-name restrictions. Claim is available through production HandlePicker/settings; no paid-tier guard. Shared subset with iCollect 1–24 is eligible 3–24, not every 1–24 string.

[utils/handles.ts:1–14](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/utils/handles.ts#L1-L14); [utils/handles.ts:55–76](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/utils/handles.ts#L55-L76); [ui/share-lists/HandlePicker.tsx:1–110](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/share-lists/HandlePicker.tsx#L1-L110); [routes/settings.profile.tsx:40–71](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/settings.profile.tsx#L40-L71).

### E14: Catalog search/collections are not owned editions

User data is keyed movie/show catalog titles, with no owned edition/barcode/image collection records. Movie collection server only queries catalog movie IDs ordered by release date. Library filters are status/type/title; no saved-filter object, cross-owned-collection report, media-photo scanner or scan-credit ledger in inspected domain/routes/server. App-wide barcode/ISBN/owned-edition/scan-credit source search matched only a decorative barcode comment in share-card/model.ts.

[types/user-data.ts:6–40](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/types/user-data.ts#L6-L40); [server/collection.server.ts:5–44](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/collection.server.ts#L5-L44); [domain/my-library.ts:56–74](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/domain/my-library.ts#L56-L74); [domain/my-library.ts:187–210](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/domain/my-library.ts#L187-L210); [server/my-library.server.ts:151–232](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/my-library.server.ts#L151-L232).

### E15: Generated card designs and colors

Production pickers choose from 15 registered designs and 7 named color themes, persisted on each five-title share list. These change card/list presentation; not arbitrary user-selected title poster/backdrop, uploaded cover or app theme. Cover design consumes catalog artwork. Public page and profile tiles render these designs.

[ui/share-card/designs.ts:20–40](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/share-card/designs.ts#L20-L40); [ui/share-card/model.ts:64–75](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/share-card/model.ts#L64-L75); [ui/share-list-editor/Pickers.tsx:65–90](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/share-list-editor/Pickers.tsx#L65-L90); [ui/share-list-editor/Pickers.tsx:140–166](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/share-list-editor/Pickers.tsx#L140-L166); [ui/share-card/designs/cover.tsx:1–115](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/share-card/designs/cover.tsx#L1-L115); [ui/share-lists/ShareListTile.tsx:1–70](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/share-lists/ShareListTile.tsx#L1-L70).

### E16: Catalog artwork without per-user override

Share-list title resolver reads movie/show poster_path/backdrop_path from catalog; editor input has keys/design/theme, no user artwork paths/overrides. Production title/episode/person presentation and settings paths were inspected: images are catalog-fed; no gallery/URL upload or per-title/episode/person override preference. Localized poster resolver is positive exception in E17, not arbitrary image selection. Hero backdrop consumes media.details.backdrop_path; person portrait queries catalog person.profile_path; show tracking maps catalog still_path to episode.still and EpisodeList renders it. Spoiler reveal is not an image chooser.

[server/share-lists/titles.server.ts:18–63](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/share-lists/titles.server.ts#L18-L63); [server/share-lists/store.server.ts:36–44](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/share-lists/store.server.ts#L36-L44); [types/user-data.ts:13–40](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/types/user-data.ts#L13-L40); [routes/settings.profile.tsx:1–71](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/settings.profile.tsx#L1-L71); [routes/api.user-settings.get.tsx:11–33](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/api.user-settings.get.tsx#L11-L33); [ui/details/hero/Trailer.tsx:29–35](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/details/hero/Trailer.tsx#L29-L35); [server/person.server.ts:537–546](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/person.server.ts#L537-L546); [ui/person/Portrait.tsx:1–34](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/person/Portrait.tsx#L1-L34); [server/show-tracking.server.ts:65–135](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/show-tracking.server.ts#L65-L135); [ui/tracking/EpisodeList.tsx:587–655](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/tracking/EpisodeList.tsx#L587-L655).

### E17: Language-selected posters are supported

Settings Show titles in affects title text/posters/description/tagline, with browser/member preference through SettingsPair. Overlay picks best rated catalog poster in selected base language with fallback to canonical; payload overlay replaces poster fields. No independent textless/with-text switch or preferred image ID field. Thus poster-language subset is Have, combined Flickchart language/text preference Partial.

[routes/settings.language.tsx:1–30](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/settings.language.tsx#L1-L30); [ui/media-preference/SettingsPair.tsx:1–180](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/media-preference/SettingsPair.tsx#L1-L180); [utils/media-overlay-core.ts:130–173](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/utils/media-overlay-core.ts#L130-L173); [utils/media-overlay-core.ts:218–265](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/utils/media-overlay-core.ts#L218-L265); [utils/media-payload-core.ts:150–175](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/utils/media-payload-core.ts#L150-L175); [server/media-payload.server.ts:50–65](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/media-payload.server.ts#L50-L65).

### E18: App appearance settings and fixed installation icons

Settings routes/navigation and validated UserSettingsSchema offer country/services/language/For you/profile/account, not appearance/layout/icon/video preferences. Static root icon links and webmanifest icons/theme_color define installation assets; no native icon-switch interface or widget tint domain. Content filters named themes/styles mean narrative attributes, not visual skins. Card themes are E15. Scoped searches found no app-icon/theme-preference/textless-poster persistence; fixed dark classes/default grids do not constitute user controls. Detail-content sections are composed in source order. Trailer/clip selection and click-to-play state are transient component state; no saved playback preference is passed by these consumers.

[ui/settings/paths.ts:1–10](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/settings/paths.ts#L1-L10); [ui/settings/SettingsHome.tsx:1–180](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/settings/SettingsHome.tsx#L1-L180); [routes/api.user-settings.get.tsx:11–33](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/api.user-settings.get.tsx#L11-L33); [server/user-settings.server.ts:102–117](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/user-settings.server.ts#L102-L117); [root.tsx:75–93](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/root.tsx#L75-L93); [goodwatch-webapp/public/site.webmanifest:1–22](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/public/site.webmanifest#L1-L22); [domain/themes-styles.ts:1–50](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/domain/themes-styles.ts#L1-L50); [ui/details/DetailsContent.tsx:100–180](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/details/DetailsContent.tsx#L100-L180); [ui/details/Media.tsx:35–85](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/details/Media.tsx#L35-L85); [ui/details/YoutubePlayer.tsx:4–15](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/details/YoutubePlayer.tsx#L4-L15).

### E19: Derived public-profile styling, without profile customizer

Public profile uses newest share list: accent from its theme, first available title backdrop, initial of handle. Lists ordered newest; no pin or reorder field. Profile writer/settings contains handle only; no About Me, upload avatar/banner, fonts, frame/ring/sticker or block configuration. Account menu can display auth/provider avatar_url, not a public-profile customization writer. Existing source makes some public appearance indirect, so blanket no styling is too broad.

[routes/u.$handle._index.tsx:50–88](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/u.$handle._index.tsx#L50-L88); [server/share-lists/view.server.ts:134–139](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/share-lists/view.server.ts#L134-L139); [server/share-lists/store.server.ts:270–299](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/share-lists/store.server.ts#L270-L299); [routes/settings.profile.tsx:40–71](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/settings.profile.tsx#L40-L71); [ui/main/UserMenu.tsx:21–40](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/main/UserMenu.tsx#L21-L40); [server/auth/runtime.server.ts:143–157](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/auth/runtime.server.ts#L143-L157).

### E20: No member recognition system in public identity model

Profile store/write/read and public profile renderer contain handle and share lists, with no membership tier, badge, achievement, forum title or optional supporter-badge toggle. Badge-named UI elsewhere denotes title genres/catalog facts, not member recognition. Scoped app source search for achievement/supporter/patron and profile controls found no such identity feature; account/provider data does not supply it.

[server/share-lists/store.server.ts:270–299](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/share-lists/store.server.ts#L270-L299); [server/share-lists/view.server.ts:122–139](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/share-lists/view.server.ts#L122-L139); [routes/u.$handle._index.tsx:50–154](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/u.$handle._index.tsx#L50-L154); [types/user-data.ts:28–40](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/types/user-data.ts#L28-L40); [ui/badge/GenreBadge.tsx:1–16](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/badge/GenreBadge.tsx#L1-L16).

### E21: Legacy title favorites are not public categorized favorites

Favorite API/writer and member-data read still store movie/show title hearts; no category-specific 10/20 allowance or public profile favorite sections. FavoriteButton has no importing production consumer in app source (only its own definition); public profile renders share lists, not favorite categories. A top 5 share list is not a MAL category. Legacy storage alone is not connected public favorite capacity.

[server/favorites.server.ts:1–65](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/favorites.server.ts#L1-L65); [routes/api.update-favorites.tsx:1–17](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/api.update-favorites.tsx#L1-L17); [ui/user/FavoriteButton.tsx:1–38](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/user/FavoriteButton.tsx#L1-L38); [server/userData.server.ts:115–121](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/userData.server.ts#L115-L121); [server/userData.server.ts:154–163](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/userData.server.ts#L154-L163); [routes/u.$handle._index.tsx:79–125](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/u.$handle._index.tsx#L79-L125).

### E22: Shared guest progress bounds

Taste/title/Wishlist share browser interactions (score/plan/skip/not-interested), later action replaces earlier for the same movie/show. Guest scores capped 20, existing scores editable; localStorage with memory fallback, no cross-device cloud guarantee. guestUserData gives empty tracked watchState. Member capacity conclusions do not erase guest limits, storage quota or state/episode restrictions.

[utils/guest-progress.ts:20–47](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/utils/guest-progress.ts#L20-L47); [utils/guest-progress.ts:49–97](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/utils/guest-progress.ts#L49-L97); [utils/guest-progress.ts:157–179](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/utils/guest-progress.ts#L157-L179); [CONTEXT.md:42–46](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/CONTEXT.md#L42-L46).

### E23: Feature gates and deployment scope

General release flag list contains connector, not list/profile/artwork paid entitlements. MCP tool flags accept on/off/member allowlist and default enabled if absent; endpoint still requires configured resource and OAuth scopes. This audit documents code Have subsets without asserting production flag values, entitlement availability or real load capacity.

[server/features.server.ts:1–38](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/features.server.ts#L1-L38); [server/mcp/policy.server.ts:1–23](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/policy.server.ts#L1-L23); [server/mcp/endpoint.server.ts:58–104](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/endpoint.server.ts#L58-L104); [server/mcp/write-tools.server.ts:320–365](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/write-tools.server.ts#L320-L365).
## Integration and evidence limits

This handoff recommends assessed states, labels and splits, not implementation work or build order. It does not alter the overview, record mappings or source vendor claims. Keep competitor grouping and preserve independent semantics for automated lists, ordinary lists, Wishlist, chronological logbook, owned media and profile/app cosmetics. A narrowed Have row may be useful to display alongside a Missing requirement; it does not upgrade the original compound record.

Capacity remains deliberately scoped: the documentary finding is the implemented keyed write plus actual reader/paging behavior, with named limits. Database/server storage configuration and deployed entitlement/flag values were not inspected or exercised. Those do not block completion of these code assessments, and are not an invitation to label every capacity generic unknown. An advertised “unlimited” comparison needs a product commitment and ordinary deployment verification later; this audit never promises infinite storage.

Preserved vendor gaps/conflicts: SIMKL PRO regular-list2,000 vs older1,000 comparison; Letterboxd rename30-day web vs90-day app wording; StreamGuide older Premium themes omitted from current FAQ; WatchNext Premium wording versus explicit FAQ/terms Premium100+100 and Unlimited; Hobi advanced sorting controls unspecified; Stremio supporter appearance platform detail and TVST Customize UI exact controls undocumented; iCollect scan-credit replenishment unclear. None prevents assessing the narrower Goodwatch behavior. OP-188 and OP-244 retain all vendor subvariants in JSON; profile badges are software, not human Discord recognition.

Validation: all 16 requested IDs and every 79 source record occur once in feature/record handoff; states limited to Have/Partial/Missing; evidence references resolve; all linked file paths/start lines were checked against git show at the pin. End lines are clamped to source length. JSON is parseable. Only this new dossier is written. Existing focused batch tests were read as source evidence; no application tests, live entitlements, production requests or capacity experiments were run.

## Machine-readable integration handoff

The embedded JSON is the sole machine artifact, so no second output file is needed. Source hashes bind this assessment to the inputs read during the audit; a concurrent UI/data edit may change the view hash without changing these 79 assignments. Reconcile by feature_id/record_id and source requirement text, not by whole-view hash alone.

```json
{
  "schema_version": 1,
  "audit_date": "2026-10-19",
  "code_sha": "97eb3179844c4f68a70ccbd997bab4f2a735516d",
  "previous_audit_sha": "b15b6cbe6f8dd8aa4fc861b5e7c8443c37d39768",
  "source_sha256": {
    "competitor-paid-features-view.json": "afd0e60c2291d8b1a8aac29eff38b70b9f643f97781e0ff4f33753fe4af37c9a",
    "competitor-paid-features-opportunities.csv": "0447775a0b31ed3b421bcfb1d69d47d6329846579f23f3fef1fa25dd64fe0d44",
    "competitor-paid-features-core.md": "0ccc1e1e65baa6d1fd51b95fc555af00f295d958584c006977b91b0cce249d64",
    "competitor-paid-features-landscape.md": "3b3f37768f11757d0d4319a49d78d815752a93d0a40b86cb3966330ba133005d",
    "competitor-paid-features-discovery-expansion.md": "36851ff9ad509a167bab8577e810757dbf18df2b8b8283975b38040f20016135",
    "competitor-paid-features-named-expansion.md": "50e9b62bfb000918f0eb5d82fd8681744b1d34ab7a568f42f6246ba34639d7d9"
  },
  "assessment_basis": "Pinned main source code; no production or live entitlement tests. Vendor difference taken from cited source CSV and vendor dossiers, not freshly re-researched.",
  "state_meanings": {
    "Have": "Exact narrowed behavior connected in source; deployment not asserted.",
    "Partial": "Concrete supported subset or bounded reader/model; missing remainder explicitly named.",
    "Missing": "Exact requested behavior absent within named relevant model/writer/reader/UI inspection bounds."
  },
  "feature_count": 16,
  "record_count": 79,
  "feature_results": [
    {
      "feature_id": "list-capacity",
      "state": "Missing",
      "summary": "Share lists contain exactly five titles; general custom-list capacities are missing.",
      "record_ids": [
        "OP-096",
        "OP-097",
        "OP-499"
      ],
      "display_splits": [
        "General variable-length lists: Missing",
        "Five-title share-list creation: Have",
        "Per-list item allowance and aggregate allowance: separate Missing comparisons"
      ],
      "evidence_ids": [
        "E01",
        "E02",
        "E05"
      ]
    },
    {
      "feature_id": "wishlist-capacity",
      "state": "Partial",
      "summary": "Wishlist writes and paged reads are present; unlimited end-to-end capacity is not verified.",
      "record_ids": [
        "OP-390",
        "OP-618"
      ],
      "display_splits": [
        "Member movie/show Wishlist add/remove and continuation: Have",
        "Unlimited allowance promise: Partial with reader/storage qualifier"
      ],
      "evidence_ids": [
        "E05",
        "E06",
        "E07",
        "E22"
      ]
    },
    {
      "feature_id": "clone-lists",
      "state": "Partial",
      "summary": "Remix copies own or others’ five-title lists; general list clone/update is missing.",
      "record_ids": [
        "OP-040",
        "OP-520",
        "OP-548",
        "OP-587"
      ],
      "display_splits": [
        "Remix a five-title share list: Have",
        "Clone arbitrary-length lists: Missing",
        "Keep clone updated from source: Missing"
      ],
      "evidence_ids": [
        "E01",
        "E03",
        "E04"
      ]
    },
    {
      "feature_id": "organize-lists",
      "state": "Partial",
      "summary": "Wishlist sorting and five-title drag order work; pinning and collection placement are missing.",
      "record_ids": [
        "OP-045",
        "OP-047",
        "OP-077",
        "OP-583"
      ],
      "display_splits": [
        "Choose six Wishlist orders: Have",
        "Drag five title ranks: Have",
        "Pin lists/items: Missing",
        "Reposition collections or profile lists: Missing"
      ],
      "evidence_ids": [
        "E01",
        "E02",
        "E04",
        "E06",
        "E07"
      ]
    },
    {
      "feature_id": "bulk-lists",
      "state": "Partial",
      "summary": "MCP supports batches of up to 50 title changes; web add-all and general-list bulk tools are missing.",
      "record_ids": [
        "OP-042",
        "OP-043",
        "OP-062"
      ],
      "display_splits": [
        "MCP explicit-title Wishlist batch add/remove: Have, gated",
        "Web add all currently visible films: Missing",
        "Season/episode custom-list entries: Missing"
      ],
      "evidence_ids": [
        "E01",
        "E09",
        "E23"
      ]
    },
    {
      "feature_id": "tracked-capacity",
      "state": "Partial",
      "summary": "Movie/show tracking has no inspected account-count gate; reader/display bounds qualify capacity claims.",
      "record_ids": [
        "OP-069",
        "OP-070",
        "OP-071",
        "OP-072",
        "OP-456",
        "OP-464",
        "OP-485",
        "OP-748"
      ],
      "display_splits": [
        "Member multi-title tracking with paged library: Have",
        "Unlimited title/history/view allowance: Partial",
        "My shows next-episode enrichment: first 30, not all returned shows",
        "Sofa other-media modes and EpisodeCalendar archive policy: Missing"
      ],
      "evidence_ids": [
        "E05",
        "E06",
        "E07",
        "E08",
        "E10",
        "E22"
      ]
    },
    {
      "feature_id": "diary-tools",
      "state": "Missing",
      "summary": "Per-title watch logs exist; a filtered cross-title diary and watchlist archive are missing.",
      "record_ids": [
        "OP-074",
        "OP-076"
      ],
      "display_splits": [
        "Per-title dated movie watch history/editing: Have",
        "Global advanced diary filters: Missing",
        "Separate watchlist archive: Missing"
      ],
      "evidence_ids": [
        "E06",
        "E10"
      ]
    },
    {
      "feature_id": "privacy",
      "state": "Missing",
      "summary": "Personal data is session-owned; profile privacy and private published catalogs are missing.",
      "record_ids": [
        "OP-038",
        "OP-039",
        "OP-642",
        "OP-653"
      ],
      "display_splits": [
        "Session-owned personal records: Have",
        "Public/unlisted share links: Have",
        "Private restricted-reader published list/catalog: Missing",
        "Hide profile/social fields/favorites visibility: Missing"
      ],
      "evidence_ids": [
        "E11",
        "E12",
        "E14"
      ]
    },
    {
      "feature_id": "usernames",
      "state": "Partial",
      "summary": "Public handles can be claimed once with 3–30 characters; renaming and exact 1–24 allowance differ.",
      "record_ids": [
        "OP-180",
        "OP-233",
        "OP-573",
        "OP-641"
      ],
      "display_splits": [
        "Initial valid public-handle claim: Have",
        "Username change: Missing",
        "iCollect 1–24 exact validation range: Partial"
      ],
      "evidence_ids": [
        "E12",
        "E13"
      ]
    },
    {
      "feature_id": "collection-search",
      "state": "Missing",
      "summary": "Catalog/library search exists; owned-collection saved filters, scans and reports are missing.",
      "record_ids": [
        "OP-637",
        "OP-645",
        "OP-652"
      ],
      "display_splits": [
        "Catalog/library title search: Have",
        "Saved owned-collection filters: Missing",
        "Cross-owned-collection reports/search: Missing",
        "AI media scanning and scan credits: Missing"
      ],
      "evidence_ids": [
        "E06",
        "E14"
      ]
    },
    {
      "feature_id": "artwork",
      "state": "Partial",
      "summary": "Generated list cards and localized posters work; custom title, episode, person and owned-cover overrides are missing.",
      "record_ids": [
        "OP-173",
        "OP-174",
        "OP-175",
        "OP-176",
        "OP-177",
        "OP-178",
        "OP-179",
        "OP-235",
        "OP-240",
        "OP-546",
        "OP-547",
        "OP-567",
        "OP-634"
      ],
      "display_splits": [
        "Generated top 5 card design/color: Have",
        "Language-selected catalog poster: Have",
        "Independent poster text preference: Missing",
        "Uploaded/selected title/backdrop/person/episode/owned-cover artwork: Missing"
      ],
      "evidence_ids": [
        "E01",
        "E14",
        "E15",
        "E16",
        "E17"
      ]
    },
    {
      "feature_id": "themes",
      "state": "Missing",
      "summary": "App theme, layout, icon-accent, widget and video-preference controls are missing.",
      "record_ids": [
        "OP-184",
        "OP-186",
        "OP-189",
        "OP-190",
        "OP-191",
        "OP-236",
        "OP-349",
        "OP-395",
        "OP-442",
        "OP-462",
        "OP-482",
        "OP-549",
        "OP-597",
        "OP-644"
      ],
      "display_splits": [
        "Share-card color themes: Have in separate scope",
        "Selectable app light/dark/AMOLED/theme: Missing",
        "Detail section reorder/library layout/widget tint/video controls: Missing"
      ],
      "evidence_ids": [
        "E15",
        "E18",
        "E19"
      ]
    },
    {
      "feature_id": "icons",
      "state": "Missing",
      "summary": "Fixed PWA/icon assets exist; selectable alternate app icons are missing.",
      "record_ids": [
        "OP-187",
        "OP-188",
        "OP-460",
        "OP-598"
      ],
      "display_splits": [
        "Static PWA and favicon installation assets: Have",
        "Alternate app icon chooser: Missing"
      ],
      "evidence_ids": [
        "E18"
      ]
    },
    {
      "feature_id": "profile-style",
      "state": "Partial",
      "summary": "Profiles derive accents and artwork from the newest list; dedicated styling, uploads and pins are missing.",
      "record_ids": [
        "OP-181",
        "OP-183",
        "OP-231",
        "OP-232",
        "OP-237",
        "OP-566",
        "OP-608"
      ],
      "display_splits": [
        "Derived profile accent/initial/backdrop: Have",
        "Dedicated avatar/frame/banner/name/About Me/block controls: Missing",
        "Profile content/review pins: Missing"
      ],
      "evidence_ids": [
        "E02",
        "E04",
        "E12",
        "E15",
        "E16",
        "E19",
        "E20"
      ]
    },
    {
      "feature_id": "recognition",
      "state": "Missing",
      "summary": "Public profiles have no tier badges, achievements or supporter marker.",
      "record_ids": [
        "OP-244",
        "OP-488",
        "OP-613"
      ],
      "display_splits": [
        "Ordinary handle/list signature: Have",
        "Software tier badges/achievements/forum-title/optional-badge controls: Missing"
      ],
      "evidence_ids": [
        "E12",
        "E19",
        "E20"
      ]
    },
    {
      "feature_id": "favorites",
      "state": "Missing",
      "summary": "Legacy title-favorite flags do not provide public categorized favorites.",
      "record_ids": [
        "OP-185"
      ],
      "display_splits": [
        "Legacy favorite API/storage: Present without mounted FavoriteButton consumer",
        "Public favorite categories and per-category allowance: Missing"
      ],
      "evidence_ids": [
        "E19",
        "E21"
      ]
    }
  ],
  "record_results": [
    {
      "record_id": "OP-096",
      "feature_id": "list-capacity",
      "competitors": "SIMKL",
      "product_ids": "simkl",
      "capability": "Items per regular list",
      "source_free_behavior": "Not applicable",
      "source_paid_behavior": "PRO2000(current) vs1000(older comparison); VIP10000",
      "source_primary_urls": [
        "https://simkl.com/vip/",
        "https://docs.simkl.org/how-to-use-simkl/account-and-billing/subscription-plans/features-comparison"
      ],
      "state": "Missing",
      "assessment": "Regular custom lists are a different domain from top 5 sharing; no list can reach the documented 2,000/10,000 item allowance.",
      "implemented_subset": "Named ordered five-title share lists.",
      "missing_subset": "Variable-length regular lists and their per-list capacity.",
      "evidence_ids": [
        "E01",
        "E02"
      ],
      "limits": "SIMKL live 2,000 vs older 1,000 PRO conflict preserved; Goodwatch exactly 5, not a competing aggregate allowance.",
      "externally_blocked_fact": null
    },
    {
      "record_id": "OP-097",
      "feature_id": "list-capacity",
      "competitors": "SIMKL",
      "product_ids": "simkl",
      "capability": "Aggregate regular-list items",
      "source_free_behavior": "Not applicable",
      "source_paid_behavior": "PRO60000/VIP500000",
      "source_primary_urls": [
        "https://simkl.com/vip/",
        "https://docs.simkl.org/how-to-use-simkl/account-and-billing/subscription-plans/features-comparison"
      ],
      "state": "Missing",
      "assessment": "No regular-list aggregate item domain or enforced/account-visible allowance corresponds to 60,000/500,000.",
      "implemented_subset": "Multiple five-title share lists can be created.",
      "missing_subset": "Aggregate regular-list item capacity.",
      "evidence_ids": [
        "E01",
        "E02"
      ],
      "limits": "Owner/public list readers stop 200; at most 1,000 item slots represented by those 200 full lists is derived display arithmetic, not storage entitlement.",
      "externally_blocked_fact": null
    },
    {
      "record_id": "OP-499",
      "feature_id": "list-capacity",
      "competitors": "MDBList / Reeel",
      "product_ids": "mdblist",
      "capability": "Items per list",
      "source_free_behavior": "Free: 10000.",
      "source_paid_behavior": "Basic: 30000; Standard: 40000; Plus: 50000; VIP5: 70000; VIP10: 100000; VIP15: 150000; VIP20: 150000. Separate object-specific caps; no aggregate conflation.",
      "source_primary_urls": [
        "https://docs.mdblist.com/docs/supporter",
        "https://mdblist.memberful.com/join?splash=1",
        "https://docs.mdblist.com/docs/api"
      ],
      "state": "Missing",
      "assessment": "MDBList automated/general lists and 10,000–150,000 per-list allowances have no equivalent arbitrary-list model.",
      "implemented_subset": "Five-title sharing and separate Wishlist.",
      "missing_subset": "General/generated lists with vendor per-list capacities.",
      "evidence_ids": [
        "E01",
        "E05"
      ],
      "limits": "Free 10,000; Basic 30,000; Standard 40,000; Plus 50,000; VIP 5 70,000; VIP 10 100,000; VIP 15/20 150,000; none should be compared with total Wishlist size.",
      "externally_blocked_fact": null
    },
    {
      "record_id": "OP-390",
      "feature_id": "wishlist-capacity",
      "competitors": "StreamGuide (Christian Krueger)",
      "product_ids": "streamguide-krueger",
      "capability": "Watchlist item allowance",
      "source_free_behavior": "Free watchlist; item cap unknown.",
      "source_paid_behavior": "Premium explicitly unlimited watchlist; separate-list count unknown.",
      "source_primary_urls": [
        "https://streamguide.app/faq",
        "https://streamguide.app/resources/getting-started-with-streamguide"
      ],
      "state": "Partial",
      "assessment": "Wishlist add/remove and paged reading are connected; code has no title-count paywall, but does not establish an unlimited service guarantee.",
      "implemented_subset": "Movie/show Wishlist, 60-item library pages with continuation; Watch next progressive cards.",
      "missing_subset": "Explicitly verified unlimited end-to-end item allowance.",
      "evidence_ids": [
        "E05",
        "E06",
        "E07",
        "E22"
      ],
      "limits": "Member data query has no explicit LIMIT but returns one DB response; backend result-size/storage behavior not established. Guest 20-score ceiling is distinct from Wishlist item count; no free competitor cap invented.",
      "externally_blocked_fact": null
    },
    {
      "record_id": "OP-618",
      "feature_id": "wishlist-capacity",
      "competitors": "Flickz",
      "product_ids": "flickz",
      "capability": "Unlimited watchlist",
      "source_free_behavior": "Free cap unknown.",
      "source_paid_behavior": "Premium explicitly unlimited.",
      "source_primary_urls": [
        "https://flickz.app/"
      ],
      "state": "Partial",
      "assessment": "Wishlist add/remove and paged reading are connected; code has no title-count paywall, but does not establish an unlimited service guarantee.",
      "implemented_subset": "Movie/show Wishlist, 60-item library pages with continuation; Watch next progressive cards.",
      "missing_subset": "Explicitly verified unlimited end-to-end item allowance.",
      "evidence_ids": [
        "E05",
        "E06",
        "E07",
        "E22"
      ],
      "limits": "Member data query has no explicit LIMIT but returns one DB response; backend result-size/storage behavior not established. Guest 20-score ceiling is distinct from Wishlist item count; no free competitor cap invented.",
      "externally_blocked_fact": null
    },
    {
      "record_id": "OP-040",
      "feature_id": "clone-lists",
      "competitors": "Letterboxd",
      "product_ids": "letterboxd",
      "capability": "List cloning",
      "source_free_behavior": "Own ordinary editing",
      "source_paid_behavior": "Clone own/others lists",
      "source_primary_urls": [
        "https://letterboxd.com/about/pro/"
      ],
      "state": "Partial",
      "assessment": "Remix independently copies own or another accessible top 5 list; general arbitrary-length list cloning is absent.",
      "implemented_subset": "Copy source title/prompt/entries/design/theme into a new five-title share list.",
      "missing_subset": "General variable-length list cloning.",
      "evidence_ids": [
        "E01",
        "E03"
      ],
      "limits": "Publication requires account and permanent handle; source must still resolve. Source unlisted link is accessible, not private authorization. Visible Remix button is for others; own-source copying works through the loader query, without a dedicated own-copy button.",
      "externally_blocked_fact": null
    },
    {
      "record_id": "OP-520",
      "feature_id": "clone-lists",
      "competitors": "MDBList / Reeel",
      "product_ids": "mdblist",
      "capability": "Clone/update list",
      "source_free_behavior": "No free/Basic allocation.",
      "source_paid_behavior": "Standard and above.",
      "source_primary_urls": [
        "https://docs.mdblist.com/docs/supporter",
        "https://mdblist.com/new-features/"
      ],
      "state": "Partial",
      "assessment": "Remix provides a one-time five-title copy; updating an owned copy is ordinary editing, not MDBList source clone/update parity.",
      "implemented_subset": "One-time Remix and independent five-title editor.",
      "missing_subset": "General/generated list clone plus source-driven update/refresh.",
      "evidence_ids": [
        "E01",
        "E03",
        "E04"
      ],
      "limits": "No linked refresh/synchronization operation; Standard+ vendor entitlement, Free/Basic none in supplied evidence.",
      "externally_blocked_fact": null
    },
    {
      "record_id": "OP-548",
      "feature_id": "clone-lists",
      "competitors": "Bingebase",
      "product_ids": "bingebase",
      "capability": "Copy another user’s list",
      "source_free_behavior": "Own-list duplication free.",
      "source_paid_behavior": "PRO copying others’ lists.",
      "source_primary_urls": [
        "https://bingebase.com/pro",
        "https://bingebase.com/roadmap/shipped"
      ],
      "state": "Partial",
      "assessment": "Remix independently copies own or another accessible top 5 list; general arbitrary-length list cloning is absent.",
      "implemented_subset": "Copy source title/prompt/entries/design/theme into a new five-title share list.",
      "missing_subset": "General variable-length list cloning.",
      "evidence_ids": [
        "E01",
        "E03"
      ],
      "limits": "Publication requires account and permanent handle; source must still resolve. Source unlisted link is accessible, not private authorization. Visible Remix button is for others; own-source copying works through the loader query, without a dedicated own-copy button.",
      "externally_blocked_fact": null
    },
    {
      "record_id": "OP-587",
      "feature_id": "clone-lists",
      "competitors": "WerStreamt.es",
      "product_ids": "werstreamt-es",
      "capability": "Duplicate own/public lists",
      "source_free_behavior": "Ordinary lists.",
      "source_paid_behavior": "Pro cloning.",
      "source_primary_urls": [
        "https://www.werstreamt.es/pro/",
        "https://www.werstreamt.es/"
      ],
      "state": "Partial",
      "assessment": "Remix independently copies own or another accessible top 5 list; general arbitrary-length list cloning is absent.",
      "implemented_subset": "Copy source title/prompt/entries/design/theme into a new five-title share list.",
      "missing_subset": "General variable-length list cloning.",
      "evidence_ids": [
        "E01",
        "E03"
      ],
      "limits": "Publication requires account and permanent handle; source must still resolve. Source unlisted link is accessible, not private authorization. Visible Remix button is for others; own-source copying works through the loader query, without a dedicated own-copy button.",
      "externally_blocked_fact": null
    },
    {
      "record_id": "OP-045",
      "feature_id": "organize-lists",
      "competitors": "Ryot",
      "product_ids": "ryot",
      "capability": "Collection placement",
      "source_free_behavior": "Ordinary collections",
      "source_paid_behavior": "Custom placement/personalization",
      "source_primary_urls": [
        "https://ryot.io/features/"
      ],
      "state": "Missing",
      "assessment": "Share-list rank changes positions of titles within one five-title list; it does not customize collection placement.",
      "implemented_subset": "Five-title rank order.",
      "missing_subset": "User-defined placement/personalization of collections.",
      "evidence_ids": [
        "E01",
        "E02",
        "E04"
      ],
      "limits": "Library statuses and profile list order are fixed/computed; no placement field in list/profile writer.",
      "externally_blocked_fact": null
    },
    {
      "record_id": "OP-047",
      "feature_id": "organize-lists",
      "competitors": "Sofa",
      "product_ids": "sofa",
      "capability": "Pin lists/items",
      "source_free_behavior": "Unlimited ordinary lists/groups",
      "source_paid_behavior": "Pinned lists/items",
      "source_primary_urls": [
        "https://www.sofahq.com/pricing"
      ],
      "state": "Missing",
      "assessment": "Owner list controls and stored model expose no list/item pin; rank 1 is not a persistent pin.",
      "implemented_subset": "Top 5 title drag order.",
      "missing_subset": "Pinned lists and pinned items.",
      "evidence_ids": [
        "E01",
        "E04"
      ],
      "limits": "No pin field or pin/unpin action in inspected editor/owner API.",
      "externally_blocked_fact": null
    },
    {
      "record_id": "OP-077",
      "feature_id": "organize-lists",
      "competitors": "Hobi",
      "product_ids": "hobi",
      "capability": "Advanced watchlist sorting",
      "source_free_behavior": "Ordinary ordering",
      "source_paid_behavior": "Advanced sorting",
      "source_primary_urls": [
        "https://hobiapp.com/help/what-hobi-premium-includes"
      ],
      "state": "Partial",
      "assessment": "Six concrete Wishlist sorts are present; vendor advanced-sort set is unspecified, so full same-controls parity cannot be asserted.",
      "implemented_subset": "Best match, Waiting longest, Last added, Newest, Top rated, Popular; library status-specific title/date/score sorts.",
      "missing_subset": "Any additional Hobi advanced comparator/control beyond the enumerated Goodwatch sorts.",
      "evidence_ids": [
        "E06",
        "E07"
      ],
      "limits": "Best match depends on taste; fallback/availability rules apply. Narrow assessed variant: choose one of six documented Wishlist orders = Have.",
      "externally_blocked_fact": null
    },
    {
      "record_id": "OP-583",
      "feature_id": "organize-lists",
      "competitors": "WerStreamt.es",
      "product_ids": "werstreamt-es",
      "capability": "List order and pinning",
      "source_free_behavior": "Ordinary lists.",
      "source_paid_behavior": "Pro ordering/pinning.",
      "source_primary_urls": [
        "https://www.werstreamt.es/pro/",
        "https://www.werstreamt.es/"
      ],
      "state": "Partial",
      "assessment": "Manual order exists inside a five-title list, while ordering lists themselves and pinning are absent.",
      "implemented_subset": "Drag and persist five title ranks.",
      "missing_subset": "General list/item ordering beyond top 5, list pinning.",
      "evidence_ids": [
        "E01",
        "E02",
        "E04"
      ],
      "limits": "Profile lists use newest-first; owner list reader updated-first. Neither is user placement.",
      "externally_blocked_fact": null,
      "variants": [
        {
          "vendor": "WerStreamt.es",
          "requirement": "Order five title ranks",
          "state": "Have",
          "scope": "Narrowed Goodwatch top 5 object only, not vendor general-list parity."
        },
        {
          "vendor": "WerStreamt.es",
          "requirement": "Pin lists / general list placement",
          "state": "Missing"
        }
      ]
    },
    {
      "record_id": "OP-042",
      "feature_id": "bulk-lists",
      "competitors": "Letterboxd",
      "product_ids": "letterboxd",
      "capability": "Bulk add visible films",
      "source_free_behavior": "Normal editing",
      "source_paid_behavior": "Web add-all to list/Watchlist",
      "source_primary_urls": [
        "https://letterboxd.com/about/pro-apps/"
      ],
      "state": "Partial",
      "assessment": "MCP can batch explicit Wishlist titles, but the web cannot add all films currently visible to arbitrary list or Watchlist.",
      "implemented_subset": "MCP add up to 50 explicit movie/show Wishlist selectors per call.",
      "missing_subset": "Web add-all-visible selection and general-list destination.",
      "evidence_ids": [
        "E01",
        "E09",
        "E23"
      ],
      "limits": "Authenticated configured MCP with write scope/tool policy;50/call,300 item-writes/min,2,000/hour; one batch/request.",
      "externally_blocked_fact": null
    },
    {
      "record_id": "OP-043",
      "feature_id": "bulk-lists",
      "competitors": "SIMKL",
      "product_ids": "simkl",
      "capability": "Bulk deletion",
      "source_free_behavior": "Ordinary editing",
      "source_paid_behavior": "Bulk deletion",
      "source_primary_urls": [
        "https://docs.simkl.org/how-to-use-simkl/account-and-billing/subscription-plans/pro"
      ],
      "state": "Partial",
      "assessment": "Batch removal is implemented for explicit Wishlist titles; no bulk deletion of arbitrary custom-list entries or multi-select web workflow.",
      "implemented_subset": "MCP Wishlist remove up to 50 titles per call.",
      "missing_subset": "General-list item bulk deletion and web selection controls.",
      "evidence_ids": [
        "E01",
        "E09",
        "E23"
      ],
      "limits": "Per-movie removeAll removes watches of one movie, not a generic multi-title list operation; same MCP budgets.",
      "externally_blocked_fact": null
    },
    {
      "record_id": "OP-062",
      "feature_id": "bulk-lists",
      "competitors": "Trakt",
      "product_ids": "trakt",
      "capability": "Season/episode entries and batch additions",
      "source_free_behavior": "Personal/community lists",
      "source_paid_behavior": "October season/episode entries and batch add",
      "source_primary_urls": [
        "https://roadmap.trakt.tv/changelog/rocket-trakt-product-update-october-2026"
      ],
      "state": "Partial",
      "assessment": "MCP batches title additions and marks episode ranges/seasons as watched; episodes/seasons cannot be stored as custom-list entries.",
      "implemented_subset": "Batch title Wishlist additions; independent season/episode tracking actions.",
      "missing_subset": "Season/episode list-entry identities and bulk additions to arbitrary personal/community lists.",
      "evidence_ids": [
        "E01",
        "E09"
      ],
      "limits": "Share-list parser movie/show only, exactly 5. Watch-log episode identity is not list-entry support.",
      "externally_blocked_fact": null
    },
    {
      "record_id": "OP-069",
      "feature_id": "tracked-capacity",
      "competitors": "Sofa",
      "product_ids": "sofa",
      "capability": "Concurrent tracked items",
      "source_free_behavior": "2 concurrent; lists unlimited",
      "source_paid_behavior": "Unlimited concurrent tracking advertised",
      "source_primary_urls": [
        "https://www.sofahq.com/pricing"
      ],
      "state": "Partial",
      "assessment": "Concurrent tracking of multiple movie/show titles exists without a two-title gate; Sofa also tracks other media and its unlimited claim is broader.",
      "implemented_subset": "Independent title watch states/logs, member library and next-episode groups.",
      "missing_subset": "Verified unbounded concurrent tracking and Sofa non-film/TV object modes.",
      "evidence_ids": [
        "E05",
        "E06",
        "E08",
        "E22"
      ],
      "limits": "No total-title guard in inspected writer. First 30 next-episode enrichment; history 200/movie and 20,000/show, not concurrent title caps.",
      "externally_blocked_fact": null
    },
    {
      "record_id": "OP-070",
      "feature_id": "tracked-capacity",
      "competitors": "Hobi",
      "product_ids": "hobi",
      "capability": "Movie capacity",
      "source_free_behavior": "Free cap exists; number unknown",
      "source_paid_behavior": "Unlimited movies advertised",
      "source_primary_urls": [
        "https://hobiapp.com/help/track-movies"
      ],
      "state": "Partial",
      "assessment": "Movie watch/score/Wishlist writes do not impose a visible free movie quota; unlimited end-to-end movie capacity is not proven.",
      "implemented_subset": "Independent movie tracking and paged library.",
      "missing_subset": "Verified unlimited movie allowance.",
      "evidence_ids": [
        "E05",
        "E06",
        "E08",
        "E22"
      ],
      "limits": "Hobi free number unknown; do not invent it or equate per-movie 200 log-read rows with number of tracked movies.",
      "externally_blocked_fact": null
    },
    {
      "record_id": "OP-071",
      "feature_id": "tracked-capacity",
      "competitors": "Next Episode",
      "product_ids": "next-episode",
      "capability": "Episodes screen capacity",
      "source_free_behavior": "50 shows at once; Watchlist total uncapped",
      "source_paid_behavior": "Removes view bound",
      "source_primary_urls": [
        "https://forum.next-episode.net/viewtopic.php?pid=190046"
      ],
      "state": "Partial",
      "assessment": "Goodwatch can show all returned tracked-show groups with expandable sections, but this is not an uncapped full Episodes screen.",
      "implemented_subset": "My shows groups, full status library and per-show episode matrix.",
      "missing_subset": "Full multi-show episode-detail display equivalent to removing Next Episode 50-show Episodes-screen bound.",
      "evidence_ids": [
        "E06",
        "E08"
      ],
      "limits": "Next Episode total Watchlist is already uncapped. Goodwatch next-episode enrichment first 30 Continue/Pick-up; Start 30 and Pick up 5 initial display, expandable.",
      "externally_blocked_fact": null
    },
    {
      "record_id": "OP-072",
      "feature_id": "tracked-capacity",
      "competitors": "Next Episode",
      "product_ids": "next-episode",
      "capability": "My Movies capacity",
      "source_free_behavior": "25 movies",
      "source_paid_behavior": "Removes My Movies bound",
      "source_primary_urls": [
        "https://forum.next-episode.net/viewtopic.php?pid=190046"
      ],
      "state": "Partial",
      "assessment": "My movies is a progressive Wishlist-movie view without a 25-title branch; uncapped My Movies allowance is not established.",
      "implemented_subset": "Movie Wishlist plan, card batches 60, paged Want-to-see movie library.",
      "missing_subset": "Verified unbounded movie view/service capacity.",
      "evidence_ids": [
        "E05",
        "E06",
        "E07"
      ],
      "limits": "No 25 gate; per-request 60 is not total capacity. Titles missing catalog data may not render; all-returned-data qualifier applies.",
      "externally_blocked_fact": null
    },
    {
      "record_id": "OP-456",
      "feature_id": "tracked-capacity",
      "competitors": "Television Time",
      "product_ids": "television-time",
      "capability": "Tracked-show allowance",
      "source_free_behavior": "New free users5 shows; grandfathered previous features retained.",
      "source_paid_behavior": "Plus explicitly unlimited shows; other caps unknown.",
      "source_primary_urls": [
        "https://apps.apple.com/us/app/television-time/id969714962",
        "https://televisiontime.app/changelog/"
      ],
      "state": "Partial",
      "assessment": "No five-show member entitlement guard; per-show tracking and library exist, but unlimited service capacity is not established.",
      "implemented_subset": "Independent movie/show states, show groups and 60-item library pages.",
      "missing_subset": "Verified unlimited tracked-show allowance.",
      "evidence_ids": [
        "E05",
        "E06",
        "E08"
      ],
      "limits": "Vendor grandfathering does not describe Goodwatch. No local paid/grandfathered 5-show split; history and enrichment bounds retained.",
      "externally_blocked_fact": null
    },
    {
      "record_id": "OP-464",
      "feature_id": "tracked-capacity",
      "competitors": "Movie Tracker — Simone Montalto",
      "product_ids": "movie-tracker-montalto",
      "capability": "Tracked-title allowance",
      "source_free_behavior": "Free5 titles.",
      "source_paid_behavior": "Pro unlimited items.",
      "source_primary_urls": [
        "https://apps.apple.com/us/app/id6443877426"
      ],
      "state": "Partial",
      "assessment": "No five-title member entitlement guard; tracking spans catalog movies/shows, without verified unlimited capacity.",
      "implemented_subset": "Independent titles and paged library.",
      "missing_subset": "Verified unlimited item allowance.",
      "evidence_ids": [
        "E05",
        "E06",
        "E08",
        "E22"
      ],
      "limits": "Guest scores 20; member title counts distinct from movie 200/show 20,000 per-title log-reader bounds.",
      "externally_blocked_fact": null
    },
    {
      "record_id": "OP-485",
      "feature_id": "tracked-capacity",
      "competitors": "TV Episode Calendar / EpisodeCalendar",
      "product_ids": "episodecalendar",
      "capability": "Tracked-show allowance",
      "source_free_behavior": "20 Active/Ended/Watch Later shows; archive excluded; existing users retain prior shows.",
      "source_paid_behavior": "Premium unlimited shows.",
      "source_primary_urls": [
        "https://episodecalendar.com/en/pages/features",
        "https://episodecalendar.com/en/pages/premium"
      ],
      "state": "Partial",
      "assessment": "Goodwatch tracks many independent shows without a 20-show check; archive-excluded counting cannot match because no archive state exists.",
      "implemented_subset": "Show states, Want to see and expandable library.",
      "missing_subset": "Verified unlimited shows and archive-excluded allowance semantics.",
      "evidence_ids": [
        "E05",
        "E06",
        "E08",
        "E10"
      ],
      "limits": "EpisodeCalendar 20 Active/Ended/Watch Later excludes Archived and has grandfathering; Goodwatch On hold/Dropped are not Archive.",
      "externally_blocked_fact": null
    },
    {
      "record_id": "OP-748",
      "feature_id": "tracked-capacity",
      "competitors": "WatchNext.app",
      "product_ids": "watchnext-app",
      "capability": "Separate show/movie tracking capacity",
      "source_free_behavior": "Free50 shows+50 movies.",
      "source_paid_behavior": "Premium100+100; Unlimited uncapped tracking. Homepage calls unlimited Premium; FAQ/terms distinguish tiers.",
      "source_primary_urls": [
        "https://watchnext.app/faq",
        "https://watchnext.app/terms"
      ],
      "state": "Partial",
      "assessment": "Movie/show keys and type filters exist, with no 50/100 per-kind gate. No explicit per-kind allowance guarantee or unbounded-capacity proof.",
      "implemented_subset": "Separate movie/show library filters/counts and multi-title tracking.",
      "missing_subset": "Verified end-to-end ability/allowance for the documented 100+100 boundary and an unlimited-tier equivalent; no claim that Goodwatch should impose those vendor paid caps.",
      "evidence_ids": [
        "E05",
        "E06",
        "E08"
      ],
      "limits": "Counts derived from returned maps; WatchNext Free 50+50/Premium 100+100/Unlimited unbounded. Homepage Premium wording conflicts with FAQ/terms; retain conflict.",
      "externally_blocked_fact": null,
      "variants": [
        {
          "vendor": "WatchNext.app",
          "requirement": "Premium 100 shows plus 100 movies",
          "state": "Partial"
        },
        {
          "vendor": "WatchNext.app",
          "requirement": "Unlimited tier tracked-title allowance",
          "state": "Partial"
        }
      ]
    },
    {
      "record_id": "OP-074",
      "feature_id": "diary-tools",
      "competitors": "Sofa",
      "product_ids": "sofa",
      "capability": "Advanced logbook filters",
      "source_free_behavior": "Logbook/date editing free",
      "source_paid_behavior": "Advanced filters",
      "source_primary_urls": [
        "https://www.sofahq.com/pricing"
      ],
      "state": "Missing",
      "assessment": "Editable per-title logs and last-watched title sorting are present; no global chronological logbook/filter surface.",
      "implemented_subset": "Per-title watch/date edit/delete and status/title library filters.",
      "missing_subset": "Cross-title chronological logbook with advanced occurrence filters.",
      "evidence_ids": [
        "E06",
        "E10"
      ],
      "limits": "Library deliberately does not read log;200 movie log read limit not a global diary allowance.",
      "externally_blocked_fact": null
    },
    {
      "record_id": "OP-076",
      "feature_id": "diary-tools",
      "competitors": "Hobi",
      "product_ids": "hobi",
      "capability": "Watchlist archive",
      "source_free_behavior": "Ordinary watchlist",
      "source_paid_behavior": "Archive",
      "source_primary_urls": [
        "https://hobiapp.com/help/what-hobi-premium-includes"
      ],
      "state": "Missing",
      "assessment": "Library On hold/Dropped provide show-state selection but no separate watchlist archive action or preserved archive membership.",
      "implemented_subset": "On hold/Dropped states and hidden-title controls for different jobs.",
      "missing_subset": "Watchlist Archive domain, action and view.",
      "evidence_ids": [
        "E06",
        "E10"
      ],
      "limits": "Not interested is filtering/exclusion, not Archive; account maintenance archival flags are unrelated.",
      "externally_blocked_fact": null
    },
    {
      "record_id": "OP-038",
      "feature_id": "privacy",
      "competitors": "SIMKL",
      "product_ids": "simkl",
      "capability": "Profile/favorites privacy",
      "source_free_behavior": "Public profile/favorites",
      "source_paid_behavior": "Public/unlisted/private",
      "source_primary_urls": [
        "https://docs.simkl.org/how-to-use-simkl/account-and-billing/subscription-plans/pro"
      ],
      "state": "Missing",
      "assessment": "Private session-owned personal data and unlisted top 5 links do not implement this vendor publication/privacy control.",
      "implemented_subset": "Session ownership for personal records; public/unlisted share-list links. ",
      "missing_subset": "Profile/favorites public–unlisted–private controls.",
      "evidence_ids": [
        "E11",
        "E12",
        "E14"
      ],
      "limits": "Unlisted URLs still render for anyone with link; private,no-store is cache policy. Public handle/profile has no hide switch; absent social fields are not hide controls.",
      "externally_blocked_fact": null
    },
    {
      "record_id": "OP-039",
      "feature_id": "privacy",
      "competitors": "MyShows",
      "product_ids": "myshows",
      "capability": "Hide profile/social fields",
      "source_free_behavior": "Ordinary public presentation",
      "source_paid_behavior": "Hide profile/social links/awards/friend list",
      "source_primary_urls": [
        "https://en.myshows.me/about/pro/"
      ],
      "state": "Missing",
      "assessment": "Private session-owned personal data and unlisted top 5 links do not implement this vendor publication/privacy control.",
      "implemented_subset": "Session ownership for personal records; public/unlisted share-list links. ",
      "missing_subset": "Hide profile/social links/awards/friend-list controls.",
      "evidence_ids": [
        "E11",
        "E12",
        "E14"
      ],
      "limits": "Unlisted URLs still render for anyone with link; private,no-store is cache policy. Public handle/profile has no hide switch; absent social fields are not hide controls.",
      "externally_blocked_fact": null
    },
    {
      "record_id": "OP-642",
      "feature_id": "privacy",
      "competitors": "iCollect Movies / iCollect Everything",
      "product_ids": "icollect",
      "capability": "Private-web catalog switch",
      "source_free_behavior": "Cloud sync is not a private-web switch.",
      "source_paid_behavior": "Pro private-web visibility control.",
      "source_primary_urls": [
        "https://www.icollecteverything.com/2024/10/26/heres-the-price-differences-and-breakdown-of-our-product-offerings/",
        "https://www.icollecteverything.com/support/"
      ],
      "state": "Missing",
      "assessment": "Private session-owned personal data and unlisted top 5 links do not implement this vendor publication/privacy control.",
      "implemented_subset": "Session ownership for personal records; public/unlisted share-list links. ",
      "missing_subset": "Owned catalog private-web publication switch.",
      "evidence_ids": [
        "E11",
        "E12",
        "E14"
      ],
      "limits": "Unlisted URLs still render for anyone with link; private,no-store is cache policy. Public handle/profile has no hide switch; absent social fields are not hide controls.",
      "externally_blocked_fact": null
    },
    {
      "record_id": "OP-653",
      "feature_id": "privacy",
      "competitors": "Libib",
      "product_ids": "libib",
      "capability": "Private and interactive published catalog",
      "source_free_behavior": "Basic media catalog.",
      "source_paid_behavior": "Pro private/interactive publication.",
      "source_primary_urls": [
        "https://www.libib.com/pricing",
        "https://support.libib.com/faqs.html",
        "https://support.libib.com/rest-api/introduction.html"
      ],
      "state": "Missing",
      "assessment": "Private session-owned personal data and unlisted top 5 links do not implement this vendor publication/privacy control.",
      "implemented_subset": "Session ownership for personal records; public/unlisted share-list links. ",
      "missing_subset": "Private and interactive published owned catalog.",
      "evidence_ids": [
        "E11",
        "E12",
        "E14"
      ],
      "limits": "Unlisted URLs still render for anyone with link; private,no-store is cache policy. Public handle/profile has no hide switch; absent social fields are not hide controls.",
      "externally_blocked_fact": null
    },
    {
      "record_id": "OP-180",
      "feature_id": "usernames",
      "competitors": "Letterboxd",
      "product_ids": "letterboxd",
      "capability": "Username change cadence",
      "source_free_behavior": "Free cadence unknown",
      "source_paid_behavior": "Web30 days/app help90 days",
      "source_primary_urls": [
        "https://letterboxd.com/about/pro/",
        "https://letterboxd.com/about/pro-apps/"
      ],
      "state": "Missing",
      "assessment": "The connected UI explicitly says permanent; the writer rejects attempts to rename an existing handle.",
      "implemented_subset": "Initial public-handle claim.",
      "missing_subset": "Public username change.",
      "evidence_ids": [
        "E12",
        "E13"
      ],
      "limits": "Letterboxd 30-day web vs 90-day app wording preserved for OP-180; Goodwatch has no cooldown because rename is refused.",
      "externally_blocked_fact": null
    },
    {
      "record_id": "OP-233",
      "feature_id": "usernames",
      "competitors": "MyShows",
      "product_ids": "myshows",
      "capability": "Username changes",
      "source_free_behavior": "Ordinary profile",
      "source_paid_behavior": "Change username",
      "source_primary_urls": [
        "https://en.myshows.me/about/pro/"
      ],
      "state": "Missing",
      "assessment": "The connected UI explicitly says permanent; the writer rejects attempts to rename an existing handle.",
      "implemented_subset": "Initial public-handle claim.",
      "missing_subset": "Public username change.",
      "evidence_ids": [
        "E12",
        "E13"
      ],
      "limits": "Letterboxd 30-day web vs 90-day app wording preserved for OP-180; Goodwatch has no cooldown because rename is refused.",
      "externally_blocked_fact": null
    },
    {
      "record_id": "OP-573",
      "feature_id": "usernames",
      "competitors": "Flickchart",
      "product_ids": "flickchart",
      "capability": "Username change",
      "source_free_behavior": "Baseline identity.",
      "source_paid_behavior": "FAQ names VIP username change.",
      "source_primary_urls": [
        "https://www.flickchart.com/vip",
        "https://www.flickchart.com/faq"
      ],
      "state": "Missing",
      "assessment": "The connected UI explicitly says permanent; the writer rejects attempts to rename an existing handle.",
      "implemented_subset": "Initial public-handle claim.",
      "missing_subset": "Public username change.",
      "evidence_ids": [
        "E12",
        "E13"
      ],
      "limits": "Letterboxd 30-day web vs 90-day app wording preserved for OP-180; Goodwatch has no cooldown because rename is refused.",
      "externally_blocked_fact": null
    },
    {
      "record_id": "OP-641",
      "feature_id": "usernames",
      "competitors": "iCollect Movies / iCollect Everything",
      "product_ids": "icollect",
      "capability": "Public username",
      "source_free_behavior": "Baseline identity.",
      "source_paid_behavior": "Pro1–24character public username.",
      "source_primary_urls": [
        "https://www.icollecteverything.com/2024/10/26/heres-the-price-differences-and-breakdown-of-our-product-offerings/",
        "https://www.icollecteverything.com/support/"
      ],
      "state": "Partial",
      "assessment": "Initial public-handle claim is connected, but valid strings and length differ from iCollect 1–24.",
      "implemented_subset": "Eligible lowercase public handles 3–24 characters within Goodwatch 3–30 rules.",
      "missing_subset": "1–2-character usernames and exact iCollect validation/rename semantics.",
      "evidence_ids": [
        "E12",
        "E13"
      ],
      "limits": "Letter-first alnum/underscore and reserved-name exclusions; permanent claim, no paid guard. Do not label every 1–24 username supported.",
      "externally_blocked_fact": null
    },
    {
      "record_id": "OP-637",
      "feature_id": "collection-search",
      "competitors": "iCollect Movies / iCollect Everything",
      "product_ids": "icollect",
      "capability": "Saved collection filters",
      "source_free_behavior": "Baseline search/filter.",
      "source_paid_behavior": "Pro saved filters.",
      "source_primary_urls": [
        "https://www.icollecteverything.com/2024/10/26/heres-the-price-differences-and-breakdown-of-our-product-offerings/",
        "https://www.icollecteverything.com/support/"
      ],
      "state": "Missing",
      "assessment": "URL filters over catalog title status/type/query cannot save an owned-collection filter object.",
      "implemented_subset": "Ephemeral/reloadable library query/sort/type URLs.",
      "missing_subset": "Named saved owned-collection filters.",
      "evidence_ids": [
        "E06",
        "E14"
      ],
      "limits": "Library q at most 100 chars; no saved-filter storage/list/manage API in inspected collection/library domain.",
      "externally_blocked_fact": null
    },
    {
      "record_id": "OP-645",
      "feature_id": "collection-search",
      "competitors": "iCollect Movies / iCollect Everything",
      "product_ids": "icollect",
      "capability": "Included AI scan credits",
      "source_free_behavior": "15free credits; replenishment unspecified.",
      "source_paid_behavior": "Pro100included; extra50/250/500credit packs separately purchased, prices unknown.",
      "source_primary_urls": [
        "https://www.icollecteverything.com/2024/10/26/heres-the-price-differences-and-breakdown-of-our-product-offerings/",
        "https://www.icollecteverything.com/support/"
      ],
      "state": "Missing",
      "assessment": "Catalog descriptive search/import matching is not scanning a media item/photo; no scanning workflow or credit ledger.",
      "implemented_subset": "Catalog title lookup and structured file imports are separate jobs.",
      "missing_subset": "AI collection scan input and metered credits/packs.",
      "evidence_ids": [
        "E14"
      ],
      "limits": "Vendor 15 free/100 Pro and 50/250/500 packs; replenishment unspecified. These are scan credits, not recommendation/search requests.",
      "externally_blocked_fact": null
    },
    {
      "record_id": "OP-652",
      "feature_id": "collection-search",
      "competitors": "Libib",
      "product_ids": "libib",
      "capability": "Cross-collection search and reports",
      "source_free_behavior": "Basic collection tools/stats.",
      "source_paid_behavior": "Pro cross-collection search/reports.",
      "source_primary_urls": [
        "https://www.libib.com/pricing",
        "https://support.libib.com/faqs.html",
        "https://support.libib.com/rest-api/introduction.html"
      ],
      "state": "Missing",
      "assessment": "Catalog franchise lookup and status/type title search are not search/reporting across user-owned collections.",
      "implemented_subset": "Catalog collections and title library search.",
      "missing_subset": "Cross-owned-collection search/reports.",
      "evidence_ids": [
        "E06",
        "E14"
      ],
      "limits": "No owned edition/collection model, report parameters or result domain in inspected consumer paths.",
      "externally_blocked_fact": null
    },
    {
      "record_id": "OP-173",
      "feature_id": "artwork",
      "competitors": "Letterboxd",
      "product_ids": "letterboxd",
      "capability": "Custom title poster",
      "source_free_behavior": "Default; Pro no custom entitlement",
      "source_paid_behavior": "Poster per title/profile/favorites/diary/review/list",
      "source_primary_urls": [
        "https://letterboxd.com/about/pro/"
      ],
      "state": "Missing",
      "assessment": "The inspected title/list/profile inputs consume catalog images and contain no user artwork override or upload path for this object.",
      "implemented_subset": "Catalog artwork; localized poster selection is separately supported. ",
      "missing_subset": "User-selected title posters across title/profile/favorites/diary/review/list contexts.",
      "evidence_ids": [
        "E01",
        "E14",
        "E16",
        "E17"
      ],
      "limits": "Catalog/localized posters are automatic; no per-viewer title image override or profile/diary/review/list poster selector is stored.",
      "externally_blocked_fact": null
    },
    {
      "record_id": "OP-174",
      "feature_id": "artwork",
      "competitors": "Letterboxd",
      "product_ids": "letterboxd",
      "capability": "Custom backdrops",
      "source_free_behavior": "Default",
      "source_paid_behavior": "Backdrop choices",
      "source_primary_urls": [
        "https://letterboxd.com/about/pro/"
      ],
      "state": "Missing",
      "assessment": "The inspected title/list/profile inputs consume catalog images and contain no user artwork override or upload path for this object.",
      "implemented_subset": "Catalog artwork; localized poster selection is separately supported. ",
      "missing_subset": "User-selected backdrops.",
      "evidence_ids": [
        "E01",
        "E14",
        "E16",
        "E17"
      ],
      "limits": "Hero backdrop reads catalog backdrop_path; no preferred backdrop image ID/path in user or list inputs.",
      "externally_blocked_fact": null
    },
    {
      "record_id": "OP-175",
      "feature_id": "artwork",
      "competitors": "Letterboxd",
      "product_ids": "letterboxd",
      "capability": "Cast/crew image",
      "source_free_behavior": "Default",
      "source_paid_behavior": "Preferred person image",
      "source_primary_urls": [
        "https://letterboxd.com/about/pro-apps/"
      ],
      "state": "Missing",
      "assessment": "The person query supplies one catalog portrait to the connected Portrait renderer; no member preferred-image selection is stored or offered.",
      "implemented_subset": "Catalog artwork; localized poster selection is separately supported. ",
      "missing_subset": "Preferred cast/crew portrait.",
      "evidence_ids": [
        "E01",
        "E14",
        "E16",
        "E17"
      ],
      "limits": "Person portrait reads person.profile_path, with an initial fallback; no preferred-person-image writer.",
      "externally_blocked_fact": null
    },
    {
      "record_id": "OP-176",
      "feature_id": "artwork",
      "competitors": "BingeBoxd",
      "product_ids": "bingeboxd",
      "capability": "Episode image",
      "source_free_behavior": "Default",
      "source_paid_behavior": "Choose episode image",
      "source_primary_urls": [
        "https://apps.apple.com/us/app/id6749491360"
      ],
      "state": "Missing",
      "assessment": "The episode reader supplies its canonical catalog still and the connected episode panel renders/reveals it; no replacement-image choice is stored or offered.",
      "implemented_subset": "Catalog artwork; localized poster selection is separately supported. ",
      "missing_subset": "Chosen episode image.",
      "evidence_ids": [
        "E01",
        "E14",
        "E16",
        "E17"
      ],
      "limits": "EpisodeList renders the catalog still supplied by show tracking. Reveal spoiler image shows that still; it does not choose a replacement.",
      "externally_blocked_fact": null
    },
    {
      "record_id": "OP-177",
      "feature_id": "artwork",
      "competitors": "Showly",
      "product_ids": "showly",
      "capability": "Gallery/URL posters and fanart",
      "source_free_behavior": "Default",
      "source_paid_behavior": "Custom artwork",
      "source_primary_urls": [
        "https://github.com/trakt/showly/blob/master/ui-premium/src/main/res/values/strings.xml",
        "https://github.com/trakt/showly/blob/e08cb90ba0205ed9401a11265b912b0302f253b5/ui-premium/src/main/res/values/strings.xml"
      ],
      "state": "Missing",
      "assessment": "The inspected title/list/profile inputs consume catalog images and contain no user artwork override or upload path for this object.",
      "implemented_subset": "Catalog artwork; localized poster selection is separately supported. ",
      "missing_subset": "Gallery/URL posters and fanart.",
      "evidence_ids": [
        "E01",
        "E14",
        "E16",
        "E17"
      ],
      "limits": "List and user inputs have no gallery file or external artwork URL. Language-localized posters do not provide arbitrary gallery/URL fanart.",
      "externally_blocked_fact": null
    },
    {
      "record_id": "OP-178",
      "feature_id": "artwork",
      "competitors": "Sofa",
      "product_ids": "sofa",
      "capability": "List covers/layouts",
      "source_free_behavior": "Ordinary lists",
      "source_paid_behavior": "Custom covers/layouts",
      "source_primary_urls": [
        "https://www.sofahq.com/pricing"
      ],
      "state": "Partial",
      "assessment": "Custom presentation exists for a five-title share card, not a user-uploaded cover or general Sofa list layout.",
      "implemented_subset": "Choose 15 card designs and 7 colors; public list tiles use selected design.",
      "missing_subset": "Arbitrary list cover upload/selection and layouts for variable-length/private collections.",
      "evidence_ids": [
        "E01",
        "E15",
        "E16"
      ],
      "limits": "Narrow Have: choose generated top 5 card design/color. Covers use catalog artwork; no custom image URL stored.",
      "externally_blocked_fact": null
    },
    {
      "record_id": "OP-179",
      "feature_id": "artwork",
      "competitors": "SIMKL",
      "product_ids": "simkl",
      "capability": "Favorites background",
      "source_free_behavior": "Ordinary public favorites",
      "source_paid_behavior": "Background customization",
      "source_primary_urls": [
        "https://docs.simkl.org/how-to-use-simkl/account-and-billing/subscription-plans/pro"
      ],
      "state": "Missing",
      "assessment": "Public favorites background customization has no destination: profile renders share lists and a derived catalog backdrop, without a public favorites view.",
      "implemented_subset": "Catalog artwork; localized poster selection is separately supported. ",
      "missing_subset": "Public favorites background customization.",
      "evidence_ids": [
        "E01",
        "E14",
        "E16",
        "E17"
      ],
      "limits": "Public profile has share lists, not a favorites-background configuration or categorized favorites renderer.",
      "externally_blocked_fact": null
    },
    {
      "record_id": "OP-235",
      "feature_id": "artwork",
      "competitors": "Suite TV",
      "product_ids": "suite-tv",
      "capability": "Title posters",
      "source_free_behavior": "Functional core free",
      "source_paid_behavior": "Custom posters",
      "source_primary_urls": [
        "https://www.suitetv.app/en/about"
      ],
      "state": "Missing",
      "assessment": "The inspected title/list/profile inputs consume catalog images and contain no user artwork override or upload path for this object.",
      "implemented_subset": "Catalog artwork; localized poster selection is separately supported. ",
      "missing_subset": "Custom title poster override.",
      "evidence_ids": [
        "E01",
        "E14",
        "E16",
        "E17"
      ],
      "limits": "Suite TV custom title poster requires a selected override; Goodwatch supplies catalog/localized poster without an override field.",
      "externally_blocked_fact": null
    },
    {
      "record_id": "OP-240",
      "feature_id": "artwork",
      "competitors": "CLZ Movies",
      "product_ids": "clz-movies",
      "capability": "Own cover images",
      "source_free_behavior": "Trial; no permanent free editable tier",
      "source_paid_behavior": "Front/back covers",
      "source_primary_urls": [
        "https://clz.com/movies/mobile",
        "https://clz.com/movies/web",
        "https://club.clz.com/t/feature-request-add-links-to-export-options/1662"
      ],
      "state": "Missing",
      "assessment": "The inspected title/list/profile inputs consume catalog images and contain no user artwork override or upload path for this object.",
      "implemented_subset": "Catalog artwork; localized poster selection is separately supported. ",
      "missing_subset": "Owned item front/back cover images.",
      "evidence_ids": [
        "E01",
        "E14",
        "E16",
        "E17"
      ],
      "limits": "No owned edition, front-cover/back-cover pair or upload storage exists in the inspected movie/show title library.",
      "externally_blocked_fact": null
    },
    {
      "record_id": "OP-546",
      "feature_id": "artwork",
      "competitors": "Bingebase",
      "product_ids": "bingebase",
      "capability": "Custom backdrops",
      "source_free_behavior": "Free own-view poster swaps; not public list artwork.",
      "source_paid_behavior": "PRO backdrops.",
      "source_primary_urls": [
        "https://bingebase.com/pro",
        "https://bingebase.com/roadmap/shipped"
      ],
      "state": "Missing",
      "assessment": "The inspected title/list/profile inputs consume catalog images and contain no user artwork override or upload path for this object.",
      "implemented_subset": "Catalog artwork; localized poster selection is separately supported. ",
      "missing_subset": "Custom backdrop override.",
      "evidence_ids": [
        "E01",
        "E14",
        "E16",
        "E17"
      ],
      "limits": "Catalog backdrop and derived profile backdrop are automatic, without a user-selected backdrop override.",
      "externally_blocked_fact": null
    },
    {
      "record_id": "OP-547",
      "feature_id": "artwork",
      "competitors": "Bingebase",
      "product_ids": "bingebase",
      "capability": "Public list artwork",
      "source_free_behavior": "Own-view poster swaps free.",
      "source_paid_behavior": "PRO publicly visible list artwork.",
      "source_primary_urls": [
        "https://bingebase.com/pro",
        "https://bingebase.com/roadmap/shipped"
      ],
      "state": "Partial",
      "assessment": "A public five-title list has a customizable generated image/design; this differs from public per-title poster/backdrop overrides.",
      "implemented_subset": "Public share-list card design/color seen by viewers.",
      "missing_subset": "Public custom source artwork for list items and arbitrary list artwork override.",
      "evidence_ids": [
        "E01",
        "E15",
        "E16"
      ],
      "limits": "Bingebase own-view poster swap is free; public artwork is PRO. Do not use Goodwatch localized posters to claim shared override parity.",
      "externally_blocked_fact": null
    },
    {
      "record_id": "OP-567",
      "feature_id": "artwork",
      "competitors": "Flickchart",
      "product_ids": "flickchart",
      "capability": "Poster language/text preferences",
      "source_free_behavior": "Baseline posters.",
      "source_paid_behavior": "VIP preferences.",
      "source_primary_urls": [
        "https://www.flickchart.com/vip",
        "https://www.flickchart.com/faq"
      ],
      "state": "Partial",
      "assessment": "Language-selected catalog posters exist through Show titles in; no independent with-text/textless preference.",
      "implemented_subset": "Localized poster language via saved/browser media-language preference.",
      "missing_subset": "Independent poster text preference and per-user preferred artwork choice.",
      "evidence_ids": [
        "E16",
        "E17"
      ],
      "limits": "Fallback canonical poster when suitable translation absent; source wording language/text combines two jobs. Narrow poster-language preference = Have.",
      "externally_blocked_fact": null,
      "variants": [
        {
          "vendor": "Flickchart",
          "requirement": "Preferred poster language",
          "state": "Have",
          "scope": "Saved media-language preference selects localized catalog poster, fallback when absent."
        },
        {
          "vendor": "Flickchart",
          "requirement": "Independent poster text/with-text preference",
          "state": "Missing"
        }
      ]
    },
    {
      "record_id": "OP-634",
      "feature_id": "artwork",
      "competitors": "iCollect Movies / iCollect Everything",
      "product_ids": "icollect",
      "capability": "Images per item",
      "source_free_behavior": "Baseline image allowance unspecified.",
      "source_paid_behavior": "Pro up to10images/item; images not exportable.",
      "source_primary_urls": [
        "https://www.icollecteverything.com/2024/10/26/heres-the-price-differences-and-breakdown-of-our-product-offerings/",
        "https://www.icollecteverything.com/support/"
      ],
      "state": "Missing",
      "assessment": "The inspected title/list/profile inputs consume catalog images and contain no user artwork override or upload path for this object.",
      "implemented_subset": "Catalog artwork; localized poster selection is separately supported. ",
      "missing_subset": "Up to 10 stored user images per collection item.",
      "evidence_ids": [
        "E01",
        "E14",
        "E16",
        "E17"
      ],
      "limits": "No per-item image collection exists. Vendor Pro allows up to 10 images/item and says images are not exportable; that limitation is retained, not mapped to Goodwatch catalog-image URLs.",
      "externally_blocked_fact": null
    },
    {
      "record_id": "OP-184",
      "feature_id": "themes",
      "competitors": "MyAnimeList",
      "product_ids": "myanimelist",
      "capability": "Status-bar colors",
      "source_free_behavior": "Default",
      "source_paid_behavior": "Custom colors",
      "source_primary_urls": [
        "https://myanimelist.net/membership"
      ],
      "state": "Missing",
      "assessment": "No corresponding app/profile/widget/detail/video appearance preference is connected in the inspected settings/rendering domain.",
      "implemented_subset": "Fixed site styling and separate selectable share-card designs/colors. ",
      "missing_subset": "MAL profile-list status-bar color choices.",
      "evidence_ids": [
        "E15",
        "E18",
        "E19"
      ],
      "limits": "Profile has no MAL-style favorite/status list bars or status-bar color setting; shared-list accent is a different presentation object.",
      "externally_blocked_fact": null
    },
    {
      "record_id": "OP-186",
      "feature_id": "themes",
      "competitors": "Sofa",
      "product_ids": "sofa",
      "capability": "Themes",
      "source_free_behavior": "Default",
      "source_paid_behavior": "100+ themes",
      "source_primary_urls": [
        "https://www.sofahq.com/pricing"
      ],
      "state": "Missing",
      "assessment": "No corresponding app/profile/widget/detail/video appearance preference is connected in the inspected settings/rendering domain.",
      "implemented_subset": "Fixed site styling and separate selectable share-card designs/colors. ",
      "missing_subset": "100+ app themes.",
      "evidence_ids": [
        "E15",
        "E18",
        "E19"
      ],
      "limits": "Seven share-card colors are not 100+ app themes; there is no app theme chooser in validated settings.",
      "externally_blocked_fact": null
    },
    {
      "record_id": "OP-189",
      "feature_id": "themes",
      "competitors": "Showly; Next Episode",
      "product_ids": "showly;next-episode",
      "capability": "Light/dark paid control",
      "source_free_behavior": "Base theme",
      "source_paid_behavior": "Showly light; Next Episode dark",
      "source_primary_urls": [
        "https://play.google.com/store/apps/details?hl=en&id=com.michaldrabik.showly2",
        "https://next-episode.net/premium",
        "https://github.com/trakt/showly/blob/e08cb90ba0205ed9401a11265b912b0302f253b5/ui-premium/src/main/res/values/strings.xml"
      ],
      "state": "Missing",
      "assessment": "No corresponding app/profile/widget/detail/video appearance preference is connected in the inspected settings/rendering domain.",
      "implemented_subset": "Fixed site styling and separate selectable share-card designs/colors. ",
      "missing_subset": "Showly light and Next Episode dark user-selectable modes.",
      "evidence_ids": [
        "E15",
        "E18",
        "E19"
      ],
      "limits": "Showly light and Next Episode dark require selectable controls. A fixed dark site does not fulfill either mode-switch entitlement.",
      "externally_blocked_fact": null,
      "variants": [
        {
          "vendor": "Showly",
          "requirement": "Selectable light theme",
          "state": "Missing"
        },
        {
          "vendor": "Next Episode",
          "requirement": "Selectable dark theme",
          "state": "Missing"
        }
      ]
    },
    {
      "record_id": "OP-190",
      "feature_id": "themes",
      "competitors": "Showly",
      "product_ids": "showly",
      "capability": "Compact/grid layouts",
      "source_free_behavior": "Ordinary collection",
      "source_paid_behavior": "Compact/grid source strings",
      "source_primary_urls": [
        "https://github.com/trakt/showly/blob/master/ui-premium/src/main/res/values/strings.xml",
        "https://github.com/trakt/showly/blob/e08cb90ba0205ed9401a11265b912b0302f253b5/ui-premium/src/main/res/values/strings.xml"
      ],
      "state": "Missing",
      "assessment": "No corresponding app/profile/widget/detail/video appearance preference is connected in the inspected settings/rendering domain.",
      "implemented_subset": "Fixed site styling and separate selectable share-card designs/colors. ",
      "missing_subset": "Showly compact/grid collection layout choice.",
      "evidence_ids": [
        "E15",
        "E18",
        "E19"
      ],
      "limits": "My library uses fixed status/type/search/sort controls and row rendering, without a user-selected compact/grid collection layout.",
      "externally_blocked_fact": null
    },
    {
      "record_id": "OP-191",
      "feature_id": "themes",
      "competitors": "Cinexplore",
      "product_ids": "cinexplore",
      "capability": "Reorder rating/synopsis sections",
      "source_free_behavior": "Default detail layout",
      "source_paid_behavior": "Reorder movie/show/season/episode detail sections",
      "source_primary_urls": [
        "https://play.google.com/store/apps/details?hl=en_SG&id=com.fidloo.cinexplore"
      ],
      "state": "Missing",
      "assessment": "No corresponding app/profile/widget/detail/video appearance preference is connected in the inspected settings/rendering domain.",
      "implemented_subset": "Fixed site styling and separate selectable share-card designs/colors. ",
      "missing_subset": "Reordering detail-page rating/synopsis sections.",
      "evidence_ids": [
        "E15",
        "E18",
        "E19"
      ],
      "limits": "Detail-content sections are in fixed source order; no user section-order preference or reorder action.",
      "externally_blocked_fact": null
    },
    {
      "record_id": "OP-236",
      "feature_id": "themes",
      "competitors": "Suite TV",
      "product_ids": "suite-tv",
      "capability": "App themes/icons",
      "source_free_behavior": "Functional core free",
      "source_paid_behavior": "Themes/accent colors/icons",
      "source_primary_urls": [
        "https://www.suitetv.app/en/about"
      ],
      "state": "Missing",
      "assessment": "No corresponding app/profile/widget/detail/video appearance preference is connected in the inspected settings/rendering domain.",
      "implemented_subset": "Fixed site styling and separate selectable share-card designs/colors. ",
      "missing_subset": "Suite TV app themes/accent colors/icon choices.",
      "evidence_ids": [
        "E15",
        "E18",
        "E19"
      ],
      "limits": "Card colors do not change app accent/theme and static PWA assets do not provide selectable app icons; all three subcontrols Missing.",
      "externally_blocked_fact": null,
      "variants": [
        {
          "vendor": "Suite TV",
          "requirement": "Selectable app theme",
          "state": "Missing"
        },
        {
          "vendor": "Suite TV",
          "requirement": "Selectable accent color",
          "state": "Missing"
        },
        {
          "vendor": "Suite TV",
          "requirement": "Alternate app icon",
          "state": "Missing"
        }
      ]
    },
    {
      "record_id": "OP-349",
      "feature_id": "themes",
      "competitors": "CineTrak",
      "product_ids": "cinetrak",
      "capability": "Premium color themes including AMOLED Black",
      "source_free_behavior": "Base theme access unspecified.",
      "source_paid_behavior": "One-time Premium theme access confirmed by attributable developer announcement. Complete cosmetic set unknown.",
      "source_primary_urls": [
        "https://www.reddit.com/r/cinetrak/comments/1wfkver/cinetrak_is_back/"
      ],
      "state": "Missing",
      "assessment": "No corresponding app/profile/widget/detail/video appearance preference is connected in the inspected settings/rendering domain.",
      "implemented_subset": "Fixed site styling and separate selectable share-card designs/colors. ",
      "missing_subset": "CineTrak Premium color/AMOLED Black theme selection.",
      "evidence_ids": [
        "E15",
        "E18",
        "E19"
      ],
      "limits": "No app palette or AMOLED Black selector. The vendor one-time Premium theme evidence does not establish a complete theme inventory.",
      "externally_blocked_fact": null
    },
    {
      "record_id": "OP-395",
      "feature_id": "themes",
      "competitors": "StreamGuide (Christian Krueger)",
      "product_ids": "streamguide-krueger",
      "capability": "Custom themes",
      "source_free_behavior": "Free cosmetic set unknown.",
      "source_paid_behavior": "Older guide explicitly Premium themes; current FAQ omits benefit.",
      "source_primary_urls": [
        "https://streamguide.app/faq",
        "https://streamguide.app/resources/getting-started-with-streamguide"
      ],
      "state": "Missing",
      "assessment": "No corresponding app/profile/widget/detail/video appearance preference is connected in the inspected settings/rendering domain.",
      "implemented_subset": "Fixed site styling and separate selectable share-card designs/colors. ",
      "missing_subset": "StreamGuide Premium theme selector.",
      "evidence_ids": [
        "E15",
        "E18",
        "E19"
      ],
      "limits": "Older StreamGuide guide names Premium themes; current FAQ omits the benefit. That contradiction remains; narrowed Goodwatch theme-selector control is absent.",
      "externally_blocked_fact": null
    },
    {
      "record_id": "OP-442",
      "feature_id": "themes",
      "competitors": "Stremio",
      "product_ids": "stremio",
      "capability": "Appearance customization",
      "source_free_behavior": "Baseline customization unspecified.",
      "source_paid_behavior": "Supporter appearance choices; precise app-platform equivalence unverified.",
      "source_primary_urls": [
        "https://www.stremio.com/plans"
      ],
      "state": "Missing",
      "assessment": "No corresponding app/profile/widget/detail/video appearance preference is connected in the inspected settings/rendering domain.",
      "implemented_subset": "Fixed site styling and separate selectable share-card designs/colors. ",
      "missing_subset": "Stremio supporter appearance controls.",
      "evidence_ids": [
        "E15",
        "E18",
        "E19"
      ],
      "limits": "Vendor appearance controls/platform equivalence remain unspecified. Narrow assessed variant: selectable app appearance setting is Missing in this code; do not infer the vendor full hidden control set.",
      "externally_blocked_fact": null
    },
    {
      "record_id": "OP-462",
      "feature_id": "themes",
      "competitors": "Television Time",
      "product_ids": "television-time",
      "capability": "Custom widget tint",
      "source_free_behavior": "Widgets generally advertised.",
      "source_paid_behavior": "Changelog Plus custom tint.",
      "source_primary_urls": [
        "https://apps.apple.com/us/app/television-time/id969714962",
        "https://televisiontime.app/changelog/"
      ],
      "state": "Missing",
      "assessment": "No corresponding app/profile/widget/detail/video appearance preference is connected in the inspected settings/rendering domain.",
      "implemented_subset": "Fixed site styling and separate selectable share-card designs/colors. ",
      "missing_subset": "Television Time widget tint setting.",
      "evidence_ids": [
        "E15",
        "E18",
        "E19"
      ],
      "limits": "No home-screen widget implementation/tint preference in this web consumer. Card accent colors do not customize a system widget.",
      "externally_blocked_fact": null
    },
    {
      "record_id": "OP-482",
      "feature_id": "themes",
      "competitors": "TV Show & Movie Tracker / TVST (Jonathan ANTOINE)",
      "product_ids": "tvst-antoine",
      "capability": "UI customization",
      "source_free_behavior": "Default UI free.",
      "source_paid_behavior": "Explicit Customize UI SKU; exact controls unknown.",
      "source_primary_urls": [
        "https://apps.apple.com/us/app/id1228141510",
        "https://apps.apple.com/fr/app/tv-shows-movies-tracker/id1228141510"
      ],
      "state": "Missing",
      "assessment": "No corresponding app/profile/widget/detail/video appearance preference is connected in the inspected settings/rendering domain.",
      "implemented_subset": "Fixed site styling and separate selectable share-card designs/colors. ",
      "missing_subset": "TVST Customize UI SKU controls.",
      "evidence_ids": [
        "E15",
        "E18",
        "E19"
      ],
      "limits": "TVST Customize UI SKU is documented but exact controls unknown. Narrow assessed variant: saved user-controlled app appearance/layout is Missing.",
      "externally_blocked_fact": null
    },
    {
      "record_id": "OP-549",
      "feature_id": "themes",
      "competitors": "Bingebase",
      "product_ids": "bingebase",
      "capability": "Broader themes",
      "source_free_behavior": "Six colors plus Noir free.",
      "source_paid_behavior": "PRO additional themes.",
      "source_primary_urls": [
        "https://bingebase.com/pro",
        "https://bingebase.com/roadmap/shipped"
      ],
      "state": "Missing",
      "assessment": "No corresponding app/profile/widget/detail/video appearance preference is connected in the inspected settings/rendering domain.",
      "implemented_subset": "Fixed site styling and separate selectable share-card designs/colors. ",
      "missing_subset": "Bingebase additional app theme set.",
      "evidence_ids": [
        "E15",
        "E18",
        "E19"
      ],
      "limits": "Vendor six free colors plus Noir and additional PRO themes are app appearance. Goodwatch seven card themes have a different scope.",
      "externally_blocked_fact": null
    },
    {
      "record_id": "OP-597",
      "feature_id": "themes",
      "competitors": "AlloCiné",
      "product_ids": "allocine",
      "capability": "Video preferences",
      "source_free_behavior": "Base preferences unspecified.",
      "source_paid_behavior": "Premium video preferences.",
      "source_primary_urls": [
        "https://apps.apple.com/fr/app/allocin%C3%A9-cin%C3%A9ma-s%C3%A9ries-vod/id351184863"
      ],
      "state": "Missing",
      "assessment": "No corresponding app/profile/widget/detail/video appearance preference is connected in the inspected settings/rendering domain.",
      "implemented_subset": "Fixed site styling and separate selectable share-card designs/colors. ",
      "missing_subset": "AlloCiné video preferences.",
      "evidence_ids": [
        "E15",
        "E18",
        "E19"
      ],
      "limits": "Clip/type selection and click-to-play are transient component state; no saved video-preference control. Vendor exact preference controls are unspecified.",
      "externally_blocked_fact": null
    },
    {
      "record_id": "OP-644",
      "feature_id": "themes",
      "competitors": "iCollect Movies / iCollect Everything",
      "product_ids": "icollect",
      "capability": "Additional themes and manual light/dark",
      "source_free_behavior": "Baseline themes.",
      "source_paid_behavior": "Pro26additional themes per publisher and manual dark/light.",
      "source_primary_urls": [
        "https://www.icollecteverything.com/2024/10/26/heres-the-price-differences-and-breakdown-of-our-product-offerings/",
        "https://www.icollecteverything.com/support/"
      ],
      "state": "Missing",
      "assessment": "No corresponding app/profile/widget/detail/video appearance preference is connected in the inspected settings/rendering domain.",
      "implemented_subset": "Fixed site styling and separate selectable share-card designs/colors. ",
      "missing_subset": "iCollect 26 additional themes and manual light/dark.",
      "evidence_ids": [
        "E15",
        "E18",
        "E19"
      ],
      "limits": "No manual light/dark switch or additional app theme inventory; vendor 26 additional themes does not describe card design count.",
      "externally_blocked_fact": null
    },
    {
      "record_id": "OP-187",
      "feature_id": "icons",
      "competitors": "Sofa",
      "product_ids": "sofa",
      "capability": "App icons",
      "source_free_behavior": "Default",
      "source_paid_behavior": "70+ icons",
      "source_primary_urls": [
        "https://www.sofahq.com/pricing"
      ],
      "state": "Missing",
      "assessment": "The installation icon assets are fixed; no alternate-icon selection/persistence or native platform switch.",
      "implemented_subset": "Static favicon/apple-touch/PWA icon assets.",
      "missing_subset": "User-selectable alternate app icons.",
      "evidence_ids": [
        "E18"
      ],
      "limits": "Sofa advertises 70+ icons; Goodwatch fixed PWA/favicon files expose no user-selectable alternatives.",
      "externally_blocked_fact": null
    },
    {
      "record_id": "OP-188",
      "feature_id": "icons",
      "competitors": "Sequel; FilmNoir; Letterboxd",
      "product_ids": "sequel;filmnoir;letterboxd",
      "capability": "Alternate icons",
      "source_free_behavior": "Default",
      "source_paid_behavior": "Alternate icons; Letterboxd iOS,Android coming soon",
      "source_primary_urls": [
        "https://apps.apple.com/us/app/sequel-media-tracker/id1630746993",
        "https://www.filmnoir.app/",
        "https://letterboxd.com/about/pro-apps/"
      ],
      "state": "Missing",
      "assessment": "The installation icon assets are fixed; no alternate-icon selection/persistence or native platform switch.",
      "implemented_subset": "Static favicon/apple-touch/PWA icon assets.",
      "missing_subset": "User-selectable alternate app icons.",
      "evidence_ids": [
        "E18"
      ],
      "limits": "All three vendor subvariants Missing. Letterboxd cited entitlement is iOS with Android coming soon; no platform availability assumption carried into Goodwatch.",
      "externally_blocked_fact": null,
      "variants": [
        {
          "vendor": "Sequel",
          "requirement": "Alternate app icons",
          "state": "Missing"
        },
        {
          "vendor": "FilmNoir",
          "requirement": "Alternate app icons",
          "state": "Missing"
        },
        {
          "vendor": "Letterboxd",
          "requirement": "Alternate icons on iOS; Android coming soon in cited evidence",
          "state": "Missing"
        }
      ]
    },
    {
      "record_id": "OP-460",
      "feature_id": "icons",
      "competitors": "Television Time",
      "product_ids": "television-time",
      "capability": "Additional app icons",
      "source_free_behavior": "Base icon choices unspecified.",
      "source_paid_behavior": "Plus additional icons.",
      "source_primary_urls": [
        "https://apps.apple.com/us/app/television-time/id969714962",
        "https://televisiontime.app/changelog/"
      ],
      "state": "Missing",
      "assessment": "The installation icon assets are fixed; no alternate-icon selection/persistence or native platform switch.",
      "implemented_subset": "Static favicon/apple-touch/PWA icon assets.",
      "missing_subset": "User-selectable alternate app icons.",
      "evidence_ids": [
        "E18"
      ],
      "limits": "Television Time Plus extra icons require a chooser; Goodwatch static installation assets are not that chooser.",
      "externally_blocked_fact": null
    },
    {
      "record_id": "OP-598",
      "feature_id": "icons",
      "competitors": "AlloCiné",
      "product_ids": "allocine",
      "capability": "App icon choice",
      "source_free_behavior": "Default icon.",
      "source_paid_behavior": "Premium icon choice.",
      "source_primary_urls": [
        "https://apps.apple.com/fr/app/allocin%C3%A9-cin%C3%A9ma-s%C3%A9ries-vod/id351184863"
      ],
      "state": "Missing",
      "assessment": "The installation icon assets are fixed; no alternate-icon selection/persistence or native platform switch.",
      "implemented_subset": "Static favicon/apple-touch/PWA icon assets.",
      "missing_subset": "User-selectable alternate app icons.",
      "evidence_ids": [
        "E18"
      ],
      "limits": "AlloCiné Premium icon choice requires a chooser; Goodwatch static installation assets are not that chooser.",
      "externally_blocked_fact": null
    },
    {
      "record_id": "OP-181",
      "feature_id": "profile-style",
      "competitors": "Letterboxd",
      "product_ids": "letterboxd",
      "capability": "Pinned content",
      "source_free_behavior": "Ordinary profile",
      "source_paid_behavior": "Pin content(web)/reviews(app wording)",
      "source_primary_urls": [
        "https://letterboxd.com/about/pro/",
        "https://letterboxd.com/about/pro-apps/"
      ],
      "state": "Missing",
      "assessment": "Profile lists are newest-first and have no pin field/action; reviews have no profile pinning surface.",
      "implemented_subset": "Public share lists ordered by creation.",
      "missing_subset": "Profile content/review pins.",
      "evidence_ids": [
        "E02",
        "E04",
        "E19"
      ],
      "limits": "Pinning a title in a five-title ranking is not profile content pinning.",
      "externally_blocked_fact": null
    },
    {
      "record_id": "OP-183",
      "feature_id": "profile-style",
      "competitors": "MyAnimeList",
      "product_ids": "myanimelist",
      "capability": "About Me styles",
      "source_free_behavior": "Basic profile",
      "source_paid_behavior": "Font/colors/background",
      "source_primary_urls": [
        "https://myanimelist.net/membership"
      ],
      "state": "Missing",
      "assessment": "Profile writer/renderer has no About Me content field/editor or font/color/background controls for it.",
      "implemented_subset": "Derived share-list colors in profile header.",
      "missing_subset": "Custom styled About Me content.",
      "evidence_ids": [
        "E12",
        "E19"
      ],
      "limits": "Profile-wide derived accent is not About Me formatting.",
      "externally_blocked_fact": null
    },
    {
      "record_id": "OP-231",
      "feature_id": "profile-style",
      "competitors": "MyShows",
      "product_ids": "myshows",
      "capability": "Avatar/banner",
      "source_free_behavior": "Ordinary profile",
      "source_paid_behavior": "Banner min2560x1440,max1.8MB JPG",
      "source_primary_urls": [
        "https://en.myshows.me/about/pro/"
      ],
      "state": "Missing",
      "assessment": "Profile backdrop is derived from newest list catalog artwork; no uploaded avatar/banner input or storage.",
      "implemented_subset": "Automatic initial/avatar gradient and catalog backdrop.",
      "missing_subset": "Custom avatar/banner upload satisfying MyShows dimensions/file format.",
      "evidence_ids": [
        "E12",
        "E16",
        "E19"
      ],
      "limits": "Vendor banner minimum 2560×1440, maximum 1.8 MB JPG; no Goodwatch upload pipeline to compare file allowance.",
      "externally_blocked_fact": null
    },
    {
      "record_id": "OP-232",
      "feature_id": "profile-style",
      "competitors": "MyShows",
      "product_ids": "myshows",
      "capability": "Profile block order",
      "source_free_behavior": "Ordinary profile",
      "source_paid_behavior": "Reorder blocks",
      "source_primary_urls": [
        "https://en.myshows.me/about/pro/"
      ],
      "state": "Missing",
      "assessment": "Public profile has fixed header/list-grid structure, not reorderable user blocks.",
      "implemented_subset": "Newest-first share-list grid.",
      "missing_subset": "Profile block reordering.",
      "evidence_ids": [
        "E02",
        "E19"
      ],
      "limits": "No profile block/order field or action; five-title drag order is a different object.",
      "externally_blocked_fact": null
    },
    {
      "record_id": "OP-237",
      "feature_id": "profile-style",
      "competitors": "Suite TV",
      "product_ids": "suite-tv",
      "capability": "Profile styling",
      "source_free_behavior": "Functional core free",
      "source_paid_behavior": "Avatar ring/animated avatar/name font/text colors/stickers/badge",
      "source_primary_urls": [
        "https://www.suitetv.app/en/about"
      ],
      "state": "Missing",
      "assessment": "Generated initial and provider account avatar do not expose ring/animation/name typography/stickers/badge controls.",
      "implemented_subset": "Derived public initial/gradient; provider avatar may appear in private account menu.",
      "missing_subset": "Avatar ring/animated upload/name font/text colors/stickers/profile badge controls.",
      "evidence_ids": [
        "E12",
        "E19",
        "E20"
      ],
      "limits": "Card fonts do not style profile name by user choice; no profile configuration fields.",
      "externally_blocked_fact": null
    },
    {
      "record_id": "OP-566",
      "feature_id": "profile-style",
      "competitors": "Flickchart",
      "product_ids": "flickchart",
      "capability": "Profile and avatar customization",
      "source_free_behavior": "Baseline profile.",
      "source_paid_behavior": "VIP customization/stylized avatar.",
      "source_primary_urls": [
        "https://www.flickchart.com/vip",
        "https://www.flickchart.com/faq"
      ],
      "state": "Partial",
      "assessment": "A list-theme choice indirectly changes public profile accents and generated initial avatar; no dedicated avatar/profile customization editor.",
      "implemented_subset": "Derived profile accent/gradient and newest-list catalog backdrop.",
      "missing_subset": "Independent profile styling/selected avatar controls.",
      "evidence_ids": [
        "E15",
        "E19"
      ],
      "limits": "Vendor stylized avatar details unspecified. Narrow Have: changing newest shared-list theme changes profile accent; do not claim Flickchart full customization.",
      "externally_blocked_fact": null
    },
    {
      "record_id": "OP-608",
      "feature_id": "profile-style",
      "competitors": "Anime-Planet",
      "product_ids": "anime-planet",
      "capability": "Avatar frame and profile banner",
      "source_free_behavior": "Baseline profile.",
      "source_paid_behavior": "Bronze+; higher tier support roles and community differences.",
      "source_primary_urls": [
        "https://www.anime-planet.com/about",
        "https://www.patreon.com/animeplanet/membership"
      ],
      "state": "Missing",
      "assessment": "No avatar frame or independently selected/uploaded profile banner.",
      "implemented_subset": "Automatic initial/gradient and newest-list backdrop.",
      "missing_subset": "Avatar frame and profile-banner customization.",
      "evidence_ids": [
        "E16",
        "E19"
      ],
      "limits": "Anime-Planet Bronze+ entitlement remains separate from human community roles.",
      "externally_blocked_fact": null
    },
    {
      "record_id": "OP-244",
      "feature_id": "recognition",
      "competitors": "Serializd; SIMKL; TVmaze; MyAnimeList; Trakt",
      "product_ids": "serializd;simkl;tvmaze;myanimelist;trakt",
      "capability": "Tier badges/achievements/forum titles",
      "source_free_behavior": "Ordinary identity",
      "source_paid_behavior": "Tier recognition,not functional capacity",
      "source_primary_urls": [
        "https://www.patreon.com/Serializd/membership",
        "https://docs.simkl.org/how-to-use-simkl/account-and-billing/special-plans/supporter-role-usd1-month.md",
        "https://www.tvmaze.com/premium",
        "https://myanimelist.net/membership",
        "https://apps.apple.com/us/app/trakt-tv-time-to-watch/id1514873602"
      ],
      "state": "Missing",
      "assessment": "Public/member identity contains no tier badge, achievement or optional supporter marker.",
      "implemented_subset": "Ordinary handle and signed share-list byline.",
      "missing_subset": "Software membership recognition/achievement/profile badge.",
      "evidence_ids": [
        "E12",
        "E19",
        "E20"
      ],
      "limits": "Each Serializd/SIMKL/TVmaze/MAL/Trakt subvariant is Missing. No member badge/achievement/forum-title field or renderer; genre/rank/share graphics are different objects.",
      "externally_blocked_fact": null,
      "variants": [
        {
          "vendor": "Serializd",
          "requirement": "Software tier recognition badge",
          "state": "Missing"
        },
        {
          "vendor": "SIMKL",
          "requirement": "Tier/supporter recognition badge",
          "state": "Missing"
        },
        {
          "vendor": "TVmaze",
          "requirement": "Premium badge",
          "state": "Missing"
        },
        {
          "vendor": "MyAnimeList",
          "requirement": "Supporter badge/forum title",
          "state": "Missing"
        },
        {
          "vendor": "Trakt",
          "requirement": "VIP profile badges/achievements",
          "state": "Missing"
        }
      ]
    },
    {
      "record_id": "OP-488",
      "feature_id": "recognition",
      "competitors": "TV Episode Calendar / EpisodeCalendar",
      "product_ids": "episodecalendar",
      "capability": "Achievements",
      "source_free_behavior": "Baseline achievement allocation unspecified.",
      "source_paid_behavior": "Premium achievements.",
      "source_primary_urls": [
        "https://episodecalendar.com/en/pages/features",
        "https://episodecalendar.com/en/pages/premium"
      ],
      "state": "Missing",
      "assessment": "Public/member identity contains no tier badge, achievement or optional supporter marker.",
      "implemented_subset": "Ordinary handle and signed share-list byline.",
      "missing_subset": "Software membership recognition/achievement/profile badge.",
      "evidence_ids": [
        "E12",
        "E19",
        "E20"
      ],
      "limits": "No user achievement state/renderer in the inspected identity/library consumer; watch counts and ordinary onboarding feedback do not implement EpisodeCalendar achievements.",
      "externally_blocked_fact": null
    },
    {
      "record_id": "OP-613",
      "feature_id": "recognition",
      "competitors": "Annict / アニクト",
      "product_ids": "annict",
      "capability": "Optional profile badge",
      "source_free_behavior": "Free profile.",
      "source_paid_behavior": "Supporter optional badge.",
      "source_primary_urls": [
        "https://annict.com/supporters",
        "https://annict.com/legal"
      ],
      "state": "Missing",
      "assessment": "Public/member identity contains no tier badge, achievement or optional supporter marker.",
      "implemented_subset": "Ordinary handle and signed share-list byline.",
      "missing_subset": "Software membership recognition/achievement/profile badge.",
      "evidence_ids": [
        "E12",
        "E19",
        "E20"
      ],
      "limits": "No optional supporter-badge field, profile renderer or toggle. Permanent handle/list signature is ordinary identity.",
      "externally_blocked_fact": null
    },
    {
      "record_id": "OP-185",
      "feature_id": "favorites",
      "competitors": "MyAnimeList",
      "product_ids": "myanimelist",
      "capability": "Favorites capacity",
      "source_free_behavior": "10/category",
      "source_paid_behavior": "20/category; excess removed14 days after expiry",
      "source_primary_urls": [
        "https://myanimelist.net/membership/faq"
      ],
      "state": "Missing",
      "assessment": "Legacy title-favorite storage has no connected production FavoriteButton consumer and no public category sections/capacity controls.",
      "implemented_subset": "Legacy movie/show favorite API and stored flags only; public top 5 lists are separate.",
      "missing_subset": "Categorized public-profile favorites including 10→20 per-category capacity.",
      "evidence_ids": [
        "E19",
        "E21"
      ],
      "limits": "MAL extra entries removed 14 days after lapse; Goodwatch has neither category allowance nor equivalent expiry behavior. Do not infer unlimited favorites from upsert.",
      "externally_blocked_fact": null
    }
  ],
  "evidence": {
    "E01": {
      "title": "Five-title share-list model and validated writes",
      "inspection_bounds": "Share-list input, create/update/visibility writers and model: named ranked lists, exactly five unique resolvable movie/show keys; no variable-length custom-list domain or aggregate item allowance. No account list-count check in createList.",
      "sources": [
        {
          "path": "goodwatch-webapp/app/ui/share-card/model.ts",
          "start_line": 38,
          "end_line": 41,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/share-card/model.ts#L38-L41"
        },
        {
          "path": "goodwatch-webapp/app/server/share-lists/store.server.ts",
          "start_line": 19,
          "end_line": 44,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/share-lists/store.server.ts#L19-L44"
        },
        {
          "path": "goodwatch-webapp/app/server/share-lists/store.server.ts",
          "start_line": 93,
          "end_line": 180,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/share-lists/store.server.ts#L93-L180"
        },
        {
          "path": "goodwatch-webapp/app/routes/api.share-lists.ts",
          "start_line": 20,
          "end_line": 85,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/api.share-lists.ts#L20-L85"
        }
      ]
    },
    "E02": {
      "title": "Share-list readers stop at 200",
      "inspection_bounds": "Owner reader and anonymous profile reader each LIMIT 200 with no continuation in these readers; MCP pagination occurs after owner retrieval, so does not remove the underlying 200-list bound. Claim/deletion cache invalidation separately reads at most 1,000 IDs, not a 1,000-list product allowance.",
      "sources": [
        {
          "path": "goodwatch-webapp/app/server/share-lists/store.server.ts",
          "start_line": 123,
          "end_line": 148,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/share-lists/store.server.ts#L123-L148"
        },
        {
          "path": "goodwatch-webapp/app/server/share-lists/view.server.ts",
          "start_line": 122,
          "end_line": 139,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/share-lists/view.server.ts#L122-L139"
        },
        {
          "path": "goodwatch-webapp/app/server/mcp/lists.server.ts",
          "start_line": 59,
          "end_line": 83,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/lists.server.ts#L59-L83"
        },
        {
          "path": "goodwatch-webapp/app/server/share-lists/store.server.ts",
          "start_line": 270,
          "end_line": 316,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/share-lists/store.server.ts#L270-L316"
        }
      ]
    },
    "E03": {
      "title": "Connected Remix copy flow",
      "inspection_bounds": "New-list loader resolves any available source list (no owner-only restriction), copies prompt, title, five entries, design/theme and lineage into a new draft; saved create validates source. Public list links expose Remix. No scheduled source-to-copy update/merge operation. The visible Remix button appears for other owners; an owner can load their own source through the same ?remix= route, but their list page exposes Edit rather than an own-copy button.",
      "sources": [
        {
          "path": "goodwatch-webapp/app/routes/lists.new.tsx",
          "start_line": 65,
          "end_line": 100,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/lists.new.tsx#L65-L100"
        },
        {
          "path": "goodwatch-webapp/app/server/share-lists/store.server.ts",
          "start_line": 130,
          "end_line": 148,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/share-lists/store.server.ts#L130-L148"
        },
        {
          "path": "goodwatch-webapp/app/routes/u.$handle.lists.$id.tsx",
          "start_line": 187,
          "end_line": 203,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/u.$handle.lists.$id.tsx#L187-L203"
        }
      ]
    },
    "E04": {
      "title": "Manual rank editing, not list pinning",
      "inspection_bounds": "Production editor Ranking and list-state implement drag ordering/add/remove of the five positions. Persistence is the list items array. Owner controls expose visibility/delete/restore; their API/input contains no pin or collection-position field. Wishlist order is a chosen sort, not drag order.",
      "sources": [
        {
          "path": "goodwatch-webapp/app/ui/share-list-editor/Ranking.tsx",
          "start_line": 1,
          "end_line": 95,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/share-list-editor/Ranking.tsx#L1-L95"
        },
        {
          "path": "goodwatch-webapp/app/ui/share-list-editor/list-state.ts",
          "start_line": 1,
          "end_line": 119,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/share-list-editor/list-state.ts#L1-L119"
        },
        {
          "path": "goodwatch-webapp/app/ui/share-lists/OwnerListControls.tsx",
          "start_line": 1,
          "end_line": 150,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/share-lists/OwnerListControls.tsx#L1-L150"
        },
        {
          "path": "goodwatch-webapp/app/server/share-lists/store.server.ts",
          "start_line": 36,
          "end_line": 44,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/share-lists/store.server.ts#L36-L44"
        },
        {
          "path": "CONTEXT.md",
          "start_line": 65,
          "end_line": 67,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/CONTEXT.md#L65-L67"
        }
      ]
    },
    "E05": {
      "title": "Wishlist title writes and member read",
      "inspection_bounds": "Authenticated route calls the per-title movie/show upsert/delete. Composite identity user_id/tmdb_id/media_type; no per-account/title-count entitlement guard in this writer. Member reader queries all matching Wishlist rows without an explicit SQL LIMIT and maps them all. This query wrapper returns one response, with no server cursor/drain proving arbitrary database result sizes.",
      "sources": [
        {
          "path": "goodwatch-webapp/app/routes/api.update-wishlist.tsx",
          "start_line": 5,
          "end_line": 22,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/api.update-wishlist.tsx#L5-L22"
        },
        {
          "path": "goodwatch-webapp/app/server/wishList.server.ts",
          "start_line": 24,
          "end_line": 79,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/wishList.server.ts#L24-L79"
        },
        {
          "path": "goodwatch-webapp/app/server/userData.server.ts",
          "start_line": 98,
          "end_line": 163,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/userData.server.ts#L98-L163"
        },
        {
          "path": "goodwatch-webapp/app/utils/crate.ts",
          "start_line": 424,
          "end_line": 442,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/utils/crate.ts#L424-L442"
        },
        {
          "path": "goodwatch-webapp/app/utils/crate.ts",
          "start_line": 475,
          "end_line": 483,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/utils/crate.ts#L475-L483"
        }
      ]
    },
    "E06": {
      "title": "Library pagination and search",
      "inspection_bounds": "Fixed status-derived views (Want to see, Seen, Watching, On hold, Dropped, Not rated), title query, movie/show filter and built-in sorts. Cards are 60 per step, next offsets continue over all keys returned by member data; frontend useInfiniteQuery and Show more consume next. Query text limited to 100 characters. Not arbitrary saved collections or edition search. Titles absent from catalog are omitted from visible cards.",
      "sources": [
        {
          "path": "goodwatch-webapp/app/domain/my-library.ts",
          "start_line": 1,
          "end_line": 110,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/domain/my-library.ts#L1-L110"
        },
        {
          "path": "goodwatch-webapp/app/domain/my-library.ts",
          "start_line": 140,
          "end_line": 209,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/domain/my-library.ts#L140-L209"
        },
        {
          "path": "goodwatch-webapp/app/server/my-library.server.ts",
          "start_line": 151,
          "end_line": 232,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/my-library.server.ts#L151-L232"
        },
        {
          "path": "goodwatch-webapp/app/ui/my-library/MyLibraryPage.tsx",
          "start_line": 470,
          "end_line": 492,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/my-library/MyLibraryPage.tsx#L470-L492"
        },
        {
          "path": "goodwatch-webapp/app/ui/my-library/MyLibraryPage.tsx",
          "start_line": 632,
          "end_line": 650,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/my-library/MyLibraryPage.tsx#L632-L650"
        },
        {
          "path": "goodwatch-webapp/app/routes/my-library.$list.tsx",
          "start_line": 1,
          "end_line": 110,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/my-library.$list.tsx#L1-L110"
        }
      ]
    },
    "E07": {
      "title": "Wishlist sorting and progressive cards",
      "inspection_bounds": "Watch next supports six named sorts: match/waiting/added/newest/top/popular. Plan iterates all returned Wishlist keys; My movies restricts the same plan to movies. Later tiers load progressively; md initially 40/sm 30 before +N, cards fetched 60/request. These are rendering/read-batch bounds, not stored-item caps. No user-defined comparator, drag/pin order or saved arbitrary collection.",
      "sources": [
        {
          "path": "goodwatch-webapp/app/domain/watch-next.ts",
          "start_line": 12,
          "end_line": 25,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/domain/watch-next.ts#L12-L25"
        },
        {
          "path": "goodwatch-webapp/app/domain/watch-next.ts",
          "start_line": 103,
          "end_line": 110,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/domain/watch-next.ts#L103-L110"
        },
        {
          "path": "goodwatch-webapp/app/server/watch-next.server.ts",
          "start_line": 340,
          "end_line": 427,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/watch-next.server.ts#L340-L427"
        },
        {
          "path": "goodwatch-webapp/app/server/watch-next.server.ts",
          "start_line": 835,
          "end_line": 889,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/watch-next.server.ts#L835-L889"
        },
        {
          "path": "goodwatch-webapp/app/server/watch-next.server.ts",
          "start_line": 1066,
          "end_line": 1080,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/watch-next.server.ts#L1066-L1080"
        },
        {
          "path": "goodwatch-webapp/app/ui/watch-next/useWatchNext.ts",
          "start_line": 1,
          "end_line": 27,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/watch-next/useWatchNext.ts#L1-L27"
        },
        {
          "path": "goodwatch-webapp/app/routes/my-movies.tsx",
          "start_line": 45,
          "end_line": 65,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/my-movies.tsx#L45-L65"
        },
        {
          "path": "goodwatch-webapp/app/server/title-cards.server.ts",
          "start_line": 84,
          "end_line": 96,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/title-cards.server.ts#L84-L96"
        }
      ]
    },
    "E08": {
      "title": "Tracked-title writer, aggregate reader and show display bounds",
      "inspection_bounds": "Tracking writes are scoped to one canonical title/state/log, with no total/concurrent-title entitlement guard in the inspected writer paths. Member grouped history/state SQL has no explicit total-title LIMIT. Per-title history reads ARE bounded: movie 200 rows and show 20,000 rows. My shows returns all planned groups; default next-episode enrichment covers first 30 Continue/Pick-up rows, independent of total storage. Catalog episode read LIMIT 100000; UI Start expands 30 at a time and Pick up 5. This is neither unlimited-history proof nor a full Episodes-screen substitute.",
      "sources": [
        {
          "path": "goodwatch-webapp/app/server/tracking.server.ts",
          "start_line": 698,
          "end_line": 734,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/tracking.server.ts#L698-L734"
        },
        {
          "path": "goodwatch-webapp/app/server/tracking-sql.ts",
          "start_line": 4,
          "end_line": 47,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/tracking-sql.ts#L4-L47"
        },
        {
          "path": "goodwatch-webapp/app/server/tracking-sql.ts",
          "start_line": 82,
          "end_line": 91,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/tracking-sql.ts#L82-L91"
        },
        {
          "path": "goodwatch-webapp/app/server/my-shows.server.ts",
          "start_line": 140,
          "end_line": 164,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/my-shows.server.ts#L140-L164"
        },
        {
          "path": "goodwatch-webapp/app/server/my-shows.server.ts",
          "start_line": 392,
          "end_line": 464,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/my-shows.server.ts#L392-L464"
        },
        {
          "path": "goodwatch-webapp/app/ui/my-shows/MyShowsPage.tsx",
          "start_line": 56,
          "end_line": 59,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/my-shows/MyShowsPage.tsx#L56-L59"
        },
        {
          "path": "goodwatch-webapp/app/ui/my-shows/MyShowsPage.tsx",
          "start_line": 530,
          "end_line": 537,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/my-shows/MyShowsPage.tsx#L530-L537"
        },
        {
          "path": "goodwatch-webapp/app/server/userData.server.ts",
          "start_line": 98,
          "end_line": 163,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/userData.server.ts#L98-L163"
        }
      ]
    },
    "E09": {
      "title": "Real MCP batch title operations",
      "inspection_bounds": "Registered set_want_to_see/rate_title/log_watch/set_show_status tools accept up to 50 items; batch writer delegates Wishlist additions/removals to multi-row writer. Rate budgets 300 title writes/minute and 2000/hour; request 60/minute 1000/hour, at most one batch write per request. OAuth read/write scopes, configured MCP resource, per-member tool flags apply. No web add-all-visible UI, arbitrary-list bulk deletion, or season/episode custom-list entries. Existing focused test documents 50 adds but was read, not run.",
      "sources": [
        {
          "path": "goodwatch-webapp/app/server/mcp/write-tools.server.ts",
          "start_line": 69,
          "end_line": 95,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/write-tools.server.ts#L69-L95"
        },
        {
          "path": "goodwatch-webapp/app/server/mcp/write-tools.server.ts",
          "start_line": 143,
          "end_line": 157,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/write-tools.server.ts#L143-L157"
        },
        {
          "path": "goodwatch-webapp/app/server/mcp/write-tools.server.ts",
          "start_line": 180,
          "end_line": 204,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/write-tools.server.ts#L180-L204"
        },
        {
          "path": "goodwatch-webapp/app/server/mcp/batch.server.ts",
          "start_line": 21,
          "end_line": 35,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/batch.server.ts#L21-L35"
        },
        {
          "path": "goodwatch-webapp/app/server/mcp/batch.server.ts",
          "start_line": 350,
          "end_line": 380,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/batch.server.ts#L350-L380"
        },
        {
          "path": "goodwatch-webapp/app/server/mcp/writes.server.ts",
          "start_line": 1,
          "end_line": 70,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/writes.server.ts#L1-L70"
        },
        {
          "path": "goodwatch-webapp/app/server/library-many.server.ts",
          "start_line": 40,
          "end_line": 93,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/library-many.server.ts#L40-L93"
        },
        {
          "path": "goodwatch-webapp/app/server/mcp/endpoint.server.ts",
          "start_line": 33,
          "end_line": 39,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/endpoint.server.ts#L33-L39"
        },
        {
          "path": "goodwatch-webapp/app/server/mcp/endpoint.server.ts",
          "start_line": 95,
          "end_line": 104,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/endpoint.server.ts#L95-L104"
        },
        {
          "path": "goodwatch-webapp/app/server/mcp/endpoint.server.ts",
          "start_line": 125,
          "end_line": 185,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/endpoint.server.ts#L125-L185"
        },
        {
          "path": "goodwatch-webapp/app/server/mcp/batch.test.ts",
          "start_line": 481,
          "end_line": 508,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/batch.test.ts#L481-L508"
        }
      ]
    },
    "E10": {
      "title": "Per-title watch logs and statuses, not diary/archive",
      "inspection_bounds": "Movie log endpoint requires one tmdb_id and session identity; UI supports dated/undated per-title watches, edit/delete/restore. Library shows last-watched title summaries without reading the occurrence log. State machine has Not started/Watching/On hold/Dropped/Seen, no archive state or archive flag in library selection. Inspected routes/domain/server/UI provide no cross-title chronological diary with advanced occurrence filters or archive action.",
      "sources": [
        {
          "path": "goodwatch-webapp/app/routes/api.watch-log.ts",
          "start_line": 14,
          "end_line": 37,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/api.watch-log.ts#L14-L37"
        },
        {
          "path": "goodwatch-webapp/app/server/watch-log.server.ts",
          "start_line": 22,
          "end_line": 86,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/watch-log.server.ts#L22-L86"
        },
        {
          "path": "goodwatch-webapp/app/ui/watch-log/WatchLog.tsx",
          "start_line": 1,
          "end_line": 150,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/watch-log/WatchLog.tsx#L1-L150"
        },
        {
          "path": "goodwatch-webapp/app/domain/tracking/machine.ts",
          "start_line": 1,
          "end_line": 100,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/domain/tracking/machine.ts#L1-L100"
        },
        {
          "path": "goodwatch-webapp/app/domain/my-library.ts",
          "start_line": 1,
          "end_line": 64,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/domain/my-library.ts#L1-L64"
        },
        {
          "path": "goodwatch-webapp/app/server/my-library.server.ts",
          "start_line": 1,
          "end_line": 7,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/my-library.server.ts#L1-L7"
        }
      ]
    },
    "E11": {
      "title": "Personal-data ownership and public/unlisted publication",
      "inspection_bounds": "Personal records and log endpoints are session-owned. Share-list visibility enum and writer accept public or unlisted only; list loader reads the public-by-id view before viewer identity and renders unlisted lists by link. Public profile selection excludes unlisted for visitors but has no hide-profile/privacy selector. private,no-store is HTTP cache policy, not access-control. Discover/privacy setting controls For you and links to privacy policy, not visibility. No owned catalog publication domain.",
      "sources": [
        {
          "path": "goodwatch-webapp/app/server/share-lists/store.server.ts",
          "start_line": 19,
          "end_line": 44,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/share-lists/store.server.ts#L19-L44"
        },
        {
          "path": "goodwatch-webapp/app/server/share-lists/store.server.ts",
          "start_line": 181,
          "end_line": 196,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/share-lists/store.server.ts#L181-L196"
        },
        {
          "path": "goodwatch-webapp/app/server/share-lists/page-loaders.server.ts",
          "start_line": 34,
          "end_line": 98,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/share-lists/page-loaders.server.ts#L34-L98"
        },
        {
          "path": "goodwatch-webapp/app/server/share-lists/view.server.ts",
          "start_line": 122,
          "end_line": 139,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/share-lists/view.server.ts#L122-L139"
        },
        {
          "path": "goodwatch-webapp/app/routes/settings.discover-privacy.tsx",
          "start_line": 1,
          "end_line": 65,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/settings.discover-privacy.tsx#L1-L65"
        },
        {
          "path": "goodwatch-webapp/app/routes/api.watch-log.ts",
          "start_line": 83,
          "end_line": 105,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/api.watch-log.ts#L83-L105"
        }
      ]
    },
    "E12": {
      "title": "Public handle chosen once",
      "inspection_bounds": "Profile settings presents permanent handle; claimHandle returns 409 for a changed existing handle. Profile insert stores user_id/handle/timestamps; reserved claim survives deletion. Account provider name/image is distinct and does not rename the public handle. No cooldown-based renaming operation.",
      "sources": [
        {
          "path": "goodwatch-webapp/app/routes/settings.profile.tsx",
          "start_line": 1,
          "end_line": 71,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/settings.profile.tsx#L1-L71"
        },
        {
          "path": "goodwatch-webapp/app/server/share-lists/store.server.ts",
          "start_line": 234,
          "end_line": 299,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/share-lists/store.server.ts#L234-L299"
        },
        {
          "path": "goodwatch-webapp/app/routes/settings.account.tsx",
          "start_line": 1,
          "end_line": 205,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/settings.account.tsx#L1-L205"
        }
      ]
    },
    "E13": {
      "title": "Public handle validation",
      "inspection_bounds": "Normalized public handles have 3–30 characters, letter-first lowercase letters/digits/underscores, reserved-name restrictions. Claim is available through production HandlePicker/settings; no paid-tier guard. Shared subset with iCollect 1–24 is eligible 3–24, not every 1–24 string.",
      "sources": [
        {
          "path": "goodwatch-webapp/app/utils/handles.ts",
          "start_line": 1,
          "end_line": 14,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/utils/handles.ts#L1-L14"
        },
        {
          "path": "goodwatch-webapp/app/utils/handles.ts",
          "start_line": 55,
          "end_line": 76,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/utils/handles.ts#L55-L76"
        },
        {
          "path": "goodwatch-webapp/app/ui/share-lists/HandlePicker.tsx",
          "start_line": 1,
          "end_line": 110,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/share-lists/HandlePicker.tsx#L1-L110"
        },
        {
          "path": "goodwatch-webapp/app/routes/settings.profile.tsx",
          "start_line": 40,
          "end_line": 71,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/settings.profile.tsx#L40-L71"
        }
      ]
    },
    "E14": {
      "title": "Catalog search/collections are not owned editions",
      "inspection_bounds": "User data is keyed movie/show catalog titles, with no owned edition/barcode/image collection records. Movie collection server only queries catalog movie IDs ordered by release date. Library filters are status/type/title; no saved-filter object, cross-owned-collection report, media-photo scanner or scan-credit ledger in inspected domain/routes/server. App-wide barcode/ISBN/owned-edition/scan-credit source search matched only a decorative barcode comment in share-card/model.ts.",
      "sources": [
        {
          "path": "goodwatch-webapp/app/types/user-data.ts",
          "start_line": 6,
          "end_line": 40,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/types/user-data.ts#L6-L40"
        },
        {
          "path": "goodwatch-webapp/app/server/collection.server.ts",
          "start_line": 5,
          "end_line": 44,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/collection.server.ts#L5-L44"
        },
        {
          "path": "goodwatch-webapp/app/domain/my-library.ts",
          "start_line": 56,
          "end_line": 74,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/domain/my-library.ts#L56-L74"
        },
        {
          "path": "goodwatch-webapp/app/domain/my-library.ts",
          "start_line": 187,
          "end_line": 210,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/domain/my-library.ts#L187-L210"
        },
        {
          "path": "goodwatch-webapp/app/server/my-library.server.ts",
          "start_line": 151,
          "end_line": 232,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/my-library.server.ts#L151-L232"
        }
      ]
    },
    "E15": {
      "title": "Generated card designs and colors",
      "inspection_bounds": "Production pickers choose from 15 registered designs and 7 named color themes, persisted on each five-title share list. These change card/list presentation; not arbitrary user-selected title poster/backdrop, uploaded cover or app theme. Cover design consumes catalog artwork. Public page and profile tiles render these designs.",
      "sources": [
        {
          "path": "goodwatch-webapp/app/ui/share-card/designs.ts",
          "start_line": 20,
          "end_line": 40,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/share-card/designs.ts#L20-L40"
        },
        {
          "path": "goodwatch-webapp/app/ui/share-card/model.ts",
          "start_line": 64,
          "end_line": 75,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/share-card/model.ts#L64-L75"
        },
        {
          "path": "goodwatch-webapp/app/ui/share-list-editor/Pickers.tsx",
          "start_line": 65,
          "end_line": 90,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/share-list-editor/Pickers.tsx#L65-L90"
        },
        {
          "path": "goodwatch-webapp/app/ui/share-list-editor/Pickers.tsx",
          "start_line": 140,
          "end_line": 166,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/share-list-editor/Pickers.tsx#L140-L166"
        },
        {
          "path": "goodwatch-webapp/app/ui/share-card/designs/cover.tsx",
          "start_line": 1,
          "end_line": 115,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/share-card/designs/cover.tsx#L1-L115"
        },
        {
          "path": "goodwatch-webapp/app/ui/share-lists/ShareListTile.tsx",
          "start_line": 1,
          "end_line": 70,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/share-lists/ShareListTile.tsx#L1-L70"
        }
      ]
    },
    "E16": {
      "title": "Catalog artwork without per-user override",
      "inspection_bounds": "Share-list title resolver reads movie/show poster_path/backdrop_path from catalog; editor input has keys/design/theme, no user artwork paths/overrides. Production title/episode/person presentation and settings paths were inspected: images are catalog-fed; no gallery/URL upload or per-title/episode/person override preference. Localized poster resolver is positive exception in E17, not arbitrary image selection. Hero backdrop consumes media.details.backdrop_path; person portrait queries catalog person.profile_path; show tracking maps catalog still_path to episode.still and EpisodeList renders it. Spoiler reveal is not an image chooser.",
      "sources": [
        {
          "path": "goodwatch-webapp/app/server/share-lists/titles.server.ts",
          "start_line": 18,
          "end_line": 63,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/share-lists/titles.server.ts#L18-L63"
        },
        {
          "path": "goodwatch-webapp/app/server/share-lists/store.server.ts",
          "start_line": 36,
          "end_line": 44,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/share-lists/store.server.ts#L36-L44"
        },
        {
          "path": "goodwatch-webapp/app/types/user-data.ts",
          "start_line": 13,
          "end_line": 40,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/types/user-data.ts#L13-L40"
        },
        {
          "path": "goodwatch-webapp/app/routes/settings.profile.tsx",
          "start_line": 1,
          "end_line": 71,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/settings.profile.tsx#L1-L71"
        },
        {
          "path": "goodwatch-webapp/app/routes/api.user-settings.get.tsx",
          "start_line": 11,
          "end_line": 33,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/api.user-settings.get.tsx#L11-L33"
        },
        {
          "path": "goodwatch-webapp/app/ui/details/hero/Trailer.tsx",
          "start_line": 29,
          "end_line": 35,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/details/hero/Trailer.tsx#L29-L35"
        },
        {
          "path": "goodwatch-webapp/app/server/person.server.ts",
          "start_line": 537,
          "end_line": 546,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/person.server.ts#L537-L546"
        },
        {
          "path": "goodwatch-webapp/app/ui/person/Portrait.tsx",
          "start_line": 1,
          "end_line": 34,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/person/Portrait.tsx#L1-L34"
        },
        {
          "path": "goodwatch-webapp/app/server/show-tracking.server.ts",
          "start_line": 65,
          "end_line": 135,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/show-tracking.server.ts#L65-L135"
        },
        {
          "path": "goodwatch-webapp/app/ui/tracking/EpisodeList.tsx",
          "start_line": 587,
          "end_line": 655,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/tracking/EpisodeList.tsx#L587-L655"
        }
      ]
    },
    "E17": {
      "title": "Language-selected posters are supported",
      "inspection_bounds": "Settings Show titles in affects title text/posters/description/tagline, with browser/member preference through SettingsPair. Overlay picks best rated catalog poster in selected base language with fallback to canonical; payload overlay replaces poster fields. No independent textless/with-text switch or preferred image ID field. Thus poster-language subset is Have, combined Flickchart language/text preference Partial.",
      "sources": [
        {
          "path": "goodwatch-webapp/app/routes/settings.language.tsx",
          "start_line": 1,
          "end_line": 30,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/settings.language.tsx#L1-L30"
        },
        {
          "path": "goodwatch-webapp/app/ui/media-preference/SettingsPair.tsx",
          "start_line": 1,
          "end_line": 180,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/media-preference/SettingsPair.tsx#L1-L180"
        },
        {
          "path": "goodwatch-webapp/app/utils/media-overlay-core.ts",
          "start_line": 130,
          "end_line": 173,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/utils/media-overlay-core.ts#L130-L173"
        },
        {
          "path": "goodwatch-webapp/app/utils/media-overlay-core.ts",
          "start_line": 218,
          "end_line": 265,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/utils/media-overlay-core.ts#L218-L265"
        },
        {
          "path": "goodwatch-webapp/app/utils/media-payload-core.ts",
          "start_line": 150,
          "end_line": 175,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/utils/media-payload-core.ts#L150-L175"
        },
        {
          "path": "goodwatch-webapp/app/server/media-payload.server.ts",
          "start_line": 50,
          "end_line": 65,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/media-payload.server.ts#L50-L65"
        }
      ]
    },
    "E18": {
      "title": "App appearance settings and fixed installation icons",
      "inspection_bounds": "Settings routes/navigation and validated UserSettingsSchema offer country/services/language/For you/profile/account, not appearance/layout/icon/video preferences. Static root icon links and webmanifest icons/theme_color define installation assets; no native icon-switch interface or widget tint domain. Content filters named themes/styles mean narrative attributes, not visual skins. Card themes are E15. Scoped searches found no app-icon/theme-preference/textless-poster persistence; fixed dark classes/default grids do not constitute user controls. Detail-content sections are composed in source order. Trailer/clip selection and click-to-play state are transient component state; no saved playback preference is passed by these consumers.",
      "sources": [
        {
          "path": "goodwatch-webapp/app/ui/settings/paths.ts",
          "start_line": 1,
          "end_line": 10,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/settings/paths.ts#L1-L10"
        },
        {
          "path": "goodwatch-webapp/app/ui/settings/SettingsHome.tsx",
          "start_line": 1,
          "end_line": 180,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/settings/SettingsHome.tsx#L1-L180"
        },
        {
          "path": "goodwatch-webapp/app/routes/api.user-settings.get.tsx",
          "start_line": 11,
          "end_line": 33,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/api.user-settings.get.tsx#L11-L33"
        },
        {
          "path": "goodwatch-webapp/app/server/user-settings.server.ts",
          "start_line": 102,
          "end_line": 117,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/user-settings.server.ts#L102-L117"
        },
        {
          "path": "goodwatch-webapp/app/root.tsx",
          "start_line": 75,
          "end_line": 93,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/root.tsx#L75-L93"
        },
        {
          "path": "goodwatch-webapp/public/site.webmanifest",
          "start_line": 1,
          "end_line": 22,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/public/site.webmanifest#L1-L22"
        },
        {
          "path": "goodwatch-webapp/app/domain/themes-styles.ts",
          "start_line": 1,
          "end_line": 50,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/domain/themes-styles.ts#L1-L50"
        },
        {
          "path": "goodwatch-webapp/app/ui/details/DetailsContent.tsx",
          "start_line": 100,
          "end_line": 180,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/details/DetailsContent.tsx#L100-L180"
        },
        {
          "path": "goodwatch-webapp/app/ui/details/Media.tsx",
          "start_line": 35,
          "end_line": 85,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/details/Media.tsx#L35-L85"
        },
        {
          "path": "goodwatch-webapp/app/ui/details/YoutubePlayer.tsx",
          "start_line": 4,
          "end_line": 15,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/details/YoutubePlayer.tsx#L4-L15"
        }
      ]
    },
    "E19": {
      "title": "Derived public-profile styling, without profile customizer",
      "inspection_bounds": "Public profile uses newest share list: accent from its theme, first available title backdrop, initial of handle. Lists ordered newest; no pin or reorder field. Profile writer/settings contains handle only; no About Me, upload avatar/banner, fonts, frame/ring/sticker or block configuration. Account menu can display auth/provider avatar_url, not a public-profile customization writer. Existing source makes some public appearance indirect, so blanket no styling is too broad.",
      "sources": [
        {
          "path": "goodwatch-webapp/app/routes/u.$handle._index.tsx",
          "start_line": 50,
          "end_line": 88,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/u.$handle._index.tsx#L50-L88"
        },
        {
          "path": "goodwatch-webapp/app/server/share-lists/view.server.ts",
          "start_line": 134,
          "end_line": 139,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/share-lists/view.server.ts#L134-L139"
        },
        {
          "path": "goodwatch-webapp/app/server/share-lists/store.server.ts",
          "start_line": 270,
          "end_line": 299,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/share-lists/store.server.ts#L270-L299"
        },
        {
          "path": "goodwatch-webapp/app/routes/settings.profile.tsx",
          "start_line": 40,
          "end_line": 71,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/settings.profile.tsx#L40-L71"
        },
        {
          "path": "goodwatch-webapp/app/ui/main/UserMenu.tsx",
          "start_line": 21,
          "end_line": 40,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/main/UserMenu.tsx#L21-L40"
        },
        {
          "path": "goodwatch-webapp/app/server/auth/runtime.server.ts",
          "start_line": 143,
          "end_line": 157,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/auth/runtime.server.ts#L143-L157"
        }
      ]
    },
    "E20": {
      "title": "No member recognition system in public identity model",
      "inspection_bounds": "Profile store/write/read and public profile renderer contain handle and share lists, with no membership tier, badge, achievement, forum title or optional supporter-badge toggle. Badge-named UI elsewhere denotes title genres/catalog facts, not member recognition. Scoped app source search for achievement/supporter/patron and profile controls found no such identity feature; account/provider data does not supply it.",
      "sources": [
        {
          "path": "goodwatch-webapp/app/server/share-lists/store.server.ts",
          "start_line": 270,
          "end_line": 299,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/share-lists/store.server.ts#L270-L299"
        },
        {
          "path": "goodwatch-webapp/app/server/share-lists/view.server.ts",
          "start_line": 122,
          "end_line": 139,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/share-lists/view.server.ts#L122-L139"
        },
        {
          "path": "goodwatch-webapp/app/routes/u.$handle._index.tsx",
          "start_line": 50,
          "end_line": 154,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/u.$handle._index.tsx#L50-L154"
        },
        {
          "path": "goodwatch-webapp/app/types/user-data.ts",
          "start_line": 28,
          "end_line": 40,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/types/user-data.ts#L28-L40"
        },
        {
          "path": "goodwatch-webapp/app/ui/badge/GenreBadge.tsx",
          "start_line": 1,
          "end_line": 16,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/badge/GenreBadge.tsx#L1-L16"
        }
      ]
    },
    "E21": {
      "title": "Legacy title favorites are not public categorized favorites",
      "inspection_bounds": "Favorite API/writer and member-data read still store movie/show title hearts; no category-specific 10/20 allowance or public profile favorite sections. FavoriteButton has no importing production consumer in app source (only its own definition); public profile renders share lists, not favorite categories. A top 5 share list is not a MAL category. Legacy storage alone is not connected public favorite capacity.",
      "sources": [
        {
          "path": "goodwatch-webapp/app/server/favorites.server.ts",
          "start_line": 1,
          "end_line": 65,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/favorites.server.ts#L1-L65"
        },
        {
          "path": "goodwatch-webapp/app/routes/api.update-favorites.tsx",
          "start_line": 1,
          "end_line": 17,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/api.update-favorites.tsx#L1-L17"
        },
        {
          "path": "goodwatch-webapp/app/ui/user/FavoriteButton.tsx",
          "start_line": 1,
          "end_line": 38,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/user/FavoriteButton.tsx#L1-L38"
        },
        {
          "path": "goodwatch-webapp/app/server/userData.server.ts",
          "start_line": 115,
          "end_line": 121,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/userData.server.ts#L115-L121"
        },
        {
          "path": "goodwatch-webapp/app/server/userData.server.ts",
          "start_line": 154,
          "end_line": 163,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/userData.server.ts#L154-L163"
        },
        {
          "path": "goodwatch-webapp/app/routes/u.$handle._index.tsx",
          "start_line": 79,
          "end_line": 125,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/u.$handle._index.tsx#L79-L125"
        }
      ]
    },
    "E22": {
      "title": "Shared guest progress bounds",
      "inspection_bounds": "Taste/title/Wishlist share browser interactions (score/plan/skip/not-interested), later action replaces earlier for the same movie/show. Guest scores capped 20, existing scores editable; localStorage with memory fallback, no cross-device cloud guarantee. guestUserData gives empty tracked watchState. Member capacity conclusions do not erase guest limits, storage quota or state/episode restrictions.",
      "sources": [
        {
          "path": "goodwatch-webapp/app/utils/guest-progress.ts",
          "start_line": 20,
          "end_line": 47,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/utils/guest-progress.ts#L20-L47"
        },
        {
          "path": "goodwatch-webapp/app/utils/guest-progress.ts",
          "start_line": 49,
          "end_line": 97,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/utils/guest-progress.ts#L49-L97"
        },
        {
          "path": "goodwatch-webapp/app/utils/guest-progress.ts",
          "start_line": 157,
          "end_line": 179,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/utils/guest-progress.ts#L157-L179"
        },
        {
          "path": "CONTEXT.md",
          "start_line": 42,
          "end_line": 46,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/CONTEXT.md#L42-L46"
        }
      ]
    },
    "E23": {
      "title": "Feature gates and deployment scope",
      "inspection_bounds": "General release flag list contains connector, not list/profile/artwork paid entitlements. MCP tool flags accept on/off/member allowlist and default enabled if absent; endpoint still requires configured resource and OAuth scopes. This audit documents code Have subsets without asserting production flag values, entitlement availability or real load capacity.",
      "sources": [
        {
          "path": "goodwatch-webapp/app/server/features.server.ts",
          "start_line": 1,
          "end_line": 38,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/features.server.ts#L1-L38"
        },
        {
          "path": "goodwatch-webapp/app/server/mcp/policy.server.ts",
          "start_line": 1,
          "end_line": 23,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/policy.server.ts#L1-L23"
        },
        {
          "path": "goodwatch-webapp/app/server/mcp/endpoint.server.ts",
          "start_line": 58,
          "end_line": 104,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/endpoint.server.ts#L58-L104"
        },
        {
          "path": "goodwatch-webapp/app/server/mcp/write-tools.server.ts",
          "start_line": 320,
          "end_line": 365,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/write-tools.server.ts#L320-L365"
        }
      ]
    }
  },
  "externally_blocked_facts": [],
  "integration_rule": "Consume per-record state and subsets; do not propagate feature-group state to every record. Have display splits are narrowed code capabilities, not automatic full-vendor parity. Preserve source vendor conflicts and runtime caveats.",
  "feature_state_counts": {
    "Missing": 8,
    "Partial": 8
  },
  "record_state_counts": {
    "Missing": 55,
    "Partial": 24
  }
}
```

[E01]: https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/share-card/model.ts#L38-L41
[E02]: https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/share-lists/store.server.ts#L123-L148
[E03]: https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/lists.new.tsx#L65-L100
[E04]: https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/share-list-editor/Ranking.tsx#L1-L95
[E05]: https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/api.update-wishlist.tsx#L5-L22
[E06]: https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/domain/my-library.ts#L1-L110
[E07]: https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/domain/watch-next.ts#L12-L25
[E08]: https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/tracking.server.ts#L698-L734
[E09]: https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/write-tools.server.ts#L69-L95
[E10]: https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/api.watch-log.ts#L14-L37
[E11]: https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/share-lists/store.server.ts#L19-L44
[E12]: https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/settings.profile.tsx#L1-L71
[E13]: https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/utils/handles.ts#L1-L14
[E14]: https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/types/user-data.ts#L6-L40
[E15]: https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/share-card/designs.ts#L20-L40
[E16]: https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/share-lists/titles.server.ts#L18-L63
[E17]: https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/settings.language.tsx#L1-L30
[E18]: https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/settings/paths.ts#L1-L10
[E19]: https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/u.$handle._index.tsx#L50-L88
[E20]: https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/share-lists/store.server.ts#L270-L299
[E21]: https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/favorites.server.ts#L1-L65
[E22]: https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/utils/guest-progress.ts#L20-L47
[E23]: https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/features.server.ts#L1-L38
