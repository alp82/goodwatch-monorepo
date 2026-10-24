# YepWatch friend beta

Send testers **https://yepwatch.com**. The home page has both install QR codes and browser create/join controls; old `/beta` links redirect there. Android friends can use a directly installable **APK** while Google verifies the Play developer account. Later Android testing moves to Google Play **internal testing**. iPhone uses **external TestFlight**; the public invitation is **https://testflight.apple.com/join/V2gzwSFA**. Neither needs USB or a running development server.

## Owner setup — start here

The owner has created the Expo project [@alperortac/yepwatch](https://expo.dev/accounts/alperortac/projects/yepwatch), ID `0772c2db-91d8-4862-80eb-1d816f243072`, and reports Play and Apple developer accounts ready. `app.json` records the public Expo owner/project for all build variants. Account creation does not sign this machine into EAS or configure store signing credentials.

iPhone build 10 is approved for external TestFlight. Android preview build 11 is the current direct download; it includes the native system-Back correction. Apple approved external testing in **Friends beta**, and its public link is enabled. Internal testing uses **Team (Expo)**. Google Play developer verification is pending; Android friends use the direct preview APK. Later Play submission needs the app record and an EAS Submit service-account key (or a manual AAB upload in Play Console).

1. Create a free [Expo account](https://expo.dev/signup). Choose the account/organization that should own YepWatch.
2. Open [Google Play Console](https://play.google.com/console). **Google Cloud Console is a different product.** If needed, register a Play developer account, pay its one-time US$25 fee and complete Google's identity/device verification. Create the YepWatch app for `com.yepwatch.app`.
3. Enroll in the [Apple Developer Program](https://developer.apple.com/programs/enroll/) (US$99/year or local pricing). Once approved, create the App Store Connect app for `com.yepwatch.app`. EAS can build and upload from Linux; owning a Mac is not required.
4. Sign in locally; never send passwords, signing keys or login codes in chat:

   ```sh
   cd yepwatch-app
   npx eas-cli@latest login
   npx eas-cli@latest project:info
   ```

   This app has dynamic configuration, which preserves the checked-in public owner/project values. `EXPO_ACCOUNT_OWNER` and `EAS_PROJECT_ID` can override them for an explicitly separate project; leave them unset for the linked YepWatch project. Do not upload the repository's private `.env` files.

5. For the first iOS build, configure signing in your own terminal: `npx eas-cli@latest credentials:configure-build --platform ios --profile beta`. Sign in to Apple, select your developer team and let EAS create the distribution certificate/provisioning profile. Keep passwords and verification codes in that terminal. Android can generate its upload keystore in EAS during the first build; it is separate from the old preview key.

## Prepare the first build

- `eas.json` profile **beta** produces store-signed Android AAB / physical-device iOS builds, both `com.yepwatch.app`, using `https://yepwatch.com` and `wss://yepwatch.com`. Increment the checked-in build number for every later upload. Check the store's highest existing build first.
- Profile **preview** remains a separate APK / iOS **Simulator** build. It is not the iPhone/TestFlight profile. Preview build 11 uses the corrected Android navigation source and the original preview signing key; older preview APKs should not be distributed as current.
- Use owner-controlled store credentials. Keep `com.yepwatch.preview` and its local preview signing key separate. Store beta installs coexist with that preview.
- Before uploading, inspect the EAS archive: `npx eas-cli@latest build:inspect --platform android --profile beta --stage archive --output .expo/beta-archive`. Verify it includes the sibling `goodwatch-webapp/packages/yepwatch-contracts`, excludes credentials/local environment files/build artifacts, and installs with `npm ci --install-links`.
- EAS reads `.easignore` at the Git repository root. That file limits uploads to this app and its sibling contract; the app-local ignore file alone does not protect a monorepo upload.
- Finish the app icon, store privacy/support metadata and review contact information. Register the actual Play signing certificate in Android asset links and actual Apple team/app ID in the AASA file. Confirm the existing account issuer accepts the production app's callback. These require real account details, not placeholders.
- The Apple association now uses the verified team `QKFZC8CC8J` and `com.yepwatch.app`, scoped to `/r/*`, in `public/.well-known/apple-app-site-association`. Verify the deployed JSON and a physical iPhone link before claiming Universal Links work. The Android association currently names only `com.yepwatch.preview` with its verified APK signing certificate. Add `com.yepwatch.app` later using the **Play app-signing** certificate; the EAS upload key is not a substitute.

```sh
npx eas-cli@latest build --profile beta --platform android
npx eas-cli@latest build --profile beta --platform ios
```

No account creation, cloud builds, purchase, upload, review or store invitation has been completed merely by checking in this configuration.

## Android while Play verification is pending

The home page links to the [Expo download page for preview build 11](https://expo.dev/accounts/alperortac/projects/yepwatch/builds/3ec61b6d-e0dc-4edf-8a11-ec948febc8bc). Open it on Android, tap Install, open the downloaded APK and allow installation from that browser if Android asks. It installs as **YepWatch Beta** without USB, Metro or an Expo account. The eventual Play app is a separate install; its local room credentials do not transfer automatically.

The preview profile uses EAS **local credentials** to preserve the existing `com.yepwatch.preview` signing identity. A private, git-ignored `credentials.json` points to the original preview keystore. Keep that keystore and its passwords backed up privately; never generate a replacement for an upgrade. Then build with:

```sh
npx eas-cli@latest build --profile preview --platform android
```

EAS internal build links require the project's **Unauthenticated access to internal builds** setting to remain enabled. Check the install page in a signed-out browser before sharing. These build artifacts are time-limited; replace the download link when distributing a newer build. `androidApk` is used only while the normal `android` Play invitation is absent.

## Invite friends

**Android:** upload the AAB to Play's internal testing track. Add friends' Google-account email addresses (or a Google Group), complete the release, and copy the opt-in link. EAS submission is configured as a **draft** on the internal track:

```sh
npx eas-cli@latest submit --profile beta --platform android
```

For automated uploads, [configure a Google service-account key](https://docs.expo.dev/submit/android/) with access to this Play app and assign it under the Expo project's Android credentials for `com.yepwatch.app`. Keep the JSON private; never commit it. Both submit profiles explicitly name `com.yepwatch.app` because EAS Submit does not inherit the build profile's `APP_VARIANT` environment. The iOS profile also records the verified team and App Store Connect app ID.

**iPhone:** upload to App Store Connect, create an internal group and an external TestFlight group, provide beta review details, submit the first external build for review, then copy its public invitation link. Do not add friends as App Store Connect administrators.

```sh
npx eas-cli@latest submit --profile beta --platform ios
```

Set the verified invitation URLs in `src/features/beta/invitations.json` and redeploy the web app. Test each link from an ordinary tester account before sharing it. A build uploaded to TestFlight is not automatically available to external testers. TestFlight builds expire after 90 days.

## First session (3–5 friends)

Use real Android + iPhone devices, with Wi-Fi and mobile data, without USB/Metro. Verify: fresh install/cold launch; invitation opens the correct app/room; guest and GoodWatch sign-in return; shared providers and prompt save; Yep/Nope/Undo; remote presence; proposal replacement, agreement withdrawal and Done; trailer playback/audio; background/reconnect; explicit leave and same-device return. Test an app upgrade preserving the room too. Record device, OS and build with each result. A browser or simulator pass does not establish these device behaviors.

The beta page and Room drawer have **Send feedback**. It opens email to the existing GoodWatch support address with app/build/platform and a short report template; nothing is sent automatically and no room link, invitation or account credential is added. Friends can attach a screenshot. TestFlight's screenshot feedback also works.

Website deployments do not update installed apps. Distribute new builds through the testing tracks; OTA updates are not configured. Add manual CI build/submission automation only after the first signed build and account setup succeed. Keep mobile releases separate from Coolify website deploys.

References: [Expo build setup](https://docs.expo.dev/build/setup/), [EAS Submit](https://docs.expo.dev/deploy/submit-to-app-stores/), [Google internal testing](https://support.google.com/googleplay/android-developer/answer/9845334), [Apple TestFlight](https://developer.apple.com/testflight/).
