# iPhone Simulator quickstart (Mac)

**Code availability:** The implementation commits are currently local on `feat/shared-scoring`, not yet pushed. Ask the maintainer for the published branch/commit before starting; don’t assume the public default branch contains this app.

## Prepare your Mac

- Use **Node24** and full **Xcode26.4+** on a compatible macOS version ([Expo58 requirements](https://docs.expo.dev/versions/v58.0.0/)). Open Xcode once and finish its setup/license prompts.
- In **Xcode → Settings → Locations → Command Line Tools**, select that Xcode installation, not standalone Command Line Tools ([Apple instructions](https://developer.apple.com/documentation/xcode/configuring-command-line-tools-settings)). Check with `xcodebuild -version`.
- In **Xcode → Settings → Components**, install an iOS Simulator runtime, then open Simulator and select an iPhone ([Apple instructions](https://developer.apple.com/documentation/xcode/downloading-and-installing-additional-xcode-components)). Simulator testing needs no signing team or production secrets.

## Compile and launch

Clone/download the **whole [repository](https://github.com/alp82/goodwatch-monorepo)** and check out the maintainer-provided published ref. The app needs its sibling `goodwatch-webapp/packages/yepwatch-contracts`; copying only `yepwatch-app/` won’t work.

```sh
cd goodwatch-monorepo/yepwatch-app
node --version                 # Must be v24.x
npm ci --install-links
npm run ios
```

This runs `expo run:ios`: generates the native project, installs native dependencies, compiles and launches the Simulator app, and starts Metro. Follow local CocoaPods installation prompts if needed. Keep Metro running. This checks a native build, not Expo Go or a Hermes export ([Expo guide](https://docs.expo.dev/guides/local-app-development/)).

**Compile/launch and the landing screen can be checked before backend connectivity.**

## Test rooms when endpoints are ready

Ask the maintainer for reachable **HTTPS API**, **WSS gateway** and **HTTPS web-invite origins**, with matching server allowlists. Replace these example values before restarting `npm run ios`:

```sh
export EXPO_PUBLIC_API_ORIGIN=https://api.example.invalid
export EXPO_PUBLIC_WS_ORIGIN=wss://ws.example.invalid
export EXPO_PUBLIC_APP_ORIGIN=https://web.example.invalid
npm run ios
```

The `https://yepwatch.com` default is a target, not a deployed-backend promise. The developer’s Linux-host `localhost` addresses are not your Mac’s localhost and won’t connect you to their services.

- [ ] Confirm native build/launch and visible landing controls.
- [ ] With configured endpoints, create/join as a guest, confirm country/services, try Yep/Nope/Undo, then match/pick with a friend and reach Done. Open/close a trailer.
- [ ] Send the commit (`git rev-parse HEAD`), Mac chip/macOS, Xcode version, Simulator model/runtime, pass/fail, screenshot and first useful error lines. Exclude invitation links and tokens.
