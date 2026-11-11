# YepWatch public store release

Status checked 2026-11-12 against App Store Connect, EAS, the deployed websites and fetched `origin/main`. The public App Store release is prepared but awaits owner declarations; Google build 17 is approved and available in the active Alpha closed test. English listing copy is in [store/en-US.json](../store/en-US.json).

## Verified release state

| Item | Observed state |
| --- | --- |
| Expo | Signed in as `alperortac`; project `0772c2db-91d8-4862-80eb-1d816f243072` |
| App identity | `com.yepwatch.app` on both stores; preview remains `com.yepwatch.preview` |
| Apple account | App Store Connect app `6826403019`, team `QKFZC8CC8J`; API access works |
| Apple public release | Draft `1.0.0`, `PREPARE_FOR_SUBMISSION`; VALID production build 18 attached, complete English copy and 20 processed gallery images freshly read back. Privacy published, Entertainment category and 13+ calculated rating saved; free pricing and availability configured. Content-rights confirmation blocks Add for Review |
| Apple testing | Build `0.1.0 (16)` is valid and in external TestFlight testing; no live, in-review or pending-release public version |
| Android credentials | EAS has one build credential record for the production identity; no Google service-account submission key assigned |
| Google account/app | Verified owner `hello@goodwatch.app`, developer GoodWatch; bundle `com.yepwatch.app` version 17 approved and available in Closed testing - Alpha. Production access requires the closed-test gate |
| iOS invitations | Deployed AASA names `QKFZC8CC8J.com.yepwatch.app` for `/r/*`; physical-device behavior still needs verification |
| Android invitations | Deployed asset links include both `com.yepwatch.preview` and `com.yepwatch.app` with the certificate copied from Play App Signing. Physical Play-install verification remains pending |

Apple App Privacy is now verified through the authenticated Console. All 11 data types are configured and published for build 18, including Expo diagnostics and YouTube player processing. Data linked to a user and unlinked crash data are disclosed; the privacy-enhanced player is not used for cross-app advertising tracking. See [the declaration rationale](../store/apple-privacy-notes.json) and [fresh release verification](../artifacts/releases/apple-store-submission-2026-11-12.json).

The additive deletion table/grant was installed in production and is GREEN. Coolify deployed `2b820df9baf85ac91310dda896bcfff78353c748`; the public privacy/support HTML and native guest create → exact DELETE → access denied → explicit RESTORE → access recovered → Leave check passed. No GoodWatch account was used or changed. Compatible OTA updates are now published separately from the website. Apple URL fields were read back successfully and its existing TestFlight review contact was reused. Dedicated review credentials are now saved and freshly verified in both Apple's public draft and TestFlight, with contact fields preserved. Google review credentials and instructions are saved too. The dedicated test account passed GoodWatch login, browser return, native PKCE exchange, member-home reads and deletion-status reads in an isolated cookie jar. Verification sessions were signed out; credentials are absent from repository artifacts. See [review access verification](../artifacts/releases/reviewer-access-2026-11-11.json).

Initial production binaries `1.0.0 (17)` completed: iOS EAS `3ff02e10-be8f-4832-bd1d-e1db9ab28e94`, Android EAS `564c242f-f5ad-429b-a631-352c38a263e4`. Apple submission `8db4f1a5-c297-410d-afc6-9c69aba7e994` finished; Apple build `d2c3fec9-f537-4964-bb75-22885e89de65` is VALID and attached to the draft. The Android AAB SHA-256 is `610cefbd91b57c09ce01494f275e56d61920d3900acaac0f1a81dc394b898e58`. It was manually uploaded, accepted and submitted to Play's Alpha closed test; no service-account key was needed for this browser upload.

**Personal room allowance:** new creations use 10 unexpired rooms per account or guest installation/browser. Joining someone else’s room uses no slot. Existing rooms retain their reservations; leaving or transferring hosting does not release an unexpired creation slot. See [the decision and additive migration](../../docs/adr/yepwatch-personal-room-allowance.md). The additive migration and runtime grants are installed, the website/API are live, and compatible native OTA updates are published for `beta`, `beta-preview` and `production`. [Verification record](../artifacts/releases/personal-room-limit-2026-11-11.json).

Apple listing copy was refreshed with the complete English description, subtitle, promotional text, keywords, copyright and URL fields. A later partial update through `@expo/apple-utils` had cleared omitted marketing fields to null. `scripts/sync-apple-listing.cjs` now sends the complete localization records and checks a fresh readback; `--apply` saves them, while the default only inspects. Set `YEPWATCH_EAS_CLI_ROOT` to an installed `eas-cli` package directory. The draft remains `1.0.0`, `PREPARE_FOR_SUBMISSION`, with VALID production build 18 now attached and no public review submitted. The earlier sanitized preparation record is [here](../artifacts/releases/public-store-preparation-2026-11-11.json).

The store capture also reproduced a server-side “Start again” failure after a voter had left: the new round restored that departed participant's old votes, which referenced a retired deck and failed typed-storage validation. Restart now resets all retained participants while preserving their departure state and decision history. A focused regression and the disposable CrateDB integration pass. No capacity setting or database schema changed.

Apple finished processing all 20 new gallery images. Fresh readback confirmed the exact ordering and complete English copy, with valid build 17 still attached. The site also passed the owned-guest production restart-after-departure check after deployment. See [the gallery verification record](../artifacts/releases/store-gallery-2026-11-11.json).

## Checks before submission

Implemented in this release: privacy/support/terms routes and matching crawlable HTML, Profile links, an authenticated web/native deletion entry point, guest-device deletion, a 30-day recovery window and automated permanent cleanup. GoodWatch account data is outside this deletion scope. See [the lifecycle decision and additive migration](../../docs/adr/yepwatch-account-deletion.md). Deploy the API migration and route allowlist before publishing the UI. Do not use the previous test-data reset.

Prepared assets: [Play icon](../store/assets/icon-512.png), [Apple icon](../store/assets/icon-1024.png), [Play feature graphic](../store/assets/feature-graphic-1024x500.png), and 28 new native gallery screenshots across [Android](../store/assets/android), [medium iPhone](../store/assets/ios-iphone-medium), [large iPhone](../store/assets/ios-iphone), and [iPad](../store/assets/ios-ipad). The galleries cover voting, expressive Yep/Nope reactions, shared matches and the agreed choice. Android and medium iPhone also include the match celebration. There are eight Android, eight medium iPhone, six large iPhone and six iPad images. Each Apple display was captured separately with the production simulator app. Android uses the native development runtime with current app source. Both use owned disposable guests and the public API, with fixtures disabled. Native animation frames were extracted at their original dimensions; no browser capture was resized into a native screenshot. See [asset provenance](../store/assets/README.md) and `store/assets/gallery-manifest.json`.

Apple accepted the large iPhone 1320×2868 set under `APP_IPHONE_67` and the iPad 2064×2752 set under `APP_IPAD_PRO_3GEN_129`. The medium iPhone gallery is 1206×2622. `scripts/upload-apple-gallery.cjs` stages the new images ahead of the original home screenshots, preserves existing uploads, checks processing and reads the sets back. The canonical copy can also be exported to individual text files with `node scripts/export-store-copy.cjs <destination>`.

1. Verify the deployed privacy and support pages return their actual HTML, and their in-app links work. Confirm the stated backend, hosting, Expo Updates, catalog artwork, trailer-player and backup practices before completing Apple's App Privacy and Google's Data safety answers. Do not declare “no data collected” merely because votes stay private from other participants.
2. Deletion is deployed, with the new table/grant and API readiness verified. In-app Profile and `https://yepwatch.com/delete-account` provide the same flow. Guest recovery passed on the public API and native Android, and account recovery passed unit/browser/real-database checks. The real reviewer account passed browser return, native PKCE exchange and member-home/deletion-status reads; physical-device handoff and a destructive member deletion/recovery smoke remain to do; sign-in alone must not cancel deletion. Restricted backups must preserve/replay deletion requests rather than resurrect erased identities.
3. Check the recorded Apple gallery upload/readback result and final listing presentation. All eight Android `gallery-*.png` screenshots, the 512×512 Play icon, 1024×500 feature graphic and English descriptions have been saved and submitted in Play. The screenshots retain their canonical order. The Console's AI-assisted asset labels apply to the icon and feature graphic; the screenshots are actual native captures.
4. Review the saved age, ads, access, privacy and pricing/country settings against the latest submission record. Apple still needs the owner's content-rights confirmation, updated agreement acceptance and trader declaration. Reviewer contacts and working member credentials are already configured.
5. Play account, first AAB upload and Play App Signing are verified. Production access remains gated by testing. The **Play app-signing** certificate for `com.yepwatch.app` is deployed in hosted asset links alongside preview; the EAS upload key is a different key. Configure an app-scoped submission service account only if future uploads need automation.
6. Complete any Google closed-testing gate. For personal accounts created after 2023-11-13, Google's current policy requires at least 12 continuously opted-in testers for 14 days, then an application for production access. Internal testing and direct APK installs do not satisfy this closed test.
7. Use the exact completed production build IDs above. Installed beta build 16 uses the `beta` channel and embeds older source. The current production candidate is `1.0.0 (18)`, already built. Use the build 18 IDs in the latest submission record; any later binary must increase its counter again. Apple’s draft is `1.0.0`.

## Prepared configuration

`build.production` now selects version `1.0.0`, build `18`, the production identity/backend and the `production` OTA channel. `build.beta` explicitly retains `0.1.0 (16)` so this preparation does not migrate beta installs. Any **later beta binary upload** must increment its own counter too.

`submit.production` targets the production Android track as a **draft**; finishing and sending that release for review is a separate Play Console action. Its iOS configuration uploads to the existing Apple app; EAS Submit does **not** submit the public App Store version for review. The `beta` submission profile retains the internal Android track.

Existing beta update commands remain beta workflows. Production OTA exports were performed with explicit production app identity, version 1.0.0/build 17, real backend URLs and fixtures disabled; both platform fingerprints were checked against the store binaries before publication. Beta exports preserved version 0.1.0/build 16 and their own channels. See the privacy deployment record for published update IDs. Preserve these profile values for future updates.

Do not select an arbitrary latest build when submitting. Record the intended production build IDs and use those exact IDs after the blockers above are resolved:

```sh
cd yepwatch-app
npm ci --install-links
npm run typecheck
npm run lint
npm test
npx eas-cli@latest build --profile production --platform ios
npx eas-cli@latest build --profile production --platform android
# Replace each placeholder with the corresponding verified build ID:
npx eas-cli@latest submit --profile production --platform ios --id <IOS_BUILD_ID>
npx eas-cli@latest submit --profile production --platform android --id <ANDROID_BUILD_ID>
```

For Google's first release, use the `beta` **submit** profile to stage the exact production candidate on internal testing (or upload the AAB manually). This selects the testing track without changing the binary's production update channel. Automated submission needs the app's Google service-account key assigned in EAS. Run the device checks in [friend-beta.md](friend-beta.md#first-session-35-friends) against the exact production candidates, including fresh install, account return, invitation links, trailers, disconnect/reconnect and upgrade behavior.

## Owner-provided publishing context

The owner reports no plans to earn money from GoodWatch/YepWatch apart from accepting donations. Non-trader status was discussed conditionally on personal, non-commercial activity and voluntary support without paid benefits; the actual console declaration has not been independently verified. Play's automatic installer protection is verified off. The owner explicitly selected a general audience aged 13+ with no in-app age gate. The IARC questionnaire includes online catalog/trailers and private room ideas; it returned Teen in North America, 16+ in Germany/Brazil, PEGI parental guidance and generic 12+.

## Review walkthrough draft

Create a room as a guest, choose a country and services, add a viewing idea, then share the invitation with a second device/browser. Both people swipe Yep on the same title. Open Matches, propose it and agree from both participants. Check the confirmed title and its streaming links. Return to the home page and reopen the room/history. Repeat with the supplied review GoodWatch account to exercise saved services and account recovery. Keep the backend available throughout review.

Use the Android closed-test guide while production access is gated. Once public store releases are approved, verify their public pages from an ordinary store account before replacing the beta destinations with public store links. Capture the approved version, store URLs, signing association and device verification results in a release record.

## Primary references

- [Expo iOS submission](https://docs.expo.dev/submit/ios/) and [Android submission and first-time release options](https://docs.expo.dev/submit/android/).
- [Apple App Privacy](https://developer.apple.com/app-store/app-privacy-details/) and [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/).
- [Apple account deletion](https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion) and [Google account/data deletion](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en).
- [Google personal-account testing and production access](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en).


## Self-service tester enrollment

The [Android invitation and activation checks](../store/tester-invitation.md) use a Google Group, followed by Play opt-in and installation links. The group exists under **hello@goodwatch.app**, permits public joining, and is saved as Alpha tester eligibility with all available countries/regions. Google approved bundle 17, the listing and all required declarations. The Alpha track is **Active** and **Available to selected testers**. The owner account completed opt-in and saw an enabled **Install** button and device availability on the actual Play listing. The website Android button and QR code now point to the shareable three-step guide at **https://yepwatch.com/android-test.html**. Physical installation remains unverified; the 12-tester, 14-day production-access gate remains outstanding. See [the enrollment record](../artifacts/releases/tester-enrollment-2026-11-11.json). No tester emails were imported, invitations sent or group posts published. The existing public TestFlight link remains available.

Google Data safety includes the random room-allowance identifier, Expo's random installation identifier and failed-update/launch-error reports, account and room data, and optional YouTube player processing. The app does not use Android advertising ID; neither AD_ID permission is present in the production bundle. The [declaration rationale](../store/google-data-safety-notes.json) records all nine data types and service-provider distinctions. Expanded privacy text and both Android signing associations are deployed and read back from the public website. Matching privacy-copy OTA updates are published to production (both platforms), beta (iOS) and beta-preview (Android); runtime fingerprints match the existing binaries. [Privacy deployment verification](../artifacts/releases/privacy-disclosures-2026-11-11.json). Apple privacy disclosures are now verified and published for build 18; owner declarations still block its public submission.

## Apple submission readiness — 2026-11-12

Build 18 embeds an explicit YouTube privacy-enhanced iframe, with the embedding origin bound in the player URL. The real YouTube API preserved the nocookie host and passed playback and pause verification. Existing error reporting and player controls still pass the app's 189 tests; typecheck, lint and CI pass. No native SDK or dependency changed. Compatible player updates are published to production, beta iOS and beta-preview Android. The public policy explains both the new player and older app versions that may still use the standard player.

iOS EAS build `deb9968d-db24-4996-ad12-005ea7f20b7d` finished, binary-upload submission `b2526789-993e-49ff-b754-29f7e158ce6c` finished, and Apple build `c6b590be-1d13-40a7-aede-d9cfe0c8654c` is VALID and attached to version 1.0.0. Complete English copy and all 20 gallery images were freshly verified. Android EAS build `a7f123d8-e6ff-4537-9db6-10ff203d2239` also finished; its AAB is downloaded for the next Play upload. Google approved build 17, which remains available on the active Alpha track; bundle 18 is retained for a subsequent update.

Apple's age questionnaire calculates 13+ in 172 regions, 16+ in Vietnam/Brazil, and 12+ in Korea; older operating systems show global 12+ with regional exceptions. There is no rating override or in-app age gate. The questionnaire considers catalog summaries/posters and brief trailers, not the full movies. Private invited-room ideas are declared as direct communication; there is no broad public UGC feed or social-media feature. The Entertainment category, zero pricing in all currencies and availability request for all 175 regions are saved; regional restrictions still apply.

All 11 privacy categories are published, with no incomplete setup and no tracking section in the preview. Names, support contact/content, room ideas/searches, user/device identifiers, country and app/player activity are linked as applicable; crash data is unlinked. The draft is set to release automatically after approval.

The attempted Add for Review check reports exactly one missing app field: **Content Rights Information**. The owner has been asked to confirm necessary catalog/artwork/trailer permissions. Apple's account also still requires the Account Holder to review and accept its updated developer agreement and complete the EU trader self-declaration. These are owner decisions, not inferred from code or from the absence of revenue. No public App Store review has been submitted. [Submission record](../artifacts/releases/apple-store-submission-2026-11-12.json).
