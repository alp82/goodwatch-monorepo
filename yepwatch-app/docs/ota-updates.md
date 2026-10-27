# YepWatch OTA updates

Build 16 is the first installed version able to receive EAS Update. Testers must install it once from TestFlight or the Android APK link. Older builds cannot gain OTA support remotely.

| Install | Build profile | Update channel | EAS environment |
| --- | --- | --- | --- |
| Android Beta APK (`com.yepwatch.preview`) | preview | beta-preview | preview |
| TestFlight (`com.yepwatch.app`) | beta | beta | production |
| Future store production | production | production | production |

The Android preview has a separate package/signature, so it deliberately has its own channel. Both currently call the live YepWatch backend. The production channel is not promoted automatically.

## Publish a tested change

From `yepwatch-app`, after committing the tested source:

```sh
npm run update:beta:ios -- --message "Describe the fix" --non-interactive
npm run update:beta:android -- --message "Describe the fix" --non-interactive
```

These commands publish JS/assets, not new app binaries. They consume update delivery allowance, not cloud build allowance. There is no automatic publication on every Git push.

Builds and updates use `runtimeVersion.policy = fingerprint`. Native dependencies, configuration and install identity determine compatibility. A new native fingerprint requires a new binary; publishing an incompatible update does not upgrade an older native runtime. Keep the build number unchanged for JS-only releases. For native releases, increment it in `eas.json`, then synchronize the public EAS values before building:

```sh
npm run update:configure-env
```

This script copies only public app configuration from `eas.json` to the existing project's production/preview environments. No database, signing or OAuth secrets belong there. EAS Update does not inherit the build profile's `env` object. Use the environment shown above, including the correct variant and build number, so update fingerprints and public endpoints match the build.

## Installation and recovery

Startup checks in the background with zero network wait. The bundled/cached app starts immediately. A downloaded update applies on a subsequent cold launch; we never call `reloadAsync` during a room. To test, open online, allow the download, fully close the app, then reopen. An interrupted/offline check leaves the existing version usable. Room credentials remain in their normal storage.

If a published update misbehaves, use the channel's **Roll back to embedded** action in EAS (or `eas update:roll-back-to-embedded` with the matching channel/platform/runtime). The fallback is the version bundled into the binary, not a reset of room data. Do not disable Expo's anti-bricking/error recovery protections or change a channel to an unrelated runtime. Test rollback against a beta install before promoting a release to production.

Useful checks:

```sh
npx eas-cli@latest account:usage alperortac --non-interactive
npx eas-cli@latest channel:view beta
npx eas-cli@latest channel:view beta-preview
```

Build 16 also contains the latest Back-navigation/sign-in fixes and optional safe connection details for the unresolved iPhone networking report. OTA setup does not itself fix that network failure.

References: [EAS Update](https://docs.expo.dev/eas-update/getting-started/), [native compatibility](https://docs.expo.dev/eas-update/runtime-versions/), [environment variables](https://docs.expo.dev/eas/environment-variables/).
