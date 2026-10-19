# Netflix My List through direct read-only requests: S5 design for review

Ticket [#730](https://github.com/alp82/goodwatch-monorepo/issues/730). Written 2026-10-19, continuing WIP commit `31d94eb5`; revised after Astra's review of `0fc93d4d` ("build the S5 diagnostic after changes"). Design and offline client-source inspection only; no authenticated/API request or live diagnostic was run. The public Terms of Use were checked for this revision. This replaces `DESIGN-S5-WIP.md`. The existing S4 design, diagnostic and private packages are unchanged. **Q30 (2026-10-19) now authorizes building an owner-only diagnostic and experiments on the owner's own account; member release waits on terms research [#732](https://github.com/alp82/goodwatch-monorepo/issues/732). Astra implementation review precedes owner loading.**

The owner's instruction is to explore API calls instead of slow clicking. It authorizes this S5 design despite the earlier S5 stop in [PROTOCOL.md](PROTOCOL.md) P5 and [FINDINGS.md](FINDINGS.md). That initial design instruction did not authorize a live experiment. Q30 now authorizes only the owner-account experiment, after implementation review; it does not relax the other gates. S4 remains described in [DESIGN.md](DESIGN.md), revision 3; Q26, what `complete` may claim, remains unresolved.

## Recommendation and established limits

**Build the counts-only S5 diagnostic as a complement to S4 under Q30, with an implementation review before the owner loads it. Keep it owner-only while #732 researches member terms risk. Do not promise snapshot-consistent `complete`.** A fixed, reviewed desktop build adapter can construct `CarouselPage` without inspecting Apollo's cache or replaying arbitrary page requests. If its prerequisites do not match, refuse S5; do not silently switch transports, queries, credentials or between S5 and S4. A member must explicitly start the selected mode; S5 does not trigger S4 clicks when it fails.

| Question | Offline answer |
| --- | --- |
| What does this saved build send? | JSON `POST` to same-origin `/graphql`, primarily a UUID persisted document, version 102, operation `CarouselPage`. The page's saved configuration selects this route. |
| Can it ask for the total in one request? | The query has an integer `first` argument; no server maximum or guarantee of honoring it is present in the evidence. A bounded whole-row request is a hypothesis for a later reviewed diagnostic. |
| Would one response solve `snapshot_unproven`? | No. A full whole-row response is the strongest available consistency evidence because it removes between-page mixing for that read. Neither atomic membership resolution nor a snapshot identifier has been established. |
| Would two agreeing reads help? | Yes, as measured repeatability over a shorter read window. They cannot prove that the result existed at one instant. |
| What can ship from this work? | An owner-only diagnostic package for implementation review. No member feature, live measurement or new completeness claim. |

## Evidence and reproducible source locations

Runtime evidence comes from the owner's saved My List page and its saved `akiraClient` JavaScript bundle, both inspected locally as text, without executing them. Private source contents stay outside Git. References below name structural symbols and zero-based character offsets in that one saved bundle, so a reviewer with the private files can reproduce the findings without publishing values. Offsets are locators for this capture, not runtime interfaces. The separate terms assessment cites the public legal page below.

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

Apollo's HTTP transport defaults to `POST`; the selected client path provides JSON and does not select GET for this query. Its HTTP link defaults to `credentials: 'include'`. S5 instead uses the page-world fetch selected under the integrity policy below, with explicit `method: 'POST'`, `mode: 'same-origin'`, `credentials: 'same-origin'`, `redirect: 'error'`, `cache: 'no-store'` and its own abort signal. With a conforming fetch, this sends browser-managed credentials for the same page origin without reading or setting a cookie. A response's URL must still be the pinned URL. `no-store` requests avoidance of the browser HTTP cache; it does not prove fresh server data, bypass a service worker or prevent a wrapper from changing behavior.

The request body has exactly these top-level keys (schematic, deliberately not a copied private request):

```text
operationName: "CarouselPage"
variables: <validated variables described below>
extensions: { persistedQuery: { id: <reviewed CarouselPage document identifier>, version: 102 } }
```

There is **no `query` text and no `sha256Hash`** in the primary UUID request. The identifier comes from the generated query document's `__meta__.q` in the client bundle. It is not a title ID, row ID, CSRF token or a hash to compute from the operation name. The full document, including its fragment graph, has to be reviewed as a GraphQL **query**, with no mutation or subscription definition; an operation name alone cannot establish read-only behavior.

Netflix's own UUID link handles persisted-query errors by enabling query inclusion and invoking its fallback link. That fallback is the SHA-256 APQ link: it can first send version 1 plus `sha256Hash`, and later full query text on APQ negotiation errors. S5 implements **none of these fallbacks**, and calls neither Netflix's Apollo client nor its generic fetch wrapper deliberately. The generic fetch wrapper has retries even though the Apollo retry link is disabled. An existing wrapper around the selected page fetch may nevertheless retry below S5's executor; the integrity policy cannot prove otherwise. Any persisted-query error, HTTP error or GraphQL `errors` field ends this S5 session immediately, without another S5-issued call to retry, register full text or probe other document identifiers.

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

The minimal later live diagnostic uses **one reviewed desktop adapter** and one initial S5-issued call with `P = min(N, 200)` for a positive reference total `N`. For the saved total of 77, that call asks for all 77 entries from the start. This is a bounded experiment, not a claim that 200 is supported; 200 is the existing P4 safety ceiling.

1. If the first valid response supplies the whole row, record `single_response_full` and, after the one-second gap, issue one confirming whole-row call from the start with the same `P`. If that reply also supplies the whole row, compare the complete ordered mapping and the other agreement fields, then stop. A confirming error/conflict ends the session rather than seeking a replacement response; a valid clamp follows the bounded paging rule below and cannot count as whole-row confirmation.
2. If a valid response supplies fewer entries than the requested available range while more remain, record `page_size_clamped`. Continue bounded paging with its actual `endCursor` and the same requested `P`; never report that paged result as a single-response whole-row result. The minimal owner diagnostic stops after one paged pass when the initial reply was not whole-row; a confirming pass is started only when the initial reply supplied the whole row. A clamped confirming read is also paged evidence; it cannot confirm two whole-row responses. Record the response count for each pass and classify each separately; a pass completed through several replies stays `paged_full` even if another pass later fits in one reply. For `N > 200`, record `paging_required` for the local ceiling, plus `page_size_clamped` if a response also falls below the requested available range. A normal short final page is not clamping.
3. Stop on the first failure, without retries, header negotiation, persisted-query negotiation, page-size search or a switch to S4. A valid clamp is a measured response shape, not an error or permission to increase `P`. A separate future run with different parameters requires a reviewed policy, not an adaptive error loop.

The report keeps `singleResponseFullPasses`, `pagedFullPasses`, `pageSizeClamped` and per-pass outcomes separate. No coverage is inferred from requested size or combined across passes.

A whole-row result requires exactly `N` valid unique entries at positions `0..N−1`, matching the reference total/version/row, `endCursor` equal to the last edge cursor, and `hasNextPage === false`. A shorter response with `hasNextPage === false` is a contradiction, not success. For `N > 200`, paging is required by S5's safety ceiling even if Netflix would accept more. `N = 0` has no paging request: retain S4's empty/provenance checks (row absent for 2 seconds and still absent at finalize) and `snapshot_unproven`; absence of a row is never permission to guess a row ID. A reported zero with a present or appearing row is rejected by its own P4 code.

### Coverage is not an atomic snapshot

One response containing every entry is the **strongest available consistency evidence**: it removes the between-page mixing problem for that read. Two agreeing whole-row replies add repeatability evidence. Neither establishes whether Netflix resolves its connection, edges and count atomically, whether the server caps/filters entries, or whether an intermediary/page script supplied cached or synthetic JSON. GraphQL query syntax and a single HTTP response provide no demonstrated membership snapshot contract in these sources.

`carouselVersion` still appears to be a rendering version: the saved page's seven sections share the same single-digit value, and cursors encode positions. Keep version equality as a guard, but never promote it to a membership snapshot identifier. Under current P7, every S5 result still carries `snapshot_unproven`, including a successful one-response read and an empty result. Changing P7 to accept a proved atomic single-response contract would itself need evidence and review; a field count or timing improvement cannot change it.

### Two consecutive full reads

The proposed diagnostic performs at most two independent full passes, each beginning without a cursor, within one bounded session. Validate each pass separately. Compare the ordered position-to-ID mapping, types, titles, total and version; do not compare only counts or union entries across passes. Any disagreement aborts with a distinct `repeat_conflict` or the specific validation fault. Do not loop until two happen to match.

Agreement is meaningful repeatability evidence: two separately requested traversals returned the same mapping, and a shorter interval reduces the opportunity for unobserved changes. Its reliability cannot be quantified from this saved page. Correlated caching, deterministic server selection and repeated/interleaved changes can make both reads agree without proving one snapshot. The extension may say “Two full reads agreed” alongside coverage and read-window counts; it must still report `partial` / `snapshot_unproven`. Agreement with an archive remains separate evidence with an export-time gap.

### Bounded time estimate, not a benchmark

With `k` responses per pass, average request-through-validation time `L`, and a one-second gap **after each response finishes** before starting another request, one pass takes approximately `kL + (k−1)` seconds; two passes take `2kL + (2k−1)`. Requests are sequential because the next cursor comes from the last validated response. If the server honors fixed `P`, `k = ceil(N/P)`; if it clamps, use the actual returned page size and measured `k`.

For the offline total of 77, illustrative `L = 0.25–1 second` gives:

| Effective page size | S5-issued calls for two full reads | Estimated duration |
| --- | --- | --- |
| 77 | 2 | 1.5–3 seconds |
| 26 | 6 | 6.5–11 seconds |
| 13 | 12 | 14–23 seconds |

These are arithmetic scenarios for S5-issued calls, not observed latencies, actual network-request counts or confirmed supported sizes. Native `2 × visible` does not establish 26 for this page. S4 additionally waits for carousel advancement/rendering and may need manual fallback; its actual duration has not been measured either. Report measured timings in a later diagnostic instead of promising a speedup factor.

## Safety contract and lifecycle

### Narrow operation and credentials

- One reviewed GraphQL query document: `CarouselPage` only. No mutation, subscription, query batch, arbitrary supplied document, full-query fallback, Apollo cache update or Netflix event dispatch. A persisted ID mismatch means the adapter cannot run.
- One exact HTTPS origin/path and top frame, using that page's browser-managed credentials. No extension-background requests, remote proxy, cross-origin host grants, cookie/token extraction, credential persistence or additional Netflix endpoint.
- Page-world execution is justified only to send same-origin fetches in the member's page context. Use `activeTab`/`scripting` and a narrowly scoped executor, with no global fetch/XHR wrapper. The command accepts “start this reviewed read,” never a caller-supplied URL, headers, body or operation.
- Page-world trust limitations remain: a prior fetch wrapper, service worker or hostile page script could forge data. A session nonce is a lifecycle separator, not authentication against Netflix page scripts. Do not claim authenticated server evidence.

### Fetch selection, integrity and network limits

The first diagnostic uses this explicit policy rather than assuming `window.fetch` is an unwrapped native function:

1. At Start, inspect the top-frame page realm's own `fetch` property descriptor without invoking an accessor. Require a callable data value; capture that function, its descriptor and the invocation/checking intrinsics once for this session. Reject a missing/accessor/non-callable value as `fetch_unavailable`. Never select Netflix's Apollo/custom fetch helper, search module internals for another fetch, or install/replace any page method.
2. Use the captured `Function.prototype.toString` intrinsic to reject an identifiable JavaScript wrapper as `fetch_wrapped` before sending. Do not call the candidate's own `toString` or treat a native-looking representation as proof of native provenance: callable proxies and compromised realm intrinsics can defeat the check. There is no authenticated pristine-fetch reference in this design. Record `fetchIntegrity: native_like_unproven` for a candidate that passes; never `native_verified`.
3. Require no controlling service worker for the initial diagnostic; otherwise refuse with `service_worker_controlled`. Listen for `controllerchange` while active and abort with `service_worker_changed`. Do not unregister a worker, change its scope, create a fresh frame/worker to bypass it or switch to an extension-background/isolated transport. A null controller and stable descriptors are observable guards, not proof against hidden intervention or browser-level retries.
4. Before every S5-issued call and after each asynchronous stage, compare the current fetch data value and descriptor to the captured baseline, check the service-worker guard and generation, and rerun provenance. Displacement aborts with `fetch_displaced`; never recapture the replacement or silently fall back. Invoke only the captured candidate with the reviewed endpoint/options. A wrapper already underneath it can remain invisible.
5. Own the deadline independently of fetch settlement. On Stop, invalidation or timeout, abort the supplied signal, cancel any owned reader, close the scheduler and invalidate the binding immediately even if the selected function ignores abort or never settles. Do not wait for that promise before sealing/releasing data. Attach rejection handling; a late resolution is dropped without parsing or accepting its body, and any available late body is cancelled. No late callback may mutate the finalized report or start another call.

**Count, rate, concurrency and retry claims refer to S5-issued calls**: invocations made by this scheduler. S5 issues no retry. A pre-existing native-looking wrapper can issue several network requests for one invocation, modify options or ignore cancellation. A service worker can also retry or add requests where present despite the guard's limits; the browser/network stack can retry independently. Without independent observation, report `networkBehavior: unproven`; do not label the call budget a wire-request cap or claim an aborted signal stopped transport work. Independent fixture-server measurements can establish fixture behavior, not Netflix's live network behavior. No live network instrumentation is added by this design.

### Bounds fixed at Start

| Bound | Proposed value | Failure behavior |
| --- | --- | --- |
| Full passes | At most 2, no automatic rerun | Stop after agreement or first conflict. |
| Concurrency / rate | 1 active S5-issued call; at least 1 second after completion before the next start | Scheduler enforces inside all waits, including the pass boundary. Abandonment ends the run; it does not free a slot for another call. |
| Call budget | 60 total S5-issued calls across both passes, counted before invocation | `request_limit`; no extra allowance at Save. Wrappers, service workers and native page traffic are not controlled by this count. |
| Read deadline | 90 seconds from Start, checked through waiting, streaming, parsing and transfer | Close scheduler and abandon owned work; `read_timeout`. Transport cessation is unproven. Large lists may be refused or partial within these bounds. |
| Per-call acceptance deadline | 8 seconds, capped by remaining read time, independent of fetch settlement | Abort signal/cancel owned reader, abandon call; `request_timeout`, no S5 retry. Synchronous parsing is byte-bounded, checked before/after and never accepted past deadline. |
| Body / variables before send | 64 KB / 16 KB | `request_too_large`, no send. |
| Response / retained session memory | 2 MB per response / 8 MB accounted raw chunks, strings and normalized entries | Cancel owned reader; `response_too_large` / `budget_exceeded`. Stream-count bytes before JSON parsing. |
| Total / page size / positions | Total 0–5,000; page size 1–200; decoded positions 0–4,999, below total | Specific P4 failure; reject entire page. |
| Entries / title | At most 5,000 per pass; title at most 1,000 characters, no control characters | Reject malformed page; two-pass storage must also fit the memory budget. |
| Overall session / provenance age | 10 minutes; document loaded on My List within 10 minutes | Discard on expiration; no file. Read deadline remains 90 seconds. |

The call, byte and acceptance-time bounds apply even when a response is an error. Increments happen before invocation, so throws/failed starts cannot escape accounting. No further S5-issued call to retry timeout, 429, 5xx, authentication failure, GraphQL error, redirect, non-JSON response or any unrecognized shape. These conservative budgets are design choices for review, not a claim that Netflix permits this rate. They do not bound transport-side retries, third-party wrapper/worker traffic or Netflix's native traffic.

### Provenance and page validation

Carry forward P1–P4 and P6–P7, the 0.0.7 provenance rules and S4's binding/parser checks. Before every send, after every reply/transfer and at finalize, require the same current profile (unique avatar match against state), document identity/load route, top-frame origin/path, freshness, unchanged inline-state fingerprint, unique My List row/heading, reference row ID, total and version. Any profile, navigation, back-forward cache restore, build or reference change invalidates the session and aborts owned work. Profile markers stay in memory, never in reports or logs.

Bind each request to generation, document, profile, build adapter, row, reference fingerprint, pass, cursor/decoded start position, requested size, version and initiation time. Accept only HTTP 200 JSON with no GraphQL errors; the expected `data.node` section type/ID/label; one unambiguous entities connection; matching version/total; contiguous edge positions beginning immediately after the bound cursor; unique valid IDs; verified `Movie`/`Show` types and valid titles. Unknown types and malformed entries reject the page. `endCursor` must equal the last edge cursor; `hasNextPage` must agree with whether the last position is `N−1`. Empty/non-progressing pages for a positive total are errors. Do not increment past a missing/invalid edge.

Each pass needs every position and unique ID exactly once. Prefix entries must agree with inline state. The stable, owned rendered cards remain a downgrade-only cross-check; cards are not used to fill gaps, and entries not rendered are counted. Two passes have separate membership maps and may never repair one another's gaps. Codes distinguish wrong row, changed total/version, gap, duplicate position/ID, bad cursor/end cursor, bad entity/type, `hasNextPage` contradiction, card conflict and pass disagreement. The whole offending response is excluded; abort on the first error rather than continuing to collect a cleaner-looking result.

### Stop, Save and cleanup

S5 reuses the collector's guarded command protocol and **v3 release rule**, with a counts-only terminal result. It owns the calls it issues and may abort their signals/cancel its readers; it never aborts Netflix's native requests or installs S4 wrappers unnecessarily.

1. Start validates everything and fixes budgets; `collecting` runs the two-pass scheduler. Agreement, a bound, failure or Stop closes the scheduler and enters `read_stopped`. Stop/invalidation interrupts pending S5 work immediately under the independent-deadline policy. Keep already validated private evidence only until this run's bounded validation/report construction; Stop must not leave it waiting indefinitely for Save. Cancel/expiry discards private evidence immediately.
2. Automatically finalize on `read_stopped`. Query the collector afresh, seal the generation, and, while private evidence is still available, rerun all profile/document/reference, total, version, position, per-pass agreement and card guards. Derive the verdict and a fresh counts-only report from that validated evidence; interruption/fault codes cannot be cleared by finalizing. Never serialize a preview or cached membership envelope. This validates the read evidence, not server membership “as of Save.”
3. **Successful finalize also releases all private evidence.** After validation and counts-report construction, clear both membership maps and indexes, duplicate/page signatures, all card IDs/titles/stability state, raw chunks/decoded JSON/responses, header and variable/body objects, cursors, request bindings, profile markers, inline reference values/entries/fingerprints, per-page build/configuration values and all bridge/outbox/session-token state. Remove owned timers/listeners/ports and release module/executor references. Preserve only the deeply immutable sanitized counts report, its fixed verdict/codes and a terminal state. Report cleanup outcome before freezing/returning it; a release failure is `cleanup_failed`, never successful finalize.
4. Apply the same release to interrupted, failed, cancelled and expired runs and to finalize timeout. Finalize is bounded at 5 seconds independently of a pending fetch; timeout seals/discards and exposes no successful result or file. Release is idempotent. Async callbacks must capture only a revocable holder whose private fields can be cleared; do not keep copies of bodies/headers/profiles in long-lived closures. Detached fetch promises may have a sanitized no-op rejection handler, never a retained membership/reference/bridge closure.
5. Current scope writes **no membership file**. Any report Save/Copy (including repeated Save) uses only the immutable counts report; it cannot reconstruct private evidence or issue calls. A future membership-export lifecycle needs separate review and must preserve the collector re-query/Save-revalidation rule before serialization. The diagnostic retains no private envelope for that future feature.

Release means removing diagnostic-owned references, not guaranteed memory zeroization or deletion from Netflix, the browser or an intervening wrapper/worker that already received a request. An abort signal cannot retract a received request or compel an abort-ignoring wrapper to stop. No browser-memory/transport erasure claim is made. Cleanup never touches Netflix storage or changes the list, and late callbacks cannot repopulate released state or mutate the immutable report.

**Release tests must inspect actual retained values**, carrying forward the v3 test in `diagnostic/test/core.test.mjs` that inspects maps rather than trusting a `released` flag. With invented sentinel IDs/titles/profile/reference/cursor/header/body values, demonstrate that the populated diagnostic-owned module, collector, executor, binding, card, buffer, timer and bridge state contains them before release and none remains reachable through those holders afterward. Cover successful whole-row and paged completion, interruption during fetch/body-read/validation/transfer, failure, Cancel, expiry and finalize timeout. Include completed calls and still-unsettled/abort-ignoring calls; resolve/reject them late and assert that no private state returns and the report remains byte-identical. Assert actual empty/null fields and removed callbacks/ports, not only counters, flags or an empty membership map. These tests do not claim to inspect or erase browser/wrapper-owned copies.

### Counts-only diagnostic report

Allow only numeric counts/timings, booleans and fixed enums/codes: adapter-supported flag (not build value), endpoint class, selected transport/integrity class, service-worker guard outcome, `networkBehavior: unproven`, persisted mode, requested size and returned edge count **per response**, bytes read and timing per call/response/pass, S5-issued/abandoned-call and completed/interrupted-pass counts, accepted/rejected pages, error-category counts, timeout/budget counts, reported total, covered/unobserved positions per pass, contiguous-run count, numeric cursor-progression counts (advances, stalls, invalid transitions; no cursor values), distinct-version count, total-change count, overlap conflicts, duplicate counts, movie/show counts, `singleResponseFullPasses`, `pagedFullPasses`, `pageSizeClamped`, per-pass outcome, two-pass agreement flag, prefix/card agreement counts, entries-never-rendered count, read-window/duration, profile invalidations and cleanup result. Label call counts as **S5-issued calls**, never measured network requests. Always include `snapshot_unproven` while proof is absent.

No titles, title/row/document/profile IDs, cursors, hashes/fingerprints of private membership, raw variables/bodies/headers, URLs, token values or arbitrary exception/server messages. Do not log full errors to the console. Fixed codes classify errors without echoing content. A later member-selected import file may contain membership as in S4; it is separate from this diagnostic report and never becomes Git/issue evidence.

## Risks and what fails safe

| Risk | Implication and safe behavior |
| --- | --- |
| Netflix terms / automated-request detection | [Netflix Terms of Use §1.8](https://help.netflix.com/legal/termsofuse) (checked 2026-10-19; page updated 2026-04-10) restrict automated access, extraction, reverse engineering and code insertion unless explicitly authorized, and allow termination or restriction of service. These restrictions concern **S4 as well as S5**: observing/clicking is not a terms-safe alternative. Same-origin credentials, read-only intent and a low rate do not establish permission. Detection and enforcement likelihood are unknown; neither approach can be represented as undetectable or account-risk-free. No evasion, challenge bypass or retry escalation; stop on denial/throttling. Q30 authorizes only the owner-account experiment after implementation review; member release waits on #732. |
| Persisted query/build drift | A UUID may disappear, be remapped, or have a changed fragment/variable contract. Bind the adapter to a reviewed build and document; unknown build or persisted-query error refuses/aborts. No fallback hash/full-text negotiation. A server-side mapping change without a client build change remains an undetectable read-only-contract risk; schema checks only reduce it. |
| Authentication/header drift | Code inspection cannot prove the server requires no CSRF or additional header. Stop on failure; never expand credential access or copy a session-context cookie. |
| Page-size limits / heavy document | Large pages may be clamped, rejected or exceed byte/time budgets; artwork/logging fragments make payloads larger than the retained membership. Validate actual coverage; stop on limits instead of claiming complete or probing. |
| Concurrent edits / cache / non-atomic resolution | Same totals and versions can conceal changes; two reads can agree for correlated reasons. Keep `snapshot_unproven`, record windows and conflicts. No quantified false-complete rate was measured. |
| Profile switching | Browser credentials could switch between a pre-send check and server processing. Post-reply guards/prefix checks detect many changes, but this query returns no authenticated current-profile identifier and cannot eliminate a switch-and-back race. Abort on any visible change; state the remaining trusted-page limit. |
| Page-world tampering / service worker | Native-looking fetches/replies can conceal retrying or abort-ignoring wrappers and cached/forged responses. Apply the fetch-selection, displacement and service-worker guards; refuse detected intervention. Bounds cover S5-issued calls and accepted data, not independently verified network behavior. |
| Budget or cleanup failure | Stop S5-issued calls, request abort/cancel readers, seal callbacks and report the specific code. Release private state on success and interruption alike. Finalize/guard/cleanup failure prevents a successful result/file; never promote incomplete evidence or claim signal cancellation stopped hidden transport work. |

## S5 compared with reviewed S4

| Dimension | S4: observe native requests plus clicking | S5: own bounded read-only requests |
| --- | --- | --- |
| Member steps | Open My List, Start, Save: three actions. Assisted arrow clicks happen internally; manual clicks if the arrow cannot be found safely. | Same three actions for a future capture; no carousel click/template-harvest step. Counts-only diagnostic needs Open and Start, with no membership Save. Unsupported build refuses. |
| Time | Depends on native fetching, scrolling/rendering and stalls. Three-minute traversal deadline, not a measured duration. | No carousel wait; sequential S5-issued calls plus fixed gaps. Arithmetic scenarios above; 90-second acceptance deadline, no measured speed claim. Two reads cost twice the pages. Hidden transport behavior remains unproven. |
| Coverage | Inline prefix plus observed later pages. Can miss prefetched/cached/bypassed responses; gaps have unknown cause. | Starts each pass at zero and follows validated response cursors. Can cover all positions without rendering, subject to limits. Does not fill gaps from cards or another pass. |
| Completeness proof | No demonstrated membership snapshot; always `snapshot_unproven`. | A full single response removes cross-page mixing for that read, and two agreeing full reads add repeatability evidence; still `snapshot_unproven` with current sources. |
| Safety | Adds no own requests, but hooks fetch/XHR and clicks; requires the reviewed pass-through/cleanup machinery and tests. The terms restrictions on automation, extraction and code insertion concern this route too. | Issues authenticated calls and can add server load. Shares the terms/account risk; no global interception or clicks. Query/endpoint allowlists, fetch-integrity checks, bounded S5-issued calls and credential restrictions reduce technical risk without establishing permission or transport control. |
| Maintenance | Native client supplies its current document, variables and headers. Observer classifier/response schema and arrow/DOM/provenance rules can drift. | More transport maintenance: build/document adapter, artwork constructors, feature/header contract and response schema. Still needs profile/row/card rules, but no paging-arrow/observer pass-through dependency. |
| Save / privacy | Collector revalidates at finalize; v3 diagnostic releases private evidence and retains counts only; page trust and profile race limits. | Same guarded validation and v3 release rule on successful/interrupted diagnostic finalize; only the immutable counts report survives. No membership Save. Does not claim server state as of Save. |

S5 fits the goal of one extension with per-service modules ([#731](https://github.com/alp82/goodwatch-monorepo/issues/731)): the shared core owns commands, lifecycle, budgets, finalize and reports; the Netflix module owns the reviewed query adapter, provenance, parser and verdict. Do not generalize an arbitrary authenticated-request executor into the shared core. Initially S5 complements S4 as an explicitly selected diagnostic mode; neither failures nor unsupported builds silently launch the other mode.

## Review and evidence needed before building or running

Astra's review of `0fc93d4d` accepted the endpoint/credential restrictions, reviewed query adapter, no-retry policy and `snapshot_unproven`, with changes required for successful-finalize release, fetch/network limits and the terms assessment. This revision specifies those changes and the minimal diagnostic above. The disposition is **build the diagnostic after changes**. Q30 now authorizes the owner-only implementation in [s5-diagnostic](s5-diagnostic/README.md), with an Astra implementation review before the owner loads it. Member release waits on #732; the owner live run and all server compatibility measurements remain outstanding. No completeness verdict changes.

Before any owner live run, the future implementation needs offline fixture and real-browser fixture verification. Fixtures use invented IDs/titles only:

- Exact endpoint/body/header allowlists and selected desktop adapter; zero cookie/token/storage reads; no mutation, batching, S5 retry, header negotiation, document fallback or page-size search. Test whole-row then confirming whole-row, valid clamping then bounded paging with distinct result classification, and immediate stop on each fault. Assert no implicit switch between S4 and S5.
- Every P4 fault, S5-issued-call count/rate/concurrency and acceptance deadlines, byte/memory limits, per-pass independence, cursor progression and disagreements, credential/redirect behavior, profile/navigation/build invalidation and all async cutoff stages. Verify requested/returned page sizes, actual bytes and elapsed timings, S5-issued-call/pass counts, coverage, agreement and distinct fixed failure codes in the report.
- **Fetch intervention fixtures:** A plainly wrapped retrying fetch is refused before invocation. Replacement after selection is detected without another call. A native-looking callable proxy that retries demonstrates one S5-issued call versus multiple fixture-server requests; the report must not claim native verification or a wire-request cap. An abort-ignoring candidate that never settles, or resolves/rejects late, must not extend acceptance/finalize deadlines, trigger another call, repopulate private data or alter the frozen report. Test accessor/missing fetch, controller-present refusal and controller change; use a fixture worker that retries/adds requests to establish why worker-controlled traffic cannot inherit the S5 budget. These are intervention tests, not S4 pass-through tests; installing no S5 wrapper does not remove their necessity.
- **Actual-value release assertions** specified above for completed and interrupted requests, including retrying/abort-ignoring fixtures. Test module/collector/executor/card/header/variable/cursor/profile/reference/bridge state, not just a release flag; inspect it both immediately after finalize and after late settlement. Verify cleanup failure/timeout cannot yield a successful result, and repeated report Save/Copy retains only immutable sanitized counts.

A later separately authorized counts-only run uses the minimal flow above to test transport/header compatibility, whole-row retrieval first, a confirming whole-row read if successful, or bounded paging if validly clamped/required. Record requested and returned sizes, bytes, timings, S5-issued-call/pass counts, coverage, cursor-progression counts, agreement and fixed failure codes. Single-response and paged evidence stay separate. Independently established network behavior would be additional evidence; the diagnostic's own counters do not establish it. A full whole-row reply is the strongest available consistency evidence, and an agreeing second reply adds repeatability, but neither proves a snapshot. The privacy archive (#640) remains useful for independent membership comparison, with its time gap stated. Q26 stays open; retain `partial` / `snapshot_unproven` until stronger evidence and an explicit reviewed policy exist.
