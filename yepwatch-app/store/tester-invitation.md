# YepWatch tester links

The Android tester group is live under **hello@goodwatch.app**. Google approved production bundle **1.0.0 (17)**, the English listing, eight Android screenshots and required declarations. **Closed testing - Alpha** is active and available to selected testers in all 178 configured country/region entries. The owner account opted in successfully, and the Google Play listing shows an enabled Install button and device availability. Physical installation remains to be tested.

## Android invitation — ready to share

Help test YepWatch, the free app that helps friends agree on what to watch.

Join the Android beta: **https://yepwatch.com/android-test.html**

Follow these three steps:

1. Join the tester group: https://groups.google.com/g/yepwatch-testers
2. Opt in: https://play.google.com/apps/testing/com.yepwatch.app
3. Install from Google Play: https://play.google.com/store/apps/details?id=com.yepwatch.app

Use the same Google account for all three steps. Joining the group alone does not opt you into the test. If Play does not show the app immediately after enrollment, allow time for changes to take effect and try the opt-in link again.

Try creating a room, inviting someone, voting Yep/Nope and agreeing on a movie or show. Send feedback through the app or to hello@goodwatch.app.

## iPhone and iPad — public TestFlight link

https://testflight.apple.com/join/V2gzwSFA

## Verified configuration

- Google Group: **YepWatch Testers**, yepwatch-testers@googlegroups.com. Anyone can discover and join; posting, member lists and member email visibility are limited to managers. No tester addresses were imported and no invitations or posts were sent.
- Play account: **hello@goodwatch.app**, developer **GoodWatch**, package com.yepwatch.app. The group and feedback email are saved on the Alpha track; all 178 available country/region entries are selected.
- AAB: version code **17**, SHA-256 610cefbd91b57c09ce01494f275e56d61920d3900acaac0f1a81dc394b898e58. Play accepted it with target SDK 36 and minimum API 24.
- Listing: English copy, icon, feature graphic and eight original Android gallery screenshots saved and submitted in their canonical order. The icon and feature graphic carry the Console's AI-assisted asset labels; the real native screenshots do not.
- App setup: Entertainment, privacy policy, reviewer access, ads, advertising ID, government, health, financial features, content rating, 13+ audience and Data safety completed. Embedded YouTube trailers can show ads; the app does not use Android advertising ID. Reviewer credentials were entered privately and verified; their values are not stored in this repository.
- Google generated regional content ratings from the catalog/trailers and private room interactions: Teen in North America, 16+ in Germany/Brazil, PEGI parental guidance and generic 12+. The developer target audience is 13+ without an in-app age gate.
- Production Play signing certificate is deployed at https://yepwatch.com/.well-known/assetlinks.json, alongside the existing preview certificate. Physical installation/App Link verification remains pending.

## Verified activation and remaining device checks

1. Play Console confirms **Active**, **Available to selected testers**, release **1.0.0 (17) - closed test**, released on 11 November 2026 at 23:49 Console local time.
2. **hello@goodwatch.app** completed Play opt-in and saw **You are a tester**. Following the download link showed YepWatch's real Play listing, an enabled **Install** button and **This app is available for your device**. No remote device installation was triggered.
3. The website's Android button and QR code open the three-step guide. The existing iOS TestFlight destination is preserved. The invitation is ready for the owner to share; no tester invitations or group posts were sent.
4. Complete a fresh physical Play install and the device checks in [friend-beta.md](../docs/friend-beta.md#first-session-35-friends), including invitation/App Links, sign-in return and trailers.
5. Run the closed test with at least **12 continuously opted-in testers for 14 days**, then apply for production access. One owned account is verified enrolled; this is not a claim that Play Console's aggregate tester count has refreshed or that the production gate is satisfied.

The direct beta APK uses com.yepwatch.preview; those installs do not enroll a person in the Play closed test. Do not promise reciprocal testing or contact other developers without the owner's instruction.

See [the enrollment record](../artifacts/releases/tester-enrollment-2026-11-11.json) and [data-safety rationale](google-data-safety-notes.json).

References: [Google testing tracks](https://support.google.com/googleplay/android-developer/answer/9845334), [personal-account production access](https://support.google.com/googleplay/android-developer/answer/14151465).
