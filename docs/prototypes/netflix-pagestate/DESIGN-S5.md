# Netflix My List through direct read-only requests: S5 design for review

Ticket [#730](https://github.com/alp82/goodwatch-monorepo/issues/730). Written 2026-10-19, continuing WIP commit `31d94eb5`. Design and offline source inspection only; no request was sent to Netflix. This replaces `DESIGN-S5-WIP.md`. The existing S4 design, diagnostic and private packages are unchanged. Independent review comes before implementation.

The owner's instruction is to explore API calls instead of slow clicking. It authorizes this S5 design despite the earlier S5 stop in [PROTOCOL.md](PROTOCOL.md) P5 and [FINDINGS.md](FINDINGS.md). It does not authorize a live experiment or relax the other gates. S4 remains described in [DESIGN.md](DESIGN.md), revision 3; Q26, what `complete` may claim, remains unresolved.

## Recommendation and established limits

**Prefer S5 as the next design to review for reducing waiting and carousel dependence. Build a counts-only S5 diagnostic only after that review. Do not promise snapshot-consistent `complete`.** A fixed, reviewed build adapter can construct `CarouselPage` without inspecting Apollo's cache or replaying arbitrary page requests. If its prerequisites do not match, refuse S5; do not silently switch transports, queries or credentials.

| Question | Offline answer |
| --- | --- |
| What does this saved build send? | JSON `POST` to same-origin `/graphql`, primarily a UUID persisted document, version 102, operation `CarouselPage`. The page's saved configuration selects this route. |
| Can it ask for the total in one request? | The query has an integer `first` argument; no server maximum or guarantee of honoring it is present in the evidence. A bounded whole-row request is a hypothesis for a later reviewed diagnostic. |
| Would one response solve `snapshot_unproven`? | No. It could establish full positional coverage in one response. Neither atomic membership resolution nor a snapshot identifier has been established. |
| Would two agreeing reads help? | Yes, as measured repeatability over a shorter read window. They cannot prove that the result existed at one instant. |
| What can ship from this work? | A reviewable design. No extension change, live measurement or new completeness claim. |

## Evidence and reproducible source locations

Sources are the owner's saved My List page and its saved `akiraClient` JavaScript bundle, both inspected locally as text, without executing them. Private source contents stay outside Git. References below name structural symbols and zero-based character offsets in that one saved bundle, so a reviewer with the private files can reproduce the findings without publishing values. Offsets are locators for this capture, not runtime interfaces.

| Source | Locator | What it establishes |
| --- | --- | --- |
| Saved HTML | `netflix.reactContext.models.fastProps.data` | `shakti.graphql.deployedClientUrl` is `/graphql`; `shakti.graphql.pre-persisted-queries.enable` is true; the local client URL is null. |
| Saved HTML | `models.serverDefs.data`, `models.geo.data`, `models.services.data.akiraBuildIdentifier`; separate `models.graphql` inline assignment | Build and locale sources; script/build identity; normalized My List section and its first 13 entries out of reported 77. |
| Client bundle | `query CarouselPage`, around 556128; generated `CarouselPageDocument`, around 4629775 | Operation signature and generated persisted document identifier in `__meta__.q`. The actual identifier is intentionally withheld here. |
| Client bundle | `useCarouselQuery`, 7020752–7021900 | Network-only page requests; `rowId`, cursor, `2 × visible` page size, artwork/feature variables and section version. |
| Client bundle | `PrePersistedQueryLink`, around 12544000; adjacent SHA-256 persisted-query link | UUID-first protocol and fallback behavior. |
| Client bundle | HTTP/header links, around 12540144–12542500 | JSON transport, default credential mode, operation and GraphQL context headers. |
| Client bundle | `createFetch`, around 14221700; request-header builder, 14226800; `getPlatformHeaders`, 14258000; `getPlatformOptions`, 14263500 | Additional request headers, transport retries, build/locale sources and endpoint configuration. |
| Client bundle | `BASE_CAROUSEL_PAGE_SIZE`, 6397680; `MAX_CAROUSEL_ENTITIES`, 6391468; capabilities, 4777021 | Initial size 13; UI capability limits 150 and 75. These are not demonstrated server paging limits. |

The UUID finding corrects the SHA-256-only transport description in `FINDINGS.md`. Both links exist; they are not interchangeable descriptions of the primary request in this saved configuration. The saved configuration is stronger offline evidence than a library default, but is still not a captured live request.

## Exact request construction for the saved build

### Endpoint, method and document

The adapter accepts only a top-frame document on `https://www.netflix.com/browse/my-list` (optional trailing slash) and pins the destination to **`https://www.netflix.com/graphql`**, without query parameters. It verifies that the page's configuration resolves to that exact URL. A configured cross-origin GraphQL service, local proxy, development override or different path means `endpoint_unsupported`, with zero S5 requests. Page configuration never grants a new endpoint permission.

Apollo's HTTP transport defaults to `POST`; the selected client path provides JSON and does not select GET for this query. Its HTTP link defaults to `credentials: 'include'`. S5 instead uses a page-world, same-origin fetch with explicit `method: 'POST'`, `mode: 'same-origin'`, `credentials: 'same-origin'`, `redirect: 'error'`, `cache: 'no-store'` and its own abort signal. This sends the browser-managed credentials for the same page origin without reading or setting a cookie. A response's URL must still be the pinned URL. `no-store` avoids the browser HTTP cache; it does not prove fresh server data or bypass a service worker.

The request body has exactly these top-level keys (schematic, deliberately not a copied private request):

```text
operationName: "CarouselPage"
variables: <validated variables described below>
extensions: { persistedQuery: { id: <reviewed CarouselPage document identifier>, version: 102 } }
```

There is **no `query` text and no `sha256Hash`** in the primary UUID request. The identifier comes from the generated query document's `__meta__.q` in the client bundle. It is not a title ID, row ID, CSRF token or a hash to compute from the operation name. The full document, including its fragment graph, has to be reviewed as a GraphQL **query**, with no mutation or subscription definition; an operation name alone cannot establish read-only behavior.

Netflix's own UUID link handles persisted-query errors by enabling query inclusion and invoking its fallback link. That fallback is the SHA-256 APQ link: it can first send version 1 plus `sha256Hash`, and later full query text on APQ negotiation errors. S5 implements **none of these fallbacks**, and uses neither Netflix's Apollo client nor its generic fetch wrapper. The generic fetch wrapper has retries even though the Apollo retry link is disabled. Any persisted-query error, HTTP error or GraphQL `errors` field ends this S5 session immediately, without retry, full-text registration or probing other document identifiers.

### Obtaining the document without token extraction

The UUID is in the external client bundle, **not** in the inline My List section. A `script[src]` element exposes its address, not its loaded source text or Webpack module exports. There is no demonstrated public `window` API for the document. Do not pretend the extension can obtain it by reading the DOM or by hashing `CarouselPage`.

Use a **reviewed per-build adapter**, selected by the page's `serverDefs.data.BUILD_IDENTIFIER` and the expected client-script source identity. It contains the exact document identifier, reviewed query signature/fragment inventory, variable constructors and response parser. The source for reviewing those constants is the matching client asset, not a member's requests. This document supplies structural locators only; it copies no identifier from the private files into Git. A distributable adapter and a permissible source for its constants remain implementation/review prerequisites, not an artifact produced here.

At runtime, compare the adapter with the page's build/configuration and loaded script elements; do not download bundles, use `eval`, attach to Webpack, traverse React/Apollo internals, read a whole cache, capture arbitrary request bodies or invoke Netflix client helpers. Unknown build, absent constant or ambiguous script match means `build_unsupported` before a request. A naturally observed native `CarouselPage` can later corroborate the adapter in a diagnostic, but S5 does not require a carousel click to harvest a template and does not treat a request bearing that name as authority to replay it.

### Variables and their sources

The root is `node(_id: $rowId) { ...CarouselSection }`; the fragment requests `entities(first: $carouselPageSize, after: $carouselAfterCursor, sectionVersion: $carouselVersion)`. Artwork arguments are required even though membership does not need pictures. Using a persisted document means retaining its complete variable contract; removing fragments or artwork arguments would be a different, unverified query.

| Variable | Type / value rule | Source and S5 handling |
| --- | --- | --- |
| `rowId` | `ID!` | Unique provenance-checked My List `PinotCarouselSection._id` from inline GraphQL state. Never a DOM card ID or another row's ID. |
| `carouselAfterCursor` | Nullable `String` | Null/omitted for a new full read; thereafter the last accepted response's `pageInfo.endCursor`. Validate its decoded position. Never invent the next offset or copy an old capture's cursor. |
| `carouselPageSize` | Nullable `Int` in Netflix's signature; S5 always supplies an integer 1–200 | Fixed at Start under the diagnostic policy below. Netflix's normal client supplies twice the visible card count. |
| `carouselVersion` | Nullable `String` | Reference section `version`. Netflix's hook updates this from replies; S5 requires every reply to equal the reference and aborts on a change rather than following a new version. |
| `eddEnabled` | `Boolean!` | Client `useABProperty('enableEDD')` reads `netflix.reactContext.models.abProperties.data.properties.enableEDD` through its context provider. If the model is absent, the saved client's fallback property is false. Require a boolean from the reviewed model/default rule; a malformed present model refuses. Never infer it from response fields. |
| `fetchHighResCards` | `Boolean = false` | Native hook uses its argument or `isHighResTitleCardsEnabled`. S5 explicitly chooses the documented false branch, subject to adapter review; no high-resolution images are needed. |
| `includeSearchDestinationCards` | `Boolean = false` | Native hook argument defaults false. S5 explicitly keeps false. |
| Artwork variables below | Each `ArtworkParams!` | Native hook calls `getArtworkParams(override, dir)`. Both saved carousel call sites pass no override, so use the exact defaults below. Direction comes from `netflix.reactContext.models.geo.data.locale.dir`, with native fallback `ltr`; require a reviewed `ltr`/`rtl` value/default rule. S5 reproduces pure constructors without calling the page's modules. Unreviewed inputs/object fields mean `variables_unsupported`. Returned artwork URLs are never fetched by S5. |

There are 23 declared variables, including these 16 artwork inputs. Their exact default constructors are in `defaultArtworkParams` / `getArtworkParams`, around 7010450–7014450, dimension/helper module 18276 around 6997811–6999999, and logo constants around 6903142. Define `F = ['WEBP','JPG','PNG']`, `S = {width:342,height:192}`, `H = {width:665,height:375}`, and `I = {width:200,height:200}`. Define `hi(lock=false)` as `{artworkType:'SDP', dimension:H, features:{fallbackStrategy:'STILL', ...(lock ? {enableLockBadgeChecks:true} : {})}}`. These are non-secret client constants, not copied member data.

| Artwork variable | Default object / formula |
| --- | --- |
| `imageParamsForStandardBoxart` | `{artworkType:'SDP',dimension:S,features:{enableLockBadgeChecks:true,fallbackStrategy:'STILL'}}` |
| `imageParamsForStandardBoxartHighRes` | `hi(true)` |
| `imageParamsForPodcastEpisodicStill` | `{artworkType:'SEGMENT_STILL',dimension:{...S,scaleStrategy:'COVER'},features:{graybox:false}}` |
| `imageParamsForPodcastEpisodicStillHighRes` | `{artworkType:'SEGMENT_STILL',dimension:{...H,scaleStrategy:'COVER'},features:{graybox:false}}` |
| `imageParamsForPodcastEpisodicLogo` | `{artworkType:'LOGO_HORIZONTAL_CROPPED',dimension:{width:800,height:126,scaleStrategy:'CONTAIN'},features:{tone:'LIGHT'}}` |
| `imageParamsForRankedBoxart` | `{artworkType:'BOXSHOT',dimension:{width:426,height:607},features:{fallbackStrategy:'STILL',suppressTop10Badge:true}}` |
| `imageParamsForContinueWatchingBoxart` | `{artworkType:'SDP',dimension:S,features:{fallbackStrategy:'STILL'}}` |
| `imageParamsForContinueWatchingBoxartHighRes` | `hi()` |
| `imageParamsForCloudGameBoxart` | `{artworkType:'SDP',dimension:S,features:{fallbackStrategy:'STILL'}}` |
| `imageParamsForCloudGameBoxartHighRes` | `hi()` |
| `imageParamsForMobileGameBoxart` | `{artworkType:'APP_ICON',dimension:I,formats:F}` |
| `imageParamsForCharacterCircle` | `{artworkType:'SQUAREHEADSHOT_1000x1000',dimension:I,formats:F}` |
| `imageParamsForChannel` | `{artworkType:dir==='rtl'?'CHANNEL_TILE_BACKGROUND_RTL':'CHANNEL_TILE_BACKGROUND',dimension:S,formats:F}` |
| `imageParamsForChannelLogo` | `{artworkType:'CHANNEL_LOGO_COLOR_CROPPED',dimension:{height:44},formats:['WEBP','PNG']}` |
| `imageParamsForEntryPointBackground` | `{artworkType:dir==='rtl'?'MLP_ENTRY_POINT_BACKGROUND_RTL':'MLP_ENTRY_POINT_BACKGROUND',dimension:{width:1024},features:{fallbackStrategy:'STILL'}}` |
| `imageParamsForEntryPointLogo` | `{artworkType:'LOGO_STACKED_CROPPED',dimension:{height:260},formats:F}` |

The constructor merges are shallow: the entry-point logo replaces its shared dimension object, retaining only height 260, without the shared width. The helper also returns variables for other operations; Apollo removes unused variables, so S5 sends only this query's declared set. No artwork override or viewport-dependent size discovery is needed on this reviewed carousel path.

These are source/schema names, not a runnable request. Exact runtime row, build and feature values remain local. The first request of **each** full pass starts at position zero; inline entries serve as a prefix cross-check, not as a substitute for reading the start of that pass.

### Headers: constructed by the client versus required by the server

Offline code establishes what the client adds, not the minimum headers the server will accept. The later diagnostic must distinguish transport success from absence of a server requirement. S5 allowlists the following non-secret fields and never copies an entire header bag:

| Header | Client source / S5 construction |
| --- | --- |
| `content-type: application/json` | GraphQL header link; fixed. |
| `accept: */*` | Apollo HTTP default; fixed. |
| `x-netflix.context.ui-flavor: akira` | GraphQL header link; fixed for this adapter. |
| `X-Netflix.Request.Originating.Url` | `document.location.href` in the browser link. S5 requires a clean My List URL with no search/hash and uses that URL; never publishes it in a report. |
| `x-netflix.context.operation-name: CarouselPage` | Operation name; fixed and checked against the adapter document. |
| `x-netflix.context.app-version` | Platform headers read `serverDefs.data.BUILD_IDENTIFIER`. This **is** the build header; no separate mandatory build-ID header was found. |
| `x-netflix.context.locales` | `geo.data.locale.id`, normalized with `Intl.Locale`; lowercased only if `shakti.graphql.useLowercaseLocale` selects it. The saved flag is false. |
| `x-netflix.schema-variant` | Optional GraphQL-client `schemaVariant` option. Omit unless a reviewed adapter establishes it for the selected page/build. Do not confuse with a header named `schema-variant`. |
| `x-netflix.context.hawkins-version: 5.31.2` | Optional in the generic link, but supplied by this build's main client as `headersLinkOptions.hawkinsVersion = Y.version` (around 7127959), from module 5073's public version constant (around 10132900). The reviewed adapter carries this constant; it is not a token or a value from the My List row. |
| `x-netflix.request.id` | Generic fetch wrapper generates a random UUID with hyphens removed; S5 generates a fresh local value. |
| `x-netflix.request.attempt: 1` | Generic wrapper's first attempt counter, serialized as a string; fixed, with no retries. |
| `X-Netflix.request.toplevel.uuid` | GraphQL operation-logging link generates a UUID; S5 generates a fresh local value. |
| `x-netflix.request.client.context` | Generic wrapper JSON-encodes client context and adds `appstate` from `document.hidden`. With no caller-supplied context, S5 constructs only `{appstate: 'foreground'}` or its background counterpart. No session/token value is needed for this construction. |

No `schemaVariant` is supplied by the traced client creation. Another GraphQL wrapper can add `x-netflix.context.form-factor: phone` for mobile browser configuration; this first adapter must be scoped to the reviewed desktop path and refuse other platform modes unless their header contract is separately reviewed.

**No CSRF header or `authURL` variable appears in the traced CarouselPage GraphQL path.** A separate CSRF refresh component exists, and a generic optional session-context link can copy a cookie to a header; no enabling configuration for that link was established on this path. None justifies reading a token. Do not access `userInfo.authURL`, `document.cookie`, cookie APIs, local/session storage or authorization headers, and do not invoke `getPlatformHeaders` wholesale: other branches read cookies for automation/in-app flags or server-side session context. Browser-managed `Cookie`, `Origin`, `Referer`, user-agent and fetch metadata stay browser-managed.

If omitting an optional header, cookie-derived field or undiscovered token makes the request fail, the result is `request_failed`/`auth_required`, not permission to extract it. No login challenge handling, token refresh, header spoofing to evade automation checks or cross-origin fallback belongs to this design.

## Whole-row request, paging and time

### Can one request return the whole list?

The schema accepts a requested size and returns `edges`, `pageInfo { endCursor hasNextPage }` and `totalCount`. The offline page supplies only the initial 13 of 77 entries. No saved response answers a request for all 77. `BASE_CAROUSEL_PAGE_SIZE = 13`, capability `maxTotalEntities = 75`, and `MAX_CAROUSEL_ENTITIES = 150` describe client behavior/capabilities, not a verified `carouselPageSize` server limit. In particular, 75 is already smaller than this page's reported My List total. Do not truncate at those constants or assert a known maximum.

For a later independently reviewed diagnostic, propose one initial request with `P = min(N, 200)` for a positive reference total `N`. This is a bounded experiment, not a claim that 200 is supported; 200 is the existing P4 safety ceiling. If the response validly returns fewer entries and says there is another page, continue with its actual `endCursor` and the same requested size. Do not infer coverage from the size sent. A size error aborts; never probe successively larger/smaller values or retry automatically. A separate future run with a different size requires a reviewed policy, not an adaptive error loop.

A whole-row result requires exactly `N` valid unique entries at positions `0..N−1`, matching the reference total/version/row, `endCursor` equal to the last edge cursor, and `hasNextPage === false`. A shorter response with `hasNextPage === false` is a contradiction, not success. For `N > 200`, paging is required by S5's safety ceiling even if Netflix would accept more. `N = 0` has no paging request: retain S4's empty/provenance checks (row absent for 2 seconds and still absent at finalize) and `snapshot_unproven`; absence of a row is never permission to guess a row ID. A reported zero with a present or appearing row is rejected by its own P4 code.

### Coverage is not an atomic snapshot

One response containing every entry removes the **between-page** mixing problem for that read. It does not establish whether Netflix resolves its connection, edges and count atomically, whether the server caps/filters entries, or whether an intermediary/page script supplied cached or synthetic JSON. GraphQL query syntax and a single HTTP response provide no demonstrated membership snapshot contract in these sources.

`carouselVersion` still appears to be a rendering version: the saved page's seven sections share the same single-digit value, and cursors encode positions. Keep version equality as a guard, but never promote it to a membership snapshot identifier. Under current P7, every S5 result still carries `snapshot_unproven`, including a successful one-response read and an empty result. Changing P7 to accept a proved atomic single-response contract would itself need evidence and review; a field count or timing improvement cannot change it.

### Two consecutive full reads

The proposed diagnostic performs at most two independent full passes, each beginning without a cursor, within one bounded session. Validate each pass separately. Compare the ordered position-to-ID mapping, types, titles, total and version; do not compare only counts or union entries across passes. Any disagreement aborts with a distinct `repeat_conflict` or the specific validation fault. Do not loop until two happen to match.

Agreement is meaningful repeatability evidence: two separately requested traversals returned the same mapping, and a shorter interval reduces the opportunity for unobserved changes. Its reliability cannot be quantified from this saved page. Correlated caching, deterministic server selection and repeated/interleaved changes can make both reads agree without proving one snapshot. The extension may say “Two full reads agreed” alongside coverage and read-window counts; it must still report `partial` / `snapshot_unproven`. Agreement with an archive remains separate evidence with an export-time gap.

### Bounded time estimate, not a benchmark

With `k` responses per pass, average request-through-validation time `L`, and a one-second gap **after each response finishes** before starting another request, one pass takes approximately `kL + (k−1)` seconds; two passes take `2kL + (2k−1)`. Requests are sequential because the next cursor comes from the last validated response. If the server honors fixed `P`, `k = ceil(N/P)`; if it clamps, use the actual returned page size and measured `k`.

For the offline total of 77, illustrative `L = 0.25–1 second` gives:

| Effective page size | Requests for two full reads | Estimated duration |
| --- | --- | --- |
| 77 | 2 | 1.5–3 seconds |
| 26 | 6 | 6.5–11 seconds |
| 13 | 12 | 14–23 seconds |

These are arithmetic scenarios, not observed latencies or confirmed supported sizes. Native `2 × visible` does not establish 26 for this page. S4 additionally waits for carousel advancement/rendering and may need manual fallback; its actual duration has not been measured either. Report measured timings in a later diagnostic instead of promising a speedup factor.

## Safety contract and lifecycle

### Narrow operation and credentials

- One reviewed GraphQL query document: `CarouselPage` only. No mutation, subscription, query batch, arbitrary supplied document, full-query fallback, Apollo cache update or Netflix event dispatch. A persisted ID mismatch means the adapter cannot run.
- One exact HTTPS origin/path and top frame, using that page's browser-managed credentials. No extension-background requests, remote proxy, cross-origin host grants, cookie/token extraction, credential persistence or additional Netflix endpoint.
- Page-world execution is justified only to send same-origin fetches in the member's page context. Use `activeTab`/`scripting` and a narrowly scoped executor, with no global fetch/XHR wrapper. The command accepts “start this reviewed read,” never a caller-supplied URL, headers, body or operation.
- Page-world trust limitations remain: a prior fetch wrapper, service worker or hostile page script could forge data. A session nonce is a lifecycle separator, not authentication against Netflix page scripts. Do not claim authenticated server evidence.

### Bounds fixed at Start

| Bound | Proposed value | Failure behavior |
| --- | --- | --- |
| Full passes | At most 2, no automatic rerun | Stop after agreement or first conflict. |
| Concurrency / rate | 1 S5 request; at least 1 second after completion before the next start | Scheduler enforces inside all waits, including the pass boundary. |
| Request budget | 60 total starts across both passes | `request_limit`; no extra allowance at Save. Native page traffic is not included or controlled. |
| Read deadline | 90 seconds from Start, checked through network, streaming, parsing and transfer | Abort owned work; `read_timeout`. Large lists may be refused or partial within these bounds. |
| Per-request lifetime | 8 seconds, capped by remaining read time | Abort owned request and reader; `request_timeout`, no retry. |
| Body / variables before send | 64 KB / 16 KB | `request_too_large`, no send. |
| Response / retained session memory | 2 MB per response / 8 MB accounted raw chunks, strings and normalized entries | Cancel owned reader; `response_too_large` / `budget_exceeded`. Stream-count bytes before JSON parsing. |
| Total / page size / positions | Total 0–5,000; page size 1–200; decoded positions 0–4,999, below total | Specific P4 failure; reject entire page. |
| Entries / title | At most 5,000 per pass; title at most 1,000 characters, no control characters | Reject malformed page; two-pass storage must also fit the memory budget. |
| Overall session / provenance age | 10 minutes; document loaded on My List within 10 minutes | Discard on expiration; no file. Read deadline remains 90 seconds. |

The count, byte and time bounds apply even when a response is an error. Increments happen before sending, so failed starts cannot escape accounting. No retry on timeout, 429, 5xx, authentication failure, GraphQL error, redirect, non-JSON response or any unrecognized shape. These conservative budgets are design choices for review, not a claim that Netflix permits this rate. They cannot bound traffic Netflix itself makes.

### Provenance and page validation

Carry forward P1–P4 and P6–P7, the 0.0.7 provenance rules and S4's binding/parser checks. Before every send, after every reply/transfer and at finalize, require the same current profile (unique avatar match against state), document identity/load route, top-frame origin/path, freshness, unchanged inline-state fingerprint, unique My List row/heading, reference row ID, total and version. Any profile, navigation, back-forward cache restore, build or reference change invalidates the session and aborts owned work. Profile markers stay in memory, never in reports or logs.

Bind each request to generation, document, profile, build adapter, row, reference fingerprint, pass, cursor/decoded start position, requested size, version and initiation time. Accept only HTTP 200 JSON with no GraphQL errors; the expected `data.node` section type/ID/label; one unambiguous entities connection; matching version/total; contiguous edge positions beginning immediately after the bound cursor; unique valid IDs; verified `Movie`/`Show` types and valid titles. Unknown types and malformed entries reject the page. `endCursor` must equal the last edge cursor; `hasNextPage` must agree with whether the last position is `N−1`. Empty/non-progressing pages for a positive total are errors. Do not increment past a missing/invalid edge.

Each pass needs every position and unique ID exactly once. Prefix entries must agree with inline state. The stable, owned rendered cards remain a downgrade-only cross-check; cards are not used to fill gaps, and entries not rendered are counted. Two passes have separate membership maps and may never repair one another's gaps. Codes distinguish wrong row, changed total/version, gap, duplicate position/ID, bad cursor/end cursor, bad entity/type, `hasNextPage` contradiction, card conflict and pass disagreement. The whole offending response is excluded; abort on the first error rather than continuing to collect a cleaner-looking result.

### Stop, Save and cleanup

S5 reuses the collector's guarded command protocol and immutable finalize result, but owns its requests. It must not inherit S4's “never abort Netflix's request” rule for these owned requests or install S4 wrappers unnecessarily.

1. Start validates everything and fixes budgets; `collecting` runs the two-pass scheduler. Coverage/agreement or any bound stops new sends and enters `read_stopped`. Stop also cancels pending **S5-owned** fetches/readers immediately, records an interruption if any, and retains only already validated evidence. Cancel discards it.
2. Save is enabled when the scheduler has stopped. Finalize queries the collector afresh, freezes its evidence, seals the generation, removes owned timers/listeners/bridge state, checks cleanup, and reruns all provenance, total, version, position, per-pass agreement and card guards. Finalize is bounded at 5 seconds; timeout discards and writes nothing. Late callbacks cannot modify a stopped/sealed result.
3. Only finalize's newly validated immutable result can be written; the popup must never serialize an earlier preview or cached envelope. Save does not silently start another pass or spend beyond the original budget. “Save again” reruns guards on the collector-held result; invalidation refuses the write. This revalidates capture evidence, not server membership “as of Save.”
4. A later capture may write a guarded `partial` result if product policy permits it; a lost profile/document guard, failed cleanup or failed finalize writes nothing. Current scope is a diagnostic: it writes **no membership file at all**.

Abort controllers cannot retract a request already received by Netflix. They stop further S5 work, not Netflix's native requests. Cleanup clears in-memory header/variable objects and normalized data on discard/expiry, never touches Netflix storage and never changes the list.

### Counts-only diagnostic report

Allow only numeric counts/timings, booleans and fixed enums/codes: adapter-supported flag (not build value), endpoint class, transport, persisted mode, requested page size, request/pass counts, accepted/rejected pages, error-category counts, timeout/budget counts, reported total, covered/unobserved positions per pass, contiguous-run count, distinct-version count, total-change count, overlap conflicts, duplicate counts, movie/show counts, two-pass agreement flag, prefix/card agreement counts, entries-never-rendered count, read-window/duration, profile invalidations and cleanup result. Always include `snapshot_unproven` while proof is absent.

No titles, title/row/document/profile IDs, cursors, hashes/fingerprints of private membership, raw variables/bodies/headers, URLs, token values or arbitrary exception/server messages. Do not log full errors to the console. Fixed codes classify errors without echoing content. A later member-selected import file may contain membership as in S4; it is separate from this diagnostic report and never becomes Git/issue evidence.

## Risks and what fails safe

| Risk | Implication and safe behavior |
| --- | --- |
| Netflix terms / automated-request detection | This is an undocumented private interface. Read-only, same-origin access does not establish permission under Netflix's terms or guarantee an account will not be challenged/restricted. Current terms and detection policy were not retrieved or evaluated; work stayed offline. Obtain that assessment before a live rollout. No evasion, challenge bypass or retry escalation; stop on denial/throttling. |
| Persisted query/build drift | A UUID may disappear, be remapped, or have a changed fragment/variable contract. Bind the adapter to a reviewed build and document; unknown build or persisted-query error refuses/aborts. No fallback hash/full-text negotiation. A server-side mapping change without a client build change remains an undetectable read-only-contract risk; schema checks only reduce it. |
| Authentication/header drift | Code inspection cannot prove the server requires no CSRF or additional header. Stop on failure; never expand credential access or copy a session-context cookie. |
| Page-size limits / heavy document | Large pages may be clamped, rejected or exceed byte/time budgets; artwork/logging fragments make payloads larger than the retained membership. Validate actual coverage; stop on limits instead of claiming complete or probing. |
| Concurrent edits / cache / non-atomic resolution | Same totals and versions can conceal changes; two reads can agree for correlated reasons. Keep `snapshot_unproven`, record windows and conflicts. No quantified false-complete rate was measured. |
| Profile switching | Browser credentials could switch between a pre-send check and server processing. Post-reply guards/prefix checks detect many changes, but this query returns no authenticated current-profile identifier and cannot eliminate a switch-and-back race. Abort on any visible change; state the remaining trusted-page limit. |
| Page-world tampering / service worker | Native-looking replies can be cached or forged. No unsupported claim of server authentication or network freshness; refuse detected displacement/invalidation. |
| Budget or cleanup failure | Stop sends, abort owned work, seal callbacks, report the specific code. Finalize/guard/cleanup failure prevents a file; never promote incomplete evidence. |

## S5 compared with reviewed S4

| Dimension | S4: observe native requests plus clicking | S5: own bounded read-only requests |
| --- | --- | --- |
| Member steps | Open My List, Start, Save: three actions. Assisted arrow clicks happen internally; manual clicks if the arrow cannot be found safely. | Same three actions for a future capture; no carousel click/template-harvest step. Counts-only diagnostic needs Open and Start, with no membership Save. Unsupported build refuses. |
| Time | Depends on native fetching, scrolling/rendering and stalls. Three-minute traversal deadline, not a measured duration. | No carousel wait; sequential requests plus fixed gaps. Arithmetic scenarios above; 90-second read deadline, no measured speed claim. Two reads cost twice the pages. |
| Coverage | Inline prefix plus observed later pages. Can miss prefetched/cached/bypassed responses; gaps have unknown cause. | Starts each pass at zero and follows validated response cursors. Can cover all positions without rendering, subject to limits. Does not fill gaps from cards or another pass. |
| Completeness proof | No demonstrated membership snapshot; always `snapshot_unproven`. | A full single response removes cross-page mixing for that read, and two agreeing full reads add repeatability evidence; still `snapshot_unproven` with current sources. |
| Safety | Adds no own requests, but hooks fetch/XHR and clicks; requires the reviewed pass-through/cleanup machinery and tests. | Adds authenticated requests, server load and automation/terms risk. No global interception or clicks; query/endpoint allowlists, bounded scheduling, abort and credential restrictions are essential. |
| Maintenance | Native client supplies its current document, variables and headers. Observer classifier/response schema and arrow/DOM/provenance rules can drift. | More transport maintenance: build/document adapter, artwork constructors, feature/header contract and response schema. Still needs profile/row/card rules, but no paging-arrow/observer pass-through dependency. |
| Save / privacy | Collector revalidates at finalize; counts-only reports; page trust and profile race limits. | Same evidence/save rule and reporting restrictions; owned-request cleanup replaces observer restoration. Does not claim server state as of Save. |

S5 fits the goal of one extension with per-service modules ([#731](https://github.com/alp82/goodwatch-monorepo/issues/731)): the shared core owns commands, lifecycle, budgets, finalize and reports; the Netflix module owns the reviewed query adapter, provenance, parser and verdict. Do not generalize an arbitrary authenticated-request executor into the shared core.

## Review and evidence needed before building or running

The next independent review should assess the chosen adapter source/distribution approach, read-only fragment inventory, header allowlist, initial total-sized request and its bounds, lifecycle/save rules, privacy and the explicit `snapshot_unproven` outcome. A positive design review permits implementing a **diagnostic**, not an unattended importer or a new `complete` verdict.

Before any owner live run, the implementation needs offline fixture and real-browser fixture verification of exact destination/body/header allowlists, zero cookie/token/storage reads, no mutation/batch/fallback/retries, clamped/error pages, all P4 faults, rate/count/time/byte/memory limits, two-pass independence and disagreements, native credential/redirect behavior, profile/navigation/build invalidation, cancellation during every async stage, cleanup and immutable finalize/save. Fixtures use invented IDs/titles only. Unlike S4, pass-through wrapper tests are unnecessary if S5 installs no wrappers; the rest of P8/P9's safety/lifecycle intent still applies.

A later separately authorized counts-only run must establish the actual transport/header compatibility, whether one bounded request returns the full row, effective page sizes, latency, end-cursor behavior, totals/versions across two reads, and failures. It must not treat success as atomicity evidence. The privacy archive (#640) remains useful for independent membership comparison, with its time gap stated. Q26 stays open; this design recommends retaining `partial` / `snapshot_unproven` until stronger evidence and an explicit reviewed policy exist.
