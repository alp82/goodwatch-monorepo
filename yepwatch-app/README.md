# YepWatch Expo client

Expo SDK58 / React Native0.88 / TypeScript / Expo Router, with native and browser guest participation. The current source implements continuous contract2 and the approved Glow design. Individual Yep/Nope choices stay private; server-confirmed matches appear while choosing. Inspect matches, pick or keep voting; unanimous current picks automatically produce a freshly checked decision.

```bash
cd yepwatch-app
npm ci --install-links
npm run web
```

Node24 is required. Public API defaults to `https://yepwatch.com`; this is target configuration, not a deployment claim. Configure `EXPO_PUBLIC_API_ORIGIN` and `EXPO_PUBLIC_WS_ORIGIN` for a coordinated local API/gateway. The optional `EXPO_PUBLIC_APP_ORIGIN` controls public invitation links; browser defaults to the participating app origin. HTTP/WS are allowed only on loopback, HTTPS/WSS elsewhere. No database, account or gateway service secrets belong in Expo public variables.

The app depends on a copied local `@goodwatch/yepwatch-contracts` package with `install-links=true`. It does not import the webapp/server runtime or alter root workspace resolution. After same-version contract edits, remove only this app's installed contract copy and run `npm install --install-links` here.

Guests can create/join with one shared screen, confirm an editable country and actual services, and choose movies/new shows. Remote/mixed screens, media/mood/time settings are available in drawers. Continuing shows requires real linked GoodWatch saved progress, with no manual history. Browser linking and saved-progress continuation are verified locally with the existing central issuer and disposable identity/tracking data. Production account authorization and physical native callback/player behavior still require validation; an unavailable endpoint is never presented as a verified sign-in.

[Implementation and verification notes](docs/glow-implementation.md) describe the state model, transport, privacy, auth, tests and retained development runtimes. Earlier foundation evidence in `docs/verification.md` and older artifacts describes historical v1 builds, not the current continuous source.

```bash
npm run typecheck
npm run lint
npm test
npm run test:browser
# Choose NEW output directories, never a currently served export:
npx expo export --platform web --source-maps --output-dir .expo/exports/my-web-check --clear
npx expo export --platform ios --platform android --source-maps --output-dir .expo/exports/my-native-check
WEB_EXPORT_DIR=.expo/exports/my-web-check NATIVE_EXPORT_DIR=.expo/exports/my-native-check npm run check:resolution
```

Browser component tests use isolated `dist-test` on8097. Current browser tests live in `tests/glow-browser`; old v1 specs remain in `tests/browser` for historical reference. Component fixtures cannot prove multiplayer. Real three-browser integration scripts under `scripts/glow-*` create only fresh rooms on their explicitly configured local runtime; coordinate before using them. Preserve all retained demo exports and backend memory/durable rooms.

Native room credentials and pending auth/commands use SecureStore. Browser auth uses HttpOnly cookies; sessionStorage has routing IDs and own pending commands, never bearer/account grants. Installed links, secure storage, player behavior and VoiceOver/TalkBack require device testing. The `yepwatch` development scheme and placeholder app identifiers do not claim universal-link hosting or store registration. No commits, deployment, DNS or store setup is part of this client build.
