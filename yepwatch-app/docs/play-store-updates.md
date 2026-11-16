# Play Store update link

The Android app asks Google Play whether an update is available for the installed
app and signed-in Play user. A small **Update** action appears in the shared
header only after Play confirms availability. It opens
`market://details?id=com.yepwatch.app`, falling back to the HTTPS listing when the
Play app cannot handle the link. Updating remains the person's choice; no dialog
or automatic store navigation interrupts a room.

The optional local Expo module `modules/yepwatch-play-updates` uses Google's
`app-update:2.1.0` API. Google handles installed version codes, closed-test
eligibility, staged rollouts and device availability. There is no scraped
website version and no operator-maintained latest-version number.

Checks run when a header first mounts and on foregrounding, shared across
headers and cached for 30 minutes. Failures retry after five minutes; a stalled
check times out after five seconds. Offline, unowned, preview-package and
unsupported-runtime cases show no link. Web and iOS do not query Play. On phones,
the profile chip keeps its avatar and arrow while the update action is present,
leaving room for the room switcher and at least a 48 px update touch target.

Existing installed binaries do not contain the native module. The JavaScript
uses `requireOptionalNativeModule`, so they remain usable but cannot show the
link. This feature requires a new Android binary and a changed Android runtime;
do not publish it as an OTA to an old runtime or start a new release build without
the approval required by [the release preference](ota-updates.md#release-preference).
No store version or build number has been incremented by this implementation.

Validation: run the app's typecheck, lint and unit tests, verify Android
autolinking discovers the module, and compile its Kotlin library. The real Play
availability path must be checked using an older Play-installed build and a
newer eligible release, per Google's testing instructions. Sideloading alone
does not prove the signed-in user's Play eligibility.

References: [Google's availability API](https://developer.android.com/guide/playcore/in-app-updates/kotlin-java),
[testing in-app updates](https://developer.android.com/guide/playcore/in-app-updates/test),
[local Expo modules](https://docs.expo.dev/modules/get-started/).
