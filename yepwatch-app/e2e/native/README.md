# YepWatch Android E2E

Release-like APK (Hermes bytecode embedded, no dev menu) on headless emulators, against a hermetic loopback
stack. Gates: journey completes, flash, errors, accessibility. Timings are reported against their targets
(`budgets.mjs`, shared moments from `../budgets.mjs`), never a gate. Frame pacing is reported (`YW_E2E_FRAMES=gate`
makes it a gate, GPU-backed emulators only). No retries.

```sh
cd yepwatch-app/e2e/native
node run.mjs journey        # what CI runs (GitHub emulator): cold start + one mixed room, no video, no timings
node run.mjs subset         # the same room with video flash checks and reported timings, on one emulator
npm run e2e:native:gate     # the two-phone Android journey (~1.5 min warm, ~3 min from a cold machine)
npm run e2e:native:full     # everything, incl. 3 min background, mixed Android/browser rooms
npm run e2e:native:maestro  # the two-phone journey through the YAML flows only (slow, see flows/README.md)
```

Results: `.cache/runs/<mode>-<stamp>/result.json` with videos, failure screenshots, plateau/spike frames and
logcat per phone. Exit code 0 only if every gate passes.

## Pieces

| | |
| --- | --- |
| `lib/env.mjs` | SDK/JDK/Maestro paths (nothing on PATH needed), shared cache `~/.cache/yepwatch-e2e-native` (`YW_E2E_HOME`) |
| `lib/build.mjs` | APK cache. Native key (lockfile, app config, plugins, assets) -> prebuild + Gradle `assembleRelease` x86_64 in a staging copy (~95 s warm Gradle cache). JS key (src + origins) -> `export:embed` + `hermesc`, swap the bundle in the cached APK, re-sign (~30 s). Unchanged -> 0 s. |
| `build/` | Staging-only app config: package `dev.yepwatch.e2e`, invitation app links (`https://yepwatch.com/r/`, `http://127.0.0.1/r/`), cleartext allowed for loopback only, no OTA URL (the build refuses one). |
| `lib/device.mjs` | AVD `yw-e2e` (Pixel 8, API 35, host GPU) with a prepared snapshot (offline: wifi + data off, show touches, Maestro driver installed). Two read-only instances on 5570/5572 boot in 4-10 s. `adb reverse` for stack ports. |
| `lib/phone.mjs` | Fast driver: hierarchy over gRPC from Maestro's on-device server (~190 ms), taps through `adb shell input tap` (no wait for window animations). |
| `lib/video.mjs` | Timing (reported) + flash from the emulator's own 60 fps recorder (method and resolution in the file header). |
| `lib/gates.mjs` | logcat (JS errors, fatal JS, native crashes, ANRs), a11y (label + 48 dp), `gfxinfo framestats`, blocking words. |
| `lib/stack.mjs` | Origins: `YW_E2E_STACK` -> `../.stack.json` (shared stack) -> `.cache/dev-stack.json` -> env. |
| `stack/dev-stack.mjs` | Interim stack until the shared one is merged: synthetic catalog, in-memory rooms, Valkey in Docker, gateway, web export; `env -i` allowlist + loopback-only socket preload. |
| `driver.mjs` | `openAndroid()` / `AndroidPeer` for the web harness's fixtures (createRoom, join, start, yep, propose, agree, waitTonight). |
| `flows/` | Maestro YAML journeys (also what iOS would run). |
| `ci/eas-maestro-ios.yml` | Sketch of an iOS run on EAS Workflows before an OTA. Not wired up. |

## Safety

- The APK only knows loopback origins (checked at build time) and the emulator has no network; app links
  that fail to open the app can't reach yepwatch.com.
- Stack processes start from `env -i` with an allowlist, loopback-only endpoints and a preload that refuses
  non-loopback sockets. No `.env` is read.
- Next to another harness: `YW_E2E_EMU_PORTS=5574` (even ports 5556-5584) runs this harness's emulators on
  other console ports. The driver's host forward follows the port (5570 -> 19500, 5574 -> 19502), and
  `E2E_SLOT` picks the stack.
- adb's emulator port scan is switched off (`ADB_LOCAL_TRANSPORT_MAX_PORT=5553`): local services on
  5555-5585 otherwise appear as offline emulators and break Maestro's device listing.

Start-to-voting video timing uses the stationary Undo control in the voting bar: the first-round tutorial deliberately drags the real poster. The journey separately requires a poster and title on both phones, exercises Skip without opening Details, and audits the resting controls. Video plateau detection compares the whole still run, so gradual animation is not mistaken for a static intermediate screen.
The tutorial poster is an explicitly declared animation region for screen-flash analysis; blank detection still inspects the whole frame. A static intermediate outside that region must still fail.

GitHub's no-video journey renders at half physical resolution and half density, preserving the exact dp viewport, animation behavior and 48 dp accessibility requirement. Full/video runs require full resolution. The release driver can reuse a successful full web stage only after git diff proves subsequent changes are confined to native test tooling; app, backend, shared harness or web-test changes force a new full web run.

CI uses Lavapipe (the SwiftShader backend freezes during Invite) and cold-boots the software-rendered emulator instead of restoring graphics resources from Quick Boot. Hardware-GPU video runs retain their saved snapshot. Both paths apply the same device input, clock and network setup before the app runs.
