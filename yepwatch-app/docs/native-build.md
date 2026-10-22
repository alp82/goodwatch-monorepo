# Local native build evidence

The unchanged app at commit `a72308ab75f35a9c760b5bfeb7626f139f90ada0` compiled into an actual Android debug APK on 2026-10-22. It installed and launched on the existing Pixel8/API35 x86-64 emulator. Ordinary native guest setup, live transport, voting/Undo, matching, picking, confirmed Done and background/resume passed. A second fresh native-created room passed mixed Android/browser choosing and automatic agreement through two real gateways.

This is native compilation and emulator execution, beyond the earlier Hermes export evidence. No iOS native build or physical-device execution is claimed.

## Source and isolation

- Source: `a72308ab`; app package/version `dev.yepwatch.foundation` / `0.1.0` / versionCode1.
- Staging: `.expo/native-build/a72308ab/yepwatch-app`, extracted with `git archive`. The installed app-local dependencies were copied/reflinked into this staging folder; native module/codegen outputs stay isolated there.
- Generation: Expo58 `prebuild --platform android --no-install`; no manual native source edits. Main `src/`, `app.json`, package manifests and lockfile remain unchanged.
- Toolchain/cache/output: app-owned ignored `.expo/native-toolchain/` and `.expo/native-build/`. No generated projects, APK or Gradle outputs are committed.
- Retained8132 HTML and its three initial JS bundles retain their prior hashes: [proof](../artifacts/native/retained-web-unchanged.json). Other retained exports, services and rooms were not restarted or changed by this task. Only fresh smoke rooms were used.

## Build

| Setting | Actual value |
| --- | --- |
| Host | Linux x86-64 |
| Full JDK | Eclipse Temurin21.0.12.1+1, checksum verified against official release |
| Gradle / AGP | 9.4.1 / 9.2.1 |
| Compile / target / minimum SDK | 37 / 36 / 24 |
| Build tools / NDK / CMake | 37.0.0 / 27.1.12297006 / 3.22.1 |
| Runtime | Hermes, new architecture |
| APK ABIs | arm64-v8a and x86_64 |
| Variant | Debug, standard generated debug signing; no production signing changes |
| Result | BUILD SUCCESSFUL in4m34s;380 tasks executed |

The system default Java27 was left unchanged. Installed IDE JBR21 lacked `jlink`; a full Temurin21 JDK, including `jlink` and `jmods`, was downloaded from the official Adoptium GitHub release and verified using its published SHA256. The earlier Java/jlink failure was not re-created as part of this successful build. [Exact toolchain/source](../artifacts/native/toolchain.json).

Build invocation from the isolated `android/` directory:

```sh
YEPWATCH_APP=/home/alp/dev/projects/goodwatch/goodwatch-monorepo/yepwatch-app
JAVA_HOME="$YEPWATCH_APP/.expo/native-toolchain/jdk-21.0.12.1+1" \
PATH="$YEPWATCH_APP/.expo/native-toolchain/jdk-21.0.12.1+1/bin:$PATH" \
ANDROID_HOME=/home/alp/Android/Sdk ANDROID_SDK_ROOT=/home/alp/Android/Sdk \
GRADLE_USER_HOME="$YEPWATCH_APP/.expo/native-toolchain/gradle-cache-21" \
CMAKE_BUILD_PARALLEL_LEVEL=2 \
./gradlew :app:assembleDebug --no-daemon --console=plain --max-workers=2 \
  -Dorg.gradle.parallel=false -PreactNativeArchitectures=arm64-v8a,x86_64 \
  -PreactNativeDevServerPort=8140
```

APK, kept locally under the ignored staging tree:

`.expo/native-build/a72308ab/yepwatch-app/android/app/build/outputs/apk/debug/app-debug.apk`

SHA256: `ee91eeb3a4708eaa46f7c9ac32f80c836935b477dfd74edcb3b26a79cc27ec55`.

This debug APK loads JavaScript from Metro8140; it is not an offline release artifact. [Build/install metadata](../artifacts/native/android-build.json), [compiled-source manifest](../artifacts/native/source.json).

## Runtime and ordinary UI evidence

The existing AVD `pixel8_api35` booted on `emulator-5562` with KVM, `-read-only -no-snapshot-load -no-snapshot-save -no-window -no-audio -gpu swiftshader`. Its persistent user data was not changed. Native APK install returned Success; MainActivity cold launch returned Status ok. A separate Metro process serves the isolated source on8140. Node's `--dns-result-order=ipv4first` binds localhost to IPv4 for adb reverse; this is a local process setting, not an app source change.

Public Metro configuration:

```sh
EXPO_PUBLIC_API_ORIGIN=http://127.0.0.1:15993
EXPO_PUBLIC_WS_ORIGIN=ws://127.0.0.1:4323
EXPO_PUBLIC_APP_ORIGIN=http://127.0.0.1:8132
EXPO_PUBLIC_ENABLE_FIXTURES=false
```

Device-only adb reverse mappings connect8140,15993 and4323 to the same host ports. API15993 remains the reviewed durable isolated-Crate runtime, using its finite36-title real catalog sample.

The initial HTTP-only smoke on4322 correctly retained the Connecting banner. React Native Android supplies its WebSocket endpoint's HTTP-equivalent Origin automatically; the browser gateway allowed8131/8132 only. The gateway owner supplied a separate4323 listener accepting the legitimate endpoint Origin `http://127.0.0.1:4323` plus browser8132. The app sends normal one-use first-frame tickets; no Origin override, credential/header spoof, wildcard or server authorization bypass was used. Browser4322 and all old services remain unchanged.

Actual owner-run evidence:

- [Android solo live UI](../artifacts/native/android-ui-smoke.json): fresh native guest, explicit DE/Netflix8, real deck, live only after the authenticated shared snapshot, Nope/Undo restoring the title, immediate match/pick/fresh-check Done and ordinary background/resume. Screenshot files: `artifacts/native/android-entry.png`, `android-voting.png`, `android-done.png`.
- [Mixed Android/browser](../artifacts/native/android-browser-mixed.json): fresh native host invitation and independent browser admission/readiness; native Yep first has no match, browser Yep pushes a match to native without another native command; browser's final pick pushes confirmed Done to native. Browser observed9 shared and9 neutral activity frames, with zero JavaScript errors. Screenshots: `mixed-native-match.png`, `mixed-native-done.png`, `mixed-browser-done.png`.
- The Python UI harness reads accessibility nodes; the CJS peer operates the actual browser UI. No API-created rooms, invented participants/activity or private credential inspection. Invitations remain only in process memory and never enter reports or screenshots. The harness selects the actual close button ahead of the equally labeled backdrop.
- Helper scripts: `scripts/native-android-smoke.py`, `native-browser-peer.cjs`, `native-mixed-smoke.py`. Run solo from a freshly launched native entry; run mixed once from that solo room's Done, or use `--from-setup` in a fresh configured native room. Completed smoke actors remain required; use another fresh room rather than reusing a mixed room after its browser context closes.

The read-only emulator and Metro8140 remain running for handover. Gateway4323 is owned/retained by the gateway thread. No main app source or package/configuration workaround was needed. Typecheck and lint pass; lint retains the existing unused View warning in legacy Voting.tsx.

## Limits

- This Linux host has no Xcode or macOS/iOS SDK. A native iPhone build requires a macOS/Xcode host; neither cloud builds nor accounts were used. Earlier iOS Hermes exports remain JavaScript evidence only.
- ARM64 compiled, but only x86-64 emulation executed. No physical Android/iPhone device, hardware audio, native trailer playback, native member sign-in/return, accessibility audit or provider handoff was tested in this task.
- No credential/security testing, paid/cloud builds, account registration, publishing or production signing changes occurred. Identity/auth refresh work remains excluded.
- Ordinary owner checks do not replace independent review. r12/layout and r13/guest recovery independent review remains pending because the reviewer is unavailable; r10/player and r11/Undo independent passes remain as previously recorded.

Official references consulted: [Expo58](https://docs.expo.dev/versions/v58.0.0/), [local native compilation](https://docs.expo.dev/guides/local-app-development/), [AGP9.2 compatibility](https://developer.android.com/build/releases/agp-9-2-0-release-notes), [Android emulator CLI](https://developer.android.com/studio/run/emulator-commandline), [Adoptium installation](https://adoptium.net/installation/linux).
