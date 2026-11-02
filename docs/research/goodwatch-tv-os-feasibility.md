# GoodWatch OS: smart TV product feasibility

Research date: 2026-10-20. Recommendation, not an implementation plan or an approved product decision.

## Recommendation

**Build toward GoodWatch on Android TV / Google TV as an ordinary app first. Treat replacement Home as a separate, optional experiment on explicitly supported hardware. Do not start a replacement-firmware product.** The useful product is a calm place to choose tonight's movie or episode using GoodWatch's Taste, Wishlist and watch records, then open an existing streaming app. That value does not require owning the television's operating system.

| Meaning of “GoodWatch OS” | Feasibility | Honest product promise |
| --- | --- | --- |
| Ordinary app operated with the remote | Strong technical path; store approval and provider handoffs still need validation | Tonight's pick, My movies, My shows / Next episode, Taste recommendations and service/country watchability inside an ad-free GoodWatch app. The system Home screen remains the manufacturer's. |
| Replacement launcher on Android TV / Google TV | Feasible on selected device/firmware combinations; consumer setup and ongoing support are the hard part | The same experience can become Home where the device permits it. ADB changes, accessibility workarounds and disabling the stock launcher are separate setup mechanisms, not normal app capabilities. |
| Actual replacement firmware | Technically possible for an accessible hardware platform; poor initial product fit | A device-specific OS program involving bootloader support, drivers, secure media, updates and recovery. No universal consumer-TV flashing route was established. |

The official Android app route supports both Android TV and Google TV through Google Play, subject to TV review. Android exposes a Home role, but the existence of that API does not certify that every TV's Home/startup policy can be changed by a store app. Firmware adds compatibility testing and separate Google-services licensing. These are three different distribution and support businesses. Sources: [Android TV distribution][android-distribution], [Google TV compatibility][google-tv], [Home role][home-role], [Android compatibility][android-compatibility].

The first audience should be existing GoodWatch members with one certified Android TV / Google TV device and a few installed provider apps. A provisional **one-country pilot (for example DE)** is sufficient; the user's actual launch country has not been established. The product hypothesis is that choosing with GoodWatch is valuable enough to open it deliberately. If that fails, a difficult Home takeover is unlikely to rescue it. Audience demand, willingness to pay and support cost remain unmeasured.

## Scope and evidence

Read the root [agent instructions](../../AGENTS.md), [domain rules](../agents/domain.md), [CONTEXT.md](../../CONTEXT.md), the webapp's instructions, relevant ADRs and existing research conventions before the source inspection. GoodWatch was inspected on `feat/shared-scoring`, HEAD `4f6f012682de3f73cee76d198120fe1b97abf330`, with unrelated working-tree changes present. Other work continued during inspection, so HEAD alone does not identify an immutable snapshot of every referenced working-tree file. Findings describe source, not a running deployment. Older roadmap/research notes were used as pointers, not as authoritative descriptions of today's code.

The inspiration links are [learnaifaster's X post](https://x.com/learnaifaster/status/2111751014005326146?s=20) and [nathanclark's X post](https://x.com/nathanclark/status/2112323327704621459?s=20). The orchestrator reported 403 responses; their contents were not retrieved or reconstructed here. The supplied local screenshot, `/home/alp/.local/share/ghostex/i/1792482349676.png`, visibly shows Ansub Khan's “Claude Made My Old Android TV Feel Brand New!” thumbnail and “90% FASTER”. That is promotional material, not a controlled performance result. The matching [tv-detox repository][detox-readme] links that video; its actual code and installation scripts were inspected at commit `5d40de86d3ea8482e8733cbb008e7b9c4cd02311`.

No package was installed, script from that project executed, device connected, account signed into, issue published, commit created or application code changed. No essential decision was needed to complete this study.

## What Android TV / Google TV lets us ship

### Ordinary app

A TV activity can expose a normal app tile, display GoodWatch content, receive D-pad/select/back input and launch another installed app. Google's TV entry-point requirements include `CATEGORY_LEANBACK_LAUNCHER`, no touchscreen requirement, suitable icon/banner assets and a layout designed for viewing across a room. The current guide recommends Compose for TV. Google Play distribution requires TV opt-in and quality review; the distribution page also specifies 64-bit and 16 KB page-size support from August 2026. That is a release requirement to recheck when scheduling work, not evidence that GoodWatch is already eligible. [Create a TV app][android-create], [TV quality][android-quality], [distribution][android-distribution].

An ordinary app can be ad-free in its own interface. It cannot remove advertising from the system Home screen or provider apps. Android handles `KEYCODE_HOME` itself and never delivers that key to a normal app. Likewise, a boot receiver is not a supported blanket promise of becoming the visible startup screen: background activity starts are restricted, and television power-on behavior may select live TV or the last HDMI source. [KeyEvent reference][android-keys], [background activity restrictions][android-background].

Shipping through the store avoids requiring a laptop, developer mode and network ADB for ordinary use. It still requires the developer account, signing/update ownership, review, privacy disclosures and actual TV quality checks. An internal APK installed by ADB is an appropriate future laboratory delivery method; it does not prove the eventual store route or consumer setup flow.

### Replacement launcher

The launcher is still an APK running above the existing OS. `ACTION_MAIN` plus `CATEGORY_HOME` / `DEFAULT` advertises a home activity. The public `RoleManager` lets an app check whether a role exists and request it with user consent where available. That is the supported API boundary; whether a particular Android TV firmware exposes and honors the Home choice must be tested. Foreground key interception cannot turn an ordinary app into Home. [Home role][home-role], [Home key][android-keys], [tv-detox manifest][detox-manifest].

tv-detox demonstrates the additional shell route: its installer invokes role/package commands and, when stock Home keeps winning, offers to disable recognized launcher packages. That is ADB shell authority, not permission a Play-installed app automatically acquires. A store listing for a launcher would not make those shell steps a supported consumer OS feature. Accessibility-based redirection would introduce an additional permission, lifecycle and policy dependency; it is not equivalent to becoming the actual default launcher. This study did not validate an accessibility technique. [Installer source][detox-install].

Support has to be a matrix of model, OS/build, stock-launcher version and remote:

- **Home and dedicated buttons:** A launcher may work while a vendor's YouTube/search/input buttons still depend on stock components. Long-press Home can also retain a system meaning. Test from provider apps and settings, not only while GoodWatch is visible.
- **Power-on versus Home:** Cold boot, standby wake, last-input restoration and a CEC wake are different paths. Changing default Home does not necessarily change the manufacturer's power-on input setting.
- **Updates:** GoodWatch's own signed update, a provider update, a stock launcher update and an OS OTA are separate regression triggers. Model-specific ADB changes need a recovery path and may need reapplying. Do not turn off security updates to preserve a launcher workaround.
- **Persistence and recovery:** Test without a debugging connection after setup; restore stock Home and settings before uninstalling the replacement. A launch loop or inaccessible settings is a product support failure even if technically reversible.

These are product test requirements inferred from the install/check/undo code and documented device caveats, not a claim that all models fail. [tv-detox install][detox-install], [update checker][detox-check], [undo][detox-undo], [README caveats][detox-readme].

### HDMI inputs, CEC and system controls

On an integrated Android television, a public `TvInputManager` list and a passthrough URI can expose HDMI inputs and request an existing input-viewing activity. This is distinct from reading the HDMI stream, owning the tuner or sending arbitrary CEC commands. Android's direct HDMI control service is privileged; the AOSP documentation explicitly describes `SignatureOrSystem` protection and device-dependent CEC interoperability. [TV Input Framework][android-inputs], [HDMI-CEC architecture][android-cec].

tv-detox uses the passthrough URI but also tries named stock/Droidlogic live-TV components and Google's input player. That concrete fallback list is evidence of OEM differences. On an HDMI streaming stick, the stick normally has no access to the panel's other physical input list; its system/remote may support CEC or IR power, volume and source activation. GoodWatch cannot promise a universal panel input switcher from ordinary app permissions. [Input code][detox-main], [CEC source/sink distinction][android-cec].

## What the Ansub example actually does

| Inspected artifact | Observation | Implication for GoodWatch |
| --- | --- | --- |
| [AndroidManifest.xml][detox-manifest] | A Home activity; min SDK 21, target SDK 34; network-state/Wi-Fi and package-uninstall permissions. It declares package visibility queries. It does not declare the Internet permission or a `LEANBACK_LAUNCHER` activity entry. | This is a small local launcher, not a networked GoodWatch client or a ready-made current Play TV submission. |
| [MainActivity.java][detox-main] | Native Java views, app tiles, clock, network/settings shortcuts and HDMI inputs. App launch uses `getLeanbackLaunchIntentForPackage`, then the ordinary launch intent. Back is swallowed at Home. | App launch is demonstrated; title/episode identification, provider playback integration, accounts, recommendations and watch synchronization are not supplied. Its Home Back behavior must not be copied into an ordinary app that needs to exit. |
| [install.sh][detox-install] | Installs an APK via ADB, attempts default-Home changes, conditionally disables known launchers and records changes. It separately gates disabling `com.google.android.tungsten.setupwraith`; comments describe recovery/startup failures and a rollback if Home still does not resolve correctly. | The visible result relies on privileged setup and model handling, not just drawing a calmer screen. Disabling setup components is outside a sensible first consumer pilot. |
| [check.sh][detox-check] and [undo.sh][detox-undo] | The checker can detect/reapply changes reverted by updates. Undo re-enables recorded components before removing the launcher, and tries to restore a stock notification listener. | “Persistent forever” is unsupported; recovery itself has dependencies. |
| [Smoke test][detox-smoke] | Checks installation, Home resolution, UI presence, some remote/custom-list operations and undo. No controlled speed comparison, provider-title handoff or memory benchmark was found in this test. | Emulator smoke coverage is useful but cannot establish behavior on every vendor remote, boot flow or low-end physical device. |

The repository describes approximately 30 MB RAM and a deliberately small screen. Those are the project's claims, not measurements made here; its README also attributes speed gains to cleanup. The screenshot's “90%” lacks a defined metric, hardware baseline or reproducible measurement in the inspected material. GoodWatch's network requests, artwork and personalized shelves are a different workload. No transferable speedup is established. [README][detox-readme], [source][detox-main], [test][detox-smoke].

**License checked:** the pinned [LICENSE][detox-license] is MIT, copyright 2026 Ansub Khan. Code reuse is possible with the copyright/permission notice retained for copies or substantial portions. This does not grant provider brand/media rights, certify device behavior or license other launchers. Small launcher mechanisms could inform a later spike; forking its installer is not the recommended product foundation. No other competitor's code is recommended for reuse without its own license review.

## Provider handoff is the critical integration risk

### App launch, title handoff and playback are different successes

| Capability | What establishes it | Product treatment |
| --- | --- | --- |
| Open provider app | An installed, visible package with a resolvable TV entry point | Feasible with public Android APIs. Show an actionable missing-app fallback. |
| Open chosen movie/show | The provider's TV app accepts a particular URI/intent and maps its provider ID correctly | Maintain tested provider/device/country adapters. A successful intent dispatch alone is not success. |
| Open exact episode | Correct provider episode ID/season mapping plus an accepted TV deep link | Validate separately from a series page; provider numbering can differ from GoodWatch's catalog presentation. |
| Begin playback | Provider entitlement, login/profile/age checks and app behavior permit it | Let the provider own playback. A details page can be a valid advertised handoff; don't label it direct playback. |
| Resume exact timestamp | Provider offers a suitable contract and accessible progress, or independently handles its own resume | No universal GoodWatch promise. The provider may resume according to its own account even when GoodWatch knows only the title. |

`PackageManager.getLeanbackLaunchIntentForPackage` explicitly returns the app's front door. Deep links instead depend on intent filters/verified links that the destination app owns. Android does not define a universal Netflix/Prime/Disney title-ID, episode-ID or seek-time contract. A web URL can resolve to a browser, fail to resolve on a TV or be accepted differently by a regional app variant. Private schemes and component names discovered by inspection are experimental compatibility dependencies until a provider documents/supports them. [PackageManager][android-packages], [Android deep links][android-links], [package visibility][android-visibility].

GoodWatch already stores offer URLs and has a fallback to a TMDB where-to-watch web page. Its [streaming link helper](../../goodwatch-webapp/app/utils/streaming-links.ts) and [MCP offer formatter](../../goodwatch-webapp/app/server/mcp/watch-links.ts) distinguish a provider URL from `where_to_watch`. Neither establishes a TV app link. Do not convert TMDB catalog IDs into Netflix/Prime IDs by assumption, silently open a browser on a remote-only TV, or treat a country-level show offer as proof that the selected episode is available. No provider-specific authenticated handoff was verified in this study.

The sustainable integration artifact is a small compatibility record: provider, country, device/build, app version, movie/series/episode IDs, URI/intent, documented versus observed contract, login/profile state, actual destination and last tested date. An ordinary foreground app should perform the test; ADB-only activity starts can succeed under different permissions and are not sufficient proof. Keep a fallback labeled “Open <service>” and the title/episode to find there. If testing establishes only app launch for a provider, advertise only that.

### Cross-provider progress is not available by default

Android's Watch Next API lets providers publish programs and positions; that is not an account-history API for GoodWatch. Google's codelab describes querying the programs **our own app added**. A launcher becoming Home does not itself establish complete access to every provider's recommendations or Google TV's cloud aggregation. [Watch Next publishing][watch-next], [own-program query][watch-next-codelab].

`MediaSessionManager` can expose active sessions with media-control privilege or an enabled notification listener. Even when permission can be obtained, active-session metadata is not guaranteed complete provider IDs, account/profile history, cloud progress from another device or durable completion data. Treat any such observation as an optional future experiment, never as universal Netflix/Prime sync. Opening an app, time spent away, or receiving a title in a media notification is not proof a movie/episode was watched. [MediaSessionManager][media-sessions].

Netflix documents a user-triggered CSV download of viewing activity, which is a separate portability route, not live resume synchronization. Existing GoodWatch imports can improve its own watch records; they must preserve their stated provenance and timing precision. There is no universal live streaming-account API established by this research. [Netflix viewing history][netflix-history], [GoodWatch watch-record ADR](../adr/0008-one-row-per-watch.md), [tracking state ADR](../adr/0009-tracking-is-a-state-machine.md).

For the initial product, **Next episode means Next episode according to GoodWatch's watches and current pass**. Offer explicit watch marking on TV or phone; do not mark it automatically when handing off. Exact playback resume stays in the provider app. This preserves the existing domain model rather than promising a new source of truth it does not have.

### DRM and firmware

An ordinary GoodWatch app/launcher which only hands off to installed official apps leaves streaming licenses, secure decoding, subscription checks and provider updates with those apps on their existing certified device. GoodWatch does not need to become a licensed premium-content player just to show a recommendation and launch a provider. Avoid disabling DRM, Play services, setup, input or other required system packages as part of that product.

An own player is a different proposition: a discovery/availability URL is not a stream license or authorization to play a provider's catalog. Widevine's device integration includes provisioning, Keybox and OEMCrypto; licenses involve partner business rules. AOSP compatibility can lead to separate GMS licensing, not automatically include it. Netflix's support documentation also links device compatibility to certification; that Android help page is not a comprehensive TV-model certification matrix. **Widevine capability, Android compatibility, Google services and a particular provider's approved HD/4K playback are distinct checks.** [Widevine overview][widevine], [Android compatibility][android-compatibility], [Netflix compatibility][netflix-compatibility], [Google certification help][google-certification].

Replacement firmware additionally needs a supported unlock/flash path, SoC/vendor drivers, display/audio/remote/network/input support, secure boot/media integration, signed OTA and rollback/recovery, factory reset and security maintenance. Android's bootloader documentation describes locked devices and an OEM-controlled unlock ability; developer mode/ADB is not proof that a television supports firmware replacement. Existing secure provisioning and provider approval cannot be assumed to survive a new image. A small AOSP demonstration on a development board would not establish Netflix on a retail TV. [Bootloader documentation][bootloader], [CEC hardware integration][android-cec], [Widevine integration][widevine].

An OEM partnership on one supported streaming device could eventually address this, but requires a separate commercial and certification investigation. It is not a lightweight extension of the current webapp.

## Platform support boundaries

“No supported replacement route identified” below is a conclusion about the public consumer development paths inspected. It is not a claim that firmware-specific exploits never exist. Hospitality/signage management features, rooted devices and developer installations must not be advertised as normal retail-TV support.

| Platform | Ordinary GoodWatch app and distribution | Launcher / built-in OS boundary |
| --- | --- | --- |
| Android TV / Google TV | Public Android SDK, TV UI and Google Play TV review. Best first target. Provider app launch is public; title/episode links need individual validation. | Home role exists, but support/persistence is device-specific. ADB shell changes are an enthusiast setup tier. No universal firmware path. [App route][android-create], [distribution][android-distribution], [role][home-role], [installer][detox-install]. |
| Samsung Tizen | Separate packaged TV web app, signing and Seller Office certification. Tizen application controls can request exported functionality in other apps; actual provider IDs/parameters remain an integration question. | No public consumer launcher-replacement route identified. Regular app exit returns to system UI. Partner/B2B privileges are not retail app capabilities. Developer mode is for testing, not a new firmware image. [Seller Office][samsung-store], [application controls][samsung-controls], [exit policy][samsung-exit], [privilege levels][samsung-privileges]. |
| LG webOS TV | Separate TV web app/IPK, LG Seller Lounge QA and LG Apps distribution. Public Application Manager supports app ID plus target-specific parameters. | No public consumer Home replacement identified. Developer Mode requires developer setup and has a limited session; it is not an enduring consumer distribution channel. Public webOS OSE material is not evidence of a compatible retail-TV firmware image. [App approval][lg-store], [launch API][lg-launch], [Developer Mode][lg-devmode]. |
| Fire TV | Identify OS by device: Fire OS has an Android app route; Vega OS uses a separate VPKG build/submission path. “Fire TV is Android” is no longer a safe blanket assumption. | Fire OS's documented Home event cannot be intercepted by apps. No supported consumer replacement launcher identified; old launcher workarounds cannot establish current firmware support. [Remote input][fire-remote], [Vega submission][vega]. |
| Roku | A separate Roku app is possible within its platform/store model, but a cross-provider launcher is a poor fit for the inspected rules. | Current ECP docs discontinue sending ECP from Roku apps, block publication of apps containing such commands, and state restrictions on third-party platforms such as mobile apps. Incoming system deep links remain supported. Do not propose ECP loopback or a phone controller as a supported bypass. No public Home/firmware replacement route identified. [Current ECP rules][roku-ecp], [incoming deep links][roku-links]. |
| Apple TV | Separate tvOS app through App Store; destination apps can expose supported URL routes, with provider-specific coverage. | App Store access is not Home ownership. Apple documents returning to its Home Screen with the remote; no public replacement launcher/firmware route identified. [App distribution][apple-store], [system navigation][apple-home], [tvOS URL opening][apple-links]. |

The reach alternative is a **certified HDMI streaming device** with GoodWatch plus the official provider apps, attached to a Samsung, LG, Roku TV or other display. That reaches people using those panels without porting to each built-in OS. It does not replace their OS or remove its ads; the person selects the HDMI input. CEC/IR convenience depends on the actual display, remote and device settings. Keeping the certified OS and installing GoodWatch is different from manufacturing or flashing a “GoodWatch box”; buying a generic AOSP box does not establish provider certification. [CEC architecture/interoperability][android-cec], [certification help][google-certification].

## What GoodWatch can reuse

The glossary explicitly defines **TV** as the screen inside the website's **Living room**. Keep that meaning in existing docs. Use “Android TV app”, “TV device” and “replacement launcher” for the proposed hardware product. Existing remote-shaped UI and keyboard focus are useful prior work, not evidence of native-device support. [CONTEXT.md](../../CONTEXT.md), [existing TV implementation plan](../implementation/tv-screen-revamp/README.md).

| Current evidence | Reusable part | New work or limit |
| --- | --- | --- |
| [Tonight service](../../goodwatch-webapp/app/server/tonight.server.ts), [home data](../../goodwatch-webapp/app/server/home-doors.server.ts), [TV home shaping](../../goodwatch-webapp/app/server/living-room/tv-home.server.ts) | Tonight's pick and the member's existing movie/show priorities; avoid a second ranking definition. | TV-sized payload/version contract, caching/error states, initial paint, lifecycle refresh and meaningful actions. Read executable member logic rather than the Tonight file's older introductory comment. |
| [My movies rules](../../goodwatch-webapp/app/domain/my-movies.ts), [My shows rules](../../goodwatch-webapp/app/domain/my-shows.ts), [show reader](../../goodwatch-webapp/app/server/my-shows.server.ts) | Wishlist, Continue/Pick up/Waiting for episodes, Next episode and watch marking semantics. | Remote UI and API exposure; no new provider-derived progress assumed. |
| [Taste module](../../goodwatch-webapp/app/server/taste/index.server.ts), [Watch next service](../../goodwatch-webapp/app/server/watch-next.server.ts), [viewer](../../goodwatch-webapp/app/server/viewer.server.ts) | Taste, ranking, country/services and guest/member context. Keep calculations on the existing server. | A thin TV client; no local recommendation models or database credentials on the television. [ADR 0011](../adr/0011-search-runs-as-a-role-of-the-webapp-image.md) already isolates heavy search execution on server roles. |
| [Availability evaluation](../../goodwatch-webapp/app/utils/availability-evidence.ts), [MCP watchability service](../../goodwatch-webapp/app/server/mcp/watch-links.server.ts) | Current offer evidence, source conflicts, expiration and `watchable` / `no_match` / `unknown`. | Preserve unknown availability at 30 days; distinguish subscription/free/ad-supported from rent/buy, country coverage from exact episode coverage, and availability from handoff compatibility. |
| [TV machine](../../goodwatch-webapp/app/ui/living-room/tv/tv-machine.ts), [browser binding](../../goodwatch-webapp/app/ui/living-room/tv/use-tv.ts), [room rendering](../../goodwatch-webapp/app/ui/living-room/tv/TvRoom.tsx) | Screen flow, directional movement, focus memory, Back model, components/art direction and existing tests. | DOM measurements, browser history, simulated Remote, room scene and website expansion are browser contracts. Native Kotlin/Compose needs adapted navigation/rendering; a WebView wrapper needs physical-device proof and a native launch bridge. Neither is a zero-cost port. |
| [Tonight API](../../goodwatch-webapp/app/routes/api.tonight.ts), [watch-log API](../../goodwatch-webapp/app/routes/api.watch-log.ts), [auth helper](../../goodwatch-webapp/app/utils/auth.ts), [OAuth configuration](../../goodwatch-webapp/app/server/auth/auth.server.ts) | Existing server functions, identity, sessions and OAuth infrastructure. | The inspected ordinary endpoints identify members through cookies. OAuth grants are configured for authorization code and refresh token, principally for MCP. A TV token is not automatically accepted by those routes; an RFC 8628 device grant/QR pairing flow was not found. |

A bounded file/name search found no native Android manifest/Kotlin/Gradle project, tvOS/Swift project, React Native/Capacitor app, Tizen/webOS package or Roku project. Existing “native imports” documentation concerns external tracking-data imports, not native television software. This is a scoped source finding, not proof no historical branch or private work exists.

For the first engineering experiment, use a thin Android shell and compare the existing TV screen in a minimal WebView against a small native view **only if UI-stack uncertainty is material**. Public Android guidance favors Compose for TV, while the repository's TypeScript/React work offers reuse. Choose based on focus fidelity and measured total-process memory/startup on the target, not a claim that either framework is always faster. Networked, poster-heavy GoodWatch should not ship the decorative browser room, duplicate layouts or autoplaying preview videos by default. These are proposed product simplifications, not edits to the approved website design. [Android TV UI guidance][android-create].

Phone QR pairing is optional convenience: the TV displays a short-lived verification link/code, the phone signs into GoodWatch and explicitly approves that device, and the TV receives a scoped, revocable session. Provide a typed-code alternative. RFC 8628 is an appropriate protocol reference; it defines expiry/polling and user-code security concerns. It does not mean the present auth stack already implements it. Keep provider login separate; pairing GoodWatch cannot log the TV into Netflix. Shared-screen account switching, expiry, sign-out and revocation need explicit UX. [Device authorization grant][device-auth].

Respect ADRs [0008](../adr/0008-one-row-per-watch.md), [0009](../adr/0009-tracking-is-a-state-machine.md) and [0012](../adr/0012-episode-presentation-preserves-watch-identity.md): preserve watch provenance/date precision, stored show status and canonical episode identity. No ADR change is proposed. Auto-marking a watch on provider launch or rewriting stored episode identity to match a provider would conflict with those decisions.

## Smallest sensible proof on real hardware

This is a proposed, separately authorized future experiment; none of the following was performed here.

**Scope:** one thin Android app, one GoodWatch test member, one country, Tonight's pick plus at most three short shelves (My movies, My shows, Taste suggestions), title details, explicit watch marking, optional QR/code pairing and three provider adapters. Use provider app launch as the baseline; attempt title/episode handoff without claiming it in advance. No own player, cleanup/debloat, casting receiver, voice assistant, ads platform or firmware work.

**Hardware:** start with one available certified Google TV HDMI device on a recorded Android 12/14 build, its physical remote and installed official Netflix/Prime Video/Disney+ apps. Validate the core app before trying Home replacement. Add one genuinely low-RAM older Android TV panel or certified device as the second target before any old-TV/performance claim; a fast emulator or modern high-memory box is insufficient. If no such device is available, mark low-end support unproven. Record model, RAM/`isLowRamDevice`, UI resolution, OS/launcher/provider/WebView versions, storage pressure, network and provider profiles. This is a hardware class proposal, not a claim a named model was tested.

| Acceptance check | Procedure and pass condition |
| --- | --- |
| D-pad, select and focus | Complete guest browsing and the member's Tonight → title → service path using only the physical remote. Every control is reachable; one clearly visible focus; no trap, unexpected page scroll or reliance on mouse/touch. Restore the title/card focus after Back and provider return. Test fast repeat presses and a shelf refresh removing the focused item. |
| Back and lifecycle | Back closes transient UI, goes to the previous GoodWatch screen and eventually exits the ordinary app to system Home. Process death, relaunch, network loss and return from a long provider session must recover coherently. Launcher mode has a separate root Back rule. |
| Home / boot / wake | Baseline app: Home must return to stock Home. Optional launcher lane: first try the public Home-choice flow; document any necessary shell steps separately. Require 20/20 Home returns from providers/settings, five cold reboots and ten standby wakes without a laptop attached. Record last-input and CEC-wake behavior separately. If this needs disabling a setup package, stop that lane and retain ordinary-app feasibility. |
| Updates and rollback | Test GoodWatch update signed by the same key and provider updates; perform an available OS/launcher update only on a recoverable test device under the future experiment's authorization. Verify settings, provider playback, dedicated buttons, Home and uninstall/restore. If no real OTA is available, mark OTA persistence unverified; reboot success is not update evidence. |
| Provider app launch | For each of the three services, perform ten foreground launches including cold/warm and logged-out states. Installed variants resolve; missing/disabled apps give a useful fallback. An ADB command alone does not pass. |
| Title / episode handoff | Per provider, choose five currently available movies and five episodes across at least two shows, including a later season and a numbering edge case. Observe destination, profile/login gates and country. Pass each claimed capability only when all selected cases land on the correct title/episode on both cold and warm launch. Distinguish details, series, episode, playback and timestamp outcomes. Unsupported adapters must degrade explicitly. |
| GoodWatch identity / pairing | Pair by phone QR and typed code; reject expired/reused codes and wrong-device approval. Test session restoration after reboot, phone-side revocation, TV sign-out and switching GoodWatch members. Verify saved country/services, Taste and My shows are the right member's. No provider credentials pass through GoodWatch. |
| Watch semantics | Mark an episode explicitly and observe the correct Next episode on TV and website. Cancel a provider handoff and confirm no watch is added; preserve On hold/Dropped choices and canonical episode identity. A returned provider app supplies no implicit completion. |
| Low-memory performance | On each device, record at least 20 cold app starts, 50 warm returns and 200 focus moves after artwork has loaded; repeat after provider playback and under ordinary storage/memory pressure. Measure input-to-visible-focus latency, frame timing, crash/ANR/process-recreation events, all WebView child processes if present, native/managed/graphics memory and image-cache growth. Run a 30-minute browse/handoff loop and an idle/wake cycle. |
| Proposed usability budgets | Set before the run: p95 local focus response ≤100 ms; warm return to usable UI ≤1 s; cold first usable screen ≤3 s on recorded Wi-Fi, showing an honest loading state when personalized data is late; no crash/ANR or lost navigation in the loop. These are experiment targets, not measured results or platform guarantees. Compare stock Home with an equally defined workload before any speed claim. |
| Low-RAM memory gate | Use Google's low-RAM profiling categories, not a single free-RAM screenshot or WebView host heap. For a 1 GB device the published ceiling is 280 MB total (anonymous+swap, graphics and file), with a recommended anonymous+swap+graphics limit of 200 MB. Seek materially lower use for this no-player client; record actual peaks/steady state and no unbounded cache growth. Do not compare those categories directly with tv-detox's unspecified “30 MB”. [Memory guidance][android-memory]. |

The TV quality criteria make remote navigation and Back behavior real distribution concerns; memory guidance explains why limited RAM can cause system-wide lag, process churn and slow Home transitions. The sample sizes and latency thresholds above are our proposed feasibility gates, not Google's certification thresholds. [TV quality][android-quality], [memory guidance][android-memory].

**Decision gates:** proceed with an ordinary app if focus, auth, core GoodWatch data and performance pass, and provider launch/fallback feels useful. Advertise direct title/episode handoff only for adapters that pass. Promote replacement Home only if setup is reproducible, reversible and survives the tested lifecycle without setup-component changes; otherwise keep it an unsupported research result. If a calm app that only opens providers adds too little value, investigate provider partnerships or product demand before expanding device support.

## Effort, maintenance and next decisions

Assumption-based planning ranges, not delivery commitments: with one experienced Android engineer, timely backend/auth help, available hardware/accounts and no provider negotiation, the bounded physical-device experiment is roughly **2–4 engineer-weeks**. A useful single-platform beta is plausibly **8–16 engineer-weeks total from the start**, including TV UX, pairing/auth exposure, provider fallback, telemetry, hardware regression and store preparation. Store queue time, commercial approval and unsupported deep-link investigation can extend elapsed time. Native-versus-WebView choice and present API/auth gaps can change these ranges substantially. A broadly supported replacement launcher adds open-ended device support; no meaningful firmware schedule is offered without an OEM/hardware/certification scope.

Maintenance costs come from OS/launcher changes, provider app/URI changes, regional IDs/offers, focus regressions, certificate/signing continuity and pairing/session recovery. Maintain a deliberately small tested support matrix, explicit compatibility labels and regression fixtures. Do not promise every Android TV simply because an APK installs. A hardware bundle could reduce variation but adds inventory, customer setup, remote/CEC, update and provider-approval obligations.

Proposed next decisions, in order:

1. **Approve the product promise:** GoodWatch chooses and hands off; official services play; manual/imported GoodWatch watches determine Next episode.
2. **Choose one country and available test hardware:** Record exact builds and whether testing can include a low-RAM panel and a real OTA. Keep the HDMI route separate from native Samsung/LG support.
3. **Run the ordinary-app feasibility experiment:** Make provider destination evidence and remote usability reviewable before selecting a wider roadmap or selling title-level integration.
4. **Choose the UI stack from measurements:** Reuse server/domain logic; compare WebView reuse with native focus/lifecycle/memory costs if needed.
5. **Evaluate optional launcher setup only after the core passes:** Decide whether enthusiast ADB support is acceptable or an OEM relationship is necessary. Firmware remains outside the initial scope.
6. **Validate demand and distribution:** Observe households choosing something on their real remote, whether they return voluntarily and what installation/support burden they tolerate; confirm actual store acceptance for this discovery/handoff product. No market-size, retention or revenue claim has been verified.

## Verification and remaining limits

Verified by reading current primary platform documentation, pinned tv-detox code/scripts/license, the supplied screenshot and the named GoodWatch code/ADRs. Only this Markdown note was created. Relative file links were checked locally. All prior unrelated edits were left alone; no application tests were needed or run for this documentation-only study.

Not verified: either X post's contents, the full video, provider login/URI/title/episode/timestamp behavior, store acceptance, physical remote navigation, Home/boot/OTA persistence, HDMI/CEC interoperability, pairing implementation, DRM/HD/4K playback on modified firmware, low-end measurements, willingness to pay or commercial provider permissions. The experiment is proposed evidence collection, not completed validation. No runtime or speed result should be inferred from source inspection.

## Primary sources

Links above cite the relevant owner; platform docs were accessed 2026-10-20 and can change. The tv-detox links below are pinned to the inspected commit. GoodWatch links are relative to this checkout.

[android-create]: https://developer.android.com/training/tv/get-started/create
[android-quality]: https://developer.android.com/docs/quality-guidelines/tv-app-quality
[android-distribution]: https://developer.android.com/training/tv/publishing/distribute
[google-tv]: https://developer.android.com/training/tv/get-started/google-tv
[home-role]: https://developer.android.com/reference/android/app/role/RoleManager
[android-keys]: https://developer.android.com/reference/android/view/KeyEvent#KEYCODE_HOME
[android-background]: https://developer.android.com/guide/components/activities/secure-bal
[android-packages]: https://developer.android.com/reference/android/content/pm/PackageManager#getLeanbackLaunchIntentForPackage(java.lang.String)
[android-links]: https://developer.android.com/training/app-links/create-deeplinks
[android-visibility]: https://developer.android.com/training/package-visibility/declaring
[android-inputs]: https://source.android.com/docs/devices/tv
[android-cec]: https://source.android.com/docs/devices/tv/hdmi-cec
[android-memory]: https://developer.android.com/training/tv/playback/memory
[watch-next]: https://developer.android.com/training/tv/discovery/watch-next-add-programs
[watch-next-codelab]: https://developer.android.com/codelabs/tv-watch-next
[media-sessions]: https://developer.android.com/reference/android/media/session/MediaSessionManager
[android-compatibility]: https://source.android.com/docs/compatibility/overview
[bootloader]: https://source.android.com/docs/core/architecture/bootloader/locking_unlocking
[widevine]: https://developers.google.com/widevine/drm/overview
[google-certification]: https://support.google.com/android/answer/7165974?hl=en
[netflix-compatibility]: https://help.netflix.com/en/node/57688
[netflix-history]: https://help.netflix.com/en/node/101917
[device-auth]: https://www.rfc-editor.org/rfc/rfc8628
[detox-readme]: https://github.com/Ansub/tv-detox/blob/5d40de86d3ea8482e8733cbb008e7b9c4cd02311/README.md
[detox-manifest]: https://github.com/Ansub/tv-detox/blob/5d40de86d3ea8482e8733cbb008e7b9c4cd02311/AndroidManifest.xml
[detox-main]: https://github.com/Ansub/tv-detox/blob/5d40de86d3ea8482e8733cbb008e7b9c4cd02311/src/com/ansub/tvhome/MainActivity.java
[detox-install]: https://github.com/Ansub/tv-detox/blob/5d40de86d3ea8482e8733cbb008e7b9c4cd02311/install.sh
[detox-check]: https://github.com/Ansub/tv-detox/blob/5d40de86d3ea8482e8733cbb008e7b9c4cd02311/check.sh
[detox-undo]: https://github.com/Ansub/tv-detox/blob/5d40de86d3ea8482e8733cbb008e7b9c4cd02311/undo.sh
[detox-smoke]: https://github.com/Ansub/tv-detox/blob/5d40de86d3ea8482e8733cbb008e7b9c4cd02311/ci/smoke-test.sh
[detox-license]: https://github.com/Ansub/tv-detox/blob/5d40de86d3ea8482e8733cbb008e7b9c4cd02311/LICENSE
[samsung-store]: https://developer.samsung.com/tv-seller-office/guides/overview.html
[samsung-controls]: https://github.com/Samsung/tizen-docs/blob/master/docs/application/web/guides/app-management/app-controls.md
[samsung-exit]: https://developer.samsung.com/smarttv/develop/guides/fundamentals/terminating-applications.html
[samsung-privileges]: https://developer.samsung.com/smarttv/develop/guides/fundamentals/configuring-tv-applications.html
[lg-store]: https://webostv.developer.lge.com/distribute/app-approval-process
[lg-launch]: https://webostv.developer.lge.com/develop/references/application-manager
[lg-devmode]: https://webostv.developer.lge.com/develop/getting-started/developer-mode-app
[fire-remote]: https://developer.amazon.com/docs/fire-tv/ja-remote-input.html
[vega]: https://developer.amazon.com/docs/vega/latest/app-submission
[roku-ecp]: https://developer.roku.com/dev/docs/external-control-api
[roku-links]: https://developer.roku.com/dev/docs/deep-linking
[apple-store]: https://support.apple.com/en-us/102348
[apple-home]: https://support.apple.com/guide/tv/open-an-app-atvb87e1c725/27/tvos/27
[apple-links]: https://developer.apple.com/documentation/Xcode/allowing-apps-and-websites-to-link-to-your-content
