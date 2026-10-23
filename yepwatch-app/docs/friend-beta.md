# YepWatch friend beta

Send testers **https://yepwatch.com/beta**. The page offers the browser today; native install buttons stay disabled until their real invitations are verified. Android uses Google Play **internal testing**, iPhone uses **external TestFlight**. Neither needs USB or a running development server.

## Owner setup — start here

1. Create a free [Expo account](https://expo.dev/signup). Choose the account/organization that should own YepWatch.
2. Open [Google Play Console](https://play.google.com/console). **Google Cloud Console is a different product.** If needed, register a Play developer account, pay its one-time US$25 fee and complete Google's identity/device verification. Create the YepWatch app for `com.yepwatch.app`.
3. Enroll in the [Apple Developer Program](https://developer.apple.com/programs/enroll/) (US$99/year or local pricing). Once approved, create the App Store Connect app for `com.yepwatch.app`. EAS can build and upload from Linux; owning a Mac is not required.
4. Sign in locally; never send passwords, signing keys or login codes in chat:

   ```sh
   cd yepwatch-app
   npx eas-cli@latest login
   npx eas-cli@latest project:init
   ```

   This app has dynamic configuration. Link the real project via `EXPO_ACCOUNT_OWNER` and `EAS_PROJECT_ID`, or record the returned **public** owner/project ID in app configuration when prompted. Do not invent IDs. Store those values in the EAS environment used by the build too. Do not upload the repository's private `.env` files.

## Prepare the first build

- `eas.json` profile **beta** produces store-signed Android AAB / physical-device iOS builds, both `com.yepwatch.app`, using `https://yepwatch.com` and `wss://yepwatch.com`. Build number **8** is reserved for the first new beta; increment it for every later upload. Check the store's highest existing build first.
- Profile **preview** remains a separate APK / iOS **Simulator** build. It is not the iPhone/TestFlight profile. Existing preview APKs do not include the latest UI; do not distribute them as current.
- Use owner-controlled store credentials. Keep `com.yepwatch.preview` and its local preview signing key separate. Store beta installs coexist with that preview.
- Before uploading, inspect the EAS archive: `npx eas-cli@latest build:inspect --platform android --profile beta --stage archive --output .expo/beta-archive`. Verify it includes the sibling `goodwatch-webapp/packages/yepwatch-contracts`, excludes credentials/local environment files/build artifacts, and installs with `npm ci --install-links`.
- Finish the app icon, store privacy/support metadata and review contact information. Register the actual Play signing certificate in Android asset links and actual Apple team/app ID in the AASA file. Confirm the existing account issuer accepts the production app's callback. These require real account details, not placeholders.

```sh
npx eas-cli@latest build --profile beta --platform android
npx eas-cli@latest build --profile beta --platform ios
```

No account creation, cloud builds, purchase, upload, review or store invitation has been completed merely by checking in this configuration.

## Invite friends

**Android:** upload the AAB to Play's internal testing track. Add friends' Google-account email addresses (or a Google Group), complete the release, and copy the opt-in link. EAS submission is configured as a **draft** on the internal track:

```sh
npx eas-cli@latest submit --profile beta --platform android
```

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
