# YepWatch public store release

Status checked 2026-11-11 against App Store Connect, EAS, the deployed websites and fetched `origin/main` (`129cea16f`). Neither store has been published by this work. English listing copy is in [store/en-US.json](../store/en-US.json).

## Verified release state

| Item | Observed state |
| --- | --- |
| Expo | Signed in as `alperortac`; project `0772c2db-91d8-4862-80eb-1d816f243072` |
| App identity | `com.yepwatch.app` on both stores; preview remains `com.yepwatch.preview` |
| Apple account | App Store Connect app `6826403019`, team `QKFZC8CC8J`; API access works |
| Apple public release | Draft version `1.0`, `PREPARE_FOR_SUBMISSION`; no attached build, description, screenshots, support URL, privacy URL, review contact or completed age rating at inspection |
| Apple testing | Build `0.1.0 (16)` is valid and in external TestFlight testing; no live, in-review or pending-release public version |
| Android credentials | EAS has one build credential record for the production identity; no Google service-account submission key assigned |
| Google account/app | Owner reports recreating the app with package `com.yepwatch.app`; account verification, production eligibility and existing highest version code still need verification |
| iOS invitations | Deployed AASA names `QKFZC8CC8J.com.yepwatch.app` for `/r/*`; physical-device behavior still needs verification |
| Android invitations | Deployed asset links name only `com.yepwatch.preview`; production Play app-signing fingerprint is absent |

The App Store privacy disclosure endpoint available through the installed Apple helper returned an unsupported-relationship error. Privacy answers are **unknown**, not verified empty.

After inspection, the English description, subtitle, keywords, promotional text and marketing URL from `store/en-US.json` were saved to Apple's draft and read back successfully. The draft is now version `1.0.0`, still `PREPARE_FOR_SUBMISSION`, with no build attached or review submitted. The fields still missing above remain outstanding. The sanitized result is recorded in [the preparation record](../artifacts/releases/public-store-preparation-2026-11-11.json).

## Work required before submission

1. Publish a privacy policy explicitly covering YepWatch and link it from the app. `https://yepwatch.com/privacy` and `/support` currently return the same Expo SPA shell, not verified policy/support pages. GoodWatch has real `/privacy` and `/support` pages, but these do not currently describe YepWatch's rooms and persistent decision history. Confirm the data practices of the backend, hosting, Expo Updates, catalog artwork and trailer player before completing Apple's App Privacy and Google's Data safety answers. Do not declare “no data collected” merely because votes stay private from other participants.
2. Implement account deletion and deletion of associated data, with an accessible in-app entry point and a working web request path. GoodWatch sign-in can lead to account creation. Its existing support page asks people to email for deletion; that alone does not meet Apple's account-deletion rule. Check account memberships, durable decision history, saved services and device sessions as well as the central account record. Logging out and leaving a room are separate actions and must not be described as account deletion.
3. Capture current native screenshots for the required iPhone and iPad display classes (tablet support is enabled), and Android phone screenshots, a 512×512 Play icon and a 1024×500 Play feature graphic. Use actual app screens with disposable room data and no private invitation or account credentials. Confirm current store screenshot requirements at upload time.
4. Complete store questionnaires from actual behavior: age rating (including catalog/trailers and room-authored ideas), content rights, ads declaration, app access, privacy, pricing/countries, and any required account agreements/trader verification. Supply a real review contact and credentials that exercise member-only behavior. A guest walkthrough does not cover GoodWatch sign-in.
5. Verify the Play account, production access, first AAB upload and Play App Signing. The owner reports recreating the app using the matching `com.yepwatch.app` package. Assign an app-scoped submission service account in EAS for automated uploads, or upload manually. Current Expo documentation supports creating the first internal-testing release with EAS Submit once the app record and submission key exist; a manual first upload is optional. Register the **Play app-signing** certificate for `com.yepwatch.app` in hosted asset links; the EAS upload key is a different key.
6. Complete any Google closed-testing gate. For personal accounts created after 2023-11-13, Google's current policy requires at least 12 continuously opted-in testers for 14 days, then an application for production access. Internal testing and direct APK installs do not satisfy this closed test.
7. Build a fresh release from the tested source. Installed beta build 16 uses the `beta` update channel and embeds older source; it is not the planned `production` channel release. Public release configuration is `1.0.0 (17)`. Recheck both stores' highest build counters before building. Apple's draft now matches version `1.0.0`.

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
