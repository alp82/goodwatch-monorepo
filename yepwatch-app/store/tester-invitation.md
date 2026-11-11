# YepWatch tester links

Android self-service enrollment is being prepared. Do not announce the three Android links as working until the Google Group is created, added to Play's closed-test tester eligibility, and a closed-test release is available. The selected group name is **YepWatch Testers**, with anyone allowed to join, posting limited to managers, and the member list limited to managers.

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

1. Finish Google's CAPTCHA in the prepared Google Groups creation dialog. No tester addresses have been added or invited.
2. Sign in to Play Console with the account that owns the new YepWatch app. The browser's two saved logins currently lead to an old closed developer account or a signup page; neither exposes the new listing.
3. Open YepWatch → Test and release → Testing → Closed testing → the test track → Testers. Add `yepwatch-testers@googlegroups.com` under Google Groups and save. Preserve existing eligible tester lists if the Console allows both; do not remove enrolled testers.
4. Complete required app setup/listing and create the closed-test release using the production `com.yepwatch.app` AAB, version code 17. The downloaded bundle is `YepWatch-1.0.0-17.aab` (SHA-256 `610cefbd91b57c09ce01494f275e56d61920d3900acaac0f1a81dc394b898e58`). Upload and submission remain pending until the correct Console account is available.
5. Confirm the track's actual opt-in link, release status, supported countries and enrollment from a tester Google account. First test links can take several hours to become available after publication. Only then promote these links on the website or social posts.

The existing direct beta APK uses `com.yepwatch.preview`; those installs do not enroll a person in the Play closed test. Keep this distinction explicit. Do not promise reciprocal testing or contact other developers without the owner's instruction.

Reference: https://support.google.com/googleplay/android-developer/answer/9845334
