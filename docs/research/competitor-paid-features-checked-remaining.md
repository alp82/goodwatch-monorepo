# Checked remaining paid capability variants

Audit/access date: **2026-10-19**. Goodwatch code: [`97eb3179844c4f68a70ccbd997bab4f2a735516d`](https://github.com/alp82/goodwatch-monorepo/tree/97eb3179844c4f68a70ccbd997bab4f2a735516d). **10/10 assigned records inspected: 1 Have, 5 Partial, 4 Missing.** This dossier owns only OP-420,465,475,486,502,519,580,588,620,640; it changes no existing synthesis or dossier.

Have means the exact stated capability is connected in this source snapshot, with its explicit scope. Partial identifies a concrete implemented subset and missing remainder. Missing identifies an inspected absent control/object. Vendor undocumented details and blocked rechecks are kept separate; none leaves the Goodwatch assessment generic Not checked. Deployment, live grants, server options, payment entitlements and import fidelity on real accounts were not exercised.

Canonical opportunities/plans and their primary dossiers define the starting requirement; current official pages were revisited where accessible to resolve object semantics. Seven prior dossiers were consulted as relevant leads: core, landscape, Goodwatch audit, named expansion, discovery expansion, checked discovery and checked organization. Existing generic status text was not accepted as evidence. Root AGENTS.md/CONTEXT.md, docs/agents guidance, ADR0008/0009 and webapp AGENTS.md apply at the same pin used for the organization audit. The research skill primary-source standard is applied directly; no subagents. Access date is not a source-update date. The FAQ explicitly dates itself 2026-09-08; no update date is inferred for undated pages.

## Complete record checklist

| Checked record | Competitor / exact capability | State | Honest comparison label |
|---|---|---|---|
| [x] OP-420 | WatchNext.app — Server-enabled Trakt import | **Missing** | Trakt account connection missing; file import exists. |
| [x] OP-465 | Movie Tracker — Simone Montalto — Space count | **Missing** | Watchlist-organizing Spaces missing. |
| [x] OP-475 | Callsheet — Unlimited lists of titles and people | **Partial** | Multiple top 5 title rankings; no people/general unlimited lists. |
| [x] OP-486 | TV Episode Calendar / EpisodeCalendar — Custom My Shows lists | **Missing** | My shows has derived default groups; no custom grouping. |
| [x] OP-502 | MDBList / Reeel — Static list count | **Partial** | Manual static top 5 lists; owner/public readers stop at 200. |
| [x] OP-519 | MDBList / Reeel — Name import | **Partial** | Constrained name ingestion; no full fuzzy/name-to-Trakt-list flow. |
| [x] OP-580 | WerStreamt.es — Multiple Watch, Seen and Owned lists | **Missing** | Single status views; no multiple typed Watch/Seen/Owned lists. |
| [x] OP-588 | WerStreamt.es — Letterboxd, TMDB and Trakt imports | **Have** | All three named import sources present, with distinct methods and exclusions. |
| [x] OP-620 | Flickz — Full Taste Identity card | **Partial** | Computed taste identity present; shareable full-card output missing. |
| [x] OP-640 | iCollect Movies / iCollect Everything — Self-service desktop CSV import | **Partial** | Self-service browser CSV present; native owned-collection schema missing. |

Do not merge the two Trakt comparisons: OP-420 asks for a connected external account; OP-588 asks for named-source import coverage. A real export-file importer satisfies the latter source-coverage scope and does not satisfy the former authorization workflow. Similarly, Space count, list count, items/list and status-view count refer to different objects. [R01] [R02] [R08] [R09] [R10]

## Competitor-grouped findings

### WatchNext.app

**OP-420 — Server-enabled Trakt import: Missing.**

FAQ says Unlimited-only: authorize Trakt when enabled on WatchNext servers, import watched shows/episode progress and disconnect in the same panel. No Free/Premium/trial import entitlement. [Official1](https://watchnext.app/faq), [Official2](https://watchnext.app/terms)

Canonical free → paid: No Free/Premium import entitlement. → Unlimited and server option; not guaranteed enabled everywhere. Eligible offer IDs: `PLAN-326`, `PLAN-327`. These are capability allocations from plans.csv, not a new pricing validation.

Trakt ZIP ingestion exists, but the exact WatchNext account-connection workflow is absent. Goodwatch exposes no Trakt connection-source, authorization route/client or disconnect panel. [R01] [R02] [R04] [R14]

| Inspection result | Exact supported behavior / gap |
|---|---|
| Supported subset | Manual upload of Trakt export ZIP; watched-history movie/episode observations, ratings, Watchlist and favorites. |
| Missing behavior / broader boundary | Connect Trakt account, fetch/sync watched shows and episode progress from that account, and disconnect that external grant. |
| Limits and object semantics | File alternative:20MiB upload/50,000 observations; custom lists and season/episode ratings unsupported. WatchNext account import itself is server-option dependent; no enabled-server assertion. |
| Vendor uncertainty, separate from code assessment | WatchNext homepage uses broader Premium wording than FAQ/terms. FAQ server option does not establish current live enabled state. |

Recommended display variants: Trakt account connect/import/disconnect = **Missing**; Trakt export-file migration = **Have** (Alternative workflow, not fulfillment of account-connection requirement.).

### Movie Tracker — Simone Montalto

**OP-465 — Space count: Missing.**

Montalto publisher describes Backlog titles organized into user-created Spaces (e.g. partner/weekend watchlists). Canonical Apple evidence: Free one Space; Pro unlimited Spaces, same functionality for subscription and lifetime. [Official1](https://apps.apple.com/us/app/id6443877426)

Canonical free → paid: Free1 Space. → Pro unlimited Spaces; Space behavior differs from5-title share cards. Eligible offer IDs: `PLAN-350`, `PLAN-351`, `PLAN-352`. These are capability allocations from plans.csv, not a new pricing validation.

No organizing Space object/control exists in Wishlist/My shows/library. Multiple published five-title rankings are a different object and do not establish one or unlimited private organizing Spaces. [R08] [R09] [R10] [R11]

| Inspection result | Exact supported behavior / gap |
|---|---|
| Supported subset | One combined movie/show Wishlist and status views; separately named top 5 share lists. |
| Missing behavior / broader boundary | Create and manage multiple custom Spaces containing selected watchlist titles, with space membership independent of the single Wishlist/status views. |
| Limits and object semantics | Share lists require exactly five titles/public handle and public/unlisted visibility; owner/public readers200. Do not compare free one Space with five items/card. |
| Vendor uncertainty, separate from code assessment | Apple listing did not reopen in this pass;1/unlimited entitlement retained from canonical primary dossier. Per-Space item and nesting limits undocumented; no hierarchy/permissions assumption. Original SKU not equated to Pro. |

Recommended display variants: Named watchlist-organizing Space object = **Missing**; Unlimited Space count = **Missing**.

### Callsheet

**OP-475 — Unlimited lists of titles and people: Partial.**

Callsheet official site explicitly permits configurable movie/show/person lists, moving between lists, same entry in several lists, and as many lists as wanted. Subscription extends use beyond20 free searches; higher supporter amounts do not document different list capacity. [Official1](https://callsheetapp.com/), [Official2](https://apps.apple.com/us/app/callsheet-find-cast-crew/id1672356376)

Canonical free → paid: Available during free allowance. → Subscription access: as many lists as wanted, item in multiple lists. Eligible offer IDs: `PLAN-354`, `PLAN-355`, `PLAN-356`, `PLAN-357`. These are capability allocations from plans.csv, not a new pricing validation.

Manual named title lists and cross-list reuse exist only as exactly-five public/unlisted rankings. People cannot be entries; unrestricted list lengths and unlimited reader-visible count are absent. [R08] [R09] [R11]

| Inspection result | Exact supported behavior / gap |
|---|---|
| Supported subset | Create/edit/order multiple five-title movie/show share lists; same title can occur in more than one list because uniqueness is per list. |
| Missing behavior / broader boundary | Saved lists containing people; general variable-length/empty personal lists; unrestricted count and general move-between-list workflow. |
| Limits and object semantics | Exactly five unique resolvable movie/show keys/list; publication requires account/handle; owner/public list reads200 without continuation. No unlimited claim from absent writer count guard. |
| Vendor uncertainty, separate from code assessment | No numeric per-list item limit published in reviewed source; do not assert unlimited items/list. |

Recommended display variants: Multiple named manually ordered title lists = **Have** (Exactly-five public/unlisted rankings only.); People as saved list members = **Missing**; Unlimited general lists = **Missing**.

### EpisodeCalendar

**OP-486 — Custom My Shows lists: Missing.**

EpisodeCalendar Premium page specifically describes custom My shows groups replacing default grouping. Feature matrix marks custom lists Premium, unlike Basic tracking. [Official1](https://episodecalendar.com/en/pages/features), [Official2](https://episodecalendar.com/en/pages/premium)

Canonical free → paid: Basic tracking/list view. → Premium custom lists. Eligible offer IDs: `PLAN-375`. These are capability allocations from plans.csv, not a new pricing validation.

My shows groups are fixed and computed from tracking state/activity. There is no custom group name/ID, membership editor or persistent grouping choice. [R10] [R11] [R08]

| Inspection result | Exact supported behavior / gap |
|---|---|
| Supported subset | Continue/Start/Pick up/Waiting/On hold/Dropped groups plus status library filters. |
| Missing behavior / broader boundary | Create My shows lists and group shows as chosen instead of the default groups. |
| Limits and object semantics | Renaming a five-title public share card or switching a status/filter does not regroup My shows. No vendor list/member-count cap invented. |
| Vendor uncertainty, separate from code assessment | Premium price requires login; exact custom-list/item limits remain unpublished. Goodwatch custom-group absence is assessed independently. |

Recommended display variants: Default derived show groups = **Have** (Baseline only.); Custom My shows groups = **Missing**.

### MDBList / Reeel

**OP-502 — Static list count: Partial.**

Official list-type docs define static lists as manually added/removed/reordered, created empty/from an existing list or appended from another. Current supporter matrix independently lists static counts; shared/dynamic lists and items/list have separate rows. [Official1](https://docs.mdblist.com/docs/supporter), [Official2](https://mdblist.memberful.com/join?splash=1), [Official3](https://docs.mdblist.com/docs/api)

Canonical free → paid: Free: 4. → Basic: 20; Standard: 60; Plus: 80; VIP5: 120; VIP10: 300; VIP15: 400; VIP20: 600. Separate object-specific caps; no aggregate conflation. Eligible offer IDs: `PLAN-382`, `PLAN-383`, `PLAN-384`, `PLAN-385`, `PLAN-386`, `PLAN-387`, `PLAN-388`, `PLAN-389`, `PLAN-390`, `PLAN-391`, `PLAN-392`, `PLAN-393`, `PLAN-394`, `PLAN-395`. These are capability allocations from plans.csv, not a new pricing validation.

Goodwatch has real manually maintained static five-title rankings, with no create-time account-count guard. They are narrower than MDBList static lists and their owner/public listing stops200. [R08] [R09]

| Inspection result | Exact supported behavior / gap |
|---|---|
| Supported subset | Create/edit/reorder independent static top 5 title lists; Remix creates a copy. |
| Missing behavior / broader boundary | Empty or arbitrary-length static lists; append arbitrary source items; guaranteed600-list management/visibility and full MDBList object parity. |
| Limits and object semantics | MDBList static counts:Free4; Basic20; Standard60; Plus80; VIP5 120; VIP10 300; VIP15 400; VIP20 600. Goodwatch reader200 is a list-count bound; five is an item-count invariant.20/60/80/120 fall inside reader window, while300/400/600 do not. Storage past200 is not proof of manageable capacity. |
| Vendor uncertainty, separate from code assessment | Large-list-count operation not load-tested; no end-to-end guarantee beyond inspected model/reader. This does not block Partial assessment. |

Recommended display variants: Manual static title curation = **Have** (Exactly-five rankings only.); Arbitrary-length static list = **Missing**; 300/400/600 lists visible through list management = **Missing** (Underlying owner/public reader stops200; primary-key links do not supply general list management.).

**OP-519 — Name import: Partial.**

Current MDBList Import from Names guide accepts movie/show names with or without year, offers Enable Fuzzy match, and adds recognized titles to MDBList and Trakt lists. Current supporter matrix explicitly marks Name import unavailable Free and available all paid levels. Canonical Free source-import-subset unspecified is therefore narrowed: other free source imports remain unspecified, but this named control is paid. [Official1](https://docs.mdblist.com/docs/supporter), [Official2](https://mdblist.com/new-features/)

Canonical free → paid: Free source import subset unspecified. → All paid levels name import; ambiguity/fidelity untested. Eligible offer IDs: `PLAN-382`, `PLAN-383`, `PLAN-384`, `PLAN-385`, `PLAN-386`, `PLAN-387`, `PLAN-388`, `PLAN-389`, `PLAN-390`, `PLAN-391`, `PLAN-392`, `PLAN-393`, `PLAN-394`, `PLAN-395`. These are capability allocations from plans.csv, not a new pricing validation.

Name-based ingestion is inspected and present through constrained JSON/CSV matching and explicit MCP batches; none is the complete MDBList name-list/fuzzy/Trakt-list import workflow. [R05] [R06] [R07] [R04]

| Inspection result | Exact supported behavior / gap |
|---|---|
| Supported subset | Wishlist JSON with title+year can uniquely match movie/show catalog entries. Unknown-media JSON names can be matched by member in preview. MCP batch up to50 title_name selectors with optional year resolves unique names and adds them to Wishlist. |
| Missing behavior / broader boundary | Plain name-list import control with optional fuzzy-match switch, general MDBList static-list destination and external Trakt list writes. No automatic no-year match guarantee across file schemas. |
| Limits and object semantics | JSON needs goodwatch-wishlist v1/1.1 envelope,20MiB/50,000 entries. Typed movie/show no-ID/no-year rows remain unmatched and are not all eligible for manual repair. CSV movie name-only row without rating/date/review is invalid; exact Title/Year fallback. MCP50/call, OAuth/resource/tool gates,300 title writes/minute and2,000/hour; ambiguity returns choices. |
| Vendor uncertainty, separate from code assessment | MDBList ambiguity handling and recognition fidelity are not documented/tested. Do not promise typo equivalence or current Trakt write availability from the guide. |

Recommended display variants: Recognize/import movie/show names = **Have** (Bounded structured JSON/CSV and MCP workflows described above.); Fuzzy-match switch = **Missing**; Write recognized names into external Trakt list/general static list = **Missing**.

### WerStreamt.es

**OP-580 — Multiple Watch, Seen and Owned lists: Missing.**

WerStreamt.es canonical Pro dossier distinguishes ordinary free Watch/Seen lists from multiple Pro Watch/Seen/Owned lists, retained after cancellation with Pro controls disabled. [Official1](https://www.werstreamt.es/pro/), [Official2](https://www.werstreamt.es/)

Canonical free → paid: Ordinary Watch/Seen free. → Pro multiple lists; stored after cancellation, paid controls disabled. Eligible offer IDs: `PLAN-420`, `PLAN-421`, `PLAN-422`, `PLAN-423`. These are capability allocations from plans.csv, not a new pricing validation.

Want/Seen are fixed intention/state-derived views, not multiple independently named typed lists. No Owned membership exists. Share cards cannot become typed Watch/Seen/Owned lists by changing their title. [R10] [R11] [R08]

| Inspection result | Exact supported behavior / gap |
|---|---|
| Supported subset | Single Wishlist plus derived Seen/status library; independent five-title share rankings. |
| Missing behavior / broader boundary | Multiple lists per Watch/Seen/Owned role, independent per-list memberships and owned-content state. |
| Limits and object semantics | Movie/show title state may be Want to rewatch while Seen, but that is one Wishlist plus watched state, not two custom collections. No paid-cancellation feature lock exists; vendor stored-after-cancellation policy retained as vendor behavior. |
| Vendor uncertainty, separate from code assessment | Official Pro page did not reopen in this pass; named-source assertion retained from primary dossier. Exact list/item caps and type-specific editing restrictions not public in reviewed evidence. |

Recommended display variants: Single Want/Seen status views = **Have** (Baseline only.); Multiple independently named typed lists = **Missing**; Owned collection membership = **Missing**.

**OP-588 — Letterboxd, TMDB and Trakt imports: Have.**

WerStreamt.es canonical Pro evidence names extra imports from Letterboxd/TMDB/Trakt. It does not supply a field matrix, import transport or full foreign-list fidelity contract. Therefore compare documented named source coverage while exposing Goodwatch methods and exclusions. [Official1](https://www.werstreamt.es/pro/), [Official2](https://www.werstreamt.es/)

Canonical free → paid: Baseline source imports unspecified. → Pro extra named-source imports. Eligible offer IDs: `PLAN-420`, `PLAN-421`, `PLAN-422`, `PLAN-423`. These are capability allocations from plans.csv, not a new pricing validation.

All three named sources have connected UI→route→parser/account reader→preview→confirmation→apply paths. Have is source-coverage only; no exact foreign custom-list schema, account-sync or every-field parity is claimed. [R01] [R02] [R03] [R04] [R14]

| Inspection result | Exact supported behavior / gap |
|---|---|
| Supported subset | Letterboxd export ZIP: movie watches/ratings/reviews/Watchlist/film likes. Trakt export ZIP: movie/show history including episode watches, title ratings/Watchlist/favorites. TMDB temporary authorized account read: movie/show ratings/Watchlist/favorites. |
| Missing behavior / broader boundary | For broader comparisons: imported arbitrary custom-list identity/order, Trakt live account connection and ongoing external synchronization. These are not established by this source-coverage row and remain separate gaps. |
| Limits and object semantics | Files20MiB;50,000 rows/result observations; ordinary ZIP200 files,32MiB/entry64MiB expansion. Trakt season/episode ratings/custom lists unsupported; Letterboxd parser does not ingest arbitrary list files. TMDB50,000 observations/five-minute read/temporary connection; no TMDB watch history or rating dates. Member sign-in; no paid check in route; deployed DB/keys not tested. |
| Vendor uncertainty, separate from code assessment | Official Pro page blocked in this pass; canonical primary dossier retained. Vendor exact method/field fidelity and baseline sources unspecified. Do not convert unspecified transport into an assumed OAuth or list-preservation requirement. |

Recommended display variants: Letterboxd file ingestion = **Have**; TMDB one-time account ingestion = **Have** (Configured keys/origin required; source lacks watch history.); Trakt file ingestion = **Have**; Trakt account connection = **Missing** (Separate OP-420, not required merely by named source coverage.).

### Flickz

**OP-620 — Full Taste Identity card: Partial.**

Flickz official page describes a shareable watcher-identity card derived from swipes and representative titles; its Premium section gates the full card. Caption identifies a named watcher archetype. Free subset and full field inventory are not documented. [Official1](https://flickz.app/)

Canonical free → paid: Free card subset unspecified. → Premium full card. Eligible offer IDs: `PLAN-444`, `PLAN-445`. These are capability allocations from plans.csv, not a new pricing validation.

Fingerprint already generates a personal identity name, explanatory line, attribute comparisons and representative titles. No connected shareable computed identity-card image/link/export was found. Generic recommendation cards are not the proof; the actual identity route/builder/render is. [R12] [R13] [R08]

| Inspection result | Exact supported behavior / gap |
|---|---|
| Supported subset | Member/qualified-guest fingerprint identity, five families/74 attributes and up to 16 representative titles, with three header posters. |
| Missing behavior / broader boundary | Publish/download/share the computed personal identity as a card another viewer can open; exact equivalence to every field in Flickz full card is not established. |
| Limits and object semantics | Minimum five rated titles with analysis for fingerprint; guests below five get sample taste; unavailable snapshot can prevent result. Current session/guest determines /taste content, so copying /taste does not share the sender identity. Five-title public share cards are manually curated, a different output. Identity can be null unless positive leanings in two different families support it; five ratings alone do not guarantee an archetype name. |
| Vendor uncertainty, separate from code assessment | Complete Premium card fields/free truncation remain external specification gaps; screenshot fetch failed and no account was used. Code identity support and missing share output are nevertheless assessed. |

Recommended display variants: Computed named taste identity and representative titles = **Have**; Shareable computed identity-card output = **Missing**; Every field/limit of vendor full Premium card = **Partial** (Goodwatch identity display inspected; unpublished vendor field set cannot be mapped completely.).

### iCollect Movies / Everything

**OP-640 — Self-service desktop CSV import: Partial.**

iCollect support explicitly distinguishes support-assisted CSV imports from Pro self-service Mac/Windows import. Official tutorial uses a collection CSV template/export, updates matching Item IDs, removes existing items missing from CSV, enriches barcode rows and creates new no-ID rows; it cannot create custom fields. [Official1](https://www.icollecteverything.com/2024/10/26/heres-the-price-differences-and-breakdown-of-our-product-offerings/), [Official2](https://www.icollecteverything.com/support/)

Canonical free → paid: Other CSV imports support-assisted. → Pro self-service desktop import; not all imports paid. Eligible offer IDs: `PLAN-462`, `PLAN-463`, `PLAN-464`. These are capability allocations from plans.csv, not a new pricing validation.

An authenticated desktop-browser user can upload, preview and confirm supported movie-rating/history CSV without support staff. Goodwatch does not implement iCollect native Mac/Windows collection CSV import or its Item-ID/barcode replacement behavior. [R01] [R04] [R05] [R11] [R14]

| Inspection result | Exact supported behavior / gap |
|---|---|
| Supported subset | Real web CSV file chooser/drop, schema validation, preview and user confirmation, with direct application of supported movie rating/watch/review observations. |
| Missing behavior / broader boundary | Native desktop-app importer for owned/collectible items, Item-ID updates, removal of collection items absent from input, barcode enrichment and collection-specific fields. |
| Limits and object semantics | 20MiB/50,000 input rows and generated observations; fixed Letterboxd-style fields, unknown columns ignored, tags/directors/rewatch metadata not applied. No field creation/import of owned data. iCollect tutorial itself disallows creating new custom fields and documents replacement/deletion; generic CSV upload must not be presented as that complete schema. |
| Vendor uncertainty, separate from code assessment | Existing vendor lifetime-unlock/Pro prerequisite wording conflict retained; not needed to determine exact Goodwatch CSV workflow. No vendor row/file cap documented in reviewed tutorial. |

Recommended display variants: Self-service supported CSV import from desktop computer = **Have** (Web browser, movie rating/history schema only.); Native desktop owned-collection CSV schema/replacement import = **Missing**.

## Evidence ledger: pinned code and inspection bounds

Every source link below is immutable to the requested main SHA. Negative findings name their model, writer, reader and consumer bounds. Prototype routes, generic OAuth, source logos and marketing descriptions do not establish connected capability.

### R01 — Connected import UI and upload/connection selection

Settings imports renders ImportSourcesPage and SourceImportFlow. Trakt and Letterboxd are file sources; only TMDB/Plex have connection flows. Production file chooser/drop zone calls preview. No conclusion rests on a logo or source label alone.

[routes/settings.imports.tsx:23–41](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/settings.imports.tsx#L23-L41); [ui/imports/ImportSources.ts:57–101](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/imports/ImportSources.ts#L57-L101); [ui/imports/ImportSourcesPage.tsx:132–165](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/imports/ImportSourcesPage.tsx#L132-L165); [ui/imports/SourceImportFlow.tsx:130–147](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/imports/SourceImportFlow.tsx#L130-L147); [ui/imports/SourceImportUploadPanel.tsx:31–100](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/imports/SourceImportUploadPanel.tsx#L31-L100); [domain/imports.ts:101–127](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/domain/imports.ts#L101-L127); [domain/imports.ts:190–202](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/domain/imports.ts#L190-L202).

### R02 — Trakt file ingestion; account connection absent

The export ZIP parser explicitly consumes watched-history, movie/show ratings, Watchlist and favorites JSON, including episode coordinates. Custom Trakt lists and episode/season ratings become unsupported items. Existing connection-source type is TMDB/Plex only. Production app scan found no Trakt API/OAuth endpoint/client/token configuration; similarly named Trakt trend counts are public catalog signals, not member account connection. Generic Goodwatch/MCP OAuth is not Trakt authorization.

[server/imports/files.server.ts:497–525](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/imports/files.server.ts#L497-L525); [server/imports/files.server.ts:550–688](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/imports/files.server.ts#L550-L688); [server/imports/connect-store.server.ts:1–15](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/imports/connect-store.server.ts#L1-L15); [domain/imports.ts:109–117](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/domain/imports.ts#L109-L117); [ui/imports/SourceImportFlow.tsx:130–147](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/imports/SourceImportFlow.tsx#L130-L147).

### R03 — TMDB one-time account import

Connected TMDB panel posts to actual route/runtime, obtains account lists then revokes temporary access before preview. Reads movie/show rated/watchlist/favorite lists, with 50,000 total observations and five-minute read deadline. TMDB provides no rating dates/watch history; episode ratings not read. Requires configured API/connect keys, site origin and a signed-in member. This is account ingestion, not scraping a public list URL or ongoing sync.

[ui/imports/TmdbConnectPanel.tsx:18–30](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/imports/TmdbConnectPanel.tsx#L18-L30); [ui/imports/TmdbConnectPanel.tsx:48–70](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/imports/TmdbConnectPanel.tsx#L48-L70); [routes/api.imports.tmdb.$step.ts:1–7](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/api.imports.tmdb.$step.ts#L1-L7); [server/imports/tmdb-connect-runtime.server.ts:7–20](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/imports/tmdb-connect-runtime.server.ts#L7-L20); [server/imports/tmdb-connect.server.ts:175–235](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/imports/tmdb-connect.server.ts#L175-L235); [server/imports/tmdb-client.server.ts:211–255](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/imports/tmdb-client.server.ts#L211-L255); [server/imports/tmdb-client.server.ts:282–322](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/imports/tmdb-client.server.ts#L282-L322).

### R04 — Preview, confirmation and real per-record application

File endpoint invokes previewImport for authenticated member, then confirmation chooses import kinds/conflict/date policy. confirmImport claims the import and runs applyRun. Intent/favorite writes are keyed user/title; ratings/reviews and watches use their dedicated application paths. The import is therefore connected beyond parsing. Rows already present or changed here are handled by explicit preservation/conflict policy; importing is not blanket replacement/deletion of an owned collection.

[routes/api.imports.preview.ts:53–98](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/api.imports.preview.ts#L53-L98); [routes/api.imports.$id.confirm.ts:7–28](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/api.imports.$id.confirm.ts#L7-L28); [server/imports/service.server.ts:15–44](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/imports/service.server.ts#L15-L44); [server/imports/apply.server.ts:310–380](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/imports/apply.server.ts#L310-L380); [server/imports/apply.server.ts:480–534](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/imports/apply.server.ts#L480-L534); [server/imports/apply.server.ts:565–601](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/imports/apply.server.ts#L565-L601).

### R05 — Generic CSV schema and exact limits

CSV upload path is real and self-service in a desktop browser, but schema is movie-centric Letterboxd-style data. Header aliases are normalized; known fields are fixed. Unknown columns are ignored with warning, tags/directors/rewatch metadata not applied. A name-only row without rating, watch date or review is invalid; Title/Year fallback needs a unique exact title/year match. Rating10 is whole 1–10, Rating is half-step 0.5–5; WatchedDate creates day watches; reviews truncated20,000 chars. It is not an iCollect edition/ownership/barcode/Item-ID replacement import.

[ui/imports/SourceImportUpload.ts:8–37](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/imports/SourceImportUpload.ts#L8-L37); [domain/imports.ts:118–124](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/domain/imports.ts#L118-L124); [server/imports/files.server.ts:745–813](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/imports/files.server.ts#L745-L813); [server/imports/files.server.ts:817–902](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/imports/files.server.ts#L817-L902); [server/imports/preview.server.ts:243–268](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/imports/preview.server.ts#L243-L268).

### R06 — Structured name-based Wishlist import and manual matching

Wishlist JSON must use goodwatch-wishlist envelope version1 or1.1, with source/completeness/items; it is not a plain newline list. Movie/show names with year can use unique exact title/year fallback. Unknown-media items preserve source evidence and can be matched by searching/picking a catalog result in the connected preview panel. Typed movie/show name-only rows lacking ID/year remain unmatched; the eligibility predicate does not enable generic manual repair for all typed rows. No user Enable Fuzzy match option or Trakt list write destination in this flow.

[domain/imports.ts:172–189](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/domain/imports.ts#L172-L189); [server/imports/wishlist.server.ts:38–84](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/imports/wishlist.server.ts#L38-L84); [server/imports/wishlist.server.ts:235–278](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/imports/wishlist.server.ts#L235-L278); [server/imports/preview.server.ts:243–268](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/imports/preview.server.ts#L243-L268); [server/imports/wishlist-evidence.server.ts:17–34](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/imports/wishlist-evidence.server.ts#L17-L34); [server/imports/wishlist-resolution.server.ts:429–486](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/imports/wishlist-resolution.server.ts#L429-L486); [ui/imports/WishlistMatchPanel.tsx:1–45](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/imports/WishlistMatchPanel.tsx#L1-L45); [ui/imports/WishlistImportPreview.tsx:350–378](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/imports/WishlistImportPreview.tsx#L350-L378).

### R07 — MCP name batches are a concrete additional subset

MCP title writes accept up to50 name selectors with optional year. Each name goes through full-text catalog lookup, prefers normalized exact-name matches, and accepts only one result; ambiguities return choices instead of writing that item. set_want_to_see routes batch membership to actual Wishlist writer. No free-form pasted-name import UI, fuzzy-match toggle, arbitrary-length static-list destination or external Trakt list writer. OAuth/config/tool gates and rate budgets qualify this code Have subset.

[server/mcp/data.server.ts:237–316](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/data.server.ts#L237-L316); [server/mcp/batch.server.ts:21–35](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/batch.server.ts#L21-L35); [server/mcp/batch.server.ts:281–307](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/batch.server.ts#L281-L307); [server/mcp/batch.server.ts:350–380](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/batch.server.ts#L350-L380); [server/mcp/write-tools.server.ts:143–157](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/write-tools.server.ts#L143-L157); [server/mcp/write-tools.server.ts:197–204](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/write-tools.server.ts#L197-L204); [server/mcp/policy.server.ts:1–23](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/policy.server.ts#L1-L23); [server/mcp/endpoint.server.ts:33–39](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/endpoint.server.ts#L33-L39); [server/mcp/endpoint.server.ts:95–104](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/endpoint.server.ts#L95-L104); [server/mcp/endpoint.server.ts:125–185](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/endpoint.server.ts#L125-L185).

### R08 — Actual manual share-list model, writer and editor

Named lists accept exactly five unique resolvable movie/show keys; parser rejects person keys. Create validates per-list uniqueness only, so a title may occur in multiple independent lists. Create requires public handle and inserts without account-list-count guard. Production editor adds/removes/reorders ranks and persists them; cannot publish an empty or arbitrary-length list. Public/unlisted is not a private organizing Space or typed Owned/Seen/Watch collection.

[server/share-lists/store.server.ts:19–44](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/share-lists/store.server.ts#L19-L44); [server/share-lists/store.server.ts:93–111](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/share-lists/store.server.ts#L93-L111); [server/share-lists/store.server.ts:123–146](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/share-lists/store.server.ts#L123-L146); [server/share-lists/store.server.ts:149–175](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/share-lists/store.server.ts#L149-L175); [server/share-lists/titles.server.ts:41–49](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/share-lists/titles.server.ts#L41-L49); [ui/share-list-editor/Ranking.tsx:27–95](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/share-list-editor/Ranking.tsx#L27-L95); [ui/share-list-editor/list-state.ts:81–112](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/share-list-editor/list-state.ts#L81-L112); [ui/share-list-editor/ShareFlow.tsx:59–77](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/share-list-editor/ShareFlow.tsx#L59-L77).

### R09 — List-count reader bounds and consumers

Owner reader LIMIT200 and public reader LIMIT200 have no continuation. Owner/public profile renders returned lists; MCP readLists paginates after the bounded owner read, not before. Thus absence of a writer count guard does not promise unlimited list visibility. Numbers count lists, separately from exactly-five items/list. Basic20/Standard60/Plus80/VIP5 120 fit within that reader window in code, but this is not large-library runtime verification or general MDBList static-list parity; VIP10 300/VIP15 400/VIP20 600 exceed it.

[server/share-lists/store.server.ts:123–125](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/share-lists/store.server.ts#L123-L125); [server/share-lists/view.server.ts:134–139](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/share-lists/view.server.ts#L134-L139); [server/share-lists/page-loaders.server.ts:115–159](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/share-lists/page-loaders.server.ts#L115-L159); [routes/u.$handle._index.tsx:108–125](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/u.$handle._index.tsx#L108-L125); [server/mcp/lists.server.ts:59–83](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/lists.server.ts#L59-L83).

### R10 — My shows and status-library groups are derived, not custom lists

My shows domain fixes Continue, Start, Pick up, Waiting, On hold and Dropped groups and derives membership/order from status, activity and Wishlist. Route passes member context to getMyShows. Library statuses are fixed Want/Seen/Watching/On hold/Dropped/Not rated with status/type/query/sort choices. No group ID/name/member editor or user-defined group storage is accepted by these consumers. Renaming a top 5 share card does not change My shows grouping.

[CONTEXT.md:65–86](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/CONTEXT.md#L65-L86); [domain/my-shows.ts:65–79](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/domain/my-shows.ts#L65-L79); [domain/my-shows.ts:91–166](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/domain/my-shows.ts#L91-L166); [routes/my-shows.tsx:49–61](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/my-shows.tsx#L49-L61); [server/my-shows.server.ts:398–464](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/my-shows.server.ts#L398-L464); [domain/my-library.ts:7–64](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/domain/my-library.ts#L7-L64); [server/my-library.server.ts:151–173](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/my-library.server.ts#L151-L173).

### R11 — Personal state and public people lookup are not owned/people collections

UserData stores title scores/Wishlist/watchState/favorites/skipped/notInterested keyed movie/show IDs, no owned-edition or named status-list membership. Wishlist writer takes user/title key, no list ID. Person lookup displays catalog data without user saved-person-list fields. Share-list parser cannot accept person keys and its model has no Watch/Seen/Owned type. Library franchise collection lookup is catalog-only. Scoped model/writer/reader/API inspection establishes missing typed ownership/people/custom status-list controls.

[types/user-data.ts:6–40](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/types/user-data.ts#L6-L40); [server/wishList.server.ts:24–68](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/wishList.server.ts#L24-L68); [server/share-lists/titles.server.ts:41–49](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/share-lists/titles.server.ts#L41-L49); [server/share-lists/store.server.ts:19–44](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/share-lists/store.server.ts#L19-L44); [server/person.server.ts:537–546](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/person.server.ts#L537-L546); [server/collection.server.ts:25–44](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/collection.server.ts#L25-L44); [domain/my-library.ts:7–36](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/domain/my-library.ts#L7-L36).

### R12 — Real personal taste identity and representative titles

Production /taste/fingerprint route loads the member/guest portrait and renders Fingerprint. Builder computes named identity from five families/74 attributes, with minimum five rated titles carrying analysis and up to 16 representative titles. UI renders identity name, explanation, attribute comparisons and representative posters, with three header posters. Guests under five ratings see sample taste; snapshot availability can produce unavailable view. No subscription branch in these inspected paths. Identity name additionally requires a positive leaning supported by another fingerprint family; it can be null even after the five-title minimum.

[routes/taste.fingerprint.tsx:28–42](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/taste.fingerprint.tsx#L28-L42); [server/taste-portrait/index.server.ts:65–95](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/taste-portrait/index.server.ts#L65-L95); [server/taste-portrait/index.server.ts:100–128](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/taste-portrait/index.server.ts#L100-L128); [server/taste-portrait/fingerprint.server.ts:1–32](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/taste-portrait/fingerprint.server.ts#L1-L32); [server/taste-portrait/fingerprint.server.ts:48–61](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/taste-portrait/fingerprint.server.ts#L48-L61); [ui/taste/tabs/Fingerprint.tsx:84–139](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/taste/tabs/Fingerprint.tsx#L84-L139); [ui/taste/tabs/Fingerprint.tsx:244–256](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/taste/tabs/Fingerprint.tsx#L244-L256); [routes/api.taste.portrait.ts:17–35](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/api.taste.portrait.ts#L17-L35).

[Identity construction and representative-title bound](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/taste-portrait/fingerprint.server.ts#L197-L235).

### R13 — No connected shareable taste-identity card

Taste API chooses current session/guest viewer and returns private,no-store personal view, not a share ID for another viewer. Production Taste tabs/routes and taste-portrait modules have no navigator.share/image-download/blob-export/shareUrl control. Existing public card endpoint/viewer consumes ShareList, and public profile renders share lists only. A manually curated top 5 card and copying /taste URL do not publish the computed identity portrait. Negative bound: these consumer/API/card/profile paths, excluding prototype routes.

[routes/api.taste.portrait.ts:43–47](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/api.taste.portrait.ts#L43-L47); [server/taste-portrait/index.server.ts:65–81](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/taste-portrait/index.server.ts#L65-L81); [ui/taste/tabs/Fingerprint.tsx:84–139](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/taste/tabs/Fingerprint.tsx#L84-L139); [ui/taste/tabs/Fingerprint.tsx:244–259](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/taste/tabs/Fingerprint.tsx#L244-L259); [routes/og.lists.$id.$file.tsx:1–73](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/og.lists.$id.$file.tsx#L1-L73); [routes/u.$handle._index.tsx:108–125](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/u.$handle._index.tsx#L108-L125); [server/share-lists/view.server.ts:76–84](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/share-lists/view.server.ts#L76-L84).

### R14 — Import size/security/gates are separate from paid availability

Uploads are limited20×1024² bytes, with a21MiB multipart envelope allowance; CSV/input rows and resulting import observations capped50,000. ZIP expansion bounded200 files (normal Letterboxd/Trakt path),32MiB/entry and64MiB total. Member/authenticated routes have no paid-tier test, but database absence returns503 and TMDB requires deployed keys/origin. Actual deployment, server options and external credentials not exercised. Reading code establishes bounded support; it is not unlimited import or operational parity proof.

[domain/imports.ts:28–29](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/domain/imports.ts#L28-L29); [domain/imports.ts:251–251](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/domain/imports.ts#L251-L251); [routes/api.imports.preview.ts:12–21](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/api.imports.preview.ts#L12-L21); [routes/api.imports.preview.ts:74–95](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/api.imports.preview.ts#L74-L95); [server/imports/files.server.ts:15–18](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/imports/files.server.ts#L15-L18); [server/imports/files.server.ts:235–247](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/imports/files.server.ts#L235-L247); [server/imports/files.server.ts:745–763](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/imports/files.server.ts#L745-L763); [server/imports/files.server.ts:899–902](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/imports/files.server.ts#L899-L902); [server/imports/http.server.ts:9–35](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/imports/http.server.ts#L9-L35); [server/imports/tmdb-connect-runtime.server.ts:7–20](https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/imports/tmdb-connect-runtime.server.ts#L7-L20).

## Source conflicts, gaps and completion boundary

- **WatchNext:** FAQ/terms distinguish Unlimited import from Premium/trial and require a server option for Trakt. Homepage broader Premium wording is retained as a conflict, not operational proof. [FAQ](https://watchnext.app/faq).
- **MDBList:** Current matrix clarifies Free has no Import from Names control; all paid levels do. This narrows the canonical free-source-subset unknown specifically for OP-519. Static lists have their own4/20/60/80/120/300/400/600 count row, separate from dynamic/shared/feed lists and per-list items. [Matrix](https://docs.mdblist.com/docs/supporter), [name guide](https://docs.mdblist.com/docs/import_from_names).
- **Movie Tracker / WerStreamt.es:** Apple listing and WerStreamt.es Pro did not reopen in this pass. Their documented cap/paid scope is retained from canonical primary dossiers; no fresh availability or checkout assertion is made. Montalto publisher currently explains the organizing-Space job. [Publisher](https://movietrack.app/), [prior discovery dossier](competitor-paid-features-discovery-expansion.md).
- **Flickz:** Full Premium card fields and Free truncation remain unspecified. Official text and caption establish the identity/sharing job; failed image fetch does not mean the Goodwatch identity page was uninspected. Full-card parity is not claimed. [Official page](https://flickz.app/).
- **iCollect:** Desktop self-service is specifically Pro, whereas assisted CSV imports also exist. Native collection CSV replacement/identity semantics are materially different from movie rating/history CSV. Existing lifetime-unlock versus Pro-includes-all wording is not silently resolved. [Support](https://www.icollecteverything.com/support/), [tutorial](https://www.icollecteverything.com/import-csv-within-the-desktop-apps-tutorial/).

No code assessment is externally blocked. Unpublished vendor fields, server enablement and inaccessible page rechecks remain precise vendor/deployment caveats attached to assessed records. A later live comparison can narrow those claims further; documentary completion does not wait for accounts or load tests.

## Validation and handoff

Validated all ten expected record IDs occur once in record_results and the checklist, states are Have/Partial/Missing, every record has an implemented subset/missing behavior/limits/evidence IDs, every evidence ID resolves, and pinned file/line ranges exist. Canonical free/paid strings and entitlement offer IDs are copied exactly for traceability; clarifications are separate. JSON parses. Only this new dossier is written; no source/synthesis edits, app tests, issues, commits, push or publication.

The embedded handoff follows checked-organization.md record_results/evidence conventions and adds scope variants, vendor uncertainty and exact source-offer references. Source hashes bind the inputs read; the root thread may concurrently update synthesis, so reconcile by record ID and requirement rather than demanding unchanged whole-file hashes.

```json
{
  "schema_version": 1,
  "audit_date": "2026-10-19",
  "code_sha": "97eb3179844c4f68a70ccbd997bab4f2a735516d",
  "record_count": 10,
  "record_ids": [
    "OP-420",
    "OP-465",
    "OP-475",
    "OP-486",
    "OP-502",
    "OP-519",
    "OP-580",
    "OP-588",
    "OP-620",
    "OP-640"
  ],
  "state_counts": {
    "Missing": 4,
    "Partial": 5,
    "Have": 1
  },
  "source_sha256": {
    "competitor-paid-features-opportunities.csv": "bf055fbcb192291ed54deff0648a08c529dcfdb6bdab9907b47b09fa2d22228a",
    "competitor-paid-features-plans.csv": "f39785fa0f21c55dd7ee2caec1941c2666c33936a9ab6080a11934ec40f52ece",
    "competitor-paid-features-view.json": "f8b5593f661801a54be35f23c03f1a8510db28fbc4683561d53944b8c5e7b02a",
    "competitor-paid-features-comparison.md": "60b30de9434193bfe7b3860c2babb88eb184e7ba6719ccbf5d9b8ee2bcb07f5b",
    "competitor-paid-features-core.md": "0ccc1e1e65baa6d1fd51b95fc555af00f295d958584c006977b91b0cce249d64",
    "competitor-paid-features-landscape.md": "3b3f37768f11757d0d4319a49d78d815752a93d0a40b86cb3966330ba133005d",
    "competitor-paid-features-goodwatch.md": "6eaf09a2b6730e18a3453303d907e5a35e579302bc32a773ef0b3c4646f991bd",
    "competitor-paid-features-discovery-expansion.md": "36851ff9ad509a167bab8577e810757dbf18df2b8b8283975b38040f20016135",
    "competitor-paid-features-named-expansion.md": "50e9b62bfb000918f0eb5d82fd8681744b1d34ab7a568f42f6246ba34639d7d9",
    "competitor-paid-features-checked-discovery.md": "b57c74086c68c6e6700fcae497958e01c296864b03e5b49f77e9fe2d3f303583",
    "competitor-paid-features-checked-organization.md": "f5edf6ad886bf6d289e52b0de672add0eca0a95676cd082c95d0317f145c95f1"
  },
  "assessment_basis": "Pinned current-main connected consumer code; exact named vendor controls, not generic family parity. No app tests, live accounts, entitlements or production operations.",
  "integration_rule": "Use record_results state/scope/variants, not a family template. Have is documented code support at the stated scope; deployment is unverified. Preserve vendor uncertainty separately from inspected Goodwatch support.",
  "record_results": [
    {
      "record_id": "OP-420",
      "competitors": "WatchNext.app",
      "product_ids": "watchnext-app",
      "capability": "Server-enabled Trakt import",
      "source_free_behavior": "No Free/Premium import entitlement.",
      "source_paid_behavior": "Unlimited and server option; not guaranteed enabled everywhere.",
      "source_primary_urls": [
        "https://watchnext.app/faq",
        "https://watchnext.app/terms"
      ],
      "entitled_offer_ids": [
        "PLAN-326",
        "PLAN-327"
      ],
      "context_offer_ids": [
        "PLAN-323",
        "PLAN-324",
        "PLAN-325",
        "PLAN-328"
      ],
      "state": "Missing",
      "assessment_scope": "Trakt account authorization, server-side history/progress fetch and disconnect control",
      "assessment": "Trakt ZIP ingestion exists, but the exact WatchNext account-connection workflow is absent. Goodwatch exposes no Trakt connection-source, authorization route/client or disconnect panel.",
      "implemented_subset": "Manual upload of Trakt export ZIP; watched-history movie/episode observations, ratings, Watchlist and favorites.",
      "missing_subset": "Connect Trakt account, fetch/sync watched shows and episode progress from that account, and disconnect that external grant.",
      "limits": "File alternative:20MiB upload/50,000 observations; custom lists and season/episode ratings unsupported. WatchNext account import itself is server-option dependent; no enabled-server assertion.",
      "evidence_ids": [
        "R01",
        "R02",
        "R04",
        "R14"
      ],
      "vendor_requirement_assessed": "FAQ says Unlimited-only: authorize Trakt when enabled on WatchNext servers, import watched shows/episode progress and disconnect in the same panel. No Free/Premium/trial import entitlement.",
      "vendor_spec_uncertainties": [
        "WatchNext homepage uses broader Premium wording than FAQ/terms. FAQ server option does not establish current live enabled state."
      ],
      "variants": [
        {
          "requirement": "Trakt account connect/import/disconnect",
          "state": "Missing"
        },
        {
          "requirement": "Trakt export-file migration",
          "state": "Have",
          "scope": "Alternative workflow, not fulfillment of account-connection requirement."
        }
      ],
      "goodwatch_support_inspected": true,
      "deployment_verified": false,
      "externally_blocked_fact": null
    },
    {
      "record_id": "OP-465",
      "competitors": "Movie Tracker — Simone Montalto",
      "product_ids": "movie-tracker-montalto",
      "capability": "Space count",
      "source_free_behavior": "Free1 Space.",
      "source_paid_behavior": "Pro unlimited Spaces; Space behavior differs from5-title share cards.",
      "source_primary_urls": [
        "https://apps.apple.com/us/app/id6443877426"
      ],
      "entitled_offer_ids": [
        "PLAN-350",
        "PLAN-351",
        "PLAN-352"
      ],
      "context_offer_ids": [
        "PLAN-353",
        "PLAN-510"
      ],
      "state": "Missing",
      "assessment_scope": "Custom watchlist Spaces and their count, independent of title count",
      "assessment": "No organizing Space object/control exists in Wishlist/My shows/library. Multiple published five-title rankings are a different object and do not establish one or unlimited private organizing Spaces.",
      "implemented_subset": "One combined movie/show Wishlist and status views; separately named top 5 share lists.",
      "missing_subset": "Create and manage multiple custom Spaces containing selected watchlist titles, with space membership independent of the single Wishlist/status views.",
      "limits": "Share lists require exactly five titles/public handle and public/unlisted visibility; owner/public readers200. Do not compare free one Space with five items/card.",
      "evidence_ids": [
        "R08",
        "R09",
        "R10",
        "R11"
      ],
      "vendor_requirement_assessed": "Montalto publisher describes Backlog titles organized into user-created Spaces (e.g. partner/weekend watchlists). Canonical Apple evidence: Free one Space; Pro unlimited Spaces, same functionality for subscription and lifetime.",
      "vendor_spec_uncertainties": [
        "Apple listing did not reopen in this pass;1/unlimited entitlement retained from canonical primary dossier. Per-Space item and nesting limits undocumented; no hierarchy/permissions assumption. Original SKU not equated to Pro."
      ],
      "variants": [
        {
          "requirement": "Named watchlist-organizing Space object",
          "state": "Missing"
        },
        {
          "requirement": "Unlimited Space count",
          "state": "Missing"
        }
      ],
      "goodwatch_support_inspected": true,
      "deployment_verified": false,
      "externally_blocked_fact": null
    },
    {
      "record_id": "OP-475",
      "competitors": "Callsheet",
      "product_ids": "callsheet",
      "capability": "Unlimited lists of titles and people",
      "source_free_behavior": "Available during free allowance.",
      "source_paid_behavior": "Subscription access: as many lists as wanted, item in multiple lists.",
      "source_primary_urls": [
        "https://callsheetapp.com/",
        "https://apps.apple.com/us/app/callsheet-find-cast-crew/id1672356376"
      ],
      "entitled_offer_ids": [
        "PLAN-354",
        "PLAN-355",
        "PLAN-356",
        "PLAN-357"
      ],
      "context_offer_ids": [],
      "state": "Partial",
      "assessment_scope": "Multiple manually curated title/people lists, shared membership and unlimited count",
      "assessment": "Manual named title lists and cross-list reuse exist only as exactly-five public/unlisted rankings. People cannot be entries; unrestricted list lengths and unlimited reader-visible count are absent.",
      "implemented_subset": "Create/edit/order multiple five-title movie/show share lists; same title can occur in more than one list because uniqueness is per list.",
      "missing_subset": "Saved lists containing people; general variable-length/empty personal lists; unrestricted count and general move-between-list workflow.",
      "limits": "Exactly five unique resolvable movie/show keys/list; publication requires account/handle; owner/public list reads200 without continuation. No unlimited claim from absent writer count guard.",
      "evidence_ids": [
        "R08",
        "R09",
        "R11"
      ],
      "vendor_requirement_assessed": "Callsheet official site explicitly permits configurable movie/show/person lists, moving between lists, same entry in several lists, and as many lists as wanted. Subscription extends use beyond20 free searches; higher supporter amounts do not document different list capacity.",
      "vendor_spec_uncertainties": [
        "No numeric per-list item limit published in reviewed source; do not assert unlimited items/list."
      ],
      "variants": [
        {
          "requirement": "Multiple named manually ordered title lists",
          "state": "Have",
          "scope": "Exactly-five public/unlisted rankings only."
        },
        {
          "requirement": "People as saved list members",
          "state": "Missing"
        },
        {
          "requirement": "Unlimited general lists",
          "state": "Missing"
        }
      ],
      "goodwatch_support_inspected": true,
      "deployment_verified": false,
      "externally_blocked_fact": null
    },
    {
      "record_id": "OP-486",
      "competitors": "TV Episode Calendar / EpisodeCalendar",
      "product_ids": "episodecalendar",
      "capability": "Custom My Shows lists",
      "source_free_behavior": "Basic tracking/list view.",
      "source_paid_behavior": "Premium custom lists.",
      "source_primary_urls": [
        "https://episodecalendar.com/en/pages/features",
        "https://episodecalendar.com/en/pages/premium"
      ],
      "entitled_offer_ids": [
        "PLAN-375"
      ],
      "context_offer_ids": [
        "PLAN-511"
      ],
      "state": "Missing",
      "assessment_scope": "User-defined groups/lists within My shows",
      "assessment": "My shows groups are fixed and computed from tracking state/activity. There is no custom group name/ID, membership editor or persistent grouping choice.",
      "implemented_subset": "Continue/Start/Pick up/Waiting/On hold/Dropped groups plus status library filters.",
      "missing_subset": "Create My shows lists and group shows as chosen instead of the default groups.",
      "limits": "Renaming a five-title public share card or switching a status/filter does not regroup My shows. No vendor list/member-count cap invented.",
      "evidence_ids": [
        "R10",
        "R11",
        "R08"
      ],
      "vendor_requirement_assessed": "EpisodeCalendar Premium page specifically describes custom My shows groups replacing default grouping. Feature matrix marks custom lists Premium, unlike Basic tracking.",
      "vendor_spec_uncertainties": [
        "Premium price requires login; exact custom-list/item limits remain unpublished. Goodwatch custom-group absence is assessed independently."
      ],
      "variants": [
        {
          "requirement": "Default derived show groups",
          "state": "Have",
          "scope": "Baseline only."
        },
        {
          "requirement": "Custom My shows groups",
          "state": "Missing"
        }
      ],
      "goodwatch_support_inspected": true,
      "deployment_verified": false,
      "externally_blocked_fact": null
    },
    {
      "record_id": "OP-502",
      "competitors": "MDBList / Reeel",
      "product_ids": "mdblist",
      "capability": "Static list count",
      "source_free_behavior": "Free: 4.",
      "source_paid_behavior": "Basic: 20; Standard: 60; Plus: 80; VIP5: 120; VIP10: 300; VIP15: 400; VIP20: 600. Separate object-specific caps; no aggregate conflation.",
      "source_primary_urls": [
        "https://docs.mdblist.com/docs/supporter",
        "https://mdblist.memberful.com/join?splash=1",
        "https://docs.mdblist.com/docs/api"
      ],
      "entitled_offer_ids": [
        "PLAN-382",
        "PLAN-383",
        "PLAN-384",
        "PLAN-385",
        "PLAN-386",
        "PLAN-387",
        "PLAN-388",
        "PLAN-389",
        "PLAN-390",
        "PLAN-391",
        "PLAN-392",
        "PLAN-393",
        "PLAN-394",
        "PLAN-395"
      ],
      "context_offer_ids": [
        "PLAN-396",
        "PLAN-397",
        "PLAN-398",
        "PLAN-399",
        "PLAN-400",
        "PLAN-401",
        "PLAN-402",
        "PLAN-403"
      ],
      "state": "Partial",
      "assessment_scope": "Static-list object behavior and count, not dynamic-list/item/shared-list allowances",
      "assessment": "Goodwatch has real manually maintained static five-title rankings, with no create-time account-count guard. They are narrower than MDBList static lists and their owner/public listing stops200.",
      "implemented_subset": "Create/edit/reorder independent static top 5 title lists; Remix creates a copy.",
      "missing_subset": "Empty or arbitrary-length static lists; append arbitrary source items; guaranteed600-list management/visibility and full MDBList object parity.",
      "limits": "MDBList static counts:Free4; Basic20; Standard60; Plus80; VIP5 120; VIP10 300; VIP15 400; VIP20 600. Goodwatch reader200 is a list-count bound; five is an item-count invariant.20/60/80/120 fall inside reader window, while300/400/600 do not. Storage past200 is not proof of manageable capacity.",
      "evidence_ids": [
        "R08",
        "R09"
      ],
      "vendor_requirement_assessed": "Official list-type docs define static lists as manually added/removed/reordered, created empty/from an existing list or appended from another. Current supporter matrix independently lists static counts; shared/dynamic lists and items/list have separate rows.",
      "vendor_spec_uncertainties": [
        "Large-list-count operation not load-tested; no end-to-end guarantee beyond inspected model/reader. This does not block Partial assessment."
      ],
      "variants": [
        {
          "requirement": "Manual static title curation",
          "state": "Have",
          "scope": "Exactly-five rankings only."
        },
        {
          "requirement": "Arbitrary-length static list",
          "state": "Missing"
        },
        {
          "requirement": "300/400/600 lists visible through list management",
          "state": "Missing",
          "scope": "Underlying owner/public reader stops200; primary-key links do not supply general list management."
        }
      ],
      "goodwatch_support_inspected": true,
      "deployment_verified": false,
      "externally_blocked_fact": null
    },
    {
      "record_id": "OP-519",
      "competitors": "MDBList / Reeel",
      "product_ids": "mdblist",
      "capability": "Name import",
      "source_free_behavior": "Free source import subset unspecified.",
      "source_paid_behavior": "All paid levels name import; ambiguity/fidelity untested.",
      "source_primary_urls": [
        "https://docs.mdblist.com/docs/supporter",
        "https://mdblist.com/new-features/"
      ],
      "entitled_offer_ids": [
        "PLAN-382",
        "PLAN-383",
        "PLAN-384",
        "PLAN-385",
        "PLAN-386",
        "PLAN-387",
        "PLAN-388",
        "PLAN-389",
        "PLAN-390",
        "PLAN-391",
        "PLAN-392",
        "PLAN-393",
        "PLAN-394",
        "PLAN-395"
      ],
      "context_offer_ids": [
        "PLAN-396",
        "PLAN-397",
        "PLAN-398",
        "PLAN-399",
        "PLAN-400",
        "PLAN-401",
        "PLAN-402",
        "PLAN-403"
      ],
      "state": "Partial",
      "assessment_scope": "Name-based title recognition plus import input/destinations/fuzzy control",
      "assessment": "Name-based ingestion is inspected and present through constrained JSON/CSV matching and explicit MCP batches; none is the complete MDBList name-list/fuzzy/Trakt-list import workflow.",
      "implemented_subset": "Wishlist JSON with title+year can uniquely match movie/show catalog entries. Unknown-media JSON names can be matched by member in preview. MCP batch up to50 title_name selectors with optional year resolves unique names and adds them to Wishlist.",
      "missing_subset": "Plain name-list import control with optional fuzzy-match switch, general MDBList static-list destination and external Trakt list writes. No automatic no-year match guarantee across file schemas.",
      "limits": "JSON needs goodwatch-wishlist v1/1.1 envelope,20MiB/50,000 entries. Typed movie/show no-ID/no-year rows remain unmatched and are not all eligible for manual repair. CSV movie name-only row without rating/date/review is invalid; exact Title/Year fallback. MCP50/call, OAuth/resource/tool gates,300 title writes/minute and2,000/hour; ambiguity returns choices.",
      "evidence_ids": [
        "R05",
        "R06",
        "R07",
        "R04"
      ],
      "vendor_requirement_assessed": "Current MDBList Import from Names guide accepts movie/show names with or without year, offers Enable Fuzzy match, and adds recognized titles to MDBList and Trakt lists. Current supporter matrix explicitly marks Name import unavailable Free and available all paid levels. Canonical Free source-import-subset unspecified is therefore narrowed: other free source imports remain unspecified, but this named control is paid.",
      "vendor_spec_uncertainties": [
        "MDBList ambiguity handling and recognition fidelity are not documented/tested. Do not promise typo equivalence or current Trakt write availability from the guide."
      ],
      "variants": [
        {
          "requirement": "Recognize/import movie/show names",
          "state": "Have",
          "scope": "Bounded structured JSON/CSV and MCP workflows described above."
        },
        {
          "requirement": "Fuzzy-match switch",
          "state": "Missing"
        },
        {
          "requirement": "Write recognized names into external Trakt list/general static list",
          "state": "Missing"
        }
      ],
      "goodwatch_support_inspected": true,
      "deployment_verified": false,
      "externally_blocked_fact": null
    },
    {
      "record_id": "OP-580",
      "competitors": "WerStreamt.es",
      "product_ids": "werstreamt-es",
      "capability": "Multiple Watch, Seen and Owned lists",
      "source_free_behavior": "Ordinary Watch/Seen free.",
      "source_paid_behavior": "Pro multiple lists; stored after cancellation, paid controls disabled.",
      "source_primary_urls": [
        "https://www.werstreamt.es/pro/",
        "https://www.werstreamt.es/"
      ],
      "entitled_offer_ids": [
        "PLAN-420",
        "PLAN-421",
        "PLAN-422",
        "PLAN-423"
      ],
      "context_offer_ids": [],
      "state": "Missing",
      "assessment_scope": "Multiple independently named Watch, Seen and Owned collection memberships",
      "assessment": "Want/Seen are fixed intention/state-derived views, not multiple independently named typed lists. No Owned membership exists. Share cards cannot become typed Watch/Seen/Owned lists by changing their title.",
      "implemented_subset": "Single Wishlist plus derived Seen/status library; independent five-title share rankings.",
      "missing_subset": "Multiple lists per Watch/Seen/Owned role, independent per-list memberships and owned-content state.",
      "limits": "Movie/show title state may be Want to rewatch while Seen, but that is one Wishlist plus watched state, not two custom collections. No paid-cancellation feature lock exists; vendor stored-after-cancellation policy retained as vendor behavior.",
      "evidence_ids": [
        "R10",
        "R11",
        "R08"
      ],
      "vendor_requirement_assessed": "WerStreamt.es canonical Pro dossier distinguishes ordinary free Watch/Seen lists from multiple Pro Watch/Seen/Owned lists, retained after cancellation with Pro controls disabled.",
      "vendor_spec_uncertainties": [
        "Official Pro page did not reopen in this pass; named-source assertion retained from primary dossier. Exact list/item caps and type-specific editing restrictions not public in reviewed evidence."
      ],
      "variants": [
        {
          "requirement": "Single Want/Seen status views",
          "state": "Have",
          "scope": "Baseline only."
        },
        {
          "requirement": "Multiple independently named typed lists",
          "state": "Missing"
        },
        {
          "requirement": "Owned collection membership",
          "state": "Missing"
        }
      ],
      "goodwatch_support_inspected": true,
      "deployment_verified": false,
      "externally_blocked_fact": null
    },
    {
      "record_id": "OP-588",
      "competitors": "WerStreamt.es",
      "product_ids": "werstreamt-es",
      "capability": "Letterboxd, TMDB and Trakt imports",
      "source_free_behavior": "Baseline source imports unspecified.",
      "source_paid_behavior": "Pro extra named-source imports.",
      "source_primary_urls": [
        "https://www.werstreamt.es/pro/",
        "https://www.werstreamt.es/"
      ],
      "entitled_offer_ids": [
        "PLAN-420",
        "PLAN-421",
        "PLAN-422",
        "PLAN-423"
      ],
      "context_offer_ids": [],
      "state": "Have",
      "assessment_scope": "Named-source ingestion from Letterboxd, TMDB and Trakt; methods/fidelity stated explicitly",
      "assessment": "All three named sources have connected UI→route→parser/account reader→preview→confirmation→apply paths. Have is source-coverage only; no exact foreign custom-list schema, account-sync or every-field parity is claimed.",
      "implemented_subset": "Letterboxd export ZIP: movie watches/ratings/reviews/Watchlist/film likes. Trakt export ZIP: movie/show history including episode watches, title ratings/Watchlist/favorites. TMDB temporary authorized account read: movie/show ratings/Watchlist/favorites.",
      "missing_subset": "For broader comparisons: imported arbitrary custom-list identity/order, Trakt live account connection and ongoing external synchronization. These are not established by this source-coverage row and remain separate gaps.",
      "limits": "Files20MiB;50,000 rows/result observations; ordinary ZIP200 files,32MiB/entry64MiB expansion. Trakt season/episode ratings/custom lists unsupported; Letterboxd parser does not ingest arbitrary list files. TMDB50,000 observations/five-minute read/temporary connection; no TMDB watch history or rating dates. Member sign-in; no paid check in route; deployed DB/keys not tested.",
      "evidence_ids": [
        "R01",
        "R02",
        "R03",
        "R04",
        "R14"
      ],
      "vendor_requirement_assessed": "WerStreamt.es canonical Pro evidence names extra imports from Letterboxd/TMDB/Trakt. It does not supply a field matrix, import transport or full foreign-list fidelity contract. Therefore compare documented named source coverage while exposing Goodwatch methods and exclusions.",
      "vendor_spec_uncertainties": [
        "Official Pro page blocked in this pass; canonical primary dossier retained. Vendor exact method/field fidelity and baseline sources unspecified. Do not convert unspecified transport into an assumed OAuth or list-preservation requirement."
      ],
      "variants": [
        {
          "requirement": "Letterboxd file ingestion",
          "state": "Have"
        },
        {
          "requirement": "TMDB one-time account ingestion",
          "state": "Have",
          "scope": "Configured keys/origin required; source lacks watch history."
        },
        {
          "requirement": "Trakt file ingestion",
          "state": "Have"
        },
        {
          "requirement": "Trakt account connection",
          "state": "Missing",
          "scope": "Separate OP-420, not required merely by named source coverage."
        }
      ],
      "goodwatch_support_inspected": true,
      "deployment_verified": false,
      "externally_blocked_fact": null
    },
    {
      "record_id": "OP-620",
      "competitors": "Flickz",
      "product_ids": "flickz",
      "capability": "Full Taste Identity card",
      "source_free_behavior": "Free card subset unspecified.",
      "source_paid_behavior": "Premium full card.",
      "source_primary_urls": [
        "https://flickz.app/"
      ],
      "entitled_offer_ids": [
        "PLAN-444",
        "PLAN-445"
      ],
      "context_offer_ids": [],
      "state": "Partial",
      "assessment_scope": "Computed personal taste identity, representative titles and shareable full-card output",
      "assessment": "Fingerprint already generates a personal identity name, explanatory line, attribute comparisons and representative titles. No connected shareable computed identity-card image/link/export was found. Generic recommendation cards are not the proof; the actual identity route/builder/render is.",
      "implemented_subset": "Member/qualified-guest fingerprint identity, five families/74 attributes and up to 16 representative titles, with three header posters.",
      "missing_subset": "Publish/download/share the computed personal identity as a card another viewer can open; exact equivalence to every field in Flickz full card is not established.",
      "limits": "Minimum five rated titles with analysis for fingerprint; guests below five get sample taste; unavailable snapshot can prevent result. Current session/guest determines /taste content, so copying /taste does not share the sender identity. Five-title public share cards are manually curated, a different output. Identity can be null unless positive leanings in two different families support it; five ratings alone do not guarantee an archetype name.",
      "evidence_ids": [
        "R12",
        "R13",
        "R08"
      ],
      "vendor_requirement_assessed": "Flickz official page describes a shareable watcher-identity card derived from swipes and representative titles; its Premium section gates the full card. Caption identifies a named watcher archetype. Free subset and full field inventory are not documented.",
      "vendor_spec_uncertainties": [
        "Complete Premium card fields/free truncation remain external specification gaps; screenshot fetch failed and no account was used. Code identity support and missing share output are nevertheless assessed."
      ],
      "variants": [
        {
          "requirement": "Computed named taste identity and representative titles",
          "state": "Have"
        },
        {
          "requirement": "Shareable computed identity-card output",
          "state": "Missing"
        },
        {
          "requirement": "Every field/limit of vendor full Premium card",
          "state": "Partial",
          "scope": "Goodwatch identity display inspected; unpublished vendor field set cannot be mapped completely."
        }
      ],
      "goodwatch_support_inspected": true,
      "deployment_verified": false,
      "externally_blocked_fact": null
    },
    {
      "record_id": "OP-640",
      "competitors": "iCollect Movies / iCollect Everything",
      "product_ids": "icollect",
      "capability": "Self-service desktop CSV import",
      "source_free_behavior": "Other CSV imports support-assisted.",
      "source_paid_behavior": "Pro self-service desktop import; not all imports paid.",
      "source_primary_urls": [
        "https://www.icollecteverything.com/2024/10/26/heres-the-price-differences-and-breakdown-of-our-product-offerings/",
        "https://www.icollecteverything.com/support/"
      ],
      "entitled_offer_ids": [
        "PLAN-462",
        "PLAN-463",
        "PLAN-464"
      ],
      "context_offer_ids": [
        "PLAN-460",
        "PLAN-461",
        "PLAN-465",
        "PLAN-466",
        "PLAN-467",
        "PLAN-513"
      ],
      "state": "Partial",
      "assessment_scope": "Self-service CSV workflow on desktop versus native owned-collection schema/replacement semantics",
      "assessment": "An authenticated desktop-browser user can upload, preview and confirm supported movie-rating/history CSV without support staff. Goodwatch does not implement iCollect native Mac/Windows collection CSV import or its Item-ID/barcode replacement behavior.",
      "implemented_subset": "Real web CSV file chooser/drop, schema validation, preview and user confirmation, with direct application of supported movie rating/watch/review observations.",
      "missing_subset": "Native desktop-app importer for owned/collectible items, Item-ID updates, removal of collection items absent from input, barcode enrichment and collection-specific fields.",
      "limits": "20MiB/50,000 input rows and generated observations; fixed Letterboxd-style fields, unknown columns ignored, tags/directors/rewatch metadata not applied. No field creation/import of owned data. iCollect tutorial itself disallows creating new custom fields and documents replacement/deletion; generic CSV upload must not be presented as that complete schema.",
      "evidence_ids": [
        "R01",
        "R04",
        "R05",
        "R11",
        "R14"
      ],
      "vendor_requirement_assessed": "iCollect support explicitly distinguishes support-assisted CSV imports from Pro self-service Mac/Windows import. Official tutorial uses a collection CSV template/export, updates matching Item IDs, removes existing items missing from CSV, enriches barcode rows and creates new no-ID rows; it cannot create custom fields.",
      "vendor_spec_uncertainties": [
        "Existing vendor lifetime-unlock/Pro prerequisite wording conflict retained; not needed to determine exact Goodwatch CSV workflow. No vendor row/file cap documented in reviewed tutorial."
      ],
      "variants": [
        {
          "requirement": "Self-service supported CSV import from desktop computer",
          "state": "Have",
          "scope": "Web browser, movie rating/history schema only."
        },
        {
          "requirement": "Native desktop owned-collection CSV schema/replacement import",
          "state": "Missing"
        }
      ],
      "goodwatch_support_inspected": true,
      "deployment_verified": false,
      "externally_blocked_fact": null
    }
  ],
  "evidence": {
    "R01": {
      "title": "Connected import UI and upload/connection selection",
      "inspection_bounds": "Settings imports renders ImportSourcesPage and SourceImportFlow. Trakt and Letterboxd are file sources; only TMDB/Plex have connection flows. Production file chooser/drop zone calls preview. No conclusion rests on a logo or source label alone.",
      "sources": [
        {
          "path": "goodwatch-webapp/app/routes/settings.imports.tsx",
          "start_line": 23,
          "end_line": 41,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/settings.imports.tsx#L23-L41"
        },
        {
          "path": "goodwatch-webapp/app/ui/imports/ImportSources.ts",
          "start_line": 57,
          "end_line": 101,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/imports/ImportSources.ts#L57-L101"
        },
        {
          "path": "goodwatch-webapp/app/ui/imports/ImportSourcesPage.tsx",
          "start_line": 132,
          "end_line": 165,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/imports/ImportSourcesPage.tsx#L132-L165"
        },
        {
          "path": "goodwatch-webapp/app/ui/imports/SourceImportFlow.tsx",
          "start_line": 130,
          "end_line": 147,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/imports/SourceImportFlow.tsx#L130-L147"
        },
        {
          "path": "goodwatch-webapp/app/ui/imports/SourceImportUploadPanel.tsx",
          "start_line": 31,
          "end_line": 100,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/imports/SourceImportUploadPanel.tsx#L31-L100"
        },
        {
          "path": "goodwatch-webapp/app/domain/imports.ts",
          "start_line": 101,
          "end_line": 127,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/domain/imports.ts#L101-L127"
        },
        {
          "path": "goodwatch-webapp/app/domain/imports.ts",
          "start_line": 190,
          "end_line": 202,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/domain/imports.ts#L190-L202"
        }
      ]
    },
    "R02": {
      "title": "Trakt file ingestion; account connection absent",
      "inspection_bounds": "The export ZIP parser explicitly consumes watched-history, movie/show ratings, Watchlist and favorites JSON, including episode coordinates. Custom Trakt lists and episode/season ratings become unsupported items. Existing connection-source type is TMDB/Plex only. Production app scan found no Trakt API/OAuth endpoint/client/token configuration; similarly named Trakt trend counts are public catalog signals, not member account connection. Generic Goodwatch/MCP OAuth is not Trakt authorization.",
      "sources": [
        {
          "path": "goodwatch-webapp/app/server/imports/files.server.ts",
          "start_line": 497,
          "end_line": 525,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/imports/files.server.ts#L497-L525"
        },
        {
          "path": "goodwatch-webapp/app/server/imports/files.server.ts",
          "start_line": 550,
          "end_line": 688,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/imports/files.server.ts#L550-L688"
        },
        {
          "path": "goodwatch-webapp/app/server/imports/connect-store.server.ts",
          "start_line": 1,
          "end_line": 15,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/imports/connect-store.server.ts#L1-L15"
        },
        {
          "path": "goodwatch-webapp/app/domain/imports.ts",
          "start_line": 109,
          "end_line": 117,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/domain/imports.ts#L109-L117"
        },
        {
          "path": "goodwatch-webapp/app/ui/imports/SourceImportFlow.tsx",
          "start_line": 130,
          "end_line": 147,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/imports/SourceImportFlow.tsx#L130-L147"
        }
      ]
    },
    "R03": {
      "title": "TMDB one-time account import",
      "inspection_bounds": "Connected TMDB panel posts to actual route/runtime, obtains account lists then revokes temporary access before preview. Reads movie/show rated/watchlist/favorite lists, with 50,000 total observations and five-minute read deadline. TMDB provides no rating dates/watch history; episode ratings not read. Requires configured API/connect keys, site origin and a signed-in member. This is account ingestion, not scraping a public list URL or ongoing sync.",
      "sources": [
        {
          "path": "goodwatch-webapp/app/ui/imports/TmdbConnectPanel.tsx",
          "start_line": 18,
          "end_line": 30,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/imports/TmdbConnectPanel.tsx#L18-L30"
        },
        {
          "path": "goodwatch-webapp/app/ui/imports/TmdbConnectPanel.tsx",
          "start_line": 48,
          "end_line": 70,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/imports/TmdbConnectPanel.tsx#L48-L70"
        },
        {
          "path": "goodwatch-webapp/app/routes/api.imports.tmdb.$step.ts",
          "start_line": 1,
          "end_line": 7,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/api.imports.tmdb.$step.ts#L1-L7"
        },
        {
          "path": "goodwatch-webapp/app/server/imports/tmdb-connect-runtime.server.ts",
          "start_line": 7,
          "end_line": 20,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/imports/tmdb-connect-runtime.server.ts#L7-L20"
        },
        {
          "path": "goodwatch-webapp/app/server/imports/tmdb-connect.server.ts",
          "start_line": 175,
          "end_line": 235,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/imports/tmdb-connect.server.ts#L175-L235"
        },
        {
          "path": "goodwatch-webapp/app/server/imports/tmdb-client.server.ts",
          "start_line": 211,
          "end_line": 255,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/imports/tmdb-client.server.ts#L211-L255"
        },
        {
          "path": "goodwatch-webapp/app/server/imports/tmdb-client.server.ts",
          "start_line": 282,
          "end_line": 322,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/imports/tmdb-client.server.ts#L282-L322"
        }
      ]
    },
    "R04": {
      "title": "Preview, confirmation and real per-record application",
      "inspection_bounds": "File endpoint invokes previewImport for authenticated member, then confirmation chooses import kinds/conflict/date policy. confirmImport claims the import and runs applyRun. Intent/favorite writes are keyed user/title; ratings/reviews and watches use their dedicated application paths. The import is therefore connected beyond parsing. Rows already present or changed here are handled by explicit preservation/conflict policy; importing is not blanket replacement/deletion of an owned collection.",
      "sources": [
        {
          "path": "goodwatch-webapp/app/routes/api.imports.preview.ts",
          "start_line": 53,
          "end_line": 98,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/api.imports.preview.ts#L53-L98"
        },
        {
          "path": "goodwatch-webapp/app/routes/api.imports.$id.confirm.ts",
          "start_line": 7,
          "end_line": 28,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/api.imports.$id.confirm.ts#L7-L28"
        },
        {
          "path": "goodwatch-webapp/app/server/imports/service.server.ts",
          "start_line": 15,
          "end_line": 44,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/imports/service.server.ts#L15-L44"
        },
        {
          "path": "goodwatch-webapp/app/server/imports/apply.server.ts",
          "start_line": 310,
          "end_line": 380,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/imports/apply.server.ts#L310-L380"
        },
        {
          "path": "goodwatch-webapp/app/server/imports/apply.server.ts",
          "start_line": 480,
          "end_line": 534,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/imports/apply.server.ts#L480-L534"
        },
        {
          "path": "goodwatch-webapp/app/server/imports/apply.server.ts",
          "start_line": 565,
          "end_line": 601,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/imports/apply.server.ts#L565-L601"
        }
      ]
    },
    "R05": {
      "title": "Generic CSV schema and exact limits",
      "inspection_bounds": "CSV upload path is real and self-service in a desktop browser, but schema is movie-centric Letterboxd-style data. Header aliases are normalized; known fields are fixed. Unknown columns are ignored with warning, tags/directors/rewatch metadata not applied. A name-only row without rating, watch date or review is invalid; Title/Year fallback needs a unique exact title/year match. Rating10 is whole 1–10, Rating is half-step 0.5–5; WatchedDate creates day watches; reviews truncated20,000 chars. It is not an iCollect edition/ownership/barcode/Item-ID replacement import.",
      "sources": [
        {
          "path": "goodwatch-webapp/app/ui/imports/SourceImportUpload.ts",
          "start_line": 8,
          "end_line": 37,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/imports/SourceImportUpload.ts#L8-L37"
        },
        {
          "path": "goodwatch-webapp/app/domain/imports.ts",
          "start_line": 118,
          "end_line": 124,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/domain/imports.ts#L118-L124"
        },
        {
          "path": "goodwatch-webapp/app/server/imports/files.server.ts",
          "start_line": 745,
          "end_line": 813,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/imports/files.server.ts#L745-L813"
        },
        {
          "path": "goodwatch-webapp/app/server/imports/files.server.ts",
          "start_line": 817,
          "end_line": 902,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/imports/files.server.ts#L817-L902"
        },
        {
          "path": "goodwatch-webapp/app/server/imports/preview.server.ts",
          "start_line": 243,
          "end_line": 268,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/imports/preview.server.ts#L243-L268"
        }
      ]
    },
    "R06": {
      "title": "Structured name-based Wishlist import and manual matching",
      "inspection_bounds": "Wishlist JSON must use goodwatch-wishlist envelope version1 or1.1, with source/completeness/items; it is not a plain newline list. Movie/show names with year can use unique exact title/year fallback. Unknown-media items preserve source evidence and can be matched by searching/picking a catalog result in the connected preview panel. Typed movie/show name-only rows lacking ID/year remain unmatched; the eligibility predicate does not enable generic manual repair for all typed rows. No user Enable Fuzzy match option or Trakt list write destination in this flow.",
      "sources": [
        {
          "path": "goodwatch-webapp/app/domain/imports.ts",
          "start_line": 172,
          "end_line": 189,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/domain/imports.ts#L172-L189"
        },
        {
          "path": "goodwatch-webapp/app/server/imports/wishlist.server.ts",
          "start_line": 38,
          "end_line": 84,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/imports/wishlist.server.ts#L38-L84"
        },
        {
          "path": "goodwatch-webapp/app/server/imports/wishlist.server.ts",
          "start_line": 235,
          "end_line": 278,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/imports/wishlist.server.ts#L235-L278"
        },
        {
          "path": "goodwatch-webapp/app/server/imports/preview.server.ts",
          "start_line": 243,
          "end_line": 268,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/imports/preview.server.ts#L243-L268"
        },
        {
          "path": "goodwatch-webapp/app/server/imports/wishlist-evidence.server.ts",
          "start_line": 17,
          "end_line": 34,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/imports/wishlist-evidence.server.ts#L17-L34"
        },
        {
          "path": "goodwatch-webapp/app/server/imports/wishlist-resolution.server.ts",
          "start_line": 429,
          "end_line": 486,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/imports/wishlist-resolution.server.ts#L429-L486"
        },
        {
          "path": "goodwatch-webapp/app/ui/imports/WishlistMatchPanel.tsx",
          "start_line": 1,
          "end_line": 45,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/imports/WishlistMatchPanel.tsx#L1-L45"
        },
        {
          "path": "goodwatch-webapp/app/ui/imports/WishlistImportPreview.tsx",
          "start_line": 350,
          "end_line": 378,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/imports/WishlistImportPreview.tsx#L350-L378"
        }
      ]
    },
    "R07": {
      "title": "MCP name batches are a concrete additional subset",
      "inspection_bounds": "MCP title writes accept up to50 name selectors with optional year. Each name goes through full-text catalog lookup, prefers normalized exact-name matches, and accepts only one result; ambiguities return choices instead of writing that item. set_want_to_see routes batch membership to actual Wishlist writer. No free-form pasted-name import UI, fuzzy-match toggle, arbitrary-length static-list destination or external Trakt list writer. OAuth/config/tool gates and rate budgets qualify this code Have subset.",
      "sources": [
        {
          "path": "goodwatch-webapp/app/server/mcp/data.server.ts",
          "start_line": 237,
          "end_line": 316,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/data.server.ts#L237-L316"
        },
        {
          "path": "goodwatch-webapp/app/server/mcp/batch.server.ts",
          "start_line": 21,
          "end_line": 35,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/batch.server.ts#L21-L35"
        },
        {
          "path": "goodwatch-webapp/app/server/mcp/batch.server.ts",
          "start_line": 281,
          "end_line": 307,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/batch.server.ts#L281-L307"
        },
        {
          "path": "goodwatch-webapp/app/server/mcp/batch.server.ts",
          "start_line": 350,
          "end_line": 380,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/batch.server.ts#L350-L380"
        },
        {
          "path": "goodwatch-webapp/app/server/mcp/write-tools.server.ts",
          "start_line": 143,
          "end_line": 157,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/write-tools.server.ts#L143-L157"
        },
        {
          "path": "goodwatch-webapp/app/server/mcp/write-tools.server.ts",
          "start_line": 197,
          "end_line": 204,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/write-tools.server.ts#L197-L204"
        },
        {
          "path": "goodwatch-webapp/app/server/mcp/policy.server.ts",
          "start_line": 1,
          "end_line": 23,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/policy.server.ts#L1-L23"
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
        }
      ]
    },
    "R08": {
      "title": "Actual manual share-list model, writer and editor",
      "inspection_bounds": "Named lists accept exactly five unique resolvable movie/show keys; parser rejects person keys. Create validates per-list uniqueness only, so a title may occur in multiple independent lists. Create requires public handle and inserts without account-list-count guard. Production editor adds/removes/reorders ranks and persists them; cannot publish an empty or arbitrary-length list. Public/unlisted is not a private organizing Space or typed Owned/Seen/Watch collection.",
      "sources": [
        {
          "path": "goodwatch-webapp/app/server/share-lists/store.server.ts",
          "start_line": 19,
          "end_line": 44,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/share-lists/store.server.ts#L19-L44"
        },
        {
          "path": "goodwatch-webapp/app/server/share-lists/store.server.ts",
          "start_line": 93,
          "end_line": 111,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/share-lists/store.server.ts#L93-L111"
        },
        {
          "path": "goodwatch-webapp/app/server/share-lists/store.server.ts",
          "start_line": 123,
          "end_line": 146,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/share-lists/store.server.ts#L123-L146"
        },
        {
          "path": "goodwatch-webapp/app/server/share-lists/store.server.ts",
          "start_line": 149,
          "end_line": 175,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/share-lists/store.server.ts#L149-L175"
        },
        {
          "path": "goodwatch-webapp/app/server/share-lists/titles.server.ts",
          "start_line": 41,
          "end_line": 49,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/share-lists/titles.server.ts#L41-L49"
        },
        {
          "path": "goodwatch-webapp/app/ui/share-list-editor/Ranking.tsx",
          "start_line": 27,
          "end_line": 95,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/share-list-editor/Ranking.tsx#L27-L95"
        },
        {
          "path": "goodwatch-webapp/app/ui/share-list-editor/list-state.ts",
          "start_line": 81,
          "end_line": 112,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/share-list-editor/list-state.ts#L81-L112"
        },
        {
          "path": "goodwatch-webapp/app/ui/share-list-editor/ShareFlow.tsx",
          "start_line": 59,
          "end_line": 77,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/share-list-editor/ShareFlow.tsx#L59-L77"
        }
      ]
    },
    "R09": {
      "title": "List-count reader bounds and consumers",
      "inspection_bounds": "Owner reader LIMIT200 and public reader LIMIT200 have no continuation. Owner/public profile renders returned lists; MCP readLists paginates after the bounded owner read, not before. Thus absence of a writer count guard does not promise unlimited list visibility. Numbers count lists, separately from exactly-five items/list. Basic20/Standard60/Plus80/VIP5 120 fit within that reader window in code, but this is not large-library runtime verification or general MDBList static-list parity; VIP10 300/VIP15 400/VIP20 600 exceed it.",
      "sources": [
        {
          "path": "goodwatch-webapp/app/server/share-lists/store.server.ts",
          "start_line": 123,
          "end_line": 125,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/share-lists/store.server.ts#L123-L125"
        },
        {
          "path": "goodwatch-webapp/app/server/share-lists/view.server.ts",
          "start_line": 134,
          "end_line": 139,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/share-lists/view.server.ts#L134-L139"
        },
        {
          "path": "goodwatch-webapp/app/server/share-lists/page-loaders.server.ts",
          "start_line": 115,
          "end_line": 159,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/share-lists/page-loaders.server.ts#L115-L159"
        },
        {
          "path": "goodwatch-webapp/app/routes/u.$handle._index.tsx",
          "start_line": 108,
          "end_line": 125,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/u.$handle._index.tsx#L108-L125"
        },
        {
          "path": "goodwatch-webapp/app/server/mcp/lists.server.ts",
          "start_line": 59,
          "end_line": 83,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/lists.server.ts#L59-L83"
        }
      ]
    },
    "R10": {
      "title": "My shows and status-library groups are derived, not custom lists",
      "inspection_bounds": "My shows domain fixes Continue, Start, Pick up, Waiting, On hold and Dropped groups and derives membership/order from status, activity and Wishlist. Route passes member context to getMyShows. Library statuses are fixed Want/Seen/Watching/On hold/Dropped/Not rated with status/type/query/sort choices. No group ID/name/member editor or user-defined group storage is accepted by these consumers. Renaming a top 5 share card does not change My shows grouping.",
      "sources": [
        {
          "path": "CONTEXT.md",
          "start_line": 65,
          "end_line": 86,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/CONTEXT.md#L65-L86"
        },
        {
          "path": "goodwatch-webapp/app/domain/my-shows.ts",
          "start_line": 65,
          "end_line": 79,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/domain/my-shows.ts#L65-L79"
        },
        {
          "path": "goodwatch-webapp/app/domain/my-shows.ts",
          "start_line": 91,
          "end_line": 166,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/domain/my-shows.ts#L91-L166"
        },
        {
          "path": "goodwatch-webapp/app/routes/my-shows.tsx",
          "start_line": 49,
          "end_line": 61,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/my-shows.tsx#L49-L61"
        },
        {
          "path": "goodwatch-webapp/app/server/my-shows.server.ts",
          "start_line": 398,
          "end_line": 464,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/my-shows.server.ts#L398-L464"
        },
        {
          "path": "goodwatch-webapp/app/domain/my-library.ts",
          "start_line": 7,
          "end_line": 64,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/domain/my-library.ts#L7-L64"
        },
        {
          "path": "goodwatch-webapp/app/server/my-library.server.ts",
          "start_line": 151,
          "end_line": 173,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/my-library.server.ts#L151-L173"
        }
      ]
    },
    "R11": {
      "title": "Personal state and public people lookup are not owned/people collections",
      "inspection_bounds": "UserData stores title scores/Wishlist/watchState/favorites/skipped/notInterested keyed movie/show IDs, no owned-edition or named status-list membership. Wishlist writer takes user/title key, no list ID. Person lookup displays catalog data without user saved-person-list fields. Share-list parser cannot accept person keys and its model has no Watch/Seen/Owned type. Library franchise collection lookup is catalog-only. Scoped model/writer/reader/API inspection establishes missing typed ownership/people/custom status-list controls.",
      "sources": [
        {
          "path": "goodwatch-webapp/app/types/user-data.ts",
          "start_line": 6,
          "end_line": 40,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/types/user-data.ts#L6-L40"
        },
        {
          "path": "goodwatch-webapp/app/server/wishList.server.ts",
          "start_line": 24,
          "end_line": 68,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/wishList.server.ts#L24-L68"
        },
        {
          "path": "goodwatch-webapp/app/server/share-lists/titles.server.ts",
          "start_line": 41,
          "end_line": 49,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/share-lists/titles.server.ts#L41-L49"
        },
        {
          "path": "goodwatch-webapp/app/server/share-lists/store.server.ts",
          "start_line": 19,
          "end_line": 44,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/share-lists/store.server.ts#L19-L44"
        },
        {
          "path": "goodwatch-webapp/app/server/person.server.ts",
          "start_line": 537,
          "end_line": 546,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/person.server.ts#L537-L546"
        },
        {
          "path": "goodwatch-webapp/app/server/collection.server.ts",
          "start_line": 25,
          "end_line": 44,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/collection.server.ts#L25-L44"
        },
        {
          "path": "goodwatch-webapp/app/domain/my-library.ts",
          "start_line": 7,
          "end_line": 36,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/domain/my-library.ts#L7-L36"
        }
      ]
    },
    "R12": {
      "title": "Real personal taste identity and representative titles",
      "inspection_bounds": "Production /taste/fingerprint route loads the member/guest portrait and renders Fingerprint. Builder computes named identity from five families/74 attributes, with minimum five rated titles carrying analysis and up to 16 representative titles. UI renders identity name, explanation, attribute comparisons and representative posters, with three header posters. Guests under five ratings see sample taste; snapshot availability can produce unavailable view. No subscription branch in these inspected paths. Identity name additionally requires a positive leaning supported by another fingerprint family; it can be null even after the five-title minimum.",
      "sources": [
        {
          "path": "goodwatch-webapp/app/routes/taste.fingerprint.tsx",
          "start_line": 28,
          "end_line": 42,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/taste.fingerprint.tsx#L28-L42"
        },
        {
          "path": "goodwatch-webapp/app/server/taste-portrait/index.server.ts",
          "start_line": 65,
          "end_line": 95,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/taste-portrait/index.server.ts#L65-L95"
        },
        {
          "path": "goodwatch-webapp/app/server/taste-portrait/index.server.ts",
          "start_line": 100,
          "end_line": 128,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/taste-portrait/index.server.ts#L100-L128"
        },
        {
          "path": "goodwatch-webapp/app/server/taste-portrait/fingerprint.server.ts",
          "start_line": 1,
          "end_line": 32,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/taste-portrait/fingerprint.server.ts#L1-L32"
        },
        {
          "path": "goodwatch-webapp/app/server/taste-portrait/fingerprint.server.ts",
          "start_line": 48,
          "end_line": 61,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/taste-portrait/fingerprint.server.ts#L48-L61"
        },
        {
          "path": "goodwatch-webapp/app/ui/taste/tabs/Fingerprint.tsx",
          "start_line": 84,
          "end_line": 139,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/taste/tabs/Fingerprint.tsx#L84-L139"
        },
        {
          "path": "goodwatch-webapp/app/ui/taste/tabs/Fingerprint.tsx",
          "start_line": 244,
          "end_line": 256,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/taste/tabs/Fingerprint.tsx#L244-L256"
        },
        {
          "path": "goodwatch-webapp/app/routes/api.taste.portrait.ts",
          "start_line": 17,
          "end_line": 35,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/api.taste.portrait.ts#L17-L35"
        },
        {
          "path": "goodwatch-webapp/app/server/taste-portrait/fingerprint.server.ts",
          "start_line": 197,
          "end_line": 235,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/taste-portrait/fingerprint.server.ts#L197-L235"
        }
      ]
    },
    "R13": {
      "title": "No connected shareable taste-identity card",
      "inspection_bounds": "Taste API chooses current session/guest viewer and returns private,no-store personal view, not a share ID for another viewer. Production Taste tabs/routes and taste-portrait modules have no navigator.share/image-download/blob-export/shareUrl control. Existing public card endpoint/viewer consumes ShareList, and public profile renders share lists only. A manually curated top 5 card and copying /taste URL do not publish the computed identity portrait. Negative bound: these consumer/API/card/profile paths, excluding prototype routes.",
      "sources": [
        {
          "path": "goodwatch-webapp/app/routes/api.taste.portrait.ts",
          "start_line": 43,
          "end_line": 47,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/api.taste.portrait.ts#L43-L47"
        },
        {
          "path": "goodwatch-webapp/app/server/taste-portrait/index.server.ts",
          "start_line": 65,
          "end_line": 81,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/taste-portrait/index.server.ts#L65-L81"
        },
        {
          "path": "goodwatch-webapp/app/ui/taste/tabs/Fingerprint.tsx",
          "start_line": 84,
          "end_line": 139,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/taste/tabs/Fingerprint.tsx#L84-L139"
        },
        {
          "path": "goodwatch-webapp/app/ui/taste/tabs/Fingerprint.tsx",
          "start_line": 244,
          "end_line": 259,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/taste/tabs/Fingerprint.tsx#L244-L259"
        },
        {
          "path": "goodwatch-webapp/app/routes/og.lists.$id.$file.tsx",
          "start_line": 1,
          "end_line": 73,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/og.lists.$id.$file.tsx#L1-L73"
        },
        {
          "path": "goodwatch-webapp/app/routes/u.$handle._index.tsx",
          "start_line": 108,
          "end_line": 125,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/u.$handle._index.tsx#L108-L125"
        },
        {
          "path": "goodwatch-webapp/app/server/share-lists/view.server.ts",
          "start_line": 76,
          "end_line": 84,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/share-lists/view.server.ts#L76-L84"
        }
      ]
    },
    "R14": {
      "title": "Import size/security/gates are separate from paid availability",
      "inspection_bounds": "Uploads are limited20×1024² bytes, with a21MiB multipart envelope allowance; CSV/input rows and resulting import observations capped50,000. ZIP expansion bounded200 files (normal Letterboxd/Trakt path),32MiB/entry and64MiB total. Member/authenticated routes have no paid-tier test, but database absence returns503 and TMDB requires deployed keys/origin. Actual deployment, server options and external credentials not exercised. Reading code establishes bounded support; it is not unlimited import or operational parity proof.",
      "sources": [
        {
          "path": "goodwatch-webapp/app/domain/imports.ts",
          "start_line": 28,
          "end_line": 29,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/domain/imports.ts#L28-L29"
        },
        {
          "path": "goodwatch-webapp/app/domain/imports.ts",
          "start_line": 251,
          "end_line": 251,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/domain/imports.ts#L251-L251"
        },
        {
          "path": "goodwatch-webapp/app/routes/api.imports.preview.ts",
          "start_line": 12,
          "end_line": 21,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/api.imports.preview.ts#L12-L21"
        },
        {
          "path": "goodwatch-webapp/app/routes/api.imports.preview.ts",
          "start_line": 74,
          "end_line": 95,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/api.imports.preview.ts#L74-L95"
        },
        {
          "path": "goodwatch-webapp/app/server/imports/files.server.ts",
          "start_line": 15,
          "end_line": 18,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/imports/files.server.ts#L15-L18"
        },
        {
          "path": "goodwatch-webapp/app/server/imports/files.server.ts",
          "start_line": 235,
          "end_line": 247,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/imports/files.server.ts#L235-L247"
        },
        {
          "path": "goodwatch-webapp/app/server/imports/files.server.ts",
          "start_line": 745,
          "end_line": 763,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/imports/files.server.ts#L745-L763"
        },
        {
          "path": "goodwatch-webapp/app/server/imports/files.server.ts",
          "start_line": 899,
          "end_line": 902,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/imports/files.server.ts#L899-L902"
        },
        {
          "path": "goodwatch-webapp/app/server/imports/http.server.ts",
          "start_line": 9,
          "end_line": 35,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/imports/http.server.ts#L9-L35"
        },
        {
          "path": "goodwatch-webapp/app/server/imports/tmdb-connect-runtime.server.ts",
          "start_line": 7,
          "end_line": 20,
          "url": "https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/imports/tmdb-connect-runtime.server.ts#L7-L20"
        }
      ]
    }
  },
  "source_plan_offers": {
    "PLAN-326": {
      "product_id": "watchnext-app",
      "product": "WatchNext.app",
      "offer_name": "Unlimited",
      "platform": "Web",
      "billing_period": "month",
      "entitlement_group_id": "EG-watchnext-app-unlimited",
      "qualification": "Detailed FAQ/terms three-tier model provisional against homepage Premium/calendar/Wrapped/unlimited conflict. US operation suggests USD but source has bare$; currency code not verified. Retention delete/archive contradiction and data-licensing opt-out retained."
    },
    "PLAN-327": {
      "product_id": "watchnext-app",
      "product": "WatchNext.app",
      "offer_name": "Unlimited",
      "platform": "Web",
      "billing_period": "year",
      "entitlement_group_id": "EG-watchnext-app-unlimited",
      "qualification": "Detailed FAQ/terms three-tier model provisional against homepage Premium/calendar/Wrapped/unlimited conflict. US operation suggests USD but source has bare$; currency code not verified. Retention delete/archive contradiction and data-licensing opt-out retained."
    },
    "PLAN-350": {
      "product_id": "movie-tracker-montalto",
      "product": "Movie Tracker — Simone Montalto",
      "offer_name": "Pro",
      "platform": "US Apple App Store",
      "billing_period": "month",
      "entitlement_group_id": "EG-movie-tracker-montalto-pro-us-apple",
      "qualification": "Same lifetime/subscription functionality per publisher; unlimited items/Spaces documented, not all advertised tools individually gated."
    },
    "PLAN-351": {
      "product_id": "movie-tracker-montalto",
      "product": "Movie Tracker — Simone Montalto",
      "offer_name": "Pro",
      "platform": "US Apple App Store",
      "billing_period": "year",
      "entitlement_group_id": "EG-movie-tracker-montalto-pro-us-apple",
      "qualification": "Same lifetime/subscription functionality per publisher; unlimited items/Spaces documented, not all advertised tools individually gated."
    },
    "PLAN-352": {
      "product_id": "movie-tracker-montalto",
      "product": "Movie Tracker — Simone Montalto",
      "offer_name": "Pro",
      "platform": "US Apple App Store",
      "billing_period": "lifetime one-time",
      "entitlement_group_id": "EG-movie-tracker-montalto-pro-us-apple",
      "qualification": "Same lifetime/subscription functionality per publisher; unlimited items/Spaces documented, not all advertised tools individually gated."
    },
    "PLAN-354": {
      "product_id": "callsheet",
      "product": "Callsheet",
      "offer_name": "Monthly",
      "platform": "US Apple App Store",
      "billing_period": "month",
      "entitlement_group_id": "EG-callsheet-subscription-us-apple",
      "qualification": "20free searches;1week trial;Family Sharing advertised, exact household count unknown. Higher support amounts do not add functionality."
    },
    "PLAN-355": {
      "product_id": "callsheet",
      "product": "Callsheet",
      "offer_name": "Yearly",
      "platform": "US Apple App Store",
      "billing_period": "year",
      "entitlement_group_id": "EG-callsheet-subscription-us-apple",
      "qualification": "20free searches;1week trial;Family Sharing advertised, exact household count unknown. Higher support amounts do not add functionality."
    },
    "PLAN-356": {
      "product_id": "callsheet",
      "product": "Callsheet",
      "offer_name": "Yearly Max-Supporter",
      "platform": "US Apple App Store",
      "billing_period": "year",
      "entitlement_group_id": "EG-callsheet-subscription-us-apple",
      "qualification": "20free searches;1week trial;Family Sharing advertised, exact household count unknown. Higher support amounts do not add functionality."
    },
    "PLAN-357": {
      "product_id": "callsheet",
      "product": "Callsheet",
      "offer_name": "Yearly Ultra-Supporter",
      "platform": "US Apple App Store",
      "billing_period": "year",
      "entitlement_group_id": "EG-callsheet-subscription-us-apple",
      "qualification": "20free searches;1week trial;Family Sharing advertised, exact household count unknown. Higher support amounts do not add functionality."
    },
    "PLAN-375": {
      "product_id": "episodecalendar",
      "product": "TV Episode Calendar / EpisodeCalendar",
      "offer_name": "Premium",
      "platform": "Web",
      "billing_period": "unknown",
      "entitlement_group_id": "EG-episodecalendar-premium-web",
      "qualification": "Purchase page requires login; current amount/currency/period unverified. Basic20shows; previous shows retained; free feeds have inaccurate air times."
    },
    "PLAN-382": {
      "product_id": "mdblist",
      "product": "MDBList / Reeel",
      "offer_name": "Basic",
      "platform": "Web",
      "billing_period": "month",
      "entitlement_group_id": "EG-mdblist-basic-web",
      "qualification": "EUR no selected country/tax assumption; daily caps plus shared1000reads/300writes per5minutes. Basic doc label1EUR differs from monthly1.20EUR. Caps must follow this level, not family maxima."
    },
    "PLAN-383": {
      "product_id": "mdblist",
      "product": "MDBList / Reeel",
      "offer_name": "Basic",
      "platform": "Web",
      "billing_period": "year",
      "entitlement_group_id": "EG-mdblist-basic-web",
      "qualification": "EUR no selected country/tax assumption; daily caps plus shared1000reads/300writes per5minutes. Basic doc label1EUR differs from monthly1.20EUR. Caps must follow this level, not family maxima."
    },
    "PLAN-384": {
      "product_id": "mdblist",
      "product": "MDBList / Reeel",
      "offer_name": "Standard",
      "platform": "Web",
      "billing_period": "month",
      "entitlement_group_id": "EG-mdblist-standard-web",
      "qualification": "EUR no selected country/tax assumption; daily caps plus shared1000reads/300writes per5minutes. Basic doc label1EUR differs from monthly1.20EUR. Caps must follow this level, not family maxima."
    },
    "PLAN-385": {
      "product_id": "mdblist",
      "product": "MDBList / Reeel",
      "offer_name": "Standard",
      "platform": "Web",
      "billing_period": "year",
      "entitlement_group_id": "EG-mdblist-standard-web",
      "qualification": "EUR no selected country/tax assumption; daily caps plus shared1000reads/300writes per5minutes. Basic doc label1EUR differs from monthly1.20EUR. Caps must follow this level, not family maxima."
    },
    "PLAN-386": {
      "product_id": "mdblist",
      "product": "MDBList / Reeel",
      "offer_name": "Plus",
      "platform": "Web",
      "billing_period": "month",
      "entitlement_group_id": "EG-mdblist-plus-web",
      "qualification": "EUR no selected country/tax assumption; daily caps plus shared1000reads/300writes per5minutes. Basic doc label1EUR differs from monthly1.20EUR. Caps must follow this level, not family maxima."
    },
    "PLAN-387": {
      "product_id": "mdblist",
      "product": "MDBList / Reeel",
      "offer_name": "Plus",
      "platform": "Web",
      "billing_period": "year",
      "entitlement_group_id": "EG-mdblist-plus-web",
      "qualification": "EUR no selected country/tax assumption; daily caps plus shared1000reads/300writes per5minutes. Basic doc label1EUR differs from monthly1.20EUR. Caps must follow this level, not family maxima."
    },
    "PLAN-388": {
      "product_id": "mdblist",
      "product": "MDBList / Reeel",
      "offer_name": "VIP 5",
      "platform": "Web",
      "billing_period": "month",
      "entitlement_group_id": "EG-mdblist-vip-5-web",
      "qualification": "EUR no selected country/tax assumption; daily caps plus shared1000reads/300writes per5minutes. Basic doc label1EUR differs from monthly1.20EUR. Caps must follow this level, not family maxima."
    },
    "PLAN-389": {
      "product_id": "mdblist",
      "product": "MDBList / Reeel",
      "offer_name": "VIP 5",
      "platform": "Web",
      "billing_period": "year",
      "entitlement_group_id": "EG-mdblist-vip-5-web",
      "qualification": "EUR no selected country/tax assumption; daily caps plus shared1000reads/300writes per5minutes. Basic doc label1EUR differs from monthly1.20EUR. Caps must follow this level, not family maxima."
    },
    "PLAN-390": {
      "product_id": "mdblist",
      "product": "MDBList / Reeel",
      "offer_name": "VIP 10",
      "platform": "Web",
      "billing_period": "month",
      "entitlement_group_id": "EG-mdblist-vip-10-web",
      "qualification": "EUR no selected country/tax assumption; daily caps plus shared1000reads/300writes per5minutes. Basic doc label1EUR differs from monthly1.20EUR. Caps must follow this level, not family maxima."
    },
    "PLAN-391": {
      "product_id": "mdblist",
      "product": "MDBList / Reeel",
      "offer_name": "VIP 10",
      "platform": "Web",
      "billing_period": "year",
      "entitlement_group_id": "EG-mdblist-vip-10-web",
      "qualification": "EUR no selected country/tax assumption; daily caps plus shared1000reads/300writes per5minutes. Basic doc label1EUR differs from monthly1.20EUR. Caps must follow this level, not family maxima."
    },
    "PLAN-392": {
      "product_id": "mdblist",
      "product": "MDBList / Reeel",
      "offer_name": "VIP 15",
      "platform": "Web",
      "billing_period": "month",
      "entitlement_group_id": "EG-mdblist-vip-15-web",
      "qualification": "EUR no selected country/tax assumption; daily caps plus shared1000reads/300writes per5minutes. Basic doc label1EUR differs from monthly1.20EUR. Caps must follow this level, not family maxima."
    },
    "PLAN-393": {
      "product_id": "mdblist",
      "product": "MDBList / Reeel",
      "offer_name": "VIP 15",
      "platform": "Web",
      "billing_period": "year",
      "entitlement_group_id": "EG-mdblist-vip-15-web",
      "qualification": "EUR no selected country/tax assumption; daily caps plus shared1000reads/300writes per5minutes. Basic doc label1EUR differs from monthly1.20EUR. Caps must follow this level, not family maxima."
    },
    "PLAN-394": {
      "product_id": "mdblist",
      "product": "MDBList / Reeel",
      "offer_name": "VIP 20",
      "platform": "Web",
      "billing_period": "month",
      "entitlement_group_id": "EG-mdblist-vip-20-web",
      "qualification": "EUR no selected country/tax assumption; daily caps plus shared1000reads/300writes per5minutes. Basic doc label1EUR differs from monthly1.20EUR. Caps must follow this level, not family maxima."
    },
    "PLAN-395": {
      "product_id": "mdblist",
      "product": "MDBList / Reeel",
      "offer_name": "VIP 20",
      "platform": "Web",
      "billing_period": "year",
      "entitlement_group_id": "EG-mdblist-vip-20-web",
      "qualification": "EUR no selected country/tax assumption; daily caps plus shared1000reads/300writes per5minutes. Basic doc label1EUR differs from monthly1.20EUR. Caps must follow this level, not family maxima."
    },
    "PLAN-420": {
      "product_id": "werstreamt-es",
      "product": "WerStreamt.es",
      "offer_name": "Pro",
      "platform": "Web",
      "billing_period": "month",
      "entitlement_group_id": "EG-werstreamt-es-pro-web",
      "qualification": "Germany web;annual7daytrial;paid controls disabled but lists retained after cancellation;app/web applies, implementation not tested."
    },
    "PLAN-421": {
      "product_id": "werstreamt-es",
      "product": "WerStreamt.es",
      "offer_name": "Pro",
      "platform": "Web",
      "billing_period": "year",
      "entitlement_group_id": "EG-werstreamt-es-pro-web",
      "qualification": "Germany web;annual7daytrial;paid controls disabled but lists retained after cancellation;app/web applies, implementation not tested."
    },
    "PLAN-422": {
      "product_id": "werstreamt-es",
      "product": "WerStreamt.es",
      "offer_name": "Pro",
      "platform": "Apple App Store",
      "billing_period": "unknown",
      "entitlement_group_id": "EG-werstreamt-es-pro-apple-app-store",
      "qualification": "Publisher says app/webPro; current store amounts/periods unverified, no web price transfer."
    },
    "PLAN-423": {
      "product_id": "werstreamt-es",
      "product": "WerStreamt.es",
      "offer_name": "Pro",
      "platform": "Google Play Android",
      "billing_period": "unknown",
      "entitlement_group_id": "EG-werstreamt-es-pro-google-play-android",
      "qualification": "Publisher says app/webPro; current store amounts/periods unverified, no web price transfer."
    },
    "PLAN-444": {
      "product_id": "flickz",
      "product": "Flickz",
      "offer_name": "Premium",
      "platform": "Web",
      "billing_period": "month",
      "entitlement_group_id": "EG-flickz-premium-web",
      "qualification": "Bare$ currency/country unspecified;trial duration unknown;match quality not tested."
    },
    "PLAN-445": {
      "product_id": "flickz",
      "product": "Flickz",
      "offer_name": "Premium",
      "platform": "Web",
      "billing_period": "year",
      "entitlement_group_id": "EG-flickz-premium-web",
      "qualification": "Bare$ currency/country unspecified;trial duration unknown;match quality not tested."
    },
    "PLAN-462": {
      "product_id": "icollect",
      "product": "iCollect Movies / iCollect Everything",
      "offer_name": "Pro",
      "platform": "Web",
      "billing_period": "year",
      "entitlement_group_id": "EG-icollect-pro-web",
      "qualification": "Article desktopPro requires prior lifetime mobile;current support Pro includes allcollections and21features. Conflict unresolved;do not require both or promise lifetimePro."
    },
    "PLAN-463": {
      "product_id": "icollect",
      "product": "iCollect Movies / iCollect Everything",
      "offer_name": "Pro",
      "platform": "Apple App Store",
      "billing_period": "year",
      "entitlement_group_id": "EG-icollect-pro-apple-app-store",
      "qualification": "Same Pro account/platform suite;older paragraph79rounded. Lifetime prerequisite conflict remains."
    },
    "PLAN-464": {
      "product_id": "icollect",
      "product": "iCollect Movies / iCollect Everything",
      "offer_name": "Pro",
      "platform": "Google Play Android",
      "billing_period": "year",
      "entitlement_group_id": "EG-icollect-pro-google-play-android",
      "qualification": "Same Pro account/platform suite;older paragraph79rounded. Lifetime prerequisite conflict remains."
    }
  },
  "official_page_checks": [
    {
      "url": "https://watchnext.app/faq",
      "access_date": "2026-10-19",
      "source_update_date": "2026-09-08",
      "result": "Read: connected Trakt workflow is conditional server-enabled Unlimited feature."
    },
    {
      "url": "https://movietrack.app/",
      "access_date": "2026-10-19",
      "source_update_date": null,
      "result": "Read: Backlog and custom organizing Spaces. Apple cap/pricing source blocked this pass; retained canonical dossier."
    },
    {
      "url": "https://apps.apple.com/us/app/id6443877426",
      "access_date": "2026-10-19",
      "source_update_date": null,
      "result": "Blocked/unavailable this pass; no new claim that Apple source was refreshed."
    },
    {
      "url": "https://callsheetapp.com/",
      "access_date": "2026-10-19",
      "source_update_date": null,
      "result": "Read: lists accept movies/shows/people, shared membership, arbitrary count;20-search access boundary."
    },
    {
      "url": "https://episodecalendar.com/en/pages/features",
      "access_date": "2026-10-19",
      "source_update_date": null,
      "result": "Read: custom lists Premium; numeric show cap separate."
    },
    {
      "url": "https://episodecalendar.com/en/pages/premium",
      "access_date": "2026-10-19",
      "source_update_date": null,
      "result": "Read: user-defined My shows grouping; logged-in purchase boundary."
    },
    {
      "url": "https://docs.mdblist.com/docs/list_types",
      "access_date": "2026-10-19",
      "source_update_date": null,
      "result": "Read: manual static list operations versus dynamic/feed/linked/external types."
    },
    {
      "url": "https://docs.mdblist.com/docs/supporter",
      "access_date": "2026-10-19",
      "source_update_date": null,
      "result": "Read: exact static counts; Free no name-import, paid yes."
    },
    {
      "url": "https://docs.mdblist.com/docs/import_from_names",
      "access_date": "2026-10-19",
      "source_update_date": null,
      "result": "Read: movie/show names with/without year, fuzzy switch, MDBList/Trakt destinations."
    },
    {
      "url": "https://www.werstreamt.es/pro/",
      "access_date": "2026-10-19",
      "source_update_date": null,
      "result": "Blocked/cache miss this pass; source retained explicitly from existing primary dossier."
    },
    {
      "url": "https://flickz.app/",
      "access_date": "2026-10-19",
      "source_update_date": null,
      "result": "Read: swipe-derived shareable identity card and Premium full-card gate; image target could not be fetched."
    },
    {
      "url": "https://www.icollecteverything.com/support/",
      "access_date": "2026-10-19",
      "source_update_date": null,
      "result": "Read: assisted imports versus Pro desktop self-service."
    },
    {
      "url": "https://www.icollecteverything.com/import-csv-within-the-desktop-apps-tutorial/",
      "access_date": "2026-10-19",
      "source_update_date": null,
      "result": "Read: native collection-specific schema and replacement semantics."
    }
  ],
  "externally_blocked_goodwatch_assessments": []
}
```

[R01]: https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/settings.imports.tsx#L23-L41
[R02]: https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/imports/files.server.ts#L497-L525
[R03]: https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/imports/TmdbConnectPanel.tsx#L18-L30
[R04]: https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/api.imports.preview.ts#L53-L98
[R05]: https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/ui/imports/SourceImportUpload.ts#L8-L37
[R06]: https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/domain/imports.ts#L172-L189
[R07]: https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/mcp/data.server.ts#L237-L316
[R08]: https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/share-lists/store.server.ts#L19-L44
[R09]: https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/server/share-lists/store.server.ts#L123-L125
[R10]: https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/CONTEXT.md#L65-L86
[R11]: https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/types/user-data.ts#L6-L40
[R12]: https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/taste.fingerprint.tsx#L28-L42
[R13]: https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/routes/api.taste.portrait.ts#L43-L47
[R14]: https://github.com/alp82/goodwatch-monorepo/blob/97eb3179844c4f68a70ccbd997bab4f2a735516d/goodwatch-webapp/app/domain/imports.ts#L28-L29
