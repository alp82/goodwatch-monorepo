# Guest-only private beta builds

The public target is `https://yepwatch.com`, with WSS on the same host and proposal contract3. These values do not mean a backend is deployed. Create/join needs the coordinated full-catalog backend, gateway and hosting readiness checks. Guests use movies/new shows; GoodWatch sign-in and continuation are hidden in beta builds. Development builds retain the existing member integration.

## Install identities and versions

| Variant | Android / iOS identifier | Use |
| --- | --- | --- |
| Default development | `dev.yepwatch.foundation` | Existing local source default |
| Retained phone development build | `dev.yepwatch.hybrid` | Isolated8141 project; never overwritten by release scripts |
| Preview | `com.yepwatch.preview` | Separate standalone YepWatch Beta APK / iOS Simulator |
| Production | `com.yepwatch.app` | Intended store identity, not registered/submitted here |

Version is0.1.0. Increment `APP_BUILD_NUMBER` (positive Android versionCode / iOS buildNumber) in the base EAS profile for each new distributed build; do not reuse a store build counter. Current default3 is the R4 retry-compatible preview; the first preview remains code1. No OTA update service is configured.

## Local Android preview

Full repo and Node24 are required because the contracts are a sibling file dependency. Run `npm ci --install-links` inside `yepwatch-app`.

- `npm run release:config` validates/prints public production configuration.
- `npm run release:web` creates isolated `.expo/exports/beta-web-r3` (choose a new output for subsequent exports).
- `npm run release:preview:android` creates isolated `.expo/release/preview-r3`, installs copied dependencies, prebuilds and compiles an ARM64+x86_64 standalone release APK. It requires the full JDK21 and AndroidSDK configured in the script; it never installs on a device or starts Metro.

The APK and SHA256 are recorded in `.expo/release/preview-r3/build-result.json`. A dedicated preview key lives only under ignored `.expo/signing/preview` with private file permissions. Preserve it privately for compatible preview updates. This key is **not** a production/store signing or upload key. Do not copy its passwords/keystore into source, logs, EAS uploads or public reports. Local Gradle signing is enabled only for the preview variant through the config plugin; production cloud credentials are separate.

A bundled APK can compile/launch without Metro, USB or a deployed backend. Ordinary entry working offline does not prove network rooms. Do not replace/relaunch the user's active `dev.yepwatch.hybrid` app to test the preview.

## EAS / iPhone owner setup (not performed)

`eas.json` includes preview AndroidAPK + iOSSimulator and production AndroidAAB + iOSstore profiles. Run EAS commands from this app directory in the full repository; its archive must include `goodwatch-webapp/packages/yepwatch-contracts`. `.easignore` excludes generated builds/signing/local evidence, and `NPM_CONFIG_INSTALL_LINKS=true` preserves dependency isolation.

The owner must log into their Expo account, choose/create the owned EAS project, and supply its real `EXPO_ACCOUNT_OWNER` / `EAS_PROJECT_ID`. No login/project exists on this host. Before any cloud upload, inspect the archive with `eas build:inspect --stage archive --platform android --profile preview` and check the sibling contract, install isolation and absence of secrets. Archive/cloud execution is still unverified.

With explicit owner authorization, `npx eas-cli@latest build --profile production --platform ios` prepares a store-signed build for later TestFlight upload. It needs the owner's Apple Developer team and signing/provisioning access, plus an App Store Connect app matching `com.yepwatch.app`. A later TestFlight submission is a separate authorized step. No paid build, Apple account, signing identity, submission or TestFlight execution happened here. Linux cannot run Xcode; [Mac simulator instructions](ios-quickstart.md) remain available. Android store distribution similarly needs owner-controlled Play Console/app signing/upload credentials; local preview signing does not establish that ownership.

## Invite associations and smoke report

Android app links request only `https://yepwatch.com/r/*`; `/room/*` remains browser SPA recovery. `scripts/write-android-association.cjs EXPORT_DIR PACKAGE CERT_SHA256` adds an association from the **actual** certificate. The staged beta web export includes only `com.yepwatch.preview` and its real local preview certificate, never a fabricated production fingerprint. Apple AASA stays absent/404 until the actual Apple team/application identifier exists. Hosting serves association paths as exactJSON or404, never SPA fallback.

After public hosting is ready, verify on separate test installs: cold launch with Metro stopped, fresh create/invite join, automatic single-screen entry, explicit remote-screen selection, private Yep/Nope/Undo, shared proposal replacement/Agree/withdraw, reconnect/background resume and confirmed Done. Report device/OS/build hash, steps and actual errors; never include room credentials, invite codes, keys or account grants. Physical iPhone playback/audio/link return and standalone public-endpoint room journeys remain unverified.

References: [Expo variants](https://docs.expo.dev/build-reference/variants/), [APK builds](https://docs.expo.dev/build-reference/apk/), [EAS configuration](https://docs.expo.dev/eas/json/), [monorepos](https://docs.expo.dev/build-reference/build-with-monorepos/), [versioning](https://docs.expo.dev/build-reference/app-versions/), [iOS submission](https://docs.expo.dev/submit/ios/).

[R4 exact-request retention and manual retry details](r4-retry-compatibility.md).
