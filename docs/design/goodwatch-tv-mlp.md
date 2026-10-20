# GoodWatch TV MLP

Product specification, 2026-10-20. Status: feature scope agreed by the user ("sounds good"); detailed product defaults remain proposed. No implementation is authorized by this document.

## Promise and audience

**Press Home, choose a movie or show you want to watch, and open its streaming app. Keep your next choice ready when you return.**

GoodWatch TV replaces Home with two main entry points: **Watch next: movies** and **Watch next: shows**. Details explain the scores and where to watch. For shows, the episode tracker keeps the person's explicitly recorded progress. Official streaming services own playback.

The first audience is people new to GoodWatch. They need neither ratings nor watch history to have a useful first session. Easy phone connection lets them create or connect their GoodWatch account without entering account credentials with a remote. People can also use the launcher and make local Want to See choices without an account.

The delightful moment is modest: a person chooses a few titles during setup, returns to Home, and immediately recognizes their own movie and show choices. After an episode and an explicit watch mark, their next visit offers the correct Next episode. No generic popularity feed pretends to know their Taste.

## Confirmed scope and authority

The user agreed the following five-part version-one scope:

1. **Onboarding**, including easy phone QR/code connection and a typed-code alternative.
2. **Watch next for movies.**
3. **Watch next for shows.**
4. **Details with scores, where to watch, and the show episode tracker.**
5. **Handoff to streaming apps.**

The following are confirmed constraints, not additional product modules:

- **Home replacement is essential.** An ordinary app that the person must reopen from stock Home does not meet this MLP.
- **Installed app access and system Settings stay reachable.** They remain launcher essentials alongside the two Watch next entry points.
- **New GoodWatch users are the first audience.** Existing account data can improve setup, but must not be a prerequisite.
- **One GoodWatch account can be connected at a time in version one.** Multi-user support is important, necessary future work. Household recommendations and profile switching are outside version one.
- **Development starts locally with an Android TV emulator.** Android TV / Google TV is the proposed initial platform. No physical brand/model support is established.

The [feasibility study](../research/goodwatch-tv-os-feasibility.md) remains historical evidence. This specification supersedes its app-first recommendation and existing-member audience for product scope. It does not overturn its platform limits. A local launcher demonstration and a supported retail-hardware release are separate outcomes.

The five parts and confirmed constraints above are agreed. All numerical targets, layout choices, country/provider defaults, and rollout gates below are proposed. They are not tested facts or additional confirmed user decisions.

## First use

### Establish a working Home first

Installation ends with GoodWatch as the selected Home on the named test environment. Before account setup, the person can open installed TV apps and system Settings. They can also restore stock Home. These controls remain reachable while onboarding is open.

Setup can use an honest developer/enthusiast workflow for a narrow tested device matrix. It must state what changes, how to undo them, and what a system update could affect. Prefer a supported Home choice. If a specific build requires ADB setup, document and test that exact path. Do not require disabling setup/provisioning components or disabling security updates. If reliable, reversible Home replacement cannot be achieved, that build does not qualify for the MLP.

Android documents a Home role whose availability can change. A working app tile does not prove that role works on a television. [RoleManager](https://developer.android.com/reference/android/app/role/RoleManager) is an API reference, not a retail compatibility guarantee.

### Connect, choose services, add titles

The proposed onboarding has three short steps. Each has a clear skip or back path. Opening an installed app never depends on finishing them.

| Step | Person's experience | Required result |
| --- | --- | --- |
| Connect GoodWatch | Scan the TV's QR code. Alternatively, open the displayed address on a phone or computer and type the displayed code. Sign up or sign in there. Review the named TV and approve its connection. “Use without an account” remains available. | A new person can create an account; a returning member can connect an existing one. No account credentials need remote entry. QR and typed code are two entrances to the same connection flow. |
| Country and services | Confirm a country and select the streaming services the person uses. A connected account can reuse its existing choices after review. Remote selection works; optional phone assistance is convenience. | Store explicit choices in the connected account or locally for an unconnected person. Installed apps can suggest services, but never establish subscription ownership. Skipping means availability is unknown until a country/service selection exists. |
| Add a few titles | Choose “Want to See” on movies and shows the person intends to watch. Offer at most six starter movies and six starter shows, plus a bounded title lookup when none appeal. Suggest adding one of each; require no minimum. | Only explicit Want to See actions populate Wishlist. A finished step opens Home with the selected titles visible. “I'll add titles later” produces honest empty states. |

The starter chooser exists only in onboarding and the “Add titles” action of an empty or populated Watch next section. It is not a new discovery destination. Label its initial ordering “Popular”, with the selected country/service context visible. Without verified availability, do not call these worthwhile suggestions or say they are on the person's services. Title lookup shows a small result set and requires an explicit selection. It does not add a descriptive-search product, genres explorer, or infinite recommendation feed.

Never preselect starter titles, silently fill Wishlist, or convert a rating into Want to See. Skipping setup does not remove the launcher. No phone or no network means account connection can wait.

### Connection behavior

The TV waits without blocking app access. The phone shows the GoodWatch account and named TV before approval. Approval establishes a TV session; cancellation leaves the TV unconnected. Codes expire, cannot be reused, and can be regenerated. A typed-code route means typing the code on the phone/computer, not typing an account password on the remote.

If signup needs email verification, the phone explains that step. The TV remains usable and waits for a completed, approved account connection. A pending email or an opened QR page is not a successful connection.

Connection pairs **GoodWatch only**. Netflix, Prime Video, and other services keep their own login and profile selection. A provider app can still ask the person to sign in.

This connection is new engineering. Existing OAuth/session infrastructure is reusable evidence, not a ready TV device grant. The [current OAuth configuration](../../goodwatch-webapp/app/server/auth/auth.server.ts) exposes authorization-code and refresh-token grants. The protocol reference for a TV flow is [RFC 8628](https://www.rfc-editor.org/rfc/rfc8628). Device approval, TV session authorization/revocation, and optional phone setup need an explicit implementation contract.

## The product loop and first return

After onboarding, the person opens **Watch next: movies** or **Watch next: shows**. They choose a title, read its scores and service offers, and open a streaming app. Returning Home brings them back to GoodWatch. Nothing becomes Seen merely because the provider opened.

On their first return, their Want to See choices are still present. Reopening the list restores the chosen title when it still exists. Details remain one selection away; there is no forced completion question. The person explicitly marks the movie or episode watched in details. A connected account then shows the same change on the website. Explicit phone changes appear on the TV after refresh.

For a new show, the person can use the episode tracker to record what they have already watched. The next eligible episode follows GoodWatch's existing rules. They do not need to rate titles first.

Home never restarts onboarding after completion or skip. Setup remains available in Settings. A declined connection offer does not reappear on every Home press.

## Daily Home and the two Watch next sections

Home gives the two Watch next entry points the strongest visual emphasis. Each can preview up to three relevant entries. A small installed-app strip and Settings remain visible and subordinate. There is no Tonight's pick hero, autoplay trailer, sponsored content, or unrelated dashboard.

The default focus is the last-used movie/show entry point, or movies on first use. A Home press returns to this root. Back within GoodWatch closes a panel, then returns through details and lists to the root. Back at the root stays at Home. It does not exit into a launcher loop or trap the person away from Settings/recovery.

Every screen works with D-pad, select, and Back. Focus remains visible and returns to the relevant card. Refresh must not rearrange the screen under an active selection. Process recreation restores a valid screen/focus or returns safely to Home. Empty, error, offline, and signed-out states retain working app access and Settings. The [TV quality guidance](https://developer.android.com/docs/quality-guidelines/tv-app-quality) provides a remote-usability baseline; default-launcher root behavior needs its own test.

| Entry point | Product behavior and domain mapping |
| --- | --- |
| Watch next: movies | A compact TV presentation of **My movies**: the person's Want to See movies. Use the existing ranking defaults, with Last added when Taste is insufficient. On my services is the default when services exist. Show remaining Wanted titles separately when they do not match, with truthful availability status. No moods/time controls in version one. |
| Watch next: shows | A compact presentation of **My shows**, not a second queue. For a member, show the existing Continue entries with Next episode, the Waiting for episodes row, then Pick up, then Want to See shows to start. Preserve domain ordering/status rules. For an unconnected person, only locally Wanted shows to start exist; there is no fabricated episode progress. |

Both lists show a manageable first page, with explicit navigation to more of the person's titles. They are finite collections of intentional choices, not recommendation shelves. Keep “Add titles” available without making it the Home's main destination.

Existing Watching/Seen shows with new episodes remain represented through My shows rules. Existing On hold and Dropped choices remain intact and outside the active choices. A compact secondary group can reach those titles and their detail status actions. This is part of the show list, not a new library-management module.

**Tonight's pick remains unchanged.** Its existing member rule prioritizes the Next episode of a recently active Watching show, then My movies, then a show to start. This MLP does not expose a separate Tonight destination or relabel an initial popular title as that pick. The [existing service](../../goodwatch-webapp/app/server/tonight.server.ts) also has a guest path for a last-added Wishlist title; this specification does not redefine it. A first-use Popular chooser is neither Tonight's pick nor personal Taste.

### Empty and unavailable states

| State | Required behavior |
| --- | --- |
| No Wanted movies | Say “Add movies you want to see” and open the bounded chooser. Do not fill the list automatically. |
| No active or Wanted shows | Say “Add shows you want to see”. A connected member can find a show and record earlier episodes through its details. |
| No titles on selected services | Keep Wanted titles reachable. Explain the filter, distinguish unknown from a verified non-match, and offer service review or widening to everywhere. Do not silently replace the list. |
| Country/services skipped | Show intentional titles without a “watchable on your services” promise. Offer the short selection step at where-to-watch. |
| Network absent at first start | Open installed apps and Settings immediately. Explain why catalog lookup/connection cannot run. Never show an endless loading screen. |
| Network absent after use | Retain app access, local choices, and previously cached title context. Label last-known availability rather than presenting expired offers as current. |
| Account session expires | Keep launcher controls working. Explain reconnection and protect cached account data. Do not silently turn member changes into guest data. |

## Details and streaming handoff

Details contain only what helps choose, open, and track:

- **Identity and context:** Title, poster, year, brief synopsis, movie runtime or episode runtime where known.
- **Scores:** Existing GoodWatch and available source scores with their names and scales. Unknown scores remain absent/unknown. The person's own rating is a separate action, not a replacement for catalog scores.
- **Where to watch:** Selected country, services, offer type, and current verification state. Distinguish subscription/free/ad-supported offers from rental/purchase offers when supplied. Do not imply an extra-cost offer is included with a subscription.
- **Intent and watch actions:** Want to See, rating, and explicit member Seen/watch actions. Support undo and required destructive confirmations. Marking watched is separate from rating and separate from opening a provider.
- **Shows:** An episode tracker by season, the Next episode where it exists, explicit episode marking/unmarking, existing show status actions, and bulk actions only with their existing safeguards. Missing episode data must not produce guessed progress.

The launch action says what it can do. “Open this episode in <service>” requires a verified episode handoff. A verified title link can open the provider's title/details page. Otherwise use “Open <service>” and say “Find <title>” or show its episode identity. App launch is a valid fallback, not proof of a title link.

If the app is absent or cannot launch, show that fact and keep details usable. Offer app installation guidance where supported, not an automatic install. No TV browser opens unexpectedly. A phone where-to-watch link is optional assistance, not claimed TV playback. A country-level show offer does not prove availability of its particular episode.

Maintain separate evidence for provider app launch, title/episode destination, and playback. Never claim universal exact timestamps or provider progress. Provider authentication, entitlement, restrictions, and resume behavior stay with the provider. The existing [offer link helper](../../goodwatch-webapp/app/utils/streaming-links.ts) can fall back to a TMDB web page. That is not a TV deep-link contract. The platform's [PackageManager](https://developer.android.com/reference/android/content/pm/PackageManager) supports app entry points; it does not certify provider title routes.

## Accounts, persistence, and truthful sync

| Action/data | Without a GoodWatch account | With one connected account |
| --- | --- | --- |
| Home, apps, Settings, stock-Home recovery | Always available locally. | Always available locally. |
| Country/services, starter chooser, title lookup, details/offers, handoff | Available when required catalog/network information exists. Keep preferences locally. | Use the connected account's choices. Persist explicit preference changes to that account. |
| Want to See and ratings | Keep local **Shared guest progress**. Respect the existing guest rating limit; more ratings can require connection. Do not gate app access or existing choices. | Persist through the account's existing intent/rating rules. |
| Explicit movie watches/Seen, show status, episode tracker writes | Require connection. The tracker can be inspected, but explain the requirement at the write action and preserve its context. | Write explicit watches/status actions. Derive Next episode from GoodWatch's watches/current pass. |
| TV/phone/website continuity | Local only. A QR link alone does not transfer local TV state. | Account data converges after confirmed writes and refresh. This is GoodWatch sync, not streaming-provider sync. |

Local preferences and guest interactions must survive app restart, device reboot, and a same-key app update on supported environments. App-data clearing or uninstall can remove them; explain this before destructive reset. If local persistence fails, disclose that choices will not survive restart rather than claiming success.

Preserve [existing guest semantics](../../goodwatch-webapp/app/utils/guest-progress.ts): one current interaction per title across rating, Want to See, Not interested, or Skip. A later interaction replaces the earlier one. Existing records retain their meanings; this MLP does not add Skip or Not interested controls. Skip remains passing in the Taste quiz, not Seen. Offer Undo and explain replacement when relevant. In particular, rating a Wanted title as a guest replaces its local Want to See interaction. A member's intent and rating can coexist under the existing member rules. Do not silently change either model to make the TV flow look smoother.

When a guest connects later, the TV retains its local progress while transfer is pending. The phone's browser does not already possess that state. New TV-to-account transfer work must bind it to the approved TV and account. Follow the current [account-transfer contract](../../goodwatch-webapp/app/ui/onboarding/AccountTransfer.md): proven new accounts can receive automatic transfer; existing accounts get meaningful differences, selectable changes, and explicit confirmation. No differences means no empty review dialog. Retain data on failure and resume safely after retry. Do not transfer quiz skips as account preferences. Never infer a new account merely because it is empty.

Version one has no offline account-write queue. During an outage, show cached account state as last known and refuse account writes with a clear retry. Confirm a watch only after the server accepts it. Guest local interactions can still persist without a network when the title is already cached. A failed provider handoff, Back, or elapsed time never adds a watch.

Sign-out removes the connected account's private cache/session and returns to an empty unconnected state. Warn about any pending local transfer before clearing it. Explicitly retained pending transfer data stays bound to its original account; it must never appear under a later account. Recovery and system Settings remain available. There is no profile carousel or fast account switcher.

Taste can gradually improve ordering through existing rating/Want to See behavior. No rating quiz or Taste page is required. Current [Taste calculation](../../goodwatch-webapp/app/server/taste/formula.server.ts) needs five liked titles with usable fingerprints before a Taste match can appear. Do not promise personalization after a handful of Want to See choices. Popularity and Last added remain labeled honestly.

Watch actions preserve [ADR 0008](../adr/0008-one-row-per-watch.md), [ADR 0009](../adr/0009-tracking-is-a-state-machine.md), and [ADR 0012](../adr/0012-episode-presentation-preserves-watch-identity.md). Rating a movie can imply Seen under those existing member rules; it never implies Want to See. Show ratings never change show status. TV handoff must not rewrite canonical episode identities to match provider numbering.

## Launcher essentials and release boundary

Keep a small area for installed apps, an “All apps” drawer/grid, and system Settings. Every launchable installed TV app must remain reachable. Prefer familiar labels/icons and stable ordering. No custom widgets, wallpaper editor, app store, or cleanup/debloat suite belongs in version one.

Provide a clear path to restore stock Home. A documented recovery path outside GoodWatch must work if its process fails. Restore stock Home before uninstalling or clearing the launcher where that is required. Reconnection to GoodWatch must never be necessary to recover the device.

Show HDMI/input controls only on builds where they are supported and verified. Otherwise omit them and leave the system's input/settings path reachable. No universal CEC, power, volume, or panel-input control is promised. The [feasibility evidence](../research/goodwatch-tv-os-feasibility.md#hdmi-inputs-cec-and-system-controls) distinguishes input handoff from privileged CEC control.

The user has no smart TV. The immediate deliverable after a separately authorized implementation would therefore be an **emulator-demonstrable Home replacement**. Retail support requires a later physical-device gate. A device that can only run GoodWatch as an ordinary app fails the Home requirement; it is not a smaller shipped MLP.

No store approval, Google TV branded image behavior, or Sony/TCL/Hisense/other brand support follows from an Android TV emulator result. Record the emulator image/build and Home setup mechanism. If a Google TV image is unavailable, describe the demonstration as Android TV only. The [Android development guide](https://developer.android.com/training/tv/get-started/create) describes virtual-TV testing; it does not establish OEM equivalence.

## Acceptance targets, not tested results

### A. Local emulator demonstration

Use a named Android TV image and a clean installation. Record host/emulator resources and backend mode. The orchestrator reported `/dev/kvm` locally, but no `adb` or emulator on PATH. No tool installation or setup has occurred in this task.

| Gate | Proposed pass condition |
| --- | --- |
| Real Home behavior | GoodWatch receives Home from Settings and other installed activities in 20/20 trials. It remains selected across five cold virtual boots, five process recreations, and a signed app update. Back at root stays at Home. Opening an app tile alone does not pass. |
| Baseline utility and recovery | Fresh state with network disabled still exposes all installed TV apps and system Settings. Reach Settings within four D-pad/select presses from Home. Restore stock Home, uninstall, and return to working stock Home twice without account/network dependence. |
| New-person onboarding | A fresh test account signs up/signs in on a phone-sized browser, approves the named TV, selects country/services, and explicitly adds a movie and show. QR and typed-code flows both complete. Skip every optional step and verify honest empty states. Test expired, reused, canceled, and wrong-device codes. |
| Watch loop | Reach a Wanted movie/show, inspect scores/offers, launch, return, and explicitly mark a watch. A later episode follows the recorded watch. Handoff/cancel alone adds zero watches. Test new and existing-account states, missing metadata, and unavailable offers. |
| Remote usability | Complete onboarding, both lists, details, episode tracker, app access, and recovery using only D-pad/select/Back. No hidden focus or unreachable action. Return restores the relevant card; data refresh preserves a valid focus. |
| Persistence and sync | Guest intent/preferences survive restart/boot/update. Exercise guest interaction replacement and failed/retried account transfer. For a real test backend, account watch and Wishlist changes appear on TV and phone/website within ten seconds after explicit refresh, without duplicate writes. A mock backend cannot pass real account-sync acceptance. |
| Provider evidence | A simulated receiver is permitted for routing tests only. Label it visibly “Test provider fixture”. Record the received ID/URI, return path, and missing-app behavior. Fixture success proves the GoodWatch handoff contract, not Netflix/Prime/Disney compatibility, playback, or DRM. |
| Responsiveness | On recorded host resources, p95 focus response ≤100 ms over 200 moves; warm Home return ≤1 second over 30 returns; cold usable Home ≤3 seconds over 20 starts. Local app/settings controls cannot wait for remote data. No crash, ANR, or unbounded memory growth in a 30-minute loop. These emulator numbers do not establish low-end TV performance. |

Use clearly labeled catalog/offer fixtures for deterministic edge cases. Record live/backend integration separately. A complete local loop must include real development account/session and persistence paths before claiming those parts work. Do not show fixture scores/offers as live catalog evidence.

### B. Actual supported-hardware pilot

No hardware currently qualifies. Before inviting people to use GoodWatch as their daily Home, select one recoverable physical device/build and a physical remote. Validate the full MLP there; Gate A alone is insufficient.

- **Home and startup:** Require 20/20 Home returns from providers and Settings, five cold boots, and ten standby wakes. Record long-press Home, power-on input, CEC wake, dedicated remote buttons, and system overlays separately. GoodWatch must remain the usable default Home. Persistent cold-start/input behavior must match the stated setup instructions.
- **Reversible installation:** Repeat installation and stock-Home restoration twice. Settings, network/Bluetooth setup, official provider playback, and recovery still work. No setup-component disabling or security-update suppression qualifies.
- **Real providers:** For each claimed app, test ten cold/warm app launches and missing/logged-out states. For each claimed title/episode adapter, test five movies and five episodes across at least two shows. Record actual destinations, region, app version, and profile/login gates. All advertised cases must land correctly. Otherwise lower the label to app launch or remove the unsupported capability.
- **Device changes:** Test a signed GoodWatch update and available provider/launcher/OS updates on the recoverable pilot device. If no real OTA is available, record update persistence as unverified and retain a controlled-pilot limitation. Reboot is not OTA evidence.
- **Low-memory quality:** Repeat the responsiveness loop on physical hardware after provider use. Profile total native/managed/graphics use and any WebView child processes. Set a device-specific memory budget before the run. Google's [low-RAM guidance](https://developer.android.com/training/tv/playback/memory) provides category-based limits, not a blanket “old TV faster” claim. Low-end support remains unproven without a suitable low-RAM device.
- **Account loop and stability:** Repeat both connection routes, revocation, sign-out, cross-device refresh, explicit watch actions, offline recovery, and interrupted transfer on hardware. Run a 24-hour browse/idle/provider-return soak without a recovery-blocking failure.

Publish support only for recorded passing model/build combinations and verified provider capabilities. If Home replacement or rollback fails, do not call that device supported. A restricted hardware result does not change the Home requirement into an optional feature.

### Lovability feedback

These are proposed learning targets, not validated demand. Test with five people new to GoodWatch after Gate A. Seek at least four who connect without account typing on TV, intentionally add both kinds, and reach a handoff within five minutes. Exclude email delivery delays from timing and report them separately. Observe whether people understand Popular, their own Wishlist, scores, and app-only handoff labels.

After Gate B, invite a small pilot to use GoodWatch as Home for seven days. Seek at least four of five who choose to keep it as Home, with three voluntary Watch next visits each. Ask what they would miss if it disappeared. Record selection, handoff, self-reported viewing, and explicit watch marking as different outcomes. Small samples guide iteration; they do not establish retention or market demand.

Any inability to open apps, find Settings, or restore stock Home blocks expansion regardless of positive feedback. First fix setup and the five-part loop. Do not add discovery shelves to compensate for an empty Wishlist or an unreliable handoff.

## Dependencies, exclusions, and remaining decisions

The website's **TV** is the screen in its **Living room**. This document calls the proposed hardware product “GoodWatch TV” or “the launcher”; it does not change [CONTEXT.md](../../CONTEXT.md).

Reuse the [My movies rules](../../goodwatch-webapp/app/domain/my-movies.ts), [My shows rules](../../goodwatch-webapp/app/domain/my-shows.ts), watch writers, catalog scores, availability evidence, ranking, and account data. Native focus/lifecycle, authenticated TV API access, QR approval, TV-to-account transfer, durable local storage, and provider adapters require engineering. A phone connection does not make browser-local guest data shared. Existing TV-shaped browser components are design/navigation evidence, not a native TV implementation.

| Open choice | Recommended default for this draft |
| --- | --- |
| First country and language | One pilot country, provisionally DE; English interface initially. Confirm before choosing starter titles and provider test cases. |
| First providers and minimum handoff | Test Netflix, Prime Video, and Disney+ where available. App launch with truthful instructions is the baseline; title/episode links are earned per tested adapter. No provider is claimed compatible today. |
| Initial UI treatment | Two equal movie/show Home entry points, at most three previews each, a small app area, and Settings. Six starter titles per kind and bounded title lookup. No hero or new recommendation destination. |
| Physical pilot owner/device | Defer model selection until hardware access exists. A named test owner and recoverable device are prerequisites for Gate B, not for drafting or Gate A. |

No unresolved choice blocks this specification. The first two defaults merit review before implementation. The agreed feature scope does not authorize implementation now.

**Important future requirement:** Multi-user support must address identity, separate watches/Wishlist/Taste, shared-screen privacy, and switching. Version one deliberately supports one connected account, with sign-out/reconnect as lifecycle recovery. It does not solve households through blended recommendations or hidden secondary profiles.

Other future work includes broader device/firmware matrices and platform ports. Full replacement firmware, a GoodWatch player, provider-progress scraping, universal timestamp resume, and universal HDMI/CEC control are outside initial delivery. So are a Tonight hero, Taste destination/quiz, moods/time controls, standalone discovery shelves, social/group features, and a larger launcher customization suite.

A short boundary-first sequence is sufficient: establish Home/app/settings/recovery; complete connection and intentional title setup; complete both lists/details/tracking/handoff; then pass the hardware gate. These are delivery slices, not tickets or approval to build.

## Review and verification record

This is a product definition only. The author read the applicable agent/domain instructions, current glossary, tracking ADRs, feasibility evidence, and the cited source files. Relevant primary Android and device-authorization references were checked for the platform/protocol boundaries above. Source inspection is not runtime verification. Other work continued in this shared checkout during drafting.

Only `docs/design/goodwatch-tv-mlp.md` was created. The research note, glossary, ADRs, application, issues, and unrelated edits remain untouched. No emulator, device, provider, account pairing, backend sync, installation, build, or product acceptance test ran. All acceptance gates remain proposed and untested.
