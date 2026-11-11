# YepWatch public store release

Status checked 2026-11-11 against App Store Connect, EAS, the deployed websites and fetched `origin/main`. Neither store has been published by this work. English listing copy is in [store/en-US.json](../store/en-US.json).

## Verified release state

| Item | Observed state |
| --- | --- |
| Expo | Signed in as `alperortac`; project `0772c2db-91d8-4862-80eb-1d816f243072` |
| App identity | `com.yepwatch.app` on both stores; preview remains `com.yepwatch.preview` |
| Apple account | App Store Connect app `6826403019`, team `QKFZC8CC8J`; API access works |
| Apple public release | Draft `1.0.0`, `PREPARE_FOR_SUBMISSION`; English listing, verified support/privacy/deletion URLs, review contact and processed iPhone/iPad screenshots saved. Valid production build 17 attached. No public review submitted |
| Apple testing | Build `0.1.0 (16)` is valid and in external TestFlight testing; no live, in-review or pending-release public version |
| Android credentials | EAS has one build credential record for the production identity; no Google service-account submission key assigned |
| Google account/app | Owner reports recreating the app with package `com.yepwatch.app`; account verification, production eligibility and existing highest version code still need verification |
| iOS invitations | Deployed AASA names `QKFZC8CC8J.com.yepwatch.app` for `/r/*`; physical-device behavior still needs verification |
| Android invitations | Deployed asset links name only `com.yepwatch.preview`; production Play app-signing fingerprint is absent |

The App Store privacy disclosure endpoint available through the installed Apple helper returned an unsupported-relationship error. Privacy answers are **unknown**, not verified empty.

The additive deletion table/grant was installed in production and is GREEN. Coolify deployed `2b820df9baf85ac91310dda896bcfff78353c748`; the public privacy/support HTML and native guest create → exact DELETE → access denied → explicit RESTORE → access recovered → Leave check passed. No GoodWatch account was used or changed. Existing beta binaries need their own update; website deployment does not replace installed app code. Apple URL fields were read back successfully and its existing TestFlight review contact was reused. No review demo credentials were present.

Production binaries `1.0.0 (17)` completed: iOS EAS `3ff02e10-be8f-4832-bd1d-e1db9ab28e94`, Android EAS `564c242f-f5ad-429b-a631-352c38a263e4`. Apple submission `8db4f1a5-c297-410d-afc6-9c69aba7e994` finished; Apple build `d2c3fec9-f537-4964-bb75-22885e89de65` is VALID and attached to the draft. The Android AAB is downloaded with SHA-256 `610cefbd91b57c09ce01494f275e56d61920d3900acaac0f1a81dc394b898e58`. It has not been uploaded to Play: the submission service-account key is still absent.

**Capacity before review/launch:** the existing live policy limits unexpired rooms to 20. This limit was reached during preparation (including disposable verification rooms); new room creation can return 503 until reservations expire. No other person's room was deleted and the fixed policy was not reset. This is a global limit, not a per-person allowance. This listing/assets task leaves the capacity configuration unchanged. The gallery captures use only explicitly created disposable guest rooms. Leaving a room does not release its unexpired reservation.

Apple listing copy was refreshed with the complete English description, subtitle, promotional text, keywords, copyright and URL fields. A later partial update through `@expo/apple-utils` had cleared omitted marketing fields to null. `scripts/sync-apple-listing.cjs` now sends the complete localization records and checks a fresh readback; `--apply` saves them, while the default only inspects. Set `YEPWATCH_EAS_CLI_ROOT` to an installed `eas-cli` package directory. The draft remains `1.0.0`, `PREPARE_FOR_SUBMISSION`, with VALID production build 17 attached and no public review submitted. The earlier sanitized preparation record is [here](../artifacts/releases/public-store-preparation-2026-11-11.json).

The store capture also reproduced a server-side “Start again” failure after a voter had left: the new round restored that departed participant's old votes, which referenced a retired deck and failed typed-storage validation. Restart now resets all retained participants while preserving their departure state and decision history. A focused regression and the disposable CrateDB integration pass. No capacity setting or database schema changed.

## Checks before submission

Implemented in this release: privacy/support/terms routes and matching crawlable HTML, Profile links, an authenticated web/native deletion entry point, guest-device deletion, a 30-day recovery window and automated permanent cleanup. GoodWatch account data is outside this deletion scope. See [the lifecycle decision and additive migration](../../docs/adr/yepwatch-account-deletion.md). Deploy the API migration and route allowlist before publishing the UI. Do not use the previous test-data reset.

Prepared assets: [Play icon](../store/assets/icon-512.png), [Apple icon](../store/assets/icon-1024.png), [Play feature graphic](../store/assets/feature-graphic-1024x500.png), and 28 new native gallery screenshots across [Android](../store/assets/android), [medium iPhone](../store/assets/ios-iphone-medium), [large iPhone](../store/assets/ios-iphone), and [iPad](../store/assets/ios-ipad). The galleries cover voting, expressive Yep/Nope reactions, shared matches and the agreed choice. Android and medium iPhone also include the match celebration. There are eight Android, eight medium iPhone, six large iPhone and six iPad images. Each Apple display was captured separately with the production simulator app. Android uses the native development runtime with current app source. Both use owned disposable guests and the public API, with fixtures disabled. Native animation frames were extracted at their original dimensions; no browser capture was resized into a native screenshot. See [asset provenance](../store/assets/README.md) and `store/assets/gallery-manifest.json`.

Apple accepted the large iPhone 1320×2868 set under `APP_IPHONE_67` and the iPad 2064×2752 set under `APP_IPAD_PRO_3GEN_129`. The medium iPhone gallery is 1206×2622. `scripts/upload-apple-gallery.cjs` stages the new images ahead of the original home screenshots, preserves existing uploads, checks processing and reads the sets back. The canonical copy can also be exported to individual text files with `node scripts/export-store-copy.cjs <destination>`.

1. Verify the deployed privacy and support pages return their actual HTML, and their in-app links work. Confirm the stated backend, hosting, Expo Updates, catalog artwork, trailer-player and backup practices before completing Apple's App Privacy and Google's Data safety answers. Do not declare “no data collected” merely because votes stay private from other participants.
2. Deletion is deployed, with the new table/grant and API readiness verified. In-app Profile and `https://yepwatch.com/delete-account` provide the same flow. Guest recovery passed on the public API and native Android, and account recovery passed unit/browser/real-database checks. A real signed-in review-account smoke remains to do; sign-in alone must not cancel deletion. Restricted backups must preserve/replay deletion requests rather than resurrect erased identities.
3. Check the recorded Apple gallery upload/readback result and the final listing presentation in each console. The eight new Android `gallery-*.png` screenshots, 512×512 Play icon, 1024×500 feature graphic and English descriptions are ready for Play upload; the earlier Android captures remain optional alternatives.
4. Complete store questionnaires from actual behavior: age rating (including catalog/trailers and room-authored ideas), content rights, ads declaration, app access, privacy, pricing/countries, and any required account agreements/trader verification. Supply a real review contact and credentials that exercise member-only behavior. A guest walkthrough does not cover GoodWatch sign-in.
5. Verify the Play account, production access, first AAB upload and Play App Signing. The owner reports recreating the app using the matching `com.yepwatch.app` package. Assign an app-scoped submission service account in EAS for automated uploads, or upload manually. Current Expo documentation supports creating the first internal-testing release with EAS Submit once the app record and submission key exist; a manual first upload is optional. Register the **Play app-signing** certificate for `com.yepwatch.app` in hosted asset links; the EAS upload key is a different key.
6. Complete any Google closed-testing gate. For personal accounts created after 2023-11-13, Google's current policy requires at least 12 continuously opted-in testers for 14 days, then an application for production access. Internal testing and direct APK installs do not satisfy this closed test.
7. Use the exact completed production build IDs above. Installed beta build 16 uses the `beta` channel and embeds older source. Public release configuration is `1.0.0 (17)`, already built. Any later binary must increase its counter; do not re-upload another binary as build 17. Apple’s draft is `1.0.0`.

## Prepared configuration

`build.production` selects version `1.0.0`, build `17`, the production identity/backend and the `production` OTA channel. `build.beta` explicitly retains `0.1.0 (16)` so this preparation does not migrate beta installs. Any **later beta binary upload** must increment its own counter too.

`submit.production` targets the production Android track as a **draft**; finishing and sending that release for review is a separate Play Console action. Its iOS configuration uploads to the existing Apple app; EAS Submit does **not** submit the public App Store version for review. The `beta` submission profile retains the internal Android track.

Existing `update:beta:*` commands and `update:configure-env` remain beta workflows. Before publishing the first public production OTA update, add a profile-aware environment/export flow that preserves `APP_VERSION=1.0.0`, the production binary's build number and its native fingerprint. Do not repoint the beta channels or run their configuration helper as a production promotion.

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

The owner reports no plans to earn money from GoodWatch/YepWatch apart from accepting donations. Non-trader status was discussed conditionally on personal, non-commercial activity and voluntary support without paid benefits; the actual console declaration has not been independently verified. Automatic installer protection was recommended off to preserve distribution flexibility; its final setting has not been independently verified either.

## Review walkthrough draft

Create a room as a guest, choose a country and services, add a viewing idea, then share the invitation with a second device/browser. Both people swipe Yep on the same title. Open Matches, propose it and agree from both participants. Check the confirmed title and its streaming links. Return to the home page and reopen the room/history. Repeat with the supplied review GoodWatch account to exercise saved services and account recovery. Keep the backend available throughout review.

Once approved, release the store versions and verify their public pages from an ordinary store account. Only then replace TestFlight/APK installation links and QR codes on the website. Capture the approved version, store URLs, signing association and device verification results in a release record.

## Primary references

- [Expo iOS submission](https://docs.expo.dev/submit/ios/) and [Android submission and first-time release options](https://docs.expo.dev/submit/android/).
- [Apple App Privacy](https://developer.apple.com/app-store/app-privacy-details/) and [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/).
- [Apple account deletion](https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion) and [Google account/data deletion](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en).
- [Google personal-account testing and production access](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en).
