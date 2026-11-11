# YepWatch tester links

Android self-service enrollment is being prepared. Do not announce the three Android links as working until the Google Group is created, added to Play's closed-test tester eligibility, and a closed-test release is available. Use **hello@goodwatch.app** for Google Groups and Play Console. The selected group name is **YepWatch Testers**, with anyone allowed to join, posting limited to managers, and the member list limited to managers.

## Android invitation draft — pending activation

Help test YepWatch, the free app that helps friends agree on what to watch.

1. Join the tester group: https://groups.google.com/g/yepwatch-testers
2. Opt in to the Android test: https://play.google.com/apps/testing/com.yepwatch.app
3. Install from Google Play: https://play.google.com/store/apps/details?id=com.yepwatch.app

Use the same Google account for all three steps. Joining the group alone does not opt you into the test. If Play does not show the app immediately after you join, allow time for enrollment changes to take effect and try the opt-in link again.

Try creating a room, inviting someone, voting Yep/Nope and agreeing on a movie or show. Send feedback through the app or to hello@goodwatch.app.

## iPhone and iPad — existing public TestFlight link

https://testflight.apple.com/join/V2gzwSFA

## Activation checklist

1. Finish Google's CAPTCHA in the prepared Google Groups creation dialog under **hello@goodwatch.app** (`/u/2/my-groups` in the current browser session). Its settings allow anyone to join and discover the group, while only managers can post or see members. The older attempt under a different login did not complete. No tester addresses have been added or invited.
2. The correct Play Console login is now verified: **hello@goodwatch.app**, developer account **GoodWatch**, YepWatch package `com.yepwatch.app`. Its existing **Closed testing - Alpha** track has no release. The track's Copy link control confirms `https://play.google.com/apps/testing/com.yepwatch.app`, but enrollment is unavailable until a test release is published.
3. Open YepWatch → Test and release → Testing → Closed testing → the test track → Testers. Add `yepwatch-testers@googlegroups.com` under Google Groups and save. Preserve existing eligible tester lists if the Console allows both; do not remove enrolled testers.
4. Complete required app setup/listing and create the closed-test release using the production `com.yepwatch.app` AAB, version code 17. The downloaded bundle is `YepWatch-1.0.0-17.aab` (SHA-256 `610cefbd91b57c09ce01494f275e56d61920d3900acaac0f1a81dc394b898e58`). Upload and submission remain pending. Play requires the remaining app-setup declarations and store listing before closed testing can be activated.
5. Confirm the track's actual opt-in link, release status, supported countries and enrollment from a tester Google account. First test links can take several hours to become available after publication. Only then promote these links on the website or social posts.

The existing direct beta APK uses `com.yepwatch.preview`; those installs do not enroll a person in the Play closed test. Keep this distinction explicit. Do not promise reciprocal testing or contact other developers without the owner's instruction.

Reference: https://support.google.com/googleplay/android-developer/answer/9845334

## Play setup progress — 2026-11-11

The privacy-policy URL was saved as `https://yepwatch.com/privacy`. The ads answer is **Yes** because the native app embeds YouTube trailers, which can display ads controlled by YouTube/video owners; this is independent of YepWatch earning money. Government-app status is **No**, and health features are **None**. The financial-features form was set to **None** and saved. Category **Entertainment** was saved. No changes have been sent for Google review.

The public contact email and website remain to enter as `hello@goodwatch.app` and `https://yepwatch.com`; their editor opened but was not filled before the Play browser tab closed. The listing text and artwork are prepared in the repository. Sign-in review instructions, content rating, target audience and Data safety still require completion based on the actual app. Do not declare unrestricted access while optional GoodWatch member features require sign-in.

Google currently rejects the tester-group field because the group does not exist or is inaccessible. That unsaved tester-form draft was discarded while completing independent setup items. Add the group and feedback email again after group creation completes.
