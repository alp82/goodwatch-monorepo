# Guest beta packaging handover

Readiness is a separate immutable change, committed `cafbd7c0` and root-approved/activated on8133/8141. Its source/export/activation evidence remains under `artifacts/readiness`. No user device command, forced reload, app launch or room mutation was used for activation.

## Ready artifacts

- Production-origin static directory: `.expo/exports/beta-web-r1`. Copy its contents into the hosting static document root. Hashes and all files: `web-export.json`. It is not deployed.
- Standalone APK: `.expo/release/preview-r1/yepwatch-app/android/app/build/outputs/apk/release/app-release.apk`, SHA256 `e6b059d942f0d10c53daff0afafac1b7f52198a86534897bc340c389e1aa9a53`.
- Android package `com.yepwatch.preview`, version0.1.0/code1, ARM64+x86_64, bundled JS, separate local preview signing identity. Actual cert SHA256 `7A:4B:9F:AA:19:4C:06:82:22:94:0E:BE:16:61:AB:6F:8F:D3:D7:14:78:5A:15:BF:76:D2:33:52:A9:75:2D:1D`. This is NOT a production/upload signing key.
- Local preview keystore/password file exists only in ignored `.expo/signing/preview` with private permissions. Do not upload or commit it; preserve privately for future compatible preview updates.
- EAS profile resolver/schema: `eas-profiles.json`. PreviewAPK/iOSSimulator and productionAAB/iOSstore are prepared. No cloud build/submission has run.

## Checks and limits

`android-preview.json` records the actual release compile, signature verification, bundled JS and existing emulator install/COLD launch. `android-preview-entry.png` shows own guest entry, without GoodWatch sign-in. The physical user's installed `dev.yepwatch.hybrid` was not replaced, relaunched or automated. No public room creation was attempted: the intended HTTPS/WSS backend is not deployed. Native/web dependency resolution from actual release source maps is isolated (`resolution.json`), with no webapp/server imports. Web guest entry at390/1440 has zero JS errors (`web-entry.json`).

The staged web export contains the actual preview Android association only. No production certificate or Apple team ID was invented. AASA must remain404 until an owner-supplied real Apple identifier is available. Android intent filter covers `/r/` only; browser `/room/*` recovery is hosting-owned.

Owner setup remains: Expo login/owned EAS project; real Apple Developer team + App Store Connect app/signing for TestFlight; owner-controlled Google Play/app-upload signing for a later store release. Account credentials must not be sent in chat. No accounts, permanent store keys, cloud jobs, paid services, DNS changes, deployment or submissions were created here. Store icon/listing/privacy declarations and full public-backend/device QA are still release work. Linux cannot build/run Xcode; physical iPhone and standalone public-network multiplayer are unverified. Earlier blocked independent layout/guest-recovery review and unreviewed refresh work remain excluded.
