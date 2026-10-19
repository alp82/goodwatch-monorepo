# Source terms and Netflix MyList.csv

Research for [#732](https://github.com/alp82/goodwatch-monorepo/issues/732), under [map #702](https://github.com/alp82/goodwatch-monorepo/issues/702). Read date: **2026-10-19**. This is research and a product recommendation, **not legal advice**. A terms restriction, its legal enforceability and the probability of enforcement are different questions; this note evaluates the published contract and does not estimate ban rates.

The owner authorized continued experiments on their own account only (Q30). That authorization does not supply provider permission or authorize member rollout. A single extension remains a useful delivery goal, but each source needs its own authorized route. No account data, credentials, raw exports or household identifiers were collected or committed for this research.

## Netflix

The terms sources below were read on **2026-10-19**; update dates are the dates displayed by the providers.

Source: [Netflix Terms of Use](https://help.netflix.com/legal/termsofuse), last updated April 10, 2026. Current numbering is **§1.8**, not older §4.6. Relevant exact excerpts: “use any robot, spider, scraper or other automated means to access the Netflix service”; “use any data mining, data gathering or extraction method”.

§1.8(ii), (v), (vi) additionally restrict reuse of service information, reverse engineering and code insertion/manipulation unless explicitly authorized. It permits termination or restriction for a terms violation. §1.4 personal/noncommercial access supplies no own-account exception to §1.8. The account owner controls credentials under §4.

Inference: user-triggered DOM extraction, injected observers/clickers, and direct private API requests are all exposed; fewer requests/local-only processing do not create contractual permission. No public consumer wishlist API authorization was identified. Do not ship browser/private-API capture to members absent explicit authorization. Official privacy-archive processing is a materially different route; see below.

## Prime Video and regional Amazon Conditions

### Global Prime Video terms

Source: [Prime Video Global Terms](https://www.primevideo.com/region/na/help?nodeId=202095490), last updated August 26, 2026. Exact excerpt from §6(a): “your rights under this Agreement will automatically terminate without notice”.

The introduction incorporates the applicable Amazon Conditions of Use and Usage Rules; §5(a) applies regional Conditions to software. §4(k) concerns Digital Content copying, DRM and commercial/illegal use, rather than granting wishlist extraction rights. §6(a) permits discretionary termination subject to applicable law, with a prorated subscription refund ordinarily; a violation permits immediate revocation of service/Digital Content access without refund and requires deletion of downloaded Digital Content. §6(g) incorporates regional Conditions for disputes and other terms.

Inference: reading only §4(k) misses incorporated extraction restrictions. No first-party member Watchlist export/API permission was found. Do not ship capture based solely on personal-use language.

### Region selection

Source: [Prime Video provider and applicable policies](https://www.primevideo.com/ww-av-legal-home), no last-updated date displayed. This selects rules by customer location, not simply the hostname currently opened: United States uses Amazon.com Services LLC/Amazon.com Conditions; Germany/Austria uses Amazon Digital Germany GmbH as seller and Amazon.de Conditions; other EU countries have their own listed Conditions, including UK Conditions for the residual EU group. primevideo.com is used across several legal regions and has no universal standalone extraction permission. The global Prime Video terms apply alongside this regional layer.

The Germany Conditions link supplied by that page is [Amazon.de Conditions](https://www.amazon.de/gp/help/customer/display.html?nodeId=201909000&pop-up=1); US is [Amazon.com Conditions](https://www.amazon.com/gp/help/customer/display.html?nodeId=GLSBYFE9MGKKQXXM).

### Amazon.com current text

The main help URL returned 503, but the same document is readable on an [official Amazon help host](https://digprjsurvey.amazon.com/csad/help/node/GLSBYFE9MGKKQXXM), last updated August 14, 2026. Exact excerpt from License and Access: “any use of data mining, robots, or similar data gathering and extraction tools”.

That use is excluded from the personal/noncommercial license; account-information copying for third-party benefit is separately excluded. Licenses terminate on noncompliance; Your Account reserves refusal of service, account/access termination, content editing/removal and order cancellation.

The current **Agents** section also covers autonomous/semi-autonomous software acting on a user's instructions: it requires identification using an Agent/name HTTP user-agent component, truthful machine disclosure, no human-behavior concealment/CAPTCHA evasion/block circumvention, and cessation when Amazon requests it; Amazon may technically limit access. This does not affirmatively waive the separate data-extraction restriction.

Inference: own-account local capture is still exposed. Agent transparency alone does not authorize extraction; whether a passive DOM observer falls within Agent is uncertain, while extraction remains independently relevant. Hold member shipment pending authorization.

### Amazon.de evidence limit

The current consumer Conditions link returned inaccessible/403 results via web and direct fetch; **its current revision, exact automation wording, exceptions and account-enforcement language remain unverified**. Do not pass off US, UK, seller or historical terms as current German consumer terms.

Historical first-party corroboration: [Amazon.de consumer Conditions, November 18, 2022 PDF](https://m.media-amazon.com/images/G/03/legal/Previous_versions_Legal_policies/Conditions_of_Use_and_Sale/Amazon.de_Allgemeine_Geschaeftsbedingungen_18_11_2022.pdf), §6 excludes “Data-Mining, Robotern oder ähnlichen Datenerfassungs- und Extraktions-Programmen”. This is **historical evidence only**, not current verification.

Recommendation: hold German member capture as unverified/high concern. A normal-browser review of the current linked consumer conditions or provider confirmation is still needed; lack of accessible current text is not permission.

## JustWatch

Source: [Current JustWatch Terms](https://support.justwatch.com/article/just-watchs-terms-of-use), read 2026-10-19; page shows no explicit revision date. §7.1 exact excerpt: “users will not engage in or use any data mining, robots, scraping”. The sentence continues to cover similar gathering/extraction methods. It separately bars reverse engineering, circumvention of an IP block, and unauthorized uses; violations automatically terminate access and require destruction of service-content copies. §7.2 reserves proceedings for resulting costs/losses and appropriate law-enforcement disclosure. Personal/noncommercial use in §1.2 is not an exception to §7.1.

Inference: extracting the user's Watchlist via DOM or the site's internal GraphQL is restricted, regardless of read-only/member initiation. No distinct public consumer GraphQL license was found. Do not ship either capture route absent permission.

[Partner API docs](https://apis.justwatch.com/docs/api/) require a concluded contract, a unique token for every request, and branded links. They describe title offers/catalog lookup, not authenticated member Watchlists. [Partner data export](https://apis.justwatch.com/docs/data_export/) is daily availability NDJSON in S3 using contract-issued credentials. That is a catalog feed, not a personal Watchlist download.

[Privacy Policy §17.2](https://support.justwatch.com/article/privacy-policy) recognizes conditional GDPR access/portability rights and directs requests with the user's pseudonymous identifier to privacy@justwatch.com. No documented self-service personal CSV/JSON Watchlist export or guaranteed response schema was found in primary support/API docs. Requesting a provider-issued personal-data copy is a plausible authorized alternative; its Watchlist content must be established before offering an adapter. A partner contract would need explicit personal-list scope rather than assuming catalog rights cover it.

## MDBList

Sources: [Privacy Policy and Terms](https://mdblist.com/static/legal.html), last updated March 8, 2025; [official API guide](https://docs.mdblist.com/docs/api), no revision date displayed; [current authentication reference](https://api.mdblist.com/docs/authentication/).

Terms exact excerpt: “You must comply with applicable laws and third-party provider terms.” They also prohibit misuse/disruption, require account security, disclaim uninterrupted service, and allow feature change/discontinuation. The reviewed terms do **not** expressly reserve a specific suspension/termination penalty for a compliant local API reader; do not invent one.

Authentication reference exact excerpt: “Best for personal scripts and direct access.” It supports API keys for personal readers, Public PKCE for local/open-source apps, Device Code for CLIs/devices and confidential OAuth for server-side apps. All app methods currently grant `write` scope/full account access: read-only behavior must be enforced by the reader, not assumed from the credential. This is positive first-party evidence for the personal local-reader route. The [official guide](https://docs.mdblist.com/docs/api) lists 1,000 daily free requests plus 1,000 reads/300 writes per five minutes shared across a user's apps/keys; higher daily tiers exist.

Inference/recommendation: a read-only local reader using the member's own key and documented endpoints can proceed within quota/security rules. A distributed integration should use the appropriate registered app flow and confirm applicable app/data-use terms. MDBList support for external-source integrations does not independently grant GoodWatch permission to scrape those sources. Confirm real Watchlist completeness separately from terms clearance.


## Netflix official archive: viable route, unverified current file contract

### Request, profile scope, delivery and freshness

Netflix's [personal-information help page](https://help.netflix.com/en/node/100624) (read **2026-10-19**) directs the account owner to [Request your information](https://www.netflix.com/account/getmyinfo). Its timing clause is: “It may take up to 30 days from the date we verify your request”. A profile user with an email attached to their profile can instead contact `privacy@netflix.com`; Netflix notifies the account owner and allows up to 30 days after identity verification. The page documents profiles and content interactions, but does not promise `MyList.csv`, its path, columns, precise snapshot time or download-link lifetime. The signed-in request flow was not exercised in this research.

**Freshness verdict:** this is an asynchronous export, unsuitable for an immediate live capture promise. Neither request time nor download time proves the list's snapshot time. Keep a known archive production timestamp separately; omit `exportedAt` if unknown instead of substituting download time. Current membership and treatment of removed/unavailable titles require a real file comparison.

Netflix's [My List help](https://help.netflix.com/en/node/10523) (read **2026-10-19**) confirms profile-level lists, up to 2,000 movies/shows, and hidden titles when unavailable or outside the current region; games are also supported on mobile. Those UI rules do not establish what the archive retains. Its [viewing-activity help](https://help.netflix.com/en/node/101917) (read **2026-10-19**) documents the immediate per-profile **Download all** CSV. That is viewing history, not a Wishlist substitute.

### Columns and Netflix title IDs: observed implementation, not a Netflix guarantee

The [pinned Bionic My List parser](https://github.com/bionic-dev/bionic/blob/598834bfecb9cc6e84add77b4fe79a40b802b4e8/imports/netflix/my_list.go#L10-L16) (read **2026-10-19**) explicitly consumes `Profile Name`, `Title Name`, `Country`, and `Utc Title Add Date`. This is primary evidence of that historical importer's implementation, **not a current Netflix specification or inspected member archive**. It declares no Netflix title-ID field, media type or year. Its database-generated `gorm.Model` ID is not a provider title ID. Unknown extra columns could exist in a current file: conclude **no native ID established**, rather than claim IDs can never be present.

The current Netflix help pages provide no CSV schema. Historical mirrored cover sheets were already recorded in [the initial survey](../streaming-watchlist-imports.md#netflix); they are not used here as current primary evidence. Before implementing a parser, inspect the owner's new archive and accompanying Netflix-authored dictionary under #640. Check headers, encodings, date formats, all profiles, removals, unavailable titles and games. An additions log without deletion evidence cannot be called a current wishlist; require review or defer that interpretation.

### Projection into shared wishlist v1.1

This is a proposed adapter mapping, conditional on #640 confirming each field's meaning, using the [shipped v1.1 contract](../../implementation/shared-wishlist-format.md):

| Archive evidence | Shared wishlist v1.1 mapping / guard |
| --- | --- |
| File and selected list | `format: "goodwatch-wishlist"`, numeric `version: 1.1`, `source: "netflix"`; only My List membership becomes Want to See. |
| `Profile Name` | Ask which profile to import, then project only that profile to `profileLabel`. Never combine household profiles. The old parser establishes a profile column; current archive coverage awaits #640. |
| `Title Name` | `title`; `mediaType: "unknown"` unless independently established. No inferred movie/show type or year. Games remain unsupported/reviewable; do not match them to same-name movies. |
| `Utc Title Add Date` | `addedAt` only after validating the actual UTC format. This is an added date, not Seen or export time. |
| `Country` | Preserve its original meaning in adapter evidence. A country at addition is not necessarily the current capture country; omit the envelope `country` unless independently known. The shared envelope cannot represent mixed per-item countries. |
| No established native ID | Omit `sourceId`, `sourceUrl`, `tmdbId` and `imdbId`; do not fabricate an ID or promote a title-search candidate into source evidence. |
| Archive production time / membership | Use `exportedAt` only if known; `completeness: "unknown"` until scope/current membership is established. Partial or unknown absence never removes a GoodWatch wish. |
| My List alone | Omit `sourceSeen` / `sourceSeenAt`; membership does not imply Seen or unseen. Do not infer whole-show Seen from a play session. Season/episode wishes need explicit coordinates and independently established parent identity. |

Member matching, preview and confirmation remain mandatory. Want to rewatch and authoritative show states retain the existing contract; this file does not itself import ratings, watches or episode progress. A member should upload the original selected file through a native adapter, rather than manually convert CSV to shared JSON or upload the whole household archive unnecessarily. These are implementation recommendations, not implemented behavior.

### Existing tickets and shipped matcher

- [#640 — Real Netflix export files](https://github.com/alp82/goodwatch-monorepo/issues/640) is **open** as read on **2026-10-19**, and explicitly requests `ViewingActivity.csv`, `Ratings.csv` and `MyList.csv`; originals remain outside Git. It already owns the needed real-file validation.
- [#622 — Build the Netflix import](https://github.com/alp82/goodwatch-monorepo/issues/622) is **open** and already specifies archive profiles, My List → Want to See, title-based matching and no thumb-to-score conversion. Its last comment requires episode support from the start and waits for #640. Reuse these tickets; do not create a competing archive adapter ticket or declare either done.
- The shipped [Netflix native-ID suggestion implementation](../../implementation/wishlist-suggestions.md), inspected at main `1bb4239558d85af89936b30277a048c6a7ed9b3e`, requires `source: "netflix"` and a valid numeric `sourceId`. It corroborates bounded title candidates against locally stored Netflix offer URLs without requesting Netflix. With only the four historical columns, it **cannot supply native-ID-backed suggestions**: the row stays manual. If a real archive independently supplies a genuine title ID, preserve it and reuse that matcher; title-only resolution stays with [#374](https://github.com/alp82/goodwatch-monorepo/issues/374). [#709](https://github.com/alp82/goodwatch-monorepo/issues/709) is the **open benchmark/gates ticket**, not the closed implementation ticket; its evidence does not establish archive compatibility or unattended matching accuracy.

**Workability verdict:** the official archive is the preferred Netflix route from a terms perspective and is already planned. It is a workable asynchronous import candidate, not yet a validated drop-in replacement for browser capture: delivery friction, current membership, schema and identity matching remain material limits. #640 and #622 provide the existing path to resolving them.

## Verification and limits

Read #732 and the map's Notes, their empty comment lists, #622/#640/#709 and the shipped shared-format/suggestion contracts. Checked current first-party pages and exact short quotations on **2026-10-19**, with historical evidence labeled separately. Normal web/direct retrieval of Amazon.de's current consumer Conditions failed (503/403); the current wording and regional account remedies remain a specific evidence gap, not a clearance. This is a public-document review: no signed-in capture, current archive, JustWatch personal-data response, MDBList key/quota exercise or member import was tested. No code changed; application tests would not validate these terms findings. No provider outreach was sent.

## Per-source decision table

Risk describes the remedies reserved by the text, not their measured likelihood. The verdicts concern the exact route; authorized file processing does not clear an automated online reader.

| Source | Route | Terms verdict | Member risk | Recommendation |
| --- | --- | --- | --- | --- |
| Netflix | DOM observer/clicking or private API | §1.8 explicitly restricts automation/extraction; local own-account use has no stated exception. | Service restriction or termination. | Hold member capture absent provider authorization. |
| Netflix | Official privacy archive → local MyList.csv adapter | Provider-documented data-request route; current CSV contract and membership still unverified. | No extraction violation identified from manually requesting/processing one's supplied copy; household-data exposure and stale/misread wishes remain. | Preferred Netflix route; validate through #640, build through #622, retain member review. |
| Prime Video, amazon.com | DOM/hydration/private requests | Incorporated US Conditions exclude gathering/extraction tools; Agent transparency duties also apply where relevant. | Amazon account/service termination and video-access revocation; fees may be retained for breach. | Hold member capture pending explicit authorization. |
| Prime Video, amazon.de | Same | Current German consumer wording could not be retrieved; historical exclusion supplies no current clearance. | Current regional account remedies unverified; global Prime terms reserve video termination/access revocation. | Hold; retrieve current consumer terms and obtain authorization before release. |
| primevideo.com, other regions | Same | Hostname does not settle the contract; location-specific Conditions apply. | Regional remedies plus global Prime video remedies. | No blanket clearance; review each supported region. |
| JustWatch | DOM or internal GraphQL | §7.1 explicitly restricts scraping/gathering; no separate consumer GraphQL authorization found. | Access termination/blocking; costs/losses proceedings reserved. | Hold member capture; investigate provider-issued personal-data copy or express permission. |
| JustWatch | Official partner API / S3 export | Contract route for catalog/availability; personal Watchlist scope not established. | Contract-specific; consumer-list access remains unproven. | Do not present it as an authorized personal-list connector. |
| MDBList | Member's own key, documented read API | Personal scripts explicitly documented, subject to service/upstream terms and quotas. | Rate limits, key exposure and feature withdrawal; no specific compliant-reader termination penalty found. | Eligible route for member release after functional/completeness validation. |

## Recommendation on member shipment

**Proceed with documented personal APIs and provider-issued files; hold Netflix, Prime Video and JustWatch browser/private-API capture for members.** A local, read-only, member-initiated extension reduces credential exposure and operational steps, but does not waive explicit extraction restrictions. The owner's own-account experiment remains the existing scope and is not a member-release decision.

MDBList is the clearest online reader candidate under its published personal API documentation; complete the existing sample/coverage gates before claiming support. For Netflix, favor an original-file archive adapter through #640/#622: waiting up to 30 days and title-based review are material tradeoffs, but they avoid making restricted browser capture the default. Do not promise immediate export, current-list completeness or native-ID matching before a current archive establishes them. For JustWatch, establish what a provider-issued privacy copy contains or obtain an agreement explicitly covering personal lists. Prime needs provider authorization and the current regional consumer contract before rollout. These findings supersede earlier browser-first suggestions only as a research recommendation; they do not change the owner's accepted decisions or close implementation work.
