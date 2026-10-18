# Browser routes into a shared Wishlist file

Research snapshot: **2026-10-18**. This extends [the initial import report](../streaming-watchlist-imports.md). It is a research proposal, not an accepted ADR or an implementation. Read against [CONTEXT.md](../../../CONTEXT.md), [ADR 0008](../../adr/0008-one-row-per-watch.md) and [ADR 0009](../../adr/0009-tracking-is-a-state-machine.md): saved-list membership expresses Want to See, never a watch or activity now. Apple Up Next and Hulu My Stuff need explicit classification before they can express the same intention.

**Main finding:** a shared, credential-free file is a better common boundary than a single universal browser extractor. A small extension, a bookmarklet, an iOS Safari Shortcut, a local response adapter and pasted links can all produce that file. The hard shared problems are proving which list was read, preserving provider identity, and reporting partial capture. A single title-only DOM scraper cannot establish these.

Evidence labels used below:

- **Source verified:** actual implementation or official browser capability inspected; this is not a successful signed-in provider test.
- **Publisher claim:** the tool author describes behavior, but its implementation or output was not available for inspection.
- **Design:** a technically plausible GoodWatch route requiring an experiment.
- **Unknown:** no inspected implementation established the feature.

No private accounts, authenticated provider requests, watchlist changes or extension installations were used. Repositories were cloned into `/tmp/gw-browser-research` for inspection; no upstream code was copied into GoodWatch. Commit timestamps identify inspected source, not proof that each provider still works.

## 1. Concrete packages and reusable pieces

### MediaShelf clipper: genuine multi-site list code, weak capture boundary

**Source verified.** [Commit `2edc80c4520e41c366bfc98fd01a23a5f3c2b0a4`](https://github.com/ghltshubh/mediashelf-clipper/tree/2edc80c4520e41c366bfc98fd01a23a5f3c2b0a4), 2026-08-22, version 2.0.1; [MIT license](https://github.com/ghltshubh/mediashelf-clipper/blob/2edc80c4520e41c366bfc98fd01a23a5f3c2b0a4/LICENSE). Plain JavaScript; browser APIs rather than a runtime framework. Separate site descriptors, injected readers, popup orchestration and background import are useful module boundaries. [Sites](https://github.com/ghltshubh/mediashelf-clipper/blob/2edc80c4520e41c366bfc98fd01a23a5f3c2b0a4/sites.js), [readers](https://github.com/ghltshubh/mediashelf-clipper/blob/2edc80c4520e41c366bfc98fd01a23a5f3c2b0a4/readers.js).

The current [manifest](https://github.com/ghltshubh/mediashelf-clipper/blob/2edc80c4520e41c366bfc98fd01a23a5f3c2b0a4/manifest.json) declares `storage`, `activeTab`, `scripting`, `tabs`, `alarms`, persistent provider hosts, localhost, GitHub and StreamScope; optional hosts cover HTTP/HTTPS generally. [Firefox's separate manifest](https://github.com/ghltshubh/mediashelf-clipper/blob/2edc80c4520e41c366bfc98fd01a23a5f3c2b0a4/manifest.firefox.json) uses background scripts instead of Chrome's service worker. This source already includes opt-in scheduled background tabs; it is more than an activeTab-only one-shot clipper. The popup's older one-shot comments should not substitute for manifest inspection.

The [background importer](https://github.com/ghltshubh/mediashelf-clipper/blob/2edc80c4520e41c366bfc98fd01a23a5f3c2b0a4/background.js) sends title objects to `/api/watchlist/import` with replacement enabled. That payload is tied to MediaShelf and is not a portable file contract. Partial capture followed by replacement is an unsafe model to carry into GoodWatch.

Detailed adapter findings from the two source files:

| Service | Actual route/selector evidence | Specific loss or false-positive risk |
| --- | --- | --- |
| Netflix | `/browse/my-list`; aria labels and fallback title text | No provider ID survives, despite links/tracking state potentially containing it. |
| Prime | `primevideo.com` watchlist; card labels, `/detail/` anchors, then generic images | Amazon country-store domains are not matched. Scheduled URL fixes `/region/na/watchlist`; not a regional solution. |
| Disney+ | `/watchlist`; `set-item`, `data-gv2elementkey`, browse links, image alt | Generic image fallback can include artwork outside saved membership. No Disney ID/type/year. |
| Hulu | `/my-stuff`; broad automation-labelled anchors, watch links and images | Does not select movie/show categories or distinguish mixed My Stuff entities. |
| Max | `/mylist`; `/show/` selector followed by `/movie/` | The reader returns the first nonempty selector. A mixed list with shows can silently omit every movie. |
| Apple TV | `/us/room/up-next`; `/movie/` followed by `/show/` | Same first-nonempty omission, opposite order; explicitly best-effort Up Next, with no saved-vs-in-progress distinction. |
| Crunchyroll | `/watchlist`; series links, `data-t=title`, labels and images | No series IDs retained; named Crunchylists not enumerated. |
| Paramount+ | watchlist route; shows followed by movies | Same first-nonempty mixed-type defect as Max. |
| Peacock/Tubi | My Stuff routes, links/images | Entity scope and completeness unestablished. |

The generic reader scrolls at most 25 times by 1,600 pixels, waits 400 ms, and stops when `document.body.scrollHeight` is unchanged. It then returns to the original scroll position and reads the DOM **once**. Consequences inferred directly from that algorithm: fixed-height virtualization can terminate after one step; recycled cards can vanish before the final read; nested scrolling containers are missed; a network delay longer than 400 ms can appear to be the end. Exact title-string deduplication also collapses distinct same-name works. These are algorithm findings, not claims about a specific current provider rendering implementation.

**Reuse judgment:** MIT permits considering the small descriptor/reader architecture with attribution. Reimplement capture completeness and identities. Do not take the scheduling, permissions or replacement semantics as default product requirements.

### Netflix Watchlist Manager: useful existing file compatibility

**Source verified.** [Commit `111bf8a1b21a17b463f439859b0c3711aad3148c`](https://github.com/timbillapp/netflix-watchlist-manager/tree/111bf8a1b21a17b463f439859b0c3711aad3148c), 2026-05-06, manifest version 1.0.9, MIT. [Manifest](https://github.com/timbillapp/netflix-watchlist-manager/blob/111bf8a1b21a17b463f439859b0c3711aad3148c/manifest.json), [content bundle](https://github.com/timbillapp/netflix-watchlist-manager/blob/111bf8a1b21a17b463f439859b0c3711aad3148c/js/content_script.js), [background](https://github.com/timbillapp/netflix-watchlist-manager/blob/111bf8a1b21a17b463f439859b0c3711aad3148c/js/background.js).

Its background builds sorted `{title, videoId, trackId?}` rows, omitting records without titles. The content reader uses `data-ui-tracking-context.video_id`, `track_id`, `/watch/` links and fallback text; dependencies visible in the built bundle include jQuery, lodash merging, Axios/retry and toastr. No source package manifest was present in the inspected checkout, so dependency versions/build reproducibility are not established.

It accumulates by provider ID while scanning, a useful improvement over one final DOM read. Auto-discovery stops after ten 500-ms intervals without count growth; that is a heuristic, not exhausted pagination. Exact URL comparisons to `/browse/my-list` can miss query/trailing-slash variants. Background cache is process memory; selected-profile continuity deserves an explicit test. Restore/bulk-add functionality writes to Netflix and is unnecessary for a read-only GoodWatch exporter.

**Reuse judgment:** first support its local JSON shape as a source adapter. Preserve `videoId` as a Netflix identifier, discard tracking identifiers from the portable output, and keep completeness unknown unless independently demonstrated. Importing a data format does not require shipping the upstream extension or its mutation logic.

### Netflix Backup Tools userscript: IDs beyond rendered cards, with a cap

**Source verified, current operation untested.** TGSAN's [script 420931, version 1.3 / version ID 1849749](https://greasyfork.org/en/scripts/420931-netflix-%E5%A4%87%E4%BB%BD%E5%B7%A5%E5%85%B7/code?version=1849749), updated 2026-06-12; [raw script](https://update.greasyfork.org/scripts/420931/Netflix%20%E5%A4%87%E4%BB%BD%E5%B7%A5%E5%85%B7.user.js). License is **N/A**, with no `@license`; inspect as protocol evidence only.

It resolves Netflix's member API from `unsafeWindow.netflix.reactContext.models.services.data.memberapi`, falling back to `/nq/website/memberapi/release`. Backup posts a Falcor `mylist` range **0 through 1000**, with session `authURL`, and collects reference IDs into a plain JSON array. No paging loop, titles, years or explicit types. Its filename includes profile name and GUID; GoodWatch should not propagate the GUID. A comment about 1,333 possible items is not an enforced completeness contract.

The tool describes inclusion of region-locked items. That is a lead to test, not verified current behavior. Its restore/remove/profile-switch actions mutate the account and should not be part of any extraction experiment. A separate source below documents failures of Netflix bulk pathEvaluator routes. The userscript update (June 2026) precedes the inspected UTS snapshot (October 2026), but the two use **different request purposes/shapes**: `mylist` references versus bulk metadata enrichment. Failure of the latter does not prove failure of the former; success of either does not establish current success of the other. Endpoint/build/routing differences may explain both. Only a matched, current-account experiment resolves this contradiction; no current-working claim is made here.

**Experiment:** compare list-reference IDs with visible DOM IDs, including an unavailable title and a list beyond the requested range, using a consenting account. If the endpoint fails, response capture from current first-party list navigation may be a better path than guessing old API routes.

### Binge Backup and console snippets: low-friction fallback, not complete export

**Source verified.** [Binge Backup commit `d5ea71b78928ce83931bd260205cbb1bc3d038ad`](https://github.com/chrishacia/binge-backup/tree/d5ea71b78928ce83931bd260205cbb1bc3d038ad), 2025-06-09, three repository commits; [popup](https://github.com/chrishacia/binge-backup/blob/d5ea71b78928ce83931bd260205cbb1bc3d038ad/popup.js) queries `.slider-item .fallback-text` once and downloads newline-delimited titles. No scrolling, IDs, years or deduplication. The [manifest](https://github.com/chrishacia/binge-backup/blob/d5ea71b78928ce83931bd260205cbb1bc3d038ad/manifest.json) includes `<all_urls>` both for content injection and host permission despite Netflix-specific behavior. README states MIT, but no standalone complete license notice was present; establish the license text before copying substantial code.

The author-owned [Shimilbi gist](https://gist.github.com/Shimilbi/4661701bba1d3d33e03aa6ebb549d6b2), last active 2024-01-17, provides both bookmarklet and injected-button versions that export `.fallback-text` into text. No license established. It replaces `document.body.innerHTML` to add its button: an unnecessary disturbance to the provider app. The author-owned [alana314 gist](https://gist.github.com/alana314/6bdc9af962fd8620a4fb) illustrates selector drift across versions; a later comment preserves `{name,link}`. `copy()` in those snippets is a DevTools helper, not a normal web API. Both are pattern evidence, not maintained adapters to install blindly.

The [rich Netflix Excel exporter](https://github.com/kashifumar/netflix-my-list-exporter) provided documentation rather than the promised implementation in the initial report's inspection; its repository was not independently re-inspected in this follow-up. A detailed README is insufficient evidence for React-fiber extraction or Excel completeness.

## 2. Scrobblers offer infrastructure, not proof of saved-list import

### Universal Trakt Scrobbler

**Source verified.** [Commit `555b8976d1a043bf7a0160223dced83a75030190`](https://github.com/trakt-tools/universal-trakt-scrobbler/tree/555b8976d1a043bf7a0160223dced83a75030190), 2026-10-09; [MIT](https://github.com/trakt-tools/universal-trakt-scrobbler/blob/555b8976d1a043bf7a0160223dced83a75030190/LICENSE), [package version 0.9.4](https://github.com/trakt-tools/universal-trakt-scrobbler/blob/555b8976d1a043bf7a0160223dced83a75030190/package.json). TypeScript/React/MUI/Webpack application, `webextension-polyfill`, date-fns, Rollbar and numerous build dependencies. This is a substantial extension dependency footprint for extracting a small file.

The source's meaning of “Sync” is history ingestion:

| Provider | What inspected API actually reads | Saved-list ingestion established? |
| --- | --- | --- |
| Netflix | `aui.viewingActivity` pages of 50; metadata resolves movie/show/episode IDs and year | No My List reader found in the inspected Netflix service. |
| Prime | Region startup config, profiles, `getWatchHistorySettingsPage`, metadata enrichment | No watchlist reader found in the inspected Prime service. |
| Crunchyroll | `/content/v1/watch-history/{accountId}` with `next_page` | No Watchlist or Crunchylist reader found in the inspected service. |
| HBO Max | Playback-marker endpoint; position/runtime/created mapped to progress | No saved My List. Marker history is not the Wishlist. |
| Disney+ | Playback identification; service declares `hasSync: false` | No bulk saved-list reader. |
| Apple TV | Playback identification; service declares `hasSync: false` | No Watchlist/Up Next bulk reader. |

Source paths under the pinned commit: [NetflixApi](https://github.com/trakt-tools/universal-trakt-scrobbler/blob/555b8976d1a043bf7a0160223dced83a75030190/src/services/netflix/NetflixApi.ts), [AmazonPrimeApi](https://github.com/trakt-tools/universal-trakt-scrobbler/blob/555b8976d1a043bf7a0160223dced83a75030190/src/services/amazon-prime/AmazonPrimeApi.ts), [CrunchyrollApi](https://github.com/trakt-tools/universal-trakt-scrobbler/blob/555b8976d1a043bf7a0160223dced83a75030190/src/services/crunchyroll/CrunchyrollApi.ts), [HboMaxApi](https://github.com/trakt-tools/universal-trakt-scrobbler/blob/555b8976d1a043bf7a0160223dced83a75030190/src/services/hbo-max/HboMaxApi.ts), [DisneyplusService](https://github.com/trakt-tools/universal-trakt-scrobbler/blob/555b8976d1a043bf7a0160223dced83a75030190/src/services/disneyplus/DisneyplusService.ts), [AppleTvService](https://github.com/trakt-tools/universal-trakt-scrobbler/blob/555b8976d1a043bf7a0160223dced83a75030190/src/services/apple-tv/AppleTvService.ts).

Notable negative evidence: Netflix source comments say bulk metadata pathEvaluator routes now fail and use individual metadata requests instead. This does not prove every My List pathEvaluator request fails, but substantially lowers confidence in old Falcor snippets. HBO Max source still uses legacy HBO hosts; a fresh repository commit does not establish a working modern Max adapter.

Reusable infrastructure: [ScriptInjector](https://github.com/trakt-tools/universal-trakt-scrobbler/blob/555b8976d1a043bf7a0160223dced83a75030190/src/common/ScriptInjector.ts) separates injected functions, explicitly uses `world: MAIN` under MV3 and handles background-tab timeout/cleanup. [RequestsManager](https://github.com/trakt-tools/universal-trakt-scrobbler/blob/555b8976d1a043bf7a0160223dced83a75030190/src/common/RequestsManager.ts) supplies cancellation, but also optionally rewrites cookies through a blocking webRequest hook; that part is not a portable MV3 design and should not be needed for a minimal DOM exporter. Prefer the smaller lifecycle/cancellation concepts, not wholesale session management.

### MAL-Sync and Simkl

**Source verified.** MAL-Sync [commit `944247b6923dd40eb46b0fc67f05caa90dd05508`](https://github.com/MALSync/MALSync/tree/944247b6923dd40eb46b0fc67f05caa90dd05508), 2026-10-16, GPLv3. Its [Crunchyroll module](https://github.com/MALSync/MALSync/blob/944247b6923dd40eb46b0fc67f05caa90dd05508/src/pages-chibi/implementations/Crunchyroll/main.ts) has a useful request-proxy pattern, reads episode metadata, and preserves `series_id`, `season_id`, season numbering and localized titles. Its `list` section means episode cards on an overview, not a reader of the account's Watchlist. No bulk saved-list ingestion is established by this module. Reuse would need GPL review; independently implementing an extraction contract is simpler than importing its DSL and tracker machinery.

**Publisher claim / deliberate scope limit.** [Simkl's own import documentation](https://docs.simkl.org/how-to-use-simkl/advanced-usage/import-export-data/importing-to-simkl) says its Chrome extension imports Netflix/Crunchyroll **watch history**. It is not evidence of Netflix My List, Prime, Disney+, Max or Hulu saved-list export.

A more relevant Simkl product is its [JustWatch bookmarklet](https://simkl.com/apps/import/justwatch/): the publisher says it downloads a local JSON file with saved membership, watched records and IMDb/TMDB IDs, without sending it until upload. It documents desktop Chrome/Edge/Firefox/Safari, iOS Safari bookmark editing and Android Chrome address-bar invocation. The public page was read, but the actual bookmarklet code and sample output were not obtained; a direct unauthenticated HTML retrieval met a Cloudflare 403. Do not infer schema, license or verified paging from its marketing. **Concrete next step:** inspect that user-generated file before deciding whether GoodWatch needs any Simkl account or integration at all. File compatibility may be sufficient.

## 3. Extraction techniques, in order of practical value

These are independent producer choices. A file adapter is the normalization boundary; an extension or bookmarklet is the capture mechanism. They are complementary rather than mutually exclusive.

### A. DOM plus continuous accumulation

**Design built on verified browser capability.** A user opens the exact provider list/profile and invokes a packaged reader with temporary tab access. Start with the list container, collect links/IDs/titles immediately, observe newly rendered cards, then scroll the actual container while accumulating. Never collect only after scrolling back. Union movie/show selectors inside the selected list instead of returning the first selector with results.

A capture session should retain: exact origin and list path, adapter version, selected categories, a user-visible profile label when available, unique provider IDs, reported total if available, termination reason, and warnings. No account GUID is required for a user-controlled one-off file.

Stopping must distinguish explicit end, provider-reported total reached, user stop, timeout and a safety cap. An unchanged height/count is only “no progress observed.” Empty with verified signed-in/profile/list state differs from an absent selector or login redirect. DOM capture cannot recover entries the provider never exposes to that page.

Provider IDs should come from allowed detail/watch URLs or explicit card data. Keep movie/show/season/episode namespaces distinct. Netflix episode links are not automatically show IDs; Prime IDs are not TMDB IDs; Apple `umc.*` IDs are not IMDb IDs. When year/type is absent, preserve unknown rather than infer it from the picture or label.

### B. Embedded structured state, without reading whole accounts

**Design; new Prime lead is source verified.** Read specific inert JSON scripts or selected application-state fields before scraping labels. A maintainer/user's [Prime failure report #815](https://github.com/Sandmann79/xbmc/issues/815) includes first-party HTML with `#dv-web-page-hydration-data` and `#dv-web-global-store-data` JSON scripts, plus JSON-LD ItemList. This is evidence that a current Prime page can carry structured state, **not** proof that a Watchlist page carries complete saved membership. The global script includes a customer identifier; copying all hydration data would leak unrelated state.

Experiment on a Watchlist route: locate only list entities, preserve provider IDs/type/year when present, identify a cursor/total, and compare with network responses. Distinguish the selected saved-list container from recommended content. JSON-LD Movie/TVSeries metadata on a detail page identifies a title but says nothing about saved membership.

Chrome content scripts share DOM but normally have isolated JavaScript globals. Reading a JSON script element does not require MAIN world; reading `window.netflix` does. Use the smallest MAIN-world function necessary and return only validated, serializable list fields. The provider page can interfere with MAIN-world execution. [Official content-script documentation](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts), [manifest world semantics](https://developer.chrome.com/docs/extensions/reference/manifest/content-scripts).

### C. User-armed response capture

**Design, with an important platform distinction.** Start capture, navigate to or refresh the saved-list view, let the provider load it, and normalize only recognized list responses. This avoids carrying provider passwords into GoodWatch and may reveal IDs, paging and unavailable entries hidden by the DOM. It does not make private endpoints public or guarantee all pages were loaded.

| Mechanism | Verified browser ability | Limits for this use |
| --- | --- | --- |
| MAIN-world wrapper around `fetch` / XHR | Page JS interception is feasible using the documented shared execution world | Only requests after injection; cannot recover past responses. Workers/service workers, captured original functions or other transports can bypass wrappers. Clone responses, never consume or alter the page's body; restore wrappers on stop. Requires provider-specific response validation. |
| Chrome `webRequest` | Observes request lifecycle, headers and some request bodies | **Not a general response-body API.** Do not design a universal JSON sniffer around this API. [API reference](https://developer.chrome.com/docs/extensions/reference/api/webRequest). |
| Chrome DevTools extension | `onRequestFinished` with response `getContent()` | Requires DevTools/extension panel and appropriate capture timing. Practical researcher fallback, cumbersome consumer workflow. [Official reference](https://developer.chrome.com/docs/extensions/reference/api/devtools/network). |
| Firefox `filterResponseData` | Reads/controls response streams | Requires webRequest, blocking and host permissions, plus MV3 response-filter permission. Must correctly write/close/disconnect or can stall the site. Firefox-specific, poor initial portability choice. [Mozilla reference](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/webRequest/filterResponseData). |
| Chrome debugger / CDP | Remote automation and inspection infrastructure | Broader trust/setup boundary than a one-shot DOM reader; reserve for a local research harness. |

Allowlist endpoint/operation names and extract only known list fields. Do not serialize Authorization, cookies, refresh tokens, unrelated watched data or a full application store. A page-message bridge is untrusted input: validate source/session/schema, and never let a message request arbitrary network fetches or extension privileges.

### D. Copy response / local network file adapter

**Source verified capability; GoodWatch design.** Chrome DevTools offers “Copy response” and sanitized HAR export. A technical user can capture the selected list response and paste/save it locally. GoodWatch could parse recognized response shapes in-browser and produce the shared file. This is the shortest way to discover a provider schema before building an extension. [Chrome Network reference](https://developer.chrome.com/docs/devtools/network/reference).

Sanitized HAR removes common sensitive **headers**; it does not promise removal of account identifiers or tokens from bodies, URLs or query strings. Prefer selected response bodies over full HAR. If a local HAR helper is considered, strip credentials and unrelated entries before any upload, enforce size limits, support base64 bodies, and mark missing pagination. Never ask a user to paste “Copy as cURL” into GoodWatch: it can include session credentials and executable shell text.

## 4. Lower-friction inputs and their exact scope

| Input | Useful achievable behavior | What it cannot establish |
| --- | --- | --- |
| Paste title lines / CSV / known JSON | Bring a hand-maintained shared Wishlist file or a simple exporter into matching review | A title-only row cannot reliably disambiguate remakes, years or localized titles. |
| Paste provider URL(s) | Parse an allowlisted provider identity, then resolve/review | A list-page URL does not reveal its private contents; a detail URL is one candidate intention. |
| Drag a card/link into GoodWatch | Read `text/uri-list`, `text/plain`, sometimes HTML; normalize selected links | A dragged poster may contain only its image URL. Native-app cards and recycled DOM need real-device testing. No background account access. |
| Copy/paste a selected list region | Use clipboard event plain text/HTML to preserve anchors where available | Selection may include controls, omit hidden cards or strip IDs. A reviewable partial batch. |
| Save Page / DOM snapshot / SingleFile-like archive | Parse a known saved HTML structure locally without signing GoodWatch into the service | A saved page is not proof of an entire virtualized list, and resources/scripts can contain private state. No universal parser established. |
| Print to PDF / screenshots / OCR | Last-resort candidate-title transcription | Poor identity and completion evidence; artwork text can be absent, wrong or hallucinated by OCR. Keep manual confirmation. |
| Share a title from a native streaming app | Receive a shared URL/text through a supported GoodWatch receiver | Does not enumerate account lists; actual provider app share payloads remain untested here. |

[MDN DataTransfer](https://developer.mozilla.org/en-US/docs/Web/API/DataTransfer) documents the clipboard/drag data boundary; [recommended drag types](https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API/Drag_data_store) support URL/plain-text fallbacks. This enables a design, not evidence that all provider cards expose useful payloads.

For saved HTML, parse as inert data and read selected attributes/text; never mount uploaded HTML into the GoodWatch page or execute scripts. Even inert DOM parsing can initiate some resource downloads, so parsing/processing needs an isolated design. [DOMParser security notes](https://developer.mozilla.org/en-US/docs/Web/API/DOMParser/parseFromString). Avoid a blanket “upload your entire page” flow; a tiny exported list is easier to inspect and share safely.

**A useful maintenance alternative:** let a person bookmark a streaming detail page into a dedicated browser folder when expressing a new wish. Browser bookmark export or selected URLs can become candidates in the same file. This preserves future intentions independently of provider UI, but does not recover old streaming lists and requires title resolution. No new browser-bookmark permission is needed if the person exports/pastes the folder themselves.

## 5. Portability: real choices across desktop and phones

| Route | Chrome/Edge desktop | Firefox desktop | Safari macOS | Android | iPhone/iPad |
| --- | --- | --- | --- | --- | --- |
| Shared file upload/paste | Strong baseline | Strong baseline | Strong baseline | Strong baseline with file picker | Strong baseline with Files/paste |
| Packaged DOM extension | MV3, activeTab+scripting | WebExtensions, adjusted background/API behavior | Convert/package a Safari web extension | Firefox Android possible with API/UX testing; standard Chrome extension installation sends it to desktop | Safari web extension packaged in an iOS/iPadOS app; not a raw Chrome zip |
| Bookmarklet | Possible, provider CSP/test required | Possible, test required | Possible, test required | Simkl documents Chrome address-bar invocation | Simkl documents Safari bookmark-edit flow |
| Userscript manager | Manager install/permission overhead | Manager install/permission overhead | Userscripts manager exists | Depends on browser/manager | Userscripts Safari exists; GM API compatibility must be checked |
| Safari Shortcut | — | — | Safari share action exists | — | Official Run JavaScript on Webpage action; useful DOM-to-file prototype |
| Installed PWA share receiver | Platform-dependent, do not assume | Do not assume | Do not assume | Android WebAPK is the clearest documented path | Web Share **sending** does not establish PWA share **receiving**; use Shortcut/native receiver or upload/paste |

Primary browser/platform references:

- [Chrome activeTab](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab): temporary access after an action; same-origin navigation retains it, cross-origin navigation revokes it. Different API origins may need separately requested hosts. Capture-after-click and capture-before-reload should be tested independently.
- [Chrome install help](https://support.google.com/chrome/answer/2664769): phone instructions say Add to Desktop. Do not market desktop Chrome extension packaging as Android Chrome support.
- [Firefox Android development](https://extensionworkshop.com/documentation/develop/developing-extensions-for-firefox-for-android/): API parity, manifest and mobile UX need explicit tests; background service workers are unsupported in the documented path. [Desktop/Android differences](https://extensionworkshop.com/documentation/develop/differences-between-desktop-and-android-extensions/) also exclude DevTools extension APIs on Android.
- [Apple Safari extensions](https://developer.apple.com/safari/extensions/): WebExtensions can be converted through Xcode and distributed as apps for Mac/iPhone/iPad. Browser API support and website-access grants still need device verification; conversion is not a guarantee every extension feature works.
- [Apple iOS Shortcut action](https://support.apple.com/guide/shortcuts/use-the-run-javascript-on-webpage-action-apdb71a01d93/ios): runs custom JavaScript against an active Safari webpage, after enabling script execution. A Shortcut can read visible links, return selected metadata and save a JSON file. It cannot inspect arbitrary Netflix/Disney native-app internals.
- [Userscripts Safari commit `8b743e37dd7dfc8a510aff4e5e2ab8b1cc9210df`](https://github.com/quoid/userscripts/tree/8b743e37dd7dfc8a510aff4e5e2ab8b1cc9210df), 2026-05-10, [GPLv3](https://github.com/quoid/userscripts/blob/8b743e37dd7dfc8a510aff4e5e2ab8b1cc9210df/LICENSE): available for iOS/macOS; supported metadata/GM APIs are documented in its README. A script requiring `unsafeWindow` or synchronous GM functions does not automatically work unchanged across managers. No need to bundle or copy this manager into GoodWatch.
- [MDN javascript URLs](https://developer.mozilla.org/en-US/docs/Web/URI/Reference/Schemes/javascript): CSP may block bookmarklet execution; avoid accidental document replacement when a completion value is a string. A locally embedded, versioned bookmarklet is more reviewable than one that downloads arbitrary current remote code, but still requires per-provider CSP testing.
- [MDN sharing](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/How_to/Share_data_between_apps), [web.dev OS integration](https://web.dev/learn/pwa/os-integration): distinguish `navigator.share()` sending from installed `share_target` receiving. The latter's documented baseline is Android WebAPK/ChromeOS. A title URL becomes a reviewable candidate, not proof of provider-list membership.
- [Android receive intents](https://developer.android.com/develop/ui/compose/sharing/receive), [Apple native Share extension](https://developer.apple.com/library/archive/documentation/General/Conceptual/ExtensibilityPG/Share.html): native receivers are possible if GoodWatch later has an app container. These are separate product surfaces, not a capability of the existing website by default.

A file remains portable when capture is not: a desktop export can be stored locally and opened on a phone without moving the streaming session. Conversely, a Shortcut export can feed the same parser as a desktop extension. Basic file upload/download and paste should remain available; public filesystem pickers/PWA file handlers have narrower support than ordinary file inputs.

## 6. Desktop automation as a fallback and test harness

**Design supported by official automation APIs.** A local Playwright harness can launch a dedicated visible browser profile, let the person sign in, observe allowed list responses, accumulate DOM identities and export a file. This is useful for exploratory adapters and repeatable capture diagnostics before a browser-store release. It does not require video playback or DRM access.

[Playwright authentication](https://playwright.dev/docs/auth) documents that saved browser state contains impersonation-capable cookies/headers. Keep it out of shared files, repositories, issue attachments and GoodWatch servers. Let the person own the local session and avoid exporting storage state when a single visible session suffices.

Do not assume attaching to someone's normal Chrome profile is available: [Chrome's remote-debugging change](https://developer.chrome.com/blog/remote-debugging-port) requires a non-default data directory for the affected switches from Chrome 136. [Playwright extension guidance](https://playwright.dev/docs/chrome-extensions) also distinguishes persistent Chromium contexts from branded browser sideloading restrictions. A dedicated profile, manual sign-in and explicit local capture are more reproducible than collecting the person's normal browser cookies.

Desktop UI automation/OS accessibility could drive scrolling when script injection is blocked, but no provider-specific reliable saved-list implementation was verified here. It has more setup and more localization sensitivity than file upload. Treat as a last-mile experiment, not a promised broad connector.

## 7. Small reusable modules worth designing

These are proposed boundaries, not added code or new terminology for product screens.

1. **Source detector:** exact allowlisted origin/path and selected-list evidence. Return unsupported instead of trying arbitrary image selectors on every website.
2. **Capture session:** start/cancel/progress; incrementally accumulate typed provider identities; record the stopping reason. Independent of extension popup lifetime.
3. **Provider reader:** DOM/state/response-to-observations with list membership and scope. A reader does not resolve TMDB or modify provider accounts.
4. **Existing-file adapters:** Netflix Manager `{title,videoId}`, plain title lines, recognized provider-response JSON, and later an obtained Simkl JustWatch sample. Preserve uncertainty explicitly.
5. **Credential-free serializer:** version, source/list/profile label, capture method/version, count/total/completeness evidence and items. The exact shared schema should be defined once across this research set.
6. **GoodWatch resolver/preview:** verified external IDs before provider crosswalk before title/year/type review. Shared by file, paste, drop and share inputs. Only reviewed explicit intentions become Want to See; repeated uploads must be idempotent.

MIT sources support evaluating small modules with attribution. GPLv3 sources and unknown-license snippets are separately listed to avoid accidental incorporation. Observing a schema or independently writing a protocol adapter is different from copying code. A code license also says nothing about provider API support or provider terms.

## 8. Minimal experiments with clear pass/fail outcomes

No experiments requiring real accounts were run during this research. The following keep the user's time and implementation commitment small:

| Experiment | Small artifact | Decision it resolves |
| --- | --- | --- |
| Netflix existing-file intake | One redacted Manager JSON, with actual provider IDs retained | Can the catalog resolve IDs well enough to justify extension work? |
| Netflix two capture methods | Compare DOM accumulation with the userscript's structured list-reference result, if endpoint works | Does structured extraction recover unavailable cards or just fail on current API routes? |
| Prime structured state | Redacted Watchlist hydration/selected-response fixture from the actual country domain | Can IDs/type/year be extracted without broad scraping or Kodi authentication? |
| Virtualization stress | A synthetic page with recycled cards, constant scroll height and a nested scroller | Does capture preserve every observed ID and report partial stopping instead of success? No private account needed. |
| Mixed-type selector check | Synthetic Max/Apple/Paramount list with both movie/show anchors | Prove union extraction and prevent the verified first-nonempty omission. |
| Safari Shortcut | Capture current list links to a local shared-file example on a consenting device | Is an extension-free iOS browser path usable before investing in an app wrapper? |
| Share/drop matrix | Record only MIME types and redacted payloads from each actual app/card | Which providers share stable content URLs, and which only share images or marketing links? |
| JustWatch bookmarklet file | Obtain actual output locally; inspect schema/status/IDs/pagination evidence | Can GoodWatch accept the artifact directly without a Simkl account or code reuse? |
| Permission comparison | Two minimal manifests: activeTab-only DOM vs optional cross-origin API access | Is the extra API richness worth the extra host scope for one provider? |

For real-provider validation include secondary profile, German/English titles, same-name remake, movie/show mixture, season/episode scope, unavailable item, empty list, login expiry and a list longer than the first page. Reconcile against a manual/provider count when available. A silent zero, dropped movie category or stalled scroll is a failed/partial capture, not a clean snapshot.

**Priority supported by this investigation:** establish the shared-file parser and existing Netflix-file compatibility first; run Netflix/Prime identity-and-completeness experiments next; try a Safari Shortcut as the cheapest concrete mobile capture; use response adapters to research Disney+, Max, Hulu, Apple and Crunchyroll without promising universal completeness. Maintain upload/paste/drop as independent entry points. Background synchronization and source removals need a separate provenance/conflict decision because no partial browser capture is authoritative evidence that a wish was removed.
